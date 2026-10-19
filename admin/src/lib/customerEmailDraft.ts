export type EmailStyle = 'simple' | 'branded';
export interface CustomerEmailDraft { id: string; recipient: string; subject: string; body: string; style: EmailStyle }
const PREFIX = 'vve-customer-email:v1:';
const TTL = 24 * 60 * 60 * 1000;
const key = (user: string, customer: string) => PREFIX + encodeURIComponent(user) + ':' + encodeURIComponent(customer);
export function readCustomerEmailDraft(user: string, customer: string): CustomerEmailDraft | null {
  try {
    const entry = JSON.parse(sessionStorage.getItem(key(user, customer)) || 'null');
    if (!entry || !Number.isFinite(entry.savedAt) || Date.now() - entry.savedAt > TTL) { sessionStorage.removeItem(key(user, customer)); return null; }
    const d = entry.draft;
    if (!d || !['id','recipient','subject','body'].every(field => typeof d[field] === 'string') || d.body.length > 20000 || !['simple','branded'].includes(d.style)) return null;
    return d;
  } catch { return null; }
}
export function saveCustomerEmailDraft(user: string, customer: string, draft: CustomerEmailDraft): boolean {
  try { sessionStorage.setItem(key(user, customer), JSON.stringify({ savedAt: Date.now(), draft })); return true; } catch { return false; }
}
export function clearCustomerEmailDraft(user: string, customer: string) {
  try { sessionStorage.removeItem(key(user, customer)); } catch { /* Storage may be blocked. */ }
}
export function clearCustomerEmailDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k); }
  } catch { /* Sign-out must still work. */ }
}
