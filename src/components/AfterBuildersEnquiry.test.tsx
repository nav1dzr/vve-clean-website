import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AfterBuildersEnquiry from './AfterBuildersEnquiry';
import { getAttribution } from '../lib/attribution';
import { trackContactFormSubmitted } from '../lib/analytics';
import { AFTER_BUILDERS_DRAFT_KEY, AFTER_BUILDERS_SUBMISSION_SCOPE, clearAfterBuildersDraft } from '../lib/afterBuildersEnquiry';
import { clearSubmissionIdentity } from '../lib/submissionIdentity';

vi.mock('../lib/analytics', () => ({ trackContactFormSubmitted: vi.fn() }));
vi.mock('../lib/attribution', () => ({ getAttribution: vi.fn(() => ({ first_source: 'direct', last_source: 'direct', gclid: null })) }));
const ENQUIRY_ID = 'd725dfd7-cc50-49cc-bb2e-ce2efcff38fa';
const accepted = () => ({ ok: true, json: async () => ({ ok: true, enquiryId: ENQUIRY_ID }) });
beforeEach(() => { clearAfterBuildersDraft(); clearSubmissionIdentity(AFTER_BUILDERS_SUBMISSION_SCOPE); vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(accepted())); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); clearAfterBuildersDraft(); clearSubmissionIdentity(AFTER_BUILDERS_SUBMISSION_SCOPE); });

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Review my enquiry' }));
}
async function contactDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), 'VVE TEST');
  await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
}
const bodies = () => vi.mocked(fetch).mock.calls.map(call => JSON.parse(String(call[1]?.body)));

describe('AfterBuildersEnquiry', () => {
  it('checks the optional date at review and again when sending after London midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-07-04T22:59:59Z'));
    try {
      const user = userEvent.setup();
      render(<AfterBuildersEnquiry />);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      const date = screen.getByLabelText(/Preferred date/);
      expect(date).toHaveAttribute('min', '2027-07-04');
      fireEvent.change(date, { target: { value: '2027-07-03' } });
      await user.click(screen.getByRole('button', { name: 'Review my enquiry' }));
      expect(screen.getByRole('alert')).toHaveTextContent('today or a future date');
      expect(date).toHaveAttribute('aria-invalid', 'true');
      fireEvent.change(date, { target: { value: '2027-07-04' } });
      await user.click(screen.getByRole('button', { name: 'Review my enquiry' }));
      await contactDetails(user);
      vi.setSystemTime(new Date('2027-07-04T23:00:00Z'));
      await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('today or a future date');
      fireEvent.change(screen.getByLabelText(/Preferred date/), { target: { value: '' } });
      await user.click(screen.getByRole('button', { name: 'Review my enquiry' }));
      await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(bodies()[0]).toMatchObject({ preferredDate: '', message: expect.stringContaining('Preferred date: Flexible / to agree') });
    } finally { vi.useRealTimers(); }
  });

  it('preserves decimal square metres and whole item counts from a saved draft through the submitted review', async () => {
    const user = userEvent.setup();
    const first = render(<AfterBuildersEnquiry />);
    await user.click(screen.getByText('More about the property (optional)'));
    await user.type(screen.getByLabelText(/Approximate floor area/), '12.5');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText('Pressure washing'));
    await user.type(screen.getByLabelText(/^Pressure washing: quantity/), '7.25');
    await user.click(screen.getByLabelText('Exterior or specialist window cleaning'));
    const windows = screen.getByLabelText(/^Exterior or specialist window cleaning: quantity/);
    await user.type(windows, '3.5');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('whole number');
    expect(windows).toHaveValue('3.5');
    await user.clear(windows);
    await user.type(windows, '3');
    first.unmount();

    render(<AfterBuildersEnquiry />);
    await user.selectOptions(screen.getByLabelText('Property type'), 'house');
    await user.type(screen.getByLabelText(/Postcode \(if known\)/), 'E17 3AA');
    await user.click(screen.getByText('More about the property (optional)'));
    await user.type(screen.getByLabelText('Rooms or work to tell us about'), 'Private kitchen note');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const futureDate = `${new Date().getUTCFullYear() + 1}-04-15`;
    fireEvent.change(screen.getByLabelText(/Preferred date/), { target: { value: futureDate } });
    await user.type(screen.getByLabelText(/Access notes/), 'Private gate code');

    const lines = ['Property: House', 'Approximate floor area: 12.5 m²', 'Pressure washing: 7.25 m²', 'Exterior or specialist window cleaning: 3 windows'];
    const checkWhatsApp = () => {
      const link = screen.getByRole('link', { name: 'Send photos on WhatsApp' }) as HTMLAnchorElement;
      const message = new URL(link.href).searchParams.get('text')!;
      for (const line of lines) expect(message).toContain(line);
      expect(message).toContain('assess the work');
      expect(message).toContain('final price in writing');
      expect(message).not.toMatch(/E17 3AA|Private kitchen note|Private gate code|VVE TEST|test@example\.com/);
      expect(message).not.toContain(futureDate);
      return message;
    };
    expect(checkWhatsApp()).toContain('details I’ve selected so far');
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Review my enquiry' }));
    for (const line of lines) expect(screen.getByText(line)).toBeVisible();
    await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    await screen.findByRole('heading', { name: 'Your enquiry is saved' });
    for (const line of lines) expect(bodies()[0].message).toContain(line);
    expect(checkWhatsApp()).toContain('I’ve sent an after-builders enquiry');
  });

  it('allows unsure project answers and optional phone, then sends one complete contact enquiry', async () => {
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />);
    await openReview(user); expect(fetch).not.toHaveBeenCalled();
    await contactDetails(user); await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    expect(await screen.findByRole('heading', { name: 'Your enquiry is saved' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/contact');
    expect(bodies()[0]).toMatchObject({ fullName: 'VVE TEST', email: 'test@example.com', phone: '', service: 'After builders cleaning', marketingOptIn: false, attribution: { gclid: null } });
    expect(bodies()[0].message).toContain('CORE CLEANING TO CONFIRM IN YOUR QUOTE');
    expect(bodies()[0]).not.toHaveProperty('quote_config');
    expect(bodies()[0]).not.toHaveProperty('total');
    expect(trackContactFormSubmitted).toHaveBeenCalledExactlyOnceWith(ENQUIRY_ID);
    expect(localStorage.getItem(AFTER_BUILDERS_DRAFT_KEY)).toBeNull();
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('keeps name and answers on a failed save and reuses its request identity while rereading attribution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) }).mockResolvedValueOnce(accepted()));
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    expect(await screen.findByRole('alert')).toHaveFocus();
    expect(screen.getByLabelText(/your name/i)).toHaveValue('VVE TEST');
    expect(trackContactFormSubmitted).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    await screen.findByRole('heading', { name: 'Your enquiry is saved' });
    expect(bodies()[0].requestKey).toBe(bodies()[1].requestKey);
    expect(getAttribution).toHaveBeenCalledTimes(2);
    expect(trackContactFormSubmitted).toHaveBeenCalledTimes(1);
  });

  it('removes advertising attribution after consent withdrawal without creating a new retry identity', async () => {
    const denied = {
      first_source: null, last_source: null, landing_page: null, first_touch_at: null,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
      gclid: null, gbraid: null, wbraid: null, offer_code: null, discount_percent: null,
      measurement_consent: { advertising: false, version: 'test-version', recorded_at: '2026-10-14T09:05:00Z' },
    };
    vi.mocked(getAttribution)
      .mockReturnValueOnce({ ...denied, first_source: 'google-ads', gclid: 'test-consented-click', measurement_consent: { ...denied.measurement_consent, advertising: true } })
      .mockReturnValueOnce(denied);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(accepted()));
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('status');
    expect(bodies()[0].attribution.gclid).toBe('test-consented-click');
    expect(bodies()[1].attribution).toEqual(denied);
    expect(bodies()[1].requestKey).toBe(bodies()[0].requestKey);
    expect(trackContactFormSubmitted).toHaveBeenCalledExactlyOnceWith(ENQUIRY_ID);
  });

  it('explains the specific read-only preview response without reporting a submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'This preview is read-only until approved isolated test resources are connected.' }) }));
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sending enquiries is disabled here, so nothing has been sent or saved to the CRM.');
    expect(screen.getByLabelText(/your name/i)).toHaveValue('VVE TEST');
    expect(trackContactFormSubmitted).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Your enquiry is saved' })).not.toBeInTheDocument();
  });

  it('does not report a completed enquiry for a network error or an HTTP success without ok:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) }));
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('alert');
    expect(trackContactFormSubmitted).not.toHaveBeenCalled();
    expect(bodies()[0].requestKey).toBe(bodies()[1].requestKey);
  });

  it('requires contact details only at the end, associates errors and makes no request on invalid input', async () => {
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    expect(screen.getByLabelText(/your name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveFocus();
    await user.type(screen.getByLabelText(/your name/i), 'VVE TEST');
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' }));
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled(); expect(trackContactFormSubmitted).not.toHaveBeenCalled();
  });

  it('checks a supplied postcode but permits clearing it or using a district', async () => {
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />);
    await user.type(screen.getByLabelText(/postcode \(if known\)/i), 'bad');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveFocus(); expect(screen.getByRole('heading', { name: 'Tell us about the property' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/postcode \(if known\)/i)); await user.type(screen.getByLabelText(/postcode \(if known\)/i), 'E17');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'What would you like cleaned?' })).toHaveFocus();
  });

  it('keeps selections and contact details when editing from review, and removes deselected quantities', async () => {
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('checkbox', { name: 'Carpet extraction' }));
    await user.type(screen.getByLabelText(/^Carpet extraction: quantity/), '3');
    await user.click(screen.getByRole('button', { name: 'Continue' })); await user.click(screen.getByRole('button', { name: 'Review my enquiry' })); await contactDetails(user);
    expect(screen.getByText('Carpet extraction: 3 carpet areas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit optional services requested' }));
    expect(screen.getByLabelText(/^Carpet extraction: quantity/)).toHaveValue('3');
    await user.click(screen.getByRole('checkbox', { name: 'Carpet extraction' }));
    expect(screen.queryByLabelText('Carpet extraction: quantity (optional)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '4. Review' }));
    expect(screen.getByLabelText(/your name/i)).toHaveValue('VVE TEST');
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('status');
    expect(bodies()[0].message).toContain('No optional services selected.');
    expect(bodies()[0].message).not.toContain('3 carpet areas');
  });

  it('restores only safe selections across a remount', async () => {
    const user = userEvent.setup(); const first = render(<AfterBuildersEnquiry />);
    await user.selectOptions(screen.getByLabelText('Property type'), 'house');
    await user.type(screen.getByLabelText(/postcode \(if known\)/i), 'E17 3AA');
    await user.click(screen.getByText('More about the property (optional)'));
    await user.type(screen.getByLabelText('Rooms or work to tell us about'), 'Private note');
    first.unmount(); render(<AfterBuildersEnquiry />);
    expect(screen.getByLabelText('Property type')).toHaveValue('house');
    expect(screen.getByLabelText(/postcode \(if known\)/i)).toHaveValue('');
    expect(screen.getByLabelText('Rooms or work to tell us about')).toHaveValue('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('can submit with localStorage blocked', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send my enquiry' })); await screen.findByRole('status');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('prevents double submits while a save is in flight', async () => {
    let resolve!: (value: ReturnType<typeof accepted>) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done; })));
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />); await openReview(user); await contactDetails(user);
    const form = screen.getByRole('button', { name: 'Send my enquiry' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolve(accepted()); await screen.findByRole('status');
    expect(trackContactFormSubmitted).toHaveBeenCalledTimes(1);
  });

  it('shows the existing photo alternative without upload controls or a price calculation', async () => {
    const user = userEvent.setup(); render(<AfterBuildersEnquiry />);
    await user.click(screen.getByRole('button', { name: 'Continue' })); await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('link', { name: 'Send photos on WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/447845451111'));
    expect(document.querySelector('input[type=file]')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
