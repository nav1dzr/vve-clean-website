export const DEPOSIT_PENCE = 3000;
export const DEPOSIT_PLAN = "deposit_after_agreement";
export const requiresDeposit = (agreement) => agreement?.paymentPlan === DEPOSIT_PLAN;
export function canCollectDeposit(journey, now = new Date()) {
  return journey.state === "offered" && requiresDeposit(journey.snapshot) &&
    journey.paid_pence === 0 && journey.refunded_pence === 0 &&
    !journey.customer_request && Number.isFinite(Date.parse(journey.hold_until)) &&
    new Date(journey.hold_until) > now;
}
