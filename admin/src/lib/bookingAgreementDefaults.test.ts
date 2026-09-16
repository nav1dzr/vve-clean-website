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
    const existing = { service: "Custom clean", items: "Sofa only", scope: "Customer's own agreement", exclusions: "No access charges agreed", accessNotes: "Parking permit arranged by customer", preparation: "", totalPence: 8500 };
    const result = fillMissingAgreementText(existing, booking);
    expect(result).toMatchObject({ ...existing, preparation: expect.stringContaining("small belongings") });
    expect(existing.preparation).toBe("");
  });
  it("does not turn a tailored tenancy request into an all-inclusive promise", () => {
    const result = bookingAgreementText({ ...booking, service: "Selected rooms only", quoteConfig: { service: "deep", deepService: "end_of_tenancy" } });
    expect(result.items).toBe("Selected rooms only");
    expect(result.scope).not.toMatch(/all|oven|guarantee|67-point|carpet extraction/i);
  });
  it("separates explicit parking and congestion lines without losing quantities or customer conditions", () => {
    const result = bookingAgreementText({
      service: "Carpet cleaning\n2 × bedrooms\nHeavy marks near door\nParking: permit arranged — £0\nCongestion Charge zone — +£18 pass-through Congestion Charge\nAvoid the cupboard",
      quoteConfig: booking.quoteConfig,
    });
    expect(result.items).toBe("Carpet cleaning\n2 × bedrooms\nHeavy marks near door\nAvoid the cupboard");
    expect(result.accessNotes).toBe("Parking: permit arranged — £0\nCongestion Charge zone — +£18 pass-through Congestion Charge");
    expect(result).not.toHaveProperty("totalPence");
  });
  it("adds only the known Tailored package tasks while keeping selected extras", () => {
    const result = bookingAgreementText({
      service: "End of tenancy (Tailored Checklist Clean) — Studio, 1 bathroom\nInside oven (included free)\n1 × Exterior windows\nParking: free parking available — £0",
      quoteConfig: { service: "deep", deepService: "end_of_tenancy", eotPackage: "tailored" },
    });
    expect(result.items).toContain("1 × Exterior windows");
    expect(result.items).toContain("Kitchen and bathroom surfaces");
    expect(result.items).toContain("Hob, grill and extractor");
    expect(result.items).toContain("Standard vacuuming and suitable hard-floor mopping");
    expect(result.items).not.toMatch(/microwave|fridge|dishwasher|cupboards|67-point|guarantee/i);
    expect(result.items.match(/oven/gi)).toHaveLength(1);
    expect(result.accessNotes).toBe("Parking: free parking available — £0");
    expect(result.scope).toBe("");
  });
  it("uses published appliance and storage tasks only for explicitly selected Complete", () => {
    const result = bookingAgreementText({
      service: "End of tenancy Complete — 2 bedrooms, 1 bathroom",
      quoteConfig: { service: "deep", deepService: "end_of_tenancy", eotPackage: "complete" },
    });
    expect(result.items).toContain("emptied fridge/freezer");
    expect(result.items).toContain("Empty cupboards, drawers and wardrobes");
    expect(result.items).toContain("accessible internal windows");
    expect(result.items).not.toMatch(/carpet steam|exterior windows|rubbish|guarantee/i);
  });
  it("does not infer a package from a service title or replace an existing cleaning list", () => {
    const withoutPackage = { service: "Complete clean — selected rooms only", quoteConfig: { service: "deep", deepService: "end_of_tenancy" } };
    expect(bookingAgreementText(withoutPackage).items).toBe(withoutPackage.service);
    const existing = { service: "Adjusted clean", items: "Kitchen surfaces only", scope: "No bedrooms", exclusions: "Oven not booked", accessNotes: "Customer permit", preparation: "", totalPence: 13000 };
    expect(fillMissingAgreementText(existing, { ...withoutPackage, quoteConfig: { ...withoutPackage.quoteConfig, eotPackage: "complete" } })).toMatchObject({ ...existing, preparation: expect.any(String) });
  });
  it("formats recognised requested windows and leaves flexible requests unassigned", () => {
    expect(requestedArrivalWindow("Morning (8am–12pm)")).toBe("08:00–12:00");
    expect(requestedArrivalWindow("Afternoon (12pm–5pm)")).toBe("12:00–17:00");
    expect(requestedArrivalWindow("Flexible")).toBe("");
    expect(requestedArrivalWindow("09:30–10:30")).toBe("09:30–10:30");
  });
});
