import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260924140000_booking_request_notification_outbox.sql",
  ),
  "utf8",
);
const artifact = readFileSync(
  resolve(
    process.cwd(),
    "docs/VVE-OS-BOOKING-REQUEST-NOTIFICATION-ROLLBACK-TEST-2026-09-24.sql",
  ),
  "utf8",
);
const schema = "vve_notification_test_20260924";

describe("VVE OS booking-request notification rollback artifact", () => {
  it("is generated from the exact repository migration", () => {
    const hash = createHash("sha256").update(migration).digest("hex");
    expect(artifact).toContain(`SHA-256: ${hash}`);
    const isolated = migration
      .replaceAll("public.", `${schema}.`)
      .replace(
        /set(\s+)search_path\s*=\s*public\b/gi,
        (_match, spacing) => `set${spacing}search_path = ${schema}`,
      );
    expect(artifact).toContain(isolated.trim());
  });

  it("uses only a disposable schema and always ends with rollback proof", () => {
    expect(artifact).toMatch(/\bbegin;/i);
    expect(artifact).toContain(`create schema ${schema};`);
    expect(artifact).toMatch(/\brollback;[\s\S]*to_regnamespace\(/i);
    expect(artifact).not.toMatch(
      /\bpublic\.(?:bookings|booking_journey_messages|booking_request_notification_outbox)\b/i,
    );
    expect(artifact).not.toMatch(/\b(?:drop|truncate)\s+(?:table|schema)\b/i);
  });

  it("contains executable assertions for every release requirement", () => {
    for (const check of [
      "no historic backfill",
      "three channel rows for one eligible request",
      "replay remains unique",
      "service-role-only queue and RPC access",
      "claim returns each channel with a fenced lease",
      "stale checkpoint token is rejected",
      "checkpoints are atomic and retry-safe",
      "failed and unconfigured channels retry independently",
      "successful retries checkpoint all established flags",
      "completed CRM replay is suppressed",
    ]) {
      expect(artifact).toContain(check);
    }
    expect(artifact).toMatch(/if failed > 0 then[\s\S]*raise exception/i);
  });

  it("cannot invoke a network or messaging provider", () => {
    expect(artifact).not.toMatch(/\b(?:net|http)\.(?:http_|get|post)/i);
    expect(artifact).not.toMatch(/\b(?:pg_net|dblink|curl|webhook)\b/i);
    expect(artifact).not.toMatch(/\bperform\s+[^;]*(?:email|telegram)/i);
  });
});
