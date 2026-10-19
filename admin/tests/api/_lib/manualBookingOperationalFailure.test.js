import { describe, expect, it } from 'vitest';
import { createManualBooking } from '../../../api/_lib/customerLifecycle.js';
import { createFakeSupabase } from './fakeSupabase.js';

const customer = { id: 'customer-test', name: 'Local audit', email: 'audit@example.invalid', postcode: 'N1 1AA' };
const request = { requestId: '123e4567-e89b-42d3-a456-426614174777', service: 'Carpet cleaning', serviceDate: '2026-11-01', paymentPlan: 'after_clean' };

// Model PostgREST committing a write before its response is lost. The shared
// fake remains unchanged; the retry must find the saved request, not insert.
function loseFirstInsertResponse(supabase, commitFirst) {
  const from = supabase.from.bind(supabase);
  let lost = false;
  supabase.from = (table) => {
    const query = from(table);
    if (table !== 'bookings') return query;
    const insert = query.insert.bind(query);
    query.insert = (row) => {
      insert(row);
      const single = query.single.bind(query);
      query.single = async () => {
        if (lost) return single();
        lost = true;
        if (commitFirst) await single();
        return { data: null, error: { code: '', message: 'Synthetic database response lost' } };
      };
      return query;
    };
    return query;
  };
}

describe('manual booking uncertain database failures', () => {
  it('retains an earlier operation when the customer read is temporarily unavailable', async () => {
    const supabase = createFakeSupabase({ customers: [customer] });
    const from = supabase.from.bind(supabase);
    supabase.from = (table) => {
      const query = from(table);
      if (table === 'customers') query.maybeSingle = async () => ({ data: null, error: { code: '', message: 'Synthetic connection lost' } });
      return query;
    };
    expect(await createManualBooking(supabase, customer.id, request, 'owner-test')).toMatchObject({ ok: false, status: 503 });
    expect(supabase._tables.bookings || []).toHaveLength(0);
  });

  it('returns a retriable status after a committed insert loses its response, then reuses the saved booking', async () => {
    const supabase = createFakeSupabase({ customers: [customer] });
    loseFirstInsertResponse(supabase, true);
    const uncertain = await createManualBooking(supabase, customer.id, request, 'owner-test');
    expect(uncertain).toMatchObject({ ok: false, status: 503 });
    expect(supabase._tables.bookings).toHaveLength(1);
    const replay = await createManualBooking(supabase, customer.id, request, 'owner-test');
    expect(replay).toMatchObject({ ok: true, bookingId: request.requestId, alreadyExisted: true });
    expect(supabase._tables.bookings).toHaveLength(1);
  });

  it('retains the same request for an insert failure before commit and creates only one row on retry', async () => {
    const supabase = createFakeSupabase({ customers: [customer] });
    loseFirstInsertResponse(supabase, false);
    expect(await createManualBooking(supabase, customer.id, request, 'owner-test')).toMatchObject({ ok: false, status: 503 });
    expect(supabase._tables.bookings).toHaveLength(0);
    expect(await createManualBooking(supabase, customer.id, request, 'owner-test')).toMatchObject({ ok: true, bookingId: request.requestId });
    expect(supabase._tables.bookings).toHaveLength(1);
  });
});
