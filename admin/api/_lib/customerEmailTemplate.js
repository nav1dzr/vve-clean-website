import { escHtml } from './escHtml.js';
import { emailWordmarkHtml } from './brandWordmark.js';

export const EMAIL_BODY_LIMIT = 20000;
export function validateCustomerEmail(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Enter the email details.' };
  const recipient = typeof input.recipient === 'string' ? input.recipient.trim() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n?/g, '\n').trim() : '';
  // One mailbox only. Never accept headers, recipient lists or display-name syntax.
  if (recipient.length > 254 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(recipient)) {
    return { ok: false, error: 'Enter one valid customer email address.' };
  }
  if (!subject || subject.length > 180 || /[\r\n]/.test(subject)) return { ok: false, error: 'Enter a subject of 1–180 characters on one line.' };
  if (!body || body.length > EMAIL_BODY_LIMIT) return { ok: false, error: 'Enter a message of 1–20,000 characters.' };
  if (!['simple', 'branded'].includes(input.style)) return { ok: false, error: 'Choose Simple or Branded.' };
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(subject + body)) return { ok: false, error: 'Remove unsupported control characters.' };
  return { ok: true, value: { recipient, subject, body, style: input.style } };
}

// Deliberately small formatting vocabulary. Escape first; raw HTML, images,
// embedded forms, tracking pixels and arbitrary URL schemes are never executed.
function inline(text) {
  return escHtml(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}
function cells(line) { return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(value => value.trim()); }
export function renderCustomerMessage(body) {
  const lines = body.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1].trim())) {
      const headings = cells(line).slice(0, 6);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i]).slice(0, headings.length)); i++; }
      const cell = (text, tag) => '<' + tag + ' style="padding:10px 8px;border-bottom:1px solid #dce5ef;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-size:13px;line-height:1.5">' + inline(text || '') + '</' + tag + '>';
      blocks.push('<table aria-label="Quotation comparison" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;table-layout:fixed;margin:20px 0"><thead style="background:#edf4fc;color:#153c68"><tr>' + headings.map(value => cell(value, 'th')).join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + headings.map((_, n) => cell(row[n], 'td')).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push('<h2 style="font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.4;color:#153c68;margin:26px 0 10px">' + inline(line.replace(/^#{1,3}\s+/, '')) + '</h2>');
      i++; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push('<li style="margin:6px 0">' + inline(lines[i].trim().replace(/^[-*]\s+/, '')) + '</li>'); i++; }
      blocks.push('<ul style="padding-left:22px;margin:12px 0 18px">' + items.join('') + '</ul>');
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,3}\s|[-*]\s|\|)/.test(lines[i].trim())) { paragraph.push(inline(lines[i])); i++; }
    if (!paragraph.length) { paragraph.push(inline(lines[i])); i++; }
    blocks.push('<p style="margin:0 0 16px;line-height:1.7">' + paragraph.join('<br>') + '</p>');
  }
  return blocks.join('');
}

// Hybrid columns keep the brand and contact details side by side in desktop
// mail clients. Inline alignment and spacing also work when email apps strip
// style blocks or render a narrow message inside a wider viewport.
function brandedHeader(settings) {
  const phone = String(settings.phone || '').trim();
  const dialNumber = phone.replace(/[^+0-9]/g, '');
  return '<div class="vve-letter-header" style="margin-bottom:26px;padding-bottom:20px;border-bottom:1px solid #dce5ef;font-size:0;line-height:0;text-align:left">' +
    '<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="middle"><![endif]-->' +
    '<div class="vve-letter-column" style="display:inline-block;width:100%;max-width:300px;padding:8px 0;vertical-align:middle">' + emailWordmarkHtml() + '</div>' +
    '<!--[if mso]></td><td width="50%" valign="middle"><![endif]-->' +
    '<div class="vve-letter-column" style="display:inline-block;width:100%;max-width:300px;padding:8px 0;vertical-align:middle"><div class="vve-letter-contact" style="text-align:left;font-family:Arial,Helvetica,sans-serif;line-height:1.6">' +
    '<div style="font-size:10px;line-height:18px;font-weight:700;letter-spacing:1px;color:#526378">CONTACT VVE CLEAN</div>' +
    (dialNumber ? '<a href="tel:' + escHtml(dialNumber) + '" style="display:block;font-size:16px;line-height:25px;font-weight:700;color:#12356d;text-decoration:none">' + escHtml(phone) + '</a>' : '') +
    '<a href="mailto:contact@vveclean.co.uk" style="display:block;font-size:12px;line-height:24px;color:#155582;text-decoration:underline">contact@vveclean.co.uk</a>' +
    '</div></div><!--[if mso]></td></tr></table><![endif]--></div>';
}

export function buildCustomerEmail(message, settings) {
  const footer = '<div style="margin-top:28px;padding-top:18px;border-top:1px solid #dce5ef;font-size:12px;line-height:1.7;color:#526378"><strong style="color:#153c68">' + escHtml(settings.tradingName) + '</strong> · Cleaning &amp; Property Services<br>' +
    '<a style="color:#155582" href="mailto:contact@vveclean.co.uk">contact@vveclean.co.uk</a> · ' + escHtml(settings.phone) + '<br>' +
    '<a style="color:#155582" href="https://www.vveclean.co.uk/">www.vveclean.co.uk</a><br>' +
    escHtml(settings.legalName) + ' · Company No. ' + escHtml(settings.companyNumber) +
    (settings.registeredAddress ? '<br>' + escHtml(settings.registeredAddress).replace(/\n/g, '<br>') : '') + '</div>';
  const branded = message.style === 'branded';
  const fragment = '<div style="box-sizing:border-box;background:' + (branded ? '#eef4fa' : '#ffffff') + ';padding:' + (branded ? '16px 8px' : '0') + ';font-family:Arial,Helvetica,sans-serif;color:#1e293b;overflow-wrap:anywhere">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;background:white;border-collapse:separate;border-spacing:0;' + (branded ? 'border-top:4px solid #1268d9;border-radius:8px;' : '') + '"><tr><td style="padding:' + (branded ? '24px 18px' : '16px 8px') + ';font-size:15px;line-height:1.7">' +
    (branded ? brandedHeader(settings) : '') +
    renderCustomerMessage(message.body) + footer + '</td></tr></table></div>';
  const text = message.body.replace(/^#{1,3}\s+/gm, '').replace(/\*\*([^*\n]+)\*\*/g, '$1') +
    '\n\n' + settings.tradingName + ' | Cleaning & Property Services\ncontact@vveclean.co.uk | ' + settings.phone +
    '\nhttps://www.vveclean.co.uk/\n' + settings.legalName + ' | Company No. ' + settings.companyNumber +
    (settings.registeredAddress ? '\n' + settings.registeredAddress : '');
  return { subject: message.subject, fragment, html: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + fragment + '</body></html>', text };
}
