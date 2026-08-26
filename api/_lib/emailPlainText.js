// Plain-text alternatives for transactional email.
//
// Why this exists: every public send in this repository was `html`-only.
// Nodemailer will happily send a single-part text/html message, and mailbox
// providers treat an HTML-only transactional message as a weak spam signal —
// legitimate senders almost always ship a multipart/alternative pair, bulk
// senders frequently do not. `admin/api/_lib/mailer.js` already accepts a
// `text` field; these builders give the two public paths (api/contact.js and
// api/stripe-webhook.js) the same capability from one source, so the text and
// HTML versions cannot drift apart.
//
// Nothing here changes what is promised to a customer. Each builder is a
// transcription of the corresponding HTML body — same facts, same wording.

const PHONE = '020 8050 2233';
const WHATSAPP = 'https://wa.me/447845451111';
const EMAIL = 'contact@vveclean.co.uk';
const SITE = 'https://www.vveclean.co.uk';

/** Footer block shared by every customer-facing plain-text body. */
function signature() {
  return [
    'Kind regards,',
    'VVE Clean',
    '',
    `Phone: ${PHONE}`,
    `WhatsApp: ${WHATSAPP}`,
    `Email: ${EMAIL}`,
    '',
    `VVE Limited trading as VVE Clean · ${SITE}`,
    'Registered in England and Wales, company number 17234391.',
  ].join('\n');
}

/** Render `[label, value]` pairs as an aligned "Label: value" block. */
function detailLines(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

/** Customer acknowledgement for a contact-form enquiry. */
export function contactCustomerText({ fullName }) {
  return [
    `Hi ${fullName},`,
    '',
    'Thank you for contacting VVE Clean.',
    '',
    'We have received your message and will get back to you as soon as possible.',
    'We usually reply within the hour during working hours.',
    '',
    `If your request is urgent, message us on WhatsApp (${WHATSAPP}) or call ${PHONE}.`,
    '',
    signature(),
  ].join('\n');
}

/** Internal notification for a contact-form enquiry. */
export function contactBusinessText(data) {
  return [
    `New enquiry — ${data.fullName}`,
    'Submitted via the vveclean.co.uk contact form.',
    '',
    detailLines([
      ['Full name', data.fullName],
      ['Email', data.email],
      ['Phone', data.phone || '—'],
      ['Service', data.service || '—'],
      ['Message', data.message],
      ['Marketing opt-in', data.marketingOptIn ? 'Yes' : 'No'],
      ['Source page', data.sourcePage || '/'],
    ]),
  ].join('\n');
}

/**
 * Customer acknowledgement for a paid booking request.
 *
 * The wording deliberately mirrors the site: a paid deposit buys a booking
 * *request*, and availability is confirmed separately. Do not soften this into
 * a confirmed appointment.
 */
export function bookingCustomerText(meta, bookingRef) {
  return [
    'Payment received — booking request submitted',
    '',
    `Hi ${meta.fullName || 'there'},`,
    '',
    'We have received your £30 deposit and your booking request.',
    'We will confirm availability within one business hour.',
    '',
    `Your booking reference is ${bookingRef}.`,
    '',
    detailLines([
      ['Service', meta.service_detail || meta.service],
      ['Property', meta.address],
      ['Postcode', meta.postcode],
      ['Preferred date', meta.date],
      ['Arrival window', meta.time],
    ]),
    '',
    'The £30 deposit comes off your final bill. If you need to change anything,',
    'contact us with your reference number above.',
    '',
    signature(),
  ].join('\n');
}

/** Internal notification for a paid booking request. */
export function bookingBusinessText(meta, bookingRef) {
  return [
    `New booking — ref: ${bookingRef}`,
    '',
    detailLines([
      ['Service', meta.service_detail || meta.service],
      ['Name', meta.fullName],
      ['Email', meta.email],
      ['Phone', meta.phone],
      ['Address', meta.address],
      ['Postcode', meta.postcode],
      ['Preferred date', meta.date],
      ['Arrival window', meta.time],
      ['Notes', meta.message],
    ]),
  ].join('\n');
}
