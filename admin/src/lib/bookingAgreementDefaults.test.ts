import { describe, expect, it } from "vitest";
import { bookingAgreementText, fillMissingAgreementText, requestedArrivalWindow } from "./bookingAgreementDefaults";
const booking = {
  service: "Carpet and upholstery\nStairs ×1; landing ×1\nHeavy staining; access costs agreed separately",
  quoteConfig: { service: "deep", deepService: "carpet_upholstery" },
};
describe("booking wording suggestions", () => {
  it("shortens the service title while preserving every request detail without recalculating prices", () => {
    const result = bookingAgreementText(booking);
    expect(result.service).toBe("Carpet and upholstery cleaning");
    expect(result.items).toBe(booking.service);
    expect(result.scope).toContain("where suitable");
    expect(result.exclusions).toBe("");
    expect(result).not.toHaveProperty("totalPence");
    expect(result).not.toHaveProperty("changeReason");
  });
  it("does not overwrite saved custom wording or agreed amounts", () => {
    const existing = { service: "Custom clean", items: "Sofa only", scope: "Customer's own agreement", exclusions: "No access charges agreed", preparation: "", totalPence: 8500 };
    const result = fillMissingAgreementText(existing, booking);
    expect(result).toMatchObject({ ...existing, preparation: expect.stringContaining("small belongings") });
    expect(existing.preparation).toBe("");
  });
  it("does not turn a tailored tenancy request into an all-inclusive promise", () => {
    const result = bookingAgreementText({ ...booking, service: "Selected rooms only", quoteConfig: { service: "deep", deepService: "end_of_tenancy" } });
    expect(result.items).toBe("Selected rooms only");
    expect(result.scope).not.toMatch(/all|oven|guarantee|67-point|carpet extraction/i);
  });
  it("formats recognised requested windows and leaves flexible requests unassigned", () => {
    expect(requestedArrivalWindow("Morning (8am–12pm)")).toBe("08:00–12:00");
    expect(requestedArrivalWindow("Afternoon (12pm–5pm)")).toBe("12:00–17:00");
    expect(requestedArrivalWindow("Flexible")).toBe("");
    expect(requestedArrivalWindow("09:30–10:30")).toBe("09:30–10:30");
  });
});
