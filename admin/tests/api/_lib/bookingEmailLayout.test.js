import { describe, expect, it } from 'vitest';
import { renderBookingEmail } from '../../../api/_lib/bookingEmailLayout.js';
import { bookingContent, friendlyBookingDate } from '../../../shared/bookingPresentation.js';

const snapshot = {
  service: 'Carpet cleaning', items: '1 × Bedroom\n1 × Landing\nParking: free parking available — £0\nCongestion Charge zone — +£18 pass-through Congestion Charge',
  scope: 'Clean the items and areas listed above. Any additional work or change in price will be agreed with you before it is carried out.',
  exclusions: '', date: '2026-10-10', time: '09:00–11:00', address: 'Example address', postcode: 'E1 1AA', totalPence: 21200, preparation: 'Please clear small belongings.',
};
const build = (patch = {}, options = {}) => renderBookingEmail({
  payload: { name: 'Example Customer', reference: 'EXAMPLE', journey: { snapshot, paid_pence: 0, refunded_pence: 0, state: 'offered', hold_until: '2026-10-09T10:00:00Z', ...patch } },
  heading: 'Please check your booking details', intro: 'Please check your details.', initial: false, business: false, link: 'https://example.invalid/manage#token=preview', depositDue: true, paymentInstructions: null, ...options,
});

describe('customer booking presentation', () => {
  it.each(['P', 'P.', 'P. J.', 'PJ', 'Paul Example'])('uses the full entered name without guessing: %s', (name) => {
    const email = build({}, { payload: { name, reference: 'EXAMPLE', journey: { snapshot, state: 'offered', paid_pence: 0, refunded_pence: 0 } } });
    expect(email.text.startsWith(`Hello ${name},`)).toBe(true);
  });
  it('places the escaped reference in the header before the greeting', () => {
    const email = build();
    expect(email.html.indexOf('Booking reference')).toBeLessThan(email.html.indexOf('Hello Example Customer,'));
    expect(email.html).not.toContain('Your appointment · EXAMPLE');
  });
  it('keeps the surname when the customer uses an initial', () => {
    const email = build({}, { payload: { name: 'P. Example', reference: 'EXAMPLE', journey: { snapshot, state: 'offered', paid_pence: 0, refunded_pence: 0 } } });
    expect(email.text).toContain('Hello P. Example,');
    expect(email.html).toContain('Hello P. Example,');
  });
  it('separates saved access charges without inventing or changing their amounts', () => {
    const original = structuredClone(snapshot);
    const content = bookingContent(snapshot);
    expect(content.cleaning).toEqual(['1 × Bedroom', '1 × Landing']);
    expect(content.access).toEqual(['Parking: free parking available — £0', 'Congestion Charge zone — +£18 pass-through Congestion Charge']);
    expect(content.details).toBe('');
    expect(snapshot).toEqual(original);
  });
  it('preserves custom agreement notes, exclusions, unknown lines and explicit access text', () => {
    expect(bookingContent({ items: 'Curtains by agreement\nParking: £12', scope: 'Do not move the piano.', exclusions: 'Box room excluded.', accessNotes: 'Parking: £12\nCollect keys from concierge.' })).toEqual({ cleaning: ['Curtains by agreement'], access: ['Parking: £12', 'Collect keys from concierge.'], details: 'Do not move the piano.', exclusions: 'Box room excluded.' });
  });
  it('shows a projected balance, not a fictitious payment, on an unpaid request', () => {
    const email = build();
    expect(email.text).toContain('Total: £212.00');
    expect(email.text).toContain('Deposit due now: £30.00');
    expect(email.text).toContain('Balance after deposit: £182.00');
    expect(email.text).not.toMatch(/Payments received:|Refunded:|Remaining balance:|Agreed total:|Scope:/);
    expect(email.text).toContain('on the day of your clean');
    expect(email.html).not.toContain('<td style="padding:10px 12px 10px 0;border-bottom:1px solid #dce5ef;vertical-align:top;font-size:15px;color:#52627c">Preparation');
    expect(email.html).toContain('Before we arrive');
  });
  it('shows actual payments and refunds without subtracting the deposit twice', () => {
    const email = build({ state: 'confirmed', paid_pence: 3000, refunded_pence: 1000 }, { depositDue: false });
    expect(email.text).toContain('Payments received: £30.00');
    expect(email.text).toContain('Refunded: £10.00');
    expect(email.text).toContain('Remaining balance: £192.00');
    expect(email.text).not.toContain('Balance after deposit');
    expect(email.text).not.toContain('Deposit due now');
  });
  it('keeps cancellation amounts distinct from a demand for payment', () => {
    const email = build({ state: 'cancelled', paid_pence: 3000 }, { depositDue: false });
    expect(email.text).toContain('Unpaid part of original quote: £182.00');
    expect(email.text).toContain('not a cancellation charge');
    expect(email.text).not.toContain('is due on the day');
    expect(email.html).not.toContain('Before we arrive');
    expect(email.text).not.toContain(snapshot.preparation);
  });
  it('does not ask for a balance when the deposit covers the full total', () => {
    const email = build({ state: 'confirmed', snapshot: { ...snapshot, totalPence: 3000 }, paid_pence: 3000 }, { depositDue: false });
    expect(email.text).toContain('Your total is paid. No further payment is needed.');
    expect(email.text).not.toContain('balance is due');
  });
  it('escapes all custom text in HTML and formats dates for people', () => {
    const email = build({ snapshot: { ...snapshot, items: '<img src=x onerror=alert(1)>', accessNotes: '<script>bad</script>', scope: 'Custom & notes' } });
    expect(email.html).not.toContain('<script>bad');
    expect(email.html).toContain('&lt;img');
    expect(email.html).toContain('Custom &amp; notes');
    expect(friendlyBookingDate('2026-10-10')).toBe('Saturday, 10 October 2026');
    expect(friendlyBookingDate('2026-02-30')).toBe('2026-02-30');
    expect(friendlyBookingDate('Flexible')).toBe('Flexible');
  });
});
