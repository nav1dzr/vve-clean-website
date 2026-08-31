import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import BookingPage from './BookingPage';

// Draft persistence writes to localStorage; clear it before every test so it
// never leaks between describe blocks and causes false validation passes.
beforeEach(() => {
  localStorage.clear();
});

/**
 * A booking date that is always genuinely in the future.
 *
 * These tests previously hard-coded '2026-08-01', which was future when written
 * and silently became past — after which every test that submits the form
 * failed with "The preferred date has already passed". Deriving the date from
 * the current clock means it cannot rot again. Built from local components so
 * it matches BookingPage's own local-time min/validation logic in any time
 * zone. Tests that deliberately exercise a *past* date still hard-code one.
 */
function futureDateISO(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const FUTURE_DATE = futureDateISO();

function renderBookingPage() {
  return render(
    <MemoryRouter initialEntries={['/booking']}>
      <BookingPage />
    </MemoryRouter>,
  );
}

const VALID_SELECTION = {
  serviceName: 'Window Cleaning',
  price: 120,
  quoteConfig: {
    service: 'window',
    deepService: 'end_of_tenancy',
    deepSize: 'bed1',
    deepBaths: 1,
    addOnCounts: {},
    windowSize: 'medium',
    gutterType: 'two_storey',
    officeHours: 1,
  },
};

function seedSelection(overrides: Partial<typeof VALID_SELECTION> = {}) {
  sessionStorage.setItem('vve_booking', JSON.stringify({ ...VALID_SELECTION, ...overrides }));
}

async function fillContactDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
  await user.type(screen.getByLabelText(/^address/i), '12 High Street');
  await user.type(screen.getByLabelText(/postcode/i), 'E8 1AA');
  await user.type(screen.getByLabelText(/phone number/i), '07700900000');
  await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
}

async function fillAllRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await fillContactDetails(user);
  await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
  await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
  await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
  await user.click(screen.getAllByRole('button', { name: 'No' })[1]);
}

describe('BookingPage — mobile scheduling and access charges', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('uses a one-column mobile schedule with full-width, clipping-safe controls and notes', () => {
    renderBookingPage();

    expect(screen.getByTestId('booking-schedule-fields')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'min-w-0');
    expect(screen.getByLabelText(/preferred date/i)).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'h-12');
    expect(screen.getByLabelText(/preferred arrival window/i)).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'h-12', 'pr-10');
    expect(screen.getByLabelText(/anything else/i)).toHaveClass('w-full', 'min-w-0', 'max-w-full');
  });

  it('requires both access questions before sending the request', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    expect(await screen.findByText('Please tell us whether free parking is available for our cleaning team.')).toBeInTheDocument();
    expect(screen.getByText('Please tell us whether the property is inside the Congestion Charge zone.')).toBeInTheDocument();
  });

  it('adds £15 parking and £18 Congestion Charge to the carried booking total', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, bookingRef: 'VVE-TEST123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getAllByRole('button', { name: 'No' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[1]);
    expect(screen.getByText('£153')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.price).toBe(153);
    expect(body.quoteConfig.parkingAvailable).toBe('no');
    expect(body.quoteConfig.congestionZone).toBe('yes');

    vi.unstubAllGlobals();
  });
});

describe('BookingPage — booking request wording', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('uses a request-first headline, not a guarantee claim', () => {
    renderBookingPage();
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    expect(screen.queryByText(/slot is (nearly )?secured/i)).not.toBeInTheDocument();
  });

  it('shows the required introduction wording', () => {
    renderBookingPage();
    expect(
      screen.getByText(
        /Send your preferred date with no payment\. Our team will check availability, the final scope and price, then contact you to confirm the appointment\./,
      ),
    ).toBeInTheDocument();
  });

  it('shows the required supporting text near the date fields', () => {
    renderBookingPage();
    expect(
      screen.getByText(/This is a request, not a confirmed appointment, and no payment is taken at this stage\./),
    ).toBeInTheDocument();
  });

  it('uses a no-payment request label with no confirmation claim', () => {
    renderBookingPage();
    expect(screen.getByRole('button', { name: /^Send request — no payment$/ })).toBeInTheDocument();
  });

  it('never claims the slot/appointment is guaranteed or secured', () => {
    renderBookingPage();
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toMatch(/secures your slot/i);
    expect(bodyText).not.toMatch(/slot is secured/i);
    expect(bodyText).not.toMatch(/confirm booking/i);
    expect(bodyText).not.toMatch(/no one else can take your slot/i);
  });
});

describe('BookingPage — accessible labels on property/contact fields', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('programmatically associates full name, address, postcode and phone with their labels', () => {
    renderBookingPage();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('associates the full name error with its input via aria-describedby when invalid', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await user.type(screen.getByLabelText(/^address/i), '12 High Street');
    await user.type(screen.getByLabelText(/postcode/i), 'E8 1AA');
    await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getByRole('button', { name: /send request — no payment/i }));

    const fullNameInput = screen.getByLabelText(/full name/i);
    await waitFor(() => expect(fullNameInput).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = fullNameInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveAttribute('role', 'alert');
  });

  it('exposes native required semantics on every mandatory control', () => {
    renderBookingPage();

    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/^address/i)).toBeRequired();
    expect(screen.getByLabelText(/postcode/i)).toBeRequired();
    expect(screen.getByLabelText(/phone number/i)).toBeRequired();
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred date/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred arrival window/i)).toBeRequired();
  });

  // Focus now lands on the error summary rather than the first invalid field,
  // so the count of problems is announced before the user is moved into one of
  // them. The summary's links then reach each individual control — see
  // BookingPage.errorSummary.test.tsx. The first invalid field still carries
  // aria-invalid and its inline message.
  it('moves focus to the error summary on a blocked submit', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /send request — no payment/i }));

    const heading = await screen.findByRole('heading', {
      name: /problems? with your booking request/i,
    });
    await waitFor(() => expect(heading.closest('div')).toHaveFocus());
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('BookingPage — required preferred date and arrival window', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('labels preferred date and arrival window as required', () => {
    renderBookingPage();
    expect(screen.getByText('Preferred date')).toBeInTheDocument();
    expect(screen.getByText('Preferred arrival window')).toBeInTheDocument();
  });

  it('blocks submission and shows an error when preferred date is missing', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');

    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    expect(await screen.findByText('Please choose your preferred date.')).toBeInTheDocument();
  });

  it('blocks submission and shows an error when preferred arrival window is missing', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    const dateInput = screen.getByLabelText(/preferred date/i);
    await user.type(dateInput, FUTURE_DATE);

    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    expect(await screen.findByText('Please choose your preferred arrival window.')).toBeInTheDocument();
  });

  it('sets the date input\'s min attribute to today, preventing past-date picks in the native picker', () => {
    // Pin the clock to a fixed local-time instant. Constructing the date from
    // local components (year, month, day) means the expected value is the same
    // in every time zone, matching the component's local-getter logic — no
    // dependence on where UTC midnight falls relative to local midnight.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    try {
      renderBookingPage();
      const dateInput = screen.getByLabelText(/preferred date/i) as HTMLInputElement;
      expect(dateInput.min).toBe('2026-06-15');
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks submission and shows an error when the typed date has already passed', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.type(screen.getByLabelText(/preferred date/i), '2020-01-01');
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');

    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    expect(await screen.findByText('Please choose a date that has not already passed.')).toBeInTheDocument();
  });

  it('does not call the checkout API when required fields are missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);

    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    await waitFor(() => {
      expect(screen.getByText('Please choose your preferred date.')).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('BookingPage — booking-form draft persistence', () => {
  const DRAFT_KEY = 'vve_form_draft_v1';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    seedSelection();
  });

  it('restores saved draft fields when the page mounts', async () => {
    const draft = {
      expires: Date.now() + 48 * 60 * 60 * 1000,
      form: {
        fullName: 'Jane Smith', address: '12 High Street', postcode: 'E8 1AA',
        phone: '07700900000', email: '', date: '2026-09-01', time: 'Morning (8am–12pm)', message: '',
      },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    renderBookingPage();

    await waitFor(() => {
      expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('Jane Smith');
    });
    expect((screen.getByLabelText(/^address/i) as HTMLInputElement).value).toBe('12 High Street');
    expect((screen.getByLabelText(/postcode/i) as HTMLInputElement).value).toBe('E8 1AA');
  });

  it('saves a draft to localStorage when a field is changed', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await user.type(screen.getByLabelText(/full name/i), 'Alex');

    const stored = localStorage.getItem(DRAFT_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.form.fullName).toBe('Alex');
    expect(parsed.expires).toBeGreaterThan(Date.now());
  });

  it('ignores an expired draft', () => {
    const draft = {
      expires: Date.now() - 1000,
      form: { fullName: 'Old Name', address: '', postcode: '', phone: '', email: '', date: '', time: '', message: '' },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    renderBookingPage();

    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('');
  });

  it('does not make a no-payment request conditional on accepting booking terms', () => {
    const draft = {
      expires: Date.now() + 48 * 60 * 60 * 1000,
      form: { fullName: 'Jane', address: '', postcode: '', phone: '', email: '', date: '', time: '', message: '' },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    renderBookingPage();

    expect(screen.queryByRole('checkbox', { name: /terms of service/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Send request — no payment$/ })).toBeInTheDocument();
  });

  it('handles corrupt draft storage without crashing', () => {
    localStorage.setItem(DRAFT_KEY, '{not valid json}}}');
    expect(() => renderBookingPage()).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
  });

  it('handles unavailable localStorage without crashing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => renderBookingPage()).not.toThrow();
    spy.mockRestore();
  });
});

describe('BookingPage — no-payment request submission', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('does not ask for payment or require booking terms before availability is checked', () => {
    renderBookingPage();
    expect(screen.queryByRole('checkbox', { name: /terms of service/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/pay £30 deposit/i)).not.toBeInTheDocument();
    expect(screen.getByText(/booking and cancellation terms apply once an appointment is confirmed/i)).toBeInTheDocument();
  });

  it('links to the privacy policy at the point of submission', () => {
    renderBookingPage();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
  });

  it('sends a manager-visible request, preserves scheduling details and never redirects to Stripe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, bookingRef: 'VVE-TEST123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderBookingPage();
    await fillAllRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /^Send request — no payment$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);

    expect(fetchMock.mock.calls[0][0]).toBe('/api/create-booking-request');
    expect(body).not.toHaveProperty('termsAccepted');
    expect(body).not.toHaveProperty('deposit');
    expect(body.date).toBe(FUTURE_DATE);
    expect(body.time).toBe('Flexible');
    expect(body.quoteConfig.parkingAvailable).toBe('yes');
    expect(body.quoteConfig.congestionZone).toBe('no');
    expect(await screen.findByRole('heading', { name: 'Your request is with our team' })).toBeInTheDocument();
    expect(screen.getByText('VVE-TEST123')).toBeInTheDocument();
    expect(screen.getByText(/No payment has been taken/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
