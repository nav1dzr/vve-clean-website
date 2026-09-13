import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { createDraftInvoice, updateDraftInvoice, issueInvoice, recordPayment, reversePayment, reviseIssuedInvoice, voidInvoice } from '../../../api/_lib/invoiceLifecycle.js';
const admin='admin-1';
const op=(n)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const input=(price=100)=>({customer:{name:'Synthetic test',email:'fixture@example.invalid'},items:[{description:'Synthetic clean',quantity:1,unitPrice:price}]});
async function setup(issued=true){const db=createFakeSupabase();const {invoiceId:id}=await createDraftInvoice(db,input(),admin);if(issued)await issueInvoice(db,id,admin);return {db,id};}
const pay=(db,id,amount,operationId)=>recordPayment(db,id,{amount,paymentDate:'2026-09-13',method:'cash',operationId},admin);
const row=(db,id)=>db._tables.invoices.find(x=>x.id===id);

describe('atomic invoice financial operations',()=>{
  it('serializes competing payments instead of allowing an overpayment/header mismatch',async()=>{
    const {db,id}=await setup();const results=await Promise.all([pay(db,id,60,op(1)),pay(db,id,60,op(2))]);
    expect(results.filter(x=>x.ok)).toHaveLength(1);
    expect(db._tables.invoice_payments.reduce((n,x)=>n+x.amount,0)).toBe(60);
    expect(row(db,id)).toMatchObject({amount_paid:60,amount_due:40});
  });
  it('deduplicates simultaneous retries and rejects reuse with different payment details',async()=>{
    const {db,id}=await setup();const results=await Promise.all([pay(db,id,40,op(3)),pay(db,id,40,op(3))]);
    expect(results.every(x=>x.ok)).toBe(true);expect(results[0].paymentId).toBe(results[1].paymentId);
    expect(results.filter(x=>x.replayed)).toHaveLength(1);expect(db._tables.invoice_payments).toHaveLength(1);
    expect(await pay(db,id,20,op(3))).toMatchObject({ok:false,status:409});
  });
  it.each(['aggregate','audit'])('rolls back a payment when the %s step fails and permits the same safe retry',async(point)=>{
    const {db,id}=await setup();db._failFinancialAt(point);
    expect(await pay(db,id,40,op(4))).toMatchObject({ok:false,status:503});
    expect(db._tables.invoice_payments||[]).toHaveLength(0);expect(row(db,id)).toMatchObject({amount_paid:0,amount_due:100});
    expect((await pay(db,id,40,op(4))).ok).toBe(true);expect(db._tables.invoice_payments).toHaveLength(1);
  });
  it('retries a response lost after commit without recording a second payment',async()=>{
    const {db,id}=await setup();const actualRpc=db.rpc;let loseResponse=true;
    db.rpc=async(...args)=>{const result=await actualRpc(...args);if(loseResponse){loseResponse=false;throw new Error('Synthetic lost response after commit');}return result;};
    expect(await pay(db,id,40,op(90))).toMatchObject({ok:false,status:503});
    expect(await pay(db,id,40,op(90))).toMatchObject({ok:true,replayed:true,amountPaid:40,amountDue:60});
    expect(db._tables.invoice_payments).toHaveLength(1);
  });
  it('rolls back reversal and does not duplicate its audit event on an identical retry',async()=>{
    const {db,id}=await setup();const result=await pay(db,id,100,op(5));db._failFinancialAt('audit');
    expect((await reversePayment(db,result.paymentId,'Correction',admin)).ok).toBe(false);
    expect(db._tables.invoice_payments[0].reversed_at).toBeUndefined();expect(row(db,id).amount_due).toBe(0);
    expect((await reversePayment(db,result.paymentId,'Correction',admin)).ok).toBe(true);
    expect((await reversePayment(db,result.paymentId,'Correction',admin)).ok).toBe(true);
    expect(db._tables.invoice_events.filter(x=>x.event_type==='payment_reversed')).toHaveLength(1);
    expect(row(db,id).amount_due).toBe(100);expect(await pay(db,id,100,op(5))).toMatchObject({ok:false,status:409});
  });
  it('reverses an existing payment on a void invoice without reopening the document',async()=>{
    const {db,id}=await setup();const result=await pay(db,id,100,op(91));
    expect((await voidInvoice(db,id,'Synthetic duplicate document',admin)).ok).toBe(true);
    expect(await pay(db,id,1,op(92))).toMatchObject({ok:false,status:409});
    expect((await reversePayment(db,result.paymentId,'Synthetic ledger correction',admin)).ok).toBe(true);
    expect(row(db,id)).toMatchObject({document_status:'void',amount_paid:0,amount_due:100,payment_status:'unpaid'});
    expect((await reversePayment(db,result.paymentId,'Synthetic ledger correction',admin)).ok).toBe(true);
    expect(row(db,id).document_status).toBe('void');
    expect(db._tables.invoice_events.filter(x=>x.event_type==='payment_reversed')).toHaveLength(1);
  });
  it('keeps old draft header/items together when item replacement fails',async()=>{
    const {db,id}=await setup(false);db._failFinancialAt('items');const before=structuredClone(db._tables);
    expect((await updateDraftInvoice(db,id,input(200),admin)).ok).toBe(false);
    expect(db._tables).toEqual(before);
  });
  it('rejects stale saves and issue-versus-save without altering the issued items',async()=>{
    const {db,id}=await setup(false);const expectedUpdatedAt=row(db,id).updated_at;
    await updateDraftInvoice(db,id,{...input(200),expectedUpdatedAt},admin);
    expect(await updateDraftInvoice(db,id,{...input(300),expectedUpdatedAt},admin)).toMatchObject({ok:false,status:409});
    expect(await issueInvoice(db,id,admin,{expectedUpdatedAt})).toMatchObject({ok:false,status:409});
    await issueInvoice(db,id,admin);
    expect(await updateDraftInvoice(db,id,input(400),admin)).toMatchObject({ok:false,status:409});
    expect(row(db,id).total).toBe(200);expect(db._tables.invoice_items[0].line_total).toBe(200);
  });
  it('cannot issue an old revision after its original is paid',async()=>{
    const {db,id}=await setup();const {invoiceId:revision}=await reviseIssuedInvoice(db,id,admin);
    await pay(db,id,100,op(6));expect(await issueInvoice(db,revision,admin)).toMatchObject({ok:false,status:409});
    expect(row(db,revision).document_status).toBe('draft');expect(row(db,id).superseded_by_invoice_id).toBeUndefined();
  });
  it('rejects revision issuance after the source details change or another revision issues',async()=>{
    const {db,id}=await setup();const a=await reviseIssuedInvoice(db,id,admin),b=await reviseIssuedInvoice(db,id,admin);
    expect((await issueInvoice(db,a.invoiceId,admin)).ok).toBe(true);
    expect(await issueInvoice(db,b.invoiceId,admin)).toMatchObject({ok:false,status:409});
  });
  it('fails closed when the transaction RPC is missing, without any split-write fallback',async()=>{
    const {db,id}=await setup();const before=structuredClone(db._tables);
    db.rpc=vi.fn(async()=>({data:null,error:{code:'PGRST202',message:'Missing function'}}));
    expect(await pay(db,id,40,op(7))).toMatchObject({ok:false,status:503});expect(db._tables).toEqual(before);
  });
  it('does not create a second receipt on a replayed full-payment request',async()=>{
    const {db,id}=await setup();const createReceiptIfPaid=vi.fn(async()=>({ok:true,receiptId:'test-receipt'}));
    const payment={amount:100,paymentDate:'2026-09-13',method:'cash',operationId:op(8)};
    const first=await recordPayment(db,id,payment,admin,{createReceiptIfPaid});
    const retry=await recordPayment(db,id,payment,admin,{createReceiptIfPaid});
    expect(first.ok).toBe(true);expect(retry).toMatchObject({ok:true,replayed:true});expect(createReceiptIfPaid).toHaveBeenCalledTimes(1);
  });
});
