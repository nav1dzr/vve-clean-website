import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { authFetch, ApiError } from '../lib/authFetch';
import { formatMoney, invoicePaymentMethodLabel } from '../lib/format';
import { readPendingBookingAllocation, rememberPendingBookingAllocation, clearPendingBookingAllocation, type PendingAllocation } from '../lib/pendingBookingAllocation';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';
import type { BookingAllocationInput, BookingAllocationReview, BookingAllocationResult } from '../types/bookingInvoiceAllocation';

const reasons:Record<string,string>={
  incomplete_history:'The full payment history could not be verified.',
  booking_link_required:'An explicit booking link is required.',
  active_issued_invoice_required:'Choose a current issued invoice.',
  completed_booking_required:'Complete the booking first.',
  test_booking_requires_review:'Test bookings cannot create a formal allocation.',
  currency_requires_review:'Check the payment currency.',
  version_required:'Refresh the invoice and booking.',
  multiple_invoices_require_review:'Review the other invoices linked to this booking first.',
  invalid_totals:'The recorded totals need review.',
  refund_requires_review:'This booking has a refund. Review its invoice and receipt first.',
  invalid_source_history:'The source payment history needs review.',
  source_totals_require_review:'The booking payment total does not match its full history.',
  existing_balance_payment_required:'Choose an existing balance payment.',
  source_already_linked:'This payment has already been linked.',
  existing_invoice_activity_requires_review:'Review the invoice payment/credit history first.',
  deposit_credit_requires_review:'The applied deposit and booking deposit need review.',
  deposit_reference_review_required:'Check the deposit source reference.',
  multiple_balance_payments_require_review: 'Review the multiple balance payments on this booking together first.',
  amount_requires_review:'This payment cannot fit the invoice balance without a separate review.',
};
function recordedDate(value:string) {
  return Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
}
type SavedAllocation = Extract<BookingAllocationResult, { ok: true }>;
type Props = {
  invoiceId: string;
  ownerId: string;
  onClose: () => void;
  onApplied: (result: SavedAllocation) => void;
};

export default function ApplyBookingPaymentModal({invoiceId,ownerId,onClose,onApplied}:Props) {
  const context={userId:ownerId,invoiceId};
  const [pending,setPending]=useState<PendingAllocation>(()=>readPendingBookingAllocation(context));
  const [review,setReview]=useState<BookingAllocationReview|null>(null);
  const [loadError,setLoadError]=useState<string|null>(null);
  const [selected,setSelected]=useState('');
  const [method,setMethod]=useState('');
  const [date,setDate]=useState('');
  const [depositReviewed,setDepositReviewed]=useState(false);
  const [sourceReviewed,setSourceReviewed]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [reload,setReload]=useState(0);
  const inFlight=useRef(false),revoked=useRef(false);
  useEffect(()=>{
    revoked.current = false;
    const stop=()=>{revoked.current=true;};
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT,stop);
    return () => {
      stop();
      window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, stop);
    };
  },[]);
  useEffect(()=>{
    if (pending.status !== 'none') return;
    let cancelled = false;
    setReview(null);
    setLoadError(null);
    authFetch<BookingAllocationReview>(`/api/invoices/${invoiceId}?action=bookingPaymentAllocation`)
      .then(data=>{if(!cancelled&&!revoked.current)setReview(data);})
      .catch(err=>{if(!cancelled&&!revoked.current)setLoadError(err instanceof ApiError?err.message:'Could not load the payment review.');});
    return ()=>{cancelled=true;};
  }, [invoiceId, pending.status, reload]);
  const candidate=review?.candidates.find(p=>p.sourcePaymentId===selected);
  const locked=pending.status!=='none';
  function choose(value:string) {
    if(locked)return;
    setSelected(value);setSourceReviewed(false);setDepositReviewed(false);setError(null);
    const source=review?.candidates.find(p=>p.sourcePaymentId===value);
    setMethod(source?.kind==='balance'?'stripe':'');setDate(source?recordedDate(source.recordedAt):'');
  }
  async function run(input:BookingAllocationInput|null,operationId:string) {
    if(inFlight.current||revoked.current)return;
    inFlight.current=true;setBusy(true);setError(null);
    try {
      const result=await authFetch<BookingAllocationResult>(`/api/invoices/${invoiceId}?action=bookingPaymentAllocation${input?'':'&operationId='+encodeURIComponent(operationId)}`,
        input?{method:'POST',body:JSON.stringify(input)}:undefined);
      if(revoked.current)return;
      if(result.ok) {
        if(!clearPendingBookingAllocation(context,operationId)) {
          setError('The allocation is saved, but this browser could not clear its recovery record. Check the invoice history before starting another action.');
          return;
        }
        onApplied(result);
        return;
      }
      setError(result.error);
      if(result.outcome==='not_applied'&&clearPendingBookingAllocation(context,operationId)) {
        setPending({status:'none'});setSelected('');setSourceReviewed(false);setDepositReviewed(false);setReload(v=>v+1);
      }
    } catch {
      if(!revoked.current)setError('The result is still pending. Retry this saved request to check its status.');
    } finally {inFlight.current=false;if(!revoked.current)setBusy(false);}
  }
  function submit() {
    if (inFlight.current || revoked.current) return;
    if(pending.status==='pending'){void run(pending.input,pending.input.operationId);return;}
    if(pending.status!=='none'||!review||!candidate||candidate.decision.state!=='review_ready'
      || review.expectedJourneyRevision === null || !sourceReviewed || !method || !date
      || (candidate.requiresDepositReview && !depositReviewed)) return;
    const input:BookingAllocationInput={
      operationId:crypto.randomUUID(),sourcePaymentId:candidate.sourcePaymentId,
      expectedInvoiceUpdatedAt:review.expectedInvoiceUpdatedAt,expectedJourneyRevision:review.expectedJourneyRevision,
      depositReviewed,reviewedSource:true,method,paymentDate:date,reason:'Owner reviewed and applied the existing linked booking payment',
    };
    if(!rememberPendingBookingAllocation(context,input)){setPending({status:'unavailable'});setError('This browser cannot safely keep the request for recovery. Check its storage settings before applying a payment.');return;}
    setPending({status:'pending',input});void run(input,input.operationId);
  }
  return <Modal titleId="apply-booking-payment-title" title="Apply an existing booking payment" onClose={()=>{if(!inFlight.current)onClose();}} wide>
    <p className="mb-4 text-sm leading-6 text-navy-700">Credit this invoice with money already received for the linked booking.</p>
    {pending.status==='pending'&&<div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
      A saved allocation request is awaiting a confirmed result. Retry the same request to check or complete it. The original details stay fixed.
      <p className="mt-2 break-all font-mono text-xs">{pending.input.sourcePaymentId}</p>
    </div>}
    {pending.status==='review'&&<div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
      This older or damaged recovery record needs review before another request.
      {pending.operationId&&<button type="button" disabled={busy} onClick={()=>void run(null,pending.operationId!)} className="mt-2 block min-h-11 font-semibold underline">Check saved allocation</button>}
    </div>}
    {pending.status==='unavailable'&&<p role="alert" className="mb-4 text-sm text-amber-900">Enable browser storage to save an allocation request for recovery.</p>}
    {error&&<p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">{error}</p>}
    {loadError&&<div role="alert" className="mb-4 text-sm"><p>{loadError}</p><button type="button" disabled={busy} className="min-h-11 underline" onClick={()=>setReload(v=>v+1)}>Retry review</button></div>}
    {pending.status==='none'&&!loadError&&!review&&<p role="status" className="mb-4 text-sm">Loading existing booking payments…</p>}
    {review&&pending.status==='none'&&<>
      <label className="block text-sm font-medium">Existing balance payment
        <select value={selected} onChange={e=>choose(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base">
          <option value="">Choose a recorded payment</option>
          {review.candidates.map(p=><option key={p.sourcePaymentId} value={p.sourcePaymentId}>{formatMoney(p.amountPence/100)} · {recordedDate(p.recordedAt)} · {p.kind==='balance'?'Stripe':'Recorded balance'}</option>)}
        </select>
      </label>
      {review.candidates.length===0&&<p className="mt-3 text-sm leading-6 text-navy-700">No eligible recorded balance payments were found. Check the linked booking first.</p>}
      {candidate&&<div className="mt-4 space-y-4">
        <p className="break-all rounded-lg bg-silver-100 p-3 text-xs leading-5"><span className="block font-semibold">Original booking payment reference</span>{candidate.sourcePaymentId}</p>
        {candidate.decision.state!=='review_ready'?<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm leading-6">{reasons[candidate.decision.code||'']||'This payment needs a separate financial review.'}</p>:<>
          <dl className="rounded-xl border border-silver-300 bg-silver-100 p-4 text-sm">
            <Figure label="Invoice amount due" value={review.invoiceDuePence}/>
            <Figure label="Existing payment to apply" value={candidate.amountPence}/>
            <Figure label="Invoice amount due afterwards" value={candidate.decision.invoiceDueAfterPence??0}/>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Original payment method
              <select value={method} disabled={candidate.kind==='balance'} onChange={e=>setMethod(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base">
                <option value="">Choose the actual method</option>{['bank_transfer','cash','card','stripe','other'].map(m=><option key={m} value={m}>{invoicePaymentMethodLabel(m)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Original payment date
              <input type="date" value={date} max={recordedDate(candidate.recordedAt)} onChange={e=>setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-silver-300 px-3 text-base"/>
            </label>
          </div>
          <p className="text-xs leading-5 text-navy-600">The date starts with when the booking payment was recorded. Adjust it if the actual payment arrived earlier.</p>
          {candidate.requiresDepositReview && <ul aria-label="Original booking deposit references" className="space-y-1 rounded-lg bg-silver-100 p-3 text-xs leading-5">
            {review.depositSources.map((payment) => (
              <li className="break-all" key={payment.sourcePaymentId}>
                {formatMoney(payment.amountPence / 100)} deposit · {recordedDate(payment.recordedAt)} · {payment.sourcePaymentId}
              </li>
            ))}
          </ul>}
          {candidate.requiresDepositReview&&<label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={depositReviewed} onChange={e=>setDepositReviewed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>I checked that the {formatMoney(review.depositAppliedPence/100)} deposit already applied to this invoice is the same deposit recorded on this booking.</label>}
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={sourceReviewed} onChange={e=>setSourceReviewed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>I checked the original payment reference and invoice history. This balance payment has not already been credited to this invoice.</label>
        </>}
      </div>}
    </>}
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-silver-300 px-4 font-medium disabled:opacity-50">Close</button>
      {(pending.status==='pending'||pending.status==='none')&&<button type="button" onClick={submit}
        disabled={busy||(pending.status==='none'&&(!candidate||candidate.decision.state!=='review_ready'||!sourceReviewed||!method||!date||(candidate.requiresDepositReview&&!depositReviewed)))}
        className="min-h-11 rounded-lg bg-navy-950 px-4 font-semibold text-white disabled:opacity-50">
        {busy?'Checking saved result…':pending.status==='pending'?'Retry saved allocation':'Apply existing booking payment'}
      </button>}
    </div>
  </Modal>;
}
function Figure({label,value}:{label:string;value:number}) {
  return <div className="flex items-baseline justify-between gap-3 py-1"><dt>{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{formatMoney(value/100)}</dd></div>;
}
