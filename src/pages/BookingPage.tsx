import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import QuoteCalculator, { type BookingSelection } from '../components/QuoteCalculator';
import { getAttribution } from '../lib/attribution';
import { CARPET_MIN_BOOKING, DISCOUNT_MIN_NOTE } from '../data/carpetPricing';
import { TERMS_VERSION, CANCELLATION_POLICY_VERSION } from '../lib/termsVersion';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'vve_booking';
const BACKEND_URL  = '/api/create-checkout-session';
const WA_NUMBER    = '447845451111';
const DEPOSIT      = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number) {
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function validEmail(v: string)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v: string)    { return v.replace(/\D/g, '').length >= 10; }
function validPostcode(v: string) { return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(v.trim()); }

// ─── Sub-components ───────────────────────────────────────────────────────────

const BOOKING_WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20help%20with%20my%20booking.';

function BookingHeader({ isLeaflet = false }: { isLeaflet?: boolean }) {
  const backHref = isLeaflet ? '/leaflet#quote' : '/#quote';
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.08]"
      style={{ background: 'rgba(249,249,245,0.96)', backdropFilter: 'blur(10px)' }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Logo */}
        <a href="/" className="flex flex-col leading-none gap-0.5 flex-shrink-0">
          <span className="font-display font-bold text-2xl tracking-widest" style={{ color: '#1c1917' }}>
            V<span style={{ color: '#b8960c' }}>V</span>E
          </span>
          <span className="flex items-center gap-1">
            <span className="block h-px w-3" style={{ background: '#b8960c' }} />
            <span className="text-[8px] tracking-[0.25em] font-semibold uppercase" style={{ color: '#1c1917' }}>CLEAN</span>
            <span className="block h-px w-3" style={{ background: '#b8960c' }} />
          </span>
        </a>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {/* Back to quote — destination depends on whether this is a leaflet booking */}
          <a href={backHref}
            onClick={() => sessionStorage.setItem('vve_restore_quote', '1')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-full border border-[#E3E7EE] text-navy-800 hover:border-navy-300 transition-colors min-h-[36px]">
            ← Back to quote
          </a>

          {/* Need help */}
          <a href={BOOKING_WA} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs sm:text-sm px-3 py-2 rounded-full transition-colors min-h-[36px]"
            aria-label="Need help? Chat on WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span>Need help?</span>
          </a>

          {/* Nav dropdown */}
          <details className="relative">
            <summary
              className="flex items-center justify-center w-9 h-9 rounded-full border border-[#E3E7EE] text-navy-700 cursor-pointer hover:border-navy-300 transition-colors list-none"
              aria-label="Site navigation menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#E3E7EE] rounded-xl shadow-lg py-2 min-w-[150px] z-50">
              <a href="/"          className="block px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Home</a>
              <a href="/#services" className="block px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Services</a>
              <a href="/pricing"   className="block px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors">Pricing</a>
            </div>
          </details>
        </div>
      </div>
    </header>
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
              <div className="font-bold mt-0.5" style={{ color: '#0ea5e9', fontSize: '1.1rem' }}>
                {money(selection.price)}
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={onChangeService}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#0ea5e9] transition-colors hover:bg-[#f0f9ff]"
          style={{ color: '#0ea5e9' }}>
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
                : `Bundle saving ${selection.discountPercent ?? 0}%`}
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
}

const REQUIRED_DATE_ERROR  = 'Please choose your preferred date.';
const REQUIRED_TIME_ERROR  = 'Please choose your preferred arrival window.';
const REQUIRED_TERMS_ERROR = 'Please read and accept the booking and cancellation terms.';

type FormErrors = Partial<Record<keyof FormData | 'contact', string>>;

export default function BookingPage() {
  const [selection,    setSelection]    = useState<BookingSelection | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [form,         setForm]         = useState<FormData>({
    fullName: '', address: '', postcode: '', phone: '', email: '', date: '', time: '', message: '',
  });
  const [errors,        setErrors]        = useState<FormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError,    setTermsError]    = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const formTopRef = useRef<HTMLDivElement>(null);

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
    const params = new URLSearchParams(window.location.search);
    if (params.get('service')) {
      window.history.replaceState({}, '', '/booking');
    }
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
      setForm(f => ({ ...f, [field]: e.target.value }));
      setErrors(err => ({ ...err, [field]: undefined, contact: undefined }));
      setSubmitError('');
    };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.fullName.trim())          e.fullName = 'Please enter your full name.';
    if (!form.address.trim())           e.address  = 'Please enter your address.';
    if (!validPostcode(form.postcode))  e.postcode = 'Please enter a valid UK postcode.';
    const noContact = !form.phone.trim() && !form.email.trim();
    if (noContact)                      e.contact  = 'Please provide a phone number or email address.';
    if (form.phone && !validPhone(form.phone))   e.phone = 'Please enter a valid phone number.';
    if (form.email && !validEmail(form.email))   e.email = 'Please enter a valid email address.';
    if (!form.date)                     e.date = REQUIRED_DATE_ERROR;
    if (!form.time)                     e.time = REQUIRED_TIME_ERROR;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldsValid = validate();
    const termsValid   = termsAccepted;
    setTermsError(termsValid ? '' : REQUIRED_TERMS_ERROR);

    if (!fieldsValid || !termsValid || !selection) {
      // Scroll to first error
      const el = formTopRef.current?.querySelector('[data-error="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const attribution = getAttribution();
    const payload = {
      service:     selection.serviceName,
      price:       selection.price,
      deposit:     DEPOSIT,
      quoteConfig: selection.quoteConfig,
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

  const remaining = selection && selection.price > DEPOSIT ? selection.price - DEPOSIT : 0;

  // ── CSS helpers ────────────────────────────────────────────────────────────
  const inputCls = (field: keyof FormData) =>
    `w-full rounded-xl border-[1.5px] px-3.5 py-3 text-[15px] outline-none transition-colors font-sans ${
      errors[field]
        ? 'border-[#D14343] bg-red-50 text-navy-900'
        : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0ea5e9]'
    }`;

  // ─── Show quote selector (no selection yet, or user clicked Change service) ─
  if (!selection || showSelector) {
    return (
      <div className="min-h-screen" style={{ background: '#f9f9f5' }}>
        <BookingHeader isLeaflet={selection?.offerCode === 'LEAFLET20'} />
        {showSelector && selection && (
          <div className="max-w-5xl mx-auto px-4 pt-5 pb-1 text-center">
            <p className="text-sm text-silver-600">
              Selecting a new service will update your booking below.
            </p>
          </div>
        )}
        <QuoteCalculator onBook={handleBook} />
      </div>
    );
  }

  // ─── Show booking form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#f9f9f5' }}>
      <BookingHeader isLeaflet={selection?.offerCode === 'LEAFLET20'} />

      <main className="max-w-xl mx-auto px-4 py-7 pb-24" ref={formTopRef}>
        {/* Page title */}
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-navy-900 mb-1">Complete your booking request</h1>
          <p className="text-silver-600 text-sm">
            Choose your preferred date, add your details and pay the £{DEPOSIT} deposit. We will confirm
            availability within one business hour. Your deposit comes off the final total.
          </p>
        </div>

        {/* Selected service card */}
        <ServiceCard selection={selection} onChangeService={handleChangeService} />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Step 1: Property details ────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0ea5e9] text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-navy-900 text-sm font-semibold">Property details</span>
            </div>

            <div data-error={!!errors.fullName}>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">
                Full name <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input type="text" value={form.fullName} onChange={setField('fullName')}
                placeholder="Jane Smith" autoComplete="name"
                className={inputCls('fullName')} />
              {errors.fullName && <p className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.fullName}</p>}
            </div>

            <div data-error={!!errors.address}>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">
                Address <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input type="text" value={form.address} onChange={setField('address')}
                placeholder="12 High Street, London" autoComplete="street-address"
                className={inputCls('address')} />
              {errors.address && <p className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.address}</p>}
            </div>

            <div data-error={!!errors.postcode}>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">
                Postcode <span style={{ color: '#D14343' }}>*</span>
              </label>
              <input type="text" value={form.postcode} onChange={setField('postcode')}
                placeholder="E8 1AA" autoComplete="postal-code" inputMode="text"
                style={{ textTransform: 'uppercase' }}
                className={inputCls('postcode')} />
              {errors.postcode && <p className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.postcode}</p>}
            </div>
          </div>

          {/* ── Step 2: Contact ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0ea5e9] text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-navy-900 text-sm font-semibold">Contact</span>
            </div>

            {errors.contact && (
              <div className="rounded-xl px-3.5 py-2.5 text-sm border"
                style={{ background: '#EBF5FE', borderColor: '#BDE0FB', color: '#1e4d7b' }}>
                {errors.contact}
              </div>
            )}

            <div data-error={!!errors.phone}>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">Phone number</label>
              <input type="tel" value={form.phone} onChange={setField('phone')}
                placeholder="07700 900000" autoComplete="tel" inputMode="tel"
                className={inputCls('phone')} />
              {errors.phone && <p className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.phone}</p>}
            </div>

            <div data-error={!!errors.email}>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">Email address</label>
              <input type="email" value={form.email} onChange={setField('email')}
                placeholder="you@example.com" autoComplete="email" inputMode="email"
                className={inputCls('email')} />
              {errors.email && <p className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.email}</p>}
            </div>
          </div>

          {/* ── Step 3: When ────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E3E7EE] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0ea5e9] text-white text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-navy-900 text-sm font-semibold">When?</span>
            </div>

            <p className="text-silver-600 text-xs -mt-2">
              Choose your preferred date and arrival window. We will confirm availability within one business hour.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div data-error={!!errors.date}>
                <label htmlFor="booking-date" className="block text-navy-900 font-semibold text-sm mb-1.5">
                  Preferred date <span style={{ color: '#D14343' }}>*</span>
                </label>
                <input id="booking-date" type="date" value={form.date} onChange={setField('date')}
                  aria-invalid={!!errors.date}
                  aria-describedby={errors.date ? 'date-error' : undefined}
                  className={`w-full rounded-xl border-[1.5px] px-3.5 py-3 text-[15px] outline-none transition-colors font-sans ${
                    errors.date
                      ? 'border-[#D14343] bg-red-50 text-navy-900'
                      : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0ea5e9]'
                  }`} />
                {errors.date && <p id="date-error" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.date}</p>}
              </div>
              <div data-error={!!errors.time}>
                <label htmlFor="booking-time" className="block text-navy-900 font-semibold text-sm mb-1.5">
                  Preferred arrival window <span style={{ color: '#D14343' }}>*</span>
                </label>
                <select id="booking-time" value={form.time} onChange={setField('time')}
                  aria-invalid={!!errors.time}
                  aria-describedby={errors.time ? 'time-error' : undefined}
                  className={`w-full rounded-xl border-[1.5px] px-3.5 py-3 text-[15px] outline-none transition-colors font-sans ${
                    errors.time
                      ? 'border-[#D14343] bg-red-50 text-navy-900'
                      : 'border-[#E3E7EE] bg-white text-navy-900 focus:border-[#0ea5e9]'
                  }`}>
                  <option value="">Select a window</option>
                  <option value="Morning (8am–12pm)">Morning (8am–12pm)</option>
                  <option value="Afternoon (12pm–5pm)">Afternoon (12pm–5pm)</option>
                  <option value="Flexible">Flexible</option>
                </select>
                {errors.time && <p id="time-error" className="text-xs mt-1" style={{ color: '#D14343' }}>{errors.time}</p>}
              </div>
            </div>

            <div>
              <label className="block text-navy-900 font-semibold text-sm mb-1.5">
                Anything else? <span className="font-normal text-silver-500">(optional)</span>
              </label>
              <textarea value={form.message} onChange={setField('message')} rows={3}
                placeholder="Access notes, number of rooms, pets, parking, anything we should know…"
                className="w-full rounded-xl border-[1.5px] border-[#E3E7EE] bg-white px-3.5 py-3 text-[15px] text-navy-900 outline-none focus:border-[#0ea5e9] transition-colors font-sans resize-none" />
            </div>
          </div>

          {/* ── Payment breakdown ───────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#020b24' }}>
            <div className="flex justify-between items-center px-5 py-4 gap-3">
              <div>
                <div className="text-[9px] font-bold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
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
                  <div className="text-[9px] font-bold tracking-widest uppercase mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
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
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Secured by Stripe · Bank-level encryption · We never store card details
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
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked) setTermsError('');
                }}
                aria-invalid={!!termsError}
                aria-describedby={termsError ? 'terms-error' : undefined}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-[1.5px] border-[#E3E7EE] text-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]"
              />
              <span className="text-navy-800 text-sm leading-relaxed">
                I agree to the{' '}
                <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#0ea5e9] hover:underline">
                  Terms of Service
                </Link>{' '}
                and cancellation policy. I understand that the £{DEPOSIT} deposit is deducted from the final
                total and may be retained for late cancellation or failed access as explained in the terms.
                {' '}(<Link to="/privacy-policy" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#0ea5e9] hover:underline">
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
            className="w-full py-4 rounded-full font-bold text-white text-base transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#0ea5e9' }}>
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
            © 2026 VVE Clean Ltd. All rights reserved. Registered in England &amp; Wales.
          </p>
        </div>
      </footer>
    </div>
  );
}
