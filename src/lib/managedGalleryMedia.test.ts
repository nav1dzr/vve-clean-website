import { describe, expect, it } from "vitest";
import {
  referenceToItem,
  selectServiceHeroMedia,
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

describe('named service hero positions', () => {
  const photo = (key: string, order: number, pageKey = 'carpet-main-results'): PublishedReference => ({
    ...row('after'), reference_key: key, page_key: pageKey, sort_order: order,
    slot_kind: 'photo', media_role: 'primary', delivery_url: `https://media.example/${key}.jpg`,
  });

  it('uses stable published order, with a reference-key tie break, regardless of response order', () => {
    const item = selectServiceHeroMedia([photo('later', 2), photo('b', 1), photo('a', 1)], 'carpet');
    expect(item).toMatchObject({ type: 'photo', src: 'https://media.example/a.jpg' });
  });

  it('uses the first gallery assignment only when there is no service-results assignment', () => {
    const gallery = photo('gallery-first', 1, 'gallery-carpet');
    expect(selectServiceHeroMedia([gallery], 'carpet')).toMatchObject({ src: gallery.delivery_url });
    expect(selectServiceHeroMedia([gallery, photo('service-first', 9)], 'carpet')).toMatchObject({ src: 'https://media.example/service-first.jpg' });
  });

  it('does not promote another position or gallery photo when position one is an incomplete pair', () => {
    const incomplete = { ...row('before'), page_key: 'carpet-main-results' };
    expect(selectServiceHeroMedia([incomplete, photo('later', 2), photo('gallery', 1, 'gallery-carpet')], 'carpet')).toBeNull();
  });
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
