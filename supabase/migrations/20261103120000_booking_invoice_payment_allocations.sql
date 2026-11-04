-- Review-only. Apply to a disposable isolated database before a separately
-- approved production exception. No historical backfill, Stripe call or price change.
begin;

create table public.invoice_booking_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  booking_id uuid not null references public.bookings(id),
  invoice_id uuid not null references public.invoices(id),
  source_payment_external_id text not null unique references public.booking_journey_payments(external_id),
  invoice_payment_id uuid not null unique references public.invoice_payments(id),
  amount_pence integer not null check(amount_pence > 0),
  expected_invoice_updated_at timestamptz not null,
  expected_journey_revision integer not null,
  deposit_reviewed boolean not null,
  payment_method text not null check(payment_method in ('bank_transfer','cash','card','stripe','other')),
  payment_date date not null,
  review_reason text not null check(length(trim(review_reason)) between 1 and 1000),
  created_by_admin_id uuid not null references public.admin_users(id),
  created_at timestamptz not null default clock_timestamp()
);
create index invoice_booking_allocations_booking on public.invoice_booking_payment_allocations(booking_id);
alter table public.invoice_booking_payment_allocations enable row level security;
revoke all on public.invoice_booking_payment_allocations from public, anon, authenticated, service_role;
grant select on public.invoice_booking_payment_allocations to service_role;

create function public.guard_booking_invoice_allocation_history() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='invoice_booking_payment_allocations' then
    raise exception 'allocation_history_immutable' using errcode='40001';
  end if;
  if tg_table_name='invoice_payments' then
    if exists(select 1 from public.invoice_booking_payment_allocations where invoice_payment_id=old.id)
      then raise exception 'allocation_correction_requires_review' using errcode='40001'; end if;
  elsif tg_table_name='booking_journey_payments' then
    if exists(select 1 from public.invoice_booking_payment_allocations where source_payment_external_id=old.external_id)
      then raise exception 'allocation_source_immutable' using errcode='40001'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.guard_booking_invoice_allocation_history() from public,anon,authenticated,service_role;
create trigger allocation_history_immutable before update or delete on public.invoice_booking_payment_allocations
for each row execute function public.guard_booking_invoice_allocation_history();
create trigger allocated_invoice_payment_guard before update or delete on public.invoice_payments
for each row execute function public.guard_booking_invoice_allocation_history();
create trigger allocated_booking_payment_guard before update or delete on public.booking_journey_payments
for each row execute function public.guard_booking_invoice_allocation_history();

-- One consistent read-only SQL statement; no capped journey-view history or PII.
create function public.booking_invoice_allocation_snapshot(p_invoice_id uuid,p_admin_id uuid,p_operation_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_admin_id is null or not exists(select 1 from public.admin_users where id=p_admin_id)
    then raise exception 'allocation_admin_required' using errcode='42501'; end if;
  if p_operation_id is not null then
    select jsonb_build_object('allocationId',a.id,'paymentId',a.invoice_payment_id,
      'receiptId',(select r.id from public.receipts r where r.invoice_id=i.id order by r.created_at limit 1),
      'amountPaid',i.amount_paid,'amountDue',i.amount_due,'paymentStatus',i.payment_status,'replayed',true)
      into result from public.invoice_booking_payment_allocations a join public.invoices i on i.id=a.invoice_id
      where a.operation_id=p_operation_id and a.invoice_id=p_invoice_id and a.created_by_admin_id=p_admin_id;
    return result;
  end if;
  select jsonb_build_object(
    'invoice',jsonb_build_object('id',i.id,'booking_id',i.booking_id,'document_status',i.document_status,
      'superseded_by_invoice_id',i.superseded_by_invoice_id,'currency',i.currency,'total',i.total,
      'deposit_applied',i.deposit_applied,'amount_paid',i.amount_paid,'amount_due',i.amount_due,'updated_at',i.updated_at),
    'journey',(select jsonb_build_object('booking_id',j.booking_id,'revision',j.revision,'state',j.state,
      'paid_pence',j.paid_pence,'refunded_pence',j.refunded_pence,'agreed_total_pence',j.snapshot->'totalPence',
      'is_test',coalesce((select (to_jsonb(b)->>'measurement_is_test')::boolean from public.bookings b where b.id=i.booking_id),false))
      from public.booking_journeys j where j.booking_id=i.booking_id),
    'hasBookingReceipt',exists(
      select 1 from public.receipts r left join public.invoices ri on ri.id=r.invoice_id
      where r.invoice_id=i.id or r.booking_id=i.booking_id or ri.booking_id=i.booking_id
    ),
    'payments',coalesce((select jsonb_agg(to_jsonb(p)) from (
      select external_id,booking_id,kind,amount_pence,currency,created_at from public.booking_journey_payments
      where booking_id=i.booking_id order by created_at,external_id limit 501) p),'[]'::jsonb),
    'invoicePayments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id)) from public.invoice_payments p
      join public.invoices pi on pi.id=p.invoice_id where pi.id=i.id or pi.booking_id=i.booking_id),'[]'::jsonb),
    'relatedInvoices',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'booking_id',r.booking_id,
      'document_status',r.document_status,'superseded_by_invoice_id',r.superseded_by_invoice_id))
      from public.invoices r where r.booking_id=i.booking_id),'[]'::jsonb),
    'allocations',coalesce((select jsonb_agg(jsonb_build_object('source_payment_external_id',a.source_payment_external_id))
      from public.invoice_booking_payment_allocations a where a.booking_id=i.booking_id),'[]'::jsonb),
    'complete',jsonb_build_object('payments',(select count(*)<=500 from public.booking_journey_payments where booking_id=i.booking_id),
      'invoicePayments',true,'relatedInvoices',true,'allocations',true)
  ) into result from public.invoices i where i.id=p_invoice_id;
  if result is null then raise exception 'allocation_invoice_missing' using errcode='P0002'; end if;
  return result;
end $$;
revoke all on function public.booking_invoice_allocation_snapshot(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.booking_invoice_allocation_snapshot(uuid,uuid,uuid) to service_role;

create function public.apply_booking_invoice_allocation(
  p_invoice_id uuid,p_source_payment_external_id text,p_operation_id uuid,
  p_expected_invoice_updated_at timestamptz,p_expected_journey_revision integer,
  p_deposit_reviewed boolean,p_payment_method text,p_payment_date date,p_review_reason text,p_admin_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  inv public.invoices; j public.booking_journeys; source public.booking_journey_payments;
  prior public.invoice_booking_payment_allocations; source_booking uuid;
  credit jsonb; receipt_id uuid; allocation_id uuid; invoice_payment_id uuid;
  source_total bigint; deposit_total bigint; related_count integer;
begin
  if p_admin_id is null or not exists(select 1 from public.admin_users where id=p_admin_id)
    then raise exception 'allocation_admin_required' using errcode='42501'; end if;
  if p_operation_id is null or p_source_payment_external_id is null or length(p_source_payment_external_id)>300
    or p_expected_invoice_updated_at is null or p_expected_journey_revision is null
    or p_deposit_reviewed is null or p_payment_method is null
    or p_payment_method not in ('bank_transfer','cash','card','stripe','other')
    or p_payment_date is null or p_payment_date>current_date
    or length(trim(coalesce(p_review_reason,''))) not between 1 and 1000 then
    raise exception 'allocation_input_invalid' using errcode='22023';
  end if;

  select booking_id into source_booking from public.invoices where id=p_invoice_id;
  if source_booking is null then raise exception 'allocation_booking_link_required' using errcode='40001'; end if;
  -- Booking mutations lock the journey first too. No booking totals are changed.
  select * into j from public.booking_journeys where booking_id=source_booking for update;
  if not found then raise exception 'allocation_booking_link_required' using errcode='40001'; end if;
  perform id from public.invoices where booking_id=source_booking order by id for update;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if inv.booking_id is distinct from source_booking then raise exception 'allocation_stale' using errcode='40001'; end if;

  select * into prior from public.invoice_booking_payment_allocations where operation_id=p_operation_id;
  if found then
    if prior.invoice_id<>p_invoice_id or prior.source_payment_external_id<>p_source_payment_external_id
      or prior.expected_invoice_updated_at<>p_expected_invoice_updated_at
      or prior.expected_journey_revision<>p_expected_journey_revision
      or prior.deposit_reviewed<>p_deposit_reviewed or prior.payment_method<>p_payment_method
      or prior.payment_date<>p_payment_date or prior.review_reason<>trim(p_review_reason)
      or prior.created_by_admin_id<>p_admin_id then
      raise exception 'allocation_operation_conflict' using errcode='40001';
    end if;
    select id into receipt_id from public.receipts where invoice_id=p_invoice_id order by created_at limit 1;
    return jsonb_build_object('allocationId',prior.id,'paymentId',prior.invoice_payment_id,'receiptId',receipt_id,
      'amountPaid',inv.amount_paid,'amountDue',inv.amount_due,'paymentStatus',inv.payment_status,'replayed',true);
  end if;
  if inv.document_status<>'issued' or inv.superseded_by_invoice_id is not null
    then raise exception 'allocation_active_invoice_required' using errcode='40001'; end if;
  if j.state<>'completed' then raise exception 'allocation_completed_booking_required' using errcode='40001'; end if;
  if exists(select 1 from public.bookings b where b.id=source_booking and coalesce((to_jsonb(b)->>'measurement_is_test')::boolean,false))
    then raise exception 'allocation_test_booking' using errcode='40001'; end if;
  if inv.updated_at is distinct from p_expected_invoice_updated_at or j.revision<>p_expected_journey_revision
    then raise exception 'allocation_stale' using errcode='40001'; end if;
  if lower(inv.currency)<>'gbp' then raise exception 'allocation_currency_invalid' using errcode='22023'; end if;
  select count(*) into related_count from public.invoices where booking_id=source_booking
    and document_status in ('draft','issued') and superseded_by_invoice_id is null;
  if related_count<>1 then raise exception 'allocation_multiple_invoices' using errcode='40001'; end if;
  if j.refunded_pence<>0 or exists(select 1 from public.booking_journey_payments where booking_id=source_booking and kind='refund')
    then raise exception 'allocation_refund_review' using errcode='40001'; end if;
  if inv.total is null or inv.total<=0 or inv.total>500000 or inv.total<>round(inv.total,2)
    or inv.deposit_applied is null or inv.deposit_applied<0 or inv.deposit_applied>inv.total
    or inv.deposit_applied<>round(inv.deposit_applied,2) or inv.amount_paid<>0
    or inv.amount_due is null or inv.amount_due<>inv.total-inv.deposit_applied
    or j.paid_pence<0 or j.refunded_pence<0 then
    raise exception 'allocation_totals_invalid' using errcode='40001';
  end if;
  if jsonb_typeof(j.snapshot->'totalPence') is distinct from 'number' then
    raise exception 'allocation_totals_invalid' using errcode='40001';
  end if;
  if (j.snapshot->>'totalPence')::numeric<>inv.total*100 then
    raise exception 'allocation_totals_invalid' using errcode='40001';
  end if;
  if exists(
    select 1 from public.invoice_payments p join public.invoices pi on pi.id=p.invoice_id
    where pi.id=p_invoice_id or pi.booking_id=source_booking
  ) or exists(
    select 1 from public.receipts r left join public.invoices ri on ri.id=r.invoice_id
    where r.invoice_id=p_invoice_id or r.booking_id=source_booking or ri.booking_id=source_booking
  )
    or exists(select 1 from public.invoice_booking_payment_allocations where booking_id=source_booking) then
    raise exception 'allocation_existing_activity' using errcode='40001';
  end if;
  if (select count(*) from public.booking_journey_payments where booking_id=source_booking)>500
    or exists(select 1 from public.booking_journey_payments where booking_id=source_booking
      and (kind not in ('balance','manual_balance','deposit','manual_deposit') or amount_pence<=0 or currency<>'gbp')) then
    raise exception 'allocation_source_history_invalid' using errcode='40001';
  end if;
  select coalesce(sum(amount_pence),0),coalesce(sum(amount_pence) filter(where kind in ('deposit','manual_deposit')),0)
    into source_total,deposit_total from public.booking_journey_payments where booking_id=source_booking;
  if source_total<>j.paid_pence then raise exception 'allocation_source_totals_invalid' using errcode='40001'; end if;
  if deposit_total<>inv.deposit_applied*100 or (deposit_total>0 and p_deposit_reviewed is not true)
    then raise exception 'allocation_deposit_review' using errcode='40001'; end if;
  if (select count(*) from public.booking_journey_payments where booking_id=source_booking
      and kind in ('balance','manual_balance'))<>1 then
    raise exception 'allocation_multiple_balance_payments' using errcode='40001';
  end if;
  select * into source from public.booking_journey_payments where external_id=p_source_payment_external_id for update;
  if not found or source.booking_id<>source_booking or source.kind not in ('balance','manual_balance')
    or source.amount_pence<=0 or source.amount_pence<>inv.amount_due*100
    or (source.kind='balance' and p_payment_method<>'stripe')
    or p_payment_date>(source.created_at at time zone 'Europe/London')::date then
    raise exception 'allocation_source_invalid' using errcode='40001';
  end if;
  if exists(select 1 from public.invoice_booking_payment_allocations where source_payment_external_id=source.external_id)
    then raise exception 'allocation_source_already_linked' using errcode='40001'; end if;

  if exists(select 1 from public.invoice_payments where operation_id=p_operation_id)
    then raise exception 'allocation_operation_conflict' using errcode='40001'; end if;

  -- Reuse the established invoice transaction. The source link and audit rows
  -- below are in THIS transaction: any failure rolls this credit back too.
  credit:=public.invoice_financial_mutation('record_payment',p_invoice_id,jsonb_build_object(
    'operation_id',p_operation_id,'amount',source.amount_pence::numeric/100,
    'payment_date',p_payment_date,'method',p_payment_method,
    'reference',source.external_id,'notes','Existing booking payment allocation: '||trim(p_review_reason)),p_admin_id);
  invoice_payment_id:=(credit->>'paymentId')::uuid;
  insert into public.invoice_booking_payment_allocations(operation_id,booking_id,invoice_id,source_payment_external_id,
    invoice_payment_id,amount_pence,expected_invoice_updated_at,expected_journey_revision,deposit_reviewed,
    payment_method,payment_date,review_reason,created_by_admin_id)
    values(p_operation_id,source_booking,p_invoice_id,source.external_id,invoice_payment_id,source.amount_pence,
      p_expected_invoice_updated_at,p_expected_journey_revision,p_deposit_reviewed,p_payment_method,p_payment_date,
      trim(p_review_reason),p_admin_id) returning id into allocation_id;
  select * into inv from public.invoices where id=p_invoice_id;
  insert into public.invoice_events(document_type,document_id,event_type,admin_id,metadata)
    values('invoice',p_invoice_id,'updated',p_admin_id,jsonb_build_object(
      'kind','booking_payment_allocated','allocationId',allocation_id,'sourcePaymentId',source.external_id,
      'paymentId',invoice_payment_id,'amountPence',source.amount_pence,'changesMoneyReceived',false));
  insert into public.booking_journey_events(booking_id,revision,actor,event_type,details)
    values(source_booking,j.revision,p_admin_id::text,'invoice_payment_allocated',
      jsonb_build_object('invoiceId',p_invoice_id,'allocationId',allocation_id,'amountPence',source.amount_pence));
  if inv.payment_status='paid' then
    insert into public.receipts(receipt_number,source,invoice_id,invoice_number_snapshot,booking_id,
      customer_name,customer_email,customer_phone,customer_address,customer_postcode,invoice_total,total_paid,
      payment_date,payment_method,payment_reference,business_snapshot,created_by_admin_id)
    values(public.next_document_number('receipt'),'invoice',inv.id,inv.invoice_number,inv.booking_id,
      inv.customer_name,coalesce(inv.receipt_recipient_email,inv.customer_email),inv.customer_phone,inv.customer_address,
      inv.customer_postcode,inv.total,inv.amount_paid,p_payment_date,p_payment_method,source.external_id,inv.business_snapshot,p_admin_id)
    returning id into receipt_id;
    insert into public.invoice_events(document_type,document_id,event_type,admin_id,metadata)
      values('invoice',inv.id,'receipt_created',p_admin_id,jsonb_build_object('receiptId',receipt_id,'allocationId',allocation_id)),
      ('receipt',receipt_id,'created',p_admin_id,jsonb_build_object('invoiceId',inv.id,'allocationId',allocation_id));
  end if;
  return jsonb_build_object('allocationId',allocation_id,'paymentId',invoice_payment_id,'receiptId',receipt_id,
    'amountPaid',inv.amount_paid,'amountDue',inv.amount_due,'paymentStatus',inv.payment_status,'replayed',false);
end $$;
revoke all on function public.apply_booking_invoice_allocation(uuid,text,uuid,timestamptz,integer,boolean,text,date,text,uuid)
  from public,anon,authenticated;
grant execute on function public.apply_booking_invoice_allocation(uuid,text,uuid,timestamptz,integer,boolean,text,date,text,uuid) to service_role;
commit;
