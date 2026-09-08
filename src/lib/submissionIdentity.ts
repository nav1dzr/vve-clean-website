const memory = new Map<string, { fingerprint: string; id: string }>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// An essential retry key, not an advertising identifier. No form values are stored.
export async function submissionIdentity(scope: string, payload: unknown): Promise<string> {
  const body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body);
  const fingerprint = globalThis.crypto?.subtle
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) => n.toString(16).padStart(2, '0')).join('')
    : body; // Older test/browser runtimes keep this fallback in memory only.
  let existing = memory.get(scope);
  if (!existing && globalThis.crypto?.subtle) {
    try { existing = JSON.parse(sessionStorage.getItem(`vve_retry_${scope}`) || 'null'); } catch { /* Storage may be disabled. */ }
  }
  if (existing?.fingerprint === fingerprint && typeof existing.id === 'string' && UUID.test(existing.id)) {
    memory.set(scope, existing);
    return existing.id;
  }
  const id = createId();
  const value = { fingerprint, id };
  memory.set(scope, value);
  if (globalThis.crypto?.subtle) {
    try { sessionStorage.setItem(`vve_retry_${scope}`, JSON.stringify(value)); } catch { /* In-memory retry still works. */ }
  }
  return id;
}

export function clearSubmissionIdentity(scope: string): void {
  memory.delete(scope);
  try { sessionStorage.removeItem(`vve_retry_${scope}`); } catch { /* No storage access required. */ }
}
