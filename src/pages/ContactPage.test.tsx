import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ContactPage from './ContactPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <ContactPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ContactPage', () => {
  it('renders Navbar, a single main landmark and Footer — not a blank page', () => {
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('exposes click-to-call, click-to-email and WhatsApp links with the owner-supplied details', () => {
    renderPage();
    // Navbar, the info panel and the mobile sticky bar all render their own
    // tel:/WhatsApp links — assert at least one of each resolves correctly
    // rather than requiring page-wide uniqueness.
    const phoneLinks = screen.getAllByRole('link', { name: '020 8050 2233' });
    expect(phoneLinks.some((a) => a.getAttribute('href') === 'tel:02080502233')).toBe(true);
    const emailLinks = screen.getAllByRole('link', { name: 'contact@vveclean.co.uk' });
    expect(emailLinks.some((a) => a.getAttribute('href') === 'mailto:contact@vveclean.co.uk')).toBe(true);
    const waLinks = screen.getAllByRole('link', { name: /whatsapp/i });
    expect(waLinks.some((a) => (a.getAttribute('href') || '').includes('https://wa.me/447845451111'))).toBe(true);
    const text = document.body.textContent || '';
    expect(text).toContain('23–25 Queensway');
    expect(text).toContain('W2 4QP');
    expect(text).toContain('Monday – Saturday, 8am – 6pm');
  });

  it('does not claim an unsupported response time, instant reply or appointment-only policy', () => {
    renderPage();
    const text = (document.body.textContent || '').toLowerCase();
    expect(text).not.toMatch(/usually reply within the hour|instant reply|visits by appointment only/);
    // Owner supplied Monday-Saturday only — must not invent Sunday hours.
    expect(text).not.toMatch(/sunday/);
  });

  it('has a labelled, accessible form with Name, Email, Phone, Service and Message', () => {
    renderPage();
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('required');
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^phone/i)).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText(/^service/i)).toHaveAttribute('required');
    // getByLabelText alone is ambiguous here — the footer's WhatsApp link has
    // an aria-label starting with "Message" too — so scope to the textbox role.
    expect(screen.getByRole('textbox', { name: /^message/i })).toHaveAttribute('required');
  });

  it('shows a form-level summary and moves focus to the first invalid field on empty submit', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/please fix the highlighted fields/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    // "Full name" is first in DOM order, so it should receive focus.
    expect(screen.getByLabelText(/full name/i)).toHaveFocus();
  });

  it('reports a field-level error and focuses that field when only one field is invalid', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());
    renderPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^phone/i), '07845 000000');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Carpet Cleaning');
    await user.type(screen.getByRole('textbox', { name: /^message/i }), 'Two rooms, please quote.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const emailField = screen.getByLabelText(/email address/i);
    expect(emailField).toHaveFocus();
    expect(emailField).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
  });

  it('clears a field error once that field is corrected and resubmitted', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();

    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/please fix the highlighted fields/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^phone/i), '07845 000000');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Carpet Cleaning');
    await user.type(screen.getByRole('textbox', { name: /^message/i }), 'Two rooms, please quote.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/message sent/i)).toBeInTheDocument();
  });

  it('submits name, email, phone and a service-prefixed message to /api/contact, then shows success', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^phone/i), '07845 000000');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Carpet Cleaning');
    await user.type(screen.getByRole('textbox', { name: /^message/i }), 'Two rooms, please quote.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/contact');
    const body = JSON.parse(init.body);
    expect(body.fullName).toBe('Jane Smith');
    expect(body.email).toBe('jane@example.com');
    expect(body.phone).toBe('07845 000000');
    expect(body.sourcePage).toBe('/contact');
    expect(body.message).toContain('Service requested: Carpet Cleaning');
    expect(body.message).toContain('Two rooms, please quote.');

    expect(await screen.findByText(/message sent/i)).toBeInTheDocument();
  });

  it('shows a recovery message and does not crash when the network request fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    renderPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^phone/i), '07845 000000');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Carpet Cleaning');
    await user.type(screen.getByRole('textbox', { name: /^message/i }), 'Two rooms, please quote.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/something went wrong.*whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByText(/message sent/i)).not.toBeInTheDocument();
  });

  it('surfaces the server-provided error message when /api/contact responds with a failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'That email looks invalid.' }) }),
    );
    renderPage();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^phone/i), '07845 000000');
    await user.selectOptions(screen.getByLabelText(/^service/i), 'Carpet Cleaning');
    await user.type(screen.getByRole('textbox', { name: /^message/i }), 'Two rooms, please quote.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('That email looks invalid.')).toBeInTheDocument();
  });
});
