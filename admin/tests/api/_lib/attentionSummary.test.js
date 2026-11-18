import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { attentionSummary } from '../../../api/_lib/attentionSummary.js';

const TODAY = '2026-11-16';
// Synthetic rows only.
function seed() {
  return createFakeSupabase({
    contact_enquiries: [{ id: 'q1', status: 'new' }, { id: 'q2', status: 'new' }, { id: 'q3', status: 'closed' }],
    bookings: [
      { id: 'b-review', payment_status: 'pending_payment', deposit_amount: 0, status: 'new', service_date: null },
      { id: 'b-offered', payment_status: 'pending_payment', deposit_amount: 0, status: 'new', service_date: '2026-11-20' },
      { id: 'b-yesterday', payment_status: 'paid', deposit_amount: 30, status: 'confirmed', service_date: '2026-11-15' },
      { id: 'b-done', payment_status: 'paid', deposit_amount: 30, status: 'completed', service_date: '2026-11-14' },
      { id: 'b-old', payment_status: 'paid', deposit_amount: 30, status: 'confirmed', service_date: '2026-08-01' },
      { id: 'b-today', payment_status: 'paid', deposit_amount: 30, status: 'confirmed', service_date: TODAY },
    ],
    booking_journeys: [{ booking_id: 'b-offered', state: 'offered' }, { booking_id: 'b-yesterday', state: 'confirmed' }],
    invoices: [
      { id: 'i-unsent', document_status: 'issued', payment_status: 'unpaid', amount_due: 100, due_date: '2026-11-30', sent_at: null, superseded_by_invoice_id: null },
      { id: 'i-overdue', document_status: 'issued', payment_status: 'unpaid', amount_due: 80, due_date: '2026-11-01', sent_at: '2026-10-25T09:00:00Z', superseded_by_invoice_id: null },
      { id: 'i-replaced', document_status: 'issued', payment_status: 'unpaid', amount_due: 80, due_date: '2026-11-01', sent_at: null, superseded_by_invoice_id: 'i-overdue' },
      { id: 'i-paid', document_status: 'issued', payment_status: 'paid', amount_due: 0, due_date: '2026-11-01', sent_at: null, superseded_by_invoice_id: null },
      { id: 'i-draft', document_status: 'draft', payment_status: 'unpaid', amount_due: 50, due_date: null, sent_at: null, superseded_by_invoice_id: null },
    ],
    invoice_email_outbox: [{ id: 'e1', status: 'held' }, { id: 'e2', status: 'uncertain' }, { id: 'e3', status: 'scheduled' }, { id: 'e4', status: 'sent' }],
  });
}

afterEach(() => vi.unstubAllEnvs());

describe('Home "Needs attention" counts', () => {
  it('counts each kind of outstanding work once', async () => {
    vi.stubEnv('INVOICE_EMAIL_QUEUE_ENABLED', 'true');
    const summary = await attentionSummary(seed(), TODAY);
    expect(summary.counts).toEqual({
      newEnquiries: 2,
      requestsToReview: 1,      // the offered booking is already past review
      depositsAwaited: 1,
      jobsToComplete: 1,        // yesterday's job only: not completed, not today's, not months old
      invoicesNotEmailed: 1,    // replaced, paid and draft invoices are not chased
      invoicesOverdue: 1,
      invoicesUnpaid: 2,
      emailsNeedingAttention: 2,
      emailsScheduled: 1,
    });
    expect(summary).toMatchObject({ today: TODAY, yesterday: '2026-11-15', recentJobsFrom: '2026-10-17', emailQueueEnabled: true });
  });

  it('leaves the email counts out while scheduled sending is switched off', async () => {
    const summary = await attentionSummary(seed(), TODAY);
    expect(summary.emailQueueEnabled).toBe(false);
    expect(summary.counts.emailsNeedingAttention).toBeNull();
    expect(summary.counts.emailsScheduled).toBeNull();
  });

  it('reports a count it cannot read as unavailable, and still returns the others', async () => {
    const db = seed();
    const realFrom = db.from;
    db.from = (table) => {
      if (table !== 'contact_enquiries') return realFrom(table);
      const failing = { select: () => failing, eq: () => failing, then: (resolve) => resolve({ count: null, error: { code: '42P01' } }) };
      return failing;
    };
    const summary = await attentionSummary(db, TODAY);
    expect(summary.counts.newEnquiries).toBeNull();
    expect(summary.counts.invoicesOverdue).toBe(1);
  });
});
