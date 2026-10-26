import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomerEmailPage from './CustomerEmailPage';
import { GOOGLE_REVIEW_URL } from '../lib/reviewRequestDraft';
import { saveCustomerEmailDraft } from '../lib/customerEmailDraft';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: request }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ admin: { id: 'owner' } }) }));
function renderPage(path = '/customers/test/email') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/customers/:id/email" element={<CustomerEmailPage />} /></Routes></MemoryRouter>); }
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
  it('prepares review wording only on a deliberate completed-work action, then uses the usual preview and send', async () => {
    renderPage('/customers/test/email?template=review');
    await screen.findByText('Test Company');
    expect(screen.getByLabelText('Message')).toHaveValue('');
    expect(request.mock.calls.every(([, init]) => !init)).toBe(true);
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use review template' }));
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(GOOGLE_REVIEW_URL);
    expect(request.mock.calls.every(([, init]) => !init)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & preview' }));
    await screen.findByText('Previewed message');
    expect(screen.getByRole('button', { name: 'Send email' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have checked the recipient/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(screen.getAllByText('Accepted by email provider').length).toBeGreaterThan(0));
    expect(request.mock.calls.filter(([, init]) => init && JSON.parse(init.body).operation === 'send')).toHaveLength(1);
  });
  it('keeps an existing message until its replacement is explicitly confirmed', async () => {
    saveCustomerEmailDraft('owner', 'test', { id: 'working', recipient: 'client@example.com', subject: 'My quote', body: 'Keep this quotation', style: 'simple' });
    renderPage('/customers/test/email?template=review');
    await screen.findByText('Test Company');
    fireEvent.click(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ }));
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeDisabled();
    expect(screen.getByLabelText('Message')).toHaveValue('Keep this quotation');
    fireEvent.click(screen.getByRole('checkbox', { name: /Replace my current subject/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use review template' }));
    expect(screen.getByLabelText('Subject')).toHaveValue('How was your clean with VVE Clean?');
  });
  it('requires fresh replacement approval after opening a different saved draft', async () => {
    saveCustomerEmailDraft('owner', 'test', { id: 'working-a', recipient: 'client@example.com', subject: 'Draft A', body: 'Keep draft A', style: 'simple' });
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => !init && url.includes('action=emails') ? Promise.resolve({ emails: [{ id: 'saved-b', recipient: 'client@example.com', subject: 'Draft B', body: 'Keep draft B', style: 'simple', status: 'draft', created_at: '2026-10-19T12:00:00Z' }], sendingConfigured: true }) : normal?.(url, init));
    renderPage('/customers/test/email?template=review');
    await screen.findByText('Test Company');
    fireEvent.click(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Replace my current subject/ }));
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open draft' }));
    expect(screen.getByLabelText('Message')).toHaveValue('Keep draft B');
    expect(screen.getByRole('checkbox', { name: /Replace my current subject/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ }));
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Replace my current subject/ }));
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeEnabled();
  });
  it('allows a phone-only customer to copy the link without creating or sending a draft', async () => {
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => !init && !url.includes('action=emails') ? Promise.resolve({ name: 'Phone customer', email: null }) : normal?.(url, init));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderPage('/customers/test/email?template=review');
    await screen.findByText('Phone customer');
    fireEvent.click(screen.getByRole('checkbox', { name: /I have completed real cleaning work/ }));
    expect(screen.getByRole('button', { name: 'Use review template' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Google review link' }));
    await screen.findByText('Review link copied. Nothing has been sent.');
    expect(writeText).toHaveBeenCalledWith(GOOGLE_REVIEW_URL);
    expect(request.mock.calls.every(([, init]) => !init)).toBe(true);
  });
  it('flags a previous uncertain review request without claiming complete history or delivery', async () => {
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => !init && url.includes('action=emails') ? Promise.resolve({ emails: [{ id: 'previous', recipient: 'client@example.com', subject: 'Review', body: GOOGLE_REVIEW_URL, style: 'branded', status: 'uncertain', created_at: '2026-10-19T12:00:00Z' }], sendingConfigured: true }) : normal?.(url, init));
    renderPage('/customers/test/email?template=review');
    await screen.findByText(/A previous review email appears in the recent history/);
    expect(screen.getByText(/This checks the latest 20 composer records only/)).toBeInTheDocument();
    expect(request.mock.calls.every(([, init]) => !init)).toBe(true);
  });
  it('does not send on edit or preview and requires explicit recipient confirmation', async () => {
    renderPage(); await compose();
    const send = screen.getByRole('button', { name: 'Send email' });
    expect(send).toBeDisabled();
    expect(request.mock.calls.some(([, init]) => init && JSON.parse(init.body).operation === 'send')).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: /I have checked the recipient/ }));
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
    fireEvent.click(screen.getByRole('checkbox', { name: /I have checked the recipient/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await screen.findByText(/The send result is unclear/);
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeDisabled();
  });
  it('blocks double-clicks while a send is in flight', async () => {
    let complete!: (value: unknown) => void;
    const normal = request.getMockImplementation();
    request.mockImplementation((url, init) => init && JSON.parse(init.body).operation === 'send' ? new Promise(resolve => { complete = resolve; }) : normal?.(url, init));
    renderPage(); await compose(); fireEvent.click(screen.getByRole('checkbox', { name: /I have checked the recipient/ }));
    const send = screen.getByRole('button', { name: 'Send email' });
    fireEvent.click(send); fireEvent.click(send);
    expect(request.mock.calls.filter(([, init]) => init && JSON.parse(init.body).operation === 'send')).toHaveLength(1);
    await act(async () => { complete({ email: { ...saved, status: 'accepted' } }); });
  });
});
