import * as defaultCatalogue from './pricingCatalogue.js';

// Client totals are descriptive only. Save, email and agree the same server total.
export function priceBookingRequest(config, offerCode, catalogue = defaultCatalogue) {
  const { computePrice, computeCarpetPrice, PROMO_CODES, accessSurchargeP } = catalogue;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const promoCode = typeof offerCode === 'string' && Object.hasOwn(PROMO_CODES, offerCode.toUpperCase())
    ? offerCode.toUpperCase() : undefined;
  const quoteConfig = { ...config, promoCode };
  const counts = quoteConfig.carpetCounts;
  if (counts && (typeof counts !== 'object' || Object.values(counts).some((n) => !Number.isInteger(n) || n < 0 || n > 100))) return null;
  const total = computePrice(quoteConfig);
  if (!Number.isFinite(total) || total <= 0) return null;
  const result = {
    total, quoteConfig, offer_code: null, discount_percent: null,
    standard_total: null, discount_amount: null, final_total_after_discount: null,
  };
  if (quoteConfig.service === 'deep' && quoteConfig.deepService === 'carpet_upholstery' && counts) {
    const carpet = computeCarpetPrice(counts, quoteConfig.carpetCondition || 'normal', 1, promoCode);
    if (carpet.showSaving) {
      const access = accessSurchargeP(quoteConfig) / 100;
      result.offer_code = carpet.bundle.source === 'promo' ? promoCode : 'BUNDLE';
      result.discount_percent = carpet.bundle.source === 'promo' ? PROMO_CODES[promoCode] : null;
      result.standard_total = carpet.bundle.preDiscount + access;
      result.discount_amount = carpet.bundle.saving;
      result.final_total_after_discount = total;
    }
  }
  return result;
}
