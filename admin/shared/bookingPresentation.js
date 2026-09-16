// Presentation only. Stored agreements, amounts and payment state are never changed.
const GENERIC_SCOPE = "Clean the items and areas listed above. Any additional work or change in price will be agreed with you before it is carried out.";
const lines = (value) => String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const isAccess = (line) => /^(?:parking\s*:|congestion charge\b|ulez\b|access (?:costs?|charges?)\s*:)/i.test(line);

export function bookingContent(agreement = {}) {
  const original = lines(agreement.items);
  const scope = String(agreement.scope || "").trim();
  return {
    cleaning: original.filter(line => !isAccess(line)),
    access: [...new Set([...original.filter(isAccess), ...lines(agreement.accessNotes)])],
    details: scope === GENERIC_SCOPE ? "" : scope,
    exclusions: String(agreement.exclusions || "").trim(),
  };
}

export function friendlyBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "";
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
  }).format(date);
}
