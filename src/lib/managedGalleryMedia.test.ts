import { describe, expect, it } from "vitest";
import {
  referenceToItem,
  type PublishedReference,
} from "./managedGalleryMedia";
const row = (role: "before" | "after"): PublishedReference => ({
  reference_key: "carpet-one",
  page_key: "carpet-page",
  page_label: "Carpet",
  component_label: "First comparison",
  sort_order: 1,
  source_type: "gallery",
  topic_key: "carpet",
  slot_code: "BA01",
  slot_kind: "before_after",
  media_role: role,
  media_type: "image",
  title: "Carpet cleaning",
  alt_text: `${role} cleaning`,
  delivery_url: `https://media.example/image/{width}/${role}.jpg`,
  mux_playback_id: null,
});
describe("managed comparisons", () => {
  it("never renders a half-pair", () => {
    expect(referenceToItem([row("before")])).toBeNull();
  });
  it("preserves both photos and their descriptions as one item", () => {
    const item = referenceToItem([row("after"), row("before")]);
    expect(item?.type).toBe("before-after");
    expect(item).toMatchObject({
      before: "https://media.example/image/1200/before.jpg",
      after: "https://media.example/image/1200/after.jpg",
      beforeAlt: "before cleaning",
      afterAlt: "after cleaning",
    });
  });
});
