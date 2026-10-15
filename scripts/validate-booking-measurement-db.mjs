/**
 * Run the booking measurement migrations against disposable, in-memory PostgreSQL.
 *
 * node scripts/validate-booking-measurement-db.mjs [--pglite /path/to/pglite/dist/index.js]
 * PGLITE_MODULE may also name that local file or its file: URL.
 * Without either option, resolve an installed @electric-sql/pglite package.
 * No database URLs, production credentials, Stripe, email or analytics connections are used.
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

const migrationNames = [
  "20260908100000_booking_journey.sql",
  "20260908120000_request_reliability.sql",
  "20260916183000_booking_confirmation_channels.sql",
  "20260917120000_booking_measurement_outbox.sql",
  "20260924120000_booking_measurement_canonical_events.sql",
];
const legacyMigrationNames = migrationNames.slice(0, -1);
const canonicalUpgradeName = migrationNames.at(-1);
const checks = [];
const uuids = {
  eligible: "11111111-1111-4111-8111-111111111111",
  eligibleRequest: "11111111-1111-4111-8111-111111111112",
  duplicateRequest: "11111111-1111-4111-8111-111111111113",
  test: "22222222-2222-4222-8222-222222222222",
  testRequest: "22222222-2222-4222-8222-222222222223",
  denied: "33333333-3333-4333-8333-333333333333",
  deniedRequest: "33333333-3333-4333-8333-333333333334",
  clickless: "44444444-4444-4444-8444-444444444444",
  clicklessRequest: "44444444-4444-4444-8444-444444444445",
  bank: "55555555-5555-4555-8555-555555555555",
  bankRequest: "55555555-5555-4555-8555-555555555556",
  legacy: "66666666-6666-4666-8666-666666666666",
  legacyRequest: "66666666-6666-4666-8666-666666666667",
  hashOnly: "77777777-7777-4777-8777-777777777777",
  hashOnlyRequest: "77777777-7777-4777-8777-777777777778",
  noDeposit: "88888888-8888-4888-8888-888888888888",
  noDepositRequest: "88888888-8888-4888-8888-888888888889",
};
const matching = {
  email: "a".repeat(64),
  phone: "b".repeat(64),
};
const rawCustomerData = {
  name: "Measurement Test Person",
  email: "measurement.person@example.invalid",
  phone: "+447700900999",
  address: "99 Synthetic Test Road",
  postcode: "ZZ99 9ZZ",
};

const check = async (name, action) => {
  await action();
  checks.push(name);
};
const readMigration = (name) =>
  readFile(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
const applyMigrations = async (names = migrationNames) => {
  for (const migrationName of names) {
    await db.exec(await readMigration(migrationName));
  }
};
const insertBooking = async ({
  id,
  requestKey,
  advertisingConsent = true,
  isTest = false,
  gclid = "synthetic-click-id",
  emailHash = matching.email,
  phoneHash = matching.phone,
}) => {
  await db.query(
    `insert into public.bookings(
      id, request_key, booking_ref, created_at, full_name, email, phone,
      address, postcode, service, payment_status, deposit_amount, status,
      first_source, last_source, landing_page, utm_source, utm_medium,
      utm_campaign, utm_content, utm_term, gclid,
      attribution_first_touch_at, measurement_advertising_consent,
      measurement_consent_version, measurement_consent_recorded_at,
      measurement_is_test, measurement_email_sha256, measurement_phone_sha256
    ) values (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, 'Synthetic cleaning', 'pending_payment', 0, 'new',
      'google', 'google', 'https://www.vveclean.co.uk/synthetic-test',
      'google', 'cpc', 'synthetic-campaign', 'synthetic-content',
      'synthetic-term', $10, $4, $11, '2026-09-24', $4, $12, $13, $14
    )`,
    [
      id,
      requestKey,
      `TEST-${id.slice(0, 8)}`,
      "2026-09-24T12:00:00.000Z",
      rawCustomerData.name,
      rawCustomerData.email,
      rawCustomerData.phone,
      rawCustomerData.address,
      rawCustomerData.postcode,
      gclid,
      advertisingConsent,
      isTest,
      emailHash,
      phoneHash,
    ],
  );
};
const mutate = async (
  bookingId,
  revision,
  event,
  patch = {},
  bookingPatch = {},
  payment = null,
) => {
  const result = await db.query(
    "select public.apply_booking_journey($1,$2,$3,$4,$5,$6,$7,$8) as journey",
    [
      bookingId,
      revision,
      "synthetic-measurement-validation",
      event,
      JSON.stringify(patch),
      JSON.stringify(bookingPatch),
      null,
      payment === null ? null : JSON.stringify(payment),
    ],
  );
  return result.rows[0].journey;
};
const outbox = async (bookingId) =>
  (
    await db.query(
      `select * from public.booking_measurement_outbox
       where booking_id=$1 order by created_at,event_name`,
      [bookingId],
    )
  ).rows;
const eventCount = async (bookingId, eventName) =>
  Number(
    (
      await db.query(
        `select count(*)::int as total from public.booking_measurement_outbox
         where booking_id=$1 and event_name=$2`,
        [bookingId, eventName],
      )
    ).rows[0].total,
  );

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    alter default privileges in schema public
      grant all on tables to anon, authenticated, service_role;
    create table public.bookings (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      booking_ref text,
      payment_status text not null default 'pending_payment',
      deposit_amount numeric default 0,
      full_name text,
      email text,
      phone text,
      address text,
      postcode text,
      service text,
      preferred_date text,
      preferred_time text,
      service_date date,
      total_price numeric,
      balance_status text,
      balance_paid_at timestamptz,
      balance_payment_method text,
      status text,
      first_source text,
      last_source text,
      landing_page text,
      utm_source text,
      utm_medium text,
      utm_campaign text,
      utm_content text,
      gclid text
    );
  `);

  await check(
    "The additive upgrade preserves both a historic booking and its legacy outbox row",
    async () => {
      await db.query(
        `insert into public.bookings(id,booking_ref,payment_status,deposit_amount,status)
         values($1,'PREEXISTING','legacy',30,'historic')`,
        ["00000000-0000-4000-8000-000000000001"],
      );
      const before = (await db.query("select * from public.bookings")).rows;
      await applyMigrations(legacyMigrationNames);

      await db.query(
        `insert into public.bookings(
          id,request_key,booking_ref,payment_status,deposit_amount,status,gclid,
          measurement_advertising_consent,measurement_consent_version,
          measurement_consent_recorded_at,measurement_is_test
        ) values($1,$2,'LEGACY-OUTBOX','pending_payment',0,'new',
          'synthetic-legacy-click',true,'legacy-consent',now(),true)`,
        [uuids.legacy, uuids.legacyRequest],
      );
      await db.query(
        "insert into public.booking_journeys(booking_id) values($1)",
        [uuids.legacy],
      );
      const legacyReference = "bank-deposit:historic:AB12CD-170926";
      await db.query(
        `insert into public.booking_journey_payments(
          external_id,booking_id,kind,amount_pence,currency,created_at
        ) values($1,$2,'manual_deposit',3000,'gbp','2026-09-17T09:15:00Z')`,
        [legacyReference, uuids.legacy],
      );
      const legacyBefore = (await outbox(uuids.legacy))[0];
      assert.ok(legacyBefore);
      assert.equal(legacyBefore.payment_external_id, legacyReference);
      assert.equal(legacyBefore.provider, "google_ads_offline");

      await applyMigrations([canonicalUpgradeName]);
      await applyMigrations([canonicalUpgradeName]);
      const after = (await db.query("select * from public.bookings")).rows;
      const beforeLegacy = before[0];
      const afterLegacy = after.find((row) => row.id === beforeLegacy.id);
      for (const [column, value] of Object.entries(beforeLegacy)) {
        assert.deepEqual(afterLegacy[column], value);
      }
      assert.equal((await outbox(beforeLegacy.id)).length, 0);

      const legacyAfter = (await outbox(uuids.legacy))[0];
      for (const column of [
        "id", "payment_external_id", "booking_id", "event_name",
        "conversion_id", "amount_pence", "currency", "payment_type",
        "paid_at", "attribution", "consent", "is_test", "provider",
        "status", "attempts", "provider_acknowledgement", "last_error",
        "claimed_at", "delivered_at", "created_at",
      ]) assert.deepEqual(legacyAfter[column], legacyBefore[column], column);
      assert.equal(legacyAfter.event_key, null);
      assert.equal(legacyAfter.occurred_at, null);
      assert.equal(legacyAfter.canonical_event_version, null);
      assert.deepEqual(legacyAfter.match_data, {});
    },
  );

  await check(
    "One accepted modern request creates exactly one canonical request event",
    async () => {
      await insertBooking({
        id: uuids.eligible,
        requestKey: uuids.eligibleRequest,
      });
      let rows = await outbox(uuids.eligible);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].event_name, "booking_request_submitted");
      assert.equal(rows[0].status, "pending");
      assert.equal(rows[0].event_key, `booking:${uuids.eligible}:booking_request_submitted`);

      await assert.rejects(
        () =>
          insertBooking({
            id: uuids.duplicateRequest,
            requestKey: uuids.eligibleRequest,
          }),
        (error) => error.code === "23505",
      );
      await db.query(
        `select public.queue_booking_measurement(
          $1,'booking_request_submitted',$2,now()
        )`,
        [
          uuids.eligible,
          `booking:${uuids.eligible}:booking_request_submitted`,
        ],
      );
      rows = await outbox(uuids.eligible);
      assert.equal(rows.length, 1);
    },
  );

  await db.query(
    "insert into public.booking_journeys(booking_id) values($1)",
    [uuids.eligible],
  );

  await check(
    "First qualification is recorded once despite repeated offered transitions",
    async () => {
      await mutate(uuids.eligible, 0, "offer_sent", { state: "offered" });
      assert.equal(
        await eventCount(uuids.eligible, "booking_request_qualified"),
        1,
      );
      await mutate(uuids.eligible, 1, "offer_replayed", { state: "offered" });
      assert.equal(
        await eventCount(uuids.eligible, "booking_request_qualified"),
        1,
      );
    },
  );

  await check(
    "A confirmed after-clean booking is not counted before a verified deposit",
    async () => {
      await insertBooking({
        id: uuids.noDeposit,
        requestKey: uuids.noDepositRequest,
        isTest: true,
      });
      await db.query(
        "insert into public.booking_journeys(booking_id) values($1)",
        [uuids.noDeposit],
      );
      await mutate(uuids.noDeposit, 0, "confirmed_without_deposit", {
        state: "confirmed",
      });
      assert.equal(
        await eventCount(uuids.noDeposit, "booking_request_qualified"),
        1,
      );
      assert.equal(await eventCount(uuids.noDeposit, "deposit_paid"), 0);
      assert.equal(await eventCount(uuids.noDeposit, "booking_confirmed"), 0);
    },
  );

  await check(
    "Verified payment records one deposit with its actual GBP amount and one confirmation",
    async () => {
      const payment = {
        external_id: "cs_synthetic_measurement_opaque",
        kind: "deposit",
        amount_pence: 4700,
        occurred_at: "2026-09-23T10:11:12.000Z",
      };
      await mutate(
        uuids.eligible,
        2,
        "stripe_deposit_received",
        { state: "confirmed", paid_pence: 4700 },
        {
          status: "confirmed",
          payment_status: "paid",
          deposit_amount: 47,
        },
        payment,
      );
      let rows = await outbox(uuids.eligible);
      const deposit = rows.find((row) => row.event_name === "deposit_paid");
      assert.ok(deposit);
      assert.equal(deposit.amount_pence, 4700);
      assert.equal(deposit.currency, "gbp");
      assert.equal(deposit.payment_type, "stripe_deposit");
      assert.equal(deposit.payment_external_id, payment.external_id);
      assert.equal(
        new Date(deposit.occurred_at).toISOString(),
        payment.occurred_at,
      );
      const ledgerPayment = (
        await db.query(
          "select created_at from public.booking_journey_payments where external_id=$1",
          [payment.external_id],
        )
      ).rows[0];
      assert.equal(
        new Date(ledgerPayment.created_at).toISOString(),
        payment.occurred_at,
      );
      assert.equal(await eventCount(uuids.eligible, "deposit_paid"), 1);
      assert.equal(await eventCount(uuids.eligible, "booking_confirmed"), 1);
      assert.equal(
        await eventCount(uuids.eligible, "booking_request_qualified"),
        1,
      );

      await mutate(
        uuids.eligible,
        2,
        "stripe_webhook_replay",
        { state: "confirmed", paid_pence: 9400 },
        { deposit_amount: 94 },
        payment,
      );
      assert.equal(await eventCount(uuids.eligible, "deposit_paid"), 1);
      assert.equal(await eventCount(uuids.eligible, "booking_confirmed"), 1);

      await mutate(uuids.eligible, 3, "confirmed_replayed", {
        state: "confirmed",
      });
      rows = await outbox(uuids.eligible);
      assert.equal(rows.length, 4);
      assert.deepEqual(
        rows.map((row) => row.event_name).sort(),
        [
          "booking_confirmed",
          "booking_request_qualified",
          "booking_request_submitted",
          "deposit_paid",
        ],
      );
    },
  );

  await check(
    "Outbox snapshots contain consented hashes and campaign data but no raw customer data",
    async () => {
      const rows = await outbox(uuids.eligible);
      for (const row of rows) {
        assert.equal(row.match_data.email_sha256, matching.email);
        assert.equal(row.match_data.phone_sha256, matching.phone);
      }
      const serialized = JSON.stringify(rows).toLowerCase();
      for (const rawValue of Object.values(rawCustomerData)) {
        assert.equal(
          serialized.includes(rawValue.toLowerCase()),
          false,
          `outbox unexpectedly contained raw value: ${rawValue}`,
        );
      }
    },
  );

  await check(
    "A staff-entered bank reference remains in the restricted ledger and never enters the outbox",
    async () => {
      const bankReference = "bank-deposit:synthetic:E11AA-240926";
      await insertBooking({
        id: uuids.bank,
        requestKey: uuids.bankRequest,
        isTest: true,
      });
      await db.query(
        "insert into public.booking_journeys(booking_id) values($1)",
        [uuids.bank],
      );
      await mutate(uuids.bank, 0, "offer_sent", { state: "offered" });
      await mutate(
        uuids.bank,
        1,
        "manual_bank_deposit_received",
        { state: "confirmed", paid_pence: 3000 },
        { status: "confirmed", payment_status: "paid", deposit_amount: 30 },
        { external_id: bankReference, kind: "manual_deposit", amount_pence: 3000 },
      );
      const ledger = (
        await db.query(
          "select external_id from public.booking_journey_payments where booking_id=$1",
          [uuids.bank],
        )
      ).rows;
      assert.deepEqual(ledger, [{ external_id: bankReference }]);
      const rows = await outbox(uuids.bank);
      const deposit = rows.find((row) => row.event_name === "deposit_paid");
      assert.ok(deposit);
      assert.equal(deposit.payment_external_id, null);
      assert.equal(
        deposit.event_key,
        `booking:${uuids.bank}:deposit_paid`,
      );
      assert.equal(JSON.stringify(rows).includes(bankReference), false);
    },
  );

  await check(
    "Test requests and every later test-booking milestone remain suppressed",
    async () => {
      await insertBooking({
        id: uuids.test,
        requestKey: uuids.testRequest,
        isTest: true,
      });
      await db.query(
        "insert into public.booking_journeys(booking_id) values($1)",
        [uuids.test],
      );
      await mutate(uuids.test, 0, "offer_sent", { state: "offered" });
      await mutate(
        uuids.test,
        1,
        "test_deposit_received",
        { state: "confirmed", paid_pence: 5100 },
        {},
        {
          external_id: "cs_synthetic_test_booking",
          kind: "deposit",
          amount_pence: 5100,
        },
      );
      const rows = await outbox(uuids.test);
      assert.equal(rows.length, 4);
      assert.ok(rows.every((row) => row.status === "suppressed"));
      assert.ok(rows.every((row) => row.last_error === "test_record"));
      assert.ok(rows.every((row) => row.is_test === true));
    },
  );

  await check(
    "A consented valid hash is eligible without a click ID",
    async () => {
      await insertBooking({
        id: uuids.hashOnly,
        requestKey: uuids.hashOnlyRequest,
        gclid: null,
      });
      const rows = await outbox(uuids.hashOnly);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "pending");
      assert.deepEqual(rows[0].attribution.gclid, undefined);
      assert.equal(rows[0].match_data.email_sha256, matching.email);
      assert.equal(rows[0].match_data.phone_sha256, matching.phone);
    },
  );

  await check(
    "Denied consent and absence of both safe click IDs and hashes fail closed",
    async () => {
      await insertBooking({
        id: uuids.denied,
        requestKey: uuids.deniedRequest,
        advertisingConsent: false,
      });
      await insertBooking({
        id: uuids.clickless,
        requestKey: uuids.clicklessRequest,
        gclid: null,
        emailHash: null,
        phoneHash: null,
      });
      const deniedRows = await outbox(uuids.denied);
      const clicklessRows = await outbox(uuids.clickless);
      assert.equal(deniedRows.length, 1);
      assert.equal(deniedRows[0].status, "suppressed");
      assert.equal(
        deniedRows[0].last_error,
        "advertising_consent_not_granted",
      );
      assert.deepEqual(deniedRows[0].match_data, {});
      assert.equal(clicklessRows.length, 1);
      assert.equal(clicklessRows[0].status, "suppressed");
      assert.equal(clicklessRows[0].last_error, "no_eligible_match_data");
    },
  );

  await check(
    "Only eligible events are claimed; polling is recoverable; withdrawal suppresses sends",
    async () => {
      const claimed = (
        await db.query("select * from public.claim_booking_measurements(25)")
      ).rows;
      assert.equal(claimed.length, 5);
      assert.ok(
        claimed.every((row) =>
          [uuids.eligible, uuids.hashOnly].includes(row.booking_id),
        ),
      );
      assert.ok(claimed.every((row) => row.status === "sending"));

      const hashOnlyClaim = claimed.find(
        (row) => row.booking_id === uuids.hashOnly,
      );
      assert.ok(hashOnlyClaim);
      await db.query(
        `update public.booking_measurement_outbox
         set status='submitted', attempts=8, next_attempt_at=now(), claimed_at=null
         where id=$1`,
        [hashOnlyClaim.id],
      );
      const statusPoll = (
        await db.query("select * from public.claim_booking_measurements(25)")
      ).rows;
      assert.equal(statusPoll.length, 1);
      assert.equal(statusPoll[0].id, hashOnlyClaim.id);
      assert.equal(statusPoll[0].status, "submitted");
      assert.equal(statusPoll[0].attempts, 8);
      assert.equal(statusPoll[0].status_checks, 1);

      await db.query(
        "select public.withdraw_booking_measurement_consent($1)",
        [uuids.eligible],
      );
      const withdrawn = await outbox(uuids.eligible);
      assert.ok(withdrawn.every((row) => row.status === "suppressed"));
      assert.ok(
        withdrawn.every((row) => row.last_error === "consent_withdrawn"),
      );
      assert.ok(
        withdrawn.every(
          (row) => Object.keys(row.match_data ?? {}).length === 0,
        ),
      );
      assert.ok(
        withdrawn.every(
          (row) => Object.keys(row.attribution ?? {}).length === 0,
        ),
      );
      const booking = (
        await db.query(
          `select measurement_advertising_consent,
                  measurement_consent_withdrawn_at,
                  measurement_email_sha256,
                  measurement_phone_sha256
           from public.bookings where id=$1`,
          [uuids.eligible],
        )
      ).rows[0];
      assert.equal(booking.measurement_advertising_consent, false);
      assert.ok(booking.measurement_consent_withdrawn_at);
      assert.equal(booking.measurement_email_sha256, null);
      assert.equal(booking.measurement_phone_sha256, null);

      await db.query(
        "select public.withdraw_booking_measurement_consent($1)",
        [uuids.hashOnly],
      );
      await assert.rejects(
        () => db.query(
          "select public.withdraw_booking_measurement_consent($1)",
          ["99999999-9999-4999-8999-999999999999"],
        ),
        (error) => error.code === "P0002",
      );

      const afterWithdrawalClaim = (
        await db.query("select * from public.claim_booking_measurements(25)")
      ).rows;
      assert.equal(afterWithdrawalClaim.length, 0);
    },
  );

  console.log(
    JSON.stringify(
      {
        engine: "PGlite, disposable in-memory PostgreSQL",
        migrations: migrationNames,
        passed: checks.length,
        checks,
        canonicalEvents: [
          "booking_request_submitted",
          "booking_request_qualified",
          "deposit_paid",
          "booking_confirmed",
        ],
        verifiedDeposit: { amountPence: 4700, currency: "gbp", count: 1 },
        productionDatabaseUsed: false,
        supabaseProjectUsed: false,
        networkAnalyticsPaymentOrMessagingCalls: false,
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
