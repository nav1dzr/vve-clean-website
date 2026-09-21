import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260917120000_booking_measurement_outbox.sql"), "utf8");

describe("deposit measurement migration", () => {
  it("queues only verified deposit ledger inserts and deduplicates by payment", () => {
    expect(sql).toMatch(/after insert on public\.booking_journey_payments/i);
    expect(sql).toMatch(/new\.kind not in \('deposit','manual_deposit'\)/i);
    expect(sql).toMatch(/payment_external_id text unique not null/i);
    expect(sql).toMatch(/on conflict\(payment_external_id\) do nothing/i);
  });
  it("suppresses tests, denied or withdrawn consent and retains actual payment fields", () => {
    expect(sql).toMatch(/measurement_is_test/i);
    expect(sql).toMatch(/measurement_consent_withdrawn_at is null/i);
    expect(sql).toMatch(/new\.amount_pence/i);
    expect(sql).toMatch(/new\.currency/i);
    expect(sql).toMatch(/paid_at/i);
  });
  it("reclaims a delivery interrupted while sending", () => {
    expect(sql).toMatch(/status = 'sending' and claimed_at < now\(\) - interval '10 minutes'/i);
    expect(sql).toMatch(/attempts < 8/i);
  });
});
