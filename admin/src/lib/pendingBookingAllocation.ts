import type { BookingAllocationInput } from '../types/bookingInvoiceAllocation';
const PREFIX='vve-pending-booking-allocation:v1:';
const TTL=24*60*60*1000;
export type AllocationContext={userId:string;invoiceId:string};
export type PendingAllocation =
  | {status:'none'|'unavailable'}
  | {status:'pending';input:BookingAllocationInput}
  | {status:'review';operationId?:string};
const key=(c:AllocationContext)=>PREFIX+encodeURIComponent(c.userId)+':'+encodeURIComponent(c.invoiceId);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
function valid(v:unknown):v is BookingAllocationInput {
  return object(v)&&uuid(v.operationId)&&typeof v.sourcePaymentId==='string'&&v.sourcePaymentId.length>0&&v.sourcePaymentId.length<=300
    &&typeof v.expectedInvoiceUpdatedAt==='string'&&Number.isFinite(Date.parse(v.expectedInvoiceUpdatedAt))
    &&Number.isSafeInteger(v.expectedJourneyRevision)&&Number(v.expectedJourneyRevision)>=0
    &&typeof v.depositReviewed==='boolean'&&v.reviewedSource===true
    &&['bank_transfer','cash','card','stripe','other'].includes(String(v.method))
    &&typeof v.paymentDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.paymentDate)
    &&typeof v.reason==='string'&&v.reason.trim().length>0&&v.reason.length<=1000;
}
export function readPendingBookingAllocation(c:AllocationContext):PendingAllocation {
  try {
    const raw=window.sessionStorage.getItem(key(c));
    if(raw===null)return {status:'none'};
    let record:unknown;
    try {record=raw.length<=8000?JSON.parse(raw):null;} catch {record=null;}
    if(object(record)&&record.schema===1&&record.userId===c.userId&&record.invoiceId===c.invoiceId) {
      if(record.status==='review')return {status:'review',operationId:uuid(record.operationId)?record.operationId:undefined};
      if(record.status==='pending'&&valid(record.input)&&typeof record.createdAt==='number'
        &&record.createdAt<=Date.now()&&Date.now()-record.createdAt<=TTL)return {status:'pending',input:record.input};
    }
    const operationId=object(record)&&object(record.input)&&uuid(record.input.operationId)?record.input.operationId:undefined;
    window.sessionStorage.setItem(key(c),JSON.stringify({schema:1,...c,status:'review',operationId}));
    return {status:'review',operationId};
  } catch {return {status:'unavailable'};}
}
export function rememberPendingBookingAllocation(c:AllocationContext,input:BookingAllocationInput):boolean {
  try {
    if(!valid(input))return false;
    const old=readPendingBookingAllocation(c);
    if(old.status==='pending')return JSON.stringify(old.input)===JSON.stringify(input);
    if(old.status!=='none')return false;
    let count=0;
    for(let i=0;i<window.sessionStorage.length;i++)if(window.sessionStorage.key(i)?.startsWith(PREFIX))count++;
    if(count>=20)return false;
    const value=JSON.stringify({schema:1,...c,status:'pending',createdAt:Date.now(),input});
    window.sessionStorage.setItem(key(c),value);
    return window.sessionStorage.getItem(key(c))===value;
  } catch {return false;}
}
export function clearPendingBookingAllocation(c:AllocationContext,operationId:string):boolean {
  try {
    const old=readPendingBookingAllocation(c);
    const current=old.status==='pending'?old.input.operationId:old.status==='review'?old.operationId:null;
    if(current!==operationId)return false;
    window.sessionStorage.removeItem(key(c));
    return window.sessionStorage.getItem(key(c))===null;
  } catch {return false;}
}
export function clearPendingBookingAllocations():void {
  try {for(let i=window.sessionStorage.length-1;i>=0;i--){
    const name=window.sessionStorage.key(i);if(name?.startsWith(PREFIX))window.sessionStorage.removeItem(name);
  }} catch { /* Sign-out must complete even when browser storage is blocked. */ }
}
