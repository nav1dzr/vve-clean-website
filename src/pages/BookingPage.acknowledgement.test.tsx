import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPage from './BookingPage';
import { BOOKING_ACKNOWLEDGEMENT_KEY, rememberBookingAcknowledgement } from '../lib/bookingRequestAcknowledgement';
import { bookingRouteState } from '../lib/bookingHandoff';
import type { BookingSelection } from '../components/QuoteCalculator';
import { clearSubmissionIdentity } from '../lib/submissionIdentity';
import * as analytics from '../lib/analytics';

vi.mock('../hooks/useGoogleRating', () => ({ useGoogleRating: () => null }));
vi.mock('../lib/ga4Context', () => ({ getGa4BookingContext: async () => null }));

const selection = {
  serviceName: 'Window cleaning', price: 85,
  quoteConfig: { service: 'window', windowSize: 'medium', deepService: 'end_of_tenancy', deepSize: 'bed1', deepBaths: 1, addOnCounts: {}, gutterType: 'two_storey', officeHours: 1 },
} as BookingSelection;
const form = {
  fullName: 'P Example', address: '12 Test Street', postcode: 'E8 1AA', phone: '07700900000',
  email: 'test@example.test', date: '2030-11-01', time: 'Flexible', message: '',
  parkingAvailable: 'yes', congestionZone: 'no',
};
const response = { ok: true, status: 201, json: async () => ({ ok: true, bookingRef: 'VVE-TEST-ACK', requestId: '61f846e8-5f0e-4dab-a2bd-10d14692aef3', total: 85 }) };
const renderPage = (state?: unknown) => render(<MemoryRouter initialEntries={[{ pathname: '/booking', state }]}><BookingPage /></MemoryRouter>);
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));
const draft = (saved = form) => localStorage.setItem('vve_form_draft_v1', JSON.stringify({ expires: Date.now() + 60000, form: saved }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearSubmissionIdentity('booking');
  sessionStorage.setItem('vve_booking', JSON.stringify(selection)); draft();
  vi.spyOn(analytics, 'trackBookingRequestSubmitted').mockImplementation(() => {});
  vi.spyOn(analytics, 'trackFunnelStep').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('booking acknowledgement and request validation', () => {
  it('freezes the submitted visit details while the user edits fields during a slow response', async () => {
    let resolveResponse!: (value: typeof response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { resolveResponse = resolve; })));
    renderPage(); submit();
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: '2030-12-02' } });
    await act(async () => resolveResponse(response));
    expect(await screen.findByText('2030-11-01 · Flexible')).toBeInTheDocument();
    expect(screen.queryByText(/2030-12-02/)).not.toBeInTheDocument();
  });

  it('restores only a generic acknowledgement on refresh without another POST or analytics event', async () => {
    const page = renderPage(); submit();
    expect(await screen.findByText('VVE-TEST-ACK')).toBeInTheDocument();
    const marker = JSON.parse(sessionStorage.getItem(BOOKING_ACKNOWLEDGEMENT_KEY)!);
    expect(Object.keys(marker).sort()).toEqual(['expires', 'version']);
    expect(localStorage.getItem('vve_form_draft_v1')).toBeNull();
    expect(sessionStorage.getItem('vve_booking')).toBeNull();
    page.unmount(); renderPage();
    expect(screen.getByRole('heading', { name: 'Your request is with our team' })).toBeInTheDocument();
    expect(screen.getByText(/you do not need to send it again/i)).toBeInTheDocument();
    expect(screen.queryByText('VVE-TEST-ACK')).not.toBeInTheDocument();
    expect(screen.queryByText(form.address)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
    expect(analytics.trackBookingRequestSubmitted).toHaveBeenCalledOnce();
  });

  it('lets a visitor explicitly start another request and clears the previous form', () => {
    rememberBookingAcknowledgement(); renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start another request' }));
    expect(screen.getByRole('heading', { name: 'Choose a cleaning service and see your price' })).toBeInTheDocument();
    expect(sessionStorage.getItem(BOOKING_ACKNOWLEDGEMENT_KEY)).toBeNull();
    expect(localStorage.getItem('vve_form_draft_v1')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(analytics.trackBookingRequestSubmitted).not.toHaveBeenCalled();
  });

  it('a deliberate fresh calculator handoff starts a new form instead of showing old success', () => {
    rememberBookingAcknowledgement(); renderPage(bookingRouteState(selection, '/'));
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    expect(sessionStorage.getItem(BOOKING_ACKNOWLEDGEMENT_KEY)).toBeNull();
  });

  it('still shows success when acknowledgement storage is blocked', async () => {
    renderPage();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    submit();
    expect(await screen.findByText('VVE-TEST-ACK')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts initial and surname with whitespace around a valid email', async () => {
    draft({ ...form, email: '  test@example.test  ' }); renderPage(); submit();
    expect(await screen.findByText('VVE-TEST-ACK')).toBeInTheDocument();
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(sent.fullName).toBe('P Example'); expect(sent.email).toBe('test@example.test');
  });

  it('rejects a single-character name before sending, matching the API', () => {
    draft({ ...form, fullName: 'P' }); renderPage(); submit();
    expect(screen.getByText('Please enter your full name.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows unrelated conflicts without disabling request retry as a changed price', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This request changed. Please refresh the form before sending again.' }) }).mockResolvedValueOnce(response));
    renderPage(); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('This request changed.');
    expect(screen.queryByText(/prices have changed/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Send request — no payment$/ })).toBeEnabled();
  });

  it.each([{ fullName: 42 }, { email: [] }, { parkingAvailable: ['yes'] }, { congestionZone: {} }])('ignores structurally invalid drafts: %j', invalid => {
    draft({ ...form, ...invalid } as typeof form); renderPage(); submit();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the London calendar day near summer midnight, irrespective of device zone', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-15T23:30:00Z'));
    draft({ ...form, date: '2026-06-15' }); renderPage(); submit();
    expect(screen.getByLabelText(/preferred date/i)).toHaveAttribute('min', '2026-06-16');
    expect(screen.getByText('Please choose a date that has not already passed.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
