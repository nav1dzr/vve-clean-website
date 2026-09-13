import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceItemsForm, { emptyFormValue } from './InvoiceItemsForm';
import {
  clearInvoiceDraftRecoveries, readInvoiceDraftRecovery, writeInvoiceDraftRecovery,
  INVOICE_RECOVERY_TTL_MS, type InvoiceRecoveryContext, type InvoiceRecoverySnapshot,
} from '../lib/invoiceDraftRecovery';

vi.mock('./CatalogueItemCombobox', () => ({ default: () => null }));
vi.mock('./ServiceTemplateCombobox', () => ({ default: () => null }));

const context: InvoiceRecoveryContext = { userId: 'owner-a', documentKey: 'new', baseVersion: 'new' };
const initial = () => emptyFormValue({
  customer: { name: 'Audit Customer', email: 'customer@example.invalid', phone: '', address: '', postcode: '' },
  items: [{ key: 'line-a', description: 'Cleaning', quantity: 1, unitPrice: 100, lineDiscount: 0 }],
});
function snapshot(): InvoiceRecoverySnapshot {
  return { value: initial(), serviceContactEnabled: false, refManuallyEdited: false, rawNumerics: {} };
}
function renderForm(recovery = context, onSubmit = vi.fn().mockResolvedValue(true), value = initial()) {
  return render(<InvoiceItemsForm initial={value} recovery={recovery} onSubmit={onSubmit} submitLabel="Save draft" submitting={false} error={null} />);
}

beforeEach(() => { window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('invoice draft recovery', () => {
  it('restores exact unsaved text, service contact, manual reference and unfinished prices after a remount without sending anything', async () => {
    const submit = vi.fn();
    const first = renderForm(context, submit);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Unsaved Customer' } });
    fireEvent.click(screen.getByLabelText(/different person\/address/));
    fireEvent.change(screen.getByLabelText('Service contact name'), { target: { value: 'Other contact' } });
    fireEvent.change(screen.getByLabelText('Booking reference'), { target: { value: 'MY-REF' } });
    fireEvent.change(screen.getByLabelText('Internal notes (never printed)'), { target: { value: 'Copied details' } });
    fireEvent.change(screen.getByLabelText('Unit price (£)'), { target: { value: '85.' } });
    fireEvent(window, new Event('pagehide'));
    first.unmount();

    renderForm(context, submit);
    expect(screen.getByRole('status')).toHaveTextContent('Recovered your unsaved changes');
    expect(screen.getByLabelText('Name *')).toHaveValue('Unsaved Customer');
    expect(screen.getByLabelText('Service contact name')).toHaveValue('Other contact');
    expect(screen.getByLabelText('Internal notes (never printed)')).toHaveValue('Copied details');
    expect(screen.getByLabelText('Unit price (£)')).toHaveValue('85.');
    fireEvent.change(screen.getAllByLabelText('Postcode')[0], { target: { value: 'N15 2NG' } });
    fireEvent.change(screen.getByLabelText('Service date'), { target: { value: '2026-09-20' } });
    expect(screen.getByLabelText('Booking reference')).toHaveValue('MY-REF');
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps each user and each new/booking/customer/invoice context separate', () => {
    const saved = snapshot();
    saved.value.customer.name = 'Private unsaved customer';
    expect(writeInvoiceDraftRecovery(context, saved)).toBe(true);
    for (const other of [
      { ...context, userId: 'owner-b' },
      { ...context, documentKey: 'booking:one' },
      { ...context, documentKey: 'customer:one' },
      { ...context, documentKey: 'invoice:one' },
    ]) {
      expect(readInvoiceDraftRecovery(other).status).toBe('empty');
    }
    expect(readInvoiceDraftRecovery(context).status).toBe('recovered');
  });

  it('preserves a stale copy for review without applying it, until explicitly discarded', async () => {
    const savedContext = { ...context, documentKey: 'invoice:one', baseVersion: '1:old' };
    const saved = snapshot();
    saved.value.customer.name = 'Stale unsaved customer';
    writeInvoiceDraftRecovery(savedContext, saved);
    renderForm({ ...savedContext, baseVersion: '1:new' });
    expect(screen.getByLabelText('Name *')).toHaveValue('Audit Customer');
    expect(screen.getByText(/saved invoice changed since your local edits/)).toBeInTheDocument();
    expect((screen.getByLabelText('Earlier unsaved invoice details') as HTMLTextAreaElement).value).toContain('Stale unsaved customer');
    expect(screen.getByLabelText('Name *')).toBeDisabled();
    expect(readInvoiceDraftRecovery(savedContext).status).toBe('recovered');
    fireEvent(window, new Event('pagehide'));
    expect(readInvoiceDraftRecovery(savedContext).status).toBe('recovered');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Discard older copy and edit saved invoice' }));
    expect(screen.getByLabelText('Name *')).toBeEnabled();
    expect(readInvoiceDraftRecovery(savedContext).status).toBe('empty');
  });

  it('expires customer data after 24 hours and rejects corrupt or malformed records', () => {
    writeInvoiceDraftRecovery(context, snapshot());
    const key = window.sessionStorage.key(0)!;
    const data = JSON.parse(window.sessionStorage.getItem(key)!);
    window.sessionStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() - INVOICE_RECOVERY_TTL_MS - 1 }));
    expect(readInvoiceDraftRecovery(context).status).toBe('expired');
    window.sessionStorage.setItem(key, '{broken');
    expect(readInvoiceDraftRecovery(context).status).toBe('invalid');
    window.sessionStorage.setItem(key, JSON.stringify({ ...data, snapshot: { value: {} } }));
    expect(readInvoiceDraftRecovery(context).status).toBe('invalid');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('survives storage denial and tells the owner to save before leaving', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    renderForm();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Still editable' } });
    expect(screen.getByLabelText('Name *')).toHaveValue('Still editable');
    expect(screen.getByText(/browser cannot keep a recovery copy/)).toBeInTheDocument();
  });

  it('clears on successful save and never recreates the saved copy on a late pagehide', async () => {
    const submit = vi.fn().mockResolvedValue(true);
    renderForm(context, submit);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Saved Customer' } });
    expect(window.sessionStorage.length).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(window.sessionStorage.length).toBe(0));
    fireEvent(window, new Event('pagehide'));
    expect(window.sessionStorage.length).toBe(0);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([false, new Error('Network unavailable')])('retains edits after rejected/failed save (%s)', async (outcome) => {
    const submit = outcome instanceof Error ? vi.fn().mockRejectedValue(outcome) : vi.fn().mockResolvedValue(outcome);
    const first = renderForm(context, submit);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Keep this edit' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    first.unmount();
    renderForm();
    expect(screen.getByLabelText('Name *')).toHaveValue('Keep this edit');
  });

  it('clears on explicit discard but cancellation keeps the work', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderForm();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Temporary changes' } });
    await userEvent.click(screen.getByRole('button', { name: 'Discard unsaved changes' }));
    expect(screen.getByLabelText('Name *')).toHaveValue('Temporary changes');
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Discard unsaved changes' }));
    expect(screen.getByLabelText('Name *')).toHaveValue('Audit Customer');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears only invoice recovery on logout and prevents a still-mounted form from writing it back', () => {
    window.sessionStorage.setItem('unrelated-preference', 'keep');
    renderForm();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Private customer' } });
    act(() => clearInvoiceDraftRecoveries());
    fireEvent(window, new Event('pagehide'));
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Late event' } });
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem('unrelated-preference')).toBe('keep');
  });

  it('restored line items can be added, reordered and removed without duplicate keys or corrupting raw values', () => {
    const saved = snapshot();
    saved.value.items[0].key = 'item-1';
    saved.rawNumerics = { 'item-1': { price: '100.' } };
    writeInvoiceDraftRecovery(context, saved);
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    fireEvent.change(screen.getAllByLabelText('Description')[1], { target: { value: 'Second line' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move item 1 down' }));
    expect(screen.getAllByLabelText('Description')[0]).toHaveValue('Second line');
    expect(screen.getAllByLabelText('Unit price (£)')[1]).toHaveValue('100.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.getAllByLabelText('Description')).toHaveLength(1);
    expect(readInvoiceDraftRecovery(context).status).toBe('recovered');
  });
});
