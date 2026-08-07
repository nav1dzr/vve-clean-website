import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RecentJobsByArea, { collectAreaJobs } from './RecentJobsByArea';
import type { GalleryPhotoItem, GalleryBeforeAfterItem } from '../../data/galleryMedia';
import type { CarpetVideo } from '../../data/carpetMedia';

describe('collectAreaJobs', () => {
  it('returns nothing when no item carries a location at all', () => {
    const items: GalleryPhotoItem[] = [
      { type: 'photo', id: '1', label: 'Test', src: '/a.jpg', alt: 'a photo' },
    ];
    expect(collectAreaJobs('Islington', ['N1'], items, [])).toHaveLength(0);
  });

  it('returns nothing when a location is set but does not match this area', () => {
    const items: GalleryPhotoItem[] = [
      { type: 'photo', id: '1', label: 'Test', src: '/a.jpg', alt: 'a photo', location: 'Stratford, E15' },
    ];
    expect(collectAreaJobs('Islington', ['N1'], items, [])).toHaveLength(0);
  });

  it('matches on the area name, case-insensitively', () => {
    const items: GalleryPhotoItem[] = [
      { type: 'photo', id: '1', label: 'Test', src: '/a.jpg', alt: 'a photo', location: 'islington, N1' },
    ];
    expect(collectAreaJobs('Islington', ['N1'], items, [])).toHaveLength(1);
  });

  it('matches on a postcode alone', () => {
    const items: GalleryBeforeAfterItem[] = [
      {
        type: 'before-after', id: 'ba-1', label: 'Living room carpet',
        before: '/b.jpg', after: '/a.jpg', beforeAlt: 'before', afterAlt: 'after',
        location: 'N1 postcode job',
      },
    ];
    expect(collectAreaJobs('Islington', ['N1'], items, [])).toHaveLength(1);
  });

  it('includes carpet clips tagged with a matching location', () => {
    const clip: CarpetVideo = {
      id: 'clip-1', label: 'Stair clean', src: '/v.mp4', poster: '/p.jpg',
      description: 'A stair carpet being cleaned', location: 'Islington, N1',
    };
    const matches = collectAreaJobs('Islington', ['N1'], [], [clip]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ type: 'video', id: 'clip-1' });
  });
});

describe('RecentJobsByArea', () => {
  it('renders nothing for a real area today, since no live manifest item is tagged yet', () => {
    // Uses the real, unmocked manifests. This is the regression guard for the
    // "never fabricate proof" rule: it must stay true until a real photo is
    // actually tagged with a location, at which point this test is expected
    // to start failing for Islington and should be updated, not loosened.
    const { container } = render(<RecentJobsByArea areaName="Islington" postcodes={['N1']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
