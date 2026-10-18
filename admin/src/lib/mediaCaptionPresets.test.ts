import { describe, expect, it } from "vitest";
import { mediaCaptionPresets } from "./mediaCaptionPresets";
import type { BeforeAfter, MediaCategory, MediaType } from "../types/media";

describe("media caption starters", () => {
  it("provides ready-to-use wording from the selected service, stage and file type", () => {
    expect(mediaCaptionPresets("carpet", "before", "image")[0]).toMatchObject({
      title: "Carpet before cleaning",
      altText: "Before-cleaning photo from our carpet cleaning work.",
    });
    const video = mediaCaptionPresets("sofa-upholstery", "during", "video");
    expect(video.every((item) => /video/i.test(item.altText))).toBe(true);
    expect(video.every((item) => /during/i.test(item.title + item.altText))).toBe(true);
    expect(mediaCaptionPresets("end-of-tenancy", "after", "image")[0].title).toBe("After the end-of-tenancy clean");
  });

  it("does not assign a cleaning stage to general media", () => {
    const general = mediaCaptionPresets("carpet", "none", "image");
    for (const item of general) {
      expect(item.title + item.altText).not.toMatch(/before|after|during|in progress/i);
    }
  });

  it("keeps all suggestions within existing field limits without invented details", () => {
    for (const category of ["carpet", "sofa-upholstery", "end-of-tenancy"] as MediaCategory[]) {
      for (const stage of ["none", "before", "during", "after"] as BeforeAfter[]) {
        for (const type of ["image", "video"] as MediaType[]) {
          const suggestions = mediaCaptionPresets(category, stage, type);
          expect(new Set(suggestions.map((item) => item.id)).size).toBe(3);
          for (const item of suggestions) {
            expect(item.title.length).toBeGreaterThan(0);
            expect(item.title.length).toBeLessThanOrEqual(120);
            expect(item.altText.length).toBeGreaterThan(0);
            expect(item.altText.length).toBeLessThanOrEqual(300);
            expect(item.title + item.altText).not.toMatch(/\[|\]|London|stain|spotless|restored|wool|leather|extraction|guarantee/i);
          }
        }
      }
    }
  });
});
