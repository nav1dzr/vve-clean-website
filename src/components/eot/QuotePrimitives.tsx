// Shared presentation primitives for the redesigned End of Tenancy quote.
//
// These are deliberately bespoke rather than a generic form library: large
// touch targets, an unmistakable selected state, and motion that respects
// prefers-reduced-motion. Both design concepts compose the same primitives so
// the visual language stays identical and only the journey differs.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { displayPence } from '../../lib/eotPricing';

/* ── Selection card ─────────────────────────────────────────────────────── */

export function OptionCard({
  selected, onSelect, title, subtitle, price, icon, ariaLabel,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  price?: string;
  icon?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={ariaLabel ?? title}
      className={`group relative flex w-full flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left min-h-[76px]
        motion-safe:transition-all motion-safe:duration-200 focus-visible:outline focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-royal-500
        ${selected
          ? 'border-royal-500 bg-royal-50 shadow-[0_0_0_3px_rgba(2,132,199,0.12)]'
          : 'border-silver-300 bg-white hover:border-royal-300 hover:bg-silver-50'}`}
    >
      {icon && <span className="mb-0.5 text-royal-500" aria-hidden="true">{icon}</span>}
      <span className={`font-display text-base font-bold leading-tight ${selected ? 'text-royal-700' : 'text-navy-900'}`}>
        {title}
      </span>
      {subtitle && <span className="text-xs leading-snug text-silver-600">{subtitle}</span>}
      {price && (
        <span className={`mt-auto pt-1 text-sm font-bold ${selected ? 'text-royal-600' : 'text-navy-700'}`}>
          {price}
        </span>
      )}
      <span
        aria-hidden="true"
        className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2
          motion-safe:transition-all motion-safe:duration-200
          ${selected ? 'border-royal-500 bg-royal-500' : 'border-silver-300 bg-white'}`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ── Quantity stepper ───────────────────────────────────────────────────── */

export function Stepper({
  label, hint, price, value, onChange, max = 9,
}: {
  label: string; hint?: string; price: string;
  value: number; onChange: (n: number) => void; max?: number;
}) {
  const id = useId();
  const active = value > 0;
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 motion-safe:transition-colors
      ${active ? 'border-royal-300 bg-royal-50/60' : 'border-silver-200 bg-white'}`}>
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-semibold leading-tight text-navy-900">{label}</p>
        {hint && <p className="text-xs text-silver-500">{hint}</p>}
        <p className="text-xs font-bold text-royal-600">{price}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={`Remove one ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-silver-300 bg-white text-navy-800 disabled:opacity-35 hover:border-royal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
        >
          <span aria-hidden="true">−</span>
        </button>
        <span aria-live="polite" aria-atomic="true" className="w-7 text-center text-sm font-bold tabular-nums text-navy-900">
          <span className="sr-only">{label}: </span>{value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Add one ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-silver-300 bg-white text-navy-800 disabled:opacity-35 hover:border-royal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

/* ── Toggle row (scope credits / carpet bundle) ─────────────────────────── */

export function ToggleRow({
  label, hint, price, checked, onChange, tone = 'default',
}: {
  label: string; hint?: string; price: string;
  checked: boolean; onChange: (v: boolean) => void;
  tone?: 'default' | 'credit';
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 motion-safe:transition-colors
      ${checked
        ? tone === 'credit' ? 'border-emerald-300 bg-emerald-50' : 'border-royal-300 bg-royal-50/60'
        : 'border-silver-200 bg-white hover:border-silver-300'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-silver-400 text-royal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-navy-900">{label}</span>
        {hint && <span className="block text-xs text-silver-500">{hint}</span>}
      </span>
      <span className={`flex-shrink-0 text-sm font-bold ${tone === 'credit' ? 'text-emerald-600' : 'text-royal-600'}`}>
        {price}
      </span>
    </label>
  );
}

/* ── Access answer group ────────────────────────────────────────────────── */

export function AccessChoice({
  legend, explain, value, onChange, options, error,
}: {
  legend: string; explain: string;
  value: string; onChange: (v: 'yes' | 'no' | 'unsure') => void;
  options: { value: 'yes' | 'no' | 'unsure'; label: string }[];
  error?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-navy-900">{legend}</legend>
      <p className="mb-2 mt-0.5 text-xs leading-snug text-silver-600">{explain}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={selected}
              className={`min-h-[44px] flex-1 basis-24 rounded-xl border-2 px-3 py-2 text-sm font-semibold
                motion-safe:transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500
                ${selected ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-silver-300 bg-white text-navy-800 hover:border-royal-300'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-[#D14343]">{error}</p>}
    </fieldset>
  );
}

/* ── Animated price value ───────────────────────────────────────────────── */

/**
 * Announces the running total once per settled change rather than on every
 * keystroke-fast update, so screen readers are not flooded while the customer
 * taps through options.
 */
export function LivePrice({ pence, size = 'lg' }: { pence: number; size?: 'lg' | 'xl' }) {
  const [announced, setAnnounced] = useState(pence);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnnounced(pence), 500);
    return () => window.clearTimeout(timer.current);
  }, [pence]);

  return (
    <>
      <span
        aria-hidden="true"
        className={`block font-display font-bold tabular-nums text-white motion-safe:transition-all motion-safe:duration-300
          ${size === 'xl' ? 'text-5xl' : 'text-4xl'}`}
      >
        {displayPence(pence)}
      </span>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        Your price: {displayPence(announced)}
      </span>
    </>
  );
}

/* ── Expandable "what's included" ───────────────────────────────────────── */

export function IncludedPanel({ items }: { items: readonly string[] }) {
  return (
    <details className="group rounded-xl border border-silver-200 bg-white open:bg-silver-50/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500">
        What&rsquo;s included in every clean
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-silver-500 motion-safe:transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <ul className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs leading-snug text-silver-700">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ── Section shell ──────────────────────────────────────────────────────── */

export function QuoteSection({
  step, title, caption, locked, children, id,
}: {
  step: number; title: string; caption?: string;
  locked?: boolean; children: ReactNode; id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`rounded-2xl border p-5 motion-safe:transition-opacity motion-safe:duration-300
        ${locked ? 'pointer-events-none select-none border-silver-200 bg-silver-50/50 opacity-45' : 'border-silver-200 bg-white'}`}
      {...(locked ? { 'aria-hidden': true } : {})}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${locked ? 'bg-silver-200 text-silver-500' : 'bg-navy-900 text-white'}`}>
          {step}
        </span>
        <div className="min-w-0">
          <h3 id={`${id}-heading`} className="font-display text-lg font-bold leading-tight text-navy-900">{title}</h3>
          {caption && <p className="text-xs text-silver-500">{caption}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
