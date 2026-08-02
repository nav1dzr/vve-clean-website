// Premium guided End of Tenancy quote.
//
// Five steps — Property → Bathrooms → Upgrades → Review → Book — inside one
// polished card, with a persistent live quote beside it on desktop and a
// single bottom action bar on mobile carrying both the price and the one
// primary action for the current step.
//
// Two deliberate rules from the approved design direction:
//
//  1. Individual adjustment amounts (house/maisonette, extra bathrooms, extra
//     WC) are NOT shown next to the selection controls. The total updates live
//     instead, and every adjustment is itemised in full on the Review step
//     before the customer commits. Hidden from the cards, never from the price.
//
//  2. Parking and the Congestion Charge are not asked here at all. BookingPage
//     asks them once as required questions and adds them on top of the handed
//     off price; the server independently recomputes them from quoteConfig.
//     Asking twice would risk a quote/booking mismatch.

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { useBookingCtx } from '../../../context/BookingContext';
import {
  EOT_CARPET_UPGRADES, EOT_EXTRAS, EOT_SCOPE_OPTIONS, EOT_SIZES, displayPence,
} from '../../../lib/eotPricing';
import { useEotQuote, type EotQuoteState } from '../useEotQuote';
import VveWordmark from '../../brand/VveWordmark';
import {
  PrimaryButton, SecondaryButton, SelectionCardGroup, StepperControl,
  TrustBadge, QuoteDisclosure, UpgradeRow,
} from './QuoteParts';
import {
  LiveQuoteSummary, LiveTotal, QuoteBreakdown, QuoteProgress,
} from './QuoteSummaryParts';
import {
  INCLUDED_ITEMS, QUOTE_STEPS, SCOPE_REASSURANCE, WA_BASE,
} from './quoteContent';

/* Upgrade grouping, per the approved direction. */
const CARPET_KEYS = ['eot_living_carpet'] as const;
const SPECIAL_KEYS = [
  'eot_sofa_2', 'eot_sofa_3', 'eot_sofa_corner',
  'eot_mattress_single', 'eot_mattress_double',
] as const;
const OTHER_KEYS = [
  'reception', 'conservatory', 'balcony', 'utility',
  'ext_windows', 'wall_marks', 'rubbish', 'key_collect',
] as const;

const upgradeMeta = (key: string) => {
  const c = EOT_CARPET_UPGRADES.find((u) => u.key === key);
  if (c) return { label: c.label, pence: c.pence, hint: '' };
  const e = EOT_EXTRAS.find((x) => x.key === key);
  if (e) return { label: e.label, pence: e.pence, hint: e.hint };
  return { label: key, pence: 0, hint: '' };
};

/**
 * @param initialState Optional starting selections, forwarded to useEotQuote.
 * The homepage passes this when reopening a quote after "Back to quote"; the
 * End of Tenancy page passes nothing and is unaffected.
 */
export default function EotQuotePremium({
  initialState,
}: { initialState?: Partial<EotQuoteState> } = {}) {
  const q = useEotQuote(initialState);
  const { setCtx } = useBookingCtx();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  // This quote owns the only fixed bar on the page — suppress the site-wide
  // sticky footer so mobile never shows two stacked bars.
  useEffect(() => {
    setCtx({ state: 'hidden', price: 0, waLink: '', onBook: () => {} });
  }, [setCtx]);

  // Move focus to each new step heading so keyboard and screen-reader users are
  // not stranded at the bottom of the previous step.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    headingRef.current?.focus();
  }, [step]);

  const { state, result } = q;
  const last = QUOTE_STEPS.length - 1;
  const canAdvance = step === 0 ? state.size !== null : true;

  // The mobile bottom bar owns the price and the primary action once a price
  // exists. It is the single mobile price surface — there is no second in-flow
  // total card, so the customer never sees two competing figures.
  const showMobileBar = Boolean(result) && !q.isTailored;

  // On the final step the desktop summary carries the booking action, so the
  // in-card copy must stand down there too — otherwise desktop shows two
  // "Secure my date" buttons. Ownership by breakpoint:
  //   below lg → the fixed bar owns it (once a price exists)
  //   lg and up on the last step → the summary owns it
  const summaryOwnsAction = step === last && !q.isTailored;
  const inCardActionClass = showMobileBar
    ? (summaryOwnsAction ? 'hidden' : 'hidden lg:block')
    : (summaryOwnsAction ? 'lg:hidden' : '');

  const goNext = () => setStep((s) => Math.min(last, q.isTailored ? last : s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const toggleCount = (key: string) =>
    q.setCount(key, (state.counts[key] ?? 0) > 0 ? 0 : 1);

  const stepTitle = [
    'Tell us about your property',
    'Bathrooms and WCs',
    'Add optional upgrades',
    'Review your quote',
    'Secure your date',
  ][step];

  /* The single primary action for the current step. */
  const primaryAction = (() => {
    if (q.isTailored) {
      return (
        <a
          href={`${WA_BASE}?text=${encodeURIComponent(
            "Hello VVE Clean, I'd like a tailored quote for an end of tenancy clean at a 5+ bedroom property.\nMy postcode is: ",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-6 text-[15px] font-bold text-white hover:bg-navy-800 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
        >
          Request my tailored quote
          <ArrowRight className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        </a>
      );
    }
    if (step === last) {
      return (
        <PrimaryButton
          onClick={q.bookNow}
          disabled={!q.canBook}
          icon={<ArrowRight className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />}
        >
          Secure my date
        </PrimaryButton>
      );
    }
    return (
      <PrimaryButton
        onClick={goNext}
        disabled={!canAdvance}
        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />}
      >
        {step === 2 ? 'Review quote' : 'Continue'}
      </PrimaryButton>
    );
  })();

  return (
    <section id="quote" className="scroll-mt-24 bg-[#f7f8fa] py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 text-center">
          <h2 className="font-display text-[26px] font-bold leading-tight text-navy-900 md:text-4xl">
            Build your complete quote
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-600">
            A fixed price for the whole clean — no hourly rates, no surprises on the day.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          {/* ── Quote card ── */}
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-8px_rgba(16,24,40,0.10)]">
              {/* Header: official wordmark + trust badge */}
              <div className="flex items-center justify-between gap-3 border-b border-silver-100 px-5 py-3.5">
                <VveWordmark size="sm" />
                <TrustBadge icon="secure" tone="navy">Secure quote</TrustBadge>
              </div>

              <div className="border-b border-silver-100 px-5 py-3.5">
                <QuoteProgress step={step} />
              </div>

              <div className="p-5 md:p-6">
                <h3
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-[19px] font-bold leading-tight text-navy-900 focus:outline-none md:text-[21px]"
                >
                  {stepTitle}
                </h3>

                {/* ── Step 1: Property ── */}
                {step === 0 && (
                  <div className="mt-4 space-y-5">
                    <fieldset>
                      <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        Property type
                      </legend>
                      <SelectionCardGroup
                        legend="Property type"
                        columns={2}
                        value={state.propertyType}
                        onChange={(v) => q.setField('propertyType', v as 'flat' | 'house')}
                        options={[
                          { value: 'flat',  title: 'Flat',  caption: 'Apartment or single-floor' },
                          { value: 'house', title: 'House', caption: 'House or maisonette' },
                        ]}
                      />
                    </fieldset>

                    <fieldset>
                      <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        Property size
                      </legend>
                      <SelectionCardGroup
                        legend="Property size"
                        columns={2}
                        value={state.size}
                        onChange={(v) => q.setField('size', v as typeof state.size)}
                        options={EOT_SIZES.map((s) => ({
                          value: s.key,
                          title: s.short,
                          caption: s.key === 'bed5' ? 'Tailored quote' : undefined,
                        }))}
                      />
                    </fieldset>

                    {/* Scope reassurance. Every room named here is explicitly
                        covered by the published base-package definition. */}
                    <p className="rounded-xl border border-silver-200 bg-silver-50/70 px-4 py-3 text-[12.5px] leading-snug text-slate-700">
                      {SCOPE_REASSURANCE}
                    </p>
                  </div>
                )}

                {/* ── Step 2: Bathrooms ── */}
                {step === 1 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[13px] leading-snug text-slate-600">
                      Your first full bathroom is already included in the package price.
                    </p>
                    <StepperControl
                      label="Full bathrooms"
                      hint="Including the one already in your package"
                      value={state.bathrooms}
                      min={1}
                      max={5}
                      onChange={(n) => q.setField('bathrooms', Math.max(1, n))}
                    />
                    <StepperControl
                      label="Additional WC"
                      hint="Cloakroom or half bathroom"
                      value={state.counts.extra_wc ?? 0}
                      max={4}
                      onChange={(n) => q.setCount('extra_wc', n)}
                    />
                    <QuoteDisclosure summary="What's included in every clean">
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {INCLUDED_ITEMS.map((item) => (
                          <li key={item} className="text-[12px] leading-snug text-slate-700">• {item}</li>
                        ))}
                      </ul>
                    </QuoteDisclosure>
                  </div>
                )}

                {/* ── Step 3: Upgrades ── */}
                {step === 2 && (
                  <div className="mt-4 space-y-5">
                    <div>
                      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        Carpet cleaning
                      </h4>
                      <div className="space-y-2">
                        <UpgradeRow
                          name="Carpets — whole home"
                          description="Hallway, landing and every bedroom"
                          selected={state.carpetWholeHome}
                          onToggle={() => q.setField('carpetWholeHome', !state.carpetWholeHome)}
                        />
                        {CARPET_KEYS.map((k) => {
                          const m = upgradeMeta(k);
                          return (
                            <UpgradeRow
                              key={k}
                              name={m.label}
                              selected={(state.counts[k] ?? 0) > 0}
                              onToggle={() => toggleCount(k)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        Appliances or special items
                      </h4>
                      <div className="space-y-2">
                        {SPECIAL_KEYS.map((k) => {
                          const m = upgradeMeta(k);
                          return (
                            <UpgradeRow
                              key={k}
                              name={m.label}
                              description="Steam cleaned during your visit"
                              selected={(state.counts[k] ?? 0) > 0}
                              onToggle={() => toggleCount(k)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <QuoteDisclosure summary="Other optional services">
                      <div className="space-y-2">
                        {OTHER_KEYS.map((k) => {
                          const m = upgradeMeta(k);
                          return (
                            <UpgradeRow
                              key={k}
                              name={m.label}
                              description={m.hint || undefined}
                              selected={(state.counts[k] ?? 0) > 0}
                              onToggle={() => toggleCount(k)}
                            />
                          );
                        })}
                      </div>
                    </QuoteDisclosure>

                    <QuoteDisclosure summary="Already cleaned something yourself?">
                      <p className="mb-3 text-[12px] leading-snug text-slate-600">
                        We can credit a small number of verifiable inspection items, up to £30 and
                        never more than 10% of the base price. This changes your booking to a Custom
                        EOT clean, and anything removed is excluded from the 48-hour re-clean guarantee.
                      </p>
                      <div className="space-y-2">
                        {EOT_SCOPE_OPTIONS.map((o) => (
                          <UpgradeRow
                            key={o.key}
                            name={o.label}
                            selected={state.scopeExclusions.includes(o.key)}
                            onToggle={() => q.toggleScope(o.key)}
                          />
                        ))}
                      </div>
                    </QuoteDisclosure>
                  </div>
                )}

                {/* ── Step 4: Review ── */}
                {step === 3 && result && !q.isTailored && (
                  <div className="mt-4 space-y-4">
                    <p className="text-[13px] leading-snug text-slate-600">
                      Everything below is fixed before we arrive. Here is exactly what makes up your total.
                    </p>
                    <QuoteBreakdown result={result} />
                    <QuoteDisclosure summary="What's included in every clean">
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {INCLUDED_ITEMS.map((item) => (
                          <li key={item} className="text-[12px] leading-snug text-slate-700">• {item}</li>
                        ))}
                      </ul>
                    </QuoteDisclosure>
                  </div>
                )}

                {/* ── Step 5: Book ── */}
                {step === 4 && result && !q.isTailored && (
                  <div className="mt-4 space-y-4">
                    {/* Below lg the fixed bar already shows this total, so this
                        block stands down there — never two totals on one screen. */}
                    <div className={`rounded-2xl border border-silver-200 bg-silver-50/60 p-4 ${showMobileBar ? 'hidden lg:block' : ''}`}>
                      <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                        Your total
                      </p>
                      <LiveTotal pence={result.totalPence} className="mt-0.5 block text-3xl text-navy-900" />
                      <p className="mt-1 text-[13px] text-slate-600">
                        <span className="font-semibold text-navy-900">
                          {displayPence(result.depositPence)} today
                        </span>
                        {' · '}{displayPence(result.balancePence)} after your clean
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <TrustBadge icon="check" tone="emerald">£30 secures your preferred date</TrustBadge>
                      <TrustBadge icon="check" tone="sky">Included in your total</TrustBadge>
                    </div>
                    <p className="text-[12.5px] leading-snug text-slate-600">
                      Next you will choose your preferred date and arrival window, and answer two
                      quick access questions (parking and the Congestion Charge). Those are shown as
                      separate lines before you pay.
                    </p>
                  </div>
                )}

                {/* Tailored quote takes over the body entirely. */}
                {q.isTailored && step > 0 && (
                  <p className="mt-4 text-[13px] leading-snug text-slate-600">
                    Properties with 5 or more bedrooms vary too much for a fixed online price. Send us
                    the room count and access details and we will agree a written price before any
                    work starts.
                  </p>
                )}

                {/* ── Controls ──
                    Exactly one primary action is visible at any width. Once a
                    price exists the mobile bottom bar carries it, so the
                    in-card copy is hidden below lg to avoid two competing
                    CTAs on the same screen. */}
                <div className="mt-6 flex items-center gap-3 border-t border-silver-100 pt-5">
                  {step > 0 && <SecondaryButton onClick={goBack}>Back</SecondaryButton>}
                  <div className={`min-w-0 flex-1 ${inCardActionClass}`}>
                    {primaryAction}
                  </div>
                </div>
                {step === 0 && !canAdvance && (
                  <p role="status" className="mt-2 text-center text-[12px] font-medium text-slate-500">
                    Choose a property size to continue
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* ── Desktop live quote ── */}
          <div className="hidden lg:sticky lg:top-24 lg:col-span-5 lg:block xl:col-span-4">
            <LiveQuoteSummary result={result}>
              {step === last && !q.isTailored ? primaryAction : null}
            </LiveQuoteSummary>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-slate-500">
              <Lock className="h-3 w-3" aria-hidden="true" strokeWidth={2.5} />
              £30 secures your preferred date and is included in your total
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom action bar: price + the one current action ── */}
      {result && !q.isTailored && (
        <>
          <div className="h-[76px] lg:hidden" aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-silver-200 bg-white/95 backdrop-blur lg:hidden"
            style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="min-w-0 flex-1">
                <span className="block text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">
                  Total
                </span>
                <LiveTotal pence={result.totalPence} className="block text-xl leading-none text-navy-900" />
              </div>
              <div className="w-[54%] flex-shrink-0">{primaryAction}</div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
