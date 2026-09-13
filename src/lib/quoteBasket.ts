import { useEffect, useState } from 'react';

const KEY = 'vve_quote_basket_v1';
const EVENT = 'vve-basket-change';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
export interface QuoteBasket {
  version: 1;
  savedAt: number;
  kind: 'standard' | 'eot';
  label: string;
  href: string;
  config: Record<string, unknown>;
  step?: number;
}
const paths = new Set(['/', '/booking', '/leaflet', '/carpet-cleaning-london', '/sofa-cleaning-london', '/commercial-carpet-cleaning-london', '/end-of-tenancy-cleaning-london', '/after-builders-cleaning-london']);
let memory: QuoteBasket | null = null;

/** Requested quote selections only; no contact details, payment tokens or saved prices. */
export function readQuoteBasket(): QuoteBasket | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return memory; }
  try {
    if (!raw) return null;
    if (raw.length > 32000) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !['standard', 'eot'].includes(value.kind)
      || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() + 60000
      || Date.now() - value.savedAt > MAX_AGE || typeof value.label !== 'string'
      || value.label.length > 180 || !paths.has(value.href?.split('#')[0])
      || (value.step !== undefined && (!Number.isInteger(value.step) || value.step < 1 || value.step > 4))
      || !value.config || Array.isArray(value.config) || typeof value.config !== 'object') return null;
    return value;
  } catch { return null; }
}

export function saveQuoteBasket(draft: Omit<QuoteBasket, 'version' | 'savedAt'>) {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  const href = paths.has(pathname) ? `${pathname === '/booking' ? '/' : pathname}#quote` : '/#quote';
  const next: QuoteBasket = { ...draft, href, version: 1, savedAt: Date.now() };
  memory = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep this visit usable when browser storage is blocked. */ }
  window.dispatchEvent(new Event(EVENT));
}

export function clearQuoteBasket() {
  memory = null;
  try { localStorage.removeItem(KEY); sessionStorage.removeItem('vve_booking'); sessionStorage.removeItem('vve_restore_quote'); } catch { /* Optional storage. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function useQuoteBasket() {
  const [basket, setBasket] = useState<QuoteBasket | null>(null);
  useEffect(() => {
    const update = () => setBasket(readQuoteBasket());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return basket;
}

/** Use only keys and value types from the current UI shape when restoring browser data. */
export function restoreShape<T>(defaults: T, stored: unknown): T {
  if (Array.isArray(defaults)) return defaults;
  if (defaults && typeof defaults === 'object') {
    const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, restoreShape(value, source[key])])) as T;
  }
  if (typeof defaults === 'number') return (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : defaults) as T;
  return (typeof stored === typeof defaults && (typeof stored !== 'string' || stored.length < 100) ? stored : defaults) as T;
}
