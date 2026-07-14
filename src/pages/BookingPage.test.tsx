import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import BookingPage from './BookingPage';

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

// Note: fullName/address/postcode/phone labels are not yet programmatically
// associated with their inputs (pre-existing gap, out of scope for this fix)
// — use placeholder text to locate them instead of getByLabelText.
async function fillContactDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Jane Smith'), 'Jane Smith');
  await user.type(screen.getByPlaceholderText('12 High Street, London'), '12 High Street');
  await user.type(screen.getByPlaceholderText('E8 1AA'), 'E8 1AA');
  await user.type(screen.getByPlaceholderText('07700 900000'), '07700900000');
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
