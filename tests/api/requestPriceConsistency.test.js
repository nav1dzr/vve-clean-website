import { describe, expect, it } from 'vitest';
import { priceBookingRequest } from '../../shared/requestPricing.js';

const basket = (counts, extra = {}) => ({ service: 'deep', deepService: 'carpet_upholstery', carpetCounts: counts, carpetCondition: 'normal', parkingAvailable: 'yes', congestionZone: 'no', ...extra });
describe('authoritative free-request totals', () => {
  it('saves the advertised leaflet basket and adds access after the service offer', () => {
    expect(priceBookingRequest(basket({ sofa_2: 1, sofa_3: 1 }), 'LEAFLET20')).toMatchObject({ total: 132, standard_total: 165, discount_amount: 33, final_total_after_discount: 132 });
    const withAccess = priceBookingRequest(basket({ sofa_2: 1, sofa_3: 1 }, { parkingAvailable: 'no' }), 'LEAFLET20');
    expect(withAccess.total).toBe(147);
    expect(withAccess.standard_total - withAccess.discount_amount).toBe(withAccess.total);
  });
  it('does not claim a saving swallowed by the visit minimum', () => {
    expect(priceBookingRequest(basket({ sofa_2: 1 }), 'LEAFLET20')).toMatchObject({ total: 85, offer_code: null, discount_amount: null });
  });
  it('ignores an unknown discount and does not trust a promo inside the quote', () => {
    const result = priceBookingRequest(basket({ sofa_2: 1, sofa_3: 1 }, { promoCode: 'LEAFLET20' }), 'FREE100');
    expect(result.total).toBe(165);
  });
  it('requires assessment for mixed rugs as well as rug-only baskets', () => {
    expect(priceBookingRequest(basket({ bedroom: 1, rug: 1 }))).toBeNull();
    expect(priceBookingRequest(basket({ rug: 1 }))).toBeNull();
  });
  it('rejects non-integral, negative or unbounded counts', () => {
    for (const count of [-1, 1.5, 101, Infinity, '2']) expect(priceBookingRequest(basket({ sofa_2: count }))).toBeNull();
  });
});
