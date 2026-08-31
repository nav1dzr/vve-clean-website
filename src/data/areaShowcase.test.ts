import { describe, expect, it } from 'vitest';
import { selectAreaShowcaseVideos } from './areaShowcase';

describe('area-page media selection', () => {
  it('shows two real clips from different services', () => {
    const clips = selectAreaShowcaseVideos('islington', '2026-08-31');
    expect(clips).toHaveLength(2);
    expect(new Set(clips.map((clip) => clip.service)).size).toBe(2);
    for (const clip of clips) {
      expect(clip.src).toMatch(/\.mp4$/);
      expect(clip.poster).toMatch(/\.(jpg|webp)$/);
      expect(clip.description.length).toBeGreaterThan(20);
    }
  });

  it('is stable within a date and rotates across area/date seeds', () => {
    expect(selectAreaShowcaseVideos('hackney', '2026-08-31'))
      .toEqual(selectAreaShowcaseVideos('hackney', '2026-08-31'));

    const combinations = new Set(
      ['islington', 'camden', 'hackney', 'stratford', 'walthamstow'].flatMap((area) =>
        ['2026-08-31', '2026-09-01', '2026-09-02'].map((date) =>
          selectAreaShowcaseVideos(area, date).map((clip) => clip.id).join('|'),
        ),
      ),
    );
    expect(combinations.size).toBeGreaterThan(2);
  });
});
