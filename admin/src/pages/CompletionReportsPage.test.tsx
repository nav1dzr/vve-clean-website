import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompletionReportsPage from './CompletionReportsPage';
import { authFetch } from '../lib/authFetch';
import type { CompletionPayload, CompletionReport } from '../types/completionReport';

vi.mock('../lib/authFetch', () => ({ authFetch: vi.fn(), authFetchBlob: vi.fn() }));
vi.mock('../lib/pdf', () => ({ openPdfBlob: vi.fn() }));
const fetchMock = vi.mocked(authFetch);
const payload: CompletionPayload = { template: 'carpet', customerName: 'Sample Company', customerEmail: 'sample@example.test', propertyAddress: 'Sample property', serviceDate: '2026-01-01', jobReference: 'TEST-REPORT-01', summary: 'Agreed carpet area cleaned.', tasks: [{ id: 'task-1', text: 'Clean the agreed carpet area', completed: true }], observations: 'One permanent mark remains.', exclusions: '', aftercare: '', internalNotes: 'PRIVATE STAFF NOTE', followUp: '', photos: [] };
const report: CompletionReport = { id: '11111111-1111-4111-8111-111111111111', booking_id: null, customer_id: null, status: 'draft', revision: 2, payload };
const bodyOf = (init?: RequestInit) => init?.body ? JSON.parse(String(init.body)) : null;
function show(url: string) { return render(<MemoryRouter initialEntries={[url]}><CompletionReportsPage /></MemoryRouter>); }

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

describe('Completion reports owner workflow', () => {
  it('never imports completed checks from booking defaults and applies unchecked template tasks', async () => {
    fetchMock.mockResolvedValue({ payload, bookingId: 'booking-test' });
    const user = userEvent.setup(); show('/completion-reports?new=1&bookingId=booking-test');
    expect(await screen.findByRole('checkbox', { name: /Completed:/ })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Use suggested checklist' }));
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it('saves the revision and explicit work selections without sending anything', async () => {
    fetchMock.mockImplementation(async (_path, init) => {
      const body = bodyOf(init);
      return body ? { report: { ...report, revision: 3, payload: body.payload } } : { report, events: [], sends: [] };
    });
    const user = userEvent.setup(); show(`/completion-reports?id=${report.id}`);
    const task = await screen.findByRole('checkbox', { name: /Completed:/ });
    await user.click(task);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved.');
    const post = fetchMock.mock.calls.map(([, init]) => bodyOf(init)).find(Boolean);
    expect(post).toMatchObject({ action: 'save', id: report.id, revision: 2, payload: { tasks: [{ id: 'task-1', completed: false }] } });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('keeps a final report read-only and requires explicit recipient approval before sending', async () => {
    fetchMock.mockImplementation(async (_path, init) => bodyOf(init) ? { send: { id: 'send-1', recipient: payload.customerEmail, status: 'accepted', created_at: '2026-01-02T10:00:00Z' } } : { report: { ...report, status: 'final' }, events: [], sends: [] });
    const user = userEvent.setup(); show(`/completion-reports?id=${report.id}`);
    expect(await screen.findByLabelText('Customer / company name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review and send email' }));
    expect(screen.getByRole('button', { name: 'Send approved email' })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByRole('checkbox', { name: /I checked the recipient/ }));
    await user.click(screen.getByRole('button', { name: 'Send approved email' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => bodyOf(init)?.action === 'send')).toBe(true));
    const sent = fetchMock.mock.calls.map(([, init]) => bodyOf(init)).find(b => b?.action === 'send');
    expect(sent).toMatchObject({ recipient: payload.customerEmail, confirmed: true, resendConfirmed: false });
    expect(JSON.stringify(sent)).not.toContain('PRIVATE STAFF NOTE');
  });

  it('retains the send operation identity after a network failure', async () => {
    fetchMock.mockImplementation(async (_path, init) => {
      if (bodyOf(init)?.action === 'send') throw new Error('Connection lost; check previous attempt.');
      return { report: { ...report, status: 'final' }, events: [], sends: [] };
    });
    const user = userEvent.setup(); show(`/completion-reports?id=${report.id}`);
    await user.click(await screen.findByRole('button', { name: 'Review and send email' }));
    await user.click(screen.getByRole('checkbox', { name: /I checked the recipient/ }));
    await user.click(screen.getByRole('button', { name: 'Send approved email' }));
    await user.click(await screen.findByRole('button', { name: 'Check previous send attempt' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => bodyOf(init)?.action === 'send')).toHaveLength(2));
    const sends = fetchMock.mock.calls.map(([, init]) => bodyOf(init)).filter(b => b?.action === 'send');
    expect(sends[0].operationId).toBe(sends[1].operationId);
    expect(screen.getByLabelText('Recipient email')).toBeDisabled();
  });

  it('links a manually selected customer and does not substitute their address for the cleaning property', async () => {
    fetchMock.mockImplementation(async (path, init) => {
      if (path.startsWith('/api/customers?q=')) return { results: [{ id: 'customer-1', name: 'Chosen Company', email: 'chosen@example.test' }] };
      const body = bodyOf(init);
      return body ? { report: { ...report, payload: body.payload, customer_id: body.customerId } } : { payload: { ...payload, tasks: [] } };
    });
    const user = userEvent.setup(); show('/completion-reports?new=1');
    await screen.findByLabelText('Customer / company name');
    await user.click(screen.getByText('Link an existing customer record (optional)'));
    await user.type(screen.getByLabelText('Search customers'), 'Chosen');
    await user.click(screen.getByRole('button', { name: 'Find customer' }));
    await user.click(await screen.findByRole('button', { name: /Use Chosen Company/ }));
    expect(screen.getByLabelText('Property cleaned')).toHaveValue('Sample property');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(fetchMock.mock.calls.map(([, init]) => bodyOf(init)).find(b => b?.action === 'create')).toMatchObject({ customerId: 'customer-1', payload: { customerName: 'Chosen Company' } }));
  });

  it('blocks browser Back from losing changed report text', async () => {
    fetchMock.mockResolvedValue({ report, events: [], sends: [] });
    const router = createMemoryRouter([{ path: '/previous', element: <p>Previous page</p> }, { path: '/completion-reports', element: <CompletionReportsPage /> }], { initialEntries: ['/previous', `/completion-reports?id=${report.id}`], initialIndex: 1 });
    render(<RouterProvider router={router} />);
    fireEvent.change(await screen.findByLabelText('Completed-service summary'), { target: { value: 'Unsaved actual work' } });
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('dialog', { name: 'Leave this report?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Completed-service summary')).toHaveValue('Unsaved actual work');
  });
});
