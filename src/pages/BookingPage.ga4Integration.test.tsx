import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import * as ga4Context from '../lib/ga4Context';
import { CONSENT_STORAGE_KEY } from '../lib/consent';
import { CONSENT_VERSION } from '../lib/consentVersion';
import { clearSubmissionIdentity } from '../lib/submissionIdentity';

// This suite controls request/payment measurement responses, not the optional
// public rating refresh. Keep its lost-response fixture scoped to booking POSTs.
vi.mock('../hooks/useGoogleRating', () => ({ useGoogleRating: () => null }));

const selection = {
  serviceName: 'Carpet cleaning', price: 100,
  quoteConfig: { service: 'deep', deepService: 'carpet_upholstery', deepSize: 'bed2', deepBaths: 1, addOnCounts: {}, carpetCounts: { bedroom: 2 }, windowSize: 'small', gutterType: 'terraced', officeHours: 2 },
};
const requestId = '61f846e8-5f0e-4dab-a2bd-10d14692aef3';
const savedResponse = () => ({ ok: true, json: async () => ({ ok: true, bookingRef: 'VVE-TEST-GA4-RETRY', requestId, total: 100 }) });

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearSubmissionIdentity('booking');
  window.history.replaceState({}, '', '/booking');
  sessionStorage.setItem('vve_booking', JSON.stringify(selection));
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    version: CONSENT_VERSION, analytics: true, advertising: false,
    choice: 'custom', timestamp: new Date().toISOString(),
  }));
  vi.stubEnv('VITE_GA4_BOOKING_MEASUREMENT_ENABLED', 'true');
  vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  clearSubmissionIdentity('booking');
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  render(<MemoryRouter initialEntries={['/booking']}><BookingPage /></MemoryRouter>);
  await user.type(screen.getByLabelText(/full name/i), 'Test Customer');
  await user.type(screen.getByLabelText(/^address/i), '12 Test Street');
  await user.type(screen.getByLabelText(/postcode/i), 'E8 1AA');
  await user.type(screen.getByLabelText(/phone number/i), '07700900000');
  await user.type(screen.getByLabelText(/email address/i), 'test@example.test');
  const day = new Date(); day.setDate(day.getDate() + 30);
  const future = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
  await user.type(screen.getByLabelText(/preferred date/i), future);
  await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
  await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
  await user.click(screen.getAllByRole('button', { name: 'No' })[1]);
}
const send = () => screen.getByRole('button', { name: /^Send request — no payment$/ });

describe('optional GA4 context never controls booking acceptance or retry identity', () => {
  it('reuses the request key after a lost response even when GA4 session and capture time change', async () => {
    const first: ga4Context.Ga4BookingContext = {
      measurement_id: 'G-TEST123', client_id: '123.456', session_id: '100',
      captured_at: '2026-10-04T10:00:00.000Z', consent_version: CONSENT_VERSION,
      consent_recorded_at: '2026-10-04T09:00:00.000Z', analytics: true, advertising: false,
    };
    const second = { ...first, session_id: '101', captured_at: '2026-10-04T10:01:00.000Z' };
    vi.spyOn(ga4Context, 'getGa4BookingContext').mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(savedResponse());
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup(); await fillForm(user);
    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    await user.click(send());
    expect(await screen.findByText('VVE-TEST-GA4-RETRY')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    const attempts = fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(attempts[0].ga4_context).toEqual(first);
    expect(attempts[1].ga4_context).toEqual(second);
    expect(attempts[0].requestKey).toMatch(/^[a-f0-9-]{36}$/i);
    expect(attempts[1].requestKey).toBe(attempts[0].requestKey);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['missing', 'throwing function', 'throwing accessor'] as const)('still saves the request with a %s Google tag', async mode => {
    const fetch = vi.fn().mockResolvedValue(savedResponse());
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup(); await fillForm(user);
    vi.stubGlobal('gtag', mode === 'throwing function' ? vi.fn(() => { throw new Error('Tag blocked'); }) : undefined);
    if (mode === 'throwing accessor') {
      Object.defineProperty(window, 'gtag', { configurable: true, get: () => { throw new Error('Tag accessor blocked'); } });
    }
    await user.click(send());
    expect(await screen.findByText('VVE-TEST-GA4-RETRY')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('ga4_context');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
