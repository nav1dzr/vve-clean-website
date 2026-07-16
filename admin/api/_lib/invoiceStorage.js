// Supabase Storage helpers for the private `financial-documents` bucket
// created in supabase/migrations/20260722000000_create_invoice_receipt_
// tables.sql. Downloads never return a public URL — every path here is
// server-constructed from the row's own UUID (never from user input), and
// every download goes through a short-lived signed URL minted after the
// caller has already passed verifyAdminRequest().

const BUCKET = 'financial-documents';
const SIGNED_URL_TTL_SECONDS = 60;

export function invoicePdfPath(invoiceId, version) {
  return `invoices/${invoiceId}/invoice-v${version}.pdf`;
}

export function receiptPdfPath(receiptId, version) {
  return `receipts/${receiptId}/receipt-v${version}.pdf`;
}

export async function uploadPdf(supabase, path, buffer) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true, // a re-issue after a correction is a new version/path anyway; upsert only matters for retrying a failed upload of the same version
  });
  if (error) {
    console.error('[admin/api] PDF upload failed:', error.message);
    return { ok: false, error: 'Failed to store PDF' };
  }
  return { ok: true, path };
}

export async function getSignedDownloadUrl(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('[admin/api] signed URL creation failed:', error?.message);
    return { ok: false, error: 'Failed to create a download link' };
  }
  return { ok: true, url: data.signedUrl };
}
