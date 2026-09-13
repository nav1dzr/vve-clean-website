-- Review-only migration. Apply only to an explicitly approved isolated database first.
-- Requires the existing invoice, payment-option and invoice-revision migrations.
-- No Stripe calls, deposit changes, document renumbering or historical-row backfill.
begin;

alter table public.invoice_payments add column if not exists operation_id uuid;
create unique index if not exists invoice_payments_operation_id_unique
  on public.invoice_payments(operation_id) where operation_id is not null;
alter table public.invoices add column if not exists revision_source_updated_at timestamptz;

-- Parent locking serializes item edits with issue/payment/revision transactions.
create or replace function public.guard_invoice_items_draft() returns trigger
language plpgsql set search_path = public as $$
declare parent_id uuid; parent_status text;
begin
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    raise exception 'Invoice items cannot be moved between invoices' using errcode='22023';
  end if;
  parent_id := case when tg_op='DELETE' then old.invoice_id else new.invoice_id end;
  select document_status into parent_status from public.invoices where id=parent_id for update;
  -- A draft parent deletion can cascade after the parent row has disappeared.
  if found and parent_status <> 'draft' then
    raise exception 'Issued invoice items cannot be changed' using errcode='40001';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists invoice_items_draft_guard on public.invoice_items;
create trigger invoice_items_draft_guard before insert or update or delete
on public.invoice_items for each row execute function public.guard_invoice_items_draft();
revoke all on function public.guard_invoice_items_draft() from public, anon, authenticated;

create or replace function public.invoice_financial_mutation(
  p_action text, p_invoice_id uuid, p_payload jsonb, p_admin_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  inv public.invoices; source_inv public.invoices; hdr public.invoices;
  pay public.invoice_payments; old_pay public.invoice_payments;
  source_id uuid; v_operation_id uuid; payment_id uuid; item jsonb;
  items_json jsonb; expected_at timestamptz; total_lines numeric := 0;
  amount numeric; paid numeric; due numeric; status_value text;
  item_count integer;
begin
  if p_action is null or p_action not in ('replace_draft','issue','record_payment','reverse_payment') then
    raise exception 'Unknown invoice operation' using errcode='22023';
  end if;
  if p_admin_id is null or not exists(select 1 from public.admin_users where id=p_admin_id) then
    raise exception 'An authorised admin is required' using errcode='42501';
  end if;
  -- Revision issuance locks the source and replacement in a stable order.
  if p_action='issue' then
    select revised_from_invoice_id into source_id from public.invoices where id=p_invoice_id;
    perform 1 from public.invoices where id in (p_invoice_id,source_id) order by id for update;
  end if;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;

  if p_action in ('replace_draft','issue') then
    if inv.document_status <> 'draft' then
      raise exception 'Only a draft invoice can be edited or issued' using errcode='40001';
    end if;
    expected_at := (p_payload->>'expected_updated_at')::timestamptz;
    if expected_at is null then
      raise exception 'Reload the invoice before saving or issuing it' using errcode='22023';
    end if;
    if inv.updated_at is distinct from expected_at then
      raise exception 'Invoice changed. Reload and review before trying again.' using errcode='40001';
    end if;
  end if;

  if p_action='replace_draft' then
    if jsonb_typeof(p_payload->'header') is distinct from 'object'
       or jsonb_typeof(p_payload->'items') is distinct from 'array' then
      raise exception 'Invoice header and items are required' using errcode='22023';
    end if;
    hdr := jsonb_populate_record(null::public.invoices,p_payload->'header');
    item_count := jsonb_array_length(p_payload->'items');
    if item_count not between 1 and 100 then
      raise exception 'An invoice requires between 1 and 100 items' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements(p_payload->'items') loop
      if coalesce(length(trim(item->>'description')),0)=0
         or (item->>'quantity')::numeric is null or (item->>'quantity')::numeric not between 0.000001 and 1000
         or (item->>'unit_price')::numeric is null or (item->>'unit_price')::numeric < 0
         or coalesce((item->>'line_discount')::numeric,0) < 0
         or (item->>'line_total')::numeric is null
         or (item->>'line_total')::numeric < 0 or (item->>'line_total')::numeric > 100000
         or (item->>'line_total')::numeric is distinct from
           (round(round((item->>'unit_price')::numeric*100)*(item->>'quantity')::numeric)
             -round(coalesce((item->>'line_discount')::numeric,0)*100))/100 then
        raise exception 'Invalid invoice line item' using errcode='22023';
      end if;
      total_lines := total_lines + (item->>'line_total')::numeric;
    end loop;
    if hdr.subtotal is distinct from total_lines or hdr.document_discount is null
       or hdr.document_discount < 0 or hdr.document_discount > total_lines
       or hdr.tax_total is distinct from 0::numeric
       or hdr.total is distinct from (total_lines-hdr.document_discount)
       or hdr.total > 500000 or hdr.deposit_applied is null or hdr.deposit_applied < 0
       or hdr.deposit_applied > hdr.total or (hdr.total>0 and hdr.deposit_applied=hdr.total)
       or hdr.amount_due is distinct from (hdr.total-hdr.deposit_applied) then
      raise exception 'Invoice totals do not match the items and deposit' using errcode='22023';
    end if;
    if exists(select 1 from public.invoice_payments where invoice_id=p_invoice_id) then
      raise exception 'A draft with payment activity requires review' using errcode='40001';
    end if;
    update public.invoices set
      customer_name=hdr.customer_name,customer_email=hdr.customer_email,customer_phone=hdr.customer_phone,
      customer_address=hdr.customer_address,customer_postcode=hdr.customer_postcode,po_reference=hdr.po_reference,
      issue_date=hdr.issue_date,due_date=hdr.due_date,service_date=hdr.service_date,
      subtotal=hdr.subtotal,document_discount=hdr.document_discount,tax_total=hdr.tax_total,total=hdr.total,
      deposit_applied=hdr.deposit_applied,amount_due=hdr.amount_due,amount_paid=0,
      customer_notes=hdr.customer_notes,internal_notes=hdr.internal_notes,payment_terms=hdr.payment_terms,
      payment_option=hdr.payment_option,stripe_payment_link_url=hdr.stripe_payment_link_url,
      service_contact_name=hdr.service_contact_name,service_contact_email=hdr.service_contact_email,
      service_contact_phone=hdr.service_contact_phone,service_address=hdr.service_address,
      service_contact_postcode=hdr.service_contact_postcode,invoice_recipient_email=hdr.invoice_recipient_email,
      receipt_recipient_email=hdr.receipt_recipient_email,billing_customer_id=hdr.billing_customer_id,
      service_customer_id=hdr.service_customer_id,updated_at=clock_timestamp()
    where id=p_invoice_id returning * into inv;
    delete from public.invoice_items where invoice_id=p_invoice_id;
    insert into public.invoice_items(invoice_id,description,quantity,unit_price,line_discount,line_total,sort_order)
      select p_invoice_id,x.description,x.quantity,x.unit_price,coalesce(x.line_discount,0),x.line_total,x.sort_order
      from jsonb_to_recordset(p_payload->'items') as x(description text,quantity numeric,unit_price numeric,line_discount numeric,line_total numeric,sort_order integer);
    insert into public.invoice_events(document_type,document_id,event_type,admin_id)
      values('invoice',p_invoice_id,'updated',p_admin_id);
    return jsonb_build_object('invoice',to_jsonb(inv));
  end if;

  if p_action='issue' then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order),'[]'::jsonb),coalesce(sum(line_total),0)
      into items_json,total_lines from public.invoice_items i where invoice_id=p_invoice_id;
    if jsonb_array_length(items_json)=0 or total_lines is distinct from inv.subtotal
       or inv.total is distinct from (inv.subtotal-inv.document_discount+inv.tax_total)
       or inv.amount_due is distinct from (inv.total-inv.deposit_applied-inv.amount_paid) then
      raise exception 'Invoice items and totals require review before issuing' using errcode='40001';
    end if;
    if inv.amount_due<=0 and inv.amount_paid<=0 then
      raise exception 'A zero-balance draft cannot be issued without a recorded payment' using errcode='40001';
    end if;
    if source_id is not null then
      select * into source_inv from public.invoices where id=source_id;
      if not found or source_id=p_invoice_id or source_inv.document_status<>'issued'
         or source_inv.payment_status<>'unpaid' or source_inv.superseded_by_invoice_id is not null
         or inv.revision_source_updated_at is null
         or source_inv.updated_at is distinct from inv.revision_source_updated_at
         or exists(select 1 from public.invoice_payments where invoice_id=source_id)
         or exists(select 1 from public.receipts where invoice_id=source_id) then
        raise exception 'The original invoice changed or has payment activity. Review it and create a new revision.' using errcode='40001';
      end if;
    end if;
    update public.invoices set invoice_number=public.next_document_number('invoice'),document_status='issued',
      issue_date=coalesce(inv.issue_date,current_date),issued_by_admin_id=p_admin_id,issued_at=clock_timestamp(),
      business_snapshot=p_payload->'business_snapshot',payment_instructions_snapshot=p_payload->'payment_instructions_snapshot',
      updated_at=clock_timestamp() where id=p_invoice_id returning * into inv;
    insert into public.invoice_events(document_type,document_id,event_type,admin_id,metadata)
      values('invoice',p_invoice_id,'issued',p_admin_id,jsonb_build_object('invoiceNumber',inv.invoice_number));
    if source_id is not null then
      update public.invoices set superseded_by_invoice_id=p_invoice_id,superseded_at=clock_timestamp(),updated_at=clock_timestamp() where id=source_id;
      insert into public.invoice_events(document_type,document_id,event_type,admin_id,metadata)
        values('invoice',source_id,'superseded',p_admin_id,jsonb_build_object('supersededById',p_invoice_id,'supersededByNumber',inv.invoice_number));
    end if;
    return jsonb_build_object('invoice',to_jsonb(inv),'items',items_json);
  end if;

  -- Historical payment corrections remain possible after void/cancellation.
  -- Only recording a new payment requires an active issued document.
  if p_action='record_payment' and (inv.document_status<>'issued' or inv.superseded_by_invoice_id is not null) then
    raise exception 'Payments require an active issued invoice' using errcode='40001';
  end if;
  if p_action='record_payment' then
    v_operation_id := (p_payload->>'operation_id')::uuid;
    amount := (p_payload->>'amount')::numeric;
    if v_operation_id is null or amount is null or amount<=0 or amount<>round(amount,2)
       or (p_payload->>'method') is null or (p_payload->>'method') not in ('bank_transfer','card','stripe','cash','other')
       or (p_payload->>'payment_date') is null then
      raise exception 'A payment ID, valid amount, method and date are required' using errcode='22023';
    end if;
    select * into old_pay from public.invoice_payments p where p.operation_id=v_operation_id;
    if found then
      if old_pay.invoice_id<>p_invoice_id or old_pay.amount<>amount or old_pay.payment_date<>(p_payload->>'payment_date')::date
         or old_pay.method is distinct from p_payload->>'method' or old_pay.reference is distinct from p_payload->>'reference'
         or old_pay.notes is distinct from p_payload->>'notes' or old_pay.reversed_at is not null then
        raise exception 'This payment request was already used with different details or reversed. Review the invoice.' using errcode='40001';
      end if;
      return jsonb_build_object('invoice',to_jsonb(inv),'paymentId',old_pay.id,'replayed',true);
    end if;
    select coalesce(sum(p.amount),0) into paid from public.invoice_payments p where p.invoice_id=p_invoice_id and p.reversed_at is null;
    if amount > round(inv.total-inv.deposit_applied-paid,2) then
      raise exception 'Payment amount exceeds the outstanding balance' using errcode='22023';
    end if;
    insert into public.invoice_payments(invoice_id,amount,payment_date,method,reference,notes,created_by_admin_id,operation_id)
      values(p_invoice_id,amount,(p_payload->>'payment_date')::date,p_payload->>'method',p_payload->>'reference',p_payload->>'notes',p_admin_id,v_operation_id)
      returning * into pay;
    paid := round(paid+amount,2);
  else
    payment_id := (p_payload->>'payment_id')::uuid;
    if coalesce(length(trim(p_payload->>'reason')),0)=0 then raise exception 'A reversal reason is required' using errcode='22023'; end if;
    select * into pay from public.invoice_payments where id=payment_id and invoice_id=p_invoice_id for update;
    if not found then raise exception 'Payment not found' using errcode='P0002'; end if;
    if pay.reversed_at is not null then
      if pay.reversal_reason is distinct from trim(p_payload->>'reason') then
        raise exception 'Payment is already reversed with a different reason' using errcode='40001';
      end if;
      return jsonb_build_object('invoice',to_jsonb(inv),'paymentId',pay.id,'replayed',true);
    end if;
    update public.invoice_payments set reversed_at=clock_timestamp(),reversed_by_admin_id=p_admin_id,reversal_reason=trim(p_payload->>'reason') where id=payment_id;
    select coalesce(sum(p.amount),0) into paid from public.invoice_payments p where invoice_id=p_invoice_id and reversed_at is null;
  end if;
  due := round(inv.total-inv.deposit_applied-paid,2);
  if due<0 then raise exception 'Existing payments exceed this invoice. Review required.' using errcode='40001'; end if;
  status_value := case when due<=0 then 'paid' when due<inv.total then 'partially_paid' else 'unpaid' end;
  update public.invoices set amount_paid=round(paid,2),amount_due=due,payment_status=status_value,
    paid_at=case when status_value='paid' then clock_timestamp() else null end,updated_at=clock_timestamp()
    where id=p_invoice_id returning * into inv;
  insert into public.invoice_events(document_type,document_id,event_type,admin_id,metadata)
    values('invoice',p_invoice_id,case when p_action='record_payment' then 'payment_recorded' else 'payment_reversed' end,p_admin_id,
      case when p_action='record_payment' then jsonb_build_object('paymentId',pay.id,'amount',pay.amount,'method',pay.method,'operationId',v_operation_id)
      else jsonb_build_object('paymentId',pay.id,'reason',trim(p_payload->>'reason')) end);
  return jsonb_build_object('invoice',to_jsonb(inv),'paymentId',pay.id,'replayed',false);
end $$;
revoke all on function public.invoice_financial_mutation(text,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.invoice_financial_mutation(text,uuid,jsonb,uuid) to service_role;
commit;
