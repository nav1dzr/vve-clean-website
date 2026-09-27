import { getBusinessSettings } from "./businessSettings.js";
import { canCollectDeposit } from "./bookingDeposit.js";

// Payment details are frozen into each sent agreement, not read afresh when an
// old email is retried. Browser input never supplies bank account details.
export function bookingPaymentInstructions(reference, previousSnapshot) {
  if (Object.prototype.hasOwnProperty.call(previousSnapshot || {}, "paymentInstructions")) {
    return previousSnapshot.paymentInstructions;
  }
  const settings = getBusinessSettings();
  const accountName = String(settings.bankAccountName || "").trim();
  const sortCode = String(settings.bankSortCode || "").replace(/[ -]/g, "");
  const accountNumber = String(settings.bankAccountNumber || "").replace(/ /g, "");
  const bank = accountName && /^\d{6}$/.test(sortCode) && /^\d{8}$/.test(accountNumber) && reference
    ? { accountName, sortCode: sortCode.match(/.{2}/g).join("-"), accountNumber, reference }
    : null;
  return { due: "after_clean", bank };
}

export function visibleBookingPaymentInstructions(journey) {
  // Closed/changed/unsent agreements must not look like a fresh demand to pay.
  if (!["confirmed", "completed"].includes(journey.state) && !canCollectDeposit(journey)) return null;
  if (journey.state === "completed" && journey.paid_pence - journey.refunded_pence >= journey.snapshot?.totalPence) return null;
  const instructions = journey.snapshot?.paymentInstructions;
  return instructions ? { ...instructions, due: canCollectDeposit(journey) ? "deposit" : "after_clean" } : null;
}
