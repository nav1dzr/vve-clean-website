import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomerEmailPage from './CustomerEmailPage';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: request }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ admin: { id: 'owner' } }) }));
function renderPage() { return render(<MemoryRouter initialEntries={['/customers/test/email']}><Routes><Route path="/customers/:id/email" element={<CustomerEmailPage />} /></Routes></MemoryRouter>); }
let saved: Record<string, unknown> | null;
function setup() {
  saved = null;
  request.mockImplementation(async (url: string, init?: RequestInit) => {
    if (!init) return url.includes('action=emails') ? { emails: [], sendingConfigured: true } : { name: 'Test Company', email: 'client@example.com' };
    const body = JSON.parse(String(init.body));
    if (body.operation === 'preview') { saved = { ...body, status: 'draft', created_at: '2026-10-19T12:00:00Z', accepted_at: null }; return { email: saved, html: '<p>Previewed message</p>', text: body.body }; }
    return { email: { ...saved, status: 'accepted' } };
  });
}
async function compose() {
  await screen.findByText('Test Company');
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A personal quotation' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Good morning,\n\nHere is the quotation.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft & preview' }));
  await screen.findByText('Previewed message');
}
describe('customer email composer', () => {
  beforeEach(() => { sessionStorage.clear(); request.mockReset(); setup(); });
  it('does not send on edit or preview and requires explicit recipient confirmation', async () => {
    renderPage(); await compose();
    const send = screen.getByRole('button', { name: 'Send email' });
    expect(send).toBeDisabled();
    expect(request.mock.calls.some(([, init]) => init && JSON.parse(init.body).operation === 'send')).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);
    await waitFor(() => expect(screen.getAllByText('Accepted by email provider').length).toBeGreaterThan(0));
    expect(request.mock.calls.filter(([, init]) => init && JSON.parse(init.body).operation === 'send')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
  });
  it('invalidates the reviewed snapshot if wording changes', async () => {
    renderPage(); await compose();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Changed quotation' } });
    expect(screen.queryByText('Previewed message')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
  });
  it('recovers the working draft after leaving and returning', async () => {
    const first = renderPage(); await compose(); first.unmount();
    renderPage(); await screen.findByText('Test Company');
    expect(screen.getByLabelText('Subject')).toHaveValue('A personal quotation');
    expect(screen.getByLabelText('Message')).toHaveValue('Good morning,\n\nHere is the quotation.');
  });
  it('locks the send action after a timeout rather than suggesting another send', async () => {
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => init && JSON.parse(init.body).operation === 'send' ? Promise.reject(new Error('Timeout')) : normal?.(url, init));
    renderPage(); await compose();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await screen.findByText(/The send result is unclear/);
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeDisabled();
  });
  it('blocks double-clicks while a send is in flight', async () => {
    let complete!: (value: unknown) => void;
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => init && JSON.parse(init.body).operation === 'send' ? new Promise(resolve => { complete = resolve; }) : normal?.(url, init));
    renderPage(); await compose(); fireEvent.click(screen.getByRole('checkbox'));
    const send = screen.getByRole('button', { name: 'Send email' });
    fireEvent.click(send); fireEvent.click(send);
    expect(request.mock.calls.filter(([, init]) => init && JSON.parse(init.body).operation === 'send')).toHaveLength(1);
    await act(async () => { complete({ email: { ...saved, status: 'accepted' } }); });
  });
});
