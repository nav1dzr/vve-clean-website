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

  it('requires both access questions before checkout', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }));
    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    expect(await screen.findByText('Please tell us whether free parking is available for our cleaning team.')).toBeInTheDocument();
    expect(screen.getByText('Please tell us whether the property is inside the Congestion Charge zone.')).toBeInTheDocument();
  });

  it('adds £15 parking and £18 Congestion Charge to the carried booking total', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ checkoutUrl: 'https://checkout.stripe.com/test' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    await user.type(screen.getByLabelText(/preferred date/i), FUTURE_DATE);
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getAllByRole('button', { name: 'No' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[1]);
    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }));
    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.price).toBe(153);
    expect(body.quoteConfig.parkingAvailable).toBe('no');
    expect(body.quoteConfig.congestionZone).toBe('yes');
    expect(screen.getByText('£153')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe('BookingPage — booking request wording', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('uses "Complete your booking request" as the headline, not a guarantee claim', () => {
    renderBookingPage();
    expect(screen.getByRole('heading', { name: 'Complete your booking request' })).toBeInTheDocument();
    expect(screen.queryByText(/slot is (nearly )?secured/i)).not.toBeInTheDocument();
  });

  it('shows the required introduction wording', () => {
    renderBookingPage();
    expect(
      screen.getByText(
        /Choose your preferred date, add your details and pay the £30 deposit\. We will confirm availability separately\. Your deposit comes off the final total\./,
      ),
    ).toBeInTheDocument();
  });

  it('shows the required supporting text near the date fields', () => {
    renderBookingPage();
    expect(
      screen.getByText(/Choose your preferred date and arrival window\. We will confirm availability separately\./),
    ).toBeInTheDocument();
  });

  it('uses "Pay £30 deposit" as the payment button label, with no confirmation claim', () => {
    renderBookingPage();
    expect(screen.getByRole('button', { name: /^Pay £30 deposit$/ })).toBeInTheDocument();
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
    await user.click(screen.getByRole('checkbox', { name: /agree to the/i }));
    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    const fullNameInput = screen.getByLabelText(/full name/i);
    await waitFor(() => expect(fullNameInput).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = fullNameInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveAttribute('role', 'alert');
  });

  it('focuses the first invalid control and exposes native required semantics', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    const fullName = screen.getByLabelText(/full name/i);
    expect(fullName).toBeRequired();
    expect(screen.getByLabelText(/^address/i)).toBeRequired();
    expect(screen.getByLabelText(/postcode/i)).toBeRequired();
    expect(screen.getByLabelText(/phone number/i)).toBeRequired();
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred date/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred arrival window/i)).toBeRequired();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await waitFor(() => expect(fullName).toHaveFocus());
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

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    expect(await screen.findByText('Please choose your preferred date.')).toBeInTheDocument();
  });

  it('blocks submission and shows an error when preferred arrival window is missing', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);
    const dateInput = screen.getByLabelText(/preferred date/i);
    await user.type(dateInput, FUTURE_DATE);

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

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

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    expect(await screen.findByText('Please choose a date that has not already passed.')).toBeInTheDocument();
  });

  it('does not call the checkout API when required fields are missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderBookingPage();
    await fillContactDetails(user);

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

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

  it('does not restore terms acceptance from the draft', () => {
    const draft = {
      expires: Date.now() + 48 * 60 * 60 * 1000,
      form: { fullName: 'Jane', address: '', postcode: '', phone: '', email: '', date: '', time: '', message: '' },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    renderBookingPage();

    const checkbox = screen.getByRole('checkbox', { name: /terms of service/i });
    expect(checkbox).not.toBeChecked();
  });

  it('handles corrupt draft storage without crashing', () => {
    localStorage.setItem(DRAFT_KEY, '{not valid json}}}');
    expect(() => renderBookingPage()).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Complete your booking request' })).toBeInTheDocument();
  });

  it('handles unavailable localStorage without crashing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => renderBookingPage()).not.toThrow();
    spy.mockRestore();
  });
});

describe('BookingPage — required terms acceptance', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedSelection();
  });

  it('shows the terms checkbox unticked by default', () => {
    renderBookingPage();
    const checkbox = screen.getByRole('checkbox', { name: /terms of service/i });
    expect(checkbox).not.toBeChecked();
  });

  it('blocks payment and shows the accessible error when terms are not accepted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderBookingPage();
    await fillAllRequiredFields(user);

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    expect(
      await screen.findByText('Please read and accept the booking and cancellation terms.'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('properly associates the checkbox with its error message for assistive tech', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillAllRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    const checkbox = await screen.findByRole('checkbox', { name: /terms of service/i });
    const error     = screen.getByText('Please read and accept the booking and cancellation terms.');

    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox.getAttribute('aria-describedby')).toBe(error.id);
    expect(error).toHaveAttribute('role', 'alert');
  });

  it('has a properly associated label so clicking the text toggles the checkbox (44px+ tap target)', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    const checkbox = screen.getByRole('checkbox', { name: /terms of service/i });
    const label     = checkbox.closest('label');

    expect(label).not.toBeNull();
    expect(label).toHaveClass('min-h-[44px]');

    await user.click(screen.getByText(/I agree to the/));
    expect(checkbox).toBeChecked();
  });

  it('links to both the Terms of Service and Privacy Policy', () => {
    renderBookingPage();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
  });

  it('clears the terms error once the checkbox is ticked', async () => {
    const user = userEvent.setup();
    renderBookingPage();
    await fillAllRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));
    await screen.findByText('Please read and accept the booking and cancellation terms.');

    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }));

    expect(screen.queryByText('Please read and accept the booking and cancellation terms.')).not.toBeInTheDocument();
  });

  it('submits termsAccepted, termsAcceptedAt, termsVersion and cancellationPolicyVersion alongside the booking once accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ checkoutUrl: 'https://checkout.stripe.com/test' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderBookingPage();
    await fillAllRequiredFields(user);
    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }));
    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);

    expect(body.termsAccepted).toBe(true);
    expect(typeof body.termsAcceptedAt).toBe('string');
    expect(new Date(body.termsAcceptedAt).toString()).not.toBe('Invalid Date');
    expect(body.termsVersion).toBeTruthy();
    expect(body.cancellationPolicyVersion).toBeTruthy();
    // Preferred date and arrival window must still reach the backend.
    expect(body.date).toBe(FUTURE_DATE);
    expect(body.time).toBe('Flexible');

    vi.unstubAllGlobals();
  });
});
