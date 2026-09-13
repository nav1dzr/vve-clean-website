import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomepagePhotoCarousel from './HomepagePhotoCarousel';
import type { GalleryItem } from '../data/galleryMedia';

const { websiteMedia, serviceMedia } = vi.hoisted(() => ({ websiteMedia: vi.fn(), serviceMedia: vi.fn() }));
vi.mock('../lib/managedGalleryMedia', () => ({ useManagedWebsiteMedia: websiteMedia, useManagedServiceHeroMedia: serviceMedia }));

let reduced = false;
let motionListeners: Array<() => void>;
const advance = (milliseconds = 7000) => act(() => vi.advanceTimersByTime(milliseconds));
const carousel = () => screen.getByRole('region', { name: 'Cleaning photos' });
const currentPhoto = () => within(carousel()).getByRole('img');

beforeEach(() => {
  vi.useFakeTimers();
  websiteMedia.mockReset().mockReturnValue(null);
  serviceMedia.mockReset().mockReturnValue(null);
  reduced = false;
  motionListeners = [];
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    media, get matches() { return reduced; }, onchange: null,
    addEventListener: (_type: string, listener: () => void) => motionListeners.push(listener),
    removeEventListener: (_type: string, listener: () => void) => { motionListeners = motionListeners.filter(item => item !== listener); },
  })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('homepage cleaning photo carousel', () => {
  it('shows one real photo at a time, rotates all three every seven seconds and keeps matching gallery links', () => {
    render(<HomepagePhotoCarousel />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    advance(6999);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    advance(1);
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    expect(screen.getByRole('link', { name: 'See our upholstery cleaning results' })).toHaveAttribute('href', '/gallery?category=sofa-upholstery');
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
    expect(screen.getByRole('link', { name: 'See our end of tenancy results' })).toHaveAttribute('href', '/gallery?category=end-of-tenancy');
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('supports previous, next and direct selection, pausing after a visitor chooses a photo', () => {
    render(<HomepagePhotoCarousel />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous cleaning photo' }));
    expect(screen.getByRole('button', { name: 'Show end of tenancy photo' })).toHaveAttribute('aria-current', 'true');
    advance(21000);
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next cleaning photo' }));
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Show sofa & upholstery photo' }));
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
  });

  it('pauses while hovered or focused and while the page is hidden', () => {
    render(<HomepagePhotoCarousel />);
    fireEvent.mouseEnter(carousel());
    advance(14000);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    fireEvent.mouseLeave(carousel());
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    const next = screen.getByRole('button', { name: 'Next cleaning photo' });
    fireEvent.focus(next);
    advance(14000);
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    fireEvent.blur(next, { relatedTarget: document.body });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    advance(14000);
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
  });

  it('has a persistent pause control, separate from temporary hover or focus pauses', () => {
    render(<HomepagePhotoCarousel />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    fireEvent.mouseEnter(carousel());
    fireEvent.mouseLeave(carousel());
    advance(14000);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
  });

  it('never rotates automatically under reduced motion, including when the preference changes during a visit', () => {
    reduced = true;
    render(<HomepagePhotoCarousel />);
    advance(21000);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    expect(screen.queryByRole('button', { name: /slideshow/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next cleaning photo' }), { key: 'ArrowRight' });
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    act(() => { reduced = false; motionListeners.forEach(listener => listener()); });
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance();
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
    act(() => { reduced = true; motionListeners.forEach(listener => listener()); });
    advance(21000);
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
  });

  it('changes photo for a deliberate horizontal swipe without cancelling vertical scrolling or pinch gestures', () => {
    render(<HomepagePhotoCarousel />);
    const slide = screen.getByRole('group', { name: /1 of 3: Carpet cleaning/ });
    fireEvent.touchStart(slide, { touches: [{ clientX: 200, clientY: 100 }] });
    const verticalEnd = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperty(verticalEnd, 'changedTouches', { value: [{ clientX: 150, clientY: 300 }] });
    fireEvent(slide, verticalEnd);
    expect(verticalEnd.defaultPrevented).toBe(false);
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    fireEvent.touchStart(slide, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(slide, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    const sofaSlide = screen.getByRole('group', { name: /2 of 3: Sofa/ });
    fireEvent.touchStart(sofaSlide, { touches: [{ clientX: 100, clientY: 110 }] });
    fireEvent.touchMove(sofaSlide, { touches: [{ clientX: 100, clientY: 110 }, { clientX: 190, clientY: 130 }] });
    fireEvent.touchEnd(sofaSlide, { changedTouches: [{ clientX: 200, clientY: 110 }] });
    expect(currentPhoto()).toHaveAttribute('src', '/sofa_upholstery/web/gallery/sofa-gallery-01.webp');
    fireEvent.touchStart(sofaSlide, { touches: [{ clientX: 100, clientY: 110 }] });
    fireEvent.touchEnd(sofaSlide, { changedTouches: [{ clientX: 200, clientY: 100 }] });
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
  });

  it('keeps managed slots, captions and responsive images, and uses truthful fallbacks when a managed photo fails', () => {
    const managed: GalleryItem = { type: 'photo', id: 'managed-home', src: 'https://media.example/home.webp', srcSet: 'https://media.example/home-small.webp 600w', alt: 'Published homepage photograph', label: 'Published homepage caption' };
    websiteMedia.mockReturnValue(managed);
    const view = render(<HomepagePhotoCarousel />);
    expect(websiteMedia).toHaveBeenCalledWith('homepage-hero-image');
    expect(serviceMedia).toHaveBeenCalledWith('sofa-upholstery');
    expect(serviceMedia).toHaveBeenCalledWith('end-of-tenancy');
    expect(currentPhoto()).toHaveAttribute('srcset', managed.srcSet);
    fireEvent.error(currentPhoto());
    expect(currentPhoto()).toHaveAttribute('src', '/images/carpet-cleaning-hero.webp');
    expect(screen.getByText('Carpet extraction in progress')).toBeInTheDocument();
    expect(screen.queryByText('Published homepage caption')).not.toBeInTheDocument();
    websiteMedia.mockReturnValue({ ...managed, src: 'https://media.example/replacement.webp' });
    view.rerender(<HomepagePhotoCarousel />);
    expect(currentPhoto()).toHaveAttribute('src', 'https://media.example/replacement.webp');
  });

  it('uses the published after-photo of a complete service pair and keeps videos out of the hero', () => {
    serviceMedia.mockImplementation((service: string) => service === 'sofa-upholstery' ? {
      type: 'before-after', id: 'sofa-pair', label: 'Published sofa result', before: '/before.webp', after: '/after.webp', beforeAlt: 'Before cleaning', afterAlt: 'Published sofa after cleaning',
    } : { type: 'video', id: 'eot-clip', src: '/clip.mp4', poster: '/clip.webp', label: 'Cleaning clip' });
    render(<HomepagePhotoCarousel />);
    fireEvent.click(screen.getByRole('button', { name: 'Show sofa & upholstery photo' }));
    expect(currentPhoto()).toHaveAttribute('src', '/after.webp');
    expect(currentPhoto()).toHaveAttribute('alt', 'Published sofa after cleaning');
    fireEvent.click(screen.getByRole('button', { name: 'Show end of tenancy photo' }));
    expect(currentPhoto()).toHaveAttribute('src', '/end_of_tenancy/before-after/kitchen1_after.jpg');
    expect(document.querySelector('video,iframe')).not.toBeInTheDocument();
  });
});
