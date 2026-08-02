// Admin runs as a separate Vercel project, so this email-safe wordmark is
// intentionally local to admin/api rather than importing from the public
// site's deployment root. Keep it visually aligned with BrandLogo.tsx.

export const BRAND_BLUE = '#1268D9';

export function emailWordmarkHtml() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" aria-label="VVE Clean" style="border-collapse:collapse;width:112px">
    <tr><td align="center" style="padding:0;color:${BRAND_BLUE};font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:800;font-style:italic;letter-spacing:-3px;line-height:30px">vve</td></tr>
    <tr><td style="padding:5px 0 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="width:25%;border-top:2px solid ${BRAND_BLUE};font-size:0;line-height:0">&nbsp;</td>
          <td align="center" style="padding:0 6px;color:${BRAND_BLUE};font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;letter-spacing:1.6px;line-height:10px;text-transform:uppercase;white-space:nowrap">CLEAN</td>
          <td style="width:25%;border-top:2px solid ${BRAND_BLUE};font-size:0;line-height:0">&nbsp;</td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}
