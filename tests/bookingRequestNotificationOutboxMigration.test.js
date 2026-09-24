import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260924140000_booking_request_notification_outbox.sql",
  ),
  "utf8",
);

describe("booking-request notification outbox migration", () => {
  it("creates one durable, unique row for each initial notification channel", () => {
    expect(sql).toMatch(/create table if not exists public\.booking_request_notification_outbox/i);
    expect(sql).toMatch(/unique \(booking_id, channel\)/i);
    for (const channel of ["customer_email", "business_email", "telegram"])
      expect(sql).toContain(`'${channel}'`);
    expect(sql).not.toMatch(/payload\s+jsonb/i);
  });

  it("queues only future durable unpaid website-request inserts atomically", () => {
    expect(sql).toMatch(/after insert on public\.bookings/i);
    expect(sql).toMatch(/new\.request_key is not null/i);
    expect(sql).toMatch(/nullif\(new\.request_fingerprint, ''\) is not null/i);
    expect(sql).toMatch(/coalesce\(new\.payment_status, ''\) = 'pending_payment'/i);
    expect(sql).toMatch(/coalesce\(new\.deposit_amount, -1\) = 0/i);
    expect(sql).toMatch(/There is deliberately no historic-data backfill/i);
  });

  it("claims due channels with a bounded lease and row locking", () => {
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toMatch(/limit p_limit/i);
    expect(sql).toMatch(/claimed_until = now\(\) \+ interval '5 minutes'/i);
    expect(sql).toMatch(/o\.status = 'failed' and o\.attempts < 5/i);
    expect(sql).toMatch(/set status = 'uncertain'[\s\S]*where status = 'sending'/i);
    expect(sql).toContain("claim_expired_after_send_started");
  });

  it("fences checkpoints and updates each established sent flag atomically", () => {
    expect(sql).toMatch(/claim_token = p_token/i);
    expect(sql).toMatch(/status = 'sending'/i);
    expect(sql).toMatch(/claimed_until > now\(\)/i);
    expect(sql).toMatch(/p_status not in \('sent','failed','unconfigured','uncertain'\)/i);
    expect(sql).toMatch(/when p_status = 'unconfigured' then greatest\(attempts - 1, 0\)/i);
    expect(sql).toMatch(/email_customer_sent = case[\s\S]*customer_email/i);
    expect(sql).toMatch(/email_business_sent = case[\s\S]*business_email/i);
    expect(sql).toMatch(/telegram_sent = case[\s\S]*telegram/i);
    expect(sql).toMatch(/requeue_uncertain_booking_request_notification/i);
    expect(sql).toMatch(/p_confirm_not_delivered is not true/i);
    expect(sql).toMatch(/where id = p_id and status = 'uncertain'/i);
  });

  it("fences the established CRM email retry path against concurrent outbox sends", () => {
    expect(sql).toMatch(/before insert on public\.booking_journey_messages/i);
    expect(sql).toMatch(/when 'initial_customer' then 'customer_email'/i);
    expect(sql).toMatch(/when 'initial_business' then 'business_email'/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/if outbox_status = 'sent' then return null/i);
    expect(sql).toMatch(/if outbox_status = 'sending' then[\s\S]*errcode = '55000'/i);
    expect(sql).toContain("crm_initial_retry_owns_delivery");
  });

  it("keeps browser roles out of the queue and RPCs", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.booking_request_notification_outbox from anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.claim_booking_request_notifications\(uuid, integer\)[\s\S]*to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.record_booking_request_notification\(uuid, uuid, text, text\)[\s\S]*to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.requeue_uncertain_booking_request_notification\(uuid, boolean\)[\s\S]*to service_role/i);
  });
});
