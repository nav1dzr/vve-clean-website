// Shared customer-facing policy copy, reused across BookingPage (progressive
// disclosure), the FAQ and the Terms of Service so the wording can never
// drift out of sync between them.
//
// There is currently no automated Stripe refund flow — refunds on an
// unavailable slot are issued manually by the team. Do not add "automatically"
// or a specific number of business days to this copy without first building
// and shipping that backend flow; until then, stating either would be a false
// promise the business cannot keep.
export const DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT =
  "If we can't offer your requested date and time and you don't accept an " +
  'alternative slot, your £30 deposit will be refunded to your original ' +
  'payment method. Bank processing times vary, so it may take a few days to ' +
  'appear on your statement.';
