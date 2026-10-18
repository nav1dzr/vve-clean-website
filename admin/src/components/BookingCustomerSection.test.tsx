import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingCustomerSection from './BookingCustomerSection';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args), ApiError: class extends Error {} }));
const card = (id: string, email: string, phone: string | null = null) => ({ id, name: id, email, phone });
const data = (results: ReturnType<typeof card>[]) => ({ results, page: 1, pageSize: 5, totalCount: results.length, hasMore: false });
const view = (email: string, phone: string | null = null) => <MemoryRouter><BookingCustomerSection bookingId="booking-a" fullName="Audit customer" email={email} phone={phone} /></MemoryRouter>;

describe('BookingCustomerSection', () => {
  beforeEach(() => authFetchMock.mockReset());

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
});
