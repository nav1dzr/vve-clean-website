import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingCustomerSection from './BookingCustomerSection';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args), ApiError: class extends Error {} }));
const card = (id: string, email: string | null, phone: string | null = null) => ({ id, name: id, email, phone });
const data = (results: ReturnType<typeof card>[]) => ({ results, page: 1, pageSize: 5, totalCount: results.length, hasMore: false });
const view = (email: string, phone: string | null = null) => <MemoryRouter><BookingCustomerSection bookingId="booking-a" fullName="Audit customer" email={email} phone={phone} /></MemoryRouter>;

describe('BookingCustomerSection', () => {
  beforeEach(() => authFetchMock.mockReset());
  it('offers an explicitly chosen customer review draft for completed work without linking or writing records', async () => {
    authFetchMock.mockResolvedValue(data([card('Customer A', 'shared@example.invalid'), card('Customer B', 'shared@example.invalid')]));
    render(<MemoryRouter><BookingCustomerSection bookingId="booking-a" fullName="Audit customer" email="shared@example.invalid" phone={null} completed /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Prepare review email for Customer A' })).toHaveAttribute('href', '/customers/Customer A/email?template=review');
    expect(screen.getByRole('link', { name: 'Prepare review email for Customer B' })).toHaveAttribute('href', '/customers/Customer B/email?template=review');
    expect(screen.getByRole('button', { name: 'Copy Google review link' })).toBeInTheDocument();
    expect(authFetchMock.mock.calls.every(([, init]) => !init)).toBe(true);
  });
  it('does not offer the shortcut for work that is not completed', async () => {
    authFetchMock.mockResolvedValue(data([card('Customer A', 'client@example.invalid')]));
    render(view('client@example.invalid'));
    await screen.findByRole('link', { name: 'Customer A' });
    expect(screen.queryByRole('link', { name: /Prepare review email/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy Google review link' })).not.toBeInTheDocument();
  });

  it('prefers a literal case-insensitive email match over substring results', async () => {
    authFetchMock.mockResolvedValue(data([card('Substring decoy', 'prefixaudit_one@example.invalid'), card('Exact customer', 'AUDIT_ONE@example.invalid')]));
    render(view('audit_one@example.invalid'));
    expect(await screen.findByRole('link', { name: 'Exact customer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Substring decoy' })).not.toBeInTheDocument();
    expect(screen.getByText('Possible customer matches')).toBeInTheDocument();
    expect(screen.getByText(/does not link or merge records/)).toBeInTheDocument();
  });

  it('prefers a normalised UK phone match without implying a saved relationship', async () => {
    authFetchMock.mockResolvedValue(data([card('Decoy', 'else@example.invalid', '077009001239'), card('Phone match', 'changed@example.invalid', '+44 7700 900123')]));
    render(view('', '07700900123'));
    expect(await screen.findByRole('link', { name: 'Phone match' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Decoy' })).not.toBeInTheDocument();
    expect(screen.queryByText('Linked customer')).not.toBeInTheDocument();
  });

  it('keeps non-exact search results clearly labelled as possible matches', async () => {
    authFetchMock.mockResolvedValue(data([card('Possible record', 'prefixaudit@example.invalid')]));
    render(view('audit@example.invalid'));
    expect(await screen.findByRole('link', { name: 'Possible record' })).toBeInTheDocument();
    expect(screen.getByText(/check the contact details/i)).toBeInTheDocument();
  });

  it('ignores a late lookup after the booking contact changes', async () => {
    let resolve!: (value: ReturnType<typeof data>) => void;
    authFetchMock.mockReturnValueOnce(new Promise((yes) => { resolve = yes; })).mockResolvedValue(data([card('Current customer', 'current@example.invalid')]));
    const result = render(view('earlier@example.invalid'));
    result.rerender(view('current@example.invalid'));
    expect(await screen.findByRole('link', { name: 'Current customer' })).toBeInTheDocument();
    await act(async () => { resolve(data([card('Earlier customer', 'earlier@example.invalid')])); });
    expect(screen.queryByRole('link', { name: 'Earlier customer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Current customer' })).toBeInTheDocument();
  });

  it('finds the original phone-only customer when an optional booking email has no match', async () => {
    authFetchMock.mockResolvedValueOnce(data([])).mockResolvedValueOnce(data([
      card('Original customer', null, '+44 7700 900974'),
      card('Phone substring decoy', null, '077009009740'),
    ]));
    render(view('new-booking@example.invalid', '07700900974'));
    expect(await screen.findByRole('link', { name: 'Original customer' })).toHaveAttribute('href', '/customers/Original customer');
    expect(authFetchMock).toHaveBeenNthCalledWith(2, '/api/customers?q=07700900974&pageSize=5');
    expect(screen.queryByRole('link', { name: 'Phone substring decoy' })).not.toBeInTheDocument();
    expect(screen.queryByText(/no customer record found/i)).not.toBeInTheDocument();
    expect(screen.getByText(/does not link or merge records/)).toBeInTheDocument();
  });

  it('does not offer a merely similar phone from the empty-email fallback', async () => {
    authFetchMock.mockResolvedValueOnce(data([])).mockResolvedValueOnce(data([card('Phone decoy', null, '077009009740')]));
    render(view('new-booking@example.invalid', '07700900974'));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/no customer record found/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Phone decoy' })).not.toBeInTheDocument();
  });

  it('ignores a late phone fallback after switching booking contact', async () => {
    let resolvePhone!: (value: ReturnType<typeof data>) => void;
    authFetchMock.mockResolvedValueOnce(data([]))
      .mockReturnValueOnce(new Promise((resolve) => { resolvePhone = resolve; }))
      .mockResolvedValueOnce(data([card('Current customer', 'current@example.invalid')]));
    const rendered = render(view('new-booking@example.invalid', '07700900974'));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    rendered.rerender(view('current@example.invalid', '07700900555'));
    await screen.findByRole('link', { name: 'Current customer' });
    await act(async () => { resolvePhone(data([card('Old phone customer', null, '07700900974')])); });
    expect(screen.queryByRole('link', { name: 'Old phone customer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Current customer' })).toBeInTheDocument();
  });

  it('refreshes the fallback if the phone changes while the optional email stays the same', async () => {
    authFetchMock.mockResolvedValueOnce(data([]))
      .mockResolvedValueOnce(data([card('Old phone customer', null, '07700900974')]))
      .mockResolvedValueOnce(data([]))
      .mockResolvedValueOnce(data([card('Current phone customer', null, '07700900555')]));
    const rendered = render(view('new-booking@example.invalid', '07700900974'));
    await screen.findByRole('link', { name: 'Old phone customer' });
    rendered.rerender(view('new-booking@example.invalid', '07700900555'));
    expect(await screen.findByRole('link', { name: 'Current phone customer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Old phone customer' })).not.toBeInTheDocument();
    expect(authFetchMock).toHaveBeenNthCalledWith(4, '/api/customers?q=07700900555&pageSize=5');
  });

  it('shows retryable failure rather than no-match when the phone fallback cannot load', async () => {
    authFetchMock.mockResolvedValueOnce(data([])).mockRejectedValueOnce(new Error('Synthetic phone lookup failed'));
    render(view('new-booking@example.invalid', '07700900974'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not look up customer matches.');
    expect(screen.queryByText(/no customer record found/i)).not.toBeInTheDocument();
  });
});
