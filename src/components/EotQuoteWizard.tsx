import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, Bath, Building2, CheckCircle2, ChevronLeft, ChevronRight, CircleOff, Home, Info,
  Layers3, ListChecks, Mail, MessageCircle, Minus, Plus, ShieldCheck, Sparkles, Waves, XCircle,
} from 'lucide-react';
import {
  EOT_PRICES_P,
  eotPropertySizeValid,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
  EOT_TAILORED_ADDON_PRICES_P,
  EOT_TAILORED_CUPBOARDS_PRICES_P,
  EOT_CARPET_PACKAGE_DISCOUNT_PCT,
  EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS,
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  ADDON_PRICES_P,
  calculateEotQuote,
  calculateEotCarpetPackage,
  calculateDepositAndBalance,
  generateDefaultRooms,
  eotCarpetAreaStandalonePriceP,
  penceToDisplay,
  type SizeKey,
} from '../data/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

// Maisonettes price identically to houses in the explicit EOT_PRICES_P
// matrix, so they are offered as a single combined choice rather than a
// third, pricing-identical option.
export type PropertyType = 'flat' | 'house';
export type EotPackage = 'complete' | 'tailored';
export type FloorState = 'unset' | 'carpet' | 'hard' | 'na';
export type ConditionState = 'normal' | 'heavy' | 'clutter' | 'biohazard';
export type FloorCareChoice = 'unset' | 'standard' | 'professional' | 'none';
export type CarpetMode = 'unset' | 'whole' | 'manual';

export interface RoomState {
  id: string;
  label: string;
  addonKey: string;
  floor: FloorState;
  steamClean: boolean;
  removable: boolean;
  // Only meaningful when addonKey === 'stairs'. Defaults to 1 (first flight)
  // — never assumed higher just because the property is large; the customer
  // must explicitly add additional flights.
  stairFlights?: number;
}

export interface TailoredAddOns {
  microwaveInside: boolean;
  fridgeFreezerInside: boolean;
  extraFridgeFreezers: number;
  dishwasherInside: boolean;
  washingMachineInside: boolean;
  cupboards: boolean;
}

export interface ExtrasState {
  ext_windows: number;
  balcony: number;
  wall_marks: number;
  key_collect: number;
  rubbish: number;
}

// Inline upholstery/mattress add-ons (Step 4 expandable selector) — priced
// from the same standalone carpet & upholstery catalogue, added directly to
// this EOT quote rather than sending the customer to another page.
export interface UpholsteryCounts {
  armchair:         number;
  sofa_2:           number;
  sofa_3:           number;
  sofa_corner:      number;
  mattress_single:  number;
  mattress_double:  number;
  mattress_king:    number;
}

// Manual, individually-counted carpet areas (Floor care → "Choose areas
// individually"). livingRoom and diningRoom are two separate customer-facing
// counters that both price from the same canonical living_room rate — never
// a second table, just two UI rows over one price.
export interface ManualCarpetCounts {
  bedroom:    number;
  livingRoom: number;
  diningRoom: number;
  largeLounge: number;
  hallway:    number;
  landing:    number;
  stairFlights: number; // 0 = stairs not included
}

export interface EotWizardState {
  propertyType: PropertyType;
  size: SizeKey;
  is5Plus: boolean; // 5+ bedrooms — always a manual quotation, never priced here
  fullBathrooms: number;   // total, minimum 1
  extraWcs: number;
  pkg: EotPackage;
  tailoredAddOns: TailoredAddOns;
  floorCareChoice: FloorCareChoice;
  carpetMode: CarpetMode;
  rooms: RoomState[]; // used by the "whole-property" suggested-layout carpet mode
  manualCarpetCounts: ManualCarpetCounts; // used by the "choose areas individually" carpet mode
  extras: ExtrasState;
  upholsteryCounts: UpholsteryCounts;
  condition: ConditionState;
}

export interface EotBookingResult {
  serviceName: string;
  price: number;
  quoteConfig: {
    service: 'deep';
    deepService: 'end_of_tenancy';
    deepSize: SizeKey;
    deepBaths: number;
    deepWcs: number;
    isHouse: boolean;
    eotPackage: EotPackage;
    tailoredAddOns: {
      microwaveInside: boolean;
      fridgeFreezerInside: boolean;
      extraFridgeFreezers: number;
      dishwasherInside: boolean;
      washingMachineInside: boolean;
      cupboards: boolean;
    };
    addOnCounts: Record<string, number>;
    rooms: { id: string; addonKey: string; floor: string; stairFlights?: number }[];
    carpetRoomIds: string[];
    windowSize: string;
    gutterType: string;
    officeHours: number;
    condition: ConditionState;
  };
}

interface Props {
  onBook: (result: EotBookingResult) => void;
  onChangeService?: () => void;
  restoreConfig?: EotBookingResult['quoteConfig'] | null;
}

const SIZE_OPTIONS: { key: SizeKey; label: string }[] = [
  { key: 'studio', label: 'Studio' },
  { key: 'bed1', label: '1 bed' },
  { key: 'bed2', label: '2 beds' },
  { key: 'bed3', label: '3 beds' },
  { key: 'bed4', label: '4 beds' },
];

const STEP_LABELS = ['Property', 'Package', 'Floor care', 'Review'];
const TOTAL_STEPS = 4;

const MANUAL_CARPET_FIELDS: { key: keyof Omit<ManualCarpetCounts, 'stairFlights'>; addonKey: string; label: string; idPrefix: string; priceP: number }[] = [
  { key: 'bedroom', addonKey: 'bedroom', label: 'Bedrooms', idPrefix: 'bed', priceP: CARPET_ITEM_PRICES_P.bedroom },
  { key: 'livingRoom', addonKey: 'living_room', label: 'Living rooms', idPrefix: 'lr', priceP: CARPET_ITEM_PRICES_P.living_room },
  { key: 'diningRoom', addonKey: 'living_room', label: 'Dining rooms', idPrefix: 'dr', priceP: CARPET_ITEM_PRICES_P.living_room },
  { key: 'largeLounge', addonKey: 'large_lounge', label: 'Large lounges', idPrefix: 'lounge', priceP: CARPET_ITEM_PRICES_P.large_lounge },
  { key: 'hallway', addonKey: 'hallway', label: 'Hallways', idPrefix: 'hall', priceP: CARPET_ITEM_PRICES_P.hallway },
  { key: 'landing', addonKey: 'landing', label: 'Landings', idPrefix: 'land', priceP: CARPET_ITEM_PRICES_P.landing },
];

const UPHOLSTERY_FIELDS: { key: keyof UpholsteryCounts; label: string; priceP: number }[] = [
  { key: 'armchair', label: 'Armchair', priceP: CARPET_ITEM_PRICES_P.armchair },
  { key: 'sofa_2', label: '2-seater sofa', priceP: CARPET_ITEM_PRICES_P.sofa_2 },
  { key: 'sofa_3', label: '3-seater sofa', priceP: CARPET_ITEM_PRICES_P.sofa_3 },
  { key: 'sofa_corner', label: 'Corner / L-shaped sofa', priceP: CARPET_ITEM_PRICES_P.sofa_corner },
  { key: 'mattress_single', label: 'Mattress (single)', priceP: CARPET_ITEM_PRICES_P.mattress_single },
  { key: 'mattress_double', label: 'Mattress (double)', priceP: CARPET_ITEM_PRICES_P.mattress_double },
  { key: 'mattress_king', label: 'Mattress (king-size)', priceP: CARPET_ITEM_PRICES_P.mattress_king },
];

function defaultTailoredAddOns(): TailoredAddOns {
  return { microwaveInside: false, fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false };
}
function defaultExtras(): ExtrasState {
  return { ext_windows: 0, balcony: 0, wall_marks: 0, key_collect: 0, rubbish: 0 };
}
function defaultUpholsteryCounts(): UpholsteryCounts {
  return { armchair: 0, sofa_2: 0, sofa_3: 0, sofa_corner: 0, mattress_single: 0, mattress_double: 0, mattress_king: 0 };
}
function defaultManualCarpetCounts(): ManualCarpetCounts {
  return { bedroom: 0, livingRoom: 0, diningRoom: 0, largeLounge: 0, hallway: 0, landing: 0, stairFlights: 0 };
}

// Suggested rooms only — a room existing here is never a charge on its own,
// only once the customer explicitly confirms it (steamClean: true). Stairs
// always start at 1 flight; the customer adds more explicitly, never
// assumed from property size.
function defaultRooms(size: SizeKey, propertyType: PropertyType): RoomState[] {
  return generateDefaultRooms(size, propertyType).map((r) => ({
    ...r,
    steamClean: false,
    stairFlights: r.addonKey === 'stairs' ? 1 : undefined,
  }));
}

// The suggested layout used when entering "whole-property" carpet mode.
// Conservative by design: bedrooms, the reception room and the hallway are
// pre-checked (almost always present), but landing/stairs are only
// pre-checked for genuinely multi-floor properties (house/maisonette or
// 3-4 bed) — generateDefaultRooms already marks them `removable` precisely
// when that certainty doesn't hold, so a flat's landing/stairs stay visible
// but unticked rather than silently assumed.
function wholePropertyRooms(size: SizeKey, propertyType: PropertyType): RoomState[] {
  return defaultRooms(size, propertyType).map((r) => ({
    ...r,
    floor: 'carpet' as FloorState,
    steamClean: !((r.addonKey === 'landing' || r.addonKey === 'stairs') && r.removable),
  }));
}

// Synthesises a room list from the manual per-area counters — always fully
// "confirmed" (no suggested-but-unpriced state exists here: incrementing a
// counter above zero is itself the confirming action).
function manualCarpetRooms(counts: ManualCarpetCounts): RoomState[] {
  const rooms: RoomState[] = [];
  for (const f of MANUAL_CARPET_FIELDS) {
    const n = counts[f.key];
    const singular = f.label.replace(/s$/, '');
    for (let i = 1; i <= n; i++) {
      rooms.push({ id: `manual-${f.idPrefix}-${i}`, label: n > 1 ? `${singular} ${i}` : singular, addonKey: f.addonKey, floor: 'carpet', steamClean: true, removable: true });
    }
  }
  if (counts.stairFlights > 0) {
    rooms.push({ id: 'manual-stairs', label: 'Stairs', addonKey: 'stairs', floor: 'carpet', steamClean: true, removable: true, stairFlights: counts.stairFlights });
  }
  return rooms;
}

function makeInitialState(restore?: EotBookingResult['quoteConfig'] | null): EotWizardState {
  const restoredPropertyType: PropertyType = restore?.isHouse ? 'house' : 'flat';
  const restoredSize: SizeKey = (restore?.deepSize as SizeKey) ?? 'bed2';
  const size: SizeKey = eotPropertySizeValid(restoredPropertyType, restoredSize) ? restoredSize : 'bed1';
  const propertyType = restoredPropertyType;
  const restoredCarpetIds = restore?.carpetRoomIds ?? [];
  const hasCarpet = restoredCarpetIds.length > 0;
  const isManualRestore = hasCarpet && restoredCarpetIds.some((id) => id.startsWith('manual-'));

  const rooms = defaultRooms(size, propertyType);
  const manualCarpetCounts = defaultManualCarpetCounts();

  if (hasCarpet && !isManualRestore && restore?.rooms) {
    for (const r of rooms) {
      const match = restore.rooms.find((rr) => rr.id === r.id);
      if (match) {
        r.floor = match.floor as FloorState;
        if (r.addonKey === 'stairs') r.stairFlights = Number(match.stairFlights) || 1;
      }
      r.steamClean = restoredCarpetIds.includes(r.id);
    }
  } else if (isManualRestore && restore?.rooms) {
    for (const r of restore.rooms) {
      if (!restoredCarpetIds.includes(r.id)) continue;
      if (r.addonKey === 'stairs') { manualCarpetCounts.stairFlights = Number(r.stairFlights) || 1; continue; }
      const field = MANUAL_CARPET_FIELDS.find((f) => r.id.startsWith(`manual-${f.idPrefix}-`));
      if (field) manualCarpetCounts[field.key] += 1;
    }
  }

  return {
    propertyType,
    size,
    is5Plus: false,
    fullBathrooms: restore?.deepBaths ?? 1,
    extraWcs: restore?.deepWcs ?? 0,
    pkg: restore?.eotPackage ?? 'complete',
    tailoredAddOns: restore?.tailoredAddOns ? { ...defaultTailoredAddOns(), ...restore.tailoredAddOns } : defaultTailoredAddOns(),
    floorCareChoice: hasCarpet ? 'professional' : 'unset',
    carpetMode: hasCarpet ? (isManualRestore ? 'manual' : 'whole') : 'unset',
    rooms,
    manualCarpetCounts,
    extras: restore?.addOnCounts
      ? { ...defaultExtras(), ...(restore.addOnCounts as Partial<ExtrasState>) }
      : defaultExtras(),
    upholsteryCounts: restore?.addOnCounts
      ? { ...defaultUpholsteryCounts(), ...(restore.addOnCounts as Partial<UpholsteryCounts>) }
      : defaultUpholsteryCounts(),
    condition: restore?.condition ?? 'normal',
  };
}

// ─── Small shared bits ────────────────────────────────────────────────────────

// Connected four-step tracker. Completed steps use a filled royal-blue
// circle with a check icon, the current step uses a white circle with a
// gold/amber ring, and upcoming steps use a translucent outline — three
// visually distinct cues (fill, icon, ring) so progress never depends on
// colour alone.
function StepTracker({ step }: { step: number }) {
  return (
    <div className="flex items-start w-full max-w-2xl" role="list" aria-label={`Step ${step} of ${TOTAL_STEPS}: ${STEP_LABELS[step - 1]}`}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'upcoming';
        return (
          <div key={label} role="listitem" className={`flex items-center ${i < STEP_LABELS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                aria-current={state === 'current' ? 'step' : undefined}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200',
                  state === 'done' ? 'bg-royal-400 border-royal-400 text-navy-950' : '',
                  state === 'current' ? 'bg-white border-white text-navy-900 ring-4 ring-royal-400/35' : '',
                  state === 'upcoming' ? 'bg-white/[0.06] border-white/30 text-white/70' : '',
                ].join(' ')}
              >
                {state === 'done' ? <CheckCircle2 size={14} /> : n}
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap ${state === 'upcoming' ? 'text-white/50' : 'text-white'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px flex-1 min-w-[10px] mx-1.5 sm:mx-3 rounded-full self-start mt-4 ${n < step ? 'bg-royal-400' : 'bg-white/20'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Counter({ value, onChange, min = 0, max, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        aria-label={`Decrease ${label}`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-700 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
        <Minus size={14} />
      </button>
      <span className="w-7 text-center text-navy-900 font-bold text-sm" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)} disabled={max !== undefined && value >= max}
        aria-label={`Increase ${label}`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-700 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
        <Plus size={14} />
      </button>
    </div>
  );
}

// Live carpet-package breakdown — the single presentation used everywhere a
// standalone value / package saving / today price needs to be shown, so the
// numbers can never drift between Step 3 and the Step 4 review. Every value
// goes through penceToDisplay, which shows exact pence (e.g. £47.50) rather
// than rounding to a whole pound.
function CarpetPackageBreakdown({ carpetPackage }: { carpetPackage: ReturnType<typeof calculateEotCarpetPackage> }) {
  if (carpetPackage.itemCount === 0) return null;
  return (
    <div className="rounded-xl bg-royal-50 border border-sky-200 px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-navy-700">Standard carpet-cleaning value</span>
        <span className="text-navy-900 font-semibold">{penceToDisplay(carpetPackage.standaloneSubtotalP)}</span>
      </div>
      {carpetPackage.eligible ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-navy-700">EOT carpet-package saving</span>
            <span className="text-green-700 font-semibold">−{penceToDisplay(carpetPackage.savingP)}</span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-sky-200 pt-1.5 mt-1">
            <span className="text-navy-700 font-semibold">Professional carpet cleaning today</span>
            <span className="text-royal-700 font-display font-bold text-lg">{penceToDisplay(carpetPackage.chargedP)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-base border-t border-sky-200 pt-1.5 mt-1">
            <span className="text-navy-700 font-semibold">Professional carpet cleaning today</span>
            <span className="text-royal-700 font-display font-bold text-lg">{penceToDisplay(carpetPackage.chargedP)}</span>
          </div>
          <p className="text-navy-700 text-xs">
            Add {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount} more qualifying area{EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount !== 1 ? 's' : ''} to unlock up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off.
          </p>
        </>
      )}
    </div>
  );
}

const COMPLETE_KEY_BENEFITS = [
  'Oven, hob, grill and extractor',
  'Microwave, fridge/freezer, dishwasher and washing-machine interiors',
  'Cupboards, drawers and wardrobes',
  'Full kitchen and bathroom detailing',
  'Standard vacuuming and hard-floor mopping',
];
const COMPLETE_MORE_INCLUDED = [
  'Internal windows', 'Bathrooms fully descaled, tiles, grouting and fixtures',
  'Skirting boards, doors, frames and switches', 'Photographic cleaning receipt',
];
const COMPLETE_NOT_INCLUDED = [
  'Professional carpet steam cleaning', 'Upholstery cleaning', 'Exterior windows', 'Rubbish removal', 'Parking and Congestion Charge',
];
const TAILORED_CORE_INCLUDED = [
  'One standard oven, hob, grill and extractor clean',
  'Kitchen and bathroom surfaces',
  'Standard vacuuming and hard-floor mopping',
];
const TAILORED_MORE_INCLUDED = [
  'Bedrooms and reception rooms', 'Internal windows', 'Skirting boards, doors, frames and switches', 'Photographic receipt',
];
const TAILORED_ADD_LATER = [
  'Inside microwave', 'Inside fridge/freezer', 'Inside dishwasher', 'Inside washing machine', 'Cupboards, drawers and wardrobes',
];

const FLOOR_CARE_OPTIONS: { key: 'professional' | 'standard' | 'none'; title: string; badge?: string; bullets: string[] }[] = [
  { key: 'professional', title: 'Professional carpet steam cleaning', badge: 'Popular', bullets: ['Deep hot-water extraction cleaning', 'Added to the same End of Tenancy visit', 'Package savings on qualifying areas'] },
  { key: 'standard', title: 'Standard floor care', bullets: ['Vacuuming of carpets', 'Mopping of suitable hard floors', 'Included with the End of Tenancy clean', 'No additional charge'] },
  { key: 'none', title: 'No carpeted areas', bullets: ['Property has hard floors only', 'Standard suitable floor cleaning remains included'] },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EotQuoteWizard({ onBook, onChangeService, restoreConfig }: Props) {
  const [state, setState] = useState<EotWizardState>(() => makeInitialState(restoreConfig));
  const [step, setStep] = useState(1);
  const [bookError, setBookError] = useState('');
  const [upholsteryOpen, setUpholsteryOpen] = useState(false);
  const wizardRootRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  // Every Continue/Back step change must return the viewport to the wizard
  // itself — never leave the customer at the previous step's scroll position
  // (e.g. still down in the gallery). Skipped on first mount so opening the
  // wizard doesn't itself trigger a jump. The fixed site header's live
  // height is measured rather than hard-coded, so this works unchanged at
  // 375/768/1280px without per-breakpoint branching.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const el = wizardRootRef.current;
    if (!el) return;
    const headerEl = document.querySelector('header');
    const headerOffset = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerOffset - 12);
    const prefersReducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [step]);

  const availableSizeOptions = useMemo(
    () => SIZE_OPTIONS.filter((s) => eotPropertySizeValid(state.propertyType, s.key)),
    [state.propertyType],
  );

  const priceEntry = EOT_PRICES_P[state.propertyType]?.[state.size] ?? EOT_PRICES_P.flat.bed2;
  const bathroomsAddP = Math.max(0, state.fullBathrooms - 1) * EOT_EXTRA_BATH_P;
  const wcsAddP = state.extraWcs * EOT_EXTRA_WC_P;
  const completeAtConfigP = priceEntry.complete + bathroomsAddP + wcsAddP;
  const tailoredAtConfigP = priceEntry.tailored + bathroomsAddP + wcsAddP;
  const cheapestStartingP = Math.min(completeAtConfigP, tailoredAtConfigP);

  // Whole-property carpet preview — the exact same calculation the customer
  // will get if they pick that card, shown up front so the "save up to 50%"
  // headline is always backed by a real, live number for their property.
  const wholePreviewRooms = useMemo(
    () => wholePropertyRooms(state.size, state.propertyType),
    [state.size, state.propertyType],
  );
  const wholePreview = useMemo(
    () => calculateEotCarpetPackage(wholePreviewRooms, wholePreviewRooms.map((r) => r.id)),
    [wholePreviewRooms],
  );

  const activeCarpetRooms: RoomState[] = useMemo(() => {
    if (state.floorCareChoice !== 'professional') return [];
    if (state.carpetMode === 'whole') return state.rooms.filter((r) => r.floor === 'carpet' && r.steamClean);
    if (state.carpetMode === 'manual') return manualCarpetRooms(state.manualCarpetCounts);
    return [];
  }, [state.floorCareChoice, state.carpetMode, state.rooms, state.manualCarpetCounts]);
  const activeCarpetRoomIds = useMemo(() => activeCarpetRooms.map((r) => r.id), [activeCarpetRooms]);

  const quote = useMemo(() => calculateEotQuote({
    size: state.size,
    package: state.pkg,
    isHouse: state.propertyType !== 'flat',
    extraBathrooms: Math.max(0, state.fullBathrooms - 1),
    extraWcs: state.extraWcs,
    tailoredAddOns: state.tailoredAddOns,
    rooms: activeCarpetRooms,
    carpetRoomIds: activeCarpetRoomIds,
  }), [state.size, state.pkg, state.propertyType, state.fullBathrooms, state.extraWcs, state.tailoredAddOns, activeCarpetRooms, activeCarpetRoomIds]);

  const upholsteryTotalP = useMemo(
    () => UPHOLSTERY_FIELDS.reduce((s, f) => s + state.upholsteryCounts[f.key] * f.priceP, 0),
    [state.upholsteryCounts],
  );

  const extrasTotalP = useMemo(() => {
    let total = 0;
    total += state.extras.ext_windows * ADDON_PRICES_P.ext_windows;
    total += state.extras.balcony * ADDON_PRICES_P.balcony;
    total += state.extras.wall_marks * ADDON_PRICES_P.wall_marks;
    total += state.extras.key_collect * ADDON_PRICES_P.key_collect;
    total += state.extras.rubbish * ADDON_PRICES_P.rubbish;
    return total + upholsteryTotalP;
  }, [state.extras, upholsteryTotalP]);

  const isQuoteReviewCondition = state.condition === 'heavy' || state.condition === 'clutter' || state.condition === 'biohazard';
  const totalP = quote.totalP + extrasTotalP;
  const { depositP, balanceP } = calculateDepositAndBalance(totalP);
  const carpetPackage = quote.carpetPackage;

  // ── Step 1 actions ──
  function changeSize(size: SizeKey) {
    setState((p) => ({ ...p, size, is5Plus: false, rooms: defaultRooms(size, p.propertyType) }));
  }
  function changePropertyType(propertyType: PropertyType) {
    setState((p) => {
      const validSize = eotPropertySizeValid(propertyType, p.size) ? p.size : 'bed1';
      return { ...p, propertyType, size: validSize, rooms: defaultRooms(validSize, propertyType) };
    });
  }
  function select5Plus() {
    setState((p) => ({ ...p, is5Plus: true }));
  }

  // ── Step 3 actions ──
  function setFloorCareChoice(choice: FloorCareChoice) {
    setState((p) => ({ ...p, floorCareChoice: choice, carpetMode: choice === 'professional' ? p.carpetMode : 'unset' }));
  }
  function enterWholePropertyCarpet() {
    setState((p) => ({
      ...p,
      carpetMode: 'whole',
      rooms: p.rooms.some((r) => r.steamClean) ? p.rooms : wholePropertyRooms(p.size, p.propertyType),
    }));
  }
  function enterManualCarpet() {
    setState((p) => ({ ...p, carpetMode: 'manual' }));
  }
  function toggleSteamClean(id: string) {
    setState((p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, steamClean: !r.steamClean } : r)) }));
  }
  function setStairFlights(id: string, flights: number) {
    setState((p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, stairFlights: Math.max(1, flights) } : r)) }));
  }
  function addWholeRoom(kind: 'reception' | 'hallway' | 'landing') {
    const labels = { reception: 'Additional reception room', hallway: 'Hallway', landing: 'Landing' };
    const addonKeys = { reception: 'living_room', hallway: 'hallway', landing: 'landing' };
    setState((p) => ({
      ...p,
      rooms: [...p.rooms, { id: `${kind}-${Date.now()}`, label: labels[kind], addonKey: addonKeys[kind], floor: 'carpet', steamClean: true, removable: true }],
    }));
  }
  function removeRoom(id: string) {
    setState((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== id) }));
  }
  function setManualCount(key: keyof Omit<ManualCarpetCounts, 'stairFlights'>, v: number) {
    setState((p) => ({ ...p, manualCarpetCounts: { ...p.manualCarpetCounts, [key]: Math.max(0, v) } }));
  }
  function setManualStairFlights(v: number) {
    setState((p) => ({ ...p, manualCarpetCounts: { ...p.manualCarpetCounts, stairFlights: Math.max(0, v) } }));
  }
  function setUpholsteryCount(key: keyof UpholsteryCounts, v: number) {
    setState((p) => ({ ...p, upholsteryCounts: { ...p.upholsteryCounts, [key]: Math.max(0, v) } }));
  }

  function goNext() {
    setBookError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function goBack() {
    setBookError('');
    setStep((s) => Math.max(1, s - 1));
  }

  function handleBook() {
    if (isQuoteReviewCondition) {
      setBookError('This property needs a quick photo review before we can confirm a price — please use WhatsApp below.');
      return;
    }
    const sel: EotBookingResult = {
      serviceName: `End of tenancy — ${state.pkg === 'complete' ? 'Complete Agency-Ready Clean' : 'Tailored Checklist Clean'} · ${SIZE_OPTIONS.find((s) => s.key === state.size)?.label}`,
      // Exact pence, converted to pounds without rounding — a £127.50 total
      // must never become £128 anywhere downstream (BookingPage, server
      // payload, CRM/admin, WhatsApp text).
      price: totalP / 100,
      quoteConfig: {
        service: 'deep',
        deepService: 'end_of_tenancy',
        deepSize: state.size,
        deepBaths: state.fullBathrooms,
        deepWcs: state.extraWcs,
        isHouse: state.propertyType !== 'flat',
        eotPackage: state.pkg,
        tailoredAddOns: state.tailoredAddOns,
        addOnCounts: { ...state.extras, ...state.upholsteryCounts } as unknown as Record<string, number>,
        rooms: activeCarpetRooms.map((r) => ({ id: r.id, addonKey: r.addonKey, floor: r.floor, stairFlights: r.stairFlights })),
        carpetRoomIds: activeCarpetRoomIds,
        windowSize: 'small',
        gutterType: 'terraced',
        officeHours: 2,
        condition: state.condition,
      },
    };
    onBook(sel);
  }

  const WA_LINK = `https://wa.me/447845451111?text=${encodeURIComponent(
    "Hi VVE Clean, I'd like a photo review for an end of tenancy clean (heavy condition / rubbish / mould / biohazard).",
  )}`;
  const WA_5PLUS_LINK = `https://wa.me/447845451111?text=${encodeURIComponent(
    "Hi VVE Clean, I'd like a tailored quote for a 5+ bedroom end of tenancy clean.",
  )}`;
  const EMAIL_5PLUS_LINK = 'mailto:contact@vveclean.co.uk?subject=' + encodeURIComponent('5+ bedroom end of tenancy quote request');

  const sizeLabel = SIZE_OPTIONS.find((s) => s.key === state.size)?.label ?? '';

  // Step 4 already shows a full "Your quote" payment card (Total, deposit,
  // balance) once the property doesn't need a photo review — the footer's
  // own total would just be a repeated duplicate directly above it, so it is
  // suppressed there while Back stays fully present and accessible.
  const hideFooterTotal = step === TOTAL_STEPS && !isQuoteReviewCondition;
  const footerPriceLabel = step === 1 ? 'Starting from' : isQuoteReviewCondition && step === 4 ? '' : 'Current total';
  const footerPriceValue = step === 1 && state.is5Plus
    ? 'Quote required'
    : isQuoteReviewCondition && step === 4
      ? 'Quote review'
      : step === 1 ? penceToDisplay(cheapestStartingP) : penceToDisplay(totalP);
  const propertySummary = `${sizeLabel} ${state.propertyType === 'flat' ? 'flat' : 'house / maisonette'} · ${state.fullBathrooms} bathroom${state.fullBathrooms !== 1 ? 's' : ''}${state.extraWcs > 0 ? ` · ${state.extraWcs} WC${state.extraWcs !== 1 ? 's' : ''}` : ''}`;
  const packageSummary = state.pkg === 'complete' ? 'Complete Agency-Ready' : 'Tailored Checklist';
  const floorSummary = state.floorCareChoice === 'professional'
    ? 'Professional carpet cleaning'
    : state.floorCareChoice === 'none' ? 'Hard floors only' : state.floorCareChoice === 'standard' ? 'Standard floor care' : 'Floor care not selected';
  const footerSubtext = step === 1
    ? state.is5Plus ? `5+ bedroom ${state.propertyType === 'flat' ? 'flat' : 'house / maisonette'} · tailored quote` : propertySummary
    : step === 2 ? `${propertySummary} · ${packageSummary}`
      : step === 3 ? `${packageSummary} · ${floorSummary}`
        : isQuoteReviewCondition ? 'Photo review required before a fixed price can be confirmed' : null;

  return (
    <div ref={wizardRootRef} className="rounded-[28px] bg-white shadow-[0_28px_80px_rgba(2,11,36,0.28)] ring-1 ring-white/20">
      {/* Header / progress */}
      <div className="rounded-t-[28px] bg-navy-950 px-5 sm:px-8 lg:px-10 py-6 sm:py-7 relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.24),transparent_42%)]" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
            <div>
              <p className="text-sky-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">Instant online estimate</p>
              <h2 className="text-white font-display font-bold text-xl sm:text-2xl tracking-tight">End of Tenancy Quote</h2>
            </div>
            <p className="text-white/60 text-xs">Step {step} of {TOTAL_STEPS} · about 2 minutes</p>
          </div>
          <StepTracker step={step} />
        </div>
      </div>

      {onChangeService && (
        <div className="px-5 sm:px-8 lg:px-10 pt-5 max-w-3xl mx-auto">
          <button type="button" onClick={onChangeService} className="text-xs font-semibold text-royal-700 hover:text-navy-800 underline underline-offset-4 min-h-[44px]">
            Not an end of tenancy clean? Choose a different service
          </button>
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-10 py-7 sm:py-9 max-w-3xl mx-auto w-full">
        {/* ══ Step 1: Property ══ */}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <p className="text-royal-700 text-[10px] font-bold uppercase tracking-[0.18em] mb-2">Your property</p>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">Tell us what we’re cleaning</h3>
              <p className="text-muted text-sm sm:text-base leading-relaxed mt-2 max-w-xl">Choose the closest match. Your live starting price updates as you go.</p>
            </div>

            <div>
              <h4 className="text-navy-900 font-bold text-sm mb-3">What type of property is it?</h4>
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Property type">
                {(['flat', 'house'] as PropertyType[]).map((t) => (
                  <button key={t} type="button" onClick={() => changePropertyType(t)}
                    aria-label={t === 'flat' ? 'Flat' : 'House / Maisonette'}
                    aria-pressed={state.propertyType === t}
                    className={`relative p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-200 min-h-[96px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                      state.propertyType === t ? 'border-royal-500 bg-royal-50 text-royal-700 shadow-[0_10px_30px_rgba(14,165,233,0.12)]' : 'border-line bg-white text-navy-700 hover:border-sky-300 hover:bg-surface'
                    }`}>
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${state.propertyType === t ? 'bg-royal-500 text-white' : 'bg-surface text-navy-700'}`}>
                      {t === 'flat' ? <Building2 size={20} /> : <Home size={20} />}
                    </span>
                    <span className="block text-sm font-bold">{t === 'flat' ? 'Flat' : 'House / Maisonette'}</span>
                    <span className="block text-[11px] font-medium text-muted mt-0.5">{t === 'flat' ? 'Single-level or apartment' : 'House or split-level home'}</span>
                    {state.propertyType === t && <CheckCircle2 size={18} className="absolute top-4 right-4 text-royal-600" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            <div data-testid="property-size-section">
              <div className="flex items-end justify-between gap-4 mb-3">
                <h4 className="text-navy-900 font-bold text-sm">Property size</h4>
                <span className="text-muted text-[11px]">Bedrooms, excluding reception rooms</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" role="group" aria-label="Property size" data-testid="property-size-options">
                {availableSizeOptions.map((s) => (
                  <button key={s.key} type="button" onClick={() => changeSize(s.key)}
                    aria-pressed={!state.is5Plus && state.size === s.key}
                    className={`relative px-2 py-4 rounded-xl border-2 text-center text-xs font-bold transition-all duration-200 min-h-[58px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                      !state.is5Plus && state.size === s.key ? 'border-royal-500 bg-royal-50 text-royal-700 shadow-sm' : 'border-line bg-white text-navy-700 hover:border-sky-300 hover:bg-surface'
                    }`}>
                    {s.label}
                  </button>
                ))}
                <button type="button" onClick={select5Plus}
                  aria-pressed={state.is5Plus}
                  className={`relative px-2 py-3 rounded-xl border-2 text-center transition-all duration-200 min-h-[58px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                    state.is5Plus ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-line bg-white hover:border-amber-300 hover:bg-amber-50/50'
                  }`}>
                  <span className="block text-navy-900 font-bold text-xs">5+ bedrooms</span>
                  <span className="block text-amber-800 text-[9px] font-bold uppercase tracking-wide mt-0.5">Tailored quote</span>
                </button>
              </div>
            </div>

            {state.is5Plus && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center flex-shrink-0"><MessageCircle size={20} /></div>
                <div className="flex-1">
                  <p className="text-navy-900 font-bold text-base">Large properties are quoted individually</p>
                  <p className="text-navy-700 text-xs leading-relaxed mt-1 max-w-lg">
                  5+ bedroom homes vary too much for a fixed instant price. Send us a few details and we'll confirm a fixed price, usually within the hour.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-[180px]">
                  <a href={WA_5PLUS_LINK} target="_blank" rel="noopener noreferrer"
                    className="btn-whatsapp inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl font-bold text-sm">
                    <MessageCircle size={16} /> WhatsApp us
                  </a>
                  <a href={EMAIL_5PLUS_LINK}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl font-bold text-sm border border-amber-400 text-amber-900 hover:bg-amber-100">
                    <Mail size={16} /> Request a quote
                  </a>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-surface px-4 py-4 sm:px-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white border border-line flex items-center justify-center text-navy-700"><Bath size={19} /></span>
                  <div><h4 className="text-navy-900 font-bold text-sm">Full bathrooms</h4><p className="text-muted text-[11px]">Bath or shower rooms</p></div>
                </div>
                <Counter value={state.fullBathrooms} min={1} max={6} label="full bathrooms" onChange={(v) => setState((p) => ({ ...p, fullBathrooms: v }))} />
              </div>
              <div className="rounded-2xl border border-line bg-surface px-4 py-4 sm:px-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white border border-line flex items-center justify-center text-navy-700"><Layers3 size={19} /></span>
                  <div><h4 className="text-navy-900 font-bold text-sm">Separate WCs</h4><p className="text-muted text-[11px]">Toilet only, no bath</p></div>
                </div>
                <Counter value={state.extraWcs} min={0} max={6} label="separate WCs" onChange={(v) => setState((p) => ({ ...p, extraWcs: v }))} />
              </div>
            </div>
          </div>
        )}

        {/* ══ Step 2: Choose your cleaning package ══ */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-royal-700 text-[10px] font-bold uppercase tracking-[0.18em] mb-2">Your cleaning standard</p>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">Choose your cleaning package</h3>
              <p className="text-muted text-sm sm:text-base leading-relaxed mt-2 max-w-xl">Complete is the simplest route to a final inspection. Tailored starts lower and lets you add selected internal tasks later.</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-5 items-start" role="group" aria-label="Cleaning package">
              {/* Complete */}
              <article className={`rounded-3xl border-2 overflow-hidden transition-all duration-200 ${state.pkg === 'complete' ? 'border-royal-500 shadow-[0_18px_50px_rgba(14,165,233,0.16)]' : 'border-line hover:border-sky-300'}`}>
                <div className="bg-navy-950 text-white px-5 py-2.5 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"><BadgeCheck size={14} className="text-amber-400" /> Recommended · Best value</span>
                  <span className="text-[10px] font-semibold text-white/60">Most comprehensive</span>
                </div>
                <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'complete' }))}
                  aria-pressed={state.pkg === 'complete'}
                  className={`relative w-full text-left p-5 sm:p-6 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-royal-600 ${
                    state.pkg === 'complete' ? 'border-royal-500 bg-royal-50' : 'border-transparent bg-white hover:bg-surface'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-navy-900 text-xl">Complete Agency-Ready Clean</div>
                      <p className="text-muted text-xs mt-1">One fixed package for your selected property</p>
                    </div>
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${state.pkg === 'complete' ? 'bg-royal-500 border-royal-500 text-white' : 'border-line text-transparent'}`}><CheckCircle2 size={16} /></span>
                  </div>
                  <div className="flex items-end gap-2 mt-5">
                    <div data-testid="complete-price" className="font-display font-bold text-4xl text-navy-900 tracking-tight">{penceToDisplay(quote.completeEquivalentP)}</div>
                    <span className="text-muted text-xs font-medium mb-1.5">fixed price</span>
                  </div>
                  <p className="text-navy-700 text-xs leading-relaxed mt-3"><strong>Best for:</strong> tenants, landlords and agents preparing for final inspection.</p>
                  <div className="mt-4 rounded-xl bg-white border border-green-200 px-3 py-2.5 flex items-start gap-2 text-green-800 text-xs font-bold">
                    <ShieldCheck size={16} className="flex-shrink-0" /> Full {EOT_GUARANTEE_HOURS}-hour agency-ready guarantee
                  </div>
                  <div className="mt-5">
                    <p className="text-navy-800 text-xs font-bold uppercase tracking-[0.12em] mb-2.5">Included in your price</p>
                    <div className="grid grid-cols-1 gap-2">
                      {COMPLETE_KEY_BENEFITS.map((i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-navy-800 leading-snug"><CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                      ))}
                    </div>
                  </div>
                </button>
                <details className="group border-t border-line bg-white">
                  <summary className="text-royal-700 text-xs font-bold cursor-pointer list-none flex items-center justify-between gap-2 px-5 sm:px-6 py-4 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-royal-600">
                    See full details <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 gap-2">
                    {COMPLETE_MORE_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-navy-800"><CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                    <div className="h-px bg-line my-1.5" />
                    <p className="text-muted text-[11px] font-bold uppercase tracking-[0.12em] mb-0.5">Not included</p>
                    {COMPLETE_NOT_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted"><XCircle size={14} className="text-silver-500 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </details>
              </article>

              {/* Tailored */}
              <article className={`rounded-3xl border-2 overflow-hidden transition-all duration-200 ${state.pkg === 'tailored' ? 'border-royal-500 shadow-[0_18px_50px_rgba(14,165,233,0.14)]' : 'border-line hover:border-sky-300'}`}>
                <div className="bg-surface border-b border-line px-5 py-2.5 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-navy-800 text-[10px] font-bold uppercase tracking-[0.16em]"><ListChecks size={14} className="text-royal-600" /> Build your own</span>
                  <span className="text-[10px] font-semibold text-muted">Core clean + choices</span>
                </div>
                <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'tailored' }))}
                  aria-pressed={state.pkg === 'tailored'}
                  className={`relative w-full text-left p-5 sm:p-6 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-royal-600 ${
                    state.pkg === 'tailored' ? 'border-royal-500 bg-royal-50' : 'border-transparent bg-white hover:bg-surface'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-navy-900 text-xl">Tailored Checklist Clean</div>
                      <p className="text-muted text-xs mt-1">Core checklist with optional internal tasks</p>
                    </div>
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${state.pkg === 'tailored' ? 'bg-royal-500 border-royal-500 text-white' : 'border-line text-transparent'}`}><CheckCircle2 size={16} /></span>
                  </div>
                  <div className="flex items-end gap-2 mt-5">
                    <div data-testid="tailored-price" className="font-display font-bold text-4xl text-navy-900 tracking-tight">Starts at {penceToDisplay(tailoredAtConfigP)}</div>
                  </div>
                  <p className="text-navy-700 text-xs leading-relaxed mt-3">A core checklist clean you build up with only the internal tasks you actually need.</p>
                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2 text-amber-900 text-xs font-bold">
                    <Info size={16} className="flex-shrink-0" /> Guarantee applies only to included and selected tasks
                  </div>
                  <p className="text-navy-700 text-xs leading-relaxed mt-3">Other appliance and storage interiors are not silently included — add exactly what you need in the next step.</p>
                  <div className="mt-5">
                    <p className="text-navy-800 text-xs font-bold uppercase tracking-[0.12em] mb-2.5">Included in the core clean</p>
                    <div className="grid grid-cols-1 gap-2">
                      {TAILORED_CORE_INCLUDED.map((i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-navy-800 leading-snug"><CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                      ))}
                    </div>
                  </div>
                </button>
                <details className="group border-t border-line bg-white">
                  <summary className="text-royal-700 text-xs font-bold cursor-pointer list-none flex items-center justify-between gap-2 px-5 sm:px-6 py-4 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-royal-600">
                    See full details <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 gap-2">
                    {TAILORED_MORE_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-navy-800"><CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                    <div className="h-px bg-line my-1.5" />
                    <p className="text-muted text-[11px] font-bold uppercase tracking-[0.12em] mb-0.5">Add back what you need next</p>
                    {TAILORED_ADD_LATER.map((i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted"><XCircle size={14} className="text-silver-500 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </details>
              </article>
            </div>
          </div>
        )}

        {/* ══ Step 3: Floor care ══ */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-royal-700 text-[10px] font-bold uppercase tracking-[0.18em] mb-2">Floors and carpets</p>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">What floor care do you need?</h3>
              <p className="text-muted text-sm sm:text-base leading-relaxed mt-2 max-w-xl">Standard vacuuming and suitable hard-floor mopping are already included. Upgrade only if you want professional carpet cleaning.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label="Floor care">
              {FLOOR_CARE_OPTIONS.map((opt) => (
                <button key={opt.key} type="button" onClick={() => setFloorCareChoice(opt.key)}
                  aria-pressed={state.floorCareChoice === opt.key}
                  className={`relative w-full text-left rounded-2xl border-2 p-4 sm:p-5 transition-all duration-200 min-h-[150px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${opt.key === 'professional' ? 'sm:col-span-2' : ''} ${
                    state.floorCareChoice === opt.key
                      ? 'border-royal-500 bg-royal-50 shadow-[0_12px_34px_rgba(14,165,233,0.14)]'
                      : opt.key === 'professional' ? 'border-navy-800 bg-navy-950 hover:border-royal-400' : 'border-line bg-white hover:border-sky-300 hover:bg-surface'
                  }`}>
                  <div className={`flex ${opt.key === 'professional' ? 'sm:items-center sm:justify-between' : 'items-start'} gap-4`}>
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${state.floorCareChoice === opt.key ? 'bg-royal-500 text-white' : opt.key === 'professional' ? 'bg-white/10 text-sky-300' : 'bg-surface text-navy-700'}`}>
                      {opt.key === 'professional' ? <Waves size={21} /> : opt.key === 'standard' ? <Sparkles size={20} /> : <CircleOff size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-display font-bold text-lg ${state.floorCareChoice === opt.key || opt.key !== 'professional' ? 'text-navy-900' : 'text-white'}`}>{opt.title}</span>
                        {opt.badge && <span className="bg-amber-400 text-amber-950 text-[9px] font-bold px-2.5 py-1 rounded-full tracking-[0.12em] uppercase">{opt.badge}</span>}
                      </div>
                      <p className={`text-xs font-semibold mt-1 ${state.floorCareChoice === opt.key ? 'text-royal-700' : opt.key === 'professional' ? 'text-sky-300' : 'text-muted'}`}>
                        {opt.key === 'professional' ? `Priced by confirmed area · save up to ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}%` : opt.key === 'standard' ? 'Included · £0 extra' : 'Hard floors only · £0 extra'}
                      </p>
                      <ul className={`mt-3 grid ${opt.key === 'professional' ? 'sm:grid-cols-3' : 'grid-cols-1'} gap-1.5`}>
                        {opt.bullets.map((b) => (
                          <li key={b} className={`text-xs flex items-start gap-1.5 ${state.floorCareChoice === opt.key || opt.key !== 'professional' ? 'text-navy-700' : 'text-white/70'}`}><CheckCircle2 size={13} className={`${state.floorCareChoice === opt.key || opt.key !== 'professional' ? 'text-green-600' : 'text-sky-300'} mt-0.5 flex-shrink-0`} />{b}</li>
                        ))}
                      </ul>
                    </div>
                    <span className={`absolute top-4 right-4 sm:static w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${state.floorCareChoice === opt.key ? 'bg-royal-500 border-royal-500 text-white' : opt.key === 'professional' ? 'border-white/30 text-transparent' : 'border-line text-transparent'}`}><CheckCircle2 size={16} /></span>
                  </div>
                </button>
              ))}
            </div>

            {state.floorCareChoice === 'professional' && (
              <div className="space-y-5 pt-1">
                <div className="rounded-2xl border border-sky-200 bg-royal-50/70 p-4 flex items-start gap-3">
                  <Sparkles size={18} className="text-royal-600 flex-shrink-0 mt-0.5" />
                  <div><p className="text-navy-900 font-bold text-sm">Now choose how to price your carpet areas</p><p className="text-muted text-xs leading-relaxed mt-1">Use our suggested layout for speed, or enter areas yourself. Only confirmed areas are charged.</p></div>
                </div>
                <div className="grid lg:grid-cols-2 gap-4" role="group" aria-label="Carpet cleaning mode">
                  {/* Whole-property */}
                  <button type="button" onClick={enterWholePropertyCarpet}
                    aria-pressed={state.carpetMode === 'whole'}
                    className={`relative text-left rounded-2xl border-2 p-5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                      state.carpetMode === 'whole' ? 'border-royal-500 bg-royal-50 shadow-[0_12px_34px_rgba(14,165,233,0.14)]' : 'border-line bg-white hover:border-sky-300'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-royal-700 text-[10px] font-bold uppercase tracking-[0.14em] mb-1">
                        <Sparkles size={13} /> Recommended for a quick quote
                      </div>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${state.carpetMode === 'whole' ? 'bg-royal-500 border-royal-500 text-white' : 'border-line text-transparent'}`}><CheckCircle2 size={16} /></span>
                    </div>
                    <div className="font-display font-bold text-navy-900 text-lg mt-1">Whole-property carpet cleaning</div>
                    <p className="text-green-700 text-xs font-semibold leading-relaxed mt-1.5">
                      Clean all your carpeted areas during the same End of Tenancy visit and save up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}%.
                    </p>
                    <div className="mt-4 text-xs space-y-2 bg-white rounded-xl border border-sky-200 px-4 py-3">
                      <div className="flex justify-between gap-3 text-muted"><span>Standalone value</span><span className="line-through">{penceToDisplay(wholePreview.standaloneSubtotalP)}</span></div>
                      <div className="flex justify-between gap-3 text-navy-900 font-bold text-sm"><span>Add to this visit</span><span>{penceToDisplay(wholePreview.chargedP)}</span></div>
                      <div className="flex justify-between gap-3 text-green-700 font-bold"><span>Estimated saving</span><span>{penceToDisplay(wholePreview.savingP)}</span></div>
                    </div>
                  </button>

                  {/* Manual */}
                  <button type="button" onClick={enterManualCarpet}
                    aria-pressed={state.carpetMode === 'manual'}
                    className={`relative text-left rounded-2xl border-2 p-5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${
                      state.carpetMode === 'manual' ? 'border-royal-500 bg-royal-50 shadow-[0_12px_34px_rgba(14,165,233,0.14)]' : 'border-line bg-white hover:border-sky-300'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-navy-600 text-[10px] font-bold uppercase tracking-[0.14em] mb-1"><ListChecks size={13} /> Most flexible</div>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${state.carpetMode === 'manual' ? 'bg-royal-500 border-royal-500 text-white' : 'border-line text-transparent'}`}><CheckCircle2 size={16} /></span>
                    </div>
                    <div className="font-display font-bold text-navy-900 text-lg mt-1">Choose areas individually</div>
                    <p className="text-navy-700 text-xs leading-relaxed mt-1.5">
                      Select only the carpeted areas that need professional cleaning.
                    </p>
                    <p className="text-royal-700 text-xs font-semibold mt-4 rounded-xl bg-royal-50 border border-royal-100 px-3 py-2.5">
                      {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}+ qualifying areas unlock up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off, calculated live as you add them.
                    </p>
                  </button>
                </div>

                {/* Whole-property suggested layout */}
                {state.carpetMode === 'whole' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-navy-800 leading-relaxed">
                      We have prepared a typical carpet layout for your property. Review it below and remove or add any areas before continuing. Nothing outside this list is charged.
                    </div>
                    <div className="space-y-2">
                      {state.rooms.map((room) => {
                        const standaloneP = eotCarpetAreaStandalonePriceP(room.addonKey, room.stairFlights ?? 1);
                        return (
                          <div key={room.id} className="rounded-xl border border-silver-300 px-4 py-3">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                              <span className="flex items-center gap-2">
                                <input type="checkbox" checked={room.steamClean} onChange={() => toggleSteamClean(room.id)}
                                  className="w-5 h-5 rounded border-2 border-silver-400 text-royal-600 focus:ring-royal-500" />
                                <span className="text-navy-900 text-sm font-semibold">{room.label}</span>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-royal-700 text-xs font-bold">{penceToDisplay(standaloneP)}</span>
                                {room.removable && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); removeRoom(room.id); }} className="text-silver-600 hover:text-red-600 text-xs font-medium">Remove</button>
                                )}
                              </span>
                            </label>
                            {room.addonKey === 'stairs' && room.steamClean && (
                              <div className="flex items-center justify-between gap-2 mt-2 px-1">
                                <span className="text-navy-700 text-xs">Flights of stairs (first flight included)</span>
                                <Counter value={room.stairFlights ?? 1} min={1} max={6} label="flights of stairs"
                                  onChange={(v) => setStairFlights(room.id, v)} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => addWholeRoom('reception')} className="text-xs font-semibold text-royal-700 hover:text-navy-800 border border-sky-300 rounded-full px-3 py-1.5">+ Reception room</button>
                      <button type="button" onClick={() => addWholeRoom('hallway')} className="text-xs font-semibold text-royal-700 hover:text-navy-800 border border-sky-300 rounded-full px-3 py-1.5">+ Hallway</button>
                      <button type="button" onClick={() => addWholeRoom('landing')} className="text-xs font-semibold text-royal-700 hover:text-navy-800 border border-sky-300 rounded-full px-3 py-1.5">+ Landing</button>
                    </div>
                  </div>
                )}

                {/* Manual counters */}
                {state.carpetMode === 'manual' && (
                  <div className="space-y-2">
                    {MANUAL_CARPET_FIELDS.map((f) => (
                      <div key={f.key} className="flex items-center justify-between gap-2 rounded-xl border border-silver-300 px-4 py-3 min-h-[44px]">
                        <div>
                          <div className="text-navy-800 text-sm font-medium">{f.label}</div>
                          <div className="text-royal-700 text-[11px] font-bold">{penceToDisplay(f.priceP)} each</div>
                        </div>
                        <Counter value={state.manualCarpetCounts[f.key]} max={10} label={f.label} onChange={(v) => setManualCount(f.key, v)} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-silver-300 px-4 py-3 min-h-[44px]">
                      <div>
                        <div className="text-navy-800 text-sm font-medium">Staircase flights</div>
                        <div className="text-royal-700 text-[11px] font-bold">{penceToDisplay(STAIRS_FIRST_P)} first flight, +{penceToDisplay(STAIRS_EXTRA_P)} each extra</div>
                      </div>
                      <Counter value={state.manualCarpetCounts.stairFlights} max={6} label="staircase flights" onChange={setManualStairFlights} />
                    </div>
                  </div>
                )}

                {activeCarpetRooms.length > 0 && <CarpetPackageBreakdown carpetPackage={carpetPackage} />}
              </div>
            )}
          </div>
        )}

        {/* ══ Step 4: Add-ons and final review ══ */}
        {step === 4 && (
          <div className="space-y-6">
            {state.pkg === 'tailored' ? (
              <div>
                <h3 className="text-navy-900 font-bold text-base mb-1">Add back the internal tasks you need</h3>
                <p className="text-navy-700 text-xs mb-3">Every price is shown before you select it — nothing is added silently.</p>

                <p className="text-navy-800 text-xs font-bold uppercase tracking-widest mb-1.5 mt-3">Appliance interiors</p>
                <div className="space-y-2">
                  {[
                    { key: 'microwaveInside' as const, label: 'Inside microwave', price: EOT_TAILORED_ADDON_PRICES_P.microwave_inside },
                    { key: 'fridgeFreezerInside' as const, label: 'Inside standard fridge/freezer', price: EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside },
                    { key: 'dishwasherInside' as const, label: 'Inside dishwasher compartments', price: EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside },
                    { key: 'washingMachineInside' as const, label: 'Inside washing-machine compartments', price: EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-silver-100 border border-silver-300 px-4 py-3 cursor-pointer min-h-[44px]">
                      <span className="text-navy-800 text-sm font-medium">{item.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-royal-700 text-xs font-bold">+{penceToDisplay(item.price)}</span>
                        <input type="checkbox" checked={state.tailoredAddOns[item.key]}
                          onChange={(e) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, [item.key]: e.target.checked } }))}
                          className="w-5 h-5 rounded border-2 border-silver-400 text-royal-600 focus:ring-royal-500" />
                      </span>
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-silver-100 border border-silver-300 px-4 py-3 min-h-[44px]">
                    <span className="text-navy-800 text-sm font-medium">Additional separate fridge or freezer</span>
                    <span className="flex items-center gap-3">
                      <span className="text-royal-700 text-xs font-bold">+{penceToDisplay(EOT_TAILORED_ADDON_PRICES_P.extra_fridge_freezer)} each</span>
                      <Counter value={state.tailoredAddOns.extraFridgeFreezers} label="additional fridge/freezer"
                        onChange={(v) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, extraFridgeFreezers: v } }))} />
                    </span>
                  </div>
                </div>

                <p className="text-navy-800 text-xs font-bold uppercase tracking-widest mb-1.5 mt-4">Cupboards and storage</p>
                <label className="flex items-center justify-between gap-2 rounded-xl bg-silver-100 border border-silver-300 px-4 py-3 cursor-pointer min-h-[44px]">
                  <span className="text-navy-800 text-sm font-medium">Cupboards, drawers &amp; wardrobes</span>
                  <span className="flex items-center gap-3">
                    <span className="text-royal-700 text-xs font-bold">+{penceToDisplay(EOT_TAILORED_CUPBOARDS_PRICES_P[state.size])}</span>
                    <input type="checkbox" checked={state.tailoredAddOns.cupboards}
                      onChange={(e) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, cupboards: e.target.checked } }))}
                      className="w-5 h-5 rounded border-2 border-silver-400 text-royal-600 focus:ring-royal-500" />
                  </span>
                </label>
              </div>
            ) : (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
                Complete already includes every internal task above — nothing to reselect here. Only genuinely optional extras are shown below.
              </div>
            )}

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Other add-ons</h3>
              <div className="space-y-2">
                {[
                  { key: 'ext_windows' as const, label: 'Exterior windows', price: ADDON_PRICES_P.ext_windows },
                  { key: 'balcony' as const, label: 'Balcony', price: ADDON_PRICES_P.balcony },
                  { key: 'wall_marks' as const, label: 'Wall-mark treatment', price: ADDON_PRICES_P.wall_marks },
                  { key: 'key_collect' as const, label: 'Key collection/return', price: ADDON_PRICES_P.key_collect },
                  { key: 'rubbish' as const, label: 'Rubbish removal (small load)', price: ADDON_PRICES_P.rubbish },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-silver-100 border border-silver-300 px-4 py-3 min-h-[44px]">
                    <div>
                      <div className="text-navy-800 text-sm font-medium">{item.label}</div>
                      <div className="text-royal-700 text-[11px] font-bold">+{penceToDisplay(item.price)}</div>
                    </div>
                    <Counter value={state.extras[item.key]} label={item.label} onChange={(v) => setState((p) => ({ ...p, extras: { ...p.extras, [item.key]: v } }))} />
                  </div>
                ))}

                {/* Inline upholstery/mattress selector — adds straight to this quote, no navigation away */}
                <div className="rounded-xl border border-purple-300 bg-purple-50 overflow-hidden">
                  <button type="button" onClick={() => setUpholsteryOpen((o) => !o)}
                    aria-expanded={upholsteryOpen}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] text-left">
                    <div>
                      <div className="text-navy-800 text-sm font-medium">Upholstery &amp; mattress cleaning</div>
                      <div className="text-purple-800 text-[11px] font-semibold">
                        {upholsteryTotalP > 0 ? `${penceToDisplay(upholsteryTotalP)} added to this quote` : 'Add sofas, armchairs or mattresses to this visit'}
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-purple-700 flex-shrink-0 transition-transform duration-200 ${upholsteryOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {upholsteryOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-purple-200 space-y-2.5">
                      {UPHOLSTERY_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-navy-800 text-xs font-medium">{f.label}</div>
                            <div className="text-purple-800 text-[11px] font-bold">{penceToDisplay(f.priceP)} each</div>
                          </div>
                          <Counter value={state.upholsteryCounts[f.key]} max={10} label={f.label} onChange={(v) => setUpholsteryCount(f.key, v)} />
                        </div>
                      ))}
                      <button type="button" onClick={() => setUpholsteryOpen(false)}
                        className="text-xs font-semibold text-purple-800 underline underline-offset-2 mt-1">
                        Done
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <div>
                    <div className="text-navy-800 text-sm font-medium">Rug cleaning</div>
                    <div className="text-amber-800 text-[11px] font-semibold">Photo assessment required — not automatically priced</div>
                  </div>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-amber-800 underline underline-offset-2 whitespace-nowrap">WhatsApp a photo</a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Condition</h3>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Property condition">
                {([
                  ['normal', 'Normal used condition'],
                  ['heavy', 'Heavy grease, scale or build-up'],
                  ['clutter', 'Excessive rubbish or clutter'],
                  ['biohazard', 'Mould, biohazard or specialist contamination'],
                ] as [ConditionState, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setState((p) => ({ ...p, condition: k }))}
                    aria-pressed={state.condition === k}
                    className={`py-3 px-3 rounded-xl border-2 text-left text-xs font-semibold leading-snug transition-all duration-200 min-h-[44px] ${
                      state.condition === k
                        ? k === 'normal' ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-silver-300 text-navy-700 hover:border-sky-300'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {isQuoteReviewCondition && (
                <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Info size={13} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-900 text-xs leading-relaxed font-medium">
                    Photo review required. We will confirm any adjustment before accepting the booking request — no automatic surcharge is applied.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
              <p className="text-navy-800 text-xs leading-relaxed">
                Parking costs are not included and may be added at the actual cost where required. Congestion Charge will only be added if applicable. These details are confirmed during booking.
              </p>
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base">Review your quote</h3>
              <div className="rounded-2xl border border-silver-300 divide-y divide-silver-200 overflow-hidden mt-3">
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-navy-600">Property</span>
                  <span className="text-navy-900 font-semibold">{state.propertyType === 'flat' ? 'Flat' : 'House / Maisonette'} · {sizeLabel}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-navy-600">Bathrooms / WCs</span>
                  <span className="text-navy-900 font-semibold">{state.fullBathrooms} bathroom{state.fullBathrooms !== 1 ? 's' : ''}{state.extraWcs > 0 ? ` · ${state.extraWcs} WC${state.extraWcs > 1 ? 's' : ''}` : ''}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-navy-600">Package</span>
                  <span className="text-navy-900 font-semibold">{state.pkg === 'complete' ? 'Complete Agency-Ready Clean' : 'Tailored Checklist Clean'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-navy-600">Floor care</span>
                  <span className="text-navy-900 font-semibold">
                    {state.floorCareChoice === 'professional' ? 'Professional carpet steam cleaning' : state.floorCareChoice === 'none' ? 'No carpeted areas' : 'Standard (included)'}
                  </span>
                </div>
                {state.pkg === 'tailored' && Object.entries(state.tailoredAddOns).some(([k, v]) => (k === 'extraFridgeFreezers' ? Number(v) > 0 : v)) && (
                  <div className="px-4 py-3 text-sm">
                    <span className="text-navy-600 block mb-1">Internal tasks added</span>
                    <ul className="text-navy-900 text-xs space-y-0.5">
                      {state.tailoredAddOns.microwaveInside && <li>• Inside microwave</li>}
                      {state.tailoredAddOns.fridgeFreezerInside && <li>• Inside fridge/freezer</li>}
                      {state.tailoredAddOns.extraFridgeFreezers > 0 && <li>• {state.tailoredAddOns.extraFridgeFreezers} × additional fridge/freezer</li>}
                      {state.tailoredAddOns.dishwasherInside && <li>• Inside dishwasher</li>}
                      {state.tailoredAddOns.washingMachineInside && <li>• Inside washing machine</li>}
                      {state.tailoredAddOns.cupboards && <li>• Cupboards, drawers &amp; wardrobes</li>}
                    </ul>
                  </div>
                )}
                {activeCarpetRooms.length > 0 && (
                  <div className="px-4 py-3 text-sm">
                    <span className="text-navy-600 block mb-1">Confirmed carpet areas</span>
                    <ul className="text-navy-900 text-xs space-y-0.5 mb-2">
                      {activeCarpetRooms.map((r) => (
                        <li key={r.id}>
                          • {r.label}{r.addonKey === 'stairs' && (r.stairFlights ?? 1) > 1 ? ` (${r.stairFlights} flights)` : ''}
                          {' — '}{penceToDisplay(eotCarpetAreaStandalonePriceP(r.addonKey, r.stairFlights ?? 1))} standard value
                        </li>
                      ))}
                    </ul>
                    <CarpetPackageBreakdown carpetPackage={carpetPackage} />
                  </div>
                )}
                {(Object.entries(state.extras).some(([, v]) => v > 0) || upholsteryTotalP > 0) && (
                  <div className="px-4 py-3 text-sm">
                    <span className="text-navy-600 block mb-1">Other extras</span>
                    <ul className="text-navy-900 text-xs space-y-0.5">
                      {state.extras.ext_windows > 0 && <li>• {state.extras.ext_windows} × Exterior windows</li>}
                      {state.extras.balcony > 0 && <li>• {state.extras.balcony} × Balcony</li>}
                      {state.extras.wall_marks > 0 && <li>• {state.extras.wall_marks} × Wall-mark treatment</li>}
                      {state.extras.key_collect > 0 && <li>• {state.extras.key_collect} × Key collection/return</li>}
                      {state.extras.rubbish > 0 && <li>• {state.extras.rubbish} × Rubbish removal</li>}
                      {UPHOLSTERY_FIELDS.filter((f) => state.upholsteryCounts[f.key] > 0).map((f) => (
                        <li key={f.key}>• {state.upholsteryCounts[f.key]} × {f.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="px-4 py-3 text-sm">
                  <span className="text-navy-600 block mb-1">Condition</span>
                  <p className="text-navy-900 text-xs">
                    {state.condition === 'normal' ? 'Normal used condition' : 'Flagged for photo review — quote to be confirmed'}
                  </p>
                </div>
                <div className="px-4 py-3 text-xs text-navy-600 leading-relaxed">
                  Parking and Congestion Charge are not included above — confirmed and charged at actual cost during booking.
                </div>
              </div>

              {isQuoteReviewCondition ? (
                <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-5 text-center space-y-2 mt-4">
                  <p className="text-purple-900 font-bold text-sm">Photo review required</p>
                  <p className="text-purple-800 text-xs leading-relaxed">
                    The condition you selected needs a quick photo review before we can confirm a fixed price — no automatic surcharge is applied. Send us photos on WhatsApp and we'll confirm within the hour.
                  </p>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                    className="btn-whatsapp inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-full font-bold text-sm mt-2">
                    Send photos on WhatsApp
                  </a>
                </div>
              ) : (
                // ── Final payment card ── one clean, premium card: single Total,
                // deposit, balance, guarantee badge. No duplicated pricing block.
                <div className="rounded-2xl bg-white border border-silver-300 shadow-sm px-5 py-5 mt-4">
                  <p className="text-navy-500 text-[10px] font-bold uppercase tracking-widest mb-2">Your quote</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-navy-800 text-sm font-semibold">Total</span>
                    <span data-testid="final-total" className="text-navy-900 font-display font-bold text-3xl">{penceToDisplay(totalP)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-silver-200 space-y-1.5 text-sm">
                    <div className="flex justify-between text-navy-700"><span>Deposit today</span><span className="font-semibold text-navy-900">{penceToDisplay(depositP)}</span></div>
                    <div className="flex justify-between text-navy-700"><span>Balance after cleaning</span><span className="font-semibold text-navy-900">{penceToDisplay(balanceP)}</span></div>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-green-800 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 text-xs font-semibold">
                    <ShieldCheck size={13} /> {state.pkg === 'complete' ? `Full ${EOT_GUARANTEE_HOURS}-hour agency-ready guarantee` : `${EOT_GUARANTEE_HOURS}-hour guarantee on selected tasks`}
                  </div>
                  <p className="text-navy-600 text-[11px] mt-3 leading-relaxed">
                    The remaining balance is due after the work is completed and you have had the opportunity to inspect it. Your appointment is a booking request until availability is confirmed.
                  </p>
                </div>
              )}

              {bookError && (
                <div role="alert" className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm mt-3">{bookError}</div>
              )}

              {!isQuoteReviewCondition && (
                <button type="button" onClick={handleBook}
                  className="flex items-center justify-center gap-2 w-full py-4 min-h-[44px] rounded-full font-bold text-white text-base bg-royal-500 hover:bg-royal-600 transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] mt-4">
                  Continue to booking
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky quote summary. It sits above the site's mobile booking bar and
          cookie banner, then returns to bottom: 0 when that bar is hidden on
          desktop. The content area remains in normal document flow, so no
          selections are obscured behind it. */}
      <div className="sticky bottom-[calc(var(--vve-cookie-banner-h,0px)+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-white/95 backdrop-blur-xl rounded-b-[28px] shadow-[0_-14px_34px_rgba(2,11,36,0.10)]">
        <div
          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-3 gap-x-4 px-5 sm:px-8 lg:px-10 py-4 max-w-3xl mx-auto"
          data-testid="footer-nav"
        >
          <button type="button" onClick={goBack} disabled={step === 1}
            className="order-2 sm:order-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-navy-700 border border-line bg-white hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed min-h-[46px] min-w-[106px] px-4 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
            <ChevronLeft size={16} /> Back
          </button>

          {!hideFooterTotal && (
            <div className="order-1 sm:order-2 w-full sm:w-auto sm:flex-1 text-left sm:text-center" data-testid="footer-price-summary" aria-live="polite">
              <div className="flex items-baseline justify-between sm:justify-center gap-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-bold">{footerPriceLabel}</div>
                <div data-testid="footer-total" className="text-navy-900 font-display font-bold text-2xl tabular-nums">{footerPriceValue}</div>
              </div>
              {footerSubtext && <div className="text-[11px] text-muted mt-0.5 truncate" title={footerSubtext}>{footerSubtext}</div>}
            </div>
          )}

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={goNext} disabled={step === 1 && state.is5Plus}
              className="order-3 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-royal-500 hover:bg-royal-600 rounded-xl px-5 min-h-[46px] min-w-[122px] shadow-[0_8px_20px_rgba(14,165,233,0.24)] transition-all duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <span className="order-3 w-16" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
