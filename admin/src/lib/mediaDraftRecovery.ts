import type { BeforeAfter, MediaCategory } from '../types/media';

const PREFIX = 'vve-media-details:v1:';
const TTL = 24 * 60 * 60 * 1000;

export interface MediaDetails {
  title: string;
  altText: string;
  category: MediaCategory;
  beforeAfter: BeforeAfter;
  locationLabel: string;
  pairKey: string;
}
export interface MediaDetailsDraft {
  assetId: string;
  baseVersion: string;
  values: MediaDetails;
}
const key = (ownerId: string) => PREFIX + encodeURIComponent(ownerId);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;

function valid(value: unknown): value is MediaDetailsDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as MediaDetailsDraft;
  return text(draft.assetId, 100) && text(draft.baseVersion, 100) && !!draft.values
    && text(draft.values.title, 120) && text(draft.values.altText, 300)
    && text(draft.values.locationLabel, 100) && text(draft.values.pairKey, 64)
    && ['carpet', 'sofa-upholstery', 'end-of-tenancy', 'property-services'].includes(draft.values.category)
    && ['before', 'after', 'during', 'none'].includes(draft.values.beforeAfter);
}

export function readMediaDetailsDraft(ownerId: string): MediaDetailsDraft | null {
  if (!ownerId) return null;
  try {
    const raw = window.sessionStorage.getItem(key(ownerId));
    if (!raw) return null;
    if (raw.length > 6000) {
      window.sessionStorage.removeItem(key(ownerId));
      return null;
    }
    let record;
    try { record = JSON.parse(raw); }
    catch { window.sessionStorage.removeItem(key(ownerId)); return null; }
    if (!record || record.ownerId !== ownerId || !Number.isFinite(record.savedAt)
      || record.savedAt > Date.now() || Date.now() - record.savedAt > TTL || !valid(record.draft)) {
      window.sessionStorage.removeItem(key(ownerId));
      return null;
    }
    return record.draft;
  } catch { return null; }
}
export function saveMediaDetailsDraft(ownerId: string, draft: MediaDetailsDraft): boolean {
  if (!ownerId || !valid(draft)) return false;
  try {
    const value = JSON.stringify({ ownerId, savedAt: Date.now(), draft });
    window.sessionStorage.setItem(key(ownerId), value);
    return window.sessionStorage.getItem(key(ownerId)) === value;
  } catch { return false; }
}
export function clearMediaDetailsDraft(ownerId: string, assetId: string): void {
  try {
    if (readMediaDetailsDraft(ownerId)?.assetId === assetId) window.sessionStorage.removeItem(key(ownerId));
  } catch { /* Editing remains available when browser storage is blocked. */ }
}
export function clearMediaDetailsDrafts(): void {
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const name = window.sessionStorage.key(i);
      if (name?.startsWith(PREFIX)) window.sessionStorage.removeItem(name);
    }
  } catch { /* Sign-out must still complete. */ }
}
