import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';
import { mediaCaptionPresets } from '../lib/mediaCaptionPresets';
import { INVOICE_RECOVERY_CLEARED_EVENT } from '../lib/invoiceDraftRecovery';
import type { MediaAsset, MediaCategory } from '../types/media';
import Modal from './Modal';

const api = '/api/search?resource=media';
const field = 'mt-1 min-h-11 w-full rounded-lg border border-silver-300 px-3 py-2 text-base';
const button = 'min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-semibold disabled:opacity-50';
type Row = { asset: MediaAsset; title: string; altText: string; category: MediaCategory; saved: boolean; error: string };

export default function BulkMediaEditor({ assets, onClose, onDirtyChange, onBusyChange }: {
  assets: MediaAsset[];
  onClose: () => void;
  onDirtyChange: (value: boolean) => void;
  onBusyChange: (value: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => assets.map((asset) => ({
    asset, title: asset.title, altText: asset.altText, category: asset.category, saved: false, error: '',
  })));
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const inFlight = useRef(false);
  const revoked = useRef(false);
  const dirty = rows.some((row) => !row.saved && (
    row.title !== row.asset.title || row.altText !== row.asset.altText || row.category !== row.asset.category
  ));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    revoked.current = false;
    const stop = () => { revoked.current = true; };
    window.addEventListener(INVOICE_RECOVERY_CLEARED_EVENT, stop);
    return () => { stop(); window.removeEventListener(INVOICE_RECOVERY_CLEARED_EVENT, stop); };
  }, []);
  function close() {
    if (inFlight.current) return;
    if (dirty && !window.confirm('Discard the unsaved rows? Any rows already saved will remain saved.')) return;
    onDirtyChange(false);
    onClose();
  }
  function patch(id: string, values: Partial<Row>) {
    setRows((current) => current.map((row) => row.asset.id === id ? { ...row, ...values } : row));
  }
  async function save() {
    if (inFlight.current || revoked.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      for (const row of rows) {
        if (revoked.current) break;
        if (row.saved) continue;
        const input = { title: row.title.trim(), altText: row.altText.trim(), category: row.category };
        if (!input.title || !input.altText) {
          patch(row.asset.id, { error: 'Add a caption and description before saving this item.' });
          continue;
        }
        try {
          const result = await authFetch<{ asset: MediaAsset }>(api + '&id=' + row.asset.id, {
            method: 'PATCH', body: JSON.stringify({ ...input, updatedAt: row.asset.updatedAt }),
          });
          if (!revoked.current) patch(row.asset.id, { asset: result.asset, saved: true, error: '' });
        } catch (error) {
          if (revoked.current) break;
          // Check a lost acknowledgement before offering a retry. The PATCH
          // uses the original version, so a retry cannot overwrite newer edits.
          try {
            const current = await authFetch<{ asset: MediaAsset }>(api + '&id=' + row.asset.id, {
              method: 'POST', body: JSON.stringify({ action: 'details' }),
            });
            if (revoked.current) break;
            if (current.asset.title === input.title && current.asset.altText === input.altText && current.asset.category === input.category) {
              patch(row.asset.id, { asset: current.asset, saved: true, error: '' });
              continue;
            }
          } catch { /* Preserve this row and its original version for review. */ }
          if (!revoked.current) patch(row.asset.id, {
            error: error instanceof Error ? error.message : 'Could not confirm this save. Check the item before retrying.',
          });
        }
      }
    } finally {
      inFlight.current = false;
      if (!revoked.current) { setBusy(false); onBusyChange(false); }
    }
  }
  return <Modal titleId="bulk-media-title" title="Edit selected media" onClose={close} wide>
    <p className="mb-4 text-sm leading-6 text-navy-700">Review each caption and description before saving. Caption edits also update this media wherever it is already published. Each item saves separately and shows its result.</p>
    <label className="mb-3 flex items-start gap-2 text-sm">
      <input type="checkbox" checked={replace} disabled={busy} onChange={(event) => setReplace(event.target.checked)} />
      Allow suggested wording to replace captions I have already written
    </label>
    <button type="button" className={button} disabled={busy} onClick={() => setRows((current) => current.map((row) => {
      if (row.saved) return row;
      const suggestion = mediaCaptionPresets(row.category, row.asset.beforeAfter, row.asset.mediaType)[0];
      return { ...row, title: replace || !row.title.trim() ? suggestion.title : row.title,
        altText: replace || !row.altText.trim() ? suggestion.altText : row.altText };
    }))}>Fill with suggested wording</button>
    <div className="my-4 space-y-4">
      {rows.map((row) => <section key={row.asset.id} className="rounded-xl border border-silver-300 p-4">
        <h3 className="mb-2 break-words font-semibold">{row.asset.filename}</h3>
        {row.saved ? <p role="status" className="text-sm font-semibold text-emerald-800">Saved</p> : <>
          <fieldset disabled={busy}>
            <label className="block text-sm font-medium">Service for {row.asset.filename}
              <select className={field} value={row.category} onChange={(event) => patch(row.asset.id, { category: event.target.value as MediaCategory })}>
                <option value="carpet">Carpet</option><option value="sofa-upholstery">Sofa & upholstery</option><option value="end-of-tenancy">End of tenancy</option><option value="property-services">Property services</option>
              </select>
            </label>
            <label className="mt-2 block text-sm font-medium">Caption for {row.asset.filename}
              <input className={field} maxLength={120} value={row.title} onChange={(event) => patch(row.asset.id, { title: event.target.value })} />
            </label>
            <label className="mt-2 block text-sm font-medium">Description for {row.asset.filename}
              <textarea className={field} maxLength={300} value={row.altText} onChange={(event) => patch(row.asset.id, { altText: event.target.value })} />
            </label>
          </fieldset>
          {row.error && <p role="alert" className="mt-2 text-sm text-red-700">{row.error}</p>}
        </>}
      </section>)}
    </div>
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" className={button} disabled={busy} onClick={close}>Close</button>
      <button type="button" className={button + ' bg-navy-950 text-white'} disabled={busy || rows.every((row) => row.saved)}
        onClick={() => void save()}>{busy ? 'Saving items…' : 'Save unsaved items'}</button>
    </div>
  </Modal>;
}
