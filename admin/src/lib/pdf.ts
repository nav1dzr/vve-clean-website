// Opens a PDF Blob in a new tab via a short-lived object URL. Used for the
// draft/issued preview endpoint, which returns raw PDF bytes rather than a
// signed URL (there's nothing stored to sign a URL to for an on-demand
// preview) — see admin/api/invoices/[id]/[[...action]].js's handlePreview.
export function openPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // Revoked after a delay rather than immediately — an immediate revoke can
  // race the new tab's own load in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
