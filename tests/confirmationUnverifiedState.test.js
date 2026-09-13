import { beforeEach, describe, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { readFileSync } from 'node:fs';

const html = readFileSync('public/confirmation.html', 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const start = script.indexOf('function initVerifyUI');
const verification = script.slice(start, script.lastIndexOf('// ──', script.indexOf('Conversion tracking', start)));
let doc;
beforeEach(() => { doc = new DOMParser().parseFromString(html, 'text/html'); });
const node = (id) => doc.getElementById(id);
function verify(fetch) {
  const storage = { removeItem: vi.fn() };
  new Function('fetch', 'document', 'localStorage', 'apiQs', `${verification}; initVerifyUI();`)(fetch, doc, storage, (url) => `${url}?ref=TEST`);
  return storage;
}

describe('legacy payment confirmation display', () => {
  it('starts with a neutral visible heading and hidden success content, including without JavaScript', () => {
    expect(doc.title).toBe('Check your booking payment | VVE Clean');
    expect(node('payment-checking').style.display).not.toBe('none');
    expect(node('payment-checking').querySelector('h1').textContent).toBe('Checking your payment');
    expect(node('verified-content').style.display).toBe('none');
    expect(doc.querySelector('noscript').textContent).toMatch(/JavaScript is needed/);
    expect(doc.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(doc.querySelector('main#main-content')).not.toBeNull();
  });
  it('does not reveal success while verification is slow', () => {
    const fetch = vi.fn(() => new Promise(() => {}));
    verify(fetch);
    expect(node('payment-checking').style.display).not.toBe('none');
    expect(node('verified-content').style.display).toBe('none');
    expect(fetch).toHaveBeenCalledWith('/api/verify-payment?ref=TEST');
  });
  it.each([false, null, undefined, 'true'])('does not claim payment for an unverified paid value of %s', async (paid) => {
    const storage = verify(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ paid }) }));
    await waitFor(() => expect(node('payment-unverified').style.display).toBe(''));
    expect(node('verified-content').style.display).toBe('none');
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it.each(['network', 'http', 'json'])('shows useful recovery without success after a %s failure', async (failure) => {
    const fetch = failure === 'network' ? vi.fn().mockRejectedValue(new Error('offline'))
      : vi.fn().mockResolvedValue({ ok: failure !== 'http', json: async () => {
        if (failure === 'json') throw new Error('invalid JSON');
        return { paid: true };
      } });
    verify(fetch);
    await waitFor(() => expect(node('payment-unverified').style.display).toBe(''));
    expect(node('verified-content').style.display).toBe('none');
    expect(node('payment-unverified').querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });
  it('reveals payment only after a successful verified response and clears the draft', async () => {
    const storage = verify(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ paid: true }) }));
    await waitFor(() => expect(node('verified-content').style.display).toBe(''));
    expect(node('payment-checking').style.display).toBe('none');
    expect(node('payment-unverified').style.display).toBe('none');
    expect(storage.removeItem).toHaveBeenCalledWith('vve_form_draft_v1');
    expect(verification).not.toContain('gtag(');
  });
  it('shows recovery without a network call when the URL has no booking details', () => {
    const fetch = vi.fn();
    new Function('document', 'window', 'location', 'fetch', 'console', 'setTimeout', script)(doc, { vveProductionTrackingHost: false }, { search: '' }, fetch, { log: vi.fn(), warn: vi.fn(), error: vi.fn() }, vi.fn());
    expect(node('payment-checking').style.display).toBe('none');
    expect(node('verified-content').style.display).toBe('none');
    expect(node('unverified-state').style.display).toBe('');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not log the customer response or leave a placeholder support link', () => {
    expect(script).not.toContain('JSON.stringify(d)');
    expect(node('wa').getAttribute('href')).toBe('https://wa.me/447845451111');
  });
});


describe('legacy payment conversion stays separate from booking requests', () => {
  const conversion = script.slice(script.indexOf('(function () {', script.indexOf('Conversion tracking')));
  function runConversion(result) {
    const gtag = vi.fn();
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const fetch = vi.fn().mockResolvedValue({ status: 200, json: async () => result });
    new Function('window', 'location', 'localStorage', 'fetch', 'console', 'setTimeout', 'clearTimeout', 'gtag', 'ref', 'token', 'sid', 'apiQs', conversion)(
      { vveProductionTrackingHost: true, gtag }, { hostname: 'www.vveclean.co.uk' }, storage, fetch,
      { log: vi.fn(), warn: vi.fn(), error: vi.fn() }, vi.fn(), vi.fn(), gtag,
      'SYNTHETIC-LEGACY-ONLY', 'a'.repeat(64), '', url => url,
    );
    return { gtag, storage, fetch };
  }
  it.each([
    { paid: false, livemode: true, status: 'new' },
    { paid: false, livemode: true, status: 'confirmed' },
    { paid: true, livemode: false },
  ])('never counts an unpaid request/appointment or test payment: %j', async result => {
    const { gtag, storage, fetch } = runConversion(result);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gtag).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('preserves the historical verified live payment event', async () => {
    const { gtag } = runConversion({ paid: true, livemode: true });
    await waitFor(() => expect(gtag).toHaveBeenCalledOnce());
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({
      send_to: 'AW-18214693277/hUwdCK68gswcEJ3TuO1D',
      value: 30, currency: 'GBP', transaction_id: 'SYNTHETIC-LEGACY-ONLY',
    }));
  });
});
