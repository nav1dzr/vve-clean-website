import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishRequestNotifications } from '../../api/_lib/requestNotificationBackground.js';

const contextKey = Symbol.for('@vercel/request-context');
afterEach(() => { delete globalThis[contextKey]; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('durable request notification continuation', () => {
  it('registers the unfinished delivery with the host without delaying acknowledgement', async () => {
    vi.stubEnv('VERCEL', '1');
    let resolve;
    const delivery = new Promise(done => { resolve = done; });
    const waitUntil = vi.fn();
    globalThis[contextKey] = { get: () => ({ waitUntil }) };
    await finishRequestNotifications(delivery);
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(delivery);
    resolve();
    await delivery;
  });

  it.each(['', '1'])('awaits delivery without a registered host hook (VERCEL=%s)', async vercel => {
    vi.stubEnv('VERCEL', vercel);
    let resolve;
    const delivery = new Promise(done => { resolve = done; });
    let completed = false;
    const attempt = finishRequestNotifications(delivery).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    resolve();
    await attempt;
    expect(completed).toBe(true);
  });

  it('awaits the same delivery if host registration fails, without a duplicate send', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const waitUntil = vi.fn(() => { throw new Error('host unavailable'); });
    globalThis[contextKey] = { get: () => ({ waitUntil }) };
    let resolve;
    const delivery = new Promise(done => { resolve = done; });
    let completed = false;
    const attempt = finishRequestNotifications(delivery).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(delivery);
    resolve();
    await attempt;
    expect(completed).toBe(true);
  });
});
