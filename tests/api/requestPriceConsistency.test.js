import { describe, expect, it, vi } from 'vitest';
import { priceBookingRequest } from '../../shared/requestPricing.js';

const basket = (counts, extra = {}) => ({ service: 'deep', deepService: 'carpet_upholstery', carpetCounts: counts, carpetCondition: 'normal', parkingAvailable: 'yes', congestionZone: 'no', ...extra });
describe('authoritative free-request totals', () => {
  it.each(['small', 'studio', 'bed1', 'bed2', 'bed3', 'bed4'])('requires an assessed quote for the %s after-builders guide', deepSize => {
    const computePrice = vi.fn(() => 1);
    const config = { service: 'deep', deepService: 'after_builders', deepSize, deepBaths: 1, addOnCounts: { oven: 1, carpet_bundle: 1 }, price: 1, quoteMode: 'fixed_quote', assessed: true };
    expect(priceBookingRequest(config, 'LEAFLET20', { computePrice })).toBeNull();
    expect(computePrice).not.toHaveBeenCalled();
  });

  it('still prices move-in cleaning and other services when a previous after-builders selection remains in state', () => {
    expect(priceBookingRequest({ service: 'deep', deepService: 'move_in', deepSize: 'bed2', deepBaths: 1, parkingAvailable: 'yes', congestionZone: 'no' })?.total).toBeGreaterThan(0);
    expect(priceBookingRequest({ service: 'window', deepService: 'after_builders', windowSize: 'medium', parkingAvailable: 'yes', congestionZone: 'no' })).toMatchObject({ total: 85 });
  });

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
