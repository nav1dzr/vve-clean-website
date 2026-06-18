import { useState } from 'react';
import { Calculator, CheckCircle2, Plus, Minus, Info } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

// ─── Pricing engine ──────────────────────────────────────────────────────────

const MIN_CHARGE = 90;
const WA_BASE = 'https://wa.me/447845451111';

// ── Base prices per size × service type ──────────────────────────────────────
type DeepServiceType = 'end_of_tenancy' | 'move_in' | 'after_builders' | 'carpet_upholstery';
type SizeKey = 'studio' | 'bed1' | 'bed2' | 'bed3' | 'bed4';

const BASE_PRICES: Record<DeepServiceType, Record<SizeKey, number>> = {
  end_of_tenancy:    { studio: 159, bed1: 199, bed2: 249, bed3: 329, bed4: 419 },
  move_in:           { studio: 139, bed1: 169, bed2: 219, bed3: 269, bed4: 329 },
  after_builders:    { studio: 199, bed1: 239, bed2: 299, bed3: 369, bed4: 449 },
  carpet_upholstery: { studio:  90, bed1: 150, bed2: 210, bed3: 270, bed4: 330 },
};

const DEEP_SERVICE_LABELS: Record<DeepServiceType, string> = {
  end_of_tenancy:    'End of tenancy',
  move_in:           'Move-in deep clean',
  after_builders:    'After builders',
  carpet_upholstery: 'Carpet & upholstery',
};

// Extra bathrooms surcharge (per additional bathroom beyond the first)
const BATH_SURCHARGE: Record<DeepServiceType, number> = {
  end_of_tenancy: 20, move_in: 18, after_builders: 25, carpet_upholstery: 0,
};

// Carpet bundle add-on price (scales by size)
const CARPET_BUNDLE_PRICE: Record<SizeKey, number> = {
  studio: 50, bed1: 50, bed2: 75, bed3: 100, bed4: 125,
};

// Carpet standalone price (for savings calculation)
const CARPET_STANDALONE_PRICE: Record<SizeKey, number> = {
  studio: 90, bed1: 150, bed2: 210, bed3: 270, bed4: 330,
};

// Staircase non-linear pricing: index = number of flights (capped at 3)
const STAIR_PRICES = [0, 45, 80, 115];

const windowPrices: Record<string, number> = {
  small:  35,
  medium: 45,
  large:  55,
};

const gutterPrices: Record<string, number> = {
  terraced:      75,
  semi_detached: 110,
  detached:      160,
};

const HOURLY_RATE = 22.50;
const MIN_OFFICE_HOURS = 4;

// Extras — rendered dynamically in the deep/carpet flow
// Price is computed at render time for carpet_bundle
const addOnDefs = [
  { key: 'oven',          label: 'Inside oven',           price: 35 },
  { key: 'fridge',        label: 'Fridge / freezer',      price: 20 },
  { key: 'carpet_bundle', label: 'Carpets — whole home',  price: 0 }, // dynamic
  { key: 'ext_windows',   label: 'Exterior windows',      price: 35 },
  { key: 'wall_marks',    label: 'Wall marks & scuffs',   price: 25 },
  { key: 'key_collect',   label: 'Key collection/return', price: 10 },
  { key: 'rubbish',       label: 'Rubbish removal',       price: 40 }, // after builders only
  // Carpet & upholstery specific
  { key: 'sofa',          label: 'Sofa (2–3 seats)',      price: 40 },
  { key: 'mattress',      label: 'Mattress',              price: 25 },
  { key: 'staircase',     label: 'Flights of stairs',     price: 45 },
];

type ServiceKey = 'deep' | 'window' | 'gutter' | 'office';

// ─── Helper ───────────────────────────────────────────────────────────────────

function Counter({ value, min = 0, max, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-6 h-6 rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 transition-colors disabled:opacity-30">
        <Minus size={10} />
      </button>
      <span className="w-5 text-center text-navy-900 font-bold text-xs">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={max !== undefined && value >= max}
        className="w-6 h-6 rounded-full border border-silver-300 flex items-center justify-center text-silver-500 hover:border-royal-400 hover:text-royal-600 transition-colors disabled:opacity-30">
        <Plus size={10} />
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteCalculator() {
  const { ref, visible } = useReveal();

  // service tab
  const [service, setService] = useState<ServiceKey>('deep');

  // deep clean state
  const [deepService, setDeepService] = useState<DeepServiceType>('end_of_tenancy');
  const [deepSize, setDeepSize]       = useState<SizeKey>('bed2');
  const [deepBaths, setDeepBaths]     = useState<1 | 2 | 3>(1); // 1=incl, 2=+1 extra, 3=+2 extra
  const [addOnCounts, setAddOnCounts] = useState<Record<string, number>>(
    Object.fromEntries(addOnDefs.map((a) => [a.key, 0]))
  );

  // window state
  const [windowSize, setWindowSize] = useState('small');

  // gutter state
  const [gutterType, setGutterType] = useState('terraced');

  // office state
  const [officeHours, setOfficeHours] = useState(MIN_OFFICE_HOURS);

  // ── Price calculation ──
  const isCarpet        = deepService === 'carpet_upholstery';
  const isAfterBuilders = service === 'deep' && deepService === 'after_builders';

  // Resolve add-on price dynamically (carpet bundle scales by size)
  const getAddOnPrice = (key: string): number => {
    if (key === 'carpet_bundle') return CARPET_BUNDLE_PRICE[deepSize];
    if (key === 'oven' && deepService === 'end_of_tenancy') return 0; // FREE
    return addOnDefs.find(a => a.key === key)?.price ?? 0;
  };

  const calcPrice = () => {
    if (service === 'deep') {
      const base      = BASE_PRICES[deepService][deepSize];
      const bathExtra = isCarpet ? 0 : (deepBaths - 1) * BATH_SURCHARGE[deepService];
      const addOns    = addOnDefs.reduce((s, a) => {
        if (a.key === 'staircase') return s + STAIR_PRICES[Math.min(addOnCounts.staircase, 3)];
        return s + addOnCounts[a.key] * getAddOnPrice(a.key);
      }, 0);
      return base + bathExtra + addOns;
    }
    if (service === 'window') return Math.max(windowPrices[windowSize] ?? 35, MIN_CHARGE);
    if (service === 'gutter') return Math.max(gutterPrices[gutterType] ?? 75, MIN_CHARGE);
    if (service === 'office') return Math.max(officeHours * HOURLY_RATE, MIN_CHARGE);
    return 0;
  };

  const price = calcPrice();
  const rawPrice = (() => {
    if (service === 'window') return windowPrices[windowSize] ?? 35;
    if (service === 'gutter') return gutterPrices[gutterType] ?? 75;
    if (service === 'office') return officeHours * HOURLY_RATE;
    return price;
  })();
  const minApplied = (service !== 'deep') && rawPrice < MIN_CHARGE;

  const serviceLabels: Record<ServiceKey, string> = {
    deep:   DEEP_SERVICE_LABELS[deepService],
    window: 'Window Cleaning',
    gutter: 'Gutter Clearing',
    office: 'Office / Commercial',
  };

  const waLink = (() => {
    if (isAfterBuilders) {
      const msg = `Hello VVE Clean, I'd like a quote for an after builders clean. I'll send photos of the space to confirm the scope.\nMy postcode is: `;
      return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
    }
    const sizeLabel = deepSize === 'studio' ? 'Studio' : deepSize.replace('bed', '') + ' Bed';
    const bathLabel = isCarpet ? 'n/a' : `${deepBaths === 3 ? '3+' : deepBaths}`;

    let extrasLine: string;
    if (service === 'deep') {
      if (deepService === 'end_of_tenancy') {
        const extras = addOnDefs
          .filter((a) => a.key !== 'oven' && addOnCounts[a.key] > 0 && !['sofa','mattress','staircase'].includes(a.key))
          .map((a) => `${a.label}${addOnCounts[a.key] > 1 ? ` ×${addOnCounts[a.key]}` : ''}`)
          .join(', ');
        extrasLine = `Oven clean included free${extras ? `, ${extras}` : ''}`;
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
      `• Property Size: ${propertySize}\n` +
      `• Bathrooms: ${service === 'deep' ? bathLabel : 'n/a'}\n` +
      `• Extras: ${extrasLine}\n` +
      `• Estimated Total: £${Math.round(price)}\n` +
      `My postcode is: `;

    return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section id="quote" ref={ref} className="py-20 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 border-2 border-white/40 rounded-full px-4 py-1.5 mb-4">
            <Calculator size={14} className="text-white" />
            <span className="text-white text-xs tracking-widest font-semibold uppercase">Instant Pricing</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Get Your <span className="text-gradient-metallic">Instant Quote</span>
          </h2>
          <p className="text-silver-400 text-lg">Transparent pricing. No hidden fees. Tailored to your needs.</p>
        </div>

        <div className={`grid lg:grid-cols-5 gap-0 rounded-2xl overflow-hidden shadow-2xl transition-all duration-700 delay-200 lg:items-start ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Left: configurator */}
          <div className="lg:col-span-3 bg-white p-6 md:p-8">
            <div className="space-y-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-royal-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-navy-900 text-sm font-semibold">Select your service &amp; get an instant price</span>
              </div>

                {/* ── Deep clean options ── */}
                {service === 'deep' && (
                  <>
                    {/* Service type (End of tenancy / Move-in / After builders / Carpet) */}
                    <div>
                      <label className="block text-navy-900 font-semibold text-sm mb-2">Service Type</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(DEEP_SERVICE_LABELS) as DeepServiceType[]).map((k) => (
                          <button key={k} type="button"
                            onClick={() => { setDeepService(k); setAddOnCounts(Object.fromEntries(addOnDefs.map(a => [a.key, 0]))); }}
                            className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-left transition-all duration-200 ${deepService === k ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'}`}>
                            {DEEP_SERVICE_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* After builders — photo quote callout (replaces configurator) */}
                    {isAfterBuilders && (
                      <div className="rounded-2xl px-5 py-5 bg-amber-50 border-2 border-amber-200 space-y-3 text-center">
                        <div className="text-amber-700 text-[10px] font-bold tracking-widest uppercase">After Builders Clean</div>
                        <div className="font-display font-bold text-4xl text-amber-900">From £199</div>
                        <p className="text-silver-600 text-sm leading-relaxed max-w-xs mx-auto">
                          The extent of after-builders work varies — fine dust, paint specks, sticker residue and debris. Send us a photo and we'll confirm your exact price within the hour.
                        </p>
                      </div>
                    )}

                    {/* Property size / room count */}
                    {!isAfterBuilders && (<>
                    <div>
                      <label className="block text-navy-900 font-semibold text-sm mb-2">
                        {isCarpet ? 'Number of Carpeted Rooms' : 'Property Size'}
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {((isCarpet
                          ? [['studio','1 room'],['bed1','2 rooms'],['bed2','3 rooms'],['bed3','4 rooms'],['bed4','5+ rooms']]
                          : [['studio','Studio'],['bed1','1 Bed'],['bed2','2 Bed'],['bed3','3 Bed'],['bed4','4+ Bed']]
                        ) as [SizeKey, string][]).map(([k,l]) => (
                          <button key={k} type="button" onClick={() => setDeepSize(k)}
                            className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${deepSize === k ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                      {isCarpet && (
                        <p className="text-silver-500 text-[10px] mt-1.5 leading-relaxed">Count any carpeted room — bedrooms, living room, dining room. Stairs priced separately.</p>
                      )}
                    </div>

                    {/* Bathrooms — hidden for carpet service */}
                    {!isCarpet && (
                      <div>
                        <label className="block text-navy-900 font-semibold text-sm mb-2">Bathrooms / WCs</label>
                        <div className="flex gap-2">
                          {([1, 2, 3] as const).map((n) => (
                            <button key={n} type="button" onClick={() => setDeepBaths(n)}
                              className={`w-11 h-11 rounded-full border-2 text-sm font-bold transition-all duration-200 ${deepBaths === n ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-200 text-navy-700 hover:border-royal-300'}`}>
                              {n === 3 ? '3+' : n}
                            </button>
                          ))}
                        </div>
                        {deepBaths > 1 && (
                          <p className="text-silver-500 text-[10px] mt-1">
                            +£{(deepBaths - 1) * BATH_SURCHARGE[deepService]} for {deepBaths - 1} extra bathroom{deepBaths > 2 ? 's' : ''} included in price
                          </p>
                        )}
                      </div>
                    )}

                    {/* Extras */}
                    <div>
                      <label className="block text-navy-900 font-semibold text-sm mb-2">
                        {isCarpet ? 'Add-ons' : 'Optional Extras'}
                        <span className="ml-2 text-[10px] font-normal text-silver-500 uppercase tracking-wide">— total updates live</span>
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:max-h-64 sm:overflow-y-auto overflow-y-visible pr-1 no-scrollbar">
                        {addOnDefs.filter((a) => {
                          if (isCarpet) return ['sofa','mattress','staircase'].includes(a.key);
                          if (a.key === 'rubbish') return deepService === 'after_builders';
                          return !['sofa','mattress','staircase'].includes(a.key);
                        }).map((a) => {
                          const isOvenFree = a.key === 'oven' && deepService === 'end_of_tenancy';
                          const dynamicPrice = a.key === 'carpet_bundle' ? CARPET_BUNDLE_PRICE[deepSize] : isOvenFree ? 0 : a.price;
                          const saving = a.key === 'carpet_bundle' ? CARPET_STANDALONE_PRICE[deepSize] - CARPET_BUNDLE_PRICE[deepSize] : 0;
                          return (
                            <div key={a.key} className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-200 ${isOvenFree ? 'bg-amber-50 border-amber-200' : 'bg-silver-50 border-silver-200'}`}>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-navy-800 text-xs font-medium">{a.label}</span>
                                  {isOvenFree && (
                                    <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">FREE</span>
                                  )}
                                </div>
                                <div className="text-royal-600 text-[10px] font-bold mt-0.5">
                                  {isOvenFree
                                    ? 'Included with End of Tenancy'
                                    : a.key === 'staircase'
                                      ? '+£45 first flight · +£35 each extra'
                                      : `+£${dynamicPrice}`}
                                  {saving > 0 && <span className="text-green-600 ml-1">· saves £{saving}</span>}
                                </div>
                                {a.key === 'staircase' && (
                                  <p className="text-silver-600 text-[10px] mt-0.5 leading-snug">One flight = one set of stairs between floors. A 3-storey home has 2 flights.</p>
                                )}
                              </div>
                              {isOvenFree ? (
                                <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                              ) : (
                                <Counter value={addOnCounts[a.key]} max={a.key === 'staircase' ? 3 : undefined} onChange={(v) => setAddOnCounts((p) => ({ ...p, [a.key]: v }))} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </>)}
                  </>
                )}

                {/* ── Window cleaning options ── */}
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

                {/* ── Gutter options ── */}
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

                {/* ── Office options ── */}
                {service === 'office' && (
                  <div>
                    <label className="block text-navy-900 font-semibold text-sm mb-3">Hours Required (min. 4)</label>
                    <div className="flex items-center justify-between bg-silver-50 rounded-xl px-4 py-4 border border-silver-200">
                      <div>
                        <div className="text-navy-900 font-bold">{officeHours} hours</div>
                        <div className="text-silver-500 text-xs">£{HOURLY_RATE}/hr × {officeHours}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setOfficeHours(Math.max(MIN_OFFICE_HOURS, officeHours - 1))} disabled={officeHours <= MIN_OFFICE_HOURS}
                          className="w-9 h-9 rounded-full border-2 border-silver-300 flex items-center justify-center text-navy-700 hover:border-royal-400 transition-colors disabled:opacity-30">
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

                {/* Minimum charge notice */}
                {minApplied && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-amber-700 text-xs">Minimum booking threshold met (£90)</span>
                  </div>
                )}

                {/* ── Price / quote box ── */}
                {!isAfterBuilders && (
                  <div className="relative rounded-2xl px-6 py-6 overflow-visible" style={{ backgroundColor: '#dff0e8', border: '1.5px solid #b6d9c8' }}>
                    {/* Rotated deposit badge */}
                    <div className="absolute -top-3 -right-3 rotate-6 z-10">
                      <div className="border-2 rounded-lg px-3 py-1.5" style={{ borderColor: '#1a5c3a', backgroundColor: 'transparent' }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#1a5c3a' }}>£30 Deposit · Rest After</span>
                      </div>
                    </div>

                    {/* Service label */}
                    <div className="text-center mb-2 mt-3">
                      <div className="text-xs font-bold tracking-widest uppercase" style={{ color: '#1e6b42', letterSpacing: '0.18em' }}>
                        {service === 'deep'
                          ? `${DEEP_SERVICE_LABELS[deepService]} · ${deepSize === 'studio' ? 'Studio' : deepSize.replace('bed', '') + ' Bed'} · ${isCarpet ? '' : `${deepBaths === 3 ? '3+' : deepBaths} Bath`}`.replace(/ · $/, '')
                          : serviceLabels[service]}
                      </div>
                    </div>

                    {/* Big price */}
                    <div className="text-center">
                      <div className="font-display font-bold leading-none" style={{ fontSize: '3.5rem', color: '#1a5c3a' }}>
                        £{Math.round(price)}
                      </div>
                    </div>

                    {/* Subtitle */}
                    {service === 'deep' && (
                      <div className="text-center mt-3 text-sm" style={{ color: '#4a7a62' }}>
                        {deepService === 'end_of_tenancy' ? 'Oven clean included free · ' : ''}48hr re-clean guarantee
                      </div>
                    )}
                  </div>
                )}

                {/* ── Regular cleaning discount nudge ── */}
                <div className="flex items-start gap-3 bg-royal-50 border border-royal-200 rounded-xl px-4 py-3">
                  <div className="w-1 self-stretch rounded-full bg-royal-400 flex-shrink-0" />
                  <div>
                    <p className="text-royal-700 text-xs font-semibold mb-0.5">Regular service discounts available</p>
                    <p className="text-royal-600 text-xs leading-relaxed">
                      Customers who book regular cleaning services can get <span className="font-semibold">10% to 30% off</span>, depending on the service type, frequency, and property size.
                    </p>
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full font-bold text-white text-base transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
                  style={{ backgroundColor: '#22C55E' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Book this clean on WhatsApp →
                </a>

                <a
                  href="https://calendar.app.google/EeN4x6XMiZn6par76"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-bold text-base transition-all duration-300 active:scale-[0.98]"
                  style={{ backgroundColor: '#ffffff', border: '2px solid #1a5c3a', color: '#1a5c3a' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Book Online
                </a>
              </div>
          </div>

          {/* Right: price panel */}
          <div className="lg:col-span-2 navy-gradient p-6 flex flex-col justify-between lg:sticky lg:top-24 lg:self-start">
            <div>
              <h3 className="text-silver-400 text-xs font-medium tracking-widest uppercase mb-2">
                {isAfterBuilders ? 'Starting From' : 'Estimated Price'}
              </h3>
              <div className="text-5xl font-bold font-display text-white mb-1 transition-all duration-300">
                {isAfterBuilders ? 'From £199' : `£${Math.round(price)}`}
              </div>
              {minApplied && (
                <div className="text-amber-400 text-xs mb-2 flex items-center gap-1">
                  <Info size={11} /> Min. charge applied
                </div>
              )}
              <div className="text-silver-400 text-sm mb-6">{serviceLabels[service]}</div>
              <div className="space-y-4 mb-6">
                {['Fully insured & vetted team', 'Background-checked staff', 'Satisfaction guarantee', 'No hidden fees', 'Eco-friendly products'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-silver-300 text-sm">
                    <CheckCircle2 size={13} className="text-royal-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              {/* Dynamic booking summary */}
              <div className="glass-card rounded-xl p-3 mb-2">
                <div className="text-silver-400 text-[10px] uppercase tracking-widest font-semibold mb-1.5">Your Selection</div>
                <p className="text-silver-200 text-xs leading-relaxed">
                  Service: <span className="text-white font-semibold">{serviceLabels[service]}</span>
                  {service === 'deep' && (
                    <>
                      {' · '}
                      <span className="text-white font-semibold">
                        {deepSize === 'studio' ? 'Studio' : deepSize.replace('bed', '') + ' Bed'}
                        {!isCarpet && ` · ${deepBaths === 3 ? '3+' : deepBaths} bath`}
                      </span>
                    </>
                  )}
                  {service === 'window' && (
                    <>
                      {' · '}
                      <span className="text-white font-semibold">
                        {windowSize === 'small' ? '1–2 Bed' : windowSize === 'medium' ? '3 Bed' : '4+ Bed'}
                      </span>
                    </>
                  )}
                  {service === 'gutter' && (
                    <>
                      {' · '}
                      <span className="text-white font-semibold capitalize">
                        {gutterType.replace('_', '-')}
                      </span>
                    </>
                  )}
                  {service === 'office' && (
                    <>
                      {' · '}
                      <span className="text-white font-semibold">{officeHours} hrs</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-all duration-300 text-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {isAfterBuilders ? 'WhatsApp a photo for your quote' : 'Book via WhatsApp: 07845 451111'}
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


