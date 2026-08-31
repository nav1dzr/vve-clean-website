import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  bookingBusinessText,
  bookingCustomerText,
  contactBusinessText,
  contactCustomerText,
} from '../../api/_lib/emailPlainText.js';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

// Every `transport.sendMail({ ... })` call in the public API surface. If a new
// send is added without a plain-text part, the count assertion below fails and
// points the author at this file.
const PUBLIC_SEND_PATHS = ['api/contact.js', 'api/stripe-webhook.js'];

describe('transactional email is multipart, not HTML-only', () => {
  // An HTML-only transactional message is a recognised spam heuristic: bulk
  // senders routinely omit the text/plain part, legitimate senders rarely do.
  // These four sends were HTML-only before this change.
  it.each(PUBLIC_SEND_PATHS)('%s pairs every html: body with a text: body', (path) => {
    const source = read(path);
    const htmlParts = source.match(/^\s*html:\s/gm) ?? [];
    const textParts = source.match(/^\s*text:\s/gm) ?? [];

    expect(htmlParts.length).toBeGreaterThan(0);
    expect(textParts).toHaveLength(htmlParts.length);
  });

  it.each(PUBLIC_SEND_PATHS)('%s sets a Reply-To on every send', (path) => {
    const source = read(path);
    const sends = source.match(/^\s*html:\s/gm) ?? [];
    const replyTos = source.match(/replyTo:/g) ?? [];

    expect(replyTos.length).toBe(sends.length);
  });

  it.each(PUBLIC_SEND_PATHS)('%s builds its text bodies from the shared helper', (path) => {
    expect(read(path)).toContain("from './_lib/emailPlainText.js'");
  });
});

describe('plain-text bodies carry the same facts as the HTML', () => {
  const meta = {
    fullName: 'Sam Taylor',
    email: 'sam@example.com',
    phone: '07700 900123',
    address: '12 Example Road',
    postcode: 'N1 1AA',
    date: '2026-09-14',
    time: 'Morning (8am–12pm)',
    service: 'End of tenancy cleaning',
    message: 'Two bedrooms, oven included.',
  };

  it('tells the booking customer it is a request, not a confirmed appointment', () => {
    const text = bookingCustomerText(meta, 'N1SAM140926');

    expect(text).toContain('booking request');
    expect(text).toContain('N1SAM140926');
    expect(text).toContain('confirm availability within one business hour');
    expect(text).toContain('£30 deposit comes off your final bill');
    // The deposit must never be described as securing the slot.
    expect(text).not.toMatch(/confirmed appointment|your slot is booked|guaranteed/i);
  });

  it('gives the business alert the details needed to act on a booking', () => {
    const text = bookingBusinessText(meta, 'N1SAM140926');

    expect(text).toContain('N1SAM140926');
    expect(text).toContain('Sam Taylor');
    expect(text).toContain('sam@example.com');
    expect(text).toContain('N1 1AA');
    expect(text).toContain('Two bedrooms, oven included.');
  });

  it('omits detail rows that have no value rather than printing an empty label', () => {
    const text = bookingBusinessText({ fullName: 'Sam Taylor', email: 'sam@example.com' }, 'REF1');

    expect(text).toContain('Name: Sam Taylor');
    expect(text).not.toContain('Postcode:');
    expect(text).not.toContain('Notes:');
  });

  it('acknowledges a contact enquiry without promising a response time it cannot keep', () => {
    const text = contactCustomerText({ fullName: 'Sam Taylor' });

    expect(text).toContain('Hi Sam Taylor,');
    expect(text).toContain('usually reply within the hour during working hours');
    expect(text).toContain('020 8050 2233');
  });

  it('includes the selected service in the contact business alert', () => {
    const text = contactBusinessText({
      fullName: 'Sam Taylor',
      email: 'sam@example.com',
      service: 'Carpet cleaning',
      message: 'Three rooms.',
    });

    expect(text).toContain('Service: Carpet cleaning');
    expect(text).toContain('Three rooms.');
  });

  it('signs every customer-facing body with the registered company identity', () => {
    for (const text of [
      contactCustomerText({ fullName: 'Sam Taylor' }),
      bookingCustomerText(meta, 'REF1'),
    ]) {
      expect(text).toContain('VVE Limited trading as VVE Clean');
      expect(text).toContain('17234391');
    }
  });
});
