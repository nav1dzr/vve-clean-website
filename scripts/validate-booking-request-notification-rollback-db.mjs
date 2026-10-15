/**
 * Execute the VVE OS notification artifact in disposable in-memory PostgreSQL.
 *
 * node scripts/validate-booking-request-notification-rollback-db.mjs
 *   [--pglite /path/to/pglite/dist/index.js]
 *
 * This runner accepts no database URL, reads no application credentials and
 * makes no network, email or Telegram calls.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const option = process.argv.indexOf("--pglite");
if (
  option >= 0 &&
  (!process.argv[option + 1] || process.argv[option + 1].startsWith("--"))
) {
  throw new Error("--pglite requires a local module file path.");
}
const suppliedModule =
  option >= 0 ? process.argv[option + 1] : process.env.PGLITE_MODULE;
const moduleName =
  !suppliedModule || suppliedModule === "@electric-sql/pglite"
    ? "@electric-sql/pglite"
    : suppliedModule.startsWith("file:")
      ? suppliedModule
      : pathToFileURL(resolve(suppliedModule)).href;
const { PGlite } = await import(moduleName);
const db = new PGlite();
const schema = "vve_notification_test_20260924";
const artifact = await readFile(
  new URL(
    "../docs/VVE-OS-BOOKING-REQUEST-NOTIFICATION-ROLLBACK-TEST-2026-09-24.sql",
    import.meta.url,
  ),
  "utf8",
);

try {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`create role ${role} nologin`);
  }
  await db.exec(artifact);
  const [{ schema_oid: schemaOid }] = (
    await db.query(
      "select to_regnamespace($1)::text as schema_oid",
      [schema],
    )
  ).rows;
  assert.equal(schemaOid, null, "isolated validation schema survived rollback");

  console.log(
    JSON.stringify(
      {
        engine: "PGlite, disposable in-memory PostgreSQL",
        artifact:
          "docs/VVE-OS-BOOKING-REQUEST-NOTIFICATION-ROLLBACK-TEST-2026-09-24.sql",
        migration:
          "supabase/migrations/20260924140000_booking_request_notification_outbox.sql",
        passed: 10,
        checks: [
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
        ],
        rollbackVerified: true,
        productionDatabaseUsed: false,
        supabaseProjectUsed: false,
        providerCalls: false,
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
