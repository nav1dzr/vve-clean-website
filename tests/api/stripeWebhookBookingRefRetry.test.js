import { describe, it, expect, vi } from 'vitest';
import { upsertBookingWithRefRetry } from '../../api/stripe-webhook.js';

// Unit tests for the booking_ref collision retry extracted from the
// webhook's DB-persistence step (see D2 in docs/kimi-audit — a race in
// api/create-checkout-session.js's non-atomic buildBookingRef could
// previously make this upsert fail with 23505 forever, meaning a paid
// booking was never persisted no matter how many times Stripe retried
// the webhook).

function makeSupabase(results) {
  const upsert = vi.fn();
  for (const r of results) upsert.mockResolvedValueOnce(r);
  return { supabase: { from: () => ({ upsert }) }, upsert };
}

describe('upsertBookingWithRefRetry', () => {
  it('persists on the first attempt when there is no collision', async () => {
    const { supabase, upsert } = makeSupabase([{ error: null }]);
    const result = await upsertBookingWithRefRetry(supabase, { booking_ref: 'N152NG160726' });

    expect(result.error).toBeNull();
    expect(result.bookingRef).toBe('N152NG160726');
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('retries with a tie-breaking suffix on a booking_ref collision (23505) and succeeds', async () => {
    const { supabase, upsert } = makeSupabase([
      { error: { code: '23505', message: 'duplicate key value violates unique constraint "bookings_booking_ref_key"' } },
      { error: null },
    ]);
    const result = await upsertBookingWithRefRetry(supabase, { booking_ref: 'N152NG160726' });

    expect(result.error).toBeNull();
    expect(result.bookingRef).toBe('N152NG160726-r1');
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0].booking_ref).toBe('N152NG160726-r1');
  });

  it('gives up and returns the error after exhausting the retry budget', async () => {
    const alwaysCollide = { error: { code: '23505', message: 'duplicate key' } };
    const { supabase, upsert } = makeSupabase(Array(10).fill(alwaysCollide));
    const result = await upsertBookingWithRefRetry(supabase, { booking_ref: 'N152NG160726' }, 2);

    expect(result.error).toEqual(alwaysCollide.error);
    expect(upsert).toHaveBeenCalledTimes(3); // attempt 0, 1, 2
  });

  it('does not retry a non-collision error (fails fast)', async () => {
    const dbDown = { error: { code: '57P03', message: 'cannot connect now' } };
    const { supabase, upsert } = makeSupabase([dbDown]);
    const result = await upsertBookingWithRefRetry(supabase, { booking_ref: 'N152NG160726' });

    expect(result.error).toEqual(dbDown.error);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('always upserts on conflict of stripe_session_id, never booking_ref', async () => {
    const { supabase, upsert } = makeSupabase([{ error: null }]);
    await upsertBookingWithRefRetry(supabase, { booking_ref: 'N152NG160726', stripe_session_id: 'cs_test_1' });

    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'stripe_session_id' });
  });
});
