import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { BUILDERS_WHATSAPP } from '../data/afterBuildersContent';
import { DEPOSIT_P, penceToDisplay } from '../data/pricing';
import { getAttribution } from '../lib/attribution';
import { trackContactFormSubmitted } from '../lib/analytics';
import { clearSubmissionIdentity, submissionIdentity } from '../lib/submissionIdentity';
import {
  AFTER_BUILDERS_SUBMISSION_SCOPE, ASSESSMENT_ITEMS, CLEANING_AREAS, CORE_CLEANING, EXTRA_SERVICES,
  PARKING_OPTIONS, PHOTO_OPTIONS, PROPERTY_TYPES, TRADES_STATUS, WORK_TYPES,
  afterBuildersEnquirySections, buildAfterBuildersEnquiryMessage, clearAfterBuildersDraft,
  createAfterBuildersEnquiry, isEnquiryPostcodeValid, readAfterBuildersDraft, saveAfterBuildersDraft,
  type AfterBuildersEnquiryState, type ExtraService,
} from '../lib/afterBuildersEnquiry';
import '../pages/after-builders-enquiry.css';

const STEPS = ['Project', 'Cleaning', 'Visit', 'Review'];
const COUNTS = ['', '0', '1', '2', '3', '4', '5', '6+'];
const TITLES = ['Tell us about the property', 'What would you like cleaned?', 'Plan the visit and photos', 'Check your enquiry'];
const LEADS = ['A few details help us assess the work. Choose “not sure” whenever you need advice.', 'We’ll agree the cleaning list and final price with you. Nothing here adds an automatic charge.', 'Dates are preferences until we agree your appointment. You can send photos separately.', 'You can change any answer before sending. This requests an assessed quote, not a booking or payment.'];

function ChoiceSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return <label className="builders-enquiry-field">{label}<select value={value} onChange={event => onChange(event.target.value)}>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

export default function AfterBuildersEnquiry() {
  const [state, setState] = useState(createAfterBuildersEnquiry);
  const [restored, setRestored] = useState(false);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorPanel = useRef<HTMLDivElement>(null);
  const successPanel = useRef<HTMLDivElement>(null);
  const previousStep = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => { setState(readAfterBuildersDraft()); setRestored(true); }, []);
  useEffect(() => { if (restored && !submitted) saveAfterBuildersDraft(state); }, [state, restored, submitted]);
  useEffect(() => {
    if (previousStep.current !== step) { heading.current?.focus(); previousStep.current = step; }
  }, [step]);
  useEffect(() => { if (error) errorPanel.current?.focus(); }, [error]);
  useEffect(() => { if (submitted) successPanel.current?.focus(); }, [submitted]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activeRequest.current?.abort(); }; }, []);

  const change = <K extends keyof AfterBuildersEnquiryState>(key: K, value: AfterBuildersEnquiryState[K]) => setState(current => ({ ...current, [key]: value }));
  const goTo = (next: number) => { setError(''); setInvalidField(''); setStep(next); setFurthestStep(current => Math.max(current, next)); };
  const toggleExtra = (extra: ExtraService) => setState(current => {
    const selected = current.extras.includes(extra);
    const quantities = { ...current.quantities };
    if (selected) delete quantities[extra];
    return { ...current, extras: selected ? current.extras.filter(key => key !== extra) : [...current.extras, extra], quantities };
  });
  const validateProject = () => {
    if (!isEnquiryPostcodeValid(state.postcode)) { setInvalidField('postcode'); setError('Check the postcode, or leave it blank if you do not know it yet.'); return false; }
    return true;
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || honeypot) return;
    if (step < 3) { if (step !== 0 || validateProject()) goTo(step + 1); return; }
    if (!validateProject()) { setStep(0); return; }
    if (name.trim().length < 2) { setInvalidField('name'); setError('Please enter your name (at least two characters).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setInvalidField('email'); setError('Please enter a valid email address so we can reply.'); return; }
    const message = buildAfterBuildersEnquiryMessage(state);
    if (message.length > 5000) { setError('Please shorten the project or access notes before sending. Your answers are still here.'); return; }
    inFlight.current = true; setLoading(true); setError(''); setInvalidField('');
    const controller = new AbortController(); activeRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const content = { fullName: name.trim(), email: email.trim(), phone: phone.trim(), service: 'After builders cleaning', message, marketingOptIn: false, sourcePage: window.location.pathname, _honeypot: '' };
      // Consent may change between attempts. Keep the retry identity tied to
      // the enquiry itself, then read current consent immediately before sending.
      const requestKey = await submissionIdentity(AFTER_BUILDERS_SUBMISSION_SCOPE, content);
      const payload = { ...content, attribution: getAttribution() };
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey }), signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok === true) {
        clearSubmissionIdentity(AFTER_BUILDERS_SUBMISSION_SCOPE); clearAfterBuildersDraft();
        if (mounted.current) { setSubmitted(true); setName(''); setEmail(''); setPhone(''); }
        trackContactFormSubmitted(result.enquiryId);
      } else if (mounted.current) setError('We could not confirm your enquiry was saved. Your answers are still here. Please try again, or contact us on WhatsApp.');
    } catch {
      if (mounted.current) setError('We could not confirm your enquiry was saved. Your answers are still here. Please try again, or contact us on WhatsApp.');
    } finally {
      window.clearTimeout(timeout); activeRequest.current = null; inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const whatsapp = <a href={BUILDERS_WHATSAPP} target="_blank" rel="noopener noreferrer" className="builders-enquiry-whatsapp" data-track-location="after_builders_enquiry_photos"><MessageCircle size={19} aria-hidden="true" />Send photos on WhatsApp</a>;

  if (submitted) return <div className="builders-enquiry builders-enquiry-success" ref={successPanel} tabIndex={-1} role="status" aria-labelledby="builders-enquiry-success"><CheckCircle2 size={40} aria-hidden="true" /><h3 id="builders-enquiry-success">Your enquiry is saved</h3><p>We’ll review the work and contact you during opening hours to agree the cleaning list, final price and a suitable time. Your appointment is not confirmed yet.</p><p>No payment has been taken. Once the details are agreed, we’ll send instructions for the {penceToDisplay(DEPOSIT_P)} deposit to secure the booking.</p>{whatsapp}<p className="builders-enquiry-privacy">If you send photos, please mention that you have already sent a website enquiry so we can match them.</p></div>;

  return <div className="builders-enquiry">
    <ol className="builders-enquiry-progress" aria-label="Enquiry steps">{STEPS.map((label, index) => <li key={label}><button type="button" disabled={loading || index > furthestStep} aria-current={step === index ? 'step' : undefined} onClick={() => goTo(index)}>{index + 1}. {label}</button></li>)}</ol>
    <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <input className="builders-enquiry-honeypot" aria-hidden="true" tabIndex={-1} autoComplete="off" name="_honeypot" value={honeypot} onChange={event => setHoneypot(event.target.value)} />
      <h3 ref={heading} tabIndex={-1}>{TITLES[step]}</h3><p className="builders-enquiry-lead">{LEADS[step]}</p>
      <fieldset disabled={loading} style={{ margin: 0 }} aria-label={TITLES[step]}>
        {step === 0 && <>
          <div className="builders-enquiry-grid builders-enquiry-select-grid">
            <ChoiceSelect label="Cleaning area" value={state.cleaningArea} options={CLEANING_AREAS} onChange={value => change('cleaningArea', value as AfterBuildersEnquiryState['cleaningArea'])} />
            <ChoiceSelect label="Property type" value={state.propertyType} options={PROPERTY_TYPES} onChange={value => change('propertyType', value as AfterBuildersEnquiryState['propertyType'])} />
            <label className="builders-enquiry-field">Postcode (if known)<input name="postcode" autoComplete="postal-code" value={state.postcode} maxLength={10} onChange={event => change('postcode', event.target.value)} aria-invalid={invalidField === 'postcode'} aria-describedby={invalidField === 'postcode' ? 'builders-enquiry-error' : undefined} placeholder="For example, E17 3AA" /><small>A full postcode or the first part helps us check coverage.</small></label>
            <ChoiceSelect label="Building work" value={state.workType} options={WORK_TYPES} onChange={value => change('workType', value as AfterBuildersEnquiryState['workType'])} />
            <ChoiceSelect label="Bedrooms to clean" value={state.bedrooms} options={Object.fromEntries(COUNTS.map(n => [n, n || 'Not sure yet']))} onChange={value => change('bedrooms', value)} />
            <ChoiceSelect label="Bathrooms to clean" value={state.bathrooms} options={Object.fromEntries(COUNTS.map(n => [n, n || 'Not sure yet']))} onChange={value => change('bathrooms', value)} />
          </div>
          <details data-disclosure="project-details"><summary>More about the property (optional)</summary><label className="builders-enquiry-field">Approximate floor area (m²)<input type="text" inputMode="numeric" value={state.floorArea} maxLength={5} onChange={event => change('floorArea', event.target.value.replace(/\D/g, ''))} /><small>Leave blank if you do not know.</small></label><label className="builders-enquiry-field">Rooms or work to tell us about<textarea value={state.workDetails} maxLength={600} onChange={event => change('workDetails', event.target.value)} placeholder="For example, a kitchen refit with dust in the hall." /></label></details>
        </>}
        {step === 1 && <>
          <div className="builders-enquiry-note"><h4>Your core cleaning list</h4><ul>{CORE_CLEANING.map(line => <li key={line}>{line}</li>)}</ul><p>We’ll confirm the rooms and tasks in your written quote. This is not an unlimited or fixed-price package.</p></div>
          <fieldset><legend>Optional services — choose only what you need</legend><div className="builders-enquiry-grid">{(Object.keys(EXTRA_SERVICES) as ExtraService[]).map(key => <div key={key} className="builders-enquiry-extra"><label className="builders-enquiry-choice"><input type="checkbox" checked={state.extras.includes(key)} onChange={() => toggleExtra(key)} />{EXTRA_SERVICES[key].label}</label>{state.extras.includes(key) && EXTRA_SERVICES[key].unit && <label className="builders-enquiry-field">{EXTRA_SERVICES[key].label}: quantity (optional)<input inputMode="numeric" type="text" maxLength={5} value={state.quantities[key] || ''} onChange={event => change('quantities', { ...state.quantities, [key]: event.target.value.replace(/\D/g, '') })} /><small>{EXTRA_SERVICES[key].unit}. Leave blank for advice. {key === 'windows' ? 'Tell us an approximate window count; we’ll confirm size, reach and work from photos.' : 'The work and price will be agreed separately.'}</small></label>}</div>)}</div></fieldset>
          <fieldset><legend>Anything that needs assessment? (optional)</legend><div className="builders-enquiry-grid">{Object.entries(ASSESSMENT_ITEMS).map(([key, label]) => <label className="builders-enquiry-choice" key={key}><input type="checkbox" checked={state.assessment.includes(key as keyof typeof ASSESSMENT_ITEMS)} onChange={() => change('assessment', state.assessment.includes(key as keyof typeof ASSESSMENT_ITEMS) ? state.assessment.filter(item => item !== key) : [...state.assessment, key as keyof typeof ASSESSMENT_ITEMS])} />{label}</label>)}</div></fieldset>
          <p className="builders-enquiry-privacy">Paint, plaster and adhesive removal depends on the surface. Building waste clearance and repairs are not included.</p>
        </>}
        {step === 2 && <>
          <div className="builders-enquiry-grid builders-enquiry-select-grid"><ChoiceSelect label="Are the trades finished?" value={state.trades} options={TRADES_STATUS} onChange={value => change('trades', value as AfterBuildersEnquiryState['trades'])} /><label className="builders-enquiry-field">Preferred date (optional)<input type="date" value={state.preferredDate} onChange={event => change('preferredDate', event.target.value)} /><small>Leave blank if flexible. Availability will be confirmed with you.</small></label><ChoiceSelect label="Parking" value={state.parking} options={PARKING_OPTIONS} onChange={value => change('parking', value as AfterBuildersEnquiryState['parking'])} /><ChoiceSelect label="Photos" value={state.photos} options={PHOTO_OPTIONS} onChange={value => change('photos', value as AfterBuildersEnquiryState['photos'])} /></div>
          <label className="builders-enquiry-field">Access notes (optional)<textarea value={state.accessNotes} maxLength={400} onChange={event => change('accessNotes', event.target.value)} placeholder="For example, stairs, lift access, permits or site opening hours." /></label>
          <div className="builders-enquiry-note"><h4>Photos can come later</h4><p>A view of each affected room and close-ups of residue will help. Please leave people and personal documents out. Photos are not uploaded by this form.</p>{whatsapp}<p className="builders-enquiry-privacy">Opening WhatsApp does not submit this enquiry. Return here when you are ready to send it.</p></div>
        </>}
        {step === 3 && <>
          <div className="builders-enquiry-review">{afterBuildersEnquirySections(state).map((section, index) => <article key={section.title}><h4>{section.title}</h4><ul>{section.lines.map(line => <li key={line}>{line}</li>)}</ul><button type="button" onClick={() => goTo(index === 0 ? 0 : index === 4 ? 2 : 1)} aria-label={`Edit ${section.title.toLowerCase()}`}>Edit</button></article>)}</div>
          <div className="builders-enquiry-grid builders-enquiry-select-grid"><label className="builders-enquiry-field">Your name *<input name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={150} required aria-invalid={invalidField === 'name'} aria-describedby={invalidField === 'name' ? 'builders-enquiry-error' : undefined} /></label><label className="builders-enquiry-field">Email address *<input name="email" autoComplete="email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required aria-invalid={invalidField === 'email'} aria-describedby={invalidField === 'email' ? 'builders-enquiry-error' : undefined} /></label></div>
          <label className="builders-enquiry-field">Phone number (optional)<input name="phone" autoComplete="tel" type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} /><small>For discussing this enquiry; no marketing subscription.</small></label>
          <div className="builders-enquiry-note"><strong>No payment to send your enquiry.</strong><p>We’ll assess the job and agree the cleaning list, final price, access costs and time with you. Once agreed, the {penceToDisplay(DEPOSIT_P)} deposit secures your booking and comes off the total.</p></div>
          <p className="builders-enquiry-privacy">We use these details to respond to your enquiry. <a href="/privacy-policy">Read our privacy policy</a>.</p>
        </>}
      </fieldset>
      {error && <div id="builders-enquiry-error" className="builders-enquiry-error" role="alert" tabIndex={-1} ref={errorPanel}>{error}</div>}
      <div className="builders-enquiry-actions">{step > 0 && <button type="button" className="builders-enquiry-back" disabled={loading} onClick={() => goTo(step - 1)}>Back</button>}<button type="submit" className="builders-enquiry-primary" disabled={loading}>{loading ? 'Sending your enquiry…' : step === 3 ? 'Send my enquiry' : step === 2 ? 'Review my enquiry' : 'Continue'}{!loading && <ArrowRight size={18} aria-hidden="true" />}</button></div>
      <p className="builders-enquiry-privacy">Only cleaning choices are saved on this device when storage is available. Contact details, postcode, dates and notes are not saved. Nothing is sent to us before you submit.</p>
    </form>
  </div>;
}
