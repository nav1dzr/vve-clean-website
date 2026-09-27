import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
const legacySql = readMigration(
  "20260917120000_booking_measurement_outbox.sql",
);
const sql = readMigration(
  "20260924120000_booking_measurement_canonical_events.sql",
);

describe("canonical booking measurement migration", () => {
  it("keeps the already-released deposit-only migration immutable", () => {
    const normalized = legacySql.replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(normalized).digest("hex")).toBe(
      "08482095a12c67311b11800d232fe569d731ea5217e0d7ba76e99a8ce938979f",
    );
    expect(legacySql).toMatch(/event_name text not null check \(event_name = 'deposit_paid'\)/i);
    expect(legacySql).not.toContain("booking_request_submitted");
  });

  it("upgrades the old outbox in place without rewriting historical rows", () => {
    expect(sql).toMatch(/alter table public\.booking_measurement_outbox[\s\S]*add column if not exists event_key text/i);
    expect(sql).toMatch(/add column if not exists canonical_event_version smallint/i);
    expect(sql).toMatch(/alter column canonical_event_version set default 2/i);
    expect(sql).toMatch(/canonical_event_version is null or \(/i);
    expect(sql).toMatch(/create unique index if not exists booking_measurement_outbox_event_key_key/i);
    expect(sql).not.toMatch(/update public\.booking_measurement_outbox set event_key/i);
  });

  it("uses a provider-neutral, idempotent outbox for the four durable milestones", () => {
    for (const eventName of [
      "booking_request_submitted",
      "booking_request_qualified",
      "deposit_paid",
      "booking_confirmed",
    ]) expect(sql).toContain(`'${eventName}'`);
    expect(sql).toMatch(/alter column provider set default 'google_data_manager'/i);
    expect(sql).toMatch(/on conflict\(event_key\) do nothing/i);
    expect(sql).toMatch(/p_event_key, 2, p_booking_id/i);
  });

  it("queues one modern committed request and excludes legacy or already-paid inserts", () => {
    expect(sql).toMatch(/after insert on public\.bookings/i);
    expect(sql).toMatch(/new\.request_key is null/i);
    expect(sql).toMatch(/coalesce\(new\.payment_status, ''\) <> 'pending_payment'/i);
    expect(sql).toMatch(/coalesce\(new\.deposit_amount, -1\) <> 0/i);
    expect(sql).toMatch(/'booking:' \|\| new\.id::text \|\| ':booking_request_submitted'/i);
  });

  it("records qualification separately and counts confirmation only after a verified deposit", () => {
    expect(sql).toMatch(/after update of state on public\.booking_journeys/i);
    expect(sql).toMatch(/new\.state in \('offered','confirmed'\)/i);
    expect(sql).toMatch(/'booking_request_qualified'/i);
    expect(sql).toMatch(/new\.state = 'confirmed'\s+and old\.state is distinct from 'confirmed'/i);
    expect(sql).toMatch(/exists\s*\(\s*select 1 from public\.booking_journey_payments/i);
    expect(sql).toMatch(/p\.kind in \('deposit','manual_deposit'\)/i);
    expect(sql).toMatch(/p\.amount_pence > 0/i);
    expect(sql).toMatch(/'booking_confirmed'/i);
  });

  it("queues a deposit only from the authoritative ledger using its actual value and time", () => {
    expect(sql).toMatch(/after insert on public\.booking_journey_payments/i);
    expect(sql).toMatch(/new\.kind not in \('deposit','manual_deposit'\)/i);
    expect(sql).toMatch(/'booking:' \|\| new\.booking_id::text \|\| ':deposit_paid'/i);
    expect(sql).toMatch(/new\.external_id[\s\S]*new\.amount_pence,[\s\S]*new\.currency/i);
    expect(sql).toMatch(/new\.external_id !~ '\^cs_/i);
    expect(sql).toMatch(/case when new\.kind='deposit'[\s\S]*then new\.external_id else null end/i);
    expect(sql).toMatch(/payment_type = 'bank_transfer_deposit'[\s\S]*payment_external_id is null/i);
    expect(sql).toMatch(/p_payment->>'occurred_at'/i);
    expect(sql).toMatch(/currency,created_at[\s\S]*payment_occurred_at/i);
  });

  it("accepts consented safe click IDs or consented valid hashes and otherwise suppresses", () => {
    expect(sql).toMatch(/not b\.measurement_is_test/i);
    expect(sql).toMatch(/b\.measurement_consent_withdrawn_at is null/i);
    expect(sql).toMatch(/b\.measurement_consent_recorded_at is not null/i);
    expect(sql).toMatch(/nullif\(b\.measurement_consent_version, ''\) is not null/i);
    expect(sql).toMatch(/b\.gclid ~ '\^\[A-Za-z0-9\._~-\]\{1,200\}\$'[\s\S]*or b\.measurement_email_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i);
    expect(sql).toMatch(/'advertising_consent_not_granted'/i);
    expect(sql).toMatch(/'no_eligible_match_data'/i);
  });

  it("snapshots approved data and erases it through the protected withdrawal RPC", () => {
    expect(sql).toMatch(/measurement_email_sha256 text[\s\S]*'\^\[0-9a-f\]\{64\}\$'/i);
    expect(sql).toMatch(/measurement_phone_sha256 text[\s\S]*'\^\[0-9a-f\]\{64\}\$'/i);
    expect(sql).toMatch(/match_data jsonb not null default '\{\}'::jsonb/i);
    expect(sql).toMatch(/'email_sha256', b\.measurement_email_sha256/i);
    expect(sql).toMatch(/'phone_sha256', b\.measurement_phone_sha256/i);
    expect(sql).toMatch(/returns timestamptz language plpgsql security definer/i);
    expect(sql).toMatch(/raise exception 'Measurement booking not found' using errcode = 'P0002'/i);
    expect(sql).toMatch(/measurement_email_sha256=null,[\s\S]*measurement_phone_sha256=null/i);
    expect(sql).toMatch(/set match_data='\{\}'::jsonb,[\s\S]*attribution='\{\}'::jsonb/i);
  });

  it("separates send attempts from unlimited submitted-status reconciliation", () => {
    expect(sql).toMatch(/status = 'sending' and attempts < 8[\s\S]*claimed_at < now\(\) - interval '10 minutes'/i);
    expect(sql).toMatch(/status = 'submitted' and \(next_attempt_at is null or next_attempt_at <= now\(\)\)/i);
    expect(sql).toMatch(/attempts=o\.attempts\+case when due\.status='submitted' then 0 else 1 end/i);
    expect(sql).toMatch(/status_checks=o\.status_checks\+case when due\.status='submitted' then 1 else 0 end/i);
  });

  it("purges snapshots at 90 days from snapshotted first touch, never event occurrence", () => {
    expect(sql).toMatch(/'first_touch_at', b\.attribution_first_touch_at/i);
    expect(sql).toMatch(/booking_measurement_retention_origin\(attribution, created_at\)/i);
    expect(sql).not.toMatch(/where occurred_at < now\(\) - interval '90 days'/i);
    expect(sql).toMatch(/status in \('validated','delivered','suppressed'\)[\s\S]*interval '400 days'/i);
  });
});
