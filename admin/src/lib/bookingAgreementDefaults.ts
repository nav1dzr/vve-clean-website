import type { BookingDetail } from "../types/booking";
import { bookingContent } from "../../shared/bookingPresentation.js";

export type AgreementText = {
  service: string;
  items: string;
  scope: string;
  exclusions: string;
  accessNotes: string;
  preparation: string;
};

// Compact, editable summaries of the package inclusions already published in
// EotQuoteWizard and EotProcessSection. An absent package never means Complete.
function tenancyChecklist(config: Record<string, unknown>): string[] {
  if (config.service !== "deep" || config.deepService !== "end_of_tenancy") return [];
  if (config.eotPackage === "complete") return [
    "Oven, hob, grill and extractor",
    "Microwave, emptied fridge/freezer, dishwasher and washing-machine interiors",
    "Empty cupboards, drawers and wardrobes, inside and out",
    "Kitchen and bathroom detailing, including accessible tiles, grouting and fittings",
    "Bedrooms and living areas: accessible internal windows, skirting boards, doors, frames and switches",
    "Standard vacuuming and suitable hard-floor mopping",
    "Photographic cleaning receipt",
  ];
  if (config.eotPackage === "tailored") return [
    "One standard oven, hob, grill and extractor clean",
    "Kitchen and bathroom surfaces",
    "Bedrooms and reception rooms: accessible internal windows, skirting boards, doors, frames and switches",
    "Standard vacuuming and suitable hard-floor mopping",
    "Photographic cleaning receipt",
  ];
  return [];
}

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
  const content = bookingContent({ items: original });
  const cleaning = content.cleaning.join("\n");
  const checklist = tenancyChecklist(config).map((task) =>
    /^(?:One standard )?Oven, hob/i.test(task) && /inside oven|oven clean/i.test(cleaning)
      ? "Hob, grill and extractor"
      : task,
  );
  // Keep the original quantities and selected extras. A short package task
  // list supplements them only for a new draft whose package is known.
  const withChecklist = checklist.length
    ? `${cleaning}\n${checklist.join("\n")}`.trim()
    : cleaning;
  return {
    service: service.slice(0, 200),
    items: withChecklist.length <= 3000 ? withChecklist : cleaning,
    scope: isFabric
      ? "Clean the listed items, with the fibre and condition checked before choosing a suitable treatment. Hot-water extraction is used where suitable. Stain removal depends on the material and the mark."
      : "",
    exclusions: "",
    accessNotes: content.access.join("\n"),
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
    ...Object.fromEntries(Object.entries(suggested).filter(([key]) => !current[key as keyof AgreementText]?.trim())),
  };
}
