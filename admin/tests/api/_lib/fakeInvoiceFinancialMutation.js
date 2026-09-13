// Test double for the RPC boundary. The real SQL is exercised separately by
// scripts/validate-invoice-financial-db.mjs; this is not a PostgreSQL emulator.
export async function fakeInvoiceFinancialMutation(ctx, args) {
  const { tables, genId, tick, nextNumber, fault } = ctx;
  const { p_action: action, p_invoice_id: id, p_payload: p, p_admin_id: admin } = args;
  const fail = (message, code = '40001') => { throw Object.assign(new Error(message), { code }); };
  const inv = (tables.invoices || []).find(x => x.id === id);
  if (!inv) fail('Invoice not found', 'P0002');
  tables.invoice_payments ||= [];
  tables.invoice_events ||= [];
  tables.invoice_items ||= [];
  tables.receipts ||= [];
  const event = (type, metadata, documentId = id) => {
    fault('audit');
    tables.invoice_events.push({id:genId(),document_type:'invoice',document_id:documentId,event_type:type,admin_id:admin,metadata,created_at:tick()});
  };
  if (['replace_draft','issue'].includes(action)) {
    if (inv.document_status !== 'draft') fail('Only a draft invoice can be edited or issued');
    if (!p.expected_updated_at) fail('Reload the invoice before saving or issuing it', '22023');
    if (p.expected_updated_at !== inv.updated_at) fail('Invoice changed. Reload and review before trying again.');
  }
  if (action === 'replace_draft') {
    Object.assign(inv, p.header, {updated_at:tick()});
    tables.invoice_items = tables.invoice_items.filter(x => x.invoice_id !== id);
    fault('items');
    tables.invoice_items.push(...p.items.map(x => ({id:genId(),...x,invoice_id:id})));
    event('updated');
    return {invoice:structuredClone(inv)};
  }
  if (action === 'issue') {
    const items=tables.invoice_items.filter(x=>x.invoice_id===id);
    if (!items.length) fail('Cannot issue an invoice with no line items');
    if (inv.amount_due<=0 && !inv.amount_paid) fail('A zero balance needs a recorded payment before issuing');
    if (items.reduce((n,x)=>n+x.line_total,0)!==inv.subtotal) fail('Invoice items and totals require review before issuing');
    const source=tables.invoices.find(x=>x.id===inv.revised_from_invoice_id);
    if (inv.revised_from_invoice_id && (!source || source.document_status!=='issued' || source.payment_status!=='unpaid'
      || source.superseded_by_invoice_id || !inv.revision_source_updated_at || source.updated_at!==inv.revision_source_updated_at
      || tables.invoice_payments.some(x=>x.invoice_id===source.id) || tables.receipts.some(x=>x.invoice_id===source.id))) fail('The original invoice changed or has payment activity. Review it and create a new revision.');
    const number=await nextNumber('next_document_number',{p_doc_type:'invoice'});
    if (number.error) throw number.error;
    Object.assign(inv,{invoice_number:number.data,document_status:'issued',issue_date:inv.issue_date||tick().slice(0,10),issued_by_admin_id:admin,issued_at:tick(),updated_at:tick(),business_snapshot:p.business_snapshot,payment_instructions_snapshot:p.payment_instructions_snapshot});
    event('issued',{invoiceNumber:inv.invoice_number});
    if (source) {
      Object.assign(source,{superseded_by_invoice_id:id,superseded_at:tick(),updated_at:tick()});
      event('superseded',{supersededById:id,supersededByNumber:inv.invoice_number},source.id);
    }
    return {invoice:structuredClone(inv),items:structuredClone(items)};
  }
  if (action==='record_payment' && (inv.document_status!=='issued' || inv.superseded_by_invoice_id)) fail('Payments require an active issued invoice');
  let pay;
  if (action==='record_payment') {
    pay=tables.invoice_payments.find(x=>x.operation_id===p.operation_id);
    if (pay) {
      if (pay.invoice_id!==id || pay.amount!==p.amount || pay.payment_date!==p.payment_date || pay.method!==p.method
        || (pay.reference||null)!==(p.reference||null) || (pay.notes||null)!==(p.notes||null) || pay.reversed_at) fail('This payment request was already used with different details or reversed. Review the invoice.');
      return {invoice:structuredClone(inv),paymentId:pay.id,replayed:true};
    }
    const already=tables.invoice_payments.filter(x=>x.invoice_id===id&&!x.reversed_at).reduce((n,x)=>n+x.amount,0);
    if (p.amount>Math.round((inv.total-inv.deposit_applied-already)*100)/100) fail('payment amount exceeds the outstanding balance','22023');
    pay={id:genId(),invoice_id:id,amount:p.amount,payment_date:p.payment_date,method:p.method,reference:p.reference,notes:p.notes,operation_id:p.operation_id,created_by_admin_id:admin,created_at:tick()};
    tables.invoice_payments.push(pay);
  } else if (action==='reverse_payment') {
    pay=tables.invoice_payments.find(x=>x.id===p.payment_id&&x.invoice_id===id);
    if (!pay) fail('Payment not found','P0002');
    if (pay.reversed_at) {
      if (pay.reversal_reason!==p.reason) fail('Payment is already reversed with a different reason');
      return {invoice:structuredClone(inv),paymentId:pay.id,replayed:true};
    }
    Object.assign(pay,{reversed_at:tick(),reversed_by_admin_id:admin,reversal_reason:p.reason});
  } else fail('Unknown invoice operation','22023');
  fault('aggregate');
  const paid=Math.round(tables.invoice_payments.filter(x=>x.invoice_id===id&&!x.reversed_at).reduce((n,x)=>n+x.amount,0)*100)/100;
  const due=Math.round((inv.total-inv.deposit_applied-paid)*100)/100;
  const status=due<=0?'paid':due<inv.total?'partially_paid':'unpaid';
  Object.assign(inv,{amount_paid:paid,amount_due:due,payment_status:status,paid_at:status==='paid'?tick():null,updated_at:tick()});
  event(action==='record_payment'?'payment_recorded':'payment_reversed',action==='record_payment'?{paymentId:pay.id,amount:pay.amount,method:pay.method,operationId:p.operation_id}:{paymentId:pay.id,reason:p.reason});
  return {invoice:structuredClone(inv),paymentId:pay.id,replayed:false};
}
