// CONCEPT 2 — Guided step experience.
//
// One decision at a time with a compact progress bar, Back/Next controls and a
// persistent price rail. The price becomes real at the end of step 1 and stays
// visible for the rest of the journey. Step 5 is a review screen that restates
// the full breakdown before the single booking action.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBookingCtx } from '../../context/BookingContext';
import {
  EOT_CARPET_UPGRADES, EOT_EXTRAS, EOT_SCOPE_OPTIONS, EOT_SIZES,
  displayPence,
} from '../../lib/eotPricing';
import { useEotQuote } from './useEotQuote';
import {
  AccessChoice, IncludedPanel, OptionCard, Stepper, ToggleRow,
} from './QuotePrimitives';
import { EOT_INCLUDED_ITEMS, QuoteSummary } from './QuoteSummary';
import { EOT_CARPET_BUNDLE_P } from '../../data/pricing';

const STEPS = [
  { key: 'property', label: 'Property' },
  { key: 'details',  label: 'Details' },
  { key: 'options',  label: 'Options' },
  { key: 'access',   label: 'Access' },
  { key: 'review',   label: 'Review' },
] as const;

export default function EotQuoteWizard() {
  const q = useEotQuote();
  const { setCtx } = useBookingCtx();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // This quote owns the only fixed bar on the page.
  useEffect(() => {
    setCtx({ state: 'none', price: 0, waLink: '', onBook: () => {} });
  }, [setCtx]);

  // Move focus to the new step heading so keyboard and screen-reader users are
  // not silently left at the bottom of the previous step.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const { state, result } = q;

  const canAdvance = useMemo(() => {
    if (step === 0) return state.size !== null;
    if (step === 3) return q.hasAccessAnswers;
    return true;
  }, [step, state.size, q.hasAccessAnswers]);

  const blockedMessage = useMemo(() => {
    if (step === 0 && !state.size) return 'Choose a property size to continue';
    if (step === 3 && !q.hasAccessAnswers) return 'Answer both access questions to continue';
    return undefined;
  }, [step, state.size, q.hasAccessAnswers]);

  // A tailored quote short-circuits the journey: there is no fixed price to
  // build, so we jump straight to the review/contact screen.
  const isTailored = q.isTailored;
  const lastStep = STEPS.length - 1;
  const goNext = () => setStep((s) => Math.min(lastStep, isTailored && s === 0 ? lastStep : s + 1));
  const goBack = () => setStep((s) => Math.max(0, isTailored && s === lastStep ? 0 : s - 1));

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <section id="quote" className="scroll-mt-24 bg-silver-50 py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 text-center">
          <h2 className="font-display text-3xl font-bold text-navy-900 md:text-4xl">
            Build your complete quote
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-silver-600">
            Five short steps. Your fixed price appears as soon as you tell us the property size.
          </p>
        </div>

        {/* ── Progress ── */}
        <div className="mx-auto mb-6 max-w-3xl">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="text-navy-900">
              Step {step + 1} of {STEPS.length} · {STEPS[step].label}
            </span>
            <span className="text-silver-500">{Math.round(progress)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].label}`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-silver-200"
          >
            <div
              className="h-full rounded-full bg-royal-500 motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-silver-200 bg-white p-5 md:p-6">
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="mb-4 font-display text-xl font-bold text-navy-900 focus:outline-none"
              >
                {step === 0 && 'Tell us about your property'}
                {step === 1 && 'A few property details'}
                {step === 2 && 'Any cleaning options?'}
                {step === 3 && 'Access and charges'}
                {step === 4 && 'Review your quote'}
              </h3>

              {/* ── Step 1: property ── */}
              {step === 0 && (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <OptionCard
                      title="Flat" subtitle="Apartment or single-floor"
                      selected={state.propertyType === 'flat'}
                      onSelect={() => q.setField('propertyType', 'flat')}
                    />
                    <OptionCard
                      title="House" subtitle="Or maisonette · +£35"
                      selected={state.propertyType === 'house'}
                      onSelect={() => q.setField('propertyType', 'house')}
                      ariaLabel="House or maisonette, adds £35"
                    />
                  </div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-silver-500">
                    How many bedrooms?
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {EOT_SIZES.map((s) => (
                      <OptionCard
                        key={s.key} title={s.short}
                        selected={state.size === s.key}
                        onSelect={() => q.setField('size', s.key)}
                        ariaLabel={s.label}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* ── Step 2: details ── */}
              {step === 1 && (
                <div className="space-y-2">
                  <Stepper
                    label="Full bathrooms"
                    hint="The first is included in your base price"
                    price="+£50 each after the first"
                    value={state.bathrooms}
                    onChange={(n) => q.setField('bathrooms', Math.max(1, n))}
                    max={5}
                  />
                  <Stepper
                    label="Additional WC"
                    hint="Cloakroom or half bathroom"
                    price="+£25 each"
                    value={state.counts.extra_wc ?? 0}
                    onChange={(n) => q.setCount('extra_wc', n)}
                    max={4}
                  />
                  <IncludedPanel items={EOT_INCLUDED_ITEMS} />
                </div>
              )}

              {/* ── Step 3: options ── */}
              {step === 2 && (
                <>
                  {state.size && state.size !== 'bed5' && (
                    <ToggleRow
                      label="Carpets — whole home steam clean"
                      hint="Hallway, landing and every bedroom"
                      price={`+${displayPence(EOT_CARPET_BUNDLE_P[state.size] ?? 0)}`}
                      checked={state.carpetWholeHome}
                      onChange={(v) => q.setField('carpetWholeHome', v)}
                    />
                  )}
                  <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-silver-500">
                    Soft furnishings
                  </p>
                  <div className="space-y-2">
                    {EOT_CARPET_UPGRADES.filter((u) => u.key !== 'eot_living_carpet').map((u) => (
                      <Stepper
                        key={u.key} label={u.label}
                        price={`+${displayPence(u.pence)} each`}
                        value={state.counts[u.key] ?? 0}
                        onChange={(n) => q.setCount(u.key, n)}
                      />
                    ))}
                  </div>
                  <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-silver-500">
                    Extra rooms and jobs
                  </p>
                  <div className="space-y-2">
                    {EOT_EXTRAS.filter((e) => e.key !== 'extra_wc').map((e) => (
                      <Stepper
                        key={e.key} label={e.label} hint={e.hint || undefined}
                        price={`+${displayPence(e.pence)} each`}
                        value={state.counts[e.key] ?? 0}
                        onChange={(n) => q.setCount(e.key, n)}
                      />
                    ))}
                  </div>
                  <details className="group mt-4 rounded-xl border border-silver-200">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500">
                      Already done some of it yourself?
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="mb-3 text-xs leading-snug text-silver-600">
                        We can credit a small number of verifiable inspection items, up to £30 and
                        never more than 10% of the base price. This changes your booking to a Custom
                        EOT clean, and anything removed is excluded from the 48-hour re-clean guarantee.
                      </p>
                      <div className="space-y-2">
                        {EOT_SCOPE_OPTIONS.map((o) => (
                          <ToggleRow
                            key={o.key} tone="credit" label={o.label}
                            price={`−${displayPence(o.pence)}`}
                            checked={state.scopeExclusions.includes(o.key)}
                            onChange={() => q.toggleScope(o.key)}
                          />
                        ))}
                      </div>
                    </div>
                  </details>
                </>
              )}

              {/* ── Step 4: access ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <AccessChoice
                    legend="Is free parking available for our team?"
                    explain="If not, we add a £15 estimate and charge it at the actual cost — never more."
                    value={state.parkingAvailable}
                    onChange={(v) => q.setField('parkingAvailable', v)}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                      { value: 'unsure', label: 'Not sure' },
                    ]}
                  />
                  <AccessChoice
                    legend="Is the property inside the Congestion Charge zone?"
                    explain="A flat £18 pass-through, exactly what Transport for London charges us."
                    value={state.congestionZone}
                    onChange={(v) => q.setField('congestionZone', v)}
                    options={[
                      { value: 'no', label: 'No' },
                      { value: 'yes', label: 'Yes' },
                      { value: 'unsure', label: 'Not sure' },
                    ]}
                  />
                </div>
              )}

              {/* ── Step 5: review ── */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-silver-600">
                    Here is your complete quote. Everything below is fixed before we arrive —
                    the only figure that can change is parking, which is charged at its actual cost.
                  </p>
                  <div className="lg:hidden">
                    <QuoteSummary
                      result={result} canBook={q.canBook} onBook={q.bookNow}
                      blockedReason={blockedMessage}
                    />
                  </div>
                  <IncludedPanel items={EOT_INCLUDED_ITEMS} />
                </div>
              )}

              {/* ── Controls ── */}
              <div className="mt-6 flex items-center gap-3 border-t border-silver-200 pt-5">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="min-h-[48px] rounded-full border-2 border-silver-300 px-5 text-sm font-bold text-navy-800 hover:border-navy-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
                  >
                    Back
                  </button>
                )}
                {step < lastStep && (
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canAdvance}
                      className="min-h-[48px] w-full rounded-full bg-navy-900 px-5 text-sm font-bold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-silver-200 disabled:text-silver-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
                    >
                      {isTailored && step === 0 ? 'See tailored quote' : 'Continue'}
                    </button>
                    {blockedMessage && (
                      <p role="status" className="mt-1.5 text-center text-xs font-medium text-silver-500">
                        {blockedMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Persistent price rail (desktop) ── */}
          <div className="hidden lg:sticky lg:top-24 lg:col-span-2 lg:block">
            <QuoteSummary
              result={result} canBook={q.canBook} onBook={q.bookNow}
              blockedReason={blockedMessage}
              emptyHint="Your fixed price appears the moment you choose a property size in step 1."
            />
          </div>
        </div>
      </div>

      {/* ── Mobile persistent price (steps 1-4 only; step 5 shows the full card) ── */}
      {result && !isTailored && step < lastStep && (
        <>
          <div className="h-20 lg:hidden" aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
            style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}
          >
            <div
              className="navy-gradient flex items-center justify-between gap-3 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.22)]"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="min-w-0">
                <span className="block text-[11px] uppercase tracking-widest text-silver-400">
                  Your price so far
                </span>
                <span className="block font-display text-2xl font-bold leading-none text-white">
                  {displayPence(result.totalWithAccessPence)}
                </span>
              </div>
              <span className="flex-shrink-0 text-[11px] text-silver-300">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
