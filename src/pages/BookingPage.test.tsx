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
}

async function fillAllRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await fillContactDetails(user);
  await user.type(screen.getByLabelText(/preferred date/i), '2026-08-01');
  await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
}

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
        /Choose your preferred date, add your details and pay the £30 deposit\. We will confirm availability within one business hour\. Your deposit comes off the final total\./,
      ),
    ).toBeInTheDocument();
  });

  it('shows the required supporting text near the date fields', () => {
    renderBookingPage();
    expect(
      screen.getByText(/Choose your preferred date and arrival window\. We will confirm availability within one business hour\./),
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
    await user.type(screen.getByLabelText(/preferred date/i), '2026-08-01');
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getByRole('checkbox', { name: /agree to the/i }));
    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    const fullNameInput = screen.getByLabelText(/full name/i);
    await waitFor(() => expect(fullNameInput).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = fullNameInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveAttribute('role', 'alert');
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
    await user.type(dateInput, '2026-08-01');

    await user.click(screen.getByRole('button', { name: /^Pay £30 deposit$/ }));

    expect(await screen.findByText('Please choose your preferred arrival window.')).toBeInTheDocument();
  });

  it('sets the date input\'s min attribute to today, preventing past-date picks in the native picker', () => {
    renderBookingPage();
    const dateInput = screen.getByLabelText(/preferred date/i) as HTMLInputElement;
    const today = new Date().toISOString().slice(0, 10);
    expect(dateInput.min).toBe(today);
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
    expect(body.date).toBe('2026-08-01');
    expect(body.time).toBe('Flexible');

    vi.unstubAllGlobals();
  });
});
