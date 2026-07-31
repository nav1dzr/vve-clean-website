// The single authoritative price surface for the End of Tenancy quote.
//
// There is exactly one of these on screen at any time — on desktop it is the
// sticky side card, on mobile it is the bottom sheet. That is the core fix for
// the audit finding that the old quote showed two competing totals and two
// competing booking CTAs.

import { displayPence, type EotQuoteResult } from '../../lib/eotPricing';
import { LivePrice } from './QuotePrimitives';

export const WA_BASE = 'https://wa.me/447845451111';

export const EOT_INCLUDED_ITEMS = [
  'Oven, hob, grill and extractor',
  'Inside emptied fridge and defrosted freezer',
  'Dishwasher and washing-machine accessible compartments',
  'Cupboards, drawers and wardrobes inside and outside',
  'Internal windows, frames and sills',
  'Kitchen and bathroom descaling',
  'Skirting, doors, handles, switches and sockets',
  'Vacuuming, mopping, products and equipment',
] as const;

export const DEPOSIT_REASSURANCE =
  '£30 secures your preferred date and is included in your total';

function Line({ label, value, tone = 'default', qty }: {
  label: string; value: string; tone?: 'default' | 'credit' | 'muted'; qty?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={tone === 'muted' ? 'text-silver-400' : 'text-silver-300'}>
        {label}{qty && qty > 1 ? ` ×${qty}` : ''}
      </span>
      <span className={`flex-shrink-0 font-semibold tabular-nums ${
        tone === 'credit' ? 'text-emerald-300' : 'text-white'
      }`}>
        {value}
      </span>
    </div>
  );
}

export interface QuoteSummaryProps {
  result: EotQuoteResult | null;
  /** True once every required question is answered. */
  canBook: boolean;
  onBook: () => void;
  /** Shown when the customer has not chosen a property size yet. */
  emptyHint?: string;
  /** Why the CTA is not yet available — shown inline, never as a dead button. */
  blockedReason?: string;
  variant?: 'card' | 'sheet';
}

export function QuoteSummary({
  result, canBook, onBook, emptyHint, blockedReason, variant = 'card',
}: QuoteSummaryProps) {
  /* Empty / default state — never a fake £0. */
  if (!result) {
    return (
      <div className="navy-gradient rounded-2xl p-6 text-center">
        <p className="font-display text-lg font-bold text-white">Your price appears here</p>
        <p className="mt-1.5 text-sm leading-snug text-silver-300">
          {emptyHint ?? 'Choose your property type and size to see a complete fixed price straight away.'}
        </p>
      </div>
    );
  }

  /* 5+ bedrooms — tailored quote, never a fixed online total. */
  if (result.isTailored) {
    return (
      <div className="navy-gradient rounded-2xl p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-silver-400">Tailored quote</p>
        <p className="mt-1 font-display text-2xl font-bold text-white">5+ bedrooms</p>
        <p className="mt-2 text-sm leading-snug text-silver-300">
          Properties this size vary too much for a fixed online price. Send us the room count and
          access details and we will agree a written price before any work starts.
        </p>
        <a
          href={`${WA_BASE}?text=${encodeURIComponent(
            "Hello VVE Clean, I'd like a tailored quote for an end of tenancy clean at a 5+ bedroom property.\nMy postcode is: ",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-full bg-white px-5 font-bold text-navy-900 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Request my tailored quote
        </a>
      </div>
    );
  }

  const hasBreakdown =
    result.adjustmentLines.length > 0 ||
    result.optionalLines.length > 0 ||
    result.creditLines.length > 0 ||
    result.accessLines.length > 0;

  return (
    <div className={`navy-gradient text-white ${variant === 'sheet' ? 'rounded-t-2xl p-5' : 'rounded-2xl p-6'}`}>
      <p className="text-xs font-medium uppercase tracking-widest text-silver-400">Your price</p>

      {result.scopeCreditPence > 0 && (
        <span className="block text-base text-silver-400 line-through">
          {displayPence(result.standardPence)}
        </span>
      )}

      <LivePrice pence={result.totalWithAccessPence} size={variant === 'sheet' ? 'lg' : 'xl'} />

      <p className="mt-0.5 text-xs text-silver-400">
        Complete fixed package{result.accessChargesPence > 0 ? ', including access charges' : ''}
      </p>

      {hasBreakdown && (
        <div className="mt-4 space-y-1.5 border-t border-white/15 pt-4">
          <Line label={result.baseLine.label} value={displayPence(result.baseLine.pence)} />
          {result.adjustmentLines.map((l) => (
            <Line key={l.key} label={l.label} qty={l.qty} value={`+${displayPence(l.pence)}`} />
          ))}
          {result.optionalLines.map((l) => (
            <Line key={l.key} label={l.label} qty={l.qty} value={`+${displayPence(l.pence)}`} />
          ))}
          {result.creditLines.map((l) => (
            <Line key={l.key} label={l.label} value={`−${displayPence(Math.abs(l.pence))}`} tone="credit" />
          ))}
          {result.accessLines.map((l) => (
            <Line key={l.key} label={l.label} value={`+${displayPence(l.pence)}`} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-1.5 border-t border-white/15 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-base font-bold text-white">Total</span>
          <span className="font-display text-xl font-bold tabular-nums text-white">
            {displayPence(result.totalWithAccessPence)}
          </span>
        </div>
        <Line label="£30 deposit today" value={displayPence(result.depositPence)} />
        <Line label="Balance after your clean" value={displayPence(result.balancePence)} tone="muted" />
      </div>

      <button
        type="button"
        onClick={onBook}
        disabled={!canBook}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-royal-500 px-5 font-bold text-white hover:bg-royal-600 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-silver-400 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-300"
      >
        Book online — pay {displayPence(result.depositPence)} deposit
      </button>

      <p className={`mt-2 text-center text-xs leading-snug ${canBook ? 'text-silver-400' : 'text-amber-200'}`}>
        {canBook ? DEPOSIT_REASSURANCE : (blockedReason ?? DEPOSIT_REASSURANCE)}
      </p>

      {/* WhatsApp is deliberately secondary: a quiet text link, never a button
          competing with the deposit CTA. */}
      <p className="mt-3 text-center">
        <a
          href={`${WA_BASE}?text=${encodeURIComponent(
            "Hello VVE Clean, I have a question about my end of tenancy quote.\nMy postcode is: ",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-silver-300 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Questions? Message us on WhatsApp
        </a>
      </p>
    </div>
  );
}
