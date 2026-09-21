const REQUIRED_ENV = [
  "GOOGLE_ADS_API_VERSION",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID",
];

function configured() {
  return process.env.DEPOSIT_MEASUREMENT_ENABLED === "true" &&
    REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}
function adsDate(value) {
  return new Date(value).toISOString().replace("T", " ").replace("Z", "+00:00");
}
function safeAttribution(value = {}) {
  for (const key of ["gclid", "gbraid", "wbraid"])
    if (typeof value[key] === "string" && /^[A-Za-z0-9._~-]{1,200}$/.test(value[key])) return { [key]: value[key] };
  return {};
}
export function googleAdsDepositPayload(row) {
  if (row.event_name !== "deposit_paid" || row.is_test || row.status !== "sending")
    throw new Error("Only claimed, non-test verified deposit records may be delivered.");
  const click = safeAttribution(row.attribution);
  if (Object.keys(click).length !== 1)
    throw new Error("Exactly one supported click identifier is required.");
  if (!Number.isSafeInteger(row.amount_pence) || row.amount_pence <= 0 || row.currency !== "gbp")
    throw new Error("Verified amount or currency is invalid.");
  if (row.consent?.advertising !== true || row.consent?.withdrawn_at)
    throw new Error("Advertising consent is not available.");
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const actionId = process.env.GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID;
  return {
    conversions: [{
      conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
      conversionDateTime: adsDate(row.paid_at),
      conversionValue: row.amount_pence / 100,
      currencyCode: "GBP",
      orderId: row.conversion_id,
      ...click,
      consent: { adUserData: "GRANTED", adPersonalization: "GRANTED" },
    }],
    partialFailure: true,
  };
}
async function accessToken(fetchFn) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const response = await fetchFn("https://oauth2.googleapis.com/token", { method: "POST", body, signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error("Google OAuth token request failed.");
  return result.access_token;
}
async function mark(db, row, patch) {
  const { error } = await db.from("booking_measurement_outbox").update(patch).eq("id", row.id).eq("status", "sending");
  if (error) throw new Error("Measurement delivery state could not be saved.");
}
export async function deliverDepositMeasurements(db, { fetchFn = fetch } = {}) {
  if (!configured()) return { status: "disabled", processed: 0 };
  const { data: rows, error } = await db.rpc("claim_booking_measurements", { p_limit: 10 });
  if (error) throw new Error("Measurement outbox could not be claimed.");
  if (!rows?.length) return { status: "idle", processed: 0 };
  const token = await accessToken(fetchFn);
  let delivered = 0;
  for (const row of rows) {
    try {
      const payload = googleAdsDepositPayload(row);
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
      const version = process.env.GOOGLE_ADS_API_VERSION;
      const headers = {
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "Content-Type": "application/json",
        ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { "login-customer-id": process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID } : {}),
      };
      const response = await fetchFn(`https://googleads.googleapis.com/${version}/customers/${customerId}:uploadClickConversions`, {
        method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.partialFailureError || !Array.isArray(result.results) || result.results.length !== 1)
        throw new Error("Google Ads did not acknowledge the conversion.");
      await mark(db, row, { status: "delivered", delivered_at: new Date().toISOString(), claimed_at: null,
        provider_acknowledgement: String(result.results[0].resourceName || row.conversion_id).slice(0, 500), last_error: null });
      delivered++;
    } catch (error) {
      await mark(db, row, { status: "failed", claimed_at: null, last_error: String(error.message || error).slice(0, 500) });
    }
  }
  return { status: "processed", processed: rows.length, delivered };
}
