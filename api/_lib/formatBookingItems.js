// Turns an already-validated quoteConfig (the same object computePrice() in
// servicePrices.js prices — never raw browser text) into a readable,
// itemised description of what was actually booked, e.g.:
//   1 × Double mattress
//   1 × 3-seater sofa
// Used by the Telegram notification, business/customer emails, and the
// Google Sheets row. Plain JS (not TS) so api/ serverless functions can
// import it without a build step — labels are mirrored from
// src/data/carpetPricing.ts (CARPET_ITEM_DEFS) and the addOnDefs list in
// src/components/QuoteCalculator.tsx. Prices are not mirrored here; the
// checkout engine imports admin/shared/pricingCatalogue.js directly.

const CARPET_ITEM_LABELS = {
  bedroom:         'Bedroom',
  living_room:     'Living / dining room',
  large_lounge:    'Large or through lounge',
  hallway:         'Hallway',
  landing:         'Landing',
  stairs:          'Stairs',
  rug:             'Rug',
  armchair:        'Armchair',
  sofa_2:          '2-seater sofa',
  sofa_3:          '3-seater sofa',
  sofa_corner:     'Corner / L-shaped sofa',
  mattress_single: 'Mattress (single)',
  mattress_double: 'Mattress (double/king)',
};

// Rendering order — mirrors CARPET_ITEM_DEFS' order in carpetPricing.ts.
const CARPET_ITEM_ORDER = Object.keys(CARPET_ITEM_LABELS);

// Mirrors addOnDefs in QuoteCalculator.tsx.
const ADDON_LABELS = {
  oven:          'Inside oven',
  fridge:        'Fridge / freezer',
  carpet_bundle: 'Carpets — whole home',
  eot_living_carpet: 'Living / dining room carpet',
  extra_wc:      'Additional WC',
  reception:     'Additional reception room',
  conservatory:  'Conservatory',
  balcony:       'Balcony / small patio',
  utility:       'Utility room',
  eot_sofa_2:    '2-seater sofa steam clean',
  eot_sofa_3:    '3-seater sofa steam clean',
  eot_sofa_corner: 'Corner / L-shaped sofa steam clean',
  eot_mattress_single: 'Single mattress steam clean',
  eot_mattress_double: 'Double / king mattress steam clean',
  ext_windows:   'Exterior windows',
  wall_marks:    'Wall marks & scuffs',
  key_collect:   'Key collection/return',
  rubbish:       'Rubbish removal',
  sofa:          'Sofa (2–3 seats)',
  mattress:      'Mattress',
  staircase:     'Flights of stairs',
};

const DEEP_SERVICE_LABELS = {
  carpet_upholstery: 'Carpet & upholstery',
  end_of_tenancy:    'End of tenancy',
  move_in:           'Move-in deep clean',
  after_builders:    'After builders',
};

function humanizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sizeLabel(size) {
  if (size === 'studio') return 'Studio';
  if (size === 'bed5') return '5+ Bedrooms (tailored quote)';
  const m = String(size || '').match(/^bed(\d+)$/);
  return m ? `${m[1]} Bed` : humanizeKey(size);
}

function windowSizeLabel(windowSize) {
  if (windowSize === 'small')  return '1–2 Bed';
  if (windowSize === 'medium') return '3 Bed';
  if (windowSize === 'large')  return '4+ Bed';
  return humanizeKey(windowSize);
}

function carpetItemLines(carpetCounts) {
  if (!carpetCounts || typeof carpetCounts !== 'object') return [];
  const lines = [];
  for (const key of CARPET_ITEM_ORDER) {
    const qty = Number(carpetCounts[key]) || 0;
    if (qty > 0) lines.push(`${qty} × ${CARPET_ITEM_LABELS[key]}`);
  }
  // Any keys the label map doesn't recognise yet (future item types) are
  // still shown, humanised, rather than silently dropped.
  for (const [key, qty] of Object.entries(carpetCounts)) {
    if (CARPET_ITEM_LABELS[key]) continue;
    const n = Number(qty) || 0;
    if (n > 0) lines.push(`${n} × ${humanizeKey(key)}`);
  }
  return lines;
}

const EOT_SCOPE_LABELS = {
  oven: 'oven',
  fridge_freezer: 'fridge/freezer',
  cupboards: 'cupboards',
  internal_windows: 'internal windows',
};

function deepCleanLines(deepService, deepSize, deepBaths, addOnCounts, propertyType, eotScopeExclusions) {
  const lines = [];
  const size  = sizeLabel(deepSize);
  const baths = Number(deepBaths) || 1;
  const property = isEotProperty(deepService, propertyType);
  lines.push(`${DEEP_SERVICE_LABELS[deepService]} — ${property}${size}, ${baths} bathroom${baths !== 1 ? 's' : ''}`);

  const counts = addOnCounts && typeof addOnCounts === 'object' ? addOnCounts : {};
  const isEot  = deepService === 'end_of_tenancy';

  if (isEot) {
    lines.push('Oven, fridge/freezer, cupboards and internal windows included');
    if (propertyType === 'house') {
      lines.push('House/maisonette adjustment: +£35 — covers normal additional hallways, landing, internal staircase cleaning and movement between floors');
    }
    const exclusions = Array.isArray(eotScopeExclusions)
      ? eotScopeExclusions.map((key) => EOT_SCOPE_LABELS[key]).filter(Boolean)
      : [];
    if (exclusions.length > 0) {
      lines.push(`Custom scope excludes: ${exclusions.join(', ')}`);
    }
  }

  // Legacy carpet add-ons (sofa/mattress/staircase) were superseded by the
  // itemised carpet flow above but can still appear in restored sessions —
  // mirrors the exclusion list in QuoteCalculator.tsx's WhatsApp summary.
  const excluded = isEot ? ['oven', 'fridge', 'sofa', 'mattress'] : [];

  for (const [key, qty] of Object.entries(counts)) {
    if (excluded.includes(key)) continue;
    const n = Number(qty) || 0;
    if (n <= 0) continue;
    const label = ADDON_LABELS[key] || humanizeKey(key);
    lines.push(`${n} × ${label}`);
  }

  return lines;
}

function isEotProperty(deepService, propertyType) {
  if (deepService !== 'end_of_tenancy') return '';
  if (propertyType === 'house') return 'House, ';
  return 'Flat, ';
}

// Access charges (parking / Congestion Charge) — required booking questions
// that apply regardless of service. Parking is an actual-cost estimate; the
// Congestion Charge is a pass-through, never a cleaning-service fee.
function accessChargeLines(parkingAvailable, congestionZone) {
  const lines = [];
  if (parkingAvailable === 'yes') {
    lines.push('Parking: free parking available — £0');
  } else if (parkingAvailable === 'no') {
    lines.push('Parking: not available on-site — +£15 estimated parking allowance (charged at actual cost)');
  } else if (parkingAvailable === 'not_sure') {
    lines.push('Parking: not sure — +£15 estimated parking allowance (charged at actual cost)');
  }
  if (congestionZone === 'no') {
    lines.push('Congestion Charge zone: no — £0');
  } else if (congestionZone === 'yes') {
    lines.push('Congestion Charge zone — +£18 pass-through Congestion Charge');
  } else if (congestionZone === 'not_sure') {
    lines.push('Congestion Charge zone: not sure — £18 estimated pending address confirmation (pass-through Congestion Charge)');
  }
  return lines;
}

/**
 * Returns an array of readable item lines for a validated quoteConfig, e.g.
 * ["1 × Double mattress", "1 × 3-seater sofa"]. Returns [] when quoteConfig
 * is missing or has no itemisable detail — callers should fall back to the
 * broad service category (quoteConfig.service / the Stripe metadata
 * `service` string) in that case.
 */
export function formatBookingItemLines(quoteConfig) {
  if (!quoteConfig || typeof quoteConfig !== 'object') return [];

  const {
    service, deepService, deepSize, deepBaths, addOnCounts,
    windowSize, gutterType, officeHours, carpetCounts,
    propertyType, eotScopeExclusions, parkingAvailable, congestionZone,
  } = quoteConfig;

  const serviceLines = (() => {
    if (service === 'deep' && deepService === 'carpet_upholstery') {
      return carpetItemLines(carpetCounts);
    }

    if (service === 'deep' && DEEP_SERVICE_LABELS[deepService]) {
      return deepCleanLines(
        deepService,
        deepSize,
        deepBaths,
        addOnCounts,
        propertyType,
        eotScopeExclusions,
      );
    }

    if (service === 'window') {
      return [`Window cleaning — ${windowSizeLabel(windowSize)}`];
    }

    if (service === 'gutter') {
      return [`Gutter clearing — ${humanizeKey(gutterType).replace(/ /g, '-')}`];
    }

    if (service === 'office') {
      const hours = Number(officeHours) || 0;
      return hours > 0 ? [`Office cleaning — ${hours} hour${hours !== 1 ? 's' : ''}`] : [];
    }

    return [];
  })();

  if (serviceLines.length === 0) return [];

  return [...serviceLines, ...accessChargeLines(parkingAvailable, congestionZone)];
}

/**
 * Newline-joined item detail for storage (e.g. Stripe metadata / Google
 * Sheets). Falls back to fallbackService (the broad category, e.g.
 * "Carpet & upholstery · 2 items") only when no item-level detail is
 * available — never leaves the field blank.
 */
export function formatServiceDetail(quoteConfig, fallbackService) {
  const lines = formatBookingItemLines(quoteConfig);
  if (lines.length > 0) return lines.join('\n');
  return fallbackService || '';
}

/**
 * Splits a stored service-detail string (Stripe metadata value, itemised or
 * a plain fallback string) back into individual lines for rendering.
 */
export function splitServiceDetail(raw) {
  return String(raw || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
