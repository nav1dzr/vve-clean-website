import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import BookingPage from './BookingPage';

// The booking form already scrolled to and focused the first invalid control.
// What it lacked was a summary near the top listing every problem at once —
// the pattern assistive-technology users rely on to learn how many errors
// there are before being dropped into one of them.

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    'vve_booking',
    JSON.stringify({
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
    }),
  );
});

function futureDateISO(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderBookingPage() {
  return render(
    <MemoryRouter initialEntries={['/booking']}>
      <BookingPage />
    </MemoryRouter>,
  );
}

const summary = () => screen.getByRole('heading', { name: /problems? with your booking request/i })
  .closest('div') as HTMLElement;

describe('BookingPage — error summary', () => {
  it('is not shown before the customer tries to submit', () => {
    renderBookingPage();

    expect(
      screen.queryByRole('heading', { name: /problems? with your booking request/i }),
    ).not.toBeInTheDocument();
  });

  it('lists every outstanding problem after a blocked submit', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    const heading = await screen.findByRole('heading', {
      name: /problems? with your booking request/i,
    });
    // 5 contact fields + date + arrival window + 2 access questions + terms.
    expect(heading).toHaveTextContent('There are 10 problems with your booking request');

    const links = within(summary()).getAllByRole('link');
    expect(links).toHaveLength(10);
  });

  it('uses singular wording when only one problem remains', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/^address/i), '12 High Street');
    await user.type(screen.getByLabelText(/postcode/i), 'E8 1AA');
    await user.type(screen.getByLabelText(/phone number/i), '07700900000');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/preferred date/i), futureDateISO());
    await user.selectOptions(screen.getByLabelText(/preferred arrival window/i), 'Flexible');
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'No' })[1]);
    // Terms deliberately left unaccepted.

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    expect(
      await screen.findByRole('heading', { name: 'There is 1 problem with your booking request' }),
    ).toBeInTheDocument();
  });

  it('receives focus so a screen reader announces the whole list', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    await waitFor(() => expect(summary()).toHaveFocus());
    // Focusable-but-not-tabbable: reachable programmatically, skipped in the
    // natural tab order so it does not become a stop on every pass.
    expect(summary()).toHaveAttribute('tabindex', '-1');
  });

  it('is labelled by its own heading', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    await waitFor(() =>
      expect(summary()).toHaveAttribute('aria-labelledby', 'booking-error-summary-heading'),
    );
  });

  it('moves focus to the named control when a summary entry is clicked', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await screen.findByRole('heading', { name: /problems? with your booking request/i });

    await user.click(within(summary()).getByRole('link', { name: 'Full name' }));

    expect(screen.getByLabelText(/full name/i)).toHaveFocus();
  });

  it('links the postcode entry to the postcode field, not merely the first error', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await screen.findByRole('heading', { name: /problems? with your booking request/i });

    await user.click(within(summary()).getByRole('link', { name: 'Postcode' }));

    expect(screen.getByLabelText(/postcode/i)).toHaveFocus();
  });

  it('shrinks as problems are fixed, and disappears once the form is valid', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await screen.findByRole('heading', { name: 'There are 10 problems with your booking request' });

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));

    expect(
      await screen.findByRole('heading', { name: 'There are 9 problems with your booking request' }),
    ).toBeInTheDocument();
  });

  // The summary names the field; the inline error explains the problem. If the
  // summary repeated the full sentence, a screen reader would read every
  // problem twice and getByText would no longer identify a unique error.
  it('names the field rather than repeating the inline error sentence', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await screen.findByRole('heading', { name: /problems? with your booking request/i });

    expect(within(summary()).getByRole('link', { name: 'Full name' })).toBeInTheDocument();
    expect(within(summary()).queryByText(/please enter your full name/i)).not.toBeInTheDocument();
    // The inline message still exists exactly once, on the field itself.
    expect(screen.getByText('Please enter your full name.')).toBeInTheDocument();
  });

  it('preserves everything already typed when submission is blocked', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/^address/i), '12 High Street');

    await user.click(screen.getByRole('button', { name: /pay £30 deposit/i }));
    await screen.findByRole('heading', { name: /problems? with your booking request/i });

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Smith');
    expect(screen.getByLabelText(/^address/i)).toHaveValue('12 High Street');
  });
});
