import { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackBookingInitiated } from '../lib/analytics';
import { Calculator, CheckCircle2, Plus, Minus, Info, AlertCircle, ChevronDown, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useBookingCtx } from '../context/BookingContext';
import { rememberQuoteOrigin } from '../lib/quoteOrigin';
import { useReveal } from '../hooks/useReveal';
import type { HomepageQuoteService } from './HomeServiceSelector';
import {
  CARPET_GROUPS,
  CARPET_MIN_BOOKING,
  DISCOUNT_MIN_NOTE,
  computeCarpetPrice,
  itemLinePrice,
  type CarpetCondition,
  type CarpetCounts,
  type CarpetItem,
} from '../data/carpetPricing';
import {
  EOT_BASE_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_EXTRA_AREAS_P,
  EOT_CARPET_BUNDLE_P,
  EOT_SCOPE_CREDITS_P,
  EOT_HOUSE_ADJUSTMENT_P,
  eotScopeCreditPence,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  AFTER_BUILDERS_FROM_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  ADDON_PRICES_P,
  EOT_CARPET_ADDON_PRICES_P,
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_HOURS,
  CARPET_BUNDLE_TIERS,
  CARPET_ITEM_PRICES_P,
} from '../data/pricing';

// ─── Pricing engine (non-carpet services) ────────────────────────────────────

const MIN_CHARGE = 90;
const WA_BASE    = 'https://wa.me/447845451111';

type DeepServiceType = 'carpet_upholstery' | 'end_of_tenancy' | 'move_in' | 'after_builders';
type SizeKey         = 'studio' | 'bed1' | 'bed2' | 'bed3' | 'bed4';

// carpet_upholstery listed first so it renders first in the Service Type grid
const DEEP_SERVICE_LABELS: Record<DeepServiceType, string> = {
  carpet_upholstery: 'Carpet & upholstery',
  end_of_tenancy:    'End of tenancy',
  move_in:           'Move-in deep clean',
  after_builders:    'After builders',
};

// Prices in £ derived from the canonical pence values in pricing.ts.
const BASE_PRICES: Record<DeepServiceType, Record<SizeKey, number>> = {
  carpet_upholstery: { studio:  90, bed1: 150, bed2: 210, bed3: 270, bed4: 330 }, // unused — carpet uses computeCarpetPrice
  end_of_tenancy:    {
    studio: EOT_BASE_PRICES_P.studio / 100,  // 229
    bed1:   EOT_BASE_PRICES_P.bed1   / 100,  // 299
    bed2:   EOT_BASE_PRICES_P.bed2   / 100,  // 369
    bed3:   EOT_BASE_PRICES_P.bed3   / 100,  // 449
    bed4:   EOT_BASE_PRICES_P.bed4   / 100,  // 549
  },
  move_in: {
    studio: MOVEIN_BASE_PRICES_P.studio / 100,  // 179
    bed1:   MOVEIN_BASE_PRICES_P.bed1   / 100,  // 219
    bed2:   MOVEIN_BASE_PRICES_P.bed2   / 100,  // 269
    bed3:   MOVEIN_BASE_PRICES_P.bed3   / 100,  // 329
    bed4:   MOVEIN_BASE_PRICES_P.bed4   / 100,  // 429
  },
  // after_builders uses "from" prices — BASE_PRICES is not used for quoting
  after_builders: {
    studio: AFTER_BUILDERS_FROM_PRICES_P.studio / 100,  // 279
    bed1:   AFTER_BUILDERS_FROM_PRICES_P.bed1   / 100,  // 329
    bed2:   AFTER_BUILDERS_FROM_PRICES_P.bed2   / 100,  // 399
    bed3:   AFTER_BUILDERS_FROM_PRICES_P.bed3   / 100,  // 499
    bed4:   AFTER_BUILDERS_FROM_PRICES_P.bed4   / 100,  // 625
  },
};

const BATH_SURCHARGE: Record<DeepServiceType, number> = {
  carpet_upholstery: 0,
  end_of_tenancy:    EOT_EXTRA_BATH_P     / 100,  // 50
  move_in:           MOVEIN_EXTRA_BATH_P  / 100,  // 40
  after_builders:    0, // not quoted interactively
};

// EOT carpet add-on bundle prices (whole home — at reduced EOT rates).
const CARPET_BUNDLE_PRICE: Record<SizeKey, number> = {
  studio: EOT_CARPET_BUNDLE_P.studio / 100,  // 60
  bed1:   EOT_CARPET_BUNDLE_P.bed1   / 100,  // 60
  bed2:   EOT_CARPET_BUNDLE_P.bed2   / 100,  // 100
  bed3:   EOT_CARPET_BUNDLE_P.bed3   / 100,  // 150
  bed4:   EOT_CARPET_BUNDLE_P.bed4   / 100,  // 195
};

const _stairFirst = EOT_CARPET_ADDON_PRICES_P.stairs_first / 100;  // 45
const _stairExtra = EOT_CARPET_ADDON_PRICES_P.stairs_extra / 100;  // 35
const STAIR_PRICES = [0, _stairFirst, _stairFirst + _stairExtra, _stairFirst + 2 * _stairExtra];

const windowPrices: Record<string, number> = { small: 35, medium: 45, large: 55 };
const gutterPrices: Record<string, number>  = { terraced: 75, semi_detached: 110, detached: 160 };
const HOURLY_RATE      = COMMERCIAL_REGULAR_HOURLY_P / 100;  // 27.50
const MIN_OFFICE_HOURS = COMMERCIAL_REGULAR_MIN_HOURS;       // 2

const addOnDefs = [
  { key: 'oven',          label: 'Inside oven',           price: ADDON_PRICES_P.oven        / 100 },  // 35
  { key: 'fridge',        label: 'Fridge / freezer',      price: ADDON_PRICES_P.fridge      / 100 },  // 20
  { key: 'carpet_bundle', label: 'Carpets — whole home',  price: 0  },
  { key: 'eot_living_carpet', label: 'Living / dining room carpet', price: EOT_CARPET_ADDON_PRICES_P.living_room / 100 },
  { key: 'extra_wc',      label: 'Additional WC',         price: EOT_EXTRA_WC_P / 100 },
  { key: 'reception',     label: 'Additional reception room', price: EOT_EXTRA_AREAS_P.reception / 100 },
  { key: 'conservatory',  label: 'Conservatory',          price: EOT_EXTRA_AREAS_P.conservatory / 100 },
  { key: 'balcony',       label: 'Balcony / small patio', price: EOT_EXTRA_AREAS_P.balcony / 100 },
  { key: 'utility',       label: 'Utility room',          price: EOT_EXTRA_AREAS_P.utility / 100 },
  { key: 'ext_windows',   label: 'Exterior windows',      price: ADDON_PRICES_P.ext_windows / 100 },  // 35
  { key: 'wall_marks',    label: 'Wall marks & scuffs',   price: ADDON_PRICES_P.wall_marks  / 100 },  // 25
  { key: 'key_collect',   label: 'Key collection/return', price: ADDON_PRICES_P.key_collect / 100 },  // 10
  { key: 'eot_sofa_2',    label: '2-seater sofa steam clean',       price: CARPET_ITEM_PRICES_P.sofa_2 / 100 },
  { key: 'eot_sofa_3',    label: '3-seater sofa steam clean',       price: CARPET_ITEM_PRICES_P.sofa_3 / 100 },
  { key: 'eot_sofa_corner', label: 'Corner / L-shaped sofa steam clean', price: CARPET_ITEM_PRICES_P.sofa_corner / 100 },
  { key: 'eot_mattress_single', label: 'Single mattress steam clean', price: CARPET_ITEM_PRICES_P.mattress_single / 100 },
  { key: 'eot_mattress_double', label: 'Double / king mattress steam clean', price: CARPET_ITEM_PRICES_P.mattress_double / 100 },
  { key: 'rubbish',       label: 'Rubbish removal',       price: ADDON_PRICES_P.rubbish     / 100 },  // 40
  // legacy carpet add-ons (kept for quoteConfig backward compat)
  { key: 'sofa',     label: 'Sofa (2–3 seats)',    price: 40 },
  { key: 'mattress', label: 'Mattress',             price: 25 },
  { key: 'staircase', label: 'Flights of stairs',  price: 45 },
];

const EOT_INCLUDED_ITEMS = [
  'Oven, hob, grill and extractor',
  'Inside emptied fridge and defrosted freezer',
  'Dishwasher and washing-machine accessible compartments',
  'Cupboards, drawers and wardrobes inside and outside',
  'Internal windows, frames and sills',
  'Kitchen and bathroom descaling',
  'Skirting, doors, handles, switches and sockets',
  'Vacuuming, mopping, products and equipment',
] as const;

const EOT_SCOPE_OPTIONS = [
  { key: 'oven', label: 'Oven is already inspection-ready', credit: EOT_SCOPE_CREDITS_P.oven / 100 },
  { key: 'fridge_freezer', label: 'Fridge/freezer is empty and inspection-ready', credit: EOT_SCOPE_CREDITS_P.fridge_freezer / 100 },
  { key: 'cupboards', label: 'Empty cupboards are already inspection-ready', credit: EOT_SCOPE_CREDITS_P.cupboards / 100 },
  { key: 'internal_windows', label: 'Internal windows are already inspection-ready', credit: EOT_SCOPE_CREDITS_P.internal_windows / 100 },
] as const;

const EOT_CARPET_BUNDLE_SCOPE: Record<SizeKey, string> = {
  studio: 'Main sleeping area carpet + hallway',
  bed1:   '1 bedroom carpet + hallway',
  bed2:   '2 bedroom carpets + hallway',
  bed3:   '3 bedroom carpets + hallway + landing',
  bed4:   '4 bedroom carpets + hallway + landing',
};

type ServiceKey = 'deep' | 'window' | 'gutter' | 'office';

export interface BookingSelection {
  serviceName:     string;
  price:           number;
  // Offer/promo data (present only when a discount genuinely reduced the
  // final price — never set when the £85 minimum booking charge overrode it)
  offerCode?:      string;   // e.g. 'LEAFLET20' or 'BUNDLE'
  standardPrice?:  number;   // pre-discount price for display
  discountAmount?: number;   // £ saved
  discountPercent?: number;  // percentage
  // Minimum-booking-charge context (present when the £85 floor determined
  // the final price, whether or not a discount was also in play)
  minimumApplied?:        boolean;
  subtotalBeforeMinimum?: number;  // discounted subtotal before the £85 floor
  quoteConfig?: {
    service:          ServiceKey;
    deepService:      DeepServiceType;
    deepSize:         SizeKey;
    deepBaths:        number;
    addOnCounts:      Record<string, number>;
    windowSize:       string;
    gutterType:       string;
    officeHours:      number;
    propertyType?:    'flat' | 'house';
    eotScopeExclusions?: string[];
    // carpet-specific (optional, present only when deepService === 'carpet_upholstery')
    carpetCounts?:    CarpetCounts;
    carpetCondition?: CarpetCondition;
  };
}

interface Props {
  onBook?:    (sel: BookingSelection) => void;
  promoCode?: string;
  // 'carpet'/'upholstery' lock the calculator onto the carpet_upholstery
  // deep-service branch (same pricing engine as 'all-services') and only
  // render the relevant CARPET_GROUPS item list — no separate calculator.
  mode?:       'all-services' | 'eot' | 'carpet' | 'upholstery';
  // Homepage presentation only. The homepage leads with service cards
  // (HomeServiceSelector), so the calculator stays hidden until one is picked
  // and then renders on a light background instead of the dark gradient the
  // service pages use. None of these change pricing or the booking payload.
  homepageMode?:            boolean;
  homepageService?:         HomepageQuoteService | null;
  onHomepageServiceChange?: (service: HomepageQuoteService) => void;
}

// ─── Shared counter widget ────────────────────────────────────────────────────

function Counter({
  value, min = 0, max, onChange, itemLabel = 'item',
}: {
  value: number; min?: number; max?: number; onChange: (v: number) => void; itemLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${itemLabel} quantity`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
      >
        <Minus size={14} />
      </button>
      <span className="w-7 text-center text-navy-900 font-bold text-sm" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={max !== undefined && value >= max}
        aria-label={`Increase ${itemLabel} quantity`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// One item row per carpet/upholstery product. Extracted so the always-visible
// group and the progressively-revealed cross-sell group render from identical
// markup — the revealed panel is the same control set, not a second copy of it.
// Prices come from the CarpetItem definitions and itemLinePrice, exactly as
// before; nothing here computes or stores a price.
function CarpetItemRows({
  items,
  counts,
  onChange,
}: {
  items: CarpetItem[];
  counts: CarpetCounts;
  onChange: React.Dispatch<React.SetStateAction<CarpetCounts>>;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const qty = counts[item.key] ?? 0;
        const lp  = itemLinePrice(item, qty);
        return (
          <div key={item.key}
            className={`flex items-start justify-between rounded-xl px-3 py-2.5 border transition-all duration-200 ${
              qty > 0 ? 'bg-royal-50 border-royal-300' : 'bg-silver-50 border-silver-200'
            }`}>
            <div className="min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-navy-800 text-xs font-medium">{item.label}</span>
                {qty > 0 && (
                  <span className="text-green-700 font-bold text-[10px] bg-green-100 border border-green-300 rounded-full px-1.5 py-0.5 leading-none">
                    £{lp}
                  </span>
                )}
              </div>
              <div className="text-royal-600 text-[10px] font-bold mt-0.5">
                {item.key === 'stairs'
                  ? `£${item.stairsFirst} first flight · £${item.stairsExtra} each extra`
                  : `£${item.unitPrice} per item`}
              </div>
              {item.helper && (
                <p className="text-silver-600 text-[10px] mt-0.5 leading-snug">{item.helper}</p>
              )}
            </div>
            <Counter
              value={qty}
              onChange={(v) => onChange((p) => ({ ...p, [item.key]: v }))}
              // Without this every row announced simply "Increase item
              // quantity", leaving 13 identically named controls on the page.
              itemLabel={item.label}
            />
          </div>
        );
      })}
    </div>
  );
}

// Trust strip beside the price. The DBS line is singled out because the Carpet
// landing page already states the same credential in its hero, directly under
// the Google rating ("Fully insured · DBS-checked technicians"). Repeating it a
// few hundred pixels below reads as padding rather than reassurance, so carpet
// mode drops this one line — and only this one line, on only that mode. The
// homepage, /leaflet and every other service page still show all five.
const DBS_TRUST_ITEM = 'DBS-checked, vetted cleaners';

const TRUST_ITEMS = [
  '£5m public liability insurance',
  DBS_TRUST_ITEM,
  '48hr re-clean guarantee',
  'No hidden fees — fixed prices',
  'Secure Stripe checkout',
];

// ─── Session-restore helper ───────────────────────────────────────────────────
// Reads vve_booking.quoteConfig from sessionStorage only when the temporary
// vve_restore_quote flag is present (set by "Back to quote" in BookingPage).

function getRestoreConfig(): BookingSelection['quoteConfig'] | null {
  try {
    if (!sessionStorage.getItem('vve_restore_quote')) return null;
    const raw = sessionStorage.getItem('vve_booking');
    if (!raw) return null;
    return (JSON.parse(raw) as BookingSelection).quoteConfig ?? null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteCalculator({
  onBook,
  promoCode,
  mode = 'all-services',
  homepageMode = false,
  homepageService = null,
  onHomepageServiceChange,
}: Props = {}) {
  const { ref, visible } = useReveal();
  const navigate = useNavigate();
  const { setCtx }      = useBookingCtx();
  const [bookError, setBookError]   = useState('');
  const serviceAreaRef  = useRef<HTMLDivElement>(null);
  const bookErrorRef    = useRef<HTMLDivElement>(null);

  const [service] = useState<ServiceKey>('deep');

  // Captured once on mount; null on every subsequent render (flag cleared below).
  const [_restore] = useState<BookingSelection['quoteConfig'] | null>(getRestoreConfig);

  // Clear the restore flag immediately after we've read it so a future
  // direct homepage visit doesn't unexpectedly hydrate an old quote.
  useEffect(() => {
    sessionStorage.removeItem('vve_restore_quote');
  }, []);

  const isEotFocused        = mode === 'eot';
  const isCarpetFocused     = mode === 'carpet';
  const isUpholsteryFocused = mode === 'upholstery';
  // Any locked mode forces a single deep-service branch and hides the
  // Service Type switcher — only 'all-services' lets the visitor choose.
  const focusGroup: 'Carpets' | 'Sofas & Upholstery' | null =
    isCarpetFocused ? 'Carpets' : isUpholsteryFocused ? 'Sofas & Upholstery' : null;
  const [deepService,   setDeepService]   = useState<DeepServiceType>(
    () => isEotFocused
      ? 'end_of_tenancy'
      : (isCarpetFocused || isUpholsteryFocused)
        ? 'carpet_upholstery'
        // A restored quote wins over the homepage card selection, so coming
        // back from BookingPage via "Back to quote" reopens what the customer
        // actually had rather than resetting them to the card they first hit.
        : ((_restore?.deepService as DeepServiceType | undefined) ?? homepageService ?? 'carpet_upholstery'),
  );
  const [deepSize,      setDeepSize]      = useState<SizeKey>(
    () => (_restore?.deepSize as SizeKey | undefined) ?? 'bed2',
  );
  const [deepBaths,     setDeepBaths]     = useState<1 | 2 | 3>(
    () => (_restore?.deepBaths as (1 | 2 | 3) | undefined) ?? 1,
  );
  const [addOnCounts,   setAddOnCounts]   = useState<Record<string, number>>(
    () => {
      const defaults = Object.fromEntries(addOnDefs.map((a) => [a.key, 0]));
      return _restore?.addOnCounts ? { ...defaults, ..._restore.addOnCounts } : defaults;
    },
  );
  const [propertyType, setPropertyType] = useState<'flat' | 'house'>(
    () => _restore?.propertyType ?? 'flat',
  );
  const [eotScopeExclusions, setEotScopeExclusions] = useState<string[]>(
    () => _restore?.eotScopeExclusions ?? [],
  );
  // "5+ Bedrooms" is a tailored-quote-only UI state, never a priced size —
  // it never reaches handleBookNow/checkout, mirroring the after-builders
  // and delicate-carpet manual-quote paths.
  const [eotTailoredQuote, setEotTailoredQuote] = useState(false);

  // ── Carpet-specific state ──
  const [carpetCounts,    setCarpetCounts]    = useState<CarpetCounts>(
    () => {
      const defaults = Object.fromEntries(
        CARPET_GROUPS.flatMap((g) => g.items).map((i) => [i.key, 0]),
      ) as CarpetCounts;
      return _restore?.carpetCounts ? { ...defaults, ..._restore.carpetCounts } : defaults;
    },
  );
  const [carpetCondition, setCarpetCondition] = useState<CarpetCondition>(
    () => (_restore?.carpetCondition as CarpetCondition | undefined) ?? 'normal',
  );

  // ── Cross-sell disclosure (service pages only) ──
  // The Carpet page leads with carpets and offers upholstery as an optional
  // extra; the Sofa page does the exact reverse. Both use the same counts and
  // the same computeCarpetPrice call as before — this is presentation and
  // state only, so no pricing rule is duplicated or re-implemented here.
  //
  // 'all-services' (homepage and /leaflet) is deliberately excluded: it keeps
  // showing both groups outright, exactly as it does today.
  const crossSellGroup: 'Carpets' | 'Sofas & Upholstery' | null =
    isCarpetFocused ? 'Sofas & Upholstery' : isUpholsteryFocused ? 'Carpets' : null;

  const crossSellItemKeys = useMemo(
    () => (crossSellGroup
      ? (CARPET_GROUPS.find((g) => g.group === crossSellGroup)?.items ?? []).map((i) => i.key)
      : []),
    [crossSellGroup],
  );

  // Opens closed by default. The one exception is a restored quote that already
  // contains cross-sell items: hiding those would leave the customer paying for
  // lines they cannot see, so the panel reopens to match what is in the price.
  const [crossSellOpen, setCrossSellOpen] = useState(
    () => crossSellItemKeys.some((k) => (_restore?.carpetCounts?.[k] ?? 0) > 0),
  );

  const crossSellPanelId = useId();
  const crossSellLabelId = useId();

  const closeCrossSell = () => {
    setCrossSellOpen(false);
    // Zero the hidden group so nothing the customer can no longer see is left
    // contributing to the total, the bundle discount or the booking payload.
    setCarpetCounts((prev) => {
      const next = { ...prev };
      for (const key of crossSellItemKeys) next[key] = 0;
      return next;
    });
  };

  const [windowSize,   setWindowSize]   = useState(() => _restore?.windowSize   ?? 'small');
  const [gutterType,   setGutterType]   = useState(() => _restore?.gutterType   ?? 'terraced');
  const [officeHours,  setOfficeHours]  = useState(() => _restore?.officeHours  ?? MIN_OFFICE_HOURS);

  const isCarpet        = deepService === 'carpet_upholstery';
  const isEot           = deepService === 'end_of_tenancy';
  const isAfterBuilders = service === 'deep' && deepService === 'after_builders';

  // Carpet price (computed only when isCarpet). promoCode enables discount (e.g. LEAFLET20).
  const carpetResult = isCarpet
    ? computeCarpetPrice(carpetCounts, carpetCondition, 1, promoCode)
    : null;

  const getAddOnPrice = (key: string): number => {
    if (key === 'carpet_bundle') return CARPET_BUNDLE_PRICE[deepSize];
    if ((key === 'oven' || key === 'fridge') && isEot) return 0;
    return addOnDefs.find((a) => a.key === key)?.price ?? 0;
  };

  const eotScopeCredit = isEot
    ? eotScopeCreditPence(
        EOT_BASE_PRICES_P[deepSize],
        eotScopeExclusions,
      ) / 100
    : 0;

  const houseAdjustment = isEot && propertyType === 'house' ? EOT_HOUSE_ADJUSTMENT_P / 100 : 0;

  // Non-carpet price calculation
  const calcDeepOrOtherPrice = (): number => {
    if (isEot && eotTailoredQuote) return 0; // tailored quote — no fixed total
    if (service === 'deep') {
      const base      = BASE_PRICES[deepService][deepSize];
      const bathExtra = (deepBaths - 1) * BATH_SURCHARGE[deepService];
      const addOns    = addOnDefs.reduce((s, a) => {
        if (a.key === 'staircase') return s + STAIR_PRICES[Math.min(addOnCounts.staircase, 3)];
        return s + addOnCounts[a.key] * getAddOnPrice(a.key);
      }, 0);
      return base + houseAdjustment + bathExtra + addOns - eotScopeCredit;
    }
    if (service === 'window') return Math.max(windowPrices[windowSize] ?? 35, MIN_CHARGE);
    if (service === 'gutter') return Math.max(gutterPrices[gutterType] ?? 75, MIN_CHARGE);
    if (service === 'office') return Math.max(officeHours * HOURLY_RATE, MIN_CHARGE);
    return 0;
  };

  // The authoritative price used throughout the component
  const price = isCarpet ? (carpetResult?.finalTotal ?? 0) : calcDeepOrOtherPrice();
  const eotStandardPrice = isEot ? price + eotScopeCredit : price;

  const rawPrice = (() => {
    if (service === 'window') return windowPrices[windowSize] ?? 35;
    if (service === 'gutter') return gutterPrices[gutterType] ?? 75;
    if (service === 'office') return officeHours * HOURLY_RATE;
    return price;
  })();

  const minApplied = isCarpet
    ? (carpetResult?.minApplied ?? false)
    : (service !== 'deep') && rawPrice < MIN_CHARGE;

  const serviceLabels: Record<ServiceKey, string> = {
    deep:   DEEP_SERVICE_LABELS[deepService],
    window: 'Window Cleaning',
    gutter: 'Gutter Clearing',
    office: 'Office / Commercial',
  };

  // ── WhatsApp link ──────────────────────────────────────────────────────────

  const waLink = (() => {
    // After builders
    if (isAfterBuilders) {
      const msg = `Hello VVE Clean, I'd like a quote for an after builders clean. I'll send photos of the space to confirm the scope.\nMy postcode is: `;
      return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
    }

    // EOT — 5+ bedrooms (tailored quote, no fixed total)
    if (isEot && eotTailoredQuote) {
      const msg = `Hello VVE Clean, I'd like a tailored quote for an end of tenancy clean at a 5+ bedroom ${propertyType}. I'll share the exact room count and access details.\nMy postcode is: `;
      return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
    }

    // Carpet & upholstery
    if (isCarpet) {
      if (carpetCondition === 'delicate') {
        const msg = `Hello VVE Clean, I'd like a quote for delicate fabric cleaning (wool, silk or velvet). I'll send photos for an accurate price.\nMy postcode is: `;
        return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
      }
      const itemsText = (carpetResult?.lines ?? [])
        .map((l) => `  - ${l.label} ×${l.qty}: £${l.lineTotal}`)
        .join('\n');
      const condLabel = carpetCondition === 'heavy'
        ? 'Heavy stains / pet odour (+20% estimate)'
        : 'Normal';
      const totalLabel = carpetCondition === 'heavy'
        ? `~£${carpetResult?.finalTotal ?? 0} (estimate — confirmed before work starts)`
        : `£${carpetResult?.finalTotal ?? 0}`;
      const carpetBundle = carpetResult?.bundle;
      const bundleSummaryText = (() => {
        if (!carpetResult?.showSaving) {
          // Either no discount applies, or the £85 minimum booking charge
          // overrode it — in the latter case, say so instead of quoting a
          // saving the customer won't actually receive.
          if (carpetResult?.minApplied) {
            return `• Items subtotal: £${carpetBundle!.preDiscount}\n• £${CARPET_MIN_BOOKING} minimum booking charge applies\n`;
          }
          return '';
        }
        const label = carpetBundle!.source === 'promo' && promoCode
          ? `Leaflet offer (${carpetBundle!.pct}% off)`
          : 'Same-visit bundle saving';
        return `• Items subtotal: £${carpetBundle!.preDiscount}\n• ${label}: −£${carpetBundle!.saving}\n`;
      })();
      const msg =
        `Hello VVE Clean, I would like to book carpet & upholstery cleaning:\n` +
        `• Condition: ${condLabel}\n` +
        `• Items:\n${itemsText || '  (no items selected yet)'}\n` +
        bundleSummaryText +
        `• Estimated Total: ${totalLabel}\n` +
        `My postcode is: `;
      return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
    }

    // All other services
    const sizeLabel  = deepSize === 'studio' ? 'Studio' : deepSize.replace('bed', '') + ' Bed';
    const bathLabel  = `${deepBaths === 3 ? '3+' : deepBaths}`;

    let extrasLine: string;
    if (service === 'deep') {
      if (deepService === 'end_of_tenancy') {
        const extras = addOnDefs
          .filter((a) => !['oven', 'fridge', 'sofa', 'mattress'].includes(a.key) && addOnCounts[a.key] > 0)
          .map((a) => `${a.label}${addOnCounts[a.key] > 1 ? ` ×${addOnCounts[a.key]}` : ''}`)
          .join(', ');
        const scopeLine = eotScopeExclusions.length > 0
          ? ` Custom scope excludes: ${eotScopeExclusions.join(', ')}.`
          : '';
        const houseLine = propertyType === 'house'
          ? ` House/maisonette adjustment: +£${EOT_HOUSE_ADJUSTMENT_P / 100}.`
          : '';
        extrasLine = `Complete package includes appliances, cupboards and internal windows${extras ? `; upgrades: ${extras}` : ''}.${houseLine}${scopeLine}`;
      } else {
        const extras = addOnDefs
          .filter((a) => addOnCounts[a.key] > 0)
          .map((a) => `${a.label}${addOnCounts[a.key] > 1 ? ` ×${addOnCounts[a.key]}` : ''}`)
          .join(', ');
        extrasLine = extras || 'None';
      }
    } else {
      extrasLine = 'n/a';
    }

    const propertySize = service === 'deep'
      ? sizeLabel
      : service === 'window'
        ? (windowSize === 'small' ? '1–2 Bed' : windowSize === 'medium' ? '3 Bed' : '4+ Bed')
        : service === 'office'
          ? `${officeHours} hours`
          : gutterType.replace('_', '-');

    const msg =
      `Hello VVE Clean, I would like to book a clean based on my quote estimate:\n` +
      `• Service: ${serviceLabels[service]}\n` +
      `• Property: ${deepService === 'end_of_tenancy' ? `${propertyType}, ` : ''}${propertySize}\n` +
      `• Bathrooms: ${service === 'deep' ? bathLabel : 'n/a'}\n` +
      `• Extras: ${extrasLine}\n` +
      `• Estimated Total: £${Math.round(price)}\n` +
      `My postcode is: `;
    return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
  })();

  // ── Booking button ─────────────────────────────────────────────────────────

  const deepSizeLabel = deepSize === 'studio' ? 'Studio' : deepSize.replace('bed', '') + ' Bed';

  const bookingServiceName = (() => {
    if (service !== 'deep') return serviceLabels[service];
    if (isCarpet) {
      const n = carpetResult?.totalItems ?? 0;
      return `Carpet & upholstery${n > 0 ? ` · ${n} item${n !== 1 ? 's' : ''}` : ''}`;
    }
    return `${isEot && eotScopeCredit > 0 ? 'Custom end of tenancy' : DEEP_SERVICE_LABELS[deepService]} — ${deepSizeLabel}`;
  })();

  const handleBookNow = () => {
    const bundle = carpetResult?.bundle;
    // Only claim a discount when the minimum booking charge hasn't overridden
    // it — otherwise standardPrice - discountAmount would not equal price,
    // and the booking summary would show a saving the customer didn't get.
    const hasDiscount = carpetResult?.showSaving ?? false;
    const hasEotScopeCredit = isEot && eotScopeCredit > 0;
    const minimumApplied = carpetResult?.minApplied ?? false;
    const sel: BookingSelection = {
      serviceName: bookingServiceName,
      price:       Math.round(price),
      ...(hasDiscount ? {
        offerCode:      bundle!.source === 'promo' ? (promoCode ?? 'PROMO') : 'BUNDLE',
        standardPrice:  bundle!.preDiscount,
        discountAmount: bundle!.saving,
        discountPercent: bundle!.pct,
      } : hasEotScopeCredit ? {
        offerCode:       'EOT_SCOPE',
        standardPrice:   Math.round(eotStandardPrice),
        discountAmount:  Math.round(eotScopeCredit),
        discountPercent: Math.round((eotScopeCredit / eotStandardPrice) * 1000) / 10,
      } : {}),
      ...(minimumApplied ? {
        minimumApplied:         true,
        subtotalBeforeMinimum:  carpetResult!.discountedSubtotal,
      } : {}),
      quoteConfig: {
        service, deepService, deepSize, deepBaths, addOnCounts,
        windowSize, gutterType, officeHours, propertyType, eotScopeExclusions,
        ...(isCarpet ? { carpetCounts, carpetCondition } : {}),
      },
    };
    trackBookingInitiated(bookingServiceName);
    // Navigation state only, never part of the payload: lets "Back to quote"
    // return to the page the quote was built on rather than the homepage.
    // Recorded before the branch, because /leaflet supplies its own onBook and
    // navigates itself — inside the else, leaflet customers were still sent
    // back to /#quote.
    rememberQuoteOrigin();
    if (onBook) {
      onBook(sel);
    } else {
      sessionStorage.setItem('vve_booking', JSON.stringify(sel));
      navigate('/booking');
    }
  };

  // ── Can the "Book Online" button be shown? ─────────────────────────────────
  const canBookOnline = !isAfterBuilders && !(isEot && eotTailoredQuote)
    && !(isCarpet && (carpetResult?.isPhotoQuote || (carpetResult?.totalItems ?? 0) === 0));

  const isManualQuote = isAfterBuilders || (isEot && eotTailoredQuote) || (isCarpet && (carpetResult?.isPhotoQuote ?? false));
  const isReadyToBook = canBookOnline && price > 0;

  // Stable ref wrapper — lets context consumers call handleBookNow without stale closures
  const _bookRef = useRef(handleBookNow);
  _bookRef.current = handleBookNow;
  const stableBook = useCallback(() => _bookRef.current(), []);

  useEffect(() => {
    setCtx({
      state:  isManualQuote ? 'manual' : isReadyToBook ? 'bookable' : 'none',
      price:  Math.round(price),
      waLink,
      onBook: stableBook,
    });
  }, [isManualQuote, isReadyToBook, price, waLink, stableBook, setCtx]);

  const handleBookWithValidation = () => {
    setBookError('Please choose at least one service first.');
    serviceAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { bookErrorRef.current?.focus(); }, 400);
  };

  // Clear error once the user adds an item
  useEffect(() => {
    if (bookError && ((carpetResult?.totalItems ?? 0) > 0 || !isCarpet)) {
      setBookError('');
    }
  }, [carpetResult?.totalItems, isCarpet, bookError]);

  // Listen for sticky-bar "book" tap when no items are selected
  useEffect(() => {
    const handler = () => {
      if (!isReadyToBook && !isManualQuote) handleBookWithValidation();
    };
    document.addEventListener('vve:validate-book', handler);
    return () => document.removeEventListener('vve:validate-book', handler);
  }, [isReadyToBook, isManualQuote]);

  // Homepage, nothing chosen yet: show the introductory quote panel rather than
  // the full configurator. #quote always exists so "Get my price" and other
  // /#quote links land somewhere real. A restored quote counts as a selection,
  // which is what makes "Back to quote" reopen the detailed calculator directly
  // without showing this step first.
  if (homepageMode && !homepageService && !_restore) {
    const homepageOptions: Array<{ value: HomepageQuoteService; label: string }> = [
      { value: 'carpet_upholstery', label: 'Carpet or upholstery cleaning' },
      { value: 'end_of_tenancy', label: 'End of tenancy cleaning' },
      { value: 'move_in', label: 'Move-in deep cleaning' },
      { value: 'after_builders', label: 'After-builders cleaning' },
    ];

    return (
      <section id="quote" ref={ref} className="bg-surface pb-20 pt-24 scroll-mt-28 sm:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={`overflow-hidden rounded-3xl border border-line bg-white shadow-[0_22px_70px_rgba(16,36,62,0.10)] transition duration-700 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
            <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
              <div className="p-6 sm:p-9 lg:p-11">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-royal-700">Instant quote</p>
                    <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">Get an instant quote</h2>
                    <p className="mt-2 text-sm text-muted">Start by choosing the service you need.</p>
                  </div>
                  <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-royal-50 text-royal-700 sm:flex">
                    <Calculator size={24} />
                  </span>
                </div>

                <div className="mb-7 flex items-center gap-2 text-xs font-semibold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-royal-600 text-white">1</span>
                  <span className="text-royal-700">Service</span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-muted">2</span>
                  <span className="text-muted">Details</span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-muted">3</span>
                  <span className="text-muted">Quote</span>
                </div>

                <label htmlFor="homepage-quote-service" className="mb-2 block text-sm font-bold text-navy-900">Select a service</label>
                <div className="relative">
                  <select
                    id="homepage-quote-service"
                    value=""
                    onChange={(event) => {
                      const selected = event.target.value as HomepageQuoteService;
                      if (selected) onHomepageServiceChange?.(selected);
                    }}
                    className="min-h-[50px] w-full appearance-none rounded-xl border-2 border-line bg-white px-4 pr-11 text-sm font-semibold text-navy-900 outline-none transition focus:border-royal-600 focus:ring-4 focus:ring-royal-100"
                  >
                    <option value="" disabled>Choose what you would like cleaned</option>
                    {homepageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <LockKeyhole size={14} className="text-royal-700" />
                  No hidden fees · Live price where available · £30 booking deposit
                </p>
              </div>

              <aside className="bg-gradient-to-br from-royal-50 to-sky-100/60 p-6 sm:p-9 lg:p-11">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-royal-700 shadow-sm"><ShieldCheck size={21} /></span>
                  <h3 className="font-display text-lg font-bold text-navy-900">Why book with VVE Clean?</h3>
                </div>
                <ul className="mt-6 space-y-4">
                  {[
                    'Transparent pricing with no hidden fees',
                    '£30 deposit handled securely by Stripe',
                    'Professional equipment and direct support',
                    '£5m public liability insurance',
                    // Was "Rated 5.0 by genuine Google reviewers". No verified
                    // rating exists in the project (see data/googleRating.ts),
                    // so the claim is now only that the reviews are real and
                    // public — which the profile link substantiates.
                    'Genuine reviews on our public Google profile',
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-navy-800">
                      <CheckCircle2 size={17} className="mt-1 flex-none text-royal-600" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <section
      id="quote"
      ref={ref}
      className={`${
        homepageMode
          ? 'bg-surface pb-20 pt-24 sm:pt-28'
          : 'py-20 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800'
      } scroll-mt-24`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className={`text-center mb-10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {homepageMode ? (
            <>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-royal-700">Instant quote</p>
              <h2 className="mb-3 font-display text-4xl font-bold text-navy-900 md:text-5xl">Get an instant quote</h2>
              <p className="text-lg text-muted">Start by choosing the service you need.</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 border-2 border-white/40 rounded-full px-4 py-1.5 mb-4">
                <Calculator size={14} className="text-white" />
                <span className="text-white text-xs tracking-widest font-semibold uppercase">
                  {isEotFocused ? 'Complete EOT Pricing' : isCarpetFocused ? 'Instant Carpet Pricing' : isUpholsteryFocused ? 'Instant Upholstery Pricing' : 'Instant Pricing'}
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
                {isEotFocused ? (
                  <>Build Your <span className="text-gradient-metallic">Complete Clean</span></>
                ) : isCarpetFocused ? (
                  <>Build Your <span className="text-gradient-metallic">Carpet Quote</span></>
                ) : isUpholsteryFocused ? (
                  <>Build Your <span className="text-gradient-metallic">Upholstery Quote</span></>
                ) : (
                  <>Get Your <span className="text-gradient-metallic">Instant Quote</span></>
                )}
              </h2>
              <p className="text-silver-400 text-lg">
                {isEotFocused
                  ? 'One complete package. Essential inspection items included. Genuine upgrades shown separately.'
                  : isCarpetFocused
                    ? 'Pick your rooms and stairs — fixed prices, added up as you go.'
                    : isUpholsteryFocused
                      ? 'Pick your sofas, chairs and mattresses — fixed prices, added up as you go.'
                      : 'Transparent pricing. No hidden fees. Tailored to your needs.'}
              </p>
            </>
          )}
        </div>

        {/* Card grid */}
        <div className={`grid lg:grid-cols-5 gap-0 rounded-2xl shadow-2xl transition-all duration-700 delay-200 lg:items-start ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* ── Left: configurator ── */}
          <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-tl-2xl rounded-tr-2xl lg:rounded-tr-none lg:rounded-bl-2xl">
            <div ref={serviceAreaRef} className="space-y-5">

              {/* Step label */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-royal-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-navy-900 text-sm font-semibold">
                  {isEotFocused
                    ? 'Tell us about the property'
                    : (isCarpetFocused || isUpholsteryFocused)
                      ? 'Add your rooms and get an instant price'
                      : 'Select your service & get an instant price'}
                </span>
              </div>

              {/* ── Deep-service branch ── */}
              {service === 'deep' && (
                <>
                  {/* Service Type selector — carpet is first */}
                  {mode === 'all-services' && <div>
                    <label className="block text-navy-900 font-semibold text-sm mb-2">Service Type</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(DEEP_SERVICE_LABELS) as DeepServiceType[]).map((k) => (
                        <button key={k} type="button"
                          onClick={() => {
                            setDeepService(k);
                            setAddOnCounts(Object.fromEntries(addOnDefs.map((a) => [a.key, 0])));
                            setEotTailoredQuote(false);
                            // Keep the homepage's own selection in step, so
                            // switching service here doesn't leave the page
                            // state pointing at the card the visitor first
                            // clicked.
                            onHomepageServiceChange?.(k as HomepageQuoteService);
                          }}
                          className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-left transition-all duration-200 ${
                            deepService === k
                              ? 'border-royal-500 bg-royal-50 text-royal-700'
                              : 'border-silver-200 text-navy-700 hover:border-royal-300'
                          }`}>
                          {DEEP_SERVICE_LABELS[k]}
                        </button>
                      ))}
                    </div>
                  </div>}

                  {/* ── After builders: photo-quote callout ── */}
                  {isAfterBuilders && (
                    <div className="rounded-2xl px-5 py-5 bg-amber-50 border-2 border-amber-200 space-y-3 text-center">
                      <div className="text-amber-700 text-[10px] font-bold tracking-widest uppercase">After Builders Clean</div>
                      <div className="font-display font-bold text-4xl text-amber-900">From £{AFTER_BUILDERS_START_FROM_P / 100}</div>
                      <p className="text-silver-600 text-sm leading-relaxed max-w-xs mx-auto">
                        The extent of after-builders work varies — fine dust, paint specks, sticker residue and debris. Send us a photo and we'll confirm your price before any work starts.
                      </p>
                    </div>
                  )}

                  {/* ── Carpet & upholstery: itemised counter UI ── */}
                  {isCarpet && (
                    <>
                      {/* Condition selector */}
                      <div>
                        <label className="block text-navy-900 font-semibold text-sm mb-2">Condition</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {([
                            ['normal',   'Normal'],
                            ['heavy',    'Heavy stains / pet odour'],
                            ['delicate', 'Delicate (wool, silk, velvet)'],
                          ] as [CarpetCondition, string][]).map(([k, l]) => (
                            <button key={k} type="button" onClick={() => setCarpetCondition(k)}
                              className={`py-2 px-1.5 rounded-xl border-2 text-[11px] font-semibold text-center leading-tight transition-all duration-200 ${
                                carpetCondition === k
                                  ? k === 'heavy'   ? 'border-amber-400 bg-amber-50 text-amber-800'
                                  : k === 'delicate' ? 'border-purple-400 bg-purple-50 text-purple-700'
                                  :                   'border-royal-500 bg-royal-50 text-royal-700'
                                  : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}>
                              {l}
                            </button>
                          ))}
                        </div>
                        {carpetCondition === 'heavy' && (
                          <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                            <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-amber-800 text-xs leading-relaxed font-medium">
                              Estimated price only — final price confirmed from photos or on arrival before work starts.
                            </p>
                          </div>
                        )}
                        {carpetCondition === 'delicate' && (
                          <div className="flex items-start gap-2 mt-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5">
                            <Info size={13} className="text-purple-600 flex-shrink-0 mt-0.5" />
                            <p className="text-purple-700 text-xs leading-relaxed font-medium">
                              Delicate fabrics (wool, silk, velvet) need a photo assessment. We'll confirm the price before booking.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Item groups.
                          - 'all-services' (homepage, /leaflet): both groups
                            shown outright, exactly as before.
                          - Carpet page: carpets shown, upholstery offered
                            behind the Yes/No disclosure below.
                          - Sofa page: the exact reverse.
                          Every branch renders the same rows from the same
                          CARPET_GROUPS definition and feeds the same
                          carpetCounts, so no pricing logic is duplicated. */}
                      {CARPET_GROUPS
                        .filter((grp) => (crossSellGroup
                          ? grp.group !== crossSellGroup
                          : !focusGroup || grp.group === focusGroup))
                        .map((grp) => (
                          <div key={grp.group}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-navy-700 font-bold text-xs uppercase tracking-widest whitespace-nowrap">{grp.group}</span>
                              <div className="flex-1 h-px bg-silver-200" />
                            </div>
                            <CarpetItemRows
                              items={grp.items}
                              counts={carpetCounts}
                              onChange={setCarpetCounts}
                            />
                          </div>
                        ))}

                      {/* Progressive cross-sell. Collapsed by default so the
                          calculator stays short; the customer opts in rather
                          than scrolling past a second service they did not
                          come for. Choosing "No" zeroes the hidden group so a
                          product they can no longer see can never sit in the
                          price (see closeCrossSell). */}
                      {crossSellGroup && (
                        <div className="mt-5 pt-4 border-t border-silver-200">
                          <p id={crossSellLabelId} className="text-navy-900 font-bold text-sm">
                            {crossSellGroup === 'Sofas & Upholstery'
                              ? 'Would you also like upholstery cleaning?'
                              : 'Would you also like carpet cleaning?'}
                          </p>
                          <p className="text-silver-600 text-xs mt-0.5">
                            {crossSellGroup === 'Sofas & Upholstery'
                              ? 'Optional — add a sofa, armchair or mattress to the same visit.'
                              : 'Optional — add rooms, stairs or rugs to the same visit.'}
                          </p>

                          <div className="mt-3 flex gap-2" role="group" aria-labelledby={crossSellLabelId}>
                            <button
                              type="button"
                              onClick={() => setCrossSellOpen(true)}
                              aria-pressed={crossSellOpen}
                              aria-expanded={crossSellOpen}
                              aria-controls={crossSellPanelId}
                              className={`min-h-[44px] flex-1 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                                crossSellOpen
                                  ? 'border-royal-500 bg-royal-50 text-royal-700'
                                  : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={closeCrossSell}
                              aria-pressed={!crossSellOpen}
                              className={`min-h-[44px] flex-1 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                                !crossSellOpen
                                  ? 'border-royal-500 bg-royal-50 text-royal-700'
                                  : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}
                            >
                              No
                            </button>
                          </div>

                          {/* Mounted only while open, so the hidden controls
                              are genuinely absent — not merely invisible — and
                              can never be tabbed to or read by a screen reader.
                              motion-safe keeps the reveal still for anyone with
                              prefers-reduced-motion set. */}
                          {crossSellOpen && (
                            <div
                              id={crossSellPanelId}
                              aria-labelledby={crossSellLabelId}
                              className="mt-3 motion-safe:animate-fade-in-up"
                            >
                              <CarpetItemRows
                                items={CARPET_GROUPS.find((g) => g.group === crossSellGroup)?.items ?? []}
                                counts={carpetCounts}
                                onChange={setCarpetCounts}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bundle savings info — hidden when a promo code already gives a better saving */}
                      {!promoCode && (
                        <p className="text-xs text-silver-700 leading-relaxed px-1">
                          Book items together and save automatically — {CARPET_BUNDLE_TIERS.map((t) => `${t.display} over £${t.minP / 100}`).join(', ')}.
                        </p>
                      )}
                    </>
                  )}

                  {/* ── EOT / Move-in: property size + bathrooms + extras ── */}
                  {!isAfterBuilders && !isCarpet && (
                    <>
                      {isEot && (
                        <>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                              <h3 className="font-display font-bold text-navy-900 text-base">
                                Included in every Complete EOT clean
                              </h3>
                            </div>
                            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                              {EOT_INCLUDED_ITEMS.map((item) => (
                                <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-navy-800">
                                  <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-3 text-[11px] leading-relaxed text-emerald-800">
                              Fridge/freezer must be emptied and the freezer defrosted. Appliance cleaning covers accessible compartments and surfaces; repairs and dismantling are not included.
                            </p>
                          </div>

                          <fieldset>
                            <legend className="block text-navy-900 font-semibold text-sm mb-2">Property Type</legend>
                            <div className="grid grid-cols-2 gap-2">
                              {([['flat', 'Flat / apartment'], ['house', 'House / maisonette']] as const).map(([key, label]) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setPropertyType(key)}
                                  aria-pressed={propertyType === key}
                                  className={`min-h-[44px] py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200 ${
                                    propertyType === key
                                      ? 'border-royal-500 bg-royal-50 text-royal-700'
                                      : 'border-silver-200 text-navy-700 hover:border-royal-300'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <p className="text-silver-600 text-[10px] mt-1.5">
                              {propertyType === 'house'
                                ? `Transparent +£${EOT_HOUSE_ADJUSTMENT_P / 100} house/maisonette adjustment — covers normal additional hallways, landing, internal staircase cleaning and movement between floors. Carpet steam cleaning for stairs remains a separate upgrade.`
                                : `House / maisonette adds a transparent +£${EOT_HOUSE_ADJUSTMENT_P / 100} to cover normal additional hallways, landing, internal staircase cleaning and movement between floors.`}
                            </p>
                          </fieldset>
                        </>
                      )}

                      {/* Property size */}
                      <div>
                        <label className="block text-navy-900 font-semibold text-sm mb-2">Property Size</label>
                        <div className={`grid gap-1.5 ${isEot ? 'grid-cols-3' : 'grid-cols-5'}`}>
                          {([['studio','Studio'],['bed1','1 Bed'],['bed2','2 Bed'],['bed3','3 Bed'],['bed4', isEot ? '4 Bed' : '4+ Bed']] as [SizeKey, string][]).map(([k, l]) => (
                            <button key={k} type="button" onClick={() => { setDeepSize(k); setEotTailoredQuote(false); }}
                              className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${
                                !eotTailoredQuote && deepSize === k ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}>
                              {l}
                            </button>
                          ))}
                          {isEot && (
                            <button type="button" onClick={() => setEotTailoredQuote(true)}
                              aria-pressed={eotTailoredQuote}
                              className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${
                                eotTailoredQuote ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}>
                              5+ Bedrooms
                            </button>
                          )}
                        </div>
                        {eotTailoredQuote && (
                          <p className="text-silver-600 text-[10px] mt-1.5">
                            5+ bedroom properties need a tailored quote — send us a few details on WhatsApp and we'll confirm your price. No fixed total is shown because it would not reflect the real scope.
                          </p>
                        )}
                      </div>

                      {!eotTailoredQuote && (
                      <>
                      {/* Bathrooms */}
                      <div>
                        <label className="block text-navy-900 font-semibold text-sm mb-2">Bathrooms / WCs</label>
                        <div className="flex gap-2">
                          {([1, 2, 3] as const).map((n) => (
                            <button key={n} type="button" onClick={() => setDeepBaths(n)}
                              className={`w-11 h-11 rounded-full border-2 text-sm font-bold transition-all duration-200 ${
                                deepBaths === n ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                              }`}>
                              {n === 3 ? '3+' : n}
                            </button>
                          ))}
                        </div>
                        {deepBaths > 1 && (
                          <p className="text-silver-600 text-[10px] mt-1">
                            +£{(deepBaths - 1) * BATH_SURCHARGE[deepService]} for {deepBaths - 1} extra bathroom{deepBaths > 2 ? 's' : ''} included in price
                          </p>
                        )}
                      </div>

                      {isEot ? (
                        <>
                          {([
                            {
                              title: 'Additional property scope',
                              keys: ['extra_wc', 'reception', 'conservatory', 'balcony', 'utility'],
                            },
                            {
                              title: 'Carpet steam-cleaning upgrades',
                              keys: ['carpet_bundle', 'eot_living_carpet', 'staircase'],
                            },
                            {
                              title: 'Other genuine upgrades',
                              keys: [
                                'eot_sofa_2',
                                'eot_sofa_3',
                                'eot_sofa_corner',
                                'eot_mattress_single',
                                'eot_mattress_double',
                                'ext_windows',
                                'wall_marks',
                                'key_collect',
                              ],
                            },
                          ] as const).map((group) => (
                            <div key={group.title}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-navy-700 font-bold text-xs uppercase tracking-widest">{group.title}</span>
                                <div className="flex-1 h-px bg-silver-200" />
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {group.keys.map((key) => {
                                  const item = addOnDefs.find((candidate) => candidate.key === key)!;
                                  const dynamicPrice = key === 'carpet_bundle'
                                    ? CARPET_BUNDLE_PRICE[deepSize]
                                    : item.price;
                                  const label = key === 'carpet_bundle'
                                    ? EOT_CARPET_BUNDLE_SCOPE[deepSize]
                                    : item.label;
                                  return (
                                    <div
                                      key={key}
                                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200 ${
                                        addOnCounts[key] > 0
                                          ? 'bg-royal-50 border-royal-300'
                                          : 'bg-silver-50 border-silver-200'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-navy-800 text-xs font-medium leading-snug">{label}</div>
                                        <div className="text-royal-600 text-[10px] font-bold mt-0.5">
                                          +£{dynamicPrice}
                                          {key === 'carpet_bundle' && (
                                            <span className="font-normal text-silver-600"> · bedrooms/hall scope shown above</span>
                                          )}
                                          {key === 'wall_marks' && (
                                            <span className="font-normal text-silver-600"> · light spot treatment; full wall washing needs photos</span>
                                          )}
                                        </div>
                                      </div>
                                      <Counter
                                        value={addOnCounts[key]}
                                        max={key === 'carpet_bundle' ? 1 : key === 'staircase' ? 3 : undefined}
                                        itemLabel={label}
                                        onChange={(value) => setAddOnCounts((previous) => ({ ...previous, [key]: value }))}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          <details className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <summary className="cursor-pointer list-none min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 font-semibold text-sm text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
                              <span>Already cleaned something? Reduce the scope</span>
                              <span className="text-xs text-slate-500">Up to £30</span>
                            </summary>
                            <div className="border-t border-slate-200 p-4 space-y-3">
                              <p className="text-xs leading-relaxed text-slate-600">
                                Only select an item if it will be empty and inspection-ready before we arrive. Core cleaning cannot be removed.
                              </p>
                              {EOT_SCOPE_OPTIONS.map((option) => {
                                const checked = eotScopeExclusions.includes(option.key);
                                return (
                                  <label
                                    key={option.key}
                                    className={`flex items-center justify-between gap-3 min-h-[44px] rounded-xl border px-3 py-2 cursor-pointer ${
                                      checked ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <span className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => setEotScopeExclusions((previous) => (
                                          checked
                                            ? previous.filter((key) => key !== option.key)
                                            : [...previous, option.key]
                                        ))}
                                        className="w-5 h-5 accent-amber-600"
                                      />
                                      <span className="text-xs text-navy-800">{option.label}</span>
                                    </span>
                                    <span className="text-xs font-bold text-amber-700 whitespace-nowrap">−£{option.credit}</span>
                                  </label>
                                );
                              })}
                              {eotScopeCredit > 0 && (
                                <div className="rounded-xl bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-900 leading-relaxed">
                                  This is now a <strong>Custom EOT clean</strong>. Your £{eotScopeCredit} credit is applied, and removed items are excluded from the 48-hour re-clean guarantee.
                                </div>
                              )}
                            </div>
                          </details>
                        </>
                      ) : (
                        <div>
                          <label className="block text-navy-900 font-semibold text-sm mb-2">
                            Optional Extras
                            <span className="ml-2 text-[10px] font-normal text-silver-600 uppercase tracking-wide">— total updates live</span>
                          </label>
                          <div className="grid grid-cols-1 gap-2 sm:max-h-64 sm:overflow-y-auto overflow-y-visible pr-1 no-scrollbar">
                            {addOnDefs
                              .filter((a) => {
                                if (a.key === 'rubbish') return deepService === 'after_builders';
                                return ![
                                  'sofa', 'mattress', 'staircase', 'eot_living_carpet',
                                  'extra_wc', 'reception', 'conservatory', 'balcony', 'utility',
                                ].includes(a.key);
                              })
                              .map((a) => {
                                const dynamicPrice = a.key === 'carpet_bundle' ? CARPET_BUNDLE_PRICE[deepSize] : a.price;
                                const saving = a.key === 'carpet_bundle'
                                  ? BASE_PRICES.carpet_upholstery[deepSize] - CARPET_BUNDLE_PRICE[deepSize]
                                  : 0;
                                return (
                                  <div key={a.key} className="flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-200 bg-silver-50 border-silver-200">
                                    <div>
                                      <span className="text-navy-800 text-xs font-medium">{a.label}</span>
                                      <div className="text-royal-600 text-[10px] font-bold mt-0.5">
                                        +£{dynamicPrice}
                                        {saving > 0 && <span className="text-green-600 ml-1">· saves £{saving}</span>}
                                      </div>
                                    </div>
                                    <Counter
                                      value={addOnCounts[a.key]}
                                      onChange={(value) => setAddOnCounts((previous) => ({ ...previous, [a.key]: value }))}
                                    />
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Window cleaning ── */}
              {service === 'window' && (
                <div>
                  <label className="block text-navy-900 font-semibold text-sm mb-2">Property Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[['small','1–2 Bed',35],['medium','3 Bed',45],['large','4+ Bed',55]].map(([k,l,p]) => (
                      <button key={k} type="button" onClick={() => setWindowSize(k as string)}
                        className={`py-3 rounded-xl border-2 text-xs font-semibold text-center transition-all duration-200 ${windowSize === k ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'}`}>
                        <div className="font-bold">{l}</div>
                        <div className="text-royal-600 font-bold text-base mt-0.5">£{p}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Gutter ── */}
              {service === 'gutter' && (
                <div>
                  <label className="block text-navy-900 font-semibold text-sm mb-2">Property Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[['terraced','Terraced / Small Property',75],['semi_detached','Semi-Detached Property',110],['detached','Detached Property',160]].map(([k,l,p]) => (
                      <button key={k} type="button" onClick={() => setGutterType(k as string)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-all duration-200 ${gutterType === k ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'}`}>
                        <span className="font-semibold">{l}</span>
                        <span className="font-bold text-base">£{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Office ── */}
              {service === 'office' && (
                <div>
                  <label className="block text-navy-900 font-semibold text-sm mb-3">Hours Required (min. 4)</label>
                  <div className="flex items-center justify-between bg-silver-50 rounded-xl px-4 py-4 border border-silver-200">
                    <div>
                      <div className="text-navy-900 font-bold">{officeHours} hours</div>
                      <div className="text-silver-600 text-xs">£{HOURLY_RATE}/hr × {officeHours}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setOfficeHours(Math.max(MIN_OFFICE_HOURS, officeHours - 1))} disabled={officeHours <= MIN_OFFICE_HOURS}
                        className="w-9 h-9 rounded-full border-2 border-silver-300 flex items-center justify-center text-navy-700 hover:border-royal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Minus size={14} />
                      </button>
                      <span className="text-2xl font-bold text-navy-900 w-8 text-center">{officeHours}</span>
                      <button type="button" onClick={() => setOfficeHours(officeHours + 1)}
                        className="w-9 h-9 rounded-full border-2 border-silver-300 flex items-center justify-center text-navy-700 hover:border-royal-400 transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Min charge notice (window / gutter / office only) */}
              {minApplied && !isCarpet && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-700 text-xs">Minimum booking threshold met (£{MIN_CHARGE})</span>
                </div>
              )}

              {/* ── Price / quote box ── */}
              {!isAfterBuilders && (
                <>
                  {/* EOT: 5+ bedrooms — tailored quote, no fixed total */}
                  {isEot && eotTailoredQuote ? (
                    <div className="rounded-2xl px-5 py-5 bg-amber-50 border-2 border-amber-200 space-y-3 text-center">
                      <div className="text-amber-700 text-[10px] font-bold tracking-widest uppercase">Tailored Quote Required</div>
                      <div className="font-display font-bold text-2xl text-amber-900">5+ bedroom property</div>
                      <p className="text-amber-700 text-sm leading-relaxed max-w-xs mx-auto">
                        Properties this size vary too much for a fixed online price. Send us the room count and a few details on WhatsApp and we'll confirm your price.
                      </p>
                    </div>
                  ) : isCarpet && carpetResult?.isPhotoQuote ? (
                    <div className="rounded-2xl px-5 py-5 bg-purple-50 border-2 border-purple-200 space-y-3 text-center">
                      <div className="text-purple-700 text-[10px] font-bold tracking-widest uppercase">Photo Quote Required</div>
                      <div className="font-display font-bold text-2xl text-purple-900">Delicate fabric clean</div>
                      <p className="text-purple-700 text-sm leading-relaxed max-w-xs mx-auto">
                        Wool, silk and velvet require assessment before we can give a fixed price. Send us a photo on WhatsApp and we'll confirm within the hour.
                      </p>
                    </div>
                  ) : isCarpet && (carpetResult?.totalItems ?? 0) === 0 ? (
                    /* Carpet: no items selected yet */
                    <div className="rounded-2xl px-5 py-5 border-2 border-dashed border-silver-300 text-center">
                      <p className="text-silver-600 text-sm">Add items above to see your price</p>
                      <p className="text-silver-500 text-xs mt-1">Minimum booking £{CARPET_MIN_BOOKING}</p>
                    </div>
                  ) : (
                    /* Normal price box — carpet or other service */
                    <div className="relative rounded-2xl px-6 py-6 overflow-visible" style={{ backgroundColor: '#dff0e8', border: '1.5px solid #b6d9c8' }}>
                      {/* Deposit badge */}
                      <div className="absolute -top-3 -right-3 rotate-6 z-10">
                        <div className="border-2 rounded-lg px-3 py-1.5" style={{ borderColor: '#1a5c3a', backgroundColor: 'transparent' }}>
                          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#1a5c3a' }}>£30 Deposit · Rest After</span>
                        </div>
                      </div>

                      {/* Service label */}
                      <div className="text-center mb-2 mt-3">
                        <div className="text-xs font-bold tracking-widest uppercase" style={{ color: '#1e6b42', letterSpacing: '0.18em' }}>
                          {isCarpet
                            ? (() => {
                                const n = carpetResult?.totalItems ?? 0;
                                return `Carpet & upholstery · ${n} item${n !== 1 ? 's' : ''}`;
                              })()
                            : service === 'deep'
                              ? `${isEot && eotScopeCredit > 0 ? 'Custom EOT' : DEEP_SERVICE_LABELS[deepService]} · ${deepSizeLabel} · ${deepBaths === 3 ? '3+' : deepBaths} Bath`
                              : serviceLabels[service]
                          }
                        </div>
                      </div>

                      {/* Bundle discount: original price with strikethrough */}
                      {isCarpet && (carpetResult?.bundle.saving ?? 0) > 0 && (
                        <div className="text-center mb-1">
                          <span className="line-through text-silver-600 text-lg">£{carpetResult!.bundle.preDiscount}</span>
                        </div>
                      )}

                      {/* Big price */}
                      <div className="text-center">
                        {isEot && eotScopeCredit > 0 && (
                          <div className="line-through text-silver-600 text-lg mb-1">£{Math.round(eotStandardPrice)}</div>
                        )}
                        <div className="font-display font-bold leading-none" style={{ fontSize: '3.5rem', color: '#1a5c3a' }}>
                          {isCarpet && carpetCondition === 'heavy' ? '~' : ''}£{Math.round(price)}
                        </div>
                        {/* "You save £X" is only ever shown when the minimum booking
                            charge did NOT override the discount — otherwise the
                            customer wouldn't actually receive that saving. */}
                        {isCarpet && carpetResult?.showSaving && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-green-100 border border-green-300 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {carpetResult!.bundle.source === 'promo'
                              ? `Leaflet offer — you save £${carpetResult!.bundle.saving}`
                              : `Same-visit bundle saving — you save £${carpetResult!.bundle.saving}`}
                          </div>
                        )}
                        {isEot && eotScopeCredit > 0 && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
                            Custom-scope credit · £{eotScopeCredit} off
                          </div>
                        )}
                      </div>

                      {/* Minimum booking charge breakdown — replaces any saving
                          claim when the £85 floor is what actually set the price */}
                      {isCarpet && carpetResult?.minApplied && (
                        <div className="mt-3 mx-auto max-w-[300px] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 space-y-1">
                          <div className="flex justify-between text-xs text-navy-700">
                            <span>Service subtotal</span>
                            <span>£{carpetResult.adjustedSubtotal}</span>
                          </div>
                          {carpetResult.bundle.saving > 0 && (
                            <div className="flex justify-between text-xs text-navy-700">
                              <span>Discounted subtotal</span>
                              <span>£{carpetResult.discountedSubtotal}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-semibold text-amber-700">
                            <span>Minimum booking charge</span>
                            <span>£{CARPET_MIN_BOOKING}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-navy-900 border-t border-amber-200 pt-1 mt-1">
                            <span>Final price</span>
                            <span>£{carpetResult.finalTotal}</span>
                          </div>
                          {promoCode && (
                            <p className="text-amber-700 text-[10px] leading-relaxed pt-1">{DISCOUNT_MIN_NOTE}</p>
                          )}
                        </div>
                      )}

                      {/* Next-tier nudge — hidden when a promo already beats all tiers */}
                      {isCarpet && (carpetResult?.bundle.toNextTier ?? 0) > 0 && carpetResult!.bundle.source !== 'promo' && (
                        <div className="text-center text-xs font-medium mt-1.5" style={{ color: '#1e6b42' }}>
                          Add £{carpetResult!.bundle.toNextTier} more to unlock {carpetResult!.bundle.nextTierPct}% off
                        </div>
                      )}


                      {/* Non-carpet subtitle */}
                      {!isCarpet && service === 'deep' && (
                        <div className="text-center mt-3 text-sm" style={{ color: '#4a7a62' }}>
                          {deepService === 'end_of_tenancy'
                            ? `${eotScopeCredit > 0 ? 'Custom scope' : 'Everything essential included'} · `
                            : ''}
                          48hr re-clean guarantee
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Condition note — only for non-carpet, non-afterbuilders deep services */}
              {!isAfterBuilders && !isCarpet && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: '#dbeafe', borderLeft: '3px solid #0284c7' }}>
                  <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#0284c7' }} />
                  <p className="text-[10px] leading-relaxed font-medium" style={{ color: '#1e3a5f' }}>
                    Price assumes the property is in normal condition. Heavy soiling, mould, pet accidents, strong odours, or large/permanent stains may require a revised quote before work starts.
                  </p>
                </div>
              )}

              {/* Regular cleaning discount nudge */}
              {!isEot && <div className="flex items-start gap-3 bg-royal-50 border border-royal-200 rounded-xl px-4 py-3">
                <div className="w-1 self-stretch rounded-full bg-royal-400 flex-shrink-0" />
                <div>
                  <p className="text-royal-700 text-xs font-semibold mb-0.5">Regular service discounts available</p>
                  <p className="text-royal-600 text-xs leading-relaxed">
                    Customers who book regular cleaning services can get <span className="font-semibold">10% to 30% off</span>, depending on the service type, frequency, and property size.
                  </p>
                </div>
              </div>}

              {/* ── Action area — always visible ── */}

              {/* Inline validation error */}
              {bookError && (
                <div
                  ref={bookErrorRef}
                  role="alert"
                  aria-live="assertive"
                  tabIndex={-1}
                  className="flex items-start gap-2 rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm focus:outline-none"
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
                  <span>{bookError}</span>
                </div>
              )}

              {/* Primary CTA */}
              {isManualQuote ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp flex items-center justify-center gap-2.5 w-full py-4 min-h-[44px] rounded-full font-bold text-base transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {isAfterBuilders
                    ? 'Request a quote →'
                    : isEot && eotTailoredQuote
                      ? 'Request tailored quote →'
                      : 'Send photos for a quote →'}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={isReadyToBook ? handleBookNow : handleBookWithValidation}
                  className="flex items-center justify-center gap-2 w-full py-4 min-h-[44px] rounded-full font-bold text-white text-base bg-royal-500 hover:bg-royal-600 transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]"
                  aria-label={isReadyToBook ? 'Book online — pay £30 deposit' : 'Book online'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {isReadyToBook ? 'Book online — pay £30 deposit' : 'Book online'}
                </button>
              )}

              {/* Secondary: help text for no-items state; WA button for bookable state */}
              {!isManualQuote && !isReadyToBook && (
                <p className="text-center text-xs text-silver-500">
                  Not sure which service you need?{' '}
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-green-600 hover:underline">
                    Get help →
                  </a>
                </p>
              )}
              {!isManualQuote && isReadyToBook && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full py-4 min-h-[44px] rounded-full font-bold text-base transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a]"
                  style={{ backgroundColor: '#ffffff', border: '2px solid #22C55E', color: '#16a34a' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Need help? Chat on WhatsApp
                </a>
              )}

            </div>
          </div>

          {/* ── Right: price panel ── */}
          <div className="lg:col-span-2 navy-gradient p-6 flex flex-col justify-between rounded-br-2xl rounded-bl-2xl lg:rounded-bl-none lg:rounded-tr-2xl lg:sticky lg:top-24 lg:self-start">
            <div>
              <h3 className="text-silver-400 text-xs font-medium tracking-widest uppercase mb-2">
                {isAfterBuilders ? 'Starting From' : (isEot && eotTailoredQuote) ? 'Tailored Quote' : isCarpet && carpetResult?.isPhotoQuote ? 'Photo Quote' : 'Your price'}
              </h3>
              {isCarpet && (carpetResult?.bundle.saving ?? 0) > 0 && (
                <div className="text-silver-400 text-base line-through mb-0.5">
                  £{carpetResult!.bundle.preDiscount}
                </div>
              )}
              {isEot && eotScopeCredit > 0 && (
                <div className="text-silver-400 text-base line-through mb-0.5">
                  £{Math.round(eotStandardPrice)}
                </div>
              )}
              <div className="text-5xl font-bold font-display text-white mb-1 transition-all duration-300">
                {isAfterBuilders
                  ? `From £${AFTER_BUILDERS_START_FROM_P / 100}`
                  : isEot && eotTailoredQuote
                    ? 'Tailored quote'
                    : isCarpet && carpetResult?.isPhotoQuote
                      ? 'Photo quote'
                      : isCarpet && (carpetResult?.totalItems ?? 0) === 0
                        ? `From £${CARPET_MIN_BOOKING}`
                        : `${isCarpet && carpetCondition === 'heavy' ? '~' : ''}£${Math.round(price)}`}
              </div>
              {isCarpet && carpetResult?.showSaving && (
                <div className="text-green-400 text-xs font-semibold mb-1">
                  {carpetResult!.bundle.source === 'promo' ? 'Leaflet offer' : 'Bundle saving'} — £{carpetResult!.bundle.saving} off
                </div>
              )}
              {minApplied && (
                <div className="text-amber-400 text-xs mb-2 flex items-center gap-1">
                  <Info size={11} /> £{CARPET_MIN_BOOKING} minimum booking charge applies
                </div>
              )}
              <div className="text-silver-400 text-sm mb-4">
                {isCarpet
                  ? (() => {
                      const n = carpetResult?.totalItems ?? 0;
                      return n > 0 ? `Carpet & upholstery · ${n} item${n !== 1 ? 's' : ''}` : 'Carpet & upholstery';
                    })()
                  : isEot && eotScopeCredit > 0
                    ? 'Custom end of tenancy clean'
                    : serviceLabels[service]}
              </div>

              {/* Deposit split — shown whenever there's a bookable price */}
              {canBookOnline && price > 0 && (
                <div className="glass-card rounded-xl p-3 mb-3 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-silver-300">£30 deposit today</span>
                    <span className="text-white font-bold">£30</span>
                  </div>
                  {Math.round(price) > 30 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-silver-300">Balance after the job</span>
                      <span className="text-white font-bold">£{Math.round(price) - 30}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-1.5 mt-1">
                    <p className="text-silver-500 text-[10px] leading-snug">
                      Your £30 deposit comes straight off the total — it is not an extra charge.
                    </p>
                  </div>
                </div>
              )}

              {/* Book CTA in right panel */}
              {isReadyToBook && (
                <div className="mb-3 space-y-1.5">
                  <button
                    type="button"
                    onClick={handleBookNow}
                    className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-full font-bold text-white text-sm bg-royal-500 hover:bg-royal-600 transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]"
                    aria-label="Book online — pay £30 deposit"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Book online — pay £30 deposit
                  </button>
                  <div className="flex items-center justify-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-silver-500 flex-shrink-0" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span className="text-silver-500 text-xs">Secured by Stripe · encrypted checkout</span>
                  </div>
                </div>
              )}
              {!isReadyToBook && !isManualQuote && (
                <div className="mb-3 space-y-1.5">
                  <button
                    type="button"
                    onClick={handleBookWithValidation}
                    className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-full font-bold text-white text-sm bg-royal-500 hover:bg-royal-600 transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]"
                    aria-label="Book online"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Book online
                  </button>
                  <p className="text-silver-500 text-[11px] text-center leading-snug">
                    You pay a £30 deposit today — it comes straight off your bill.
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                {TRUST_ITEMS.filter((item) => !(isCarpetFocused && item === DBS_TRUST_ITEM)).map((item) => (
                  <div key={item} className="flex items-center gap-2 text-silver-300 text-sm">
                    <CheckCircle2 size={13} className="text-royal-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              {/* Selection summary card */}
              <div className="glass-card rounded-xl p-3 mb-2">
                <div className="text-silver-400 text-[10px] uppercase tracking-widest font-semibold mb-1.5">Your Selection</div>
                {isEot && eotTailoredQuote ? (
                  <div className="space-y-1">
                    <p className="text-white text-xs font-semibold">
                      End of tenancy · {propertyType === 'flat' ? 'Flat / apartment' : 'House / maisonette'}
                    </p>
                    <p className="text-silver-300 text-[11px] leading-relaxed">
                      5+ bedrooms · tailored quote required. No fixed total or online booking is shown.
                    </p>
                  </div>
                ) : isCarpet ? (
                  (carpetResult?.lines ?? []).length > 0 ? (
                    <div className="space-y-0.5">
                      {carpetResult!.lines.map((l) => (
                        <div key={l.key} className="flex justify-between text-xs">
                          <span className="text-silver-300">{l.label} {l.qty > 1 ? `×${l.qty}` : ''}</span>
                          <span className="text-white font-semibold">£{l.lineTotal}</span>
                        </div>
                      ))}
                      {carpetResult!.heavySurcharge > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-300">Heavy stain surcharge</span>
                          <span className="text-amber-300 font-semibold">+£{carpetResult!.heavySurcharge}</span>
                        </div>
                      )}
                      {/* Discount line only shown when it genuinely reduced the
                          final price — never alongside the min-charge line below,
                          since the £85 floor overriding the discount means no
                          saving was actually applied. */}
                      {carpetResult!.showSaving && (
                        <div className="flex justify-between text-xs">
                          <span className="text-green-300">
                            {carpetResult!.bundle.source === 'promo' ? 'Leaflet offer' : 'Bundle saving'}
                          </span>
                          <span className="text-green-300 font-semibold">−£{carpetResult!.bundle.saving}</span>
                        </div>
                      )}
                      {carpetResult!.minApplied && (
                        <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                          <span className="text-amber-300">Minimum booking charge</span>
                          <span className="text-amber-300 font-semibold">£{CARPET_MIN_BOOKING}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-silver-400 text-xs">No items selected yet</p>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="text-silver-200 text-xs leading-relaxed">
                      Service: <span className="text-white font-semibold">
                        {isEot && eotScopeCredit > 0 ? 'Custom EOT' : serviceLabels[service]}
                      </span>
                      {service === 'deep' && (
                        <>
                          {' · '}
                          <span className="text-white font-semibold">
                            {isEot ? `${propertyType === 'flat' ? 'Flat' : 'House'} · ` : ''}
                            {deepSizeLabel}
                            {` · ${deepBaths === 3 ? '3+' : deepBaths} bath`}
                          </span>
                        </>
                      )}
                      {service === 'window' && (
                        <>{' · '}<span className="text-white font-semibold">{windowSize === 'small' ? '1–2 Bed' : windowSize === 'medium' ? '3 Bed' : '4+ Bed'}</span></>
                      )}
                      {service === 'gutter' && (
                        <>{' · '}<span className="text-white font-semibold capitalize">{gutterType.replace('_', '-')}</span></>
                      )}
                      {service === 'office' && (
                        <>{' · '}<span className="text-white font-semibold">{officeHours} hrs</span></>
                      )}
                    </p>
                    {isEot && (
                      <>
                        <div className="border-t border-white/10 pt-2 space-y-1">
                          {['Oven & extractor', 'Fridge/freezer', 'Cupboards', 'Internal windows'].map((item) => (
                            <div key={item} className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="text-silver-300">✓ {item}</span>
                              <span className="text-emerald-300 font-semibold">Included</span>
                            </div>
                          ))}
                        </div>
                        {propertyType === 'house' && (
                          <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-[11px]">
                            <span className="text-silver-300">House/maisonette adjustment</span>
                            <span className="text-white font-semibold">+£{EOT_HOUSE_ADJUSTMENT_P / 100}</span>
                          </div>
                        )}
                        {Object.entries(addOnCounts).some(([key, count]) => (
                          count > 0 && !['oven', 'fridge', 'sofa', 'mattress'].includes(key)
                        )) && (
                          <div className="border-t border-white/10 pt-2 space-y-1">
                            {addOnDefs
                              .filter((item) => addOnCounts[item.key] > 0 && !['oven', 'fridge', 'sofa', 'mattress'].includes(item.key))
                              .map((item) => (
                                <div key={item.key} className="flex justify-between gap-3 text-[11px]">
                                  <span className="text-silver-300">
                                    {item.key === 'carpet_bundle' ? EOT_CARPET_BUNDLE_SCOPE[deepSize] : item.label}
                                    {addOnCounts[item.key] > 1 ? ` ×${addOnCounts[item.key]}` : ''}
                                  </span>
                                  <span className="text-white font-semibold">
                                    +£{item.key === 'staircase'
                                      ? STAIR_PRICES[Math.min(addOnCounts[item.key], 3)]
                                      : addOnCounts[item.key] * getAddOnPrice(item.key)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                        {eotScopeCredit > 0 && (
                          <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-[11px]">
                            <span className="text-amber-300">Custom-scope credit</span>
                            <span className="text-amber-300 font-semibold">−£{eotScopeCredit}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="btn-whatsapp flex items-center justify-center gap-2 w-full font-semibold py-2.5 rounded-xl transition-all duration-300 text-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {isAfterBuilders ? 'WhatsApp a photo for your quote' : 'Need help? Chat on WhatsApp'}
              </a>
              <div className="glass-card rounded-xl p-3 text-center">
                <div className="text-silver-300 text-xs mb-0.5">Prefer to call?</div>
                <a href="tel:02080502233" className="text-white font-bold hover:text-silver-200 transition-colors">020 8050 2233</a>
                <div className="text-silver-400 text-[10px] mt-0.5">Mon–Fri 9am–6pm · Sat 10am–3pm</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote-only footnote */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <p className="text-center text-silver-500 text-xs leading-relaxed">
          Need something else?{' '}
          <span className="text-silver-300">Window cleaning from £45</span>
          {' · '}
          <span className="text-silver-300">Pressure washing from £120</span>
          {' · '}
          <span className="text-silver-300">Garden services from £45</span>
          {' · '}
          <span className="text-silver-300">Commercial &amp; communal spaces: contact us for a tailored monthly quote after a free site visit.</span>
        </p>
      </div>
    </section>
  );
}
