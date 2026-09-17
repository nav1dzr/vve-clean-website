import { emailWordmarkHtml } from './brandWordmark.js';
import { bookingContent, friendlyBookingDate } from '../../shared/bookingPresentation.js';
import { DEPOSIT_PENCE } from './bookingDeposit.js';

const money = (p) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(p / 100);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paragraph = (v) => esc(v).replace(/\r?\n/g, '<br>');
const headingStyle = 'margin:26px 0 12px;font-size:19px;line-height:1.4;color:#10203d';
const list = (values) => `<ul style="margin:0;padding-left:20px">${values.map(v => `<li style="margin:0 0 8px;line-height:1.6">${esc(v)}</li>`).join('')}</ul>`;
const rowsHtml = (rows) => `<table role="presentation" width="100%" style="border-collapse:collapse;table-layout:fixed">${rows.map(([k, v]) => `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #dce5ef;vertical-align:top;overflow-wrap:anywhere;font-size:15px;color:#52627c">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #dce5ef;vertical-align:top;overflow-wrap:anywhere;text-align:right;font-size:16px;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>`;

export function renderBookingEmail({ payload, heading, intro, initial, business, link, depositDue, paymentInstructions }) {
  const j = payload.journey;
  const s = j.snapshot || j.draft;
  const content = bookingContent(s);
  const preparation = ['offered', 'confirmed', 'change_pending'].includes(j.state) ? s.preparation : '';
  const balance = Math.max(0, s.totalPence - (j.paid_pence || 0) + (j.refunded_pence || 0));
  const appointment = `${friendlyBookingDate(s.date)} · ${s.time} (London time)`;
  const totalRows = [
    [initial ? 'Estimated total' : 'Total', money(s.totalPence)],
    ...(depositDue ? [['Deposit due now', money(DEPOSIT_PENCE)], ['Balance after deposit', money(Math.max(0, balance - DEPOSIT_PENCE))]] : []),
    ...(!initial && !depositDue ? [
      ...(j.paid_pence > 0 ? [['Payments received', money(j.paid_pence)]] : []),
      ...(j.refunded_pence > 0 ? [['Refunded', money(j.refunded_pence)]] : []),
      [j.state === 'cancelled' ? 'Unpaid part of original quote' : 'Remaining balance', money(balance)],
    ] : []),
  ];
  const deadline = depositDue && j.hold_until
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(j.hold_until)) + ' (London time)' : '';
  const balanceNote = initial ? '' : j.state === 'cancelled'
    ? 'The unpaid part of your quote is not a cancellation charge. We will confirm any refund separately.'
    : j.state === 'payment_review' ? 'Your payment is recorded. Please contact us before making another payment while we review your appointment.'
    : balance === 0 ? 'Your total is paid. No further payment is needed.'
    : depositDue ? 'The £30 deposit is part of your total. The balance after deposit is due on the day of your clean.'
    : j.state === 'expired' || (j.state === 'offered' && !depositDue) ? 'Please contact us to check the arrangements before making a payment.'
    : 'The remaining balance is due on the day of your clean.';
  const paymentButton = depositDue ? `<p style="margin:22px 0 10px"><a href="${esc(link + '&pay=deposit')}" style="display:block;background:#1266df;border-radius:10px;color:#fff;padding:16px 20px;text-align:center;text-decoration:none;font-weight:bold;line-height:1.4">Pay £30 deposit by card</a></p>` : '';
  const bank = paymentInstructions?.bank;
  const bankRows = bank ? [
    ['Account name', bank.accountName], ['Sort code', bank.sortCode], ['Account number', bank.accountNumber], ['Payment reference', bank.reference],
  ] : [];
  const bankNote = depositDue
    ? 'Prefer bank transfer? Send £30 using the details below. We’ll email your confirmation once we’ve checked it has arrived. If you have already transferred it, please don’t pay again.'
    : j.state === 'completed'
      ? 'You can pay the remaining balance by card from your booking page, or by bank transfer below. If you have already transferred it, please let us check receipt before paying again.'
      : 'You can use these details to pay the balance on the day of your clean. Card payment is available from your booking page once the clean is marked complete.';
  const showBank = !!paymentInstructions && balance > 0;
  const bankHtml = showBank ? `<div style="margin-top:22px;padding:20px;background:#f0f7fc;border:1px solid #dce9f5;border-radius:12px"><h2 style="margin:0 0 10px;font-size:19px">${depositDue ? 'Or pay by bank transfer' : 'Paying your balance'}</h2><p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(bankNote)}</p>${bank ? rowsHtml(bankRows) : '<p>Contact us for bank-transfer details.</p>'}${bank ? '<p style="margin:12px 0 0;font-size:14px;line-height:1.5">Please use the exact payment reference above so we can match your transfer.</p>' : ''}</div>` : '';
  const additionalHtml = `${content.details ? `<h2 style="${headingStyle}">Additional details</h2><p style="line-height:1.6;margin:0">${paragraph(content.details)}</p>` : ''}${content.exclusions ? `<h2 style="${headingStyle}">Not included</h2><p style="line-height:1.6;margin:0">${paragraph(content.exclusions)}</p>` : ''}`;
  const requestRows = j.customer_request?.kind === 'reschedule' ? [['Requested new time', `${friendlyBookingDate(j.customer_request.date)} · ${j.customer_request.time}`], ...(j.customer_request.reason ? [['Your message', j.customer_request.reason]] : [])] : [];
  const changesLabel = business ? 'Open booking in CRM' : depositDue ? 'Check details or request a change' : 'View your booking';
  const changesNote = business ? '' : depositDue
    ? 'Need a different time or want to cancel? Open your booking page to send a request before paying.'
    : ['offered', 'confirmed', 'change_pending'].includes(j.state)
      ? 'You can request a different time or cancellation from your booking page. We’ll email you once a change is confirmed.'
      : 'If you need help with these details, reply to this email and we’ll help.';
  const fullName = String(payload.name || 'there').trim() || 'there';
  const firstName = fullName.split(/\s+/)[0];
  const greeting = business ? 'VVE Clean booking update' : `Hi ${firstName.replace(/\./g, '').length > 1 ? firstName : fullName},`;
  const preheader = depositDue ? 'Check your date, cleaning list and total, then secure your slot with a £30 deposit.' : `${heading}. ${appointment}`;
  const text = [greeting, '', heading, intro, '', `Reference: ${payload.reference}`,
    ...(business ? [`Customer: ${payload.name}`] : []),
    `${initial ? 'Requested date / time' : 'Appointment'}: ${appointment}`, `Address: ${s.address}, ${s.postcode}`, `Service: ${s.service}`,
    '', 'Your cleaning includes', ...content.cleaning.map(v => `• ${v}`),
    ...(content.access.length ? ['', 'Parking and access costs', ...content.access.map(v => `• ${v}`)] : []),
    ...(content.details ? ['', 'Additional details', content.details] : []),
    ...(content.exclusions ? ['', 'Not included', content.exclusions] : []),
    ...requestRows.map(([k,v]) => `${k}: ${v}`), '', ...totalRows.map(([k,v]) => `${k}: ${v}`), balanceNote,
    ...(deadline ? [`Please pay by ${deadline}.`] : []),
    ...(depositDue ? [`Pay £30 deposit by card: ${link}&pay=deposit`] : []),
    ...(showBank ? ['', bankNote, ...bankRows.map(([k,v]) => `${k}: ${v}`), bank ? 'Please use the exact payment reference above.' : 'Contact us for bank-transfer details.'] : []),
    '', `${changesLabel}: ${link}`, changesNote,
    ...(preparation ? ['', 'Before we arrive', preparation] : []),
    '', 'Questions? Reply to this email or contact us at contact@vveclean.co.uk.', 'VVE Clean · 020 8050 2233',
  ].filter(v => v !== undefined).join('\n');
  const statusLabel = initial ? 'REQUEST RECEIVED' : depositDue ? 'YOUR SLOT · AWAITING DEPOSIT' : j.state === 'confirmed' ? 'APPOINTMENT CONFIRMED' : 'BOOKING UPDATE';
  const statusColour = j.state === 'confirmed' ? '#17644c' : '#15528a';
  const statusBackground = j.state === 'confirmed' ? '#eaf7f0' : '#edf5ff';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title><style>@media(max-width:480px){.email-padding{padding:24px 20px!important}.email-heading{font-size:26px!important}}</style></head><body style="margin:0;background:#edf3fa;color:#10203d;font-family:Arial,sans-serif;font-size:16px"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td class="email-padding" style="border-top:5px solid #1266df;padding:24px 32px;background:#ffffff">${emailWordmarkHtml()}</td></tr><tr><td class="email-padding" style="padding:28px 32px"><p style="margin:0 0 20px;font-size:11px;font-weight:bold;letter-spacing:1.2px;color:${statusColour};background:${statusBackground};padding:10px 12px;border-radius:6px">${statusLabel}</p><p style="margin:0 0 12px">${esc(greeting)}</p><h1 class="email-heading" style="margin:0 0 16px;font-size:30px;line-height:1.2">${esc(heading)}</h1><p style="margin:0 0 24px;line-height:1.65">${esc(intro)}</p><div style="padding:22px;background:#102d49;color:#ffffff;border-radius:12px"><p style="margin:0 0 7px;font-size:12px;color:#c3dfef">${initial ? 'Requested visit' : 'Your appointment'} · ${esc(payload.reference)}</p><p style="margin:0 0 5px;font-weight:bold;font-size:22px;line-height:1.4">${esc(friendlyBookingDate(s.date))}</p><p style="margin:0 0 12px;line-height:1.5">${esc(s.time)} <span style="font-size:13px">(London time)</span></p><p style="margin:0;line-height:1.5">${esc(s.address)}, ${esc(s.postcode)}</p>${business ? `<p style="margin:8px 0 0">${esc(payload.name)}</p>` : ''}</div><h2 style="${headingStyle}">${esc(s.service)}</h2><p style="margin:0 0 10px;font-weight:bold;font-size:15px">Your cleaning includes</p>${list(content.cleaning)}${content.access.length ? `<h2 style="${headingStyle}">Parking and access costs</h2>${list(content.access)}` : ''}${additionalHtml}${requestRows.length ? rowsHtml(requestRows) : ''}<div style="margin-top:26px;padding:20px;background:#f5f8fc;border:1px solid #dce5ef;border-radius:12px"><h2 style="margin:0 0 10px;font-size:19px">Your price</h2>${rowsHtml(totalRows)}</div><p style="font-size:14px;line-height:1.6;margin:12px 0 0">${esc(balanceNote)}</p>${deadline ? `<p style="font-size:14px;line-height:1.6;margin:10px 0 0"><strong>Please pay by ${esc(deadline)}.</strong></p>` : ''}${paymentButton}${bankHtml}<p style="margin:24px 0 10px"><a href="${esc(link)}" style="display:block;border:1px solid #bdccdf;border-radius:10px;color:#15528a;padding:14px 18px;text-align:center;text-decoration:none;font-weight:bold;line-height:1.4">${esc(changesLabel)}</a></p><p style="margin:0;font-size:14px;line-height:1.6;color:#52627c">${esc(changesNote)}</p>${preparation ? `<div style="margin-top:26px;padding:20px;background:#f7f9fb;border-radius:12px"><h2 style="margin:0 0 10px;font-size:19px">Before we arrive</h2><p style="margin:0;line-height:1.6">${paragraph(preparation)}</p></div>` : ''}<p style="margin:26px 0 0;font-size:14px;line-height:1.6">Questions? Reply to this email or call <a style="color:#15528a" href="tel:02080502233">020 8050 2233</a>.</p><p style="margin:8px 0 0;font-size:14px"><a style="color:#15528a" href="mailto:contact@vveclean.co.uk">contact@vveclean.co.uk</a></p><p style="font-size:12px;line-height:1.5;color:#52627c;margin-top:24px">Keep your booking link private. <a style="color:#52627c" href="${esc(link)}">Open booking details</a> · <a style="color:#52627c" href="https://www.vveclean.co.uk/terms">Booking terms</a></p></td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
