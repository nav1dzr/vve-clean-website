/**
 * Run the actual booking migration against disposable, in-memory PostgreSQL.
 *
 * node scripts/validate-booking-journey-db.mjs [--pglite /path/to/pglite/dist/index.js]
 * PGLITE_MODULE may also name that local file or its file: URL.
 * Without either option, resolve an installed @electric-sql/pglite package.
 * No database URLs, production credentials, Stripe or email connections are used.
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
const migrationName = "20260908100000_booking_journey.sql";
const bookingId = "22222222-2222-4222-8222-222222222222";
const checks = [];
const privateTables = [
  "booking_journeys",
  "booking_journey_events",
  "booking_journey_messages",
  "booking_journey_payments",
];
const check = async (name, action) => {
  await action();
  checks.push(name);
};
const mutate = async (
  revision,
  event,
  patch = {},
  bookingPatch = {},
  message = null,
  payment = null,
) => {
  const result = await db.query(
    "SELECT public.apply_booking_journey($1,$2,$3,$4,$5,$6,$7,$8) AS journey",
    [
      bookingId,
      revision,
      "synthetic-validation",
      event,
      JSON.stringify(patch),
      JSON.stringify(bookingPatch),
      message === null ? null : JSON.stringify(message),
      payment === null ? null : JSON.stringify(payment),
    ],
  );
  return result.rows[0].journey;
};
const journey = async () =>
  (
    await db.query(
      "SELECT * FROM public.booking_journeys WHERE booking_id=$1",
      [bookingId],
    )
  ).rows[0];
const state = async () => ({
  journey: await journey(),
  booking: (
    await db.query("SELECT * FROM public.bookings WHERE id=$1", [bookingId])
  ).rows[0],
  events: (
    await db.query("SELECT * FROM public.booking_journey_events ORDER BY id")
  ).rows,
  messages: (
    await db.query(
      "SELECT * FROM public.booking_journey_messages ORDER BY dedup_key",
    )
  ).rows,
  payments: (
    await db.query(
      "SELECT * FROM public.booking_journey_payments ORDER BY external_id",
    )
  ).rows,
});
const denied = (action) =>
  assert.rejects(action, /permission denied|row-level security/i);

try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    -- Supabase may supply broad default grants; the migration must revoke them.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    CREATE TABLE public.bookings (
      id uuid PRIMARY KEY, service text, preferred_date text, preferred_time text,
      service_date date, address text, postcode text, total_price numeric,
      deposit_amount numeric, payment_status text, balance_status text,
      balance_paid_at timestamptz, balance_payment_method text, status text,
      updated_at timestamptz
    );
    INSERT INTO public.bookings(id, total_price, deposit_amount, status)
      VALUES ('${bookingId}', 279, 0, 'new');
  `);

  await check(
    "The current additive migration applies twice without changing an existing booking",
    async () => {
      const before = (await db.query("SELECT * FROM public.bookings")).rows;
      const migration = await readFile(
        new URL(`../supabase/migrations/${migrationName}`, import.meta.url),
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration);
      assert.deepEqual(
        (await db.query("SELECT * FROM public.bookings")).rows,
        before,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS total FROM public.booking_journeys",
          )
        ).rows[0].total,
        0,
      );
    },
  );

  await db.exec("SET ROLE service_role");
  await db.query(
    "INSERT INTO public.booking_journeys(booking_id) VALUES ($1)",
    [bookingId],
  );
  const agreedSnapshot = {
    totalPence: 27900,
    service: "Synthetic cleaning",
    policyVersion: "2026-09-08",
  };

  await check(
    "A service-role agreement stores one version, history event and pending message atomically",
    async () => {
      await mutate(
        0,
        "offer",
        { state: "offered", snapshot: agreedSnapshot, offer_version: 1 },
        { total_price: 279, status: "new" },
        {
          kind: "deposit_request",
          dedup_key: "synthetic:offer:1",
          payload: { reference: "TEST" },
        },
      );
      const saved = await state();
      assert.equal(saved.journey.revision, 1);
      assert.deepEqual(saved.journey.snapshot, agreedSnapshot);
      assert.equal(saved.events.length, 1);
      assert.deepEqual(
        saved.events[0].details.changes.snapshot,
        agreedSnapshot,
      );
      assert.equal(saved.messages.length, 1);
      assert.equal(saved.messages[0].status, "pending");
      assert.equal(Number(saved.booking.total_price), 279);
    },
  );

  await check(
    "Competing edits from one revision have one winner and one revision conflict",
    async () => {
      // PGlite serializes its single connection. This exercises the actual SQL
      // lock/CAS conditions, not multi-connection production load behavior.
      const race = await Promise.allSettled([
        mutate(1, "edit_a", { draft: { service: "Synthetic A" } }),
        mutate(1, "edit_b", { draft: { service: "Synthetic B" } }),
      ]);
      assert.equal(
        race.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        race.find((result) => result.status === "rejected").reason.code,
        "40001",
      );
      const saved = await state();
      assert.equal(saved.journey.revision, 2);
      assert.equal(saved.events.length, 2);
      assert.deepEqual(saved.journey.snapshot, agreedSnapshot);
    },
  );

  await check(
    "A £30 deposit updates booking, ledger and receipt once; stale duplicate events cannot credit twice",
    async () => {
      const payment = {
        external_id: "cs_synthetic_deposit",
        kind: "deposit",
        amount_pence: 3000,
      };
      const receipt = {
        kind: "payment_received",
        dedup_key: "synthetic:deposit:receipt",
        payload: { reference: "TEST" },
      };
      await mutate(
        2,
        "paid",
        { paid_pence: 3000, state: "confirmed" },
        { deposit_amount: 30, payment_status: "paid" },
        receipt,
        payment,
      );
      const paid = await state();
      assert.equal(paid.journey.paid_pence, 3000);
      assert.equal(paid.journey.state, "confirmed");
      assert.equal(Number(paid.booking.deposit_amount), 30);
      assert.equal(paid.booking.payment_status, "paid");
      assert.equal(paid.payments.length, 1);
      assert.equal(paid.payments[0].currency, "gbp");
      assert.equal(
        paid.messages.filter((message) => message.kind === "payment_received")
          .length,
        1,
      );
      await mutate(
        2,
        "duplicate_paid",
        { paid_pence: 6000 },
        { deposit_amount: 60 },
        receipt,
        payment,
      );
      assert.deepEqual(await state(), paid);
    },
  );

  await check(
    "A late outbox constraint failure rolls back payment, booking, journey and history together",
    async () => {
      const before = await state();
      // The missing payload fails after the function has attempted ledger, journey,
      // booking and history writes, so every preceding write must roll back.
      await assert.rejects(
        () =>
          mutate(
            3,
            "invalid_receipt",
            { paid_pence: 6000 },
            { total_price: 1, deposit_amount: 60 },
            { kind: "payment_received", dedup_key: "synthetic:bad-receipt" },
            {
              external_id: "cs_synthetic_rollback",
              kind: "deposit",
              amount_pence: 3000,
            },
          ),
        (error) => error.code === "23502",
      );
      assert.deepEqual(await state(), before);
    },
  );

  await check(
    "Deposit and appointment reminder markers persist, and can be reset independently for a new revision",
    async () => {
      const sentAt = "2026-09-08T12:00:00.000Z";
      await mutate(3, "reminders_recorded", {
        reminder_sent_at: sentAt,
        appointment_reminder_sent_at: sentAt,
      });
      let saved = await journey();
      assert.equal(new Date(saved.reminder_sent_at).toISOString(), sentAt);
      assert.equal(
        new Date(saved.appointment_reminder_sent_at).toISOString(),
        sentAt,
      );
      await mutate(4, "offer_marker_reset", {
        offer_version: 2,
        reminder_sent_at: null,
      });
      saved = await journey();
      assert.equal(saved.reminder_sent_at, null);
      assert.equal(
        new Date(saved.appointment_reminder_sent_at).toISOString(),
        sentAt,
      );
      await mutate(5, "accepted_reschedule", {
        appointment_reminder_sent_at: null,
      });
      saved = await journey();
      assert.equal(saved.appointment_reminder_sent_at, null);
      assert.equal(saved.revision, 6);
      assert.deepEqual(saved.snapshot, agreedSnapshot);
    },
  );

  await check(
    "Cancellation queues customer and staff acknowledgements once per message key",
    async () => {
      const message = {
        kind: "cancelled",
        dedup_key: "synthetic:cancel:1",
        payload: { reference: "TEST" },
      };
      await mutate(
        6,
        "cancelled",
        { state: "cancelled" },
        { status: "cancelled" },
        message,
      );
      const saved = await state();
      assert.equal(saved.booking.status, "cancelled");
      const acknowledgements = saved.messages.filter(
        (row) => row.kind === "cancelled",
      );
      assert.equal(acknowledgements.length, 2);
      assert.equal(
        acknowledgements.filter((row) => row.payload.audience === "business")
          .length,
        1,
      );
      await mutate(7, "acknowledgement_retry", {}, {}, message);
      assert.deepEqual((await state()).messages, saved.messages);
      assert.deepEqual(
        (await state()).events[0].details.changes.snapshot,
        agreedSnapshot,
      );
    },
  );

  await check(
    "RLS is enabled and anonymous/signed-in customer roles cannot read private tables or execute the mutation",
    async () => {
      for (const table of privateTables) {
        const result = await db.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass",
          [`public.${table}`],
        );
        assert.equal(result.rows[0].relrowsecurity, true);
      }
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`RESET ROLE; SET ROLE ${role}`);
        for (const table of privateTables)
          await denied(() => db.query(`SELECT * FROM public.${table}`));
        await denied(() => mutate(8, "unauthorized", { paid_pence: 0 }));
        await denied(() =>
          db.query(
            "INSERT INTO public.booking_journeys(booking_id) VALUES ($1)",
            [bookingId],
          ),
        );
      }
      await db.exec("RESET ROLE; SET ROLE service_role");
      assert.equal((await journey()).paid_pence, 3000);
    },
  );

  console.log(
    JSON.stringify(
      {
        engine: "PGlite, disposable in-memory PostgreSQL",
        migration: migrationName,
        passed: checks.length,
        checks,
        concurrencyScope:
          "Actual SQL revision conflicts on one serialized PGlite connection; not a multi-connection load test.",
        productionDatabaseUsed: false,
        networkPaymentOrEmailCalls: false,
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
