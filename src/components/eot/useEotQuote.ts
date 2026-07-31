// Shared headless state + hand-off for every End of Tenancy quote UI.
//
// Both design concepts (progressive page and guided wizard) use this hook, so
// they are guaranteed to price identically and to hand the booking flow an
// identical BookingSelection. Only presentation differs between them.

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeEotQuote,
  EOT_TAILORED_SIZE,
  type AccessAnswer,
  type EotPropertyType,
  type EotQuoteResult,
  type EotSizeKey,
} from '../../lib/eotPricing';
import { trackBookingInitiated } from '../../lib/analytics';
// Type-only import: erased at compile time, so this adds no runtime dependency
// on the legacy calculator. It keeps the hand-off shape provably in sync with
// what BookingPage already consumes.
import type { BookingSelection } from '../QuoteCalculator';

type QuoteConfig = NonNullable<BookingSelection['quoteConfig']>;

const BOOKING_SERVICE_NAME = 'End of Tenancy Cleaning';

export interface EotQuoteState {
  propertyType: EotPropertyType;
  size: EotSizeKey | null;
  bathrooms: number;
  counts: Record<string, number>;
  carpetWholeHome: boolean;
  scopeExclusions: string[];
  parkingAvailable: AccessAnswer;
  congestionZone: AccessAnswer;
}

const INITIAL: EotQuoteState = {
  propertyType: 'flat',
  size: null,
  bathrooms: 1,
  counts: {},
  carpetWholeHome: false,
  scopeExclusions: [],
  parkingAvailable: '',
  congestionZone: '',
};

export function useEotQuote() {
  const navigate = useNavigate();
  const [state, setState] = useState<EotQuoteState>(INITIAL);

  const setField = useCallback(
    <K extends keyof EotQuoteState>(key: K, value: EotQuoteState[K]) =>
      setState((s) => ({ ...s, [key]: value })),
    [],
  );

  const setCount = useCallback((key: string, qty: number) => {
    setState((s) => ({ ...s, counts: { ...s.counts, [key]: Math.max(0, qty) } }));
  }, []);

  const toggleScope = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      scopeExclusions: s.scopeExclusions.includes(key)
        ? s.scopeExclusions.filter((k) => k !== key)
        : [...s.scopeExclusions, key],
    }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  // Nothing is priced until a size is chosen — that is the whole point of the
  // redesign, so the "no size yet" state is explicit rather than a fake £0.
  const result: EotQuoteResult | null = useMemo(() => {
    if (!state.size) return null;
    return computeEotQuote({
      propertyType: state.propertyType,
      size: state.size,
      bathrooms: state.bathrooms,
      counts: state.counts,
      carpetWholeHome: state.carpetWholeHome,
      scopeExclusions: state.scopeExclusions,
      parkingAvailable: state.parkingAvailable,
      congestionZone: state.congestionZone,
    });
  }, [state]);

  const isTailored = state.size === EOT_TAILORED_SIZE;
  const hasAccessAnswers = state.parkingAvailable !== '' && state.congestionZone !== '';
  const canBook = Boolean(result) && !isTailored && hasAccessAnswers;

  /**
   * Hands off to /booking exactly as the legacy calculator does.
   *
   * `price` deliberately EXCLUDES parking and Congestion Charge: BookingPage
   * adds those once from its own required questions, and the server recomputes
   * from quoteConfig. Including them here would double-charge the customer.
   */
  const bookNow = useCallback(() => {
    if (!result || isTailored) return;

    const hasScopeCredit = result.scopeCreditPence > 0;
    const selection: BookingSelection = {
      serviceName: BOOKING_SERVICE_NAME,
      price: Math.round(result.totalPence / 100),
      ...(hasScopeCredit
        ? {
            offerCode: 'EOT_SCOPE',
            standardPrice: Math.round(result.standardPence / 100),
            discountAmount: Math.round(result.scopeCreditPence / 100),
            discountPercent:
              Math.round((result.scopeCreditPence / result.standardPence) * 1000) / 10,
          }
        : {}),
      quoteConfig: {
        service: 'deep' as QuoteConfig['service'],
        deepService: 'end_of_tenancy' as QuoteConfig['deepService'],
        // Narrowed by the isTailored guard above: bed5 never reaches booking.
        deepSize: state.size as QuoteConfig['deepSize'],
        deepBaths: state.bathrooms,
        addOnCounts: {
          ...state.counts,
          ...(state.carpetWholeHome ? { carpet_bundle: 1 } : {}),
        },
        windowSize: 'small',
        gutterType: 'terraced',
        officeHours: 3,
        propertyType: state.propertyType,
        eotScopeExclusions: state.scopeExclusions,
      },
    } as BookingSelection;

    trackBookingInitiated(BOOKING_SERVICE_NAME);
    sessionStorage.setItem('vve_booking', JSON.stringify(selection));
    navigate('/booking');
  }, [result, isTailored, state, navigate]);

  return {
    state, setField, setCount, toggleScope, reset,
    result, isTailored, hasAccessAnswers, canBook, bookNow,
  };
}
