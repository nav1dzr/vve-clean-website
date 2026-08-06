import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReceiptEditorPage from './ReceiptEditorPage';

const { authFetchMock, navigateMock } = vi.hoisted(() => ({ authFetchMock: vi.fn(), navigateMock: vi.fn() }));

vi.mock('../lib/authFetch', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    authFetch: (...args: unknown[]) => authFetchMock(...args),
    ApiError: MockApiError,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(<MemoryRouter><ReceiptEditorPage /></MemoryRouter>);
}

describe('ReceiptEditorPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('explains that the flow records an existing payment without charging Stripe', () => {
    renderPage();
    expect(screen.getByText(/does not charge a card, create a balance, or change stripe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create final receipt/i })).toBeDisabled();
  });

  it('requires contact details and explicit payment confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Customer name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('What did they pay for? *'), 'End of tenancy cleaning');
    await user.type(screen.getByLabelText('Amount received (£) *'), '250');
    await user.click(screen.getByText(/I confirm this payment has already been received/i));
    await user.click(screen.getByRole('button', { name: /create final receipt/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/email address or phone number/i);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('submits a standalone receipt with a structured address and opens it', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ ok: true, receiptId: 'receipt-1', receiptNumber: 'REC-2026-000001' });
    renderPage();

    await user.type(screen.getByLabelText('Customer name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText('Address line 1'), '10 High Road');
    await user.type(screen.getByLabelText('Address line 2'), 'Flat 4');
    await user.type(screen.getByLabelText('Town or city'), 'London');
    await user.type(screen.getByLabelText('Postcode'), 'N15 2NG');
    await user.type(screen.getByLabelText('What did they pay for? *'), 'End of tenancy cleaning');
    await user.type(screen.getByLabelText('Amount received (£) *'), '250');
    await user.click(screen.getByText(/I confirm this payment has already been received/i));
    await user.click(screen.getByRole('button', { name: /create final receipt/i }));

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    const [path, options] = authFetchMock.mock.calls[0];
    expect(path).toBe('/api/receipts');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      customer: { name: 'Jane Doe', email: 'jane@example.com', address: '10 High Road\nFlat 4\nLondon', postcode: 'N15 2NG' },
      serviceDescription: 'End of tenancy cleaning',
      amount: 250,
    });
    expect(navigateMock).toHaveBeenCalledWith('/receipts/receipt-1');
  });
});
