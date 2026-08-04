import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Info, Minus, Plus, ShieldCheck, XCircle } from 'lucide-react';
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
  ADDON_PRICES_P,
  calculateEotQuote,
  calculateDepositAndBalance,
  generateDefaultRooms,
  eotCarpetAreaStandalonePriceP,
  penceToDisplay,
  type SizeKey,
} from '../data/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PropertyType = 'flat' | 'house' | 'maisonette';
export type EotPackage = 'complete' | 'tailored';
export type FloorState = 'unset' | 'carpet' | 'hard' | 'na';
export type ConditionState = 'normal' | 'heavy' | 'clutter' | 'biohazard';

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
  upholstery: number;
  ext_windows: number;
  balcony: number;
  wall_marks: number;
  key_collect: number;
  rubbish: number;
}

export interface EotWizardState {
  propertyType: PropertyType;
  size: SizeKey;
  fullBathrooms: number;   // total, minimum 1
  extraWcs: number;
  pkg: EotPackage;
  tailoredAddOns: TailoredAddOns;
  rooms: RoomState[];
  extras: ExtrasState;
  condition: ConditionState;
  parking: 'yes' | 'no' | 'unsure';
  congestionZone: boolean;
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
    parking: 'yes' | 'no' | 'unsure';
    congestionZone: boolean;
  };
}

interface Props {
  onBook: (result: EotBookingResult) => void;
  onChangeService?: () => void;
  restoreConfig?: EotBookingResult['quoteConfig'] | null;
}

const SIZE_OPTIONS: { key: SizeKey | 'bed5plus'; label: string }[] = [
  { key: 'studio', label: 'Studio' },
  { key: 'bed1', label: '1 bed' },
  { key: 'bed2', label: '2 beds' },
  { key: 'bed3', label: '3 beds' },
  { key: 'bed4', label: '4 beds' },
  { key: 'bed5plus', label: '5+ beds' },
];

const STEP_LABELS = ['Property', 'Bathrooms', 'Package', 'Add internal tasks', 'Floor care', 'Extras & condition', 'Review'];

function defaultTailoredAddOns(): TailoredAddOns {
  return { fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false };
}
function defaultExtras(): ExtrasState {
  return { upholstery: 0, ext_windows: 0, balcony: 0, wall_marks: 0, key_collect: 0, rubbish: 0 };
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

function makeInitialState(restore?: EotBookingResult['quoteConfig'] | null): EotWizardState {
  const size: SizeKey = (restore?.deepSize as SizeKey) ?? 'bed2';
  const propertyType: PropertyType = restore?.isHouse ? 'house' : 'flat';
  const rooms = defaultRooms(size, propertyType);
  if (restore?.rooms && restore.carpetRoomIds) {
    for (const r of rooms) {
      const match = restore.rooms.find((rr) => rr.id === r.id);
      if (match) {
        r.floor = match.floor as FloorState;
        if (r.addonKey === 'stairs') r.stairFlights = Number(match.stairFlights) || 1;
      }
      r.steamClean = restore.carpetRoomIds.includes(r.id);
    }
  }
  return {
    propertyType,
    size,
    fullBathrooms: restore?.deepBaths ?? 1,
    extraWcs: restore?.deepWcs ?? 0,
    pkg: restore?.eotPackage ?? 'complete',
    tailoredAddOns: restore?.tailoredAddOns ? { ...defaultTailoredAddOns(), ...restore.tailoredAddOns } : defaultTailoredAddOns(),
    rooms,
    extras: restore?.addOnCounts
      ? { ...defaultExtras(), ...(restore.addOnCounts as Partial<ExtrasState>) }
      : defaultExtras(),
    condition: restore?.condition ?? 'normal',
    parking: restore?.parking ?? 'unsure',
    congestionZone: restore?.congestionZone ?? false,
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

const COMPLETE_INCLUDED = [
  'Kitchen surfaces and fittings',
  'Oven, hob, grill and extractor',
  'Inside an emptied fridge and defrosted freezer',
  'Accessible dishwasher compartments',
  'Accessible washing-machine compartments',
  'Inside cupboards, drawers and wardrobes',
  'Bathrooms cleaned and descaled',
  'Bedrooms and reception rooms',
  'Internal windows',
  'Skirting boards, doors and frames',
  'Switches and accessible fittings',
  'Vacuuming of accessible carpeted floors',
  'Mopping of accessible hard floors',
  'Photographic cleaning receipt',
];
const COMPLETE_EXCLUDED = [
  'Carpet steam cleaning', 'Upholstery cleaning', 'Exterior windows', 'Balcony cleaning',
  'Full wall washing', 'Rubbish removal', 'Parking', 'Congestion Charge', 'Specialist mould or biohazard work',
];
const TAILORED_INCLUDED = [
  'Kitchen and bathroom surfaces', 'Oven, hob, grill and extractor', 'Bedrooms and reception rooms',
  'Internal windows', 'Skirting boards', 'Doors, frames and switches', 'Standard vacuuming', 'Standard hard-floor mopping', 'Photographic receipt',
];
const TAILORED_EXCLUDED_BY_DEFAULT = [
  'Inside fridge/freezer', 'Inside dishwasher', 'Inside washing machine', 'Cupboards, drawers and wardrobes',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EotQuoteWizard({ onBook, onChangeService, restoreConfig }: Props) {
  const [state, setState] = useState<EotWizardState>(() => makeInitialState(restoreConfig));
  const [step, setStep] = useState(1);
  const [bookError, setBookError] = useState('');

  const quote = useMemo(() => calculateEotQuote({
    size: state.size,
    package: state.pkg,
    isHouse: state.propertyType !== 'flat',
    extraBathrooms: Math.max(0, state.fullBathrooms - 1),
    extraWcs: state.extraWcs,
    tailoredAddOns: state.tailoredAddOns,
    rooms: state.rooms,
    carpetRoomIds: state.rooms.filter((r) => r.steamClean).map((r) => r.id),
  }), [state]);

  const extrasTotalP = useMemo(() => {
    let total = 0;
    total += state.extras.upholstery * 0; // upholstery is priced separately (photo/quote via carpet page) — placeholder line, not charged here
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

  const carpetRoomsSelected = state.rooms.filter((r) => r.steamClean);
  const carpetPackage = quote.carpetPackage;

  function setRoomFloor(id: string, floor: FloorState) {
    setState((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === id ? { ...r, floor, steamClean: floor === 'carpet' ? r.steamClean : false } : r)),
    }));
  }
  function toggleSteamClean(id: string) {
    setState((p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, steamClean: !r.steamClean } : r)) }));
  }
  function setStairFlights(id: string, flights: number) {
    setState((p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, stairFlights: Math.max(1, flights) } : r)) }));
  }
  function addRoom(kind: 'reception' | 'hallway' | 'landing') {
    const labels = { reception: 'Additional reception room', hallway: 'Hallway', landing: 'Landing' };
    const addonKeys = { reception: 'living_room', hallway: 'hallway', landing: 'landing' };
    setState((p) => ({
      ...p,
      rooms: [...p.rooms, { id: `${kind}-${Date.now()}`, label: labels[kind], addonKey: addonKeys[kind], floor: 'unset', steamClean: false, removable: true }],
    }));
  }
  function removeRoom(id: string) {
    setState((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== id) }));
  }
  function changeSize(size: SizeKey) {
    setState((p) => ({ ...p, size, rooms: defaultRooms(size, p.propertyType) }));
  }
  function changePropertyType(propertyType: PropertyType) {
    setState((p) => ({ ...p, propertyType, rooms: defaultRooms(p.size, propertyType) }));
  }

  const totalSteps = state.pkg === 'tailored' ? 7 : 6; // Complete skips step 4 (tailored add-ons)
  const displayStep = state.pkg === 'complete' && step > 3 ? step - 1 : step;

  function goNext() {
    setBookError('');
    if (step === 3 && state.pkg === 'complete') { setStep(5); return; } // skip tailored add-ons step
    setStep((s) => Math.min(7, s + 1));
  }
  function goBack() {
    setBookError('');
    if (step === 5 && state.pkg === 'complete') { setStep(3); return; }
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
        rooms: state.rooms.map((r) => ({ id: r.id, addonKey: r.addonKey, floor: r.floor, stairFlights: r.stairFlights })),
        carpetRoomIds: carpetRoomsSelected.map((r) => r.id),
        windowSize: 'small',
        gutterType: 'terraced',
        officeHours: 2,
        condition: state.condition,
        parking: state.parking,
        congestionZone: state.congestionZone,
      },
    };
    onBook(sel);
  }

  const WA_LINK = `https://wa.me/447845451111?text=${encodeURIComponent(
    "Hi VVE Clean, I'd like a photo review for an end of tenancy clean (heavy condition / rubbish / mould / biohazard).",
  )}`;

  const sizeLabel = SIZE_OPTIONS.find((s) => s.key === state.size)?.label ?? '';

  return (
    <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
      {/* Header / progress */}
      <div className="navy-gradient px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-silver-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            Step {displayStep} of {totalSteps} — {STEP_LABELS[step - 1]}
          </p>
          <h2 className="text-white font-display font-bold text-lg sm:text-xl">End of Tenancy Quote</h2>
        </div>
        <StepDots step={displayStep} total={totalSteps} />
      </div>

      {onChangeService && (
        <div className="px-5 sm:px-8 pt-4">
          <button type="button" onClick={onChangeService} className="text-xs font-semibold text-royal-600 hover:text-royal-700 underline underline-offset-2">
            Not an end of tenancy clean? Choose a different service
          </button>
        </div>
      )}

      <div className="px-5 sm:px-8 py-6">
        {/* ── Step 1: Property ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">What type of property is it?</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['flat', 'house', 'maisonette'] as PropertyType[]).map((t) => (
                  <button key={t} type="button" onClick={() => changePropertyType(t)}
                    className={`py-3.5 rounded-xl border-2 text-sm font-bold capitalize transition-all duration-200 min-h-[44px] ${
                      state.propertyType === t ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              {state.propertyType !== 'flat' && (
                <p className="text-royal-600 text-xs font-semibold mt-2">+{penceToDisplay(EOT_HOUSE_ADJUSTMENT_P)} house/maisonette adjustment</p>
              )}
            </div>

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Property size</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SIZE_OPTIONS.map((s) => {
                  const priced = s.key !== 'bed5plus';
                  const price = priced ? EOT_COMPLETE_PRICES_P[s.key as SizeKey] : null;
                  return (
                    <button key={s.key} type="button"
                      disabled={!priced}
                      onClick={() => priced && changeSize(s.key as SizeKey)}
                      className={`py-3 rounded-xl border-2 text-center transition-all duration-200 min-h-[44px] ${
                        priced && state.size === s.key ? 'border-royal-500 bg-royal-50 text-royal-700'
                        : !priced ? 'border-dashed border-silver-300 text-silver-500 cursor-not-allowed'
                        : 'border-silver-200 text-navy-700 hover:border-royal-300'
                      }`}>
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[10px] mt-0.5">{priced ? `from £${(price! / 100).toFixed(0)}` : 'Tailored quote'}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-silver-500 text-xs mt-2">5+ bedroom properties are always priced individually — WhatsApp us for a tailored quote.</p>
            </div>

            <div className="rounded-xl bg-royal-50 border border-royal-200 px-4 py-3 flex items-center justify-between">
              <span className="text-royal-700 text-sm font-semibold">Starting price for {sizeLabel}, {state.propertyType}</span>
              <span className="text-royal-700 font-display font-bold text-xl">
                {penceToDisplay(EOT_COMPLETE_PRICES_P[state.size] + (state.propertyType !== 'flat' ? EOT_HOUSE_ADJUSTMENT_P : 0))}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 2: Bathrooms ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-1">Full bathrooms</h3>
              <p className="text-silver-600 text-xs mb-3">The first bathroom is included in the base price.</p>
              <Counter value={state.fullBathrooms} min={1} max={6} label="full bathrooms" onChange={(v) => setState((p) => ({ ...p, fullBathrooms: v }))} />
              {state.fullBathrooms > 1 && (
                <p className="text-royal-600 text-xs font-semibold mt-2">
                  +{penceToDisplay(EOT_EXTRA_BATH_P * (state.fullBathrooms - 1))} for {state.fullBathrooms - 1} extra bathroom{state.fullBathrooms > 2 ? 's' : ''}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-1">Separate WCs</h3>
              <p className="text-silver-600 text-xs mb-3">A standalone toilet that isn't part of a full bathroom.</p>
              <Counter value={state.extraWcs} min={0} max={6} label="separate WCs" onChange={(v) => setState((p) => ({ ...p, extraWcs: v }))} />
              {state.extraWcs > 0 && (
                <p className="text-royal-600 text-xs font-semibold mt-2">+{penceToDisplay(EOT_EXTRA_WC_P * state.extraWcs)} for {state.extraWcs} separate WC{state.extraWcs > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="rounded-xl bg-royal-50 border border-royal-200 px-4 py-3 flex items-center justify-between">
              <span className="text-royal-700 text-sm font-semibold">Price with bathrooms &amp; WCs</span>
              <span className="text-royal-700 font-display font-bold text-xl">
                {penceToDisplay(EOT_COMPLETE_PRICES_P[state.size] + (state.propertyType !== 'flat' ? EOT_HOUSE_ADJUSTMENT_P : 0) + EOT_EXTRA_BATH_P * (state.fullBathrooms - 1) + EOT_EXTRA_WC_P * state.extraWcs)}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 3: Package ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-navy-900 font-bold text-base">How would you like your clean prepared?</h3>
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
                <p className="text-silver-600 text-xs leading-relaxed mt-2">
                  The entire property prepared for an inventory check without building the clean item by item. The safest option for a final inspection.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                  <ShieldCheck size={14} /> Full {EOT_GUARANTEE_HOURS}-hour agency-ready guarantee
                </div>
                {state.pkg === 'tailored' && (
                  <p className="text-amber-700 text-[11px] font-semibold mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    Building this manually via Tailored would cost {penceToDisplay(quote.completeEquivalentP + 8000)}+ — Complete already includes it.
                  </p>
                )}
                <details className="mt-3 group">
                  <summary className="text-royal-600 text-xs font-semibold cursor-pointer list-none flex items-center gap-1">
                    What's included / excluded <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    {COMPLETE_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy-700"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                    <div className="h-px bg-silver-200 my-1" />
                    {COMPLETE_EXCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-silver-500"><XCircle size={12} className="text-silver-400 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                  </div>
                </details>
              </button>

              {/* Tailored */}
              <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'tailored' }))}
                className={`text-left rounded-2xl border-2 p-5 transition-all duration-200 flex flex-col ${
                  state.pkg === 'tailored' ? 'border-royal-500 bg-royal-50 shadow-lg' : 'border-silver-200 hover:border-royal-300'
                }`}>
                <div className="font-display font-bold text-navy-900 text-lg">Tailored Checklist Clean</div>
                <div data-testid="tailored-price" className="font-display font-bold text-3xl text-royal-600 mt-1">
                  from {penceToDisplay(EOT_TAILORED_START_PRICES_P[state.size])}
                </div>
                <p className="text-silver-600 text-xs leading-relaxed mt-2">
                  Choose only the internal tasks you need. Best for properties where some areas or appliances are already professionally clean.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                  <Info size={14} /> Guarantee applies only to the tasks in your quote
                </div>
                <details className="mt-3 group">
                  <summary className="text-royal-600 text-xs font-semibold cursor-pointer list-none flex items-center gap-1">
                    What's included / excluded <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    {TAILORED_INCLUDED.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-navy-700"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />{i}</div>
                    ))}
                    <div className="h-px bg-silver-200 my-1" />
                    {TAILORED_EXCLUDED_BY_DEFAULT.map((i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-silver-500"><XCircle size={12} className="text-silver-400 mt-0.5 flex-shrink-0" />{i} — add in the next step</div>
                    ))}
                  </div>
                </details>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Tailored internal additions (skipped for Complete) ── */}
        {step === 4 && state.pkg === 'tailored' && (
          <div className="space-y-3">
            <h3 className="text-navy-900 font-bold text-base">Add back the internal tasks you need</h3>
            <p className="text-silver-600 text-xs mb-2">Every price is shown before you select it — nothing is added silently.</p>
            {[
              { key: 'fridgeFreezerInside' as const, label: 'Inside standard fridge/freezer', price: EOT_TAILORED_ADDON_PRICES_P.fridge_freezer_inside },
              { key: 'dishwasherInside' as const, label: 'Inside dishwasher compartments', price: EOT_TAILORED_ADDON_PRICES_P.dishwasher_inside },
              { key: 'washingMachineInside' as const, label: 'Inside washing-machine compartments', price: EOT_TAILORED_ADDON_PRICES_P.washing_machine_inside },
              { key: 'cupboards' as const, label: 'Cupboards, drawers & wardrobes', price: EOT_TAILORED_CUPBOARDS_PRICES_P[state.size] },
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

            {quote.shouldOfferComplete ? (
              <button type="button" onClick={() => setState((p) => ({ ...p, pkg: 'complete' }))}
                className="w-full text-left rounded-xl bg-amber-50 border-2 border-amber-300 px-4 py-3 mt-2">
                <p className="text-amber-800 text-sm font-bold">Complete saves you money and covers the full internal checklist</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Your Tailored selections now cost {penceToDisplay(quote.basePriceP + quote.houseAdjP + quote.bathroomsAddP + quote.wcsAddP + quote.tailoredAddOnsP)} —
                  the same as, or more than, Complete at {penceToDisplay(quote.completeEquivalentP)}. Tap to switch at no extra cost.
                </p>
              </button>
            ) : (
              <p className="text-silver-500 text-xs">
                Switching to Complete for {penceToDisplay(quote.completeEquivalentP - (quote.basePriceP + quote.houseAdjP + quote.bathroomsAddP + quote.wcsAddP + quote.tailoredAddOnsP))} more covers every internal task.
              </p>
            )}
          </div>
        )}

        {/* ── Step 5: Floor care ── */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-navy-900 font-bold text-base">Floor care</h3>
            <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-navy-700 leading-relaxed">
              Standard vacuuming of carpet and standard mopping of hard floors is <strong>already included</strong> in every EOT clean, at no
              extra charge. Professional carpet steam cleaning is optional. These are only suggested areas based on your property
              size — confirm what's actually carpeted below; nothing here is charged until you add it.
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs font-semibold text-green-800 leading-relaxed">
              Save up to {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% on professional carpet cleaning when added to your End of Tenancy clean
              — once {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}+ areas are selected.
            </div>

            <div className="space-y-2">
              {state.rooms.map((room) => {
                const standaloneP = eotCarpetAreaStandalonePriceP(room.addonKey, room.stairFlights ?? 1);
                return (
                  <div key={room.id} className="rounded-xl border border-silver-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-navy-800 text-sm font-semibold">{room.label}</span>
                      {room.removable && (
                        <button type="button" onClick={() => removeRoom(room.id)} className="text-silver-400 hover:text-red-500 text-xs font-medium">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['carpet', 'hard', 'na'] as FloorState[]).map((f) => (
                        <button key={f} type="button" onClick={() => setRoomFloor(room.id, f)}
                          className={`py-2 rounded-lg border text-[11px] font-semibold capitalize transition-all duration-200 min-h-[38px] ${
                            room.floor === f ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-600 hover:border-royal-300'
                          }`}>
                          {f === 'na' ? 'N/A' : f === 'hard' ? 'Hard floor' : 'Carpet'}
                        </button>
                      ))}
                    </div>
                    {room.floor === 'carpet' && (
                      <>
                        <label className="flex items-center justify-between gap-2 mt-2 bg-silver-50 rounded-lg px-3 py-2 cursor-pointer">
                          <span className="text-navy-700 text-xs">
                            Add professional carpet steam cleaning — standard value <strong>{penceToDisplay(standaloneP)}</strong>
                          </span>
                          <input type="checkbox" checked={room.steamClean} onChange={() => toggleSteamClean(room.id)}
                            className="w-5 h-5 rounded border-2 border-silver-300 text-royal-600 focus:ring-royal-500" />
                        </label>
                        {room.addonKey === 'stairs' && room.steamClean && (
                          <div className="flex items-center justify-between gap-2 mt-2 px-1">
                            <span className="text-navy-700 text-xs">Flights of stairs (first flight included)</span>
                            <Counter value={room.stairFlights ?? 1} min={1} max={6} label="flights of stairs"
                              onChange={(v) => setStairFlights(room.id, v)} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addRoom('reception')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Reception room</button>
              <button type="button" onClick={() => addRoom('hallway')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Hallway</button>
              <button type="button" onClick={() => addRoom('landing')} className="text-xs font-semibold text-royal-600 hover:text-royal-700 border border-royal-200 rounded-full px-3 py-1.5">+ Landing</button>
            </div>

            {carpetPackage.itemCount > 0 && (
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
                      Add {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount} more qualifying area{EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS - carpetPackage.itemCount !== 1 ? 's' : ''} to unlock {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Extras & condition ── */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Optional extras</h3>
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

            <div>
              <h3 className="text-navy-900 font-bold text-base mb-3">Access</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-navy-700 text-xs font-semibold mb-1.5">Is parking available outside the property?</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['yes', 'no', 'unsure'] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setState((p) => ({ ...p, parking: v }))}
                        className={`py-2 rounded-lg border text-xs font-semibold capitalize min-h-[38px] ${state.parking === v ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-2 bg-silver-50 rounded-lg px-3 py-2.5 cursor-pointer">
                  <span className="text-navy-700 text-xs">Property is inside the Congestion Charge zone</span>
                  <input type="checkbox" checked={state.congestionZone} onChange={(e) => setState((p) => ({ ...p, congestionZone: e.target.checked }))}
                    className="w-5 h-5 rounded border-2 border-silver-300 text-royal-600 focus:ring-royal-500" />
                </label>
                <p className="text-silver-500 text-[11px] leading-relaxed">
                  Parking and the Congestion Charge, where applicable, are passed through at actual cost — never an invented flat fee — and confirmed with you before the booking is accepted.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 7: Review ── */}
        {step === 7 && (
          <div className="space-y-4">
            <h3 className="text-navy-900 font-bold text-base">Review your quote</h3>

            <div className="rounded-2xl border border-silver-200 divide-y divide-silver-100 overflow-hidden">
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-silver-600">Property</span>
                <span className="text-navy-900 font-semibold capitalize">{state.propertyType} · {sizeLabel}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-silver-600">Bathrooms / WCs</span>
                <span className="text-navy-900 font-semibold">{state.fullBathrooms} bathroom{state.fullBathrooms !== 1 ? 's' : ''}{state.extraWcs > 0 ? ` · ${state.extraWcs} WC${state.extraWcs > 1 ? 's' : ''}` : ''}</span>
              </div>
              <div className="px-4 py-3 flex justify-between text-sm">
                <span className="text-silver-600">Package</span>
                <span className="text-navy-900 font-semibold">{state.pkg === 'complete' ? 'Complete Agency-Ready Clean' : 'Tailored Checklist Clean'}</span>
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
              {carpetRoomsSelected.length > 0 && (
                <div className="px-4 py-3 text-sm">
                  <span className="text-silver-600 block mb-1">Professional carpet steam cleaning</span>
                  <ul className="text-navy-900 text-xs space-y-0.5 mb-2">
                    {carpetRoomsSelected.map((r) => (
                      <li key={r.id}>
                        • {r.label}{r.addonKey === 'stairs' && (r.stairFlights ?? 1) > 1 ? ` (${r.stairFlights} flights)` : ''}
                        {' — '}{penceToDisplay(eotCarpetAreaStandalonePriceP(r.addonKey, r.stairFlights ?? 1))} standard value
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs space-y-0.5 border-t border-silver-100 pt-1.5">
                    <div className="flex justify-between text-navy-700">
                      <span>Standard carpet-cleaning value</span>
                      <span>{penceToDisplay(carpetPackage.standaloneSubtotalP)}</span>
                    </div>
                    {carpetPackage.eligible ? (
                      <>
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span>EOT carpet-package saving</span>
                          <span>−{penceToDisplay(carpetPackage.savingP)}</span>
                        </div>
                        <div className="flex justify-between text-navy-900 font-semibold">
                          <span>Professional carpet cleaning today</span>
                          <span>{penceToDisplay(carpetPackage.chargedP)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-navy-900 font-semibold">
                        <span>Professional carpet cleaning today (below the {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}-area offer)</span>
                        <span>{penceToDisplay(carpetPackage.chargedP)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {Object.entries(state.extras).some(([k, v]) => k !== 'upholstery' && v > 0) && (
                <div className="px-4 py-3 text-sm">
                  <span className="text-silver-600 block mb-1">Extras</span>
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
                <span className="text-silver-600 block mb-1">Condition &amp; access</span>
                <p className="text-navy-900 text-xs">
                  {state.condition === 'normal' ? 'Normal used condition' : 'Flagged for photo review — quote to be confirmed'}
                  {' · '}Parking: {state.parking} {state.congestionZone ? '· Congestion Charge zone' : ''}
                </p>
              </div>
            </div>

            {isQuoteReviewCondition ? (
              <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-5 text-center space-y-2">
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
              <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: '#dff0e8', border: '1.5px solid #b6d9c8' }}>
                <div className="flex justify-between text-sm text-navy-700 mb-1">
                  <span>Subtotal</span>
                  <span>£{totalPounds}</span>
                </div>
                <div className="flex justify-between font-display font-bold text-3xl text-[#1a5c3a] border-t border-[#b6d9c8] mt-2 pt-2">
                  <span className="text-base font-sans font-semibold self-center text-navy-800">Final total</span>
                  <span>£{totalPounds}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-navy-700"><span>£30 deposit today</span><span className="font-semibold">{penceToDisplay(depositP)}</span></div>
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
              <div role="alert" className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">{bookError}</div>
            )}

            {!isQuoteReviewCondition && (
              <button type="button" onClick={handleBook}
                className="flex items-center justify-center gap-2 w-full py-4 min-h-[44px] rounded-full font-bold text-white text-base bg-royal-500 hover:bg-royal-600 transition-all duration-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]">
                Book online — pay £30 deposit
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky-ish footer nav ── */}
      <div className="border-t border-silver-200 px-5 sm:px-8 py-4 flex items-center justify-between bg-white">
        <button type="button" onClick={goBack} disabled={step === 1}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 rounded-lg">
          <ChevronLeft size={16} /> Back
        </button>
        <div data-testid="footer-total" className="text-navy-900 font-display font-bold text-lg">
          {isQuoteReviewCondition && step === 7 ? 'Quote review' : `£${totalPounds}`}
        </div>
        {step < 7 ? (
          <button type="button" onClick={goNext}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-royal-500 hover:bg-royal-600 rounded-full px-5 py-2.5 min-h-[44px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <span className="w-16" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
