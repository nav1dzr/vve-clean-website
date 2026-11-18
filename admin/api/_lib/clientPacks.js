import { randomUUID, randomBytes, createHash } from 'node:crypto';

export const PACK_BUCKET = 'cleaning-reports-private';
export const PACK_TABLE = 'cleaning_client_packs';
export const SIGNED_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const LIMITS = { pdf: 4 * 1024 * 1024, photo: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };
const MAX_PACK_BYTES = 500 * 1024 * 1024;
const MIMES = { pdf: ['application/pdf'], photo: ['image/jpeg', 'image/png'], video: ['video/mp4'] };
export function packError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function id(value) { if (typeof value !== 'string' || !UUID.test(value)) throw packError('A valid record reference is required.'); return value; }
function text(value, max, required = false) {
 if (value == null) value = '';
 if (typeof value !== 'string' || value.length > max || Array.from(value).some(char => { const code = char.charCodeAt(0); return code < 32 && ![9, 10, 13].includes(code); })) throw packError('A text field is invalid or too long.');
 value = value.trim(); if (required && !value) throw packError('Complete the title, customer, property and service date.'); return value;
}
export function packMetadata(input) {
 const date = text(input.serviceDate, 10, true);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw packError('Enter a valid service date.');
 return { title: text(input.title, 160, true), customer_name: text(input.customerName, 200, true), property_address: text(input.propertyAddress, 1000, true), service_date: date, summary: text(input.summary, 4000), invoice_reference: text(input.invoiceReference, 100), customer_id: input.customerId ? id(input.customerId) : null, booking_id: input.bookingId ? id(input.bookingId) : null, invoice_id: input.invoiceId ? id(input.invoiceId) : null };
}
export function validateUpload(input) {
 const { kind, mime, size } = input;
 if (!MIMES[kind]?.includes(mime) || !Number.isSafeInteger(size) || size < 1 || size > LIMITS[kind]) throw packError('Choose a PDF up to 4 MB, JPEG/PNG up to 10 MB, or MP4 up to 100 MB.');
 const stage = input.stage || 'record'; if (!['record', 'during', 'earlier', 'later'].includes(stage)) throw packError('Choose an accurate media stage.');
 return { kind, mime, size, caption: text(input.caption, 500), stage };
}
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
export function publicFields(pack, assets) {
 return { title: pack.title, customerName: pack.customer_name, serviceDate: pack.service_date, propertyAddress: pack.property_address, summary: pack.summary, invoiceReference: pack.invoice_reference, expiresAt: pack.expires_at, assets };
}
// The digest is deliberately omitted even from administrator API responses.
export function adminFields(pack) { const safe = { ...pack }; delete safe.token_hash; return safe; }
async function result(query, message = 'The client pack could not be saved. Reload before trying again.') {
 const r = await query; if (r.error) throw packError(message, 503); return r.data;
}
export async function getPack(db, packId) {
 const row = await result(db.from(PACK_TABLE).select('*').eq('id', id(packId)).maybeSingle(), 'Client pack storage is unavailable.');
 if (!row) throw packError('Client pack not found.', 404); return row;
}
export async function listPacks(db) {
 const rows = await result(db.from(PACK_TABLE).select('*').order('created_at', { ascending: false }).limit(100)); return (rows || []).map(adminFields);
}
async function references(db, data) {
 for (const [column, table] of [['customer_id', 'customers'], ['booking_id', 'bookings'], ['invoice_id', 'invoices']]) {
  if (!data[column]) continue;
  const row = await result(db.from(table).select('id').eq('id', data[column]).maybeSingle(), 'The linked record could not be checked.');
  if (!row) throw packError('A linked customer, booking or invoice does not exist.');
 }
}
async function save(db, pack, actor, changes) {
 const data = await result(db.from(PACK_TABLE).update({ ...changes, revision: pack.revision + 1, updated_at: new Date().toISOString(), updated_by: actor }).eq('id', pack.id).eq('revision', pack.revision).select('*').maybeSingle());
 if (!data) throw packError('The pack changed. Reload it before continuing.', 409); return data;
}
function editDraft(pack) { if (pack.status !== 'draft') throw packError('Published packs are fixed. Create a new draft to change their content.', 409); }
function assetKey(packId, assetId) { return `client-packs/${packId}/${assetId}`; }
function validateAssetKey(pack, asset) { if (asset.object_key !== assetKey(pack.id, id(asset.id))) throw packError('Invalid pack file reference.', 409); }
export async function actOnPack(db, actor, input) {
 id(actor); if (!input || typeof input !== 'object') throw packError('Invalid request.');
 if (input.action === 'create') {
  const metadata = packMetadata(input); await references(db, metadata);
  const row = await result(db.from(PACK_TABLE).insert({ id: randomUUID(), ...metadata, status: 'draft', revision: 1, assets: [], created_by: actor, updated_by: actor }).select('*').single());
  return { pack: adminFields(row) };
 }
 const pack = await getPack(db, input.id);
 if (!Number.isSafeInteger(input.revision) || input.revision !== pack.revision) throw packError('The pack changed. Reload it before continuing.', 409);
 if (input.action === 'update') {
  editDraft(pack); const metadata = packMetadata(input); await references(db, metadata);
  return { pack: adminFields(await save(db, pack, actor, metadata)) };
 }
 if (input.action === 'reserveUpload') {
  editDraft(pack); const data = validateUpload(input);
  if (pack.assets.length >= 30 || (data.kind === 'pdf' && pack.assets.some(a => a.kind === 'pdf'))) throw packError('Use one PDF and up to 29 media files.');
  if (pack.assets.reduce((total, a) => total + a.size, 0) + data.size > MAX_PACK_BYTES) throw packError('Keep the selected pack under 500 MB.');
  const assetId = randomUUID(); const asset = { id: assetId, ...data, ready: false, object_key: assetKey(pack.id, assetId) };
  const signed = await db.storage.from(PACK_BUCKET).createSignedUploadUrl(asset.object_key, { upsert: false });
  if (signed.error || !signed.data?.token) throw packError('The private upload could not be prepared.', 503);
  const row = await save(db, pack, actor, { assets: [...pack.assets, asset] });
  return { pack: adminFields(row), asset, upload: signed.data };
 }
 if (input.action === 'completeUpload') {
  editDraft(pack); const asset = pack.assets.find(a => a.id === id(input.assetId));
  if (!asset) throw packError('File not found in this pack.', 404); validateAssetKey(pack, asset);
  if (asset.ready) return { pack: adminFields(pack) };
  // Storage metadata comes from the server, not the browser's completion request.
  const prefix = `client-packs/${pack.id}`;
  const files = await db.storage.from(PACK_BUCKET).list(prefix, { search: asset.id, limit: 100 });
  const uploaded = files.data?.find(f => f.name === asset.id);
  if (files.error || !uploaded || Number(uploaded.metadata?.size) !== asset.size || uploaded.metadata?.mimetype !== asset.mime) throw packError('Uploaded file type or size could not be verified. Remove it and upload again.');
  return { pack: adminFields(await save(db, pack, actor, { assets: pack.assets.map(a => a.id === asset.id ? { ...a, ready: true } : a) })) };
 }
 if (input.action === 'removeAsset') {
  editDraft(pack); id(input.assetId);
  // Preserve originals; remove only the draft's selection. No storage deletion.
  return { pack: adminFields(await save(db, pack, actor, { assets: pack.assets.filter(a => a.id !== input.assetId) })) };
 }
 if (input.action === 'publish') {
  if (input.confirmed !== true) throw packError('Explicit approval is required to create a customer link.');
  if (!['draft', 'revoked'].includes(pack.status)) throw packError('Revoke the existing link before issuing a replacement.', 409);
  if (!pack.assets.length || pack.assets.filter(a => a.kind === 'pdf').length !== 1 || pack.assets.some(a => !a.ready)) throw packError('Upload and verify one PDF and every selected media file before publishing.');
  for (const asset of pack.assets) { validateUpload(asset); validateAssetKey(pack, asset); }
  const days = input.expiresInDays ?? 30; if (!Number.isInteger(days) || days < 1 || days > 90) throw packError('Choose an expiry of 1 to 90 days.');
  const token = randomBytes(32).toString('base64url');
  const row = await save(db, pack, actor, { status: 'published', token_hash: tokenHash(token), expires_at: new Date(Date.now() + days * 86400000).toISOString(), published_at: new Date().toISOString(), revoked_at: null });
  return { pack: adminFields(row), token, viewPath: `/report-view#${token}` };
 }
 if (input.action === 'revoke') {
  if (input.confirmed !== true) throw packError('Confirm that the customer link should be revoked.');
  return { pack: adminFields(await save(db, pack, actor, { status: 'revoked', token_hash: null, revoked_at: new Date().toISOString() })) };
 }
 throw packError('Unsupported client pack action.');
}
export async function viewPack(db, token, now = Date.now()) {
 const unavailable = () => packError('This viewing link is unavailable or has expired. Please contact VVE Clean.', 404);
 if (typeof token !== 'string' || !TOKEN.test(token)) throw unavailable();
 const found = await db.from(PACK_TABLE).select('*').eq('token_hash', tokenHash(token)).maybeSingle();
 if (found.error) throw packError('The viewing page is temporarily unavailable.', 503);
 const pack = found.data;
 if (!pack || pack.status !== 'published' || !pack.expires_at || Date.parse(pack.expires_at) <= now) throw unavailable();
 const seconds = Math.min(SIGNED_SECONDS, Math.floor((Date.parse(pack.expires_at) - now) / 1000));
 if (seconds < 1) throw unavailable();
 const assets = [];
 for (const asset of pack.assets) {
  if (!asset.ready) throw unavailable(); validateAssetKey(pack, asset); validateUpload(asset);
  const signed = await db.storage.from(PACK_BUCKET).createSignedUrl(asset.object_key, seconds, asset.kind === 'pdf' ? { download: 'VVE-Clean-Completion-Report.pdf' } : {});
  if (signed.error || !signed.data?.signedUrl) throw packError('A report file is temporarily unavailable.', 503);
  assets.push({ id: asset.id, kind: asset.kind, caption: asset.caption, stage: asset.stage, mime: asset.mime, size: asset.size, url: signed.data.signedUrl });
 }
 return publicFields(pack, assets);
}
