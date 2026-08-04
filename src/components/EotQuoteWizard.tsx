import { useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Info, Mail, MessageCircle, Minus, Plus, ShieldCheck, Sparkles, XCircle,
} from 'lucide-react';
import {
  EOT_COMPLETE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_HOUSE_ADJUSTMENT_P,
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

// Maisonettes price identically to houses (both take EOT_HOUSE_ADJUSTMENT_P),
// so they are offered as a single combined choice rather than a third,
// pricing-identical option.
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

const STEP_LABELS = ['Property details', 'Choose your cleaning package', 'Floor care', 'Add-ons & review'];
const TOTAL_STEPS = 4;

const MANUAL_CARPET_FIELDS: { key: keyof Omit<ManualCarpetCounts, 'stairFlights'>; addonKey: string; label: string; idPrefix: string; priceP: number }[] = [
  { key: 'bedroom', addonKey: 'bedroom', label: 'Bedrooms', idPrefix: 'bed', priceP: CARPET_ITEM_PRICES_P.bedroom },
  { key: 'livingRoom', addonKey: 'living_room', label: 'Living rooms', idPrefix: 'lr', priceP: CARPET_ITEM_PRICES_P.living_room },
  { key: 'diningRoom', addonKey: 'living_room', label: 'Dining rooms', idPrefix: 'dr', priceP: CARPET_ITEM_PRICES_P.living_room },
  { key: 'largeLounge', addonKey: 'large_lounge', label: 'Large lounges', idPrefix: 'lounge', priceP: CARPET_ITEM_PRICES_P.large_lounge },
  { key: 'hallway', addonKey: 'hallway', label: 'Hallways', idPrefix: 'hall', priceP: CARPET_ITEM_PRICES_P.hallway },
  { key: 'landing', addonKey: 'landing', label: 'Landings', idPrefix: 'land', priceP: CARPET_ITEM_PRICES_P.landing },
];

function defaultTailoredAddOns(): TailoredAddOns {
  return { fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false };
}
function defaultExtras(): ExtrasState {
  return { ext_windows: 0, balcony: 0, wall_marks: 0, key_collect: 0, rubbish: 0 };
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
  const size: SizeKey = (restore?.deepSize as SizeKey) ?? 'bed2';
  const propertyType: PropertyType = restore?.isHouse ? 'house' : 'flat';
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
    condition: restore?.condition ?? 'normal',
  };
}

// ─── Small shared bits ────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 === step ? 'w-6 bg-royal-500' : i + 1 < step ? 'w-1.5 bg-royal-300' : 'w-1.5 bg-silver-200'
          }`}
        />
      ))}
    </div>
  );
}

function Counter({ value, onChange, min = 0, max, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        aria-label={`Decrease ${label}`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
        <Minus size={14} />
      </button>
      <span className="w-7 text-center text-navy-900 font-bold text-sm" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)} disabled={max !== undefined && value >= max}
        aria-label={`Increase ${label}`}
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 active:bg-royal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
        <Plus size={14} />
      </button>
    </div>
  );
}

// Live carpet-package breakdown — the single presentation used everywhere a
// standalone value / package saving / today price needs to be shown, so the
// numbers can never drift between Step 3 and the Step 4 review.
function CarpetPackageBreakdown({ carpetPackage }: { carpetPackage: ReturnType<typeof calculateEotCarpetPackage> }) {
  if (carpetPackage.itemCount === 0) return null;
  return (
    <div className="rounded-xl bg-royal-50 border border-royal-200 px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-royal-700">Standard carpet-cleaning value</span>
        <span className="text-navy-900 font-semibold">{penceToDisplay(carpetPackage.standaloneSubtotalP)}</span>
      </div>
      {carpetPackage.eligible ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-royal-700">EOT carpet-package saving</span>
            <span className="text-green-700 font-semibold">−{penceToDisplay(carpetPackage.savingP)}</span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-royal-200 pt-1.5 mt-1">
            <span className="text-royal-700 font-semibold">Professional carpet cleaning today</span>
            <span className="text-royal-700 font-display font-bold text-lg">{penceToDisplay(carpetPackage.chargedP)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-base border-t border-royal-200 pt-1.5 mt-1">
            <span className="text-royal-700 font-semibold">Professional carpet cleaning today</span>
            <span className="text-royal-700 font-display font-bold text-lg">{penceToDisplay(carpetPackage.chargedP)}</span>
          </div>
          <p className="text-royal-600 text-xs">
            Add {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount} more qualifying area{EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount !== 1 ? 's' : ''} to unlock up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off.
          </p>
        </>
      )}
    </div>
  );
}

const COMPLETE_KEY_BENEFITS = [
  'Full appliance interiors',
  'Internal cupboards, drawers and wardrobes',
  'Internal windows',
  'Complete kitchen and bathroom detailing',
  'Standard vacuuming and hard-floor mopping',
  'Agency-ready cleaning guarantee',
  'Cleaning receipt or confirmation',
];
const COMPLETE_NOT_INCLUDED = [
  'Professional carpet steam cleaning', 'Upholstery cleaning', 'Exterior windows', 'Rubbish removal', 'Parking and Congestion Charge',
];
const TAILORED_INCLUDED = [
  'Kitchen and bathroom surfaces', 'Oven, hob, grill and extractor', 'Bedrooms and reception rooms',
  'Internal windows', 'Skirting boards, doors, frames and switches', 'Standard vacuuming', 'Standard hard-floor mopping', 'Photographic receipt',
];
const TAILORED_ADD_LATER = [
  'Inside fridge/freezer', 'Inside dishwasher', 'Inside washing machine', 'Cupboards, drawers and wardrobes',
];

const FLOOR_CARE_OPTIONS: { key: 'standard' | 'professional' | 'none'; title: string; bullets: string[] }[] = [
  { key: 'standard', title: 'Standard floor care', bullets: ['Vacuuming of carpets', 'Mopping of suitable hard floors', 'Included with the End of Tenancy clean', 'No additional charge'] },
  { key: 'professional', title: 'Professional carpet steam cleaning', bullets: ['Deep hot-water extraction cleaning', 'Added to the same End of Tenancy visit', 'Package savings available'] },
  { key: 'none', title: 'No carpeted areas', bullets: ['Property has hard floors only', 'Standard suitable floor cleaning remains included'] },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EotQuoteWizard({ onBook, onChangeService, restoreConfig }: Props) {
  const [state, setState] = useState<EotWizardState>(() => makeInitialState(restoreConfig));
  const [step, setStep] = useState(1);
  const [bookError, setBookError] = useState('');

  const houseAdjP = state.propertyType !== 'flat' ? EOT_HOUSE_ADJUSTMENT_P : 0;
  const bathroomsAddP = Math.max(0, state.fullBathrooms - 1) * EOT_EXTRA_BATH_P;
  const wcsAddP = state.extraWcs * EOT_EXTRA_WC_P;
  const completeAtConfigP = EOT_COMPLETE_PRICES_P[state.size] + houseAdjP + bathroomsAddP + wcsAddP;
  const tailoredAtConfigP = EOT_TAILORED_START_PRICES_P[state.size] + houseAdjP + bathroomsAddP + wcsAddP;
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

  const extrasTotalP = useMemo(() => {
    let total = 0;
    total += state.extras.ext_windows * ADDON_PRICES_P.ext_windows;
    total += state.extras.balcony * ADDON_PRICES_P.balcony;
    total += state.extras.wall_marks * ADDON_PRICES_P.wall_marks;
    total += state.extras.key_collect * ADDON_PRICES_P.key_collect;
    total += state.extras.rubbish * ADDON_PRICES_P.rubbish;
    return total;
  }, [state.extras]);

  const isQuoteReviewCondition = state.condition === 'heavy' || state.condition === 'clutter' || state.condition === 'biohazard';
  const totalP = quote.totalP + extrasTotalP;
  const totalPounds = Math.round(totalP / 100);
  const { depositP, balanceP } = calculateDepositAndBalance(totalP);
  const carpetPackage = quote.carpetPackage;

  // ── Step 1 actions ──
  function changeSize(size: SizeKey) {
    setState((p) => ({ ...p, size, is5Plus: false, rooms: defaultRooms(size, p.propertyType) }));
  }
  function changePropertyType(propertyType: PropertyType) {
    setState((p) => ({ ...p, propertyType, rooms: defaultRooms(p.size, propertyType) }));
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
      price: totalPounds,
      quoteConfig: {
        service: 'deep',
        deepService: 'end_of_tenancy',
        deepSize: state.size,
        deepBaths: state.fullBathrooms,
        deepWcs: state.extraWcs,
        isHouse: state.propertyType !== 'flat',
        eotPackage: state.pkg,
        tailoredAddOns: state.tailoredAddOns,
        addOnCounts: state.extras as unknown as Record<string, number>,
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

  return (
    <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
      {/* Header / progress */}
      <div className="navy-gradient px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-silver-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
          </p>
          <h2 className="text-white font-display font-bold text-lg sm:text-xl">End of Tenancy Quote</h2>
        </div>
        <StepDots step={step} total={TOTAL_STEPS} />
      </div>

      {onChangeService && (
        <div className="px-5 sm:px-8 pt-4">
          <button type="button" onClick={onChangeService} className="text-xs font-semibold text-royal-600 hover:text-royal-700 underline underline-offset-2">
            Not an end of tenancy clean? Choose a different service
          </button>
        </div>
      )}

      <div className="px-5 sm:px-8 py-6">
        {/* ══ Step 1: Property details ══ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">What type of property is it?</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['flat', 'house'] as PropertyType[]).map((t) => (
                  <button key={t} type="button" onClick={() => changePropertyType(t)}
                    className={`py-3.5 rounded-xl border-2 text-sm font-bold transition-all duration-200 min-h-[44px] ${
                      state.propertyType === t ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                    }`}>
                    {t === 'flat' ? 'Flat' : 'House / Maisonette'}
                  </button>
                ))}
              </div>
              {state.propertyType !== 'flat' && (
                <p className="text-royal-600 text-xs font-semibold mt-2">+{penceToDisplay(EOT_HOUSE_ADJUSTMENT_P)} house/maisonette adjustment</p>
              )}
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Property size</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {SIZE_OPTIONS.map((s) => (
                  <button key={s.key} type="button" onClick={() => changeSize(s.key)}
                    className={`py-3 rounded-xl border-2 text-center transition-all duration-200 min-h-[44px] ${
                      !state.is5Plus && state.size === s.key ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                    }`}>
                    <div className="text-xs font-bold">{s.label}</div>
                    <div className="text-[10px] mt-0.5">from £{Math.min(EOT_COMPLETE_PRICES_P[s.key], EOT_TAILORED_START_PRICES_P[s.key]) / 100}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 5+ bedrooms — an active, intentional choice, never disabled-looking */}
            <button type="button" onClick={select5Plus}
              className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center justify-between gap-3 ${
                state.is5Plus ? 'border-royal-500 bg-royal-50' : 'border-royal-200 bg-white hover:border-royal-400'
              }`}>
              <div>
                <div className="text-navy-900 font-bold text-sm">5+ bedrooms</div>
                <div className="text-royal-600 text-xs font-semibold">Tailored quotation required</div>
              </div>
              <ChevronRight size={18} className="text-royal-500 flex-shrink-0" />
            </button>

            {state.is5Plus && (
              <div className="rounded-2xl bg-royal-50 border-2 border-royal-200 p-5 text-center space-y-3">
                <p className="text-navy-900 font-bold text-sm">Large properties are quoted individually</p>
                <p className="text-silver-600 text-xs leading-relaxed max-w-sm mx-auto">
                  5+ bedroom homes vary too much for a fixed instant price. Send us a few details and we'll confirm a fixed price, usually within the hour.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <a href={WA_5PLUS_LINK} target="_blank" rel="noopener noreferrer"
                    className="btn-whatsapp inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-full font-bold text-sm">
                    <MessageCircle size={16} /> WhatsApp us
                  </a>
                  <a href={EMAIL_5PLUS_LINK}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-full font-bold text-sm border-2 border-royal-500 text-royal-700 hover:bg-royal-50">
                    <Mail size={16} /> Request a quote
                  </a>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-1">Number of full bathrooms</h3>
              <p className="text-silver-600 text-xs mb-3">The first bathroom is included in the base price.</p>
              <Counter value={state.fullBathrooms} min={1} max={6} label="full bathrooms" onChange={(v) => setState((p) => ({ ...p, fullBathrooms: v }))} />
              {state.fullBathrooms > 1 && (
                <p className="text-royal-600 text-xs font-semibold mt-2">
                  +{penceToDisplay(EOT_EXTRA_BATH_P * (state.fullBathrooms - 1))} for {state.fullBathrooms - 1} extra bathroom{state.fullBathrooms > 2 ? 's' : ''}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-1">Number of separate toilets/WCs</h3>
              <p className="text-silver-600 text-xs mb-3">A standalone toilet that isn't part of a full bathroom.</p>
              <Counter value={state.extraWcs} min={0} max={6} label="separate WCs" onChange={(v) => setState((p) => ({ ...p, extraWcs: v }))} />
              {state.extraWcs > 0 && (
                <p className="text-royal-600 text-xs font-semibold mt-2">+{penceToDisplay(EOT_EXTRA_WC_P * state.extraWcs)} for {state.extraWcs} separate WC{state.extraWcs > 1 ? 's' : ''}</p>
              )}
            </div>

            {!state.is5Plus && (
              <div className="rounded-xl bg-royal-50 border border-royal-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-royal-700 text-sm font-semibold">Starting from</span>
                  <span className="text-royal-700 font-display font-bold text-2xl">{penceToDisplay(cheapestStartingP)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-silver-600 mt-1.5 pt-1.5 border-t border-royal-200/60">
                  <span>Tailored from {penceToDisplay(tailoredAtConfigP)}</span>
                  <span>Complete {penceToDisplay(completeAtConfigP)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ Step 2: Choose your cleaning package ══ */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-navy-900 font-bold text-base">Choose your cleaning package</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Complete */}
              <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'complete' }))}
                className={`relative text-left rounded-2xl border-2 p-5 transition-all duration-200 flex flex-col ${
                  state.pkg === 'complete' ? 'border-royal-500 bg-royal-50 shadow-lg' : 'border-silver-200 hover:border-royal-300'
                }`}>
                <span className="absolute -top-3 left-4 bg-amber-400 text-amber-900 text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase shadow-sm">
                  Recommended · Best value
                </span>
                <div className="mt-2 font-display font-bold text-navy-900 text-lg">Complete Agency-Ready Clean</div>
                <div data-testid="complete-price" className="font-display font-bold text-3xl text-royal-600 mt-1">
                  {penceToDisplay(quote.completeEquivalentP)}
                </div>
                <p className="text-silver-600 text-xs leading-relaxed mt-1">Fixed package price for your selected property.</p>
                <p className="text-navy-700 text-xs leading-relaxed mt-2">
                  <strong>Best for:</strong> tenants, landlords and agents preparing for final inspection.
                </p>
                <div className="mt-3">
                  <p className="text-navy-700 text-xs font-bold mb-1.5">Key benefits</p>
                  <div className="grid grid-cols-1 gap-1">
                    {COMPLETE_KEY_BENEFITS.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy-700"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                  <ShieldCheck size={14} /> Full {EOT_GUARANTEE_HOURS}-hour agency-ready guarantee
                </div>
                <div className="mt-3 pt-3 border-t border-silver-200">
                  <p className="text-silver-500 text-xs font-bold mb-1.5">Not included</p>
                  <div className="grid grid-cols-1 gap-1">
                    {COMPLETE_NOT_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-silver-500"><XCircle size={12} className="text-silver-400 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </div>
              </button>

              {/* Tailored */}
              <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'tailored' }))}
                className={`text-left rounded-2xl border-2 p-5 transition-all duration-200 flex flex-col ${
                  state.pkg === 'tailored' ? 'border-royal-500 bg-royal-50 shadow-lg' : 'border-silver-200 hover:border-royal-300'
                }`}>
                <div className="font-display font-bold text-navy-900 text-lg">Tailored Checklist Clean</div>
                <div data-testid="tailored-price" className="font-display font-bold text-3xl text-royal-600 mt-1">
                  Starts at {penceToDisplay(tailoredAtConfigP)}
                </div>
                <p className="text-silver-600 text-xs leading-relaxed mt-2">
                  Build the service around the items you actually require. You'll choose the internal cleaning items you need in the next step.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                  <Info size={14} /> Guarantee applies only to the tasks in your quote
                </div>
                <div className="mt-3">
                  <p className="text-navy-700 text-xs font-bold mb-1.5">Included as standard</p>
                  <div className="grid grid-cols-1 gap-1">
                    {TAILORED_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy-700"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-silver-200">
                  <p className="text-silver-500 text-xs font-bold mb-1.5">Add back what you need next</p>
                  <div className="grid grid-cols-1 gap-1">
                    {TAILORED_ADD_LATER.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-silver-500"><XCircle size={12} className="text-silver-400 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ══ Step 3: Floor care ══ */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-navy-900 font-bold text-base">What floor care do you need?</h3>
            <div className="space-y-2.5">
              {FLOOR_CARE_OPTIONS.map((opt) => (
                <button key={opt.key} type="button" onClick={() => setFloorCareChoice(opt.key)}
                  className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 ${
                    state.floorCareChoice === opt.key ? 'border-royal-500 bg-royal-50 shadow-md' : 'border-silver-200 hover:border-royal-300'
                  }`}>
                  <div className="font-bold text-navy-900 text-sm">{opt.title}</div>
                  <ul className="mt-1.5 grid grid-cols-1 gap-0.5">
                    {opt.bullets.map((b) => (
                      <li key={b} className="text-navy-600 text-xs flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />{b}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {state.floorCareChoice === 'professional' && (
              <div className="space-y-4 pt-2">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Whole-property */}
                  <button type="button" onClick={enterWholePropertyCarpet}
                    className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                      state.carpetMode === 'whole' ? 'border-royal-500 bg-royal-50 shadow-md' : 'border-silver-200 hover:border-royal-300'
                    }`}>
                    <div className="flex items-center gap-1.5 text-royal-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                      <Sparkles size={12} /> Recommended for a quick quote
                    </div>
                    <div className="font-display font-bold text-navy-900 text-base">Whole-property carpet cleaning</div>
                    <p className="text-green-700 text-xs font-semibold leading-relaxed mt-1.5">
                      Clean all your carpeted areas during the same End of Tenancy visit and save up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}%.
                    </p>
                    <div className="mt-3 text-xs space-y-1 bg-white/60 rounded-lg px-3 py-2">
                      <div className="flex justify-between text-navy-600"><span>Normally</span><span>{penceToDisplay(wholePreview.standaloneSubtotalP)} separately</span></div>
                      <div className="flex justify-between text-navy-900 font-semibold"><span>Add to this visit for</span><span>{penceToDisplay(wholePreview.chargedP)}</span></div>
                      <div className="flex justify-between text-green-700 font-bold"><span>You save</span><span>{penceToDisplay(wholePreview.savingP)}</span></div>
                    </div>
                  </button>

                  {/* Manual */}
                  <button type="button" onClick={enterManualCarpet}
                    className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                      state.carpetMode === 'manual' ? 'border-royal-500 bg-royal-50 shadow-md' : 'border-silver-200 hover:border-royal-300'
                    }`}>
                    <div className="font-display font-bold text-navy-900 text-base">Choose areas individually</div>
                    <p className="text-silver-600 text-xs leading-relaxed mt-1.5">
                      Select only the carpeted areas that need professional cleaning.
                    </p>
                    <p className="text-royal-600 text-xs font-semibold mt-3">
                      {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}+ qualifying areas unlock up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off, calculated live as you add them.
                    </p>
                  </button>
                </div>

                {/* Whole-property suggested layout */}
                {state.carpetMode === 'whole' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-navy-700 leading-relaxed">
                      We have prepared a typical carpet layout for your property. Review it below and remove or add any areas before continuing. Nothing outside this list is charged.
                    </div>
                    <div className="space-y-2">
                      {state.rooms.map((room) => {
                        const standaloneP = eotCarpetAreaStandalonePriceP(room.addonKey, room.stairFlights ?? 1);
                        return (
                          <div key={room.id} className="rounded-xl border border-silver-200 px-4 py-3">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                              <span className="flex items-center gap-2">
                                <input type="checkbox" checked={room.steamClean} onChange={() => toggleSteamClean(room.id)}
                                  className="w-5 h-5 rounded border-2 border-silver-300 text-royal-600 focus:ring-royal-500" />
                                <span className="text-navy-800 text-sm font-semibold">{room.label}</span>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-royal-600 text-xs font-bold">{penceToDisplay(standaloneP)}</span>
                                {room.removable && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); removeRoom(room.id); }} className="text-silver-400 hover:text-red-500 text-xs font-medium">Remove</button>
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
                      <button type="button" onClick={() => addWholeRoom('reception')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Reception room</button>
                      <button type="button" onClick={() => addWholeRoom('hallway')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Hallway</button>
                      <button type="button" onClick={() => addWholeRoom('landing')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Landing</button>
                    </div>
                  </div>
                )}

                {/* Manual counters */}
                {state.carpetMode === 'manual' && (
                  <div className="space-y-2">
                    {MANUAL_CARPET_FIELDS.map((f) => (
                      <div key={f.key} className="flex items-center justify-between gap-2 rounded-xl border border-silver-200 px-4 py-3 min-h-[44px]">
                        <div>
                          <div className="text-navy-800 text-sm font-medium">{f.label}</div>
                          <div className="text-royal-600 text-[11px] font-bold">{penceToDisplay(f.priceP)} each</div>
                        </div>
                        <Counter value={state.manualCarpetCounts[f.key]} max={10} label={f.label} onChange={(v) => setManualCount(f.key, v)} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-silver-200 px-4 py-3 min-h-[44px]">
                      <div>
                        <div className="text-navy-800 text-sm font-medium">Staircase flights</div>
                        <div className="text-royal-600 text-[11px] font-bold">{penceToDisplay(STAIRS_FIRST_P)} first flight, +{penceToDisplay(STAIRS_EXTRA_P)} each extra</div>
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
                <p className="text-silver-600 text-xs mb-3">Every price is shown before you select it — nothing is added silently.</p>

                <p className="text-navy-700 text-xs font-bold uppercase tracking-widest mb-1.5 mt-3">Appliance interiors</p>
                <div className="space-y-2">
                  {[
                    { key: 'fridgeFreezerInside' as const, label: 'Inside standard fridge/freezer', price: EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside },
                    { key: 'dishwasherInside' as const, label: 'Inside dishwasher compartments', price: EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside },
                    { key: 'washingMachineInside' as const, label: 'Inside washing-machine compartments', price: EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 border border-silver-200 px-4 py-3 cursor-pointer min-h-[44px]">
                      <span className="text-navy-800 text-sm font-medium">{item.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-royal-600 text-xs font-bold">+{penceToDisplay(item.price)}</span>
                        <input type="checkbox" checked={state.tailoredAddOns[item.key]}
                          onChange={(e) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, [item.key]: e.target.checked } }))}
                          className="w-5 h-5 rounded border-2 border-silver-300 text-royal-600 focus:ring-royal-500" />
                      </span>
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 border border-silver-200 px-4 py-3 min-h-[44px]">
                    <span className="text-navy-800 text-sm font-medium">Additional separate fridge or freezer</span>
                    <span className="flex items-center gap-3">
                      <span className="text-royal-600 text-xs font-bold">+{penceToDisplay(EOT_TAILORED_ADDON_PRICES_P.extra_fridge_freezer)} each</span>
                      <Counter value={state.tailoredAddOns.extraFridgeFreezers} label="additional fridge/freezer"
                        onChange={(v) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, extraFridgeFreezers: v } }))} />
                    </span>
                  </div>
                </div>

                <p className="text-navy-700 text-xs font-bold uppercase tracking-widest mb-1.5 mt-4">Cupboards and storage</p>
                <label className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 border border-silver-200 px-4 py-3 cursor-pointer min-h-[44px]">
                  <span className="text-navy-800 text-sm font-medium">Cupboards, drawers &amp; wardrobes</span>
                  <span className="flex items-center gap-3">
                    <span className="text-royal-600 text-xs font-bold">+{penceToDisplay(EOT_TAILORED_CUPBOARDS_PRICES_P[state.size])}</span>
                    <input type="checkbox" checked={state.tailoredAddOns.cupboards}
                      onChange={(e) => setState((p) => ({ ...p, tailoredAddOns: { ...p.tailoredAddOns, cupboards: e.target.checked } }))}
                      className="w-5 h-5 rounded border-2 border-silver-300 text-royal-600 focus:ring-royal-500" />
                  </span>
                </label>

                {quote.shouldOfferComplete ? (
                  <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'complete' }))}
                    className="w-full text-left rounded-xl bg-amber-50 border-2 border-amber-300 px-4 py-3 mt-4">
                    <p className="text-amber-800 text-sm font-bold">Complete saves you money and covers the full internal checklist</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      Your Tailored selections now cost {penceToDisplay(quote.basePriceP + quote.houseAdjP + quote.bathroomsAddP + quote.wcsAddP + quote.tailoredAddOnsP)} —
                      the same as, or more than, Complete at {penceToDisplay(quote.completeEquivalentP)}. Tap to switch at no extra cost.
                    </p>
                  </button>
                ) : (
                  <p className="text-silver-500 text-xs mt-3">
                    Switching to Complete for {penceToDisplay(quote.completeEquivalentP - (quote.basePriceP + quote.houseAdjP + quote.bathroomsAddP + quote.wcsAddP + quote.tailoredAddOnsP))} more covers every internal task.
                  </p>
                )}
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
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 border border-silver-200 px-4 py-3 min-h-[44px]">
                    <div>
                      <div className="text-navy-800 text-sm font-medium">{item.label}</div>
                      <div className="text-royal-600 text-[11px] font-bold">+{penceToDisplay(item.price)}</div>
                    </div>
                    <Counter value={state.extras[item.key]} label={item.label} onChange={(v) => setState((p) => ({ ...p, extras: { ...p.extras, [item.key]: v } }))} />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
                  <div>
                    <div className="text-navy-800 text-sm font-medium">Upholstery cleaning</div>
                    <div className="text-purple-700 text-[11px] font-semibold">Priced separately — see the sofa &amp; upholstery calculator</div>
                  </div>
                  <a href="/sofa-cleaning-london" className="text-xs font-semibold text-purple-700 underline underline-offset-2 whitespace-nowrap">View prices</a>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
                  <div>
                    <div className="text-navy-800 text-sm font-medium">Mattress cleaning</div>
                    <div className="text-purple-700 text-[11px] font-semibold">Priced separately — see the carpet &amp; upholstery calculator</div>
                  </div>
                  <a href="/carpet-cleaning-london" className="text-xs font-semibold text-purple-700 underline underline-offset-2 whitespace-nowrap">View prices</a>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <div>
                    <div className="text-navy-800 text-sm font-medium">Rug cleaning</div>
                    <div className="text-amber-700 text-[11px] font-semibold">Photo assessment required — not automatically priced</div>
                  </div>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-amber-700 underline underline-offset-2 whitespace-nowrap">WhatsApp a photo</a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Condition</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['normal', 'Normal used condition'],
                  ['heavy', 'Heavy grease, scale or build-up'],
                  ['clutter', 'Excessive rubbish or clutter'],
                  ['biohazard', 'Mould, biohazard or specialist contamination'],
                ] as [ConditionState, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setState((p) => ({ ...p, condition: k }))}
                    className={`py-3 px-3 rounded-xl border-2 text-left text-xs font-semibold leading-snug transition-all duration-200 min-h-[44px] ${
                      state.condition === k
                        ? k === 'normal' ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-silver-200 text-navy-700 hover:border-royal-300'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {isQuoteReviewCondition && (
                <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 text-xs leading-relaxed font-medium">
                    Photo review required. We will confirm any adjustment before accepting the booking request — no automatic surcharge is applied.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
              <p className="text-navy-700 text-xs leading-relaxed">
                Parking costs are not included and may be added at the actual cost where required. Congestion Charge will only be added if applicable. These details are confirmed during booking.
              </p>
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base">Review your quote</h3>
              <div className="rounded-2xl border border-silver-200 divide-y divide-silver-100 overflow-hidden mt-3">
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-silver-600">Property</span>
                  <span className="text-navy-900 font-semibold">{state.propertyType === 'flat' ? 'Flat' : 'House / Maisonette'} · {sizeLabel}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-silver-600">Bathrooms / WCs</span>
                  <span className="text-navy-900 font-semibold">{state.fullBathrooms} bathroom{state.fullBathrooms !== 1 ? 's' : ''}{state.extraWcs > 0 ? ` · ${state.extraWcs} WC${state.extraWcs > 1 ? 's' : ''}` : ''}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-silver-600">Package</span>
                  <span className="text-navy-900 font-semibold">{state.pkg === 'complete' ? 'Complete Agency-Ready Clean' : 'Tailored Checklist Clean'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-silver-600">Floor care</span>
                  <span className="text-navy-900 font-semibold">
                    {state.floorCareChoice === 'professional' ? 'Professional carpet steam cleaning' : state.floorCareChoice === 'none' ? 'No carpeted areas' : 'Standard (included)'}
                  </span>
                </div>
                {state.pkg === 'tailored' && Object.entries(state.tailoredAddOns).some(([k, v]) => (k === 'extraFridgeFreezers' ? Number(v) > 0 : v)) && (
                  <div className="px-4 py-3 text-sm">
                    <span className="text-silver-600 block mb-1">Internal tasks added</span>
                    <ul className="text-navy-900 text-xs space-y-0.5">
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
                    <span className="text-silver-600 block mb-1">Confirmed carpet areas</span>
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
                {Object.entries(state.extras).some(([, v]) => v > 0) && (
                  <div className="px-4 py-3 text-sm">
                    <span className="text-silver-600 block mb-1">Other extras</span>
                    <ul className="text-navy-900 text-xs space-y-0.5">
                      {state.extras.ext_windows > 0 && <li>• {state.extras.ext_windows} × Exterior windows</li>}
                      {state.extras.balcony > 0 && <li>• {state.extras.balcony} × Balcony</li>}
                      {state.extras.wall_marks > 0 && <li>• {state.extras.wall_marks} × Wall-mark treatment</li>}
                      {state.extras.key_collect > 0 && <li>• {state.extras.key_collect} × Key collection/return</li>}
                      {state.extras.rubbish > 0 && <li>• {state.extras.rubbish} × Rubbish removal</li>}
                    </ul>
                  </div>
                )}
                <div className="px-4 py-3 text-sm">
                  <span className="text-silver-600 block mb-1">Condition</span>
                  <p className="text-navy-900 text-xs">
                    {state.condition === 'normal' ? 'Normal used condition' : 'Flagged for photo review — quote to be confirmed'}
                  </p>
                </div>
                <div className="px-4 py-3 text-xs text-silver-500 leading-relaxed">
                  Parking and Congestion Charge are not included above — confirmed and charged at actual cost during booking.
                </div>
              </div>

              {isQuoteReviewCondition ? (
                <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-5 text-center space-y-2 mt-4">
                  <p className="text-purple-800 font-bold text-sm">Photo review required</p>
                  <p className="text-purple-700 text-xs leading-relaxed">
                    The condition you selected needs a quick photo review before we can confirm a fixed price — no automatic surcharge is applied. Send us photos on WhatsApp and we'll confirm within the hour.
                  </p>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                    className="btn-whatsapp inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-full font-bold text-sm mt-2">
                    Send photos on WhatsApp
                  </a>
                </div>
              ) : (
                <div className="rounded-2xl px-5 py-5 mt-4" style={{ backgroundColor: '#dff0e8', border: '1.5px solid #b6d9c8' }}>
                  <div className="flex justify-between text-sm text-navy-700 mb-1">
                    <span>Total service price</span>
                    <span>£{totalPounds}</span>
                  </div>
                  <div className="flex justify-between font-display font-bold text-3xl text-[#1a5c3a] border-t border-[#b6d9c8] mt-2 pt-2">
                    <span className="text-base font-sans font-semibold self-center text-navy-800">Final total</span>
                    <span>£{totalPounds}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-navy-700"><span>Deposit today</span><span className="font-semibold">{penceToDisplay(depositP)}</span></div>
                    <div className="flex justify-between text-navy-700"><span>Remaining balance</span><span className="font-semibold">{penceToDisplay(balanceP)}</span></div>
                  </div>
                  <p className="text-[#1a5c3a] text-[11px] mt-2 leading-relaxed">
                    The remaining balance is due after the work is completed and you have had the opportunity to inspect it. Your appointment is a booking request until availability is confirmed.
                  </p>
                  <p className="text-[#1a5c3a] text-[11px] mt-1 leading-relaxed">
                    Guarantee: {state.pkg === 'complete' ? `Full ${EOT_GUARANTEE_HOURS}-hour agency-ready re-clean guarantee.` : `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee, covering only the tasks in this quote.`}
                  </p>
                </div>
              )}

              {bookError && (
                <div role="alert" className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm mt-3">{bookError}</div>
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

      {/* ── Sticky-ish footer nav ── */}
      <div className="border-t border-silver-200 px-5 sm:px-8 py-4 flex items-center justify-between bg-white">
        <button type="button" onClick={goBack} disabled={step === 1}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 rounded-lg">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-silver-500 font-bold">
            {step === 1 ? 'Starting from' : isQuoteReviewCondition && step === 4 ? '' : 'Current total'}
          </div>
          <div data-testid="footer-total" className="text-navy-900 font-display font-bold text-lg">
            {step === 1 && state.is5Plus
              ? 'Quote required'
              : isQuoteReviewCondition && step === 4
                ? 'Quote review'
                : step === 1 ? `£${Math.round(cheapestStartingP / 100)}` : `£${totalPounds}`}
          </div>
          {step >= 2 && !(isQuoteReviewCondition && step === 4) && (
            <div className="text-[10px] text-silver-500">
              {state.pkg === 'complete' ? 'Complete Agency-Ready Clean' : 'Tailored Checklist Clean'} · based on your current selections
            </div>
          )}
        </div>
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={goNext} disabled={step === 1 && state.is5Plus}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-royal-500 hover:bg-royal-600 rounded-full px-5 py-2.5 min-h-[44px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] disabled:opacity-40 disabled:cursor-not-allowed">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <span className="w-16" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
