export interface BookingAllocationInput {
  operationId: string;
  sourcePaymentId: string;
  expectedInvoiceUpdatedAt: string;
  expectedJourneyRevision: number;
  depositReviewed: boolean;
  reviewedSource: true;
  method: string;
  paymentDate: string;
  reason: string;
}
export interface BookingAllocationCandidate {
  sourcePaymentId: string;
  kind: string;
  amountPence: number;
  recordedAt: string;
  requiresDepositReview: boolean;
  decision: { state: 'review_ready' | 'needs_review'; code?: string; invoiceDueAfterPence?: number };
}
export interface BookingAllocationReview {
  ok: true;
  invoiceId: string;
  expectedInvoiceUpdatedAt: string;
  expectedJourneyRevision: number | null;
  invoiceDuePence: number;
  depositAppliedPence: number;
  depositSources: Array<{ sourcePaymentId: string; amountPence: number; recordedAt: string }>;
  candidates: BookingAllocationCandidate[];
}
export type BookingAllocationResult =
  | { ok: true; allocationId: string; paymentId: string; receiptId: string | null; amountDue: number; amountPaid: number; paymentStatus: string; replayed: boolean }
  | { ok: false; outcome: 'not_applied' | 'needs_review' | 'unknown'; code?: string; error: string };
