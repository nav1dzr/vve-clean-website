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

  it('shows an inline error instead of submitting when required fields are empty', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/please fill in all required fields/i);
    expect(fetchSpy).not.toHaveBeenCalled();
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
});
