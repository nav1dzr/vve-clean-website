import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManualBookingModal from './ManualBookingModal';
import { ApiError } from '../lib/authFetch';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => {
  class MockApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
  return { ApiError: MockApiError, authFetch: (...args: unknown[]) => fetchMock(...args) };
});

beforeEach(() => { sessionStorage.clear(); fetchMock.mockReset(); });

describe('manual booking payment choice', () => {
  it('opens an existing booking from expired recovery without forcing a false no-booking declaration', async () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174222';
    sessionStorage.setItem('vve-pending-manual-booking:v1:owner-test:customer-test', JSON.stringify({ review: true, owner: 'owner-test', customer: 'customer-test', requestId }));
    fetchMock.mockResolvedValue({ id: requestId, bookingRef: 'LOCAL-SAVED', quoteConfig: { manualCustomerId: 'customer-test', manualAdminId: 'owner-test' } });
    const user = userEvent.setup();
    const create = vi.fn();
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    expect(await screen.findByRole('link', { name: /Open saved booking LOCAL-SAVED/ })).toHaveAttribute('href', `/bookings/${requestId}`);
    await user.click(screen.getByRole('button', { name: 'Start a different booking' }));
    expect(screen.getByLabelText(/Service \*/)).toBeEnabled();
    expect(sessionStorage.length).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not resolve expired recovery to a booking belonging to another customer', async () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174222';
    sessionStorage.setItem('vve-pending-manual-booking:v1:owner-test:customer-test', JSON.stringify({ review: true, owner: 'owner-test', customer: 'customer-test', requestId }));
    fetchMock.mockResolvedValue({ id: requestId, bookingRef: 'WRONG-CUSTOMER', quoteConfig: { manualCustomerId: 'different', manualAdminId: 'owner-test' } });
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /Open saved booking/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create booking' })).toBeDisabled();
  });
  it('requires an explicit choice rather than assuming a deposit', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    await user.type(screen.getByLabelText(/Service \*/), 'Carpet cleaning');
    await user.click(screen.getByRole('button', { name: /^Create booking$/ }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose');
  });
  it.each(['after_clean', 'deposit_after_agreement'])('saves the explicit %s choice and arrival window without sending', async (plan) => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    await user.type(screen.getByLabelText(/Service \*/), 'Carpet cleaning');
    await user.selectOptions(screen.getByLabelText(/Payment arrangement/), plan);
    await user.type(screen.getByLabelText(/Arrival window/), '09:00–11:00');
    await user.click(screen.getByRole('button', { name: /^Create booking$/ }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ paymentPlan: plan, arrivalWindow: '09:00–11:00' })));
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('accepts an email for a phone-only customer without taking over their saved record', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" customerEmail={null} onClose={() => {}} onCreate={create} />);
    await user.type(screen.getByLabelText(/Service \*/), 'Carpet cleaning');
    await user.selectOptions(screen.getByLabelText(/Payment arrangement/), 'after_clean');
    await user.type(screen.getByLabelText(/Email for booking confirmation/), 'local@example.invalid');
    await user.click(screen.getByRole('button', { name: /^Create booking$/ }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'local@example.invalid' }));
  });
  it('restores an uncertain save after remount and retries the exact original operation', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockRejectedValueOnce(new ApiError(503, 'Connection lost')).mockResolvedValueOnce(undefined);
    const first = render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    await user.type(screen.getByLabelText(/Service \*/), 'Carpet cleaning');
    await user.selectOptions(screen.getByLabelText(/Payment arrangement/), 'after_clean');
    await user.click(screen.getByRole('button', { name: /^Create booking$/ }));
    await screen.findByText('Connection lost');
    const original = create.mock.calls[0][0];
    expect(original.requestId).toMatch(/^[0-9a-f-]{36}$/);
    first.unmount();
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    expect(screen.getByLabelText(/Service \*/)).toHaveValue('Carpet cleaning');
    expect(screen.getByLabelText(/Service \*/)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry same booking' }));
    expect(create.mock.calls[1][0]).toEqual(original);
    expect(sessionStorage.length).toBe(0);
  });
  it('allows editing after a rejected validation without retaining an uncertain operation', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockRejectedValue(new ApiError(400, 'Invalid arrival window'));
    render(<ManualBookingModal ownerId="owner-test" customerId="customer-test" onClose={() => {}} onCreate={create} />);
    await user.type(screen.getByLabelText(/Service \*/), 'Carpet cleaning');
    await user.selectOptions(screen.getByLabelText(/Payment arrangement/), 'after_clean');
    await user.click(screen.getByRole('button', { name: /^Create booking$/ }));
    await screen.findByText('Invalid arrival window');
    expect(screen.getByLabelText(/Service \*/)).toBeEnabled();
    expect(sessionStorage.length).toBe(0);
  });
});
