// Email-safe rendering of the current VVE Clean wordmark.
//
// The website logo is composed from styled text rather than an image asset.
// Keeping the email version as inline-styled table markup avoids remote-image
// blocking in inboxes while preserving the same lowercase italic blue/white
// wordmark and the framed CLEAN sub-lockup.

const BLUE = '#1268D9';
const SKY = '#7DD3FC';

export function emailWordmarkHtml({ inverse = false } = {}) {
  const wordmarkColour = inverse ? '#FFFFFF' : BLUE;
  const detailColour = inverse ? SKY : BLUE;

  return `<table role="presentation" cellpadding="0" cellspacing="0" aria-label="VVE Clean" style="border-collapse:collapse;width:112px">
    <tr><td align="center" style="padding:0;color:${wordmarkColour};font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:800;font-style:italic;letter-spacing:-3px;line-height:30px">vve</td></tr>
    <tr><td style="padding:5px 0 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="width:25%;border-top:2px solid ${detailColour};font-size:0;line-height:0">&nbsp;</td>
          <td align="center" style="padding:0 6px;color:${detailColour};font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;letter-spacing:1.6px;line-height:10px;text-transform:uppercase;white-space:nowrap">CLEAN</td>
          <td style="width:25%;border-top:2px solid ${detailColour};font-size:0;line-height:0">&nbsp;</td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}
