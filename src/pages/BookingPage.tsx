import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import QuoteCalculator, { type BookingSelection } from '../components/QuoteCalculator';
import BrandLogo from '../components/BrandLogo';
import { getAttribution } from '../lib/attribution';
import { getQuoteOriginHref } from '../lib/quoteOrigin';
import { CARPET_MIN_BOOKING, DISCOUNT_MIN_NOTE } from '../data/carpetPricing';
import { TERMS_VERSION, CANCELLATION_POLICY_VERSION } from '../lib/termsVersion';
import { PARKING_ESTIMATE_P, CONGESTION_CHARGE_P, PARKING_CHARGED_AT_ACTUAL_COST_NOTE } from '../data/pricing';

const PARKING_ESTIMATE    = PARKING_ESTIMATE_P / 100;
const CONGESTION_CHARGE   = CONGESTION_CHARGE_P / 100;

type ParkingAnswer    = '' | 'yes' | 'no' | 'not_sure';
type CongestionAnswer = '' | 'no' | 'yes' | 'not_sure';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'vve_booking';

// ─── Booking-form draft ───────────────────────────────────────────────────────
// Persists contact/scheduling fields across Stripe Checkout and page refreshes.
// Cleared only after verify-payment confirms paid: true (in confirmation.html).
// Terms acceptance is intentionally excluded.

const DRAFT_KEY = 'vve_form_draft_v1';
const DRAFT_TTL = 48 * 60 * 60 * 1000; // 48 hours

function saveDraft(form: FormData): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ expires: Date.now() + DRAFT_TTL, form }));
  } catch { /* storage unavailable or full — silently ignore */ }
}

function loadDraft(): FormData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: { expires?: number; form?: FormData } = JSON.parse(raw);
    if (!parsed?.expires || Date.now() > parsed.expires) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed.form ?? null;
  } catch { return null; }
}
const BACKEND_URL  = '/api/create-checkout-session';
const WA_NUMBER    = '447845451111';
const DEPOSIT      = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number) {
  // Guard against float noise (e.g. 47.500000000001) without ever rounding a
  // genuine .50 to a whole pound — every EOT/carpet total must display the
  // exact pence value the customer is actually charged.
  const rounded = Math.round(n * 100) / 100;
  const hasPence = Math.abs(rounded % 1) > 1e-9;
  return '£' + rounded.toLocaleString('en-GB', { minimumFractionDigits: hasPence ? 2 : 0, maximumFractionDigits: 2 });
}

function validEmail(v: string)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v: string)    { return v.replace(/\D/g, '').length >= 10; }
function validPostcode(v: string) { return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(v.trim()); }

// ─── Sub-components ───────────────────────────────────────────────────────────

const BOOKING_WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20help%20with%20my%20booking.';

function BookingHeader({ isLeaflet = false }: { isLeaflet?: boolean }) {
  // Where the quote was actually built — the Carpet page, the Sofa page, the
  // homepage, /leaflet, or a service page. Falls back to the previous
  // hard-coded destination when nothing was recorded.
  const backHref = getQuoteOriginHref(isLeaflet);
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.08]"
      style={{ background: 'rgba(249,249,245,0.96)', backdropFilter: 'blur(10px)' }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Keep checkout branding in sync with the shared site wordmark. */}
        <a
          href="/"
          aria-label="VVE Clean home"
          className="flex flex-shrink-0 items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600"
        >
          <BrandLogo compact className="w-[72px] sm:w-[82px]" />

          <span
            aria-hidden="true"
            className="mx-2 hidden h-8 w-px bg-slate-300 sm:block"
          />

          <span className="hidden max-w-[72px] text-[8px] font-bold uppercase leading-[1.35] tracking-[0.08em] text-navy-700 sm:block">
            Cleaning &amp; Property Services
          </span>
        </a>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {/* Back to quote.
              Previously `hidden sm:flex`, which left phone users with no way
              back: browser-back does not set the restore flag, so it returned
              them to an empty calculator. Now shown at every width, with the
              label shortened below sm so the header row still fits. */}
          <Link to={backHref}
            onClick={() => sessionStorage.setItem('vve_restore_quote', '1')}
            aria-label="Back to quote"
            className="flex min-h-[44px] items-center gap-1 rounded-full border border-[#E3E7EE] px-2.5 py-2 text-xs font-semibold text-navy-800 transition-colors hover:border-navy-300 sm:px-3 sm:text-sm whitespace-nowrap">
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">Back to quote</span>
            <span className="sm:hidden">Quote</span>
          </Link>

          {/* Need help */}
          <a href={BOOKING_WA} target="_blank" rel="noopener noreferrer"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors btn-whatsapp sm:text-sm"
            aria-label="Need help? Chat on WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span>Need help?</span>
          </a>

          {/* Nav dropdown */}
          <details className="relative">
            <summary
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E3E7EE] text-navy-700 cursor-pointer hover:border-navy-300 transition-colors list-none"
              aria-label="Site navigation menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#E3E7EE] rounded-xl shadow-lg py-2 min-w-[150px] z-50">
              <a href="/"          className="flex min-h-[44px] items-center px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Home</a>
              <a href="/#services" className="flex min-h-[44px] items-center px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Services</a>
              <a href="/pricing"   className="flex min-h-[44px] items-center px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Pricing</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

// Two-phase progress indicator — step 1 is the quote/service selector,
// step 2 is the details, date and £30 deposit form. Rendered in both
// phases so visitors always know where they are and what comes next.
function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps: Array<{ n: 1 | 2; label: string }> = [
    { n: 1, label: 'Service & price' },
    { n: 2, label: `Details, date & £${DEPOSIT} deposit` },
  ];
  return (
    <ol aria-label="Booking progress" className="max-w-5xl mx-auto px-4 pt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs sm:text-sm">
      {steps.map((step, i) => {
        const active = step.n === current;
        const done = step.n < current;
        return (
          <li key={step.n} className="flex items-center gap-2 min-w-0" aria-current={active ? 'step' : undefined}>
            {i > 0 && <span className="w-6 sm:w-10 h-px bg-silver-300 flex-shrink-0" aria-hidden="true" />}
            <span
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full font-semibold sm:whitespace-nowrap ${
                active
                  ? 'bg-navy-900 text-white'
                  : done
                    ? 'bg-green-100 text-green-800'
                    : 'bg-silver-100 text-silver-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-white text-navy-900' : done ? 'bg-green-600 text-white' : 'bg-silver-300 text-white'
                }`}
                aria-hidden="true"
              >
                {done ? '✓' : step.n}
              </span>
              <span className="leading-tight">
                <span className="sr-only">{`Step ${step.n} of 2${active ? ', current' : done ? ', completed' : ''}: `}</span>
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ServiceCard({ selection, onChangeService }: {
  selection: BookingSelection;
  onChangeService: () => void;
}) {
  const remaining = selection.price > DEPOSIT ? selection.price - DEPOSIT : 0;
  const hasOffer  = !!selection.offerCode && (selection.discountAmount ?? 0) > 0;
  const isLeaflet = selection.offerCode === 'LEAFLET20';

  return (
    <div className="bg-white border border-[#E3E7EE] rounded-2xl shadow-sm overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#EDFCF2' }}>
            <CheckCircle2 size={18} style={{ color: '#22C55E' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold tracking-widest uppercase mb-0.5" style={{ color: '#adb5bd' }}>
              Selected service
            </div>
            <div className="text-navy-900 font-bold text-sm leading-tight truncate">{selection.serviceName}</div>
            {hasOffer && selection.standardPrice ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="line-through text-silver-400 text-sm">{money(selection.standardPrice)}</span>
                <span className="font-bold" style={{ color: '#16a34a', fontSize: '1.1rem' }}>{money(selection.price)}</span>
              </div>
            ) : (
              <div className="font-bold mt-0.5" style={{ color: '#0369a1', fontSize: '1.1rem' }}>
                {money(selection.price)}
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={onChangeService}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#0369a1] transition-colors hover:bg-[#f0f9ff]"
          style={{ color: '#0369a1' }}>
          Change service
        </button>
      </div>

      {/* Offer breakdown — only rendered when the discount genuinely reduced
          the final price (QuoteCalculator omits offerCode/discountAmount
          entirely when the £85 minimum booking charge overrode it) */}
      {hasOffer && (
        <div className="px-5 py-3 border-t border-[#E3E7EE] space-y-1" style={{ background: '#f0fdf4' }}>
          <div className="flex justify-between text-xs text-silver-600">
            <span>Service subtotal</span>
            <span className="line-through">{money(selection.standardPrice ?? selection.price)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold text-green-700">
            <span>
              {isLeaflet
                ? `Leaflet discount ${selection.discountPercent ?? 20}%`
                : 'Same-visit bundle saving'}
            </span>
            <span>−{money(selection.discountAmount ?? 0)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-navy-900 border-t border-green-200 pt-1 mt-1">
            <span>Final price</span>
            <span>{money(selection.price)}</span>
          </div>
          {isLeaflet && (
            <p className="text-[10px] text-silver-500 pt-1">{DISCOUNT_MIN_NOTE}</p>
          )}
        </div>
      )}

      {/* Minimum booking charge breakdown — shown instead of the offer
          breakdown above when the £85 floor is what actually set the price,
          so no discount is claimed that the customer didn't receive. */}
      {!hasOffer && selection.minimumApplied && (
        <div className="px-5 py-3 border-t border-[#E3E7EE] space-y-1" style={{ background: '#fffbeb' }}>
          <div className="flex justify-between text-xs text-silver-600">
            <span>Service subtotal</span>
            <span>{money(selection.subtotalBeforeMinimum ?? selection.price)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold text-amber-700">
            <span>Minimum booking charge</span>
            <span>{money(CARPET_MIN_BOOKING)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-navy-900 border-t border-amber-200 pt-1 mt-1">
            <span>Final price</span>
            <span>{money(selection.price)}</span>
          </div>
          {isLeaflet && (
            <p className="text-[10px] text-amber-700 pt-1">{DISCOUNT_MIN_NOTE}</p>
          )}
        </div>
      )}

      {remaining > 0 && (
        <div className="px-5 py-2.5 border-t border-[#E3E7EE]" style={{ background: '#F7F8FA' }}>
          <span className="text-xs text-silver-600">
            £{DEPOSIT} deposit today · <span className="font-semibold text-navy-800">{money(remaining)} remaining</span> paid on the day
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface FormData {
  fullName: string;
  address:  string;
  postcode: string;
  phone:    string;
  email:    string;
  date:     string;
  time:     string;
  message:  string;
  parkingAvailable: ParkingAnswer;
  congestionZone:   CongestionAnswer;
}

const REQUIRED_DATE_ERROR       = 'Please choose your preferred date.';
const PAST_DATE_ERROR           = 'Please choose a date that has not already passed.';
const REQUIRED_TIME_ERROR       = 'Please choose your preferred arrival window.';
const REQUIRED_PARKING_ERROR    = 'Please tell us whether free parking is available for our cleaning team.';
const REQUIRED_CONGESTION_ERROR = 'Please tell us whether the property is inside the Congestion Charge zone.';
const REQUIRED_TERMS_ERROR      = 'Please read and accept the booking and cancellation terms.';

// Surcharge for a given parking/Congestion Charge answer — £0 for the
// no-extra-cost answer, the centralised estimate otherwise (mirrors
// api/servicePrices.js's accessSurcharge, the server-side authority).
function parkingSurcharge(answer: ParkingAnswer): number {
  return answer === 'no' || answer === 'not_sure' ? PARKING_ESTIMATE : 0;
}
function congestionSurcharge(answer: CongestionAnswer): number {
  return answer === 'yes' || answer === 'not_sure' ? CONGESTION_CHARGE : 0;
}

// YYYY-MM-DD for today in the visitor's local time zone — matches the
// plain-string format <input type="date"> both stores and displays, so a
// lexicographic string comparison against it is a correct "is this in the
// past" check with no Date-object time zone handling needed.
function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

// Document order of the validated controls, used to build the error summary
// so its entries always read top-to-bottom in the order the fields appear.
//
// `target` is the id of the control a summary entry focuses, where one
// exists. The two access questions are groups of `aria-pressed` buttons with
// no single labelled control, and the entry for those falls back to the
// existing `[data-error="true"]` container — the same hook the
// scroll-to-first-invalid behaviour already uses.
// `label` is the summary's own wording — the field name, not a copy of the
// inline message. Repeating the full sentence in both places makes a screen
// reader read each problem twice and gives a sighted user two identical
// blocks of red text to compare. The summary answers "which fields?", the
// inline error answers "what exactly is wrong with this one?".
const SUMMARY_FIELDS: ReadonlyArray<{
  key: keyof FormData | 'terms';
  label: string;
  target?: string;
}> = [
  { key: 'fullName', label: 'Full name',                 target: 'booking-fullName' },
  { key: 'address',  label: 'Address',                   target: 'booking-address' },
  { key: 'postcode', label: 'Postcode',                  target: 'booking-postcode' },
  { key: 'phone',    label: 'Phone number',              target: 'booking-phone' },
  { key: 'email',    label: 'Email address',             target: 'booking-email' },
  { key: 'date',     label: 'Preferred date',            target: 'booking-date' },
  { key: 'time',     label: 'Preferred arrival window',  target: 'booking-time' },
  { key: 'parkingAvailable', label: 'Parking availability' },
  { key: 'congestionZone',   label: 'Congestion Charge zone' },
  { key: 'terms',    label: 'Booking and cancellation terms', target: 'terms-checkbox' },
];

export default function BookingPage() {
  const [selection,    setSelection]    = useState<BookingSelection | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [form,         setForm]         = useState<FormData>({
    fullName: '', address: '', postcode: '', phone: '', email: '', date: '', time: '', message: '',
    parkingAvailable: '', congestionZone: '',
  });
  const [errors,        setErrors]        = useState<FormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError,    setTermsError]    = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const formTopRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  // Only true after a blocked submit. Without this the summary would appear
  // while someone is still filling the form in, which is noisier than useful.
  const [showErrorSummary, setShowErrorSummary] = useState(false);

  // ── Restore booking-form draft on mount (before any user input) ───────────
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setForm((current) => ({
        ...current,
        ...draft,
        parkingAvailable: draft.parkingAvailable ?? '',
        congestionZone: draft.congestionZone ?? '',
      }));
    }
  }, []);

  // ── Load selection from sessionStorage or fall back to URL params ──────────
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: BookingSelection = JSON.parse(stored);
        // Discard selections that have no quoteConfig — the server rejects them.
        // This catches stale sessionStorage entries written by legacy booking.html.
        if (parsed.quoteConfig) {
          setSelection(parsed);
          return;
        }
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }

    // Legacy URL params (?service=X&price=Y) are no longer accepted because they
    // carry no quoteConfig and the server now requires one for price authority.
    // Silently discard the params so the user sees the calculator and generates
    // a valid selection with server-verifiable pricing.
    // No query values are price-authoritative. Remove all of them after the
    // legacy hand-off has been handled so stale prices, tracking parameters and
    // unsupported service names are not left in the address bar.
    if (window.location.search) window.history.replaceState({}, '', '/booking');
  }, []);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleBook = (sel: BookingSelection) => {
    setSelection(sel);
    setShowSelector(false);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeService = () => {
    setShowSelector(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setField = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = { ...form, [field]: e.target.value };
      setForm(next);
      saveDraft(next);
      setErrors(err => ({ ...err, [field]: undefined, contact: undefined }));
      setSubmitError('');
    };

  // Button-group choices (parking / congestion) aren't native form inputs,
  // so they set a value directly rather than reading e.target.value.
  const setChoice = <K extends 'parkingAvailable' | 'congestionZone'>(field: K, value: FormData[K]) => {
    const next = { ...form, [field]: value };
    setForm(next);
    saveDraft(next);
    setErrors(err => ({ ...err, [field]: undefined }));
    setSubmitError('');
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.fullName.trim())          e.fullName = 'Please enter your full name.';
    if (!form.address.trim())           e.address  = 'Please enter your address.';
    if (!validPostcode(form.postcode))  e.postcode = 'Please enter a valid UK postcode.';
    if (!form.phone.trim())            e.phone = 'Please enter a phone number so we can confirm availability.';
    else if (!validPhone(form.phone))    e.phone = 'Please enter a valid phone number.';
    if (!form.email.trim())              e.email = 'Please enter an email address for your booking confirmation.';
    else if (!validEmail(form.email))    e.email = 'Please enter a valid email address.';
    if (!form.date)                     e.date = REQUIRED_DATE_ERROR;
    else if (form.date < todayIsoDate()) e.date = PAST_DATE_ERROR;
    if (!form.time)                     e.time = REQUIRED_TIME_ERROR;
    if (!form.parkingAvailable)          e.parkingAvailable = REQUIRED_PARKING_ERROR;
    if (!form.congestionZone)            e.congestionZone = REQUIRED_CONGESTION_ERROR;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Every current error, in document order, with the control it points at.
  const errorSummaryItems = SUMMARY_FIELDS.flatMap(({ key, label, target }) => {
    const message = key === 'terms' ? termsError : errors[key as keyof FormData];
    return message ? [{ key, label, target }] : [];
  });

  // Move focus to the control a summary entry names. Anchor navigation alone
  // scrolls but does not focus a non-anchor target in every browser, and the
  // access questions have no id to link to at all, so this does both
  // explicitly rather than relying on default `href="#id"` behaviour.
  const focusSummaryTarget = (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: { key: keyof FormData | 'terms'; target?: string },
  ) => {
    event.preventDefault();

    const el = item.target
      ? document.getElementById(item.target)
      : formTopRef.current
          ?.querySelector<HTMLElement>(`[data-summary-target="${item.key}"]`)
          ?.querySelector<HTMLElement>('input, select, textarea, button');

    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldsValid = validate();
    const termsValid   = termsAccepted;
    setTermsError(termsValid ? '' : REQUIRED_TERMS_ERROR);

    if (!fieldsValid || !termsValid || !selection) {
      setShowErrorSummary(true);
      // State updates are rendered on the next frame. Move the viewport and
      // keyboard focus to the summary: it names every problem at once, and
      // its links jump to the individual controls. Focusing the summary
      // rather than the first invalid field is what lets a screen-reader user
      // hear how many errors there are before being dropped into one of them.
      requestAnimationFrame(() => {
        const summary = errorSummaryRef.current;
        if (summary) {
          summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
          summary.focus();
          return;
        }
        // Fallback if the summary is not rendered for any reason: preserve the
        // previous scroll-and-focus-first-invalid behaviour.
        const el = formTopRef.current?.querySelector<HTMLElement>('[data-error="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
      });
      return;
    }

    setShowErrorSummary(false);

    setSubmitting(true);
    setSubmitError('');

    const attribution = getAttribution();
    const payload = {
      service:     selection.serviceName,
      price:       totalWithAccessCharges,
      deposit:     DEPOSIT,
      quoteConfig: {
        ...selection.quoteConfig,
        parkingAvailable: form.parkingAvailable,
        congestionZone:   form.congestionZone,
      },
      fullName:    form.fullName.trim(),
      address:     form.address.trim(),
      postcode:    form.postcode.trim().toUpperCase(),
      phone:       form.phone.trim(),
      email:       form.email.trim(),
      date:        form.date,
      time:        form.time,
      message:     form.message.trim(),
      // Terms acceptance — recorded at the moment of submission.
      termsAccepted:             true,
      termsAcceptedAt:           new Date().toISOString(),
      termsVersion:              TERMS_VERSION,
      cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
      // Offer data (present when a discount was applied)
      ...(selection.offerCode ? {
        offer_code:                 selection.offerCode,
        discount_percent:           selection.discountPercent ?? null,
        standard_total:             selection.standardPrice ?? null,
        discount_amount:            selection.discountAmount ?? null,
        final_total_after_discount: selection.price,
      } : {}),
      // Attribution
      first_source: attribution.first_source,
      last_source:  attribution.last_source,
      landing_page: attribution.landing_page,
      utm_source:   attribution.utm_source,
      utm_medium:   attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content:  attribution.utm_content,
      gclid:        attribution.gclid,
    };

    try {
      const res  = await fetch(BACKEND_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'No checkout link returned.');
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError('Sorry, something went wrong. Please try again or message us on WhatsApp.');
      console.error(err);
    }
  };

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    selection
      ? `Hi VVE Clean, I'd like to book: ${selection.serviceName} (${money(selection.price)}).`
      : "Hi VVE Clean, I'd like to book a cleaning service."
  )}`;

  // Access charges (parking / Congestion Charge) are answered on this page,
  // after the quote calculator already produced selection.price — so the
  // displayed total and deposit/remaining split must account for them here.
  const parkingCharge    = parkingSurcharge(form.parkingAvailable);
  const congestionCharge = congestionSurcharge(form.congestionZone);
  const totalWithAccessCharges = (selection?.price ?? 0) + parkingCharge + congestionCharge;
  const remaining = totalWithAccessCharges > DEPOSIT ? totalWithAccessCharges - DEPOSIT : 0;

  // ── CSS helpers ────────────────────────────────────────────────────────────
  const inputCls = (field: keyof FormData) =>
    // 16px minimum on mobile — below this, iOS Safari auto-zooms the page on
    // focus, which is jarring mid-checkout.
    `w-full rounded-xl border-[1.5px] px-3.5 py-3 text-[16px] outline-none transition-colors font-sans ${
      errors[field]
        ? 'border-[#D14343] bg-red-50 text-navy-900'
        : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0369a1]'
    }`;

  // ─── Show quote selector (no selection yet, or user clicked Change service) ─
  if (!selection || showSelector) {
    return (
      <div className="min-h-screen" style={{ background: '#f9f9f5' }}>
        <BookingHeader isLeaflet={selection?.offerCode === 'LEAFLET20'} />
        <StepIndicator current={1} />
        <main id="main-content">
          <h1 className="sr-only">Choose a cleaning service and see your price</h1>
          {showSelector && selection && (
            <div className="max-w-5xl mx-auto px-4 pt-5 pb-1 text-center">
              <p className="text-sm text-silver-600">
                Selecting a new service will update your booking below.
              </p>
            </div>
          )}
          <QuoteCalculator onBook={handleBook} aboveFold />
        </main>
      </div>
    );
  }

  // ─── Show booking form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#f9f9f5' }}>
      <BookingHeader isLeaflet={selection?.offerCode === 'LEAFLET20'} />
      <StepIndicator current={2} />

      <main id="main-content" className="max-w-xl mx-auto px-4 py-7 pb-24" ref={formTopRef}>
        {/* Page title */}
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-navy-900 mb-1">Complete your booking request</h1>
          <p className="text-silver-600 text-sm">
            Choose your preferred date, add your details and pay the £{DEPOSIT} deposit. We will confirm
            availability separately. Your deposit comes off the final total.
          </p>
        </div>

        {/* Selected service card */}
        <ServiceCard selection={selection} onChangeService={handleChangeService} />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Error summary ──────────────────────────────────────────────────
              Rendered only after a blocked submit. It is focusable (tabIndex
              -1) and receives focus on submit, so a screen-reader user hears
              the whole list before being moved into any one field. role
              ="alert" is deliberately not used here: focusing the container
              already announces it, and an assertive live region would speak
              over the heading as focus lands. */}
          {showErrorSummary && errorSummaryItems.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              aria-labelledby="booking-error-summary-heading"
              className="rounded-2xl border-[1.5px] border-[#D14343] bg-red-50 p-4 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D14343]"
            >
              <h2
                id="booking-error-summary-heading"
                className="font-display text-base font-bold"
                style={{ color: '#8C2020' }}
              >
                {errorSummaryItems.length === 1
                  ? 'There is 1 problem with your booking request'
                  : `There are ${errorSummaryItems.length} problems with your booking request`}
              </h2>
              <ul className="mt-2 space-y-1.5">
                {errorSummaryItems.map((item) => (
                  <li key={item.key}>
                    <a
                      href={item.target ? `#${item.target}` : '#main-content'}
                      onClick={(event) => focusSummaryTarget(event, item)}
                      className="text-sm underline underline-offset-2 hover:no-underline"
                      style={{ color: '#8C2020' }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Step 1: Property details ────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-navy-900 text-sm font-semibold">Property details</span>
            </div>

            <div data-error={!!errors.fullName}>
              <label htmlFor="booking-fullName" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Full name <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input id="booking-fullName" type="text" value={form.fullName} onChange={setField('fullName')}
                placeholder="Jane Smith" autoComplete="name"
                required aria-required="true"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                className={inputCls('fullName')} />
              {errors.fullName && <p id="fullName-error" role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.fullName}</p>}
            </div>

            <div data-error={!!errors.address}>
              <label htmlFor="booking-address" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Address <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input id="booking-address" type="text" value={form.address} onChange={setField('address')}
                placeholder="12 High Street, London" autoComplete="street-address"
                required aria-required="true"
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? 'address-error' : undefined}
                className={inputCls('address')} />
              {errors.address && <p id="address-error" role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.address}</p>}
            </div>

            <div data-error={!!errors.postcode}>
              <label htmlFor="booking-postcode" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Postcode <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input id="booking-postcode" type="text" value={form.postcode} onChange={setField('postcode')}
                placeholder="E8 1AA" autoComplete="postal-code" inputMode="text"
                required aria-required="true"
                style={{ textTransform: 'uppercase' }}
                aria-invalid={!!errors.postcode}
                aria-describedby={errors.postcode ? 'postcode-error' : undefined}
                className={inputCls('postcode')} />
              {errors.postcode && <p id="postcode-error" role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.postcode}</p>}
            </div>
          </div>

          {/* ── Step 2: Contact ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-navy-900 text-sm font-semibold">Contact</span>
            </div>

            <div data-error={!!errors.phone}>
              <label htmlFor="booking-phone" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Phone number <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input id="booking-phone" type="tel" value={form.phone} onChange={setField('phone')}
                placeholder="07700 900000" autoComplete="tel" inputMode="tel"
                required aria-required="true"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
                className={inputCls('phone')} />
              {errors.phone && <p id="phone-error" role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.phone}</p>}
            </div>

            <div data-error={!!errors.email}>
              <label htmlFor="booking-email" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Email address <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input id="booking-email" type="email" value={form.email} onChange={setField('email')}
                placeholder="you@example.com" autoComplete="email" inputMode="email"
                required aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={inputCls('email')} />
              {errors.email && <p id="email-error" role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.email}</p>}
            </div>
          </div>

          {/* ── Step 3: When ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-navy-900 text-sm font-semibold">When?</span>
            </div>

            {/* Progressive disclosure: one clause of reassurance at the point
                the worry arises ("what if my date isn't free?"), with the full
                terms a click away rather than a block of text beside the
                payment button. */}
            <p className="text-silver-600 text-xs -mt-2">
              Choose your preferred date and arrival window. We will confirm availability separately.
              If we cannot offer a slot that works for you, your £30 deposit is refunded in full —{' '}
              <Link to="/terms-of-service#bookings" className="underline underline-offset-2 hover:no-underline">
                see booking terms
              </Link>
              .
            </p>

            <div data-testid="booking-schedule-fields" className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0" data-error={!!errors.date}>
                <label htmlFor="booking-date" className="block text-navy-900 font-semibold text-sm mb-1.5">
                  Preferred date <span style={{ color: '#D14343' }}>*</span>
                </label>
                <input id="booking-date" type="date" value={form.date} onChange={setField('date')}
                  min={todayIsoDate()}
                  required aria-required="true"
                  aria-invalid={!!errors.date}
                  aria-describedby={errors.date ? 'date-error' : undefined}
                  className={`block h-12 w-full min-w-0 max-w-full box-border rounded-xl border-[1.5px] px-3.5 text-[16px] outline-none transition-colors font-sans ${
                    errors.date
                      ? 'border-[#D14343] bg-red-50 text-navy-900'
                      : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0369a1]'
                  }`} />
                {errors.date && <p id="date-error" role="alert" aria-live="assertive" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.date}</p>}
              </div>
              <div className="min-w-0" data-error={!!errors.time}>
                <label htmlFor="booking-time" className="block text-navy-900 font-semibold text-sm mb-1.5">
                  Preferred arrival window <span style={{ color: '#D14343' }}>*</span>
                </label>
                <select id="booking-time" value={form.time} onChange={setField('time')}
                  required aria-required="true"
                  aria-invalid={!!errors.time}
                  aria-describedby={errors.time ? 'time-error' : undefined}
                  className={`block h-12 w-full min-w-0 max-w-full box-border rounded-xl border-[1.5px] pl-3.5 pr-10 text-[16px] outline-none transition-colors font-sans ${
                    errors.time
                      ? 'border-[#D14343] bg-red-50 text-navy-900'
                      : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0369a1]'
                  }`}>
                  <option value="">Select a window</option>
                  <option value="Morning (8am–12pm)">Morning (8am–12pm)</option>
                  <option value="Afternoon (12pm–5pm)">Afternoon (12pm–5pm)</option>
                  <option value="Flexible">Flexible</option>
                </select>
                {errors.time && <p id="time-error" role="alert" aria-live="assertive" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.time}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="booking-notes" className="block text-navy-900 font-semibold text-sm mb-1.5">
                Anything else? <span className="font-normal text-silver-500">(optional)</span>
              </label>
              <textarea id="booking-notes" value={form.message} onChange={setField('message')} rows={3}
                maxLength={500}
                placeholder="Access notes, number of rooms, pets, parking, anything we should know…"
                className="block w-full min-w-0 max-w-full box-border rounded-xl border-[1.5px] border-[#E3E7EE] bg-white px-3.5 py-3 text-[16px] text-navy-900 outline-none focus:border-[#0369a1] transition-colors font-sans resize-none" />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-silver-600">{form.message.length}/500</span>
              </div>
            </div>
          </div>

          {/* ── Step 4: Parking & Congestion Charge ─────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center">4</span>
              <span className="text-navy-900 text-sm font-semibold">Parking &amp; Congestion Charge</span>
            </div>

            <fieldset data-error={!!errors.parkingAvailable} data-summary-target="parkingAvailable">
              <legend className="block text-navy-900 font-semibold text-sm mb-1.5">
                Is free parking available for our cleaning team? <span style={{ color: '#D14343' }}>*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['yes', 'Yes'],
                  ['no', 'No'],
                  ['not_sure', 'Not sure'],
                ] as [ParkingAnswer, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setChoice('parkingAvailable', value)}
                    aria-pressed={form.parkingAvailable === value}
                    className={`min-h-[44px] py-2.5 px-3 rounded-xl border-[1.5px] text-sm font-semibold transition-colors ${
                      form.parkingAvailable === value
                        ? 'border-[#0369a1] bg-[#f0f9ff] text-[#0369a1]'
                        : 'border-[#E3E7EE] text-navy-800 hover:border-navy-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-silver-600 text-xs mt-1.5">{PARKING_CHARGED_AT_ACTUAL_COST_NOTE}</p>
              {parkingCharge > 0 && (
                <p className="text-xs font-semibold mt-1" style={{ color: '#0369a1' }}>
                  +{money(parkingCharge)} estimated parking allowance
                </p>
              )}
              {errors.parkingAvailable && <p role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.parkingAvailable}</p>}
            </fieldset>

            <fieldset data-error={!!errors.congestionZone} data-summary-target="congestionZone">
              <legend className="block text-navy-900 font-semibold text-sm mb-1.5">
                Is the property inside the Congestion Charge zone? <span style={{ color: '#D14343' }}>*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['no', 'No'],
                  ['yes', 'Yes'],
                  ['not_sure', 'Not sure'],
                ] as [CongestionAnswer, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setChoice('congestionZone', value)}
                    aria-pressed={form.congestionZone === value}
                    className={`min-h-[44px] py-2.5 px-3 rounded-xl border-[1.5px] text-sm font-semibold transition-colors ${
                      form.congestionZone === value
                        ? 'border-[#0369a1] bg-[#f0f9ff] text-[#0369a1]'
                        : 'border-[#E3E7EE] text-navy-800 hover:border-navy-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-silver-600 text-xs mt-1.5">
                This is a pass-through Congestion Charge, not a cleaning-service fee.
              </p>
              {congestionCharge > 0 && (
                <p className="text-xs font-semibold mt-1" style={{ color: '#0369a1' }}>
                  +{money(congestionCharge)} {form.congestionZone === 'not_sure' ? 'estimated pending address confirmation' : 'Congestion Charge'}
                </p>
              )}
              {errors.congestionZone && <p role="alert" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.congestionZone}</p>}
            </fieldset>

            {form.parkingAvailable && form.congestionZone && (
              <div className="rounded-xl border border-[#E3E7EE] px-3.5 py-3 space-y-1" style={{ background: '#F7F8FA' }}>
                <div className="flex justify-between text-xs text-silver-600">
                  <span>Service subtotal</span>
                  <span>{money(selection.price)}</span>
                </div>
                <div className="flex justify-between gap-3 text-xs text-navy-700">
                  <span>{parkingCharge > 0 ? 'Estimated parking allowance' : 'Free parking available'}</span>
                  <span>{parkingCharge > 0 ? `+${money(parkingCharge)}` : '£0'}</span>
                </div>
                <div className="flex justify-between gap-3 text-xs text-navy-700">
                  <span>Congestion Charge (pass-through)</span>
                  <span>{congestionCharge > 0 ? `+${money(congestionCharge)}` : '£0'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-navy-900 border-t border-[#E3E7EE] pt-1 mt-1">
                  <span>Estimated total</span>
                  <span>{money(totalWithAccessCharges)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Payment breakdown ───────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#020b24' }}>
            <div className="flex justify-between items-center px-5 py-4 gap-3">
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Today — booking request deposit
                </div>
                <div className="text-sm" style={{ color: '#fff' }}>
                  Deposit · fully deducted from your final bill
                </div>
              </div>
              <div className="font-display text-3xl font-bold text-white flex-shrink-0">£{DEPOSIT}</div>
            </div>

            {remaining > 0 && (
              <div className="flex justify-between items-center px-5 py-4 gap-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                <div>
                  <div className="text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    After your clean
                  </div>
                  <div className="text-sm" style={{ color: '#fff' }}>
                    Remaining balance · paid on the day, not now
                  </div>
                </div>
                <div className="font-display text-xl font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {money(remaining)}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-5 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.85)' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Payment handled by Stripe · VVE Clean does not store your card details
              </span>
            </div>
          </div>

          {/* ── Terms acceptance ────────────────────────────────────────────── */}
          <div data-error={!!termsError}>
            <label
              htmlFor="terms-checkbox"
              className="flex items-start gap-3 min-h-[44px] py-2 px-1 rounded-xl cursor-pointer select-none"
            >
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={termsAccepted}
                required aria-required="true"
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked) setTermsError('');
                }}
                aria-invalid={!!termsError}
                aria-describedby={termsError ? 'terms-error' : undefined}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-[1.5px] border-[#E3E7EE] text-[#0369a1] focus:ring-2 focus:ring-[#0369a1]"
              />
              <span className="text-navy-800 text-sm leading-relaxed">
                I agree to the{' '}
                <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#0369a1] hover:underline">
                  Terms of Service
                </Link>{' '}
                and cancellation policy. I understand that the £{DEPOSIT} deposit is deducted from the final
                total and may be retained for late cancellation or failed access as explained in the terms.
                {' '}(<Link to="/privacy-policy" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#0369a1] hover:underline">
                  Privacy Policy
                </Link>)
              </span>
            </label>
            {termsError && (
              <p id="terms-error" role="alert" className="text-xs mt-1 px-1" style={{ color: '#D14343' }}>
                {termsError}
              </p>
            )}
          </div>

          {/* ── Submit error ────────────────────────────────────────────────── */}
          {submitError && (
            <div className="rounded-xl px-4 py-3 text-sm border"
              style={{ background: '#FCEDED', borderColor: '#F3C9C9', color: '#D14343' }}>
              {submitError}
            </div>
          )}

          {/* ── Submit button ───────────────────────────────────────────────── */}
          <button type="submit" disabled={submitting}
            className="w-full py-4 min-h-[44px] rounded-full font-bold text-white text-base transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]"
            style={{ backgroundColor: '#0369a1' }}>
            {submitting ? (
              'Taking you to secure payment…'
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Pay £{DEPOSIT} deposit
              </>
            )}
          </button>

          {/* ── WhatsApp alternative ────────────────────────────────────────── */}
          <p className="text-center text-sm text-silver-600">
            Prefer to book by message?{' '}
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="font-semibold hover:underline" style={{ color: '#16a34a' }}>
              WhatsApp us →
            </a>
          </p>
        </form>
      </main>

      {/* Footer */}
      <footer style={{ background: '#020b24', borderTop: '1px solid rgba(255,255,255,0.05)' }}
        className="py-8 px-6">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-4 text-center">
          <div>
            <div className="font-display font-bold text-2xl tracking-widest text-white">
              V<span style={{ color: '#b8960c' }}>V</span>E
            </div>
            <div className="text-[9px] tracking-[0.25em] font-semibold uppercase mt-0.5"
              style={{ color: 'rgba(255,255,255,0.65)' }}>CLEAN</div>
          </div>
          <nav className="flex gap-4 flex-wrap justify-center">
            {[['/', 'Home'], ['/pricing', 'Pricing'], ['/commercial', 'Commercial'], ['/#contact', 'Contact']].map(([href, label]) => (
              <a key={href} href={href}
                className="text-xs transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}>
                {label}
              </a>
            ))}
          </nav>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            © {new Date().getFullYear()} VVE Limited trading as VVE Clean. Registered in England and Wales. Company No. 17234391.
          </p>
        </div>
      </footer>
    </div>
  );
}
