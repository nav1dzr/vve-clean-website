import type { BookingDetail } from "../types/booking";

export type AgreementText = {
  service: string;
  items: string;
  scope: string;
  exclusions: string;
  preparation: string;
};

// Suggestions only: the owner reviews them before sending. Never calculate a
// price or infer a guarantee, extra service, access charge or customer agreement.
export function bookingAgreementText(booking: Pick<BookingDetail, "service" | "quoteConfig">): AgreementText {
  const original = (booking.service || "").trim();
  const config = booking.quoteConfig || {};
  const names: Record<string, string> = {
    carpet_upholstery: "Carpet and upholstery cleaning",
    end_of_tenancy: "End of tenancy cleaning",
    move_in: "Move-in cleaning",
    after_builders: "After builders cleaning",
  };
  const service = config.service === "deep"
    ? names[String(config.deepService)] || original.split(/\r?\n/)[0]
    : ({ window: "Window cleaning", gutter: "Gutter cleaning", office: "Office cleaning" } as Record<string, string>)[String(config.service)] || original.split(/\r?\n/)[0];
  const isFabric = config.service === "deep" && config.deepService === "carpet_upholstery";
  return {
    service: service.slice(0, 200),
    // Keep every original selection, condition note and access charge visible.
    // Staff can shorten this after checking the original request below the form.
    items: original,
    scope: isFabric
      ? "Clean the listed items, with the fibre and condition checked before choosing a suitable treatment. Hot-water extraction is used where suitable. Stain removal depends on the material and the mark."
      : "Clean the items and areas listed above. Any additional work or change in price will be agreed with you before it is carried out.",
    exclusions: "",
    preparation: isFabric
      ? "Please clear small belongings from the areas being cleaned and arrange access for our team. Let us know about any access restrictions before the visit."
      : "Please arrange access for the agreed arrival window and let us know about any access restrictions before the visit.",
  };
}

export function requestedArrivalWindow(value: string | null): string {
  const windows: Record<string, string> = {
    "Morning (8am–12pm)": "08:00–12:00",
    "Afternoon (12pm–5pm)": "12:00–17:00",
    Flexible: "",
  };
  return value && value in windows ? windows[value] : value || "";
}

// Used only by an explicit button on an existing draft. Never replace edits.
export function fillMissingAgreementText<T extends AgreementText>(current: T, booking: Pick<BookingDetail, "service" | "quoteConfig">): T {
  const suggested = bookingAgreementText(booking);
  return {
    ...current,
    ...Object.fromEntries(Object.entries(suggested).filter(([key]) => !current[key as keyof AgreementText].trim())),
  };
}
