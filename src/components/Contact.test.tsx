import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Contact from './Contact';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const submit = () => screen.getByRole('button', { name: /send/i });

describe('Contact form — service selector', () => {
  it('offers the six services actually sold, plus an escape hatch', () => {
    render(<Contact />);

    const select = screen.getByLabelText(/service needed/i);
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

    expect(values).toEqual([
      'Please choose (optional)',
      'End of tenancy cleaning',
      'Carpet cleaning',
      'Sofa & upholstery cleaning',
      'After builders cleaning',
      'Move-in deep clean',
      'Commercial cleaning',
      'Something else',
    ]);
  });

  it('is optional, so a visitor is never blocked by it', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/message/i), 'Please quote a two-bed flat.');
    await user.click(submit());

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.service).toBe('');
  });

  it('sends the chosen service to the API', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText(/service needed/i), 'Carpet cleaning');
    await user.type(screen.getByLabelText(/message/i), 'Three rooms.');
    await user.click(submit());

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.service).toBe('Carpet cleaning');
  });

  it('has a programmatically associated label', () => {
    render(<Contact />);
    expect(screen.getByLabelText(/service needed/i).tagName).toBe('SELECT');
  });
});

describe('Contact form — entered information is preserved on failure', () => {
  it('keeps every field when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText(/service needed/i), 'Carpet cleaning');
    await user.type(screen.getByLabelText(/message/i), 'Three rooms.');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Smith');
    expect(screen.getByLabelText(/service needed/i)).toHaveValue('Carpet cleaning');
    expect(screen.getByLabelText(/message/i)).toHaveValue('Three rooms.');
  });
});

describe('Contact details', () => {
  it('states that Queensway is a registered office with no walk-ins', () => {
    const { container } = render(<Contact />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/registered office/i);
    expect(text).toMatch(/no walk-ins/i);
    expect(text).toMatch(/23-25 Queensway/);
  });

  // Sunday work happens by arrangement. "Closed" turned real enquiries away.
  it('describes Sunday as by request rather than closed', () => {
    const { container } = render(<Contact />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/Sun:\s*by request/i);
    expect(text).not.toMatch(/Sun:\s*Closed/i);
  });

  it('offers click-to-call, email and WhatsApp', () => {
    render(<Contact />);

    expect(screen.getByRole('link', { name: /020 8050 2233/ })).toHaveAttribute('href', 'tel:02080502233');
    expect(screen.getByRole('link', { name: /contact@vveclean\.co\.uk/ }))
      .toHaveAttribute('href', 'mailto:contact@vveclean.co.uk');
    expect(
      screen.getAllByRole('link', { name: /whatsapp/i })[0].getAttribute('href'),
    ).toContain('wa.me/447845451111');
  });
});
