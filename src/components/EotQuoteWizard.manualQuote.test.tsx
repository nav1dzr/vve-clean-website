import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EotQuoteWizard, { type EotBookingResult } from './EotQuoteWizard';
import { clearQuoteBasket } from '../lib/quoteBasket';

const quote: EotBookingResult['quoteConfig'] = {
  service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2', deepBaths: 2, deepWcs: 1, isHouse: true,
  eotPackage: 'tailored',
  tailoredAddOns: { microwaveInside: false, fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: true },
  addOnCounts: { sofa_2: 1, balcony: 1 },
  rooms: [
    { id: 'manual-bed-1', addonKey: 'bedroom', floor: 'carpet' },
    { id: 'manual-stairs', addonKey: 'stairs', floor: 'carpet', stairFlights: 2 },
  ],
  carpetRoomIds: ['manual-bed-1', 'manual-stairs'], windowSize: 'small', gutterType: 'terraced', officeHours: 2, condition: 'normal',
};
function message(link: HTMLElement, key: 'text' | 'body') {
  return new URL((link as HTMLAnchorElement).href).searchParams.get(key)!;
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 0; step < 3; step++) await user.click(screen.getByRole('button', { name: /^Continue$/ }));
}
beforeEach(() => { clearQuoteBasket(); sessionStorage.clear(); });

describe('manual quote contact messages', () => {
  it('gives rug enquiries their own message with the selected details and an equivalent email option', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} restoreConfig={quote} />);
    await review(user);
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp a photo' });
    const email = screen.getByRole('link', { name: 'Email about a rug' });
    const body = message(whatsapp, 'text');
    expect(body).toContain('rug cleaning assessment');
    expect(body).not.toMatch(/heavy condition|biohazard|mould/i);
    expect(body).toContain('2 beds house / maisonette · 2 bathrooms · 1 WC');
    expect(body).toContain('Package preference: Tailored');
    expect(body).toContain('Carpet areas: Bedroom, Stairs (2 flights)');
    expect(body).toContain('1 × 2-seater sofa');
    expect(body).toContain('1 × Balcony');
    expect(body).toContain('Cupboards, drawers and wardrobes');
    expect(body).not.toContain('£');
    expect(message(email, 'body')).toBe(body);
    expect(new URL((email as HTMLAnchorElement).href).pathname).toBe('contact@vveclean.co.uk');
    expect(onBook).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Request a time/ })).toBeInTheDocument();
  });

  it('describes only the selected exceptional condition, includes choices and leaves photos to the customer', async () => {
    const user = userEvent.setup();
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={quote} />);
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Heavy grease, scale or build-up' }));
    const whatsapp = screen.getByRole('link', { name: 'Send photos on WhatsApp' });
    const email = screen.getByRole('link', { name: 'Send photos by email' });
    expect(message(whatsapp, 'text')).toContain('Heavy grease, scale or build-up');
    expect(message(whatsapp, 'text')).not.toMatch(/biohazard|mould|rubbish/i);
    expect(message(whatsapp, 'text')).toContain('Carpet areas: Bedroom, Stairs (2 flights)');
    expect(message(email, 'body')).toBe(message(whatsapp, 'text'));
    expect(screen.getByText(/attach your photos before sending/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request a time/ })).not.toBeInTheDocument();
  });

  it('uses the actual large-property choice instead of a stale two-bed size in both contact options', async () => {
    const user = userEvent.setup();
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={quote} />);
    await user.click(screen.getByRole('button', { name: /5\+ bedrooms/ }));
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp us' });
    const email = screen.getByRole('link', { name: 'Request a quote by email' });
    const body = message(whatsapp, 'text');
    expect(body).toContain('5+ bedroom house / maisonette · 2 bathrooms · 1 separate WC');
    expect(body).not.toContain('2 beds');
    expect(message(email, 'body')).toBe(body);
  });
});
