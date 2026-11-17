import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { CookieConsentProvider, useCookieConsent } from '../context/CookieConsentContext';
import CampaignAttribution from '../components/CampaignAttribution';
import { getAttribution, resetAttributionMemory } from '../lib/attribution';
import { saveConsent, ACCEPT_ALL_CATEGORIES, REJECT_OPTIONAL_CATEGORIES, CONSENT_STORAGE_KEY } from '../lib/consent';
import { CONSENT_VERSION } from '../lib/consentVersion';
const payload = getAttribution;
function apiEligible(p: Pick<ReturnType<typeof getAttribution>, 'measurement_consent'>) { const c = p.measurement_consent; return c.advertising === true && c.version === CONSENT_VERSION && typeof c.recorded_at === 'string' && Number.isFinite(Date.parse(c.recorded_at)); }
let context!: ReturnType<typeof useCookieConsent>;
function Probe() { context = useCookieConsent(); return <><output data-testid="state">{JSON.stringify(context.categories)}</output><Link to="/pricing">Quote</Link><Link to="/booking">Booking</Link></>; }
function mount() { return render(<MemoryRouter initialEntries={['/sofa-cleaning-london']}><CookieConsentProvider><CampaignAttribution /><Probe /></CookieConsentProvider></MemoryRouter>); }
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); resetAttributionMemory(); window.history.replaceState({}, '', '/sofa-cleaning-london?gclid=OFFLINE_ONLY_FIXTURE'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); cleanup(); });
describe('consent record consistency', () => {
    it('default remains ineligible with no click ID', () => { mount(); expect(payload().measurement_consent.advertising).toBe(false); expect(payload().gclid).toBeNull(); });
    it('Accept all produces eligible coherent payload', () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'Accept all' })); expect(context.categories.advertising).toBe(true); expect(apiEligible(payload())).toBe(true); expect(payload().gclid).toBe('OFFLINE_ONLY_FIXTURE'); });
    it('Reject optional remains ineligible', () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'Reject optional' })); expect(apiEligible(payload())).toBe(false); expect(payload().measurement_consent.advertising).toBe(false); expect(payload().gclid).toBeNull(); });
    it('analytics-only remains ineligible', () => { mount(); act(() => context.saveChoices({ analytics: true, advertising: false })); expect(apiEligible(payload())).toBe(false); expect(payload().gclid).toBeNull(); });
    it('restores returning accepted preferences', () => { saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all'); mount(); expect(apiEligible(payload())).toBe(true); expect(payload().gclid).toBe('OFFLINE_ONLY_FIXTURE'); });
    it('restores returning rejection', () => { saveConsent(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional'); mount(); expect(context.decided).toBe(true); expect(apiEligible(payload())).toBe(false); });
    it('late acceptance after router navigation preserves entry and payload consent', () => { mount(); fireEvent.click(screen.getByText('Quote')); fireEvent.click(screen.getByText('Booking')); fireEvent.click(screen.getByRole('button', { name: 'Accept all' })); expect(apiEligible(payload())).toBe(true); expect(payload().gclid).toBe('OFFLINE_ONLY_FIXTURE'); expect(payload().landing_page).toBe('/sofa-cleaning-london'); });
    it('corrupt stored JSON prompts again and acceptance repairs payload', () => { localStorage.setItem(CONSENT_STORAGE_KEY, '{broken'); mount(); expect(apiEligible(payload())).toBe(false); fireEvent.click(screen.getByRole('button', { name: 'Accept all' })); expect(apiEligible(payload())).toBe(true); });
    it('retains complete proof when saving a new acceptance fails', () => { mount(); const real = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) { if (k === CONSENT_STORAGE_KEY)
        throw Error('blocked'); return real.call(this, k, v); }); fireEvent.click(screen.getByRole('button', { name: 'Accept all' })); expect(context.categories.advertising).toBe(true); expect(context.decided).toBe(true); expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull(); expect(payload().gclid).toBe('OFFLINE_ONLY_FIXTURE'); expect(payload().measurement_consent).toMatchObject({ advertising: true, version: CONSENT_VERSION }); expect(apiEligible(payload())).toBe(true); });
    it('storage read failure does not rewrite a current accepted choice', () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'Accept all' })); vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); }); expect(context.categories.advertising).toBe(true); expect(payload().measurement_consent).toMatchObject({ advertising: true, version: CONSENT_VERSION }); expect(apiEligible(payload())).toBe(true); expect(payload().gclid).toBeNull(); });
    it('uses fresh acceptance proof instead of a previously saved rejection', () => { const old = saveConsent(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional'); old.timestamp = '2026-01-01T00:00:00.000Z'; localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(old)); mount(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); }); act(() => context.acceptAll()); expect(context.categories.advertising).toBe(true); expect(JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!).advertising).toBe(false); expect(payload().measurement_consent).toMatchObject({ advertising: true, version: old.version }); expect(payload().measurement_consent.recorded_at).not.toBe(old.timestamp); expect(apiEligible(payload())).toBe(true); });
    it('another tab withdrawal denies measurement and clears identifiers', () => { saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all'); mount(); saveConsent(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional'); act(() => window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY, newValue: localStorage.getItem(CONSENT_STORAGE_KEY) }))); expect(payload().measurement_consent.advertising).toBe(false); expect(apiEligible(payload())).toBe(false); expect(payload().gclid).toBeNull(); });
    it('same-tab normal withdrawal clears IDs and denies payload', () => { mount(); act(() => context.acceptAll()); act(() => context.rejectOptional()); expect(payload().measurement_consent.advertising).toBe(false); expect(payload().gclid).toBeNull(); });
});
describe('restoration and external changes', () => {
    it.each([null, 'invalid', '2999-01-01T00:00:00.000Z'])('does not restore invalid proof %s', timestamp => {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ advertising: true, analytics: true, version: CONSENT_VERSION, timestamp }));
        mount();
        expect(context.decided).toBe(false);
        expect(payload().measurement_consent.advertising).toBe(false);
    });
    it.each([CONSENT_STORAGE_KEY, null])('revokes consent after storage removal/clear %s', key => {
        mount();
        act(() => context.acceptAll());
        localStorage.removeItem(CONSENT_STORAGE_KEY);
        act(() => window.dispatchEvent(new StorageEvent('storage', { key })));
        expect(context.decided).toBe(false);
        expect(payload().measurement_consent.advertising).toBe(false);
        expect(payload().gclid).toBeNull();
    });
    it('updates the payload synchronously within the acceptance callback', () => {
        mount();
        act(() => { context.acceptAll(); expect(apiEligible(payload())).toBe(true); });
    });
    it('does not persist an in-memory-only acceptance across a new mount', () => {
        const view = mount();
        const real = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) { if (k === CONSENT_STORAGE_KEY)
            throw Error('blocked'); return real.call(this, k, v); });
        act(() => context.acceptAll());
        expect(apiEligible(payload())).toBe(true);
        view.unmount();
        resetAttributionMemory();
        mount();
        expect(context.decided).toBe(false);
        expect(payload().measurement_consent.advertising).toBe(false);
    });
});
// Extra verification uses the real booking form with an in-process response.
import BookingPage from '../pages/BookingPage';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
describe('real form and hydration', () => {
    it.each([false, true])('intercepts actual booking body; consent storage failure=%s', async (failWrite) => {
        sessionStorage.setItem('vve_booking', JSON.stringify({ serviceName: 'Window Cleaning', price: 120, quoteConfig: { service: 'window', deepService: 'end_of_tenancy', deepSize: 'bed1', deepBaths: 1, addOnCounts: {}, windowSize: 'medium', gutterType: 'two_storey', officeHours: 1 } }));
        const requestMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, bookingRef: 'OFFLINE-FIXTURE' })));
        vi.stubGlobal('fetch', requestMock);
        render(<MemoryRouter initialEntries={['/booking']}><CookieConsentProvider><CampaignAttribution /><BookingPage /></CookieConsentProvider></MemoryRouter>);
        if (failWrite) {
            const real = Storage.prototype.setItem;
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) { if (k === CONSENT_STORAGE_KEY)
                throw Error('blocked'); return real.call(this, k, v); });
        }
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Accept all' }));
        for (const [label, value] of [[/full name/i, 'Offline Fixture'], [/^address/i, 'Offline Test Address'], [/postcode/i, 'E8 1AA'], [/phone number/i, '07700900000'], [/email address/i, 'offline@example.invalid']] as const)
            await user.type(screen.getByLabelText(label), value);
        const date = new Date();
        date.setDate(date.getDate() + 30);
        const future = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        await user.type(screen.getByLabelText(/preferred date/i), future);
        await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
        await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
        await user.click(screen.getAllByRole('button', { name: 'No' })[1]);
        await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));
        const bookingCalls = () => requestMock.mock.calls.filter(call => call[1]?.method === 'POST' && call[1]?.body);
        await waitFor(() => expect(bookingCalls()).toHaveLength(1));
        const sent = JSON.parse(String(bookingCalls()[0][1]?.body));
        expect(sent.measurement_consent.advertising).toBe(true);
        expect(apiEligible(sent)).toBe(true);
        expect(sent.gclid).toBe('OFFLINE_ONLY_FIXTURE');
        expect(sent.measurement_consent.version).toBe(CONSENT_VERSION);
        expect(sent.measurement_consent.recorded_at).toEqual(expect.any(String));
    });
    it('hydrates saved acceptance without losing consent after effects settle', async () => {
        saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all');
        const ui = <MemoryRouter><CookieConsentProvider><CampaignAttribution /><Probe /></CookieConsentProvider></MemoryRouter>;
        const container = document.createElement('div');
        container.innerHTML = renderToString(ui);
        document.body.appendChild(container);
        const recoverable = vi.fn();
        let root: ReturnType<typeof hydrateRoot>;
        await act(async () => { root = hydrateRoot(container, ui, { onRecoverableError: recoverable }); });
        expect(recoverable).not.toHaveBeenCalled();
        expect(apiEligible(payload())).toBe(true);
        expect(payload().gclid).toBe('OFFLINE_ONLY_FIXTURE');
        act(() => root.unmount());
        container.remove();
    });
});
