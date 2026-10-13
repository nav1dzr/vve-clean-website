import type { BookingSelection } from '../components/QuoteCalculator';

const BOOKING_KEY = 'vve_booking';
const RESTORE_KEY = 'vve_restore_quote';
type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isCountMap = (value: unknown) => isRecord(value)
  && Object.keys(value).length <= 100
  && Object.values(value).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100);

function isQuoteConfig(config: unknown): config is NonNullable<BookingSelection['quoteConfig']> {
  if (!isRecord(config) || !['deep', 'window', 'gutter', 'office'].includes(String(config.service))) return false;
  // Legacy window, gutter and office quotes have no deep-service discriminator.
  // A deep clean always needs it; if provided on any quote it must be valid.
  if ((config.service === 'deep' || config.deepService !== undefined)
    && !['carpet_upholstery', 'end_of_tenancy', 'move_in', 'after_builders'].includes(String(config.deepService))) return false;
  for (const key of ['deepBaths', 'deepWcs', 'officeHours']) {
    if (config[key] !== undefined && (typeof config[key] !== 'number'
      || !Number.isFinite(config[key]) || config[key] < 0 || config[key] > 100)) return false;
  }
  for (const key of ['deepSize', 'windowSize', 'gutterType', 'propertyType', 'carpetCondition', 'eotPackage', 'condition']) {
    if (config[key] !== undefined && (typeof config[key] !== 'string' || config[key].length > 100)) return false;
  }
  for (const key of ['carpetCounts', 'addOnCounts']) {
    if (config[key] !== undefined && !isCountMap(config[key])) return false;
  }
  if (config.rooms !== undefined && (!Array.isArray(config.rooms) || config.rooms.length > 100
    || !config.rooms.every(room => isRecord(room) && typeof room.id === 'string'
      && typeof room.addonKey === 'string' && typeof room.floor === 'string'))) return false;
  if (config.carpetRoomIds !== undefined && (!Array.isArray(config.carpetRoomIds)
    || config.carpetRoomIds.length > 100 || !config.carpetRoomIds.every(id => typeof id === 'string'))) return false;
  return true;
}

/** Browser state is untrusted. Prices are still independently checked by the server. */
export function isBookingSelection(value: unknown): value is BookingSelection {
  if (!isRecord(value) || typeof value.serviceName !== 'string' || !value.serviceName.trim()
    || value.serviceName.length > 1000 || typeof value.price !== 'number'
    || !Number.isFinite(value.price) || value.price < 0 || !isQuoteConfig(value.quoteConfig)) return false;
  if (value.offerCode !== undefined && (typeof value.offerCode !== 'string' || value.offerCode.length > 100)) return false;
  for (const key of ['standardPrice', 'discountAmount', 'discountPercent', 'subtotalBeforeMinimum']) {
    if (value[key] !== undefined && (typeof value[key] !== 'number'
      || !Number.isFinite(value[key]) || value[key] < 0)) return false;
  }
  return true;
}

export interface BookingHandoff {
  selection: BookingSelection;
  quoteOrigin: string;
  restoreQuote?: boolean;
}

/** Router state carries the quote even when the browser refuses all Web Storage. */
export function bookingRouteState(selection: BookingSelection, quoteOrigin: string, restoreQuote = false) {
  return { vveBooking: { selection, quoteOrigin, restoreQuote } };
}

export function readBookingHandoff(state: unknown): BookingHandoff | null {
  if (!isRecord(state) || !isRecord(state.vveBooking)) return null;
  const handoff = state.vveBooking;
  if (!isBookingSelection(handoff.selection) || typeof handoff.quoteOrigin !== 'string') return null;
  return { selection: handoff.selection, quoteOrigin: handoff.quoteOrigin, restoreQuote: handoff.restoreQuote === true };
}

export function storeBookingSelection(selection: BookingSelection): void {
  try { sessionStorage.setItem(BOOKING_KEY, JSON.stringify(selection)); } catch { /* Router state is the handoff; storage only supports later recovery. */ }
}

function readStoredBooking(): unknown {
  try {
    const raw = sessionStorage.getItem(BOOKING_KEY);
    if (!raw || raw.length > 32000) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function readStoredBookingSelection(): BookingSelection | null {
  const value = readStoredBooking();
  return isBookingSelection(value) ? value : null;
}

/** Old quotes may contain only their inputs. The calculator recalculates them;
 * they cannot directly open a booking form without a valid selection envelope. */
export function readStoredQuoteConfig(): BookingSelection['quoteConfig'] | null {
  const value = readStoredBooking();
  return isRecord(value) && isQuoteConfig(value.quoteConfig) ? value.quoteConfig : null;
}

export function markQuoteRestore(): void {
  try { sessionStorage.setItem(RESTORE_KEY, '1'); } catch { /* Back links also carry the selection in router state. */ }
}

export function hasQuoteRestoreFlag(): boolean {
  try { return sessionStorage.getItem(RESTORE_KEY) === '1'; } catch { return false; }
}

export function clearQuoteRestoreFlag(): void {
  try { sessionStorage.removeItem(RESTORE_KEY); } catch { /* Optional storage. */ }
}
