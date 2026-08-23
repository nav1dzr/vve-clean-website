import { useId, useRef, useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileActionDock from '../components/MobileActionDock';
import { trackPhoneClick, trackWhatsAppClick, trackContactFormSubmitted } from '../lib/analytics';
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  CONTACT_EMAIL,
  CONTACT_ADDRESS_LINE1,
  CONTACT_ADDRESS_LINE2,
  CONTACT_ADDRESS_LABEL,
  CONTACT_ADDRESS_NOTE,
  CONTACT_HOURS,
  WA_NUMBER_DISPLAY,
  WA_BASE,
} from '../data/contactDetails';
import { usePageMeta } from '../hooks/usePageMeta';

// Built from the shared address constants (not hand-duplicated) so this
// never drifts from what the page itself renders. Keep the literal string
// here in sync with the /contact description in prerender.mjs — that script
// runs as plain Node and cannot import this TSX module.
const CONTACT_META_DESCRIPTION =
  `Registered office: ${CONTACT_ADDRESS_LINE1}, ${CONTACT_ADDRESS_LINE2}. ${CONTACT_ADDRESS_NOTE}`;

const WA_TEXT = "Hi VVE Clean, I'd like to get a quote.";
const WA_LINK = `${WA_BASE}?text=${encodeURIComponent(WA_TEXT)}`;

const SERVICE_OPTIONS = [
  'End of Tenancy Cleaning',
  'Carpet Cleaning',
  'Sofa & Upholstery Cleaning',
  'After Builders Cleaning',
  'Commercial Cleaning',
  'Something else',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = 'name' | 'email' | 'phone' | 'service' | 'message';
// Order matters — this is the order fields appear in the DOM, so the first
// key with an error is also the first invalid field to focus.
const FIELD_ORDER: FieldName[] = ['name', 'email', 'phone', 'service', 'message'];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact VVE Clean',
  url: 'https://www.vveclean.co.uk/contact',
  mainEntity: {
    '@type': 'Organization',
    name: 'VVE Clean',
    url: 'https://www.vveclean.co.uk',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+44-20-8050-2233',
      email: CONTACT_EMAIL,
      contactType: 'customer service',
      areaServed: 'GB',
    },
  },
};

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size, height: size }} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function ContactPage() {
  usePageMeta(
    'Contact Us | VVE Clean London',
    CONTACT_META_DESCRIPTION,
    '/contact',
  );

  const errorSummaryId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();
  const phoneErrorId = useId();
  const serviceErrorId = useId();
  const messageErrorId = useId();

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Not a Record<FieldName, RefObject<...>> — RefObject is invariant in its
  // element type, so a single map couldn't hold input/select/textarea refs
  // without widening every ref's type. A focus-by-name function sidesteps
  // that entirely.
  const focusField = (field: FieldName) => {
    if (field === 'name') nameRef.current?.focus();
    else if (field === 'email') emailRef.current?.focus();
    else if (field === 'phone') phoneRef.current?.focus();
    else if (field === 'service') serviceRef.current?.focus();
    else messageRef.current?.focus();
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState('');

  const validate = (): Partial<Record<FieldName, string>> => {
    const errors: Partial<Record<FieldName, string>> = {};
    if (!name.trim()) errors.name = 'Enter your full name.';
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!phone.trim()) errors.phone = 'Enter a phone number.';
    if (!service) errors.service = 'Select a service.';
    if (!message.trim()) errors.message = 'Enter a message.';
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // bot filled the hidden field — silently drop

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please fix the highlighted fields.');
      const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
      if (firstInvalid) focusField(firstInvalid);
      return;
    }

    setFieldErrors({});
    setFormError('');
    setLoading(true);

    // The shared /api/contact endpoint only has a free-text `message` field —
    // the Service selection is prefixed onto it here rather than adding a new
    // field to that endpoint's contract (also used by the homepage contact
    // form, Google Sheets, Telegram and email templates).
    const composedMessage = `Service requested: ${service}\n\n${message.trim()}`;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName:       name,
          email,
          phone,
          message:        composedMessage,
          marketingOptIn: false,
          sourcePage:     '/contact',
          _honeypot:      honeypot,
        }),
      });

      setLoading(false);

      if (res.ok) {
        setName('');
        setEmail('');
        setPhone('');
        setService('');
        setMessage('');
        trackContactFormSubmitted();
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError((data as { error?: string })?.error ?? 'Sorry, something went wrong. Please try again or contact us on WhatsApp.');
      }
    } catch {
      setLoading(false);
      setFormError('Sorry, something went wrong. Please try again or contact us on WhatsApp.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] mobile-page-bottom lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <Navbar />
      <main id="main-content">

      {/* Hero */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Get in Touch</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Contact VVE Clean
          </h1>
          <p className="text-silver-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Call, WhatsApp, email or send a message below.
          </p>
        </div>
      </div>

      {/* Contact panel */}
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid lg:grid-cols-5 gap-0 rounded-2xl overflow-hidden shadow-xl">
          {/* Info panel */}
          <div className="lg:col-span-2 navy-gradient p-8 flex flex-col">
            <h2 className="font-display text-2xl font-bold text-white mb-2">Talk to us directly</h2>
            <p className="text-silver-300 text-sm mb-8 leading-relaxed">
              Prefer not to fill in a form? Reach us any of these ways.
            </p>

            <div className="space-y-5">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="glass-card rounded-lg p-2 flex-shrink-0">
                  <Phone className="text-royal-400" size={16} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-silver-300 text-xs mb-0.5">Phone</div>
                  <a href={CONTACT_PHONE_TEL} onClick={() => trackPhoneClick('contact_page')} className="text-white font-semibold hover:text-silver-200 transition-colors block">
                    {CONTACT_PHONE_DISPLAY}
                  </a>
                </div>
              </div>

              {/* WhatsApp */}
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('contact_page')}
                className="inline-flex items-center gap-2 btn-whatsapp text-sm font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 w-full justify-center"
              >
                <WhatsAppIcon size={15} />
                Open WhatsApp Chat · {WA_NUMBER_DISPLAY}
              </a>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="glass-card rounded-lg p-2 flex-shrink-0">
                  <Mail className="text-royal-400" size={16} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-silver-300 text-xs mb-0.5">Email</div>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-white font-semibold hover:text-silver-200 transition-colors">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-4">
                <div className="glass-card rounded-lg p-2 flex-shrink-0">
                  <MapPin className="text-royal-400" size={16} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-silver-300 text-xs mb-0.5">Address</div>
                  <span className="text-white font-semibold text-sm block">{CONTACT_ADDRESS_LINE1}</span>
                  <span className="text-silver-400 text-xs block">{CONTACT_ADDRESS_LINE2}</span>
                  <p className="text-silver-400 text-xs leading-snug mt-1">
                    <span className="font-medium text-silver-300">{CONTACT_ADDRESS_LABEL}.</span> {CONTACT_ADDRESS_NOTE}
                  </p>
                </div>
              </div>

              {/* Hours */}
              <div className="flex items-start gap-4">
                <div className="glass-card rounded-lg p-2 flex-shrink-0">
                  <Clock className="text-royal-400" size={16} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-silver-300 text-xs mb-0.5">Hours</div>
                  <div className="text-white font-semibold text-sm">{CONTACT_HOURS}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="lg:col-span-3 bg-white p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <CheckCircle2 className="text-green-500 mb-4" size={56} aria-hidden="true" />
                <h2 className="text-2xl font-bold text-navy-900 mb-2">Message sent</h2>
                <p className="text-silver-600">
                  Thank you — we've received your message and will get back to you.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <p className="text-silver-500 text-xs">Fields marked * are required.</p>

                {/* Honeypot — hidden from humans, filled by bots */}
                <input
                  type="text"
                  name="_honeypot"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                />

                {/* Form-level summary — announced once on submit failure. */}
                <p
                  id={errorSummaryId}
                  role="alert"
                  aria-live="assertive"
                  className={formError ? 'text-red-500 text-sm font-semibold' : 'sr-only'}
                >
                  {formError}
                </p>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-page-name" className="block text-navy-900 font-semibold text-sm mb-1.5">
                      Full name <span aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <input
                      ref={nameRef}
                      id="contact-page-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Smith"
                      className={`w-full border-2 rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors min-h-[44px] ${fieldErrors.name ? 'border-red-400 focus:border-red-500' : 'border-silver-200 focus:border-royal-400'}`}
                      required
                      aria-required="true"
                      aria-invalid={fieldErrors.name ? 'true' : undefined}
                      aria-describedby={fieldErrors.name ? nameErrorId : undefined}
                    />
                    <p id={nameErrorId} role="alert" className={fieldErrors.name ? 'mt-1 text-red-500 text-xs' : 'sr-only'}>
                      {fieldErrors.name}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="contact-page-phone" className="block text-navy-900 font-semibold text-sm mb-1.5">
                      Phone <span aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <input
                      ref={phoneRef}
                      id="contact-page-phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07845 451111"
                      className={`w-full border-2 rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors min-h-[44px] ${fieldErrors.phone ? 'border-red-400 focus:border-red-500' : 'border-silver-200 focus:border-royal-400'}`}
                      required
                      aria-required="true"
                      aria-invalid={fieldErrors.phone ? 'true' : undefined}
                      aria-describedby={fieldErrors.phone ? phoneErrorId : undefined}
                    />
                    <p id={phoneErrorId} role="alert" className={fieldErrors.phone ? 'mt-1 text-red-500 text-xs' : 'sr-only'}>
                      {fieldErrors.phone}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-page-email" className="block text-navy-900 font-semibold text-sm mb-1.5">
                    Email address <span aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    ref={emailRef}
                    id="contact-page-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className={`w-full border-2 rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors min-h-[44px] ${fieldErrors.email ? 'border-red-400 focus:border-red-500' : 'border-silver-200 focus:border-royal-400'}`}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.email ? 'true' : undefined}
                    aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                  />
                  <p id={emailErrorId} role="alert" className={fieldErrors.email ? 'mt-1 text-red-500 text-xs' : 'sr-only'}>
                    {fieldErrors.email}
                  </p>
                </div>

                <div>
                  <label htmlFor="contact-page-service" className="block text-navy-900 font-semibold text-sm mb-1.5">
                    Service <span aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <select
                    ref={serviceRef}
                    id="contact-page-service"
                    name="service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className={`w-full border-2 rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors min-h-[44px] bg-white ${fieldErrors.service ? 'border-red-400 focus:border-red-500' : 'border-silver-200 focus:border-royal-400'}`}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.service ? 'true' : undefined}
                    aria-describedby={fieldErrors.service ? serviceErrorId : undefined}
                  >
                    <option value="" disabled>Select a service</option>
                    {SERVICE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p id={serviceErrorId} role="alert" className={fieldErrors.service ? 'mt-1 text-red-500 text-xs' : 'sr-only'}>
                    {fieldErrors.service}
                  </p>
                </div>

                <div>
                  <label htmlFor="contact-page-message" className="block text-navy-900 font-semibold text-sm mb-1.5">
                    Message <span aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <textarea
                    ref={messageRef}
                    id="contact-page-message"
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Tell us about the property, preferred dates and anything else useful..."
                    className={`w-full border-2 rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors resize-none ${fieldErrors.message ? 'border-red-400 focus:border-red-500' : 'border-silver-200 focus:border-royal-400'}`}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.message ? 'true' : undefined}
                    aria-describedby={fieldErrors.message ? messageErrorId : undefined}
                  />
                  <p id={messageErrorId} role="alert" className={fieldErrors.message ? 'mt-1 text-red-500 text-xs' : 'sr-only'}>
                    {fieldErrors.message}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 min-h-[44px] bg-royal-500 hover:bg-royal-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send message'}
                  {!loading && <Send size={16} aria-hidden="true" />}
                </button>

                <p className="text-slate-500 text-xs text-center">
                  Or{' '}
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:underline">
                    chat with us on WhatsApp
                  </a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      </main>
      <Footer />

      <MobileActionDock variant="general" analyticsLocation="contact_page_dock" whatsappText={WA_TEXT} />
    </div>
  );
}
