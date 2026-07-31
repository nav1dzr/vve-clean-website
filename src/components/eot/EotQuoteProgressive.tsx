// CONCEPT 1 — Premium progressive page.
//
// Everything lives on one page in compact sections. Section 1 is always open;
// the rest unlock the moment a property size is chosen, which is also the
// moment the price appears. Desktop gets a sticky side summary; mobile gets a
// single fixed price bar that expands into the full breakdown.

import { useEffect, useRef, useState } from 'react';
import { useBookingCtx } from '../../context/BookingContext';
import {
  EOT_CARPET_UPGRADES, EOT_EXTRAS, EOT_SCOPE_OPTIONS, EOT_SIZES,
  displayPence,
} from '../../lib/eotPricing';
import { useEotQuote } from './useEotQuote';
import {
  AccessChoice, IncludedPanel, OptionCard, QuoteSection, Stepper, ToggleRow,
} from './QuotePrimitives';
import { EOT_INCLUDED_ITEMS, QuoteSummary } from './QuoteSummary';
import { EOT_CARPET_BUNDLE_P } from '../../data/pricing';

export default function EotQuoteProgressive() {
  const q = useEotQuote();
  const { setCtx } = useBookingCtx();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  // This quote owns the only fixed bar on the page, so the site-wide sticky
  // footer is suppressed while it is mounted — otherwise mobile would show two
  // stacked bars competing for the same thumb.
  useEffect(() => {
    setCtx({ state: 'none', price: 0, waLink: '', onBook: () => {} });
  }, [setCtx]);

  // Focus management + Escape for the mobile breakdown sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    // Captured now: by cleanup time the ref may already point elsewhere, and
    // focus must return to the control that opened the sheet.
    const opener = sheetTriggerRef.current;
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [sheetOpen]);

  const { state, result } = q;
  const unlocked = state.size !== null;
  const showDetail = unlocked && !q.isTailored;

  const blockedReason = !q.hasAccessAnswers
    ? 'Answer the two access questions to continue'
    : undefined;

  const summary = (
    <QuoteSummary
      result={result}
      canBook={q.canBook}
      onBook={q.bookNow}
      blockedReason={blockedReason}
    />
  );

  return (
    <section id="quote" className="scroll-mt-24 bg-silver-50 py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold text-navy-900 md:text-4xl">
            Build your complete quote
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-silver-600">
            A fixed price for the whole clean — no hourly rates and no surprises on the day.
            Choose your property to see your price immediately.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
          {/* ── Questions ── */}
          <div className="space-y-4 lg:col-span-3">
            <QuoteSection id="eot-property" step={1} title="Your property" caption="This sets your base package price">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <OptionCard
                  title="Flat"
                  subtitle="Apartment or single-floor"
                  selected={state.propertyType === 'flat'}
                  onSelect={() => q.setField('propertyType', 'flat')}
                />
                <OptionCard
                  title="House"
                  subtitle="Or maisonette · +£35"
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
                    key={s.key}
                    title={s.short}
                    selected={state.size === s.key}
                    onSelect={() => q.setField('size', s.key)}
                    ariaLabel={s.label}
                  />
                ))}
              </div>
            </QuoteSection>

            <QuoteSection
              id="eot-details" step={2} title="Property details"
              caption="Only what changes your price" locked={!showDetail}
            >
              <Stepper
                label="Full bathrooms"
                hint="The first is included in your base price"
                price={`+£50 each after the first`}
                value={state.bathrooms}
                onChange={(n) => q.setField('bathrooms', Math.max(1, n))}
                max={5}
              />
              <div className="mt-2">
                <Stepper
                  label="Additional WC"
                  hint="Cloakroom or half bathroom"
                  price="+£25 each"
                  value={state.counts.extra_wc ?? 0}
                  onChange={(n) => q.setCount('extra_wc', n)}
                  max={4}
                />
              </div>
            </QuoteSection>

            <QuoteSection
              id="eot-options" step={3} title="Cleaning options"
              caption="Genuine upgrades — nothing is preselected" locked={!showDetail}
            >
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
                    key={u.key}
                    label={u.label}
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
                    key={e.key}
                    label={e.label}
                    hint={e.hint || undefined}
                    price={`+${displayPence(e.pence)} each`}
                    value={state.counts[e.key] ?? 0}
                    onChange={(n) => q.setCount(e.key, n)}
                  />
                ))}
              </div>

              <details className="group mt-4 rounded-xl border border-silver-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500">
                  Already done some of it yourself?
                </summary>
                <div className="px-4 pb-4">
                  <p className="mb-3 text-xs leading-snug text-silver-600">
                    We can credit a small number of verifiable inspection items, up to £30 and never
                    more than 10% of the base price. This changes your booking to a Custom EOT clean,
                    and anything removed is excluded from the 48-hour re-clean guarantee.
                  </p>
                  <div className="space-y-2">
                    {EOT_SCOPE_OPTIONS.map((o) => (
                      <ToggleRow
                        key={o.key}
                        tone="credit"
                        label={o.label}
                        price={`−${displayPence(o.pence)}`}
                        checked={state.scopeExclusions.includes(o.key)}
                        onChange={() => q.toggleScope(o.key)}
                      />
                    ))}
                  </div>
                  {result && result.scopeCreditPence > 0 && (
                    <p className="mt-2 text-xs font-semibold text-emerald-600">
                      Credit applied: −{displayPence(result.scopeCreditPence)} (capped)
                    </p>
                  )}
                </div>
              </details>
            </QuoteSection>

            <QuoteSection
              id="eot-access" step={4} title="Access and charges"
              caption="Both answers are required" locked={!showDetail}
            >
              <div className="space-y-4">
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
            </QuoteSection>

            <IncludedPanel items={EOT_INCLUDED_ITEMS} />
          </div>

          {/* ── Desktop summary ── */}
          <div className="hidden lg:sticky lg:top-24 lg:col-span-2 lg:block">
            {summary}
          </div>
        </div>
      </div>

      {/* ── Mobile: one fixed bar, expanding into the full breakdown ── */}
      {result && !q.isTailored && (
        <>
          <div className="h-24 lg:hidden" aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
            style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}
          >
            <div
              className="navy-gradient flex items-center gap-3 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.22)]"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                ref={sheetTriggerRef}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-expanded={sheetOpen}
                className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="block font-display text-2xl font-bold leading-none text-white">
                  {displayPence(result.totalWithAccessPence)}
                </span>
                <span className="mt-0.5 block text-[11px] text-silver-300 underline underline-offset-2">
                  See full breakdown
                </span>
              </button>
              <button
                type="button"
                onClick={q.canBook ? q.bookNow : () => setSheetOpen(true)}
                className="min-h-[48px] flex-shrink-0 rounded-full bg-royal-500 px-5 text-sm font-bold text-white hover:bg-royal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-300"
              >
                {q.canBook ? 'Book — £30' : 'Continue'}
              </button>
            </div>
          </div>

          {sheetOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Price breakdown">
              <button
                type="button"
                aria-label="Close breakdown"
                className="absolute inset-0 bg-navy-900/60"
                onClick={() => setSheetOpen(false)}
              />
              <div
                ref={sheetRef}
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto focus:outline-none"
              >
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="mx-auto mb-1 block rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-navy-900"
                >
                  Close
                </button>
                <QuoteSummary
                  result={result}
                  canBook={q.canBook}
                  onBook={q.bookNow}
                  blockedReason={blockedReason}
                  variant="sheet"
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
