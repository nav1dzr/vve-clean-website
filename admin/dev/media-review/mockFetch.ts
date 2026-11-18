// Synthetic, network-free state for the normal media screen. These operations
// prove visual behaviour only, not production APIs or external providers.
import type { MediaAssignment, MediaLibrary } from '../../src/types/media';
const svg = (text: string, colour: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="432"><rect width="100%" height="100%" fill="${colour}"/><text x="50%" y="46%" fill="white" font-family="Arial" font-size="44" font-weight="bold" text-anchor="middle">${text}</text><text x="50%" y="62%" fill="white" font-family="Arial" font-size="22" text-anchor="middle">VVE MEDIA TEST - NOT CUSTOMER WORK</text></svg>`);
const usage = { key: 'gallery-carpet-ba01', pageKey: 'gallery-carpet', pageLabel: 'Carpet Gallery', componentLabel: 'Before / After 01' };
const main = { key: 'completion-carpet-featured-ba01', pageKey: 'carpet-main-results', pageLabel: 'Carpet', componentLabel: 'Before / After 01' };
const asset = (id: string, extra: object = {}) => ({
  id, mediaType: 'image', status: 'ready', title: '', altText: '', service: 'Carpet cleaning', category: 'carpet',
  placement: 'gallery-carpet', beforeAfter: 'none', pairKey: '', locationLabel: '', websiteVisible: false,
  googleEnabled: false, socialEnabled: false, requestedSlotKey: null, activeSlotKey: null, usages: [],
  imageUrl: null, muxPlaybackId: null, processingError: '', createdAt: '2026-11-10T09:00:00Z',
  updatedAt: '2026-11-10T09:00:00Z', filename: `${id}.jpg`, size: 2400000, contentType: 'image/jpeg', ...extra,
});
const oldBefore = asset('a1', { title: 'Hallway carpet before cleaning', altText: 'Stained hallway carpet', beforeAfter: 'before', usages: [usage, main], imageUrl: svg('OLD BEFORE', '#7c2d12'), filename: 'IMG_2001.jpg', createdAt: '2026-10-02T09:00:00Z' });
const oldAfter = asset('a2', { title: 'Hallway carpet after cleaning', altText: 'Clean hallway carpet', beforeAfter: 'after', usages: [usage, main], imageUrl: svg('OLD AFTER', '#14532d'), filename: 'IMG_2002.jpg', createdAt: '2026-10-02T09:00:00Z' });
const newBefore = asset('a3', { title: 'Lounge carpet before cleaning', altText: 'Marked lounge carpet', beforeAfter: 'before', imageUrl: svg('NEW BEFORE', '#9a3412'), filename: 'IMG_3101.jpg' });
const newAfter = asset('a4', { title: 'Lounge carpet after cleaning', altText: 'Clean lounge carpet', beforeAfter: 'after', imageUrl: svg('NEW AFTER', '#166534'), filename: 'IMG_3102.jpg' });
const noCaption = asset('a5', { imageUrl: svg('NO CAPTION YET', '#334155'), filename: 'IMG_3200.heic', contentType: 'image/heic' });
const processing = asset('a6', { mediaType: 'video', status: 'processing', filename: 'VID_0007.mov', contentType: 'video/quicktime', size: 84000000 });
const failed = asset('a7', { status: 'failed', filename: 'IMG_3300.jpg', processingError: 'Transfer interrupted. Choose the same file and retry, or check whether the original finished uploading.' });
const slot = (n: number, kind: string, code: string, label: string, assignments: object[] = [], usages: object[] = [], publishedAt: string | null = null) =>
  ({ id: `slot-${code}`, topicKey: 'carpet', code, kind, label, sortOrder: n, assignments, usages, publishedAt });
const library = {
  unpublishEnabled: true,
  assets: [newBefore, newAfter, noCaption, processing, failed, oldBefore, oldAfter],
  assignedAssets: [oldBefore, oldAfter],
  topics: [],
  gallerySlots: [
    slot(1, 'before_after', 'BA01', 'Before / After 01', [{ assetId: 'a1', role: 'before' }, { assetId: 'a2', role: 'after' }], [usage, main], '2026-10-03T11:00:00Z'),
    slot(2, 'before_after', 'BA02', 'Before / After 02', [], [{ ...usage, key: 'gallery-carpet-ba02', componentLabel: 'Before / After 02' }]),
    slot(6, 'video', 'VIDEO01', 'Video 01'), slot(10, 'photo', 'PHOTO01', 'Grid photo 01'),
  ],
  websiteSlots: [{ id: 'w1', key: 'homepage-hero', pageLabel: 'Homepage', purposeLabel: 'Homepage Hero', description: '', sortOrder: 1, assignments: [], usages: [{ key: 'completion-homepage-hero-image', pageKey: 'homepage-hero-image', pageLabel: 'Homepage', componentLabel: 'Homepage Hero' }] }],
  references: [], nextPage: null,
};
type Version = { id: string; previous_assignments: MediaAssignment[]; published_assignments: MediaAssignment[]; created_at: string };
const key = 'vve-synthetic-media-review-20261117';
const histories: Record<string, Version[]> = {};
let state: MediaLibrary = structuredClone(library) as MediaLibrary;
try {
  const saved = localStorage.getItem(key);
  if (saved) {
    const value = JSON.parse(saved);
    state = value.library;
    Object.assign(histories, value.histories);
  }
} catch { /* Private storage: visual review remains usable for this session. */ }
function save() {
  for (const asset of state.assets) {
    asset.usages = [...state.gallerySlots, ...state.websiteSlots]
      .filter(slot => slot.assignments.some(a => a.assetId === asset.id))
      .flatMap(slot => slot.usages);
  }
  state.assignedAssets = state.assets.filter(a => a.usages.length);
  try { localStorage.setItem(key, JSON.stringify({ library: state, histories })); } catch { /* Session only. */ }
}
const copy = <T,>(value: unknown) => structuredClone(value) as T;
export async function authFetch<T>(url: string, init?: RequestInit): Promise<T> {
  if (!url.startsWith('/api/search?')) throw new Error('Only the synthetic media route is available.');
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (!init || init.method === 'GET') return copy<T>(state);
  const body = JSON.parse(typeof init.body === 'string' ? init.body : '{}');
  const id = new URL(url, 'http://127.0.0.1').searchParams.get('id');
  const item = state.assets.find(a => a.id === id);
  if (init.method === 'PATCH' && item) {
    const allowed = ['title', 'altText', 'service', 'category', 'placement', 'beforeAfter', 'pairKey', 'locationLabel'];
    Object.assign(item, Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k))), { updatedAt: new Date().toISOString() });
    save(); return copy<T>({ asset: item });
  }
  if (body.action === 'details') return copy<T>({ asset: item });
  if (body.action === 'history') return copy<T>({ history: histories[body.targetId] || [] });
  if (body.action === 'sync') return copy<T>({ status: 'processing' });
  if ((body.action === 'archive' || body.action === 'restore') && item) {
    if (item.usages.length) throw new Error('Replace its published positions before archiving.');
    item.status = body.action === 'archive' ? 'archived' : 'ready';
    save(); return copy<T>({ asset: item });
  }
  if (body.action === 'assign' || body.action === 'unpublish') {
    const target = [...state.gallerySlots, ...state.websiteSlots].find(s => s.id === body.targetId);
    if (!target) throw new Error('Unknown sample position.');
    const old = target.assignments;
    const previous = body.historyId ? histories[target.id]?.find(h => h.id === body.historyId)?.previous_assignments : undefined;
    const next = body.action === 'unpublish' ? [] : previous || body.assignments;
    if (!Array.isArray(next)) throw new Error('Choose sample media first.');
    if (body.preview) return copy<T>({ replacement: old.length > 0, expected: old, impact: target.usages, selections: next, assets: state.assets.filter(a => next.some((n: MediaAssignment) => n.assetId === a.id)) });
    if (!body.confirm) throw new Error('Review and confirm this sample change first.');
    if (JSON.stringify(body.expected) !== JSON.stringify(old)) throw new Error('Position changed. Review it again.');
    (histories[target.id] ||= []).unshift({ id: crypto.randomUUID(), previous_assignments: structuredClone(old), published_assignments: structuredClone(next), created_at: new Date().toISOString() });
    target.assignments = next;
    target.publishedAt = next.length ? new Date().toISOString() : null;
    save(); return copy<T>({ published: true, unpublished: body.action === 'unpublish' });
  }
  throw new Error('This local review does not upload files or contact any provider. Use the recorded provider-test evidence separately.');
}
