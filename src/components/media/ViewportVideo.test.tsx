import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LazyVideo from './LazyVideo';
import ManagedVideo from './ManagedVideo';
import { suspendViewportVideos } from './useViewportVideo';

const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit; target?: Element }> = [];
let reduced = false;
let motionChange: (() => void) | undefined;
let connection: EventTarget & { saveData: boolean; effectiveType: string };
let hidden = false;

async function visible(element: Element, value: boolean, ratio = 1) {
  await act(async () => {
    observers.filter((observer) => observer.target === element && observer.options?.threshold).forEach(({ callback }) => {
      callback([{ isIntersecting: value, intersectionRatio: value ? ratio : 0, target: element } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  });
}
function near(element: Element, value = true) {
  act(() => {
    observers.filter((observer) => observer.target === element && observer.options?.rootMargin).forEach(({ callback }) => {
      callback([{ isIntersecting: value, target: element } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  });
}
function clip(name: string) {
  return <LazyVideo video={{ src: `/${name}.mp4`, poster: `/${name}.jpg`, description: name }} className="aspect-video" />;
}
function stage(name: string) { return screen.getByLabelText(name, { selector: 'video' }).parentElement!; }

beforeEach(() => {
  observers.length = 0;
  reduced = false;
  hidden = false;
  connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' });
  vi.stubGlobal('IntersectionObserver', class {
    entry: typeof observers[number];
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.entry = { callback, options }; observers.push(this.entry);
    }
    observe(target: Element) { this.entry.target = target; }
    disconnect() { this.entry.target = undefined; }
  });
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, handler: () => void) => { motionChange = handler; },
    removeEventListener: () => {},
  })));
  Object.defineProperty(navigator, 'connection', { configurable: true, get: () => connection });
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
});
afterEach(async () => {
  await act(async () => { cleanup(); });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { connection?: unknown }).connection;
});

describe('viewport video budget and visitor controls', () => {
  it('keeps posters and controls available with no video sources on initial render', async () => {
    const { container } = render(<>{clip('first')}{clip('second')}</>);
    expect(container.querySelectorAll('video source')).toHaveLength(0);
    for (const video of container.querySelectorAll('video')) {
      expect(video).toHaveAttribute('poster');
      expect(video).toHaveAttribute('controls');
      expect(video).not.toHaveAttribute('autoplay');
    }
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('prepares only one nearby clip and plays only one visible clip at a time', async () => {
    const { container } = render(<>{clip('first')}{clip('second')}{clip('third')}</>);
    near(stage('first')); near(stage('second')); near(stage('third'));
    expect(container.querySelectorAll('source')).toHaveLength(1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    await visible(stage('first'), true);
    await visible(stage('second'), true);
    await waitFor(() => expect(container.querySelectorAll('video[autoplay]')).toHaveLength(1));
    expect(screen.getByLabelText('first', { selector: 'video' })).toHaveAttribute('autoplay');
    expect(container.querySelectorAll('source')).toHaveLength(2);
    await visible(stage('first'), false);
    expect(screen.getByLabelText('first', { selector: 'video' })).not.toHaveAttribute('autoplay');
    expect(screen.getByLabelText('second', { selector: 'video' })).toHaveAttribute('autoplay');
  });

  it('does not autoplay a sliver of a clip or a clip in the preload margin', async () => {
    render(clip('first'));
    near(stage('first'));
    await visible(stage('first'), true, 0.1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it.each(['reduced motion', 'save data', 'slow connection'])('requires a gesture under %s', async (preference) => {
    if (preference === 'reduced motion') reduced = true;
    if (preference === 'save data') connection.saveData = true;
    if (preference === 'slow connection') connection.effectiveType = '2g';
    const { container } = render(clip('first'));
    near(stage('first')); await visible(stage('first'), true);
    expect(container.querySelector('source')).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Play first' }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(container.querySelector('source')).toHaveAttribute('src', '/first.mp4');
    expect(container.querySelector('video')).not.toHaveAttribute('autoplay');
  });

  it('stops and unloads when the tab is hidden, then previews again when visible', async () => {
    const { container } = render(clip('first'));
    await visible(stage('first'), true);
    hidden = true;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(container.querySelector('source')).toBeNull();
    expect(container.querySelector('video')).not.toHaveAttribute('autoplay');
    hidden = false;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(container.querySelector('video')).toHaveAttribute('autoplay');
  });

  it('stops when reduced motion is enabled while browsing', async () => {
    const { container } = render(clip('first'));
    await visible(stage('first'), true);
    reduced = true;
    await act(async () => { motionChange?.(); });
    expect(container.querySelector('source')).toBeNull();
    expect(container.querySelector('video')).not.toHaveAttribute('autoplay');
  });

  it('keeps a working play control when the browser refuses autoplay', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    render(clip('first'));
    await visible(stage('first'), true);
    await screen.findByText('Tap to play');
    fireEvent.click(screen.getByRole('button', { name: 'Play first' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play first' })).not.toBeInTheDocument());
  });

  it('respects a native pause instead of restarting on the next observer callback', async () => {
    render(clip('first'));
    await visible(stage('first'), true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play first' })).not.toBeInTheDocument());
    fireEvent.pause(screen.getByLabelText('first', { selector: 'video' }));
    await visible(stage('first'), true);
    expect(screen.getByRole('button', { name: 'Play first' })).toBeInTheDocument();
    expect(screen.getByLabelText('first', { selector: 'video' })).not.toHaveAttribute('autoplay');
  });

  it('supports manual playback when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(clip('first'));
    expect(container.querySelector('source')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play first' }));
    expect(container.querySelector('source')).toHaveAttribute('src', '/first.mp4');
  });

  it('stops native and hosted players behind a photo dialog', async () => {
    const { container } = render(<>{clip('first')}<ManagedVideo title="Hosted" playerUrl="https://player.mux.com/test" /></>);
    await visible(stage('first'), true);
    let resume!: () => void;
    act(() => { resume = suspendViewportVideos(); });
    expect(container.querySelector('source, iframe')).toBeNull();
    await act(async () => { resume(); });
    expect(container.querySelector('video')).toHaveAttribute('autoplay');
  });

  it('shares the playback budget with Mux and removes its iframe offscreen', async () => {
    const { container } = render(<>{clip('first')}<ManagedVideo title="Hosted" playerUrl="https://player.mux.com/test" /></>);
    const hostedStage = screen.getByRole('button', { name: 'Play Hosted' }).parentElement!;
    await visible(stage('first'), true);
    await visible(hostedStage, true);
    expect(container.querySelector('iframe')).toBeNull();
    await visible(stage('first'), false);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Hosted' }));
    const url = new URL(screen.getByTitle('Hosted').getAttribute('src')!);
    expect(url.searchParams.get('autoplay')).toBe('muted');
    expect(url.searchParams.get('muted')).toBe('true');
    expect(screen.getByLabelText('first', { selector: 'video' })).not.toHaveAttribute('autoplay');
    await visible(hostedStage, false);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: 'Play Hosted' })).toBeInTheDocument();
    await visible(hostedStage, true);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('retains native pause position within the two-source budget and restores it after unloading', async () => {
    const { container } = render(<>{clip('first')}{clip('second')}{clip('third')}</>);
    near(stage('first')); near(stage('second')); near(stage('third'));
    await visible(stage('first'), true);
    const video = screen.getByLabelText('first', { selector: 'video' }) as HTMLVideoElement;
    let ready = 4;
    Object.defineProperty(video, 'readyState', { configurable: true, get: () => ready });
    Object.defineProperty(video, 'currentSrc', { configurable: true, get: () => '/first.mp4' });
    vi.mocked(HTMLMediaElement.prototype.load).mockImplementation(function (this: HTMLMediaElement) {
      this.currentTime = 0;
      if (this === video) ready = 0;
    });
    video.currentTime = 4.25;
    fireEvent.timeUpdate(video);
    const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
    fireEvent.pause(video);
    expect(video.querySelector('source')).toHaveAttribute('src', '/first.mp4');
    expect(video.currentTime).toBe(4.25);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
    expect(container.querySelectorAll('source')).toHaveLength(2);
    expect(container.querySelector('video[autoplay]')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play first' })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play first' })).not.toBeInTheDocument());
    expect(video.currentTime).toBe(4.25);
    fireEvent.pause(video);
    near(stage('first'), false);
    await visible(stage('first'), false);
    expect(video.querySelector('source')).toBeNull();
    expect(video.currentTime).toBe(0);
    await visible(stage('first'), true);
    expect(video.querySelector('source')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play first' })); });
    ready = 4;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(4.25);
  });

  it.each(['hidden tab', 'photo dialog'])('requires a fresh hosted Play after %s, preserving iframe pause intent', async (reason) => {
    const { container } = render(<ManagedVideo title="Hosted" playerUrl="https://player.mux.com/test" />);
    const hostedStage = screen.getByRole('button', { name: 'Play Hosted' }).parentElement!;
    await visible(hostedStage, true);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Hosted' }));
    expect(container.querySelector('iframe')).not.toBeNull();
    if (reason === 'hidden tab') {
      hidden = true;
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      hidden = false;
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    } else {
      let resume!: () => void;
      act(() => { resume = suspendViewportVideos(); });
      await act(async () => { resume(); });
    }
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: 'Play Hosted' })).toBeInTheDocument();
  });
});
