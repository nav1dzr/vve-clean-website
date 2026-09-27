const REQUIRED_COMMON_ENV = [
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_DATA_MANAGER_CLIENT_ID",
  "GOOGLE_DATA_MANAGER_CLIENT_SECRET",
  "GOOGLE_DATA_MANAGER_REFRESH_TOKEN",
];

const EVENT_ACTION_ENV = Object.freeze({
  booking_request_submitted:
    "GOOGLE_ADS_BOOKING_REQUEST_SUBMITTED_CONVERSION_ACTION_ID",
  booking_request_qualified:
    "GOOGLE_ADS_BOOKING_REQUEST_QUALIFIED_CONVERSION_ACTION_ID",
  deposit_paid: "GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID",
  booking_confirmed: "GOOGLE_ADS_BOOKING_CONFIRMED_CONVERSION_ACTION_ID",
});

const DATA_MANAGER_PROVIDER = "google_data_manager";
const SAFE_ERROR = /^[a-z0-9_.:-]{1,120}$/i;
const SAFE_STRIPE_TRANSACTION = /^cs_[A-Za-z0-9_-]{1,196}$/;
const SAFE_EVENT_KEY = /^booking:[0-9a-f-]{36}:(booking_request_submitted|booking_request_qualified|deposit_paid|booking_confirmed)$/i;
const SAFE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/i;

class MeasurementDeliveryError extends Error {
  constructor(code) {
    super(code);
    this.name = "MeasurementDeliveryError";
  }
}

function configured() {
  return ["validate", "live"].includes(process.env.BOOKING_MEASUREMENT_MODE) &&
    REQUIRED_COMMON_ENV.every((name) => Boolean(process.env[name])) &&
    Object.values(EVENT_ACTION_ENV).every((name) => Boolean(process.env[name]));
}

function validationMode() {
  return process.env.BOOKING_MEASUREMENT_MODE === "validate";
}

function safeAttribution(value = {}) {
  for (const key of ["gclid", "gbraid", "wbraid"])
    if (typeof value[key] === "string" && /^[A-Za-z0-9._~-]{1,200}$/.test(value[key])) return { [key]: value[key] };
  return {};
}

function safeUserData(value = {}) {
  const userIdentifiers = [];
  if (typeof value.email_sha256 === "string" && SHA256_HEX.test(value.email_sha256))
    userIdentifiers.push({ emailAddress: value.email_sha256.toLowerCase() });
  if (typeof value.phone_sha256 === "string" && SHA256_HEX.test(value.phone_sha256))
    userIdentifiers.push({ phoneNumber: value.phone_sha256.toLowerCase() });
  return userIdentifiers.length ? { userIdentifiers } : null;
}

function safeFailureCode(error) {
  const candidate = error instanceof MeasurementDeliveryError ? error.message : "measurement_delivery_failed";
  return SAFE_ERROR.test(candidate) ? candidate : "measurement_delivery_failed";
}

function safeFieldWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((warning) => {
    const fieldPath = String(warning?.fieldPath || warning?.field || "")
      .replace(/[^A-Za-z0-9_.\[\]-]/g, "").slice(0, 120);
    const reason = String(warning?.reason || warning?.warningCode || "UNKNOWN")
      .replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 80);
    return {
      ...(fieldPath ? { fieldPath } : {}),
      reason: reason || "UNKNOWN",
    };
  });
}

function dataManagerAcknowledgement(response, validateOnly) {
  const requestId = typeof response?.requestId === "string" ? response.requestId.trim() : "";
  // Data Manager validation executes no upload and may return an empty object.
  // A request ID is mandatory only for a live upload because that ID is what
  // lets us poll the asynchronous processing result.
  if (!validateOnly && (!requestId || requestId.length > 300))
    throw new MeasurementDeliveryError("data_manager_missing_request_id");
  const fieldWarnings = safeFieldWarnings(response?.fieldWarnings);
  return JSON.stringify({
    provider: "google_data_manager",
    ...(requestId && requestId.length <= 300 ? { requestId } : {}),
    status: validateOnly ? "VALIDATED" : "SUBMITTED",
    validateOnly,
    fieldWarningCount: fieldWarnings.length,
    ...(fieldWarnings.length ? { fieldWarnings } : {}),
  });
}

function parseDataManagerAcknowledgement(value) {
  let receipt;
  try {
    receipt = JSON.parse(value);
  } catch {
    throw new MeasurementDeliveryError("data_manager_receipt_invalid");
  }
  if (receipt?.provider !== "google_data_manager" ||
      typeof receipt.requestId !== "string" || !receipt.requestId ||
      receipt.requestId.length > 300)
    throw new MeasurementDeliveryError("data_manager_receipt_invalid");
  return receipt;
}

function diagnosticReasons(info, field) {
  const values = Array.isArray(info?.[field]) ? info[field] : [];
  return values.map((item) => String(item?.reason || "UNKNOWN")
    .replace(/[^A-Z0-9_]/gi, "").slice(0, 60)).filter(Boolean).slice(0, 5);
}

function dataManagerDiagnosticAcknowledgement(receipt, destination) {
  return JSON.stringify({
    provider: "google_data_manager",
    requestId: receipt.requestId,
    status: destination.requestStatus,
    validateOnly: false,
    recordCount: String(destination.eventsIngestionStatus?.recordCount ?? ""),
    errorReasons: diagnosticReasons(destination.errorInfo, "errorCounts"),
    warningReasons: diagnosticReasons(destination.warningInfo, "warningCounts"),
    ...(Array.isArray(receipt.fieldWarnings) && receipt.fieldWarnings.length
      ? { submissionWarnings: receipt.fieldWarnings }
      : {}),
  });
}

function isIdempotentDuplicate(destination) {
  const errors = Array.isArray(destination?.errorInfo?.errorCounts)
    ? destination.errorInfo.errorCounts
    : [];
  return String(destination?.eventsIngestionStatus?.recordCount ?? "") === "1" &&
    errors.length === 1 &&
    errors[0]?.reason === "PROCESSING_ERROR_REASON_DUPLICATE_TRANSACTION_ID" &&
    String(errors[0]?.recordCount ?? "") === "1";
}

function markDuplicateAcknowledged(acknowledgement) {
  const parsed = JSON.parse(acknowledgement);
  return JSON.stringify({
    ...parsed,
    idempotencyResult: "ALREADY_UPLOADED",
  });
}

function dataManagerHttpFailure(response, result) {
  const status = typeof result?.error?.status === "string"
    ? result.error.status.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40)
    : "unknown";
  const reason = Array.isArray(result?.error?.details)
    ? result.error.details.find((detail) => typeof detail?.reason === "string")?.reason
    : null;
  const safeReason = typeof reason === "string"
    ? reason.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40)
    : "unknown";
  return `data_manager_http_${response.status || "unknown"}_${status}_${safeReason}`.slice(0, 120);
}

function actionIdForEvent(eventName) {
  const envName = EVENT_ACTION_ENV[eventName];
  const actionId = envName ? process.env[envName] : null;
  if (!envName) throw new MeasurementDeliveryError("measurement_event_unsupported");
  if (!actionId) throw new MeasurementDeliveryError("measurement_action_unconfigured");
  return actionId;
}

function measurementTransactionId(row) {
  // Stripe Checkout session IDs are provider-issued opaque transaction IDs.
  // A manual bank reference can contain a customer's postcode/reference, so it
  // stays inside VVE and the stable, PII-free canonical event key is sent.
  if (row.event_name === "deposit_paid" &&
      row.payment_type === "stripe_deposit" &&
      SAFE_STRIPE_TRANSACTION.test(row.payment_external_id || ""))
    return row.payment_external_id;
  if (!SAFE_EVENT_KEY.test(row.event_key || ""))
    throw new MeasurementDeliveryError("measurement_event_key_invalid");
  return row.event_key;
}

function compatibleMeasurementRow(row) {
  const legacy = row?.provider === "google_ads_offline";
  const canDeriveKey = legacy && SAFE_UUID.test(row?.booking_id || "") &&
    Object.hasOwn(EVENT_ACTION_ENV, row?.event_name);
  return {
    ...row,
    provider: legacy ? DATA_MANAGER_PROVIDER : row?.provider,
    event_key: row?.event_key || (canDeriveKey
      ? `booking:${row.booking_id}:${row.event_name}`
      : row?.event_key),
    occurred_at: row?.occurred_at || row?.paid_at,
    match_data: row?.match_data || {},
  };
}

export function dataManagerMeasurementPayload(row, { validateOnly = false } = {}) {
  row = compatibleMeasurementRow(row);
  if (!Object.hasOwn(EVENT_ACTION_ENV, row.event_name) || row.is_test || row.status !== "sending")
    throw new MeasurementDeliveryError("measurement_record_not_eligible");
  const click = safeAttribution(row.attribution);
  const userData = safeUserData(row.match_data);
  if (Object.keys(click).length !== 1 && !userData)
    throw new MeasurementDeliveryError("measurement_matching_identifier_unavailable");
  if (row.consent?.advertising !== true || row.consent?.withdrawn_at ||
      !row.consent?.recorded_at || !row.consent?.version)
    throw new MeasurementDeliveryError("measurement_consent_unavailable");
  const occurredAt = new Date(row.occurred_at);
  if (!Number.isFinite(occurredAt.getTime()))
    throw new MeasurementDeliveryError("measurement_timestamp_invalid");
  const isDeposit = row.event_name === "deposit_paid";
  if (isDeposit &&
      (!Number.isSafeInteger(row.amount_pence) || row.amount_pence <= 0 ||
       row.currency !== "gbp" ||
       !["stripe_deposit", "bank_transfer_deposit"].includes(row.payment_type)))
    throw new MeasurementDeliveryError("measurement_value_invalid");
  if (!isDeposit &&
      (row.amount_pence != null || row.currency != null ||
       row.payment_type != null || row.payment_external_id != null))
    throw new MeasurementDeliveryError("measurement_non_payment_value_present");
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const actionId = actionIdForEvent(row.event_name);
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const destination = {
    operatingAccount: { accountType: "GOOGLE_ADS", accountId: customerId },
    productDestinationId: actionId,
    ...(loginId ? { loginAccount: { accountType: "GOOGLE_ADS", accountId: loginId } } : {}),
  };
  return {
    destinations: [destination],
    consent: { adUserData: "CONSENT_GRANTED", adPersonalization: "CONSENT_GRANTED" },
    events: [{
      ...(Object.keys(click).length ? { adIdentifiers: click } : {}),
      ...(userData ? { userData } : {}),
      ...(isDeposit
        ? { conversionValue: row.amount_pence / 100, currency: "GBP" }
        : {}),
      eventTimestamp: occurredAt.toISOString(),
      transactionId: measurementTransactionId(row),
      eventSource: "WEB",
    }],
    ...(userData ? { encoding: "HEX" } : {}),
    validateOnly,
  };
}

// Compatibility export for callers/tests from the deposit-only prototype.
export const dataManagerDepositPayload = dataManagerMeasurementPayload;

async function accessToken(fetchFn) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_DATA_MANAGER_CLIENT_ID,
    client_secret: process.env.GOOGLE_DATA_MANAGER_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_DATA_MANAGER_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  let response;
  try {
    response = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new MeasurementDeliveryError("data_manager_oauth_network_error");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token)
    throw new MeasurementDeliveryError(`data_manager_oauth_http_${response.status || "unknown"}`);
  return result.access_token;
}

/**
 * Provider adapter boundary. The outbox runner below only knows how to prepare
 * and send through an adapter; a future approved transport can be introduced
 * without changing consent, retry, or state-transition handling.
 */
export function createGoogleDataManagerAdapter({
  fetchFn = fetch,
  validateOnly = validationMode(),
} = {}) {
  let preparedToken;
  return {
    provider: DATA_MANAGER_PROVIDER,
    configured: configured(),
    validateOnly,
    async prepare() {
      if (!preparedToken) preparedToken = accessToken(fetchFn);
      return preparedToken;
    },
    async send(row) {
      const token = await this.prepare();
      const payload = dataManagerMeasurementPayload(row, { validateOnly });
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      let response;
      try {
        response = await fetchFn("https://datamanager.googleapis.com/v1/events:ingest", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        throw new MeasurementDeliveryError("data_manager_network_error");
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new MeasurementDeliveryError(dataManagerHttpFailure(response, result));
      return {
        acknowledgement: dataManagerAcknowledgement(result, validateOnly),
        state: validateOnly ? "validated" : "submitted",
      };
    },
    async check(row) {
      const token = await this.prepare();
      const receipt = parseDataManagerAcknowledgement(row.provider_acknowledgement);
      let response;
      try {
        const query = new URLSearchParams({ requestId: receipt.requestId });
        response = await fetchFn(`https://datamanager.googleapis.com/v1/requestStatus:retrieve?${query}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        throw new MeasurementDeliveryError("data_manager_status_network_error");
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new MeasurementDeliveryError(dataManagerHttpFailure(response, result));
      const destinations = result.requestStatusPerDestination;
      if (!Array.isArray(destinations) || destinations.length !== 1)
        throw new MeasurementDeliveryError("data_manager_status_result_invalid");
      const destination = destinations[0];
      const status = destination?.requestStatus;
      const acknowledgement = dataManagerDiagnosticAcknowledgement(receipt, destination);
      if (status === "SUCCESS") {
        if (String(destination.eventsIngestionStatus?.recordCount ?? "") !== "1")
          throw new MeasurementDeliveryError("data_manager_record_count_mismatch");
        return { state: "delivered", acknowledgement };
      }
      if (status === "PROCESSING" || status === "REQUEST_STATUS_UNKNOWN")
        return { state: "submitted", acknowledgement };
      if (["FAILED", "FAILURE", "PARTIAL_SUCCESS"].includes(status)) {
        // A retry after Google accepted the first upload but our local state
        // save failed will be rejected as a duplicate transaction. That is
        // proof the same action + stable transaction ID already exists, so it
        // is the successful idempotent outcome rather than a retryable error.
        if (isIdempotentDuplicate(destination)) {
          return {
            state: "delivered",
            acknowledgement: markDuplicateAcknowledged(acknowledgement),
          };
        }
        const reasons = diagnosticReasons(destination.errorInfo, "errorCounts");
        return {
          state: "failed",
          acknowledgement,
          error: `data_manager_${String(status).toLowerCase()}_${reasons[0] || "unknown"}`.slice(0, 120),
        };
      }
      throw new MeasurementDeliveryError("data_manager_status_result_invalid");
    },
  };
}

async function mark(db, row, patch) {
  const { data, error } = await db.from("booking_measurement_outbox")
    .update(patch).eq("id", row.id).eq("status", row.status).select("id");
  if (error || !Array.isArray(data) || data.length !== 1)
    throw new MeasurementDeliveryError("measurement_state_save_failed");
}

function futureAttempt(value, attempts, baseMinutes = 30) {
  const now = new Date(value);
  const multiplier = 2 ** Math.min(Math.max(Number(attempts || 1) - 1, 0), 4);
  return new Date(now.getTime() + baseMinutes * multiplier * 60000).toISOString();
}

async function currentOutboxState(db, row) {
  const { data, error } = await db.from("booking_measurement_outbox")
    .select("status,is_test")
    .eq("id", row.id)
    .maybeSingle();
  if (error) throw new MeasurementDeliveryError("measurement_state_recheck_failed");
  return data;
}

async function currentEligibility(db, row) {
  const delivery = await currentOutboxState(db, row);
  if (!delivery || delivery.status !== "sending") {
    return { eligible: false, alreadyFinal: true, reason: delivery?.status || "missing" };
  }

  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .select("measurement_advertising_consent,measurement_consent_version,measurement_consent_recorded_at,measurement_consent_withdrawn_at,measurement_is_test")
    .eq("id", row.booking_id)
    .maybeSingle();
  if (bookingError) throw new MeasurementDeliveryError("measurement_consent_recheck_failed");
  if (!booking) return { eligible: false, reason: "booking_missing" };
  if (delivery.is_test || booking.measurement_is_test)
    return { eligible: false, reason: "test_record" };
  if (!booking.measurement_advertising_consent)
    return { eligible: false, reason: "advertising_consent_not_granted" };
  if (booking.measurement_consent_withdrawn_at)
    return { eligible: false, reason: "consent_withdrawn" };
  if (!booking.measurement_consent_recorded_at || !booking.measurement_consent_version)
    return { eligible: false, reason: "consent_record_missing" };
  return { eligible: true };
}

async function suppressIfNeeded(db, row, eligibility) {
  if (eligibility.eligible || eligibility.alreadyFinal) return;
  await mark(db, row, {
    status: "suppressed",
    claimed_at: null,
    last_error: eligibility.reason,
  });
}

export async function deliverBookingMeasurements(db, {
  fetchFn = fetch,
  adapters,
  now = () => new Date(),
} = {}) {
  const providers = adapters || {
    [DATA_MANAGER_PROVIDER]: createGoogleDataManagerAdapter({ fetchFn }),
  };
  const available = Object.values(providers).some((adapter) => adapter.configured !== false);
  if (!available) return { status: "disabled", processed: 0, submitted: 0, validated: 0, delivered: 0, failed: 0, suppressed: 0 };

  const { data: rows, error } = await db.rpc("claim_booking_measurements", { p_limit: 10 });
  if (error) throw new MeasurementDeliveryError("measurement_outbox_claim_failed");
  if (!rows?.length) return { status: "idle", processed: 0, submitted: 0, validated: 0, delivered: 0, failed: 0, suppressed: 0 };

  let submitted = 0;
  let validated = 0;
  let delivered = 0;
  let failed = 0;
  let suppressed = 0;
  for (const row of rows) {
    const deliveryRow = compatibleMeasurementRow(row);
    const adapter = providers[deliveryRow.provider];
    if (!adapter || adapter.configured === false) {
      const unavailableAt = new Date(typeof now === "function" ? now() : now);
      await mark(db, row, {
        status: "failed",
        claimed_at: null,
        next_attempt_at: futureAttempt(unavailableAt, row.attempts, 5),
        last_error: "measurement_provider_unavailable",
      });
      failed++;
      continue;
    }

    if (row.status === "submitted") {
      try {
        const current = await currentOutboxState(db, row);
        if (!current || current.status !== "submitted") {
          suppressed++;
          continue;
        }
        if (typeof adapter.check !== "function")
          throw new MeasurementDeliveryError("measurement_provider_status_unavailable");
        await adapter.prepare();
        const result = await adapter.check(deliveryRow);
        const checkedAt = new Date(typeof now === "function" ? now() : now);
        if (result.state === "delivered") {
          await mark(db, row, {
            status: "delivered",
            delivered_at: checkedAt.toISOString(),
            claimed_at: null,
            next_attempt_at: null,
            provider_acknowledgement: String(result.acknowledgement).slice(0, 500),
            last_error: null,
          });
          delivered++;
        } else if (result.state === "failed") {
          await mark(db, row, {
            status: "failed",
            claimed_at: null,
            next_attempt_at: futureAttempt(checkedAt, row.attempts, 15),
            provider_acknowledgement: String(result.acknowledgement).slice(0, 500),
            last_error: SAFE_ERROR.test(result.error || "") ? result.error : "measurement_processing_failed",
          });
          failed++;
        } else {
          await mark(db, row, {
            status: "submitted",
            claimed_at: null,
            next_attempt_at: futureAttempt(checkedAt, row.attempts),
            provider_acknowledgement: String(result.acknowledgement).slice(0, 500),
            last_error: null,
          });
          submitted++;
        }
      } catch (statusError) {
        const code = safeFailureCode(statusError);
        if (code === "measurement_state_save_failed") throw statusError;
        const checkedAt = new Date(typeof now === "function" ? now() : now);
        await mark(db, row, {
          status: "submitted",
          claimed_at: null,
          next_attempt_at: futureAttempt(checkedAt, row.attempts),
          last_error: code,
        });
        submitted++;
      }
      continue;
    }

    try {
      const beforePrepare = await currentEligibility(db, row);
      if (!beforePrepare.eligible) {
        await suppressIfNeeded(db, row, beforePrepare);
        suppressed++;
        continue;
      }

      await adapter.prepare();

      // Re-read immediately before the external send. A consent withdrawal or
      // operator suppression that happened while credentials were prepared
      // must win over the claimed snapshot.
      const beforeSend = await currentEligibility(db, row);
      if (!beforeSend.eligible) {
        await suppressIfNeeded(db, row, beforeSend);
        suppressed++;
        continue;
      }

      const receipt = await adapter.send(deliveryRow);
      try {
        const sentAt = new Date(typeof now === "function" ? now() : now);
        const nextStatus = ["validated", "delivered"].includes(receipt.state)
          ? receipt.state
          : "submitted";
        await mark(db, row, {
          status: nextStatus,
          submitted_at: nextStatus === "submitted" ? sentAt.toISOString() : null,
          delivered_at: nextStatus === "delivered" ? sentAt.toISOString() : null,
          claimed_at: null,
          next_attempt_at: nextStatus === "submitted"
            ? futureAttempt(sentAt, row.attempts)
            : null,
          provider_acknowledgement: String(receipt.acknowledgement).slice(0, 500),
          last_error: null,
        });
      } catch (saveError) {
        // The provider accepted the upload. Leave the record in `sending` so
        // stale-claim recovery can reconcile it using the same orderId; never
        // overwrite it as a definite provider failure.
        throw saveError;
      }
      if (receipt.state === "validated") validated++;
      else if (receipt.state === "delivered") delivered++;
      else submitted++;
    } catch (deliveryError) {
      const code = safeFailureCode(deliveryError);
      if (code === "measurement_state_save_failed") throw deliveryError;
      const failedAt = new Date(typeof now === "function" ? now() : now);
      await mark(db, row, {
        status: "failed",
        claimed_at: null,
        next_attempt_at: futureAttempt(failedAt, row.attempts, 5),
        last_error: code,
      });
      failed++;
    }
  }
  return { status: "processed", processed: rows.length, submitted, validated, delivered, failed, suppressed };
}

// Compatibility alias while callers move from the deposit-only prototype.
export const deliverDepositMeasurements = deliverBookingMeasurements;
