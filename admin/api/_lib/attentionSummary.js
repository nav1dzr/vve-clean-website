// "Needs attention" counts for the Home page: the handful of things the
// owner should act on next. Read-only. Every count is independent: one that
// cannot be read is reported as null (shown as unavailable), never as zero,
// and never stops the others from loading.
import { invoiceEmailQueueEnabled } from './invoiceEmailOutbox.js';

const RECENT_JOB_DAYS = 30;
const REVIEW_SCAN_LIMIT = 200;

function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function count(query) {
  try {
    const { count: total, error } = await query;
    return error ? null : (total ?? 0);
  } catch {
    return null;
  }
}

// Website and manual requests the owner has not yet agreed with the customer.
// A request already offered or confirmed in the booking workflow is excluded.
async function requestsToReview(supabase) {
  try {
    const { data, error } = await supabase.from('bookings').select('id')
      .eq('payment_status', 'pending_payment').eq('deposit_amount', 0).eq('status', 'new')
      .order('created_at', { ascending: false }).limit(REVIEW_SCAN_LIMIT);
    if (error) return null;
    const ids = (data || []).map((row) => row.id);
    if (!ids.length) return 0;
    const journeys = await supabase.from('booking_journeys').select('booking_id,state').in('booking_id', ids);
    if (journeys.error) return null;
    const progressed = new Set((journeys.data || []).filter((j) => j.state !== 'draft').map((j) => j.booking_id));
    return ids.filter((id) => !progressed.has(id)).length;
  } catch {
    return null;
  }
}

export async function attentionSummary(supabase, today) {
  const head = { count: 'exact', head: true };
  const liveInvoices = () => supabase.from('invoices').select('id', head)
    .eq('document_status', 'issued').is('superseded_by_invoice_id', null);
  const queueOn = invoiceEmailQueueEnabled();

  const [
    newEnquiries, toReview, depositsAwaited, jobsToComplete,
    invoicesNotEmailed, invoicesOverdue, invoicesUnpaid, emailsNeedingAttention, emailsScheduled,
  ] = await Promise.all([
    count(supabase.from('contact_enquiries').select('id', head).eq('status', 'new')),
    requestsToReview(supabase),
    count(supabase.from('booking_journeys').select('booking_id', head).eq('state', 'offered')),
    count(supabase.from('bookings').select('id', head)
      .gte('service_date', shiftDate(today, -RECENT_JOB_DAYS)).lt('service_date', today)
      .in('status', ['new', 'confirmed', 'scheduled', 'in_progress', 'rescheduled'])),
    count(liveInvoices().neq('payment_status', 'paid').is('sent_at', null)),
    count(liveInvoices().gt('amount_due', 0).lt('due_date', today)),
    count(liveInvoices().gt('amount_due', 0)),
    queueOn ? count(supabase.from('invoice_email_outbox').select('id', head).in('status', ['held', 'uncertain'])) : null,
    queueOn ? count(supabase.from('invoice_email_outbox').select('id', head).eq('status', 'scheduled')) : null,
  ]);

  return {
    today,
    recentJobsFrom: shiftDate(today, -RECENT_JOB_DAYS),
    yesterday: shiftDate(today, -1),
    emailQueueEnabled: queueOn,
    counts: {
      newEnquiries, requestsToReview: toReview, depositsAwaited, jobsToComplete,
      invoicesNotEmailed, invoicesOverdue, invoicesUnpaid, emailsNeedingAttention, emailsScheduled,
    },
  };
}
