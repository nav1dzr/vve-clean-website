// Progress, live summary and final breakdown for the premium EOT quote.

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { displayPence, type EotQuoteResult } from '../../../lib/eotPricing';
import { TrustBadge } from './QuoteParts';

export const QUOTE_STEPS = ['Property', 'Bathrooms', 'Upgrades', 'Review', 'Book'] as const;

/* ── Progress ────────────────────────────────────────────────────────────── */

export function QuoteProgress({ step }: { step: number }) {
  const pct = ((step + 1) / QUOTE_STEPS.length) * 100;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] font-semibold text-navy-900">
          Step {step + 1} of {QUOTE_STEPS.length}
          <span className="text-slate-500"> · {QUOTE_STEPS[step]}</span>
        </p>
        <ol className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
          {QUOTE_STEPS.map((label, i) => (
            <li
              key={label}
              className={`text-[10.5px] font-semibold uppercase tracking-wide ${
                i === step ? 'text-royal-600' : i < step ? 'text-slate-500' : 'text-slate-300'
              }`}
            >
              {label}
              {i < QUOTE_STEPS.length - 1 && <span className="ml-1.5 text-slate-300">·</span>}
            </li>
          ))}
        </ol>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={QUOTE_STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${QUOTE_STEPS.length}: ${QUOTE_STEPS[step]}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-silver-200"
      >
        <div
          className="h-full rounded-full bg-royal-500 motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Animated total ──────────────────────────────────────────────────────── */

/**
 * Announces the settled total rather than every intermediate value, so screen
 * readers are not flooded while the customer taps through options.
 */
export function LiveTotal({ pence, className = '' }: { pence: number; className?: string }) {
  const [announced, setAnnounced] = useState(pence);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnnounced(pence), 450);
    return () => window.clearTimeout(timer.current);
  }, [pence]);
  return (
    <>
      <span aria-hidden="true" className={`font-display font-bold tabular-nums motion-safe:transition-all motion-safe:duration-300 ${className}`}>
        {displayPence(pence)}
      </span>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        Your total: {displayPence(announced)}
      </span>
    </>
  );
}

/* ── What you get ────────────────────────────────────────────────────────── */

export const WHAT_YOU_GET = [
  '67-point inventory-standard clean',
  '48-hour free re-clean if your agent flags anything',
  'Photographic cleaning receipt on completion',
  'All products and equipment included',
] as const;

export function WhatYouGet({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <ul className="space-y-1.5">
      {WHAT_YOU_GET.map((item) => (
        <li key={item} className={`flex items-start gap-2 text-[12px] leading-snug ${tone === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          <Check
            className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${tone === 'dark' ? 'text-emerald-300' : 'text-emerald-600'}`}
            aria-hidden="true"
            strokeWidth={3}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── Final breakdown ─────────────────────────────────────────────────────── */

function Row({ label, value, tone = 'default', qty }: {
  label: string; value: string; tone?: 'default' | 'credit' | 'muted'; qty?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
      <span className={tone === 'muted' ? 'text-slate-500' : 'text-slate-700'}>
        {label}{qty && qty > 1 ? ` ×${qty}` : ''}
      </span>
      <span className={`flex-shrink-0 font-semibold tabular-nums ${
        tone === 'credit' ? 'text-emerald-600' : 'text-navy-900'
      }`}>
        {value}
      </span>
    </div>
  );
}

/**
 * The transparent breakdown. Individual adjustment amounts are hidden on the
 * earlier selection steps to keep them uncluttered, but every one of them is
 * itemised here, before the customer commits to anything.
 */
export function QuoteBreakdown({ result }: { result: EotQuoteResult }) {
  return (
    <div className="rounded-xl border border-silver-200 bg-white p-4">
      <h4 className="mb-3 font-display text-[15px] font-bold text-navy-900">Price breakdown</h4>
      <div className="space-y-2">
        <Row label={result.baseLine.label} value={displayPence(result.baseLine.pence)} />

        {result.adjustmentLines.map((l) => (
          <Row key={l.key} label={l.label} qty={l.qty} value={`+${displayPence(l.pence)}`} />
        ))}
        {result.optionalLines.map((l) => (
          <Row key={l.key} label={l.label} qty={l.qty} value={`+${displayPence(l.pence)}`} />
        ))}
        {result.creditLines.map((l) => (
          <Row key={l.key} label={l.label} value={`−${displayPence(Math.abs(l.pence))}`} tone="credit" />
        ))}

        <div className="flex items-baseline justify-between gap-3 border-t border-silver-200 pt-2.5">
          <span className="font-display text-[15px] font-bold text-navy-900">Total</span>
          <span className="font-display text-xl font-bold tabular-nums text-navy-900">
            {displayPence(result.totalPence)}
          </span>
        </div>
        <Row label="£30 deposit today" value={displayPence(result.depositPence)} />
        <Row label="Balance after your clean" value={displayPence(result.balancePence)} tone="muted" />
      </div>

      {/* Access charges are not asked in the quote; they are confirmed once, at
          booking. Saying so here keeps the total honest without duplicating the
          question or risking a quote/booking mismatch. */}
      <p className="mt-3 border-t border-silver-100 pt-3 text-[11.5px] leading-snug text-slate-600">
        Parking and the Congestion Charge are confirmed at booking, where they are shown as
        separate lines before payment. Parking is charged at its actual cost.
      </p>
    </div>
  );
}

/* ── Live quote summary ──────────────────────────────────────────────────── */

export function LiveQuoteSummary({
  result, children,
}: {
  result: EotQuoteResult | null;
  /** The single primary action for the current step. */
  children?: React.ReactNode;
}) {
  if (!result || result.isTailored) {
    return (
      <aside className="rounded-2xl border border-silver-200 bg-white p-5 shadow-sm" aria-label="Your quote">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Your quote</p>
        <p className="mt-2 font-display text-lg font-bold leading-tight text-navy-900">
          {result?.isTailored ? '5+ bedrooms' : 'Choose your property'}
        </p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-slate-600">
          {result?.isTailored
            ? 'Properties this size vary too much for a fixed online price. We agree a written price before any work starts.'
            : 'Pick your property type and size and your fixed price appears here straight away.'}
        </p>
        <div className="mt-4 border-t border-silver-100 pt-4">
          <WhatYouGet tone="light" />
        </div>
        {children && <div className="mt-4">{children}</div>}
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-sm" aria-label="Your quote">
      <div className="navy-gradient p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">Your quote</p>
        <p className="mt-0.5 text-[13px] font-semibold text-white">End of Tenancy Cleaning</p>
        {result.scopeCreditPence > 0 && (
          <span className="mt-1 block text-sm text-slate-400 line-through">
            {displayPence(result.standardPence)}
          </span>
        )}
        <LiveTotal pence={result.totalPence} className="mt-1 block text-4xl text-white" />
        <p className="mt-1 text-[12px] text-slate-300">
          <span className="font-semibold text-white">{displayPence(result.depositPence)} deposit today</span>
          {' · '}{displayPence(result.balancePence)} after your clean
        </p>
      </div>

      <div className="space-y-4 p-5">
        <WhatYouGet tone="light" />
        <div className="flex flex-wrap gap-1.5">
          <TrustBadge icon="secure" tone="navy">Secure quote</TrustBadge>
          <TrustBadge icon="guarantee" tone="emerald">48-hour re-clean guarantee</TrustBadge>
        </div>
        {children}
      </div>
    </aside>
  );
}
