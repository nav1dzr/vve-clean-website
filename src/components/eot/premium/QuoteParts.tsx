// Reusable building blocks for the premium guided End of Tenancy quote.
//
// Deliberately bespoke rather than a form library: large touch targets, an
// unmistakable selected state, real radio-group semantics, and motion that is
// suppressed under prefers-reduced-motion.

import {
  useId, useRef, useState, type KeyboardEvent, type ReactNode,
} from 'react';
import {
  Check, ChevronDown, Lock, Minus, Plus, RefreshCw, Shield, ShieldCheck,
} from 'lucide-react';

/* ── Trust badge ─────────────────────────────────────────────────────────── */

const BADGE_ICONS = {
  secure: Lock,
  shield: Shield,
  guarantee: ShieldCheck,
  check: Check,
  saved: RefreshCw,
} as const;

export type TrustBadgeTone = 'navy' | 'emerald' | 'gold' | 'sky';

const BADGE_TONES: Record<TrustBadgeTone, string> = {
  navy:    'bg-navy-50 text-navy-800 border-navy-100',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  gold:    'bg-amber-50 text-amber-900 border-amber-100',
  sky:     'bg-sky-50 text-sky-800 border-sky-100',
};

export function TrustBadge({
  icon = 'shield', tone = 'navy', children, className = '',
}: {
  icon?: keyof typeof BADGE_ICONS;
  tone?: TrustBadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = BADGE_ICONS[icon];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-tight ${BADGE_TONES[tone]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" strokeWidth={2.25} />
      {children}
    </span>
  );
}

/* ── Selection card (radio semantics) ────────────────────────────────────── */

export interface SelectionOption {
  value: string;
  title: string;
  /** Short explanatory line. Never a price during early selection. */
  caption?: string;
}

/**
 * A roving-tabindex radiogroup. The whole card is the control — there is no
 * detached radio dot — but assistive technology still sees a proper
 * radiogroup/radio structure and arrow keys move between options.
 */
export function SelectionCardGroup({
  legend, options, value, onChange, columns = 2, hideLegend = false,
}: {
  legend: string;
  options: SelectionOption[];
  value: string | null;
  onChange: (v: string) => void;
  columns?: 1 | 2 | 3;
  hideLegend?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const current = options.findIndex((o) => o.value === value);
    const from = current === -1 ? 0 : current;
    let nextIndex = from;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (from + 1) % options.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (from - 1 + options.length) % options.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = options.length - 1;
    onChange(options[nextIndex].value);
    refs.current[nextIndex]?.focus();
  };

  const gridCols = columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div
      role="radiogroup"
      aria-label={legend}
      onKeyDown={onKeyDown}
      className={`grid gap-2.5 ${gridCols}`}
    >
      {!hideLegend && <span className="sr-only">{legend}</span>}
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Explicit name keeps the option distinguishable from its caption.
            aria-label={o.caption ? `${o.title} — ${o.caption}` : o.title}
            tabIndex={selected || (value === null && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`group relative flex min-h-[68px] w-full flex-col justify-center gap-0.5 rounded-xl border-2 p-3.5 pr-9 text-left
              motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-200
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500
              active:scale-[0.995]
              ${selected
                ? 'border-royal-500 bg-royal-50 shadow-[0_1px_2px_rgba(2,132,199,0.10)]'
                : 'border-silver-200 bg-white hover:border-royal-300 hover:bg-silver-50/70'}`}
          >
            <span className={`font-display text-[15px] font-bold leading-tight ${selected ? 'text-royal-700' : 'text-navy-900'}`}>
              {o.title}
            </span>
            {o.caption && (
              <span className={`text-[11.5px] leading-snug ${selected ? 'text-royal-600' : 'text-slate-600'}`}>
                {o.caption}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2
                motion-safe:transition-colors motion-safe:duration-200
                ${selected ? 'border-royal-500 bg-royal-500' : 'border-silver-300 bg-white group-hover:border-royal-300'}`}
            >
              {selected && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Stepper control ─────────────────────────────────────────────────────── */

export function StepperControl({
  label, hint, value, onChange, min = 0, max = 9,
}: {
  label: string; hint?: string;
  value: number; onChange: (n: number) => void;
  min?: number; max?: number;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-silver-200 bg-white p-3.5">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-[15px] font-semibold leading-tight text-navy-900">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{hint}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-silver-300 bg-white text-navy-800 disabled:opacity-30 hover:border-royal-400 hover:text-royal-600 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
        >
          <Minus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        </button>
        <output
          aria-live="polite"
          className="w-8 text-center font-display text-lg font-bold tabular-nums text-navy-900"
        >
          <span className="sr-only">{label}: </span>{value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-silver-300 bg-white text-navy-800 disabled:opacity-30 hover:border-royal-400 hover:text-royal-600 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/* ── Disclosure ──────────────────────────────────────────────────────────── */

/** Accessible disclosure: real button, aria-expanded, aria-controls, keyboard. */
export function QuoteDisclosure({
  summary, children, defaultOpen = false,
}: {
  summary: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();
  return (
    <div className="overflow-hidden rounded-xl border border-silver-200 bg-white">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-[14px] font-semibold text-navy-900 hover:bg-silver-50 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-royal-500"
      >
        {summary}
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-500 motion-safe:transition-transform motion-safe:duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
          strokeWidth={2.5}
        />
      </button>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
        <div className="border-t border-silver-100 px-4 py-3.5">{children}</div>
      </div>
    </div>
  );
}

/* ── Add / remove upgrade row ────────────────────────────────────────────── */

export function UpgradeRow({
  name, description, selected, onToggle,
}: {
  name: string; description?: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3.5 motion-safe:transition-colors
      ${selected ? 'border-royal-300 bg-royal-50/70' : 'border-silver-200 bg-white'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold leading-tight text-navy-900">{name}</p>
        {description && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        // "Add"/"Remove" alone is not a usable name out of context.
        aria-label={`${selected ? 'Remove' : 'Add'} ${name}`}
        className={`min-h-[40px] flex-shrink-0 rounded-full border-2 px-4 text-[13px] font-bold motion-safe:transition-colors
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500
          ${selected
            ? 'border-royal-500 bg-royal-500 text-white hover:bg-royal-600'
            : 'border-silver-300 bg-white text-navy-800 hover:border-royal-400 hover:text-royal-600'}`}
      >
        {selected ? 'Remove' : 'Add'}
      </button>
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

export function PrimaryButton({
  children, onClick, disabled, icon,
}: {
  children: ReactNode; onClick: () => void; disabled?: boolean; icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-6 text-[15px] font-bold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
    >
      {children}
      {icon}
    </button>
  );
}

export function SecondaryButton({
  children, onClick,
}: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] items-center justify-center rounded-full border border-silver-300 bg-white px-6 text-[15px] font-bold text-navy-900 hover:border-navy-400 hover:bg-silver-50 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
    >
      {children}
    </button>
  );
}
