import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileActionDock from '../components/MobileActionDock';
import { useCookieConsent } from '../context/CookieConsentContext';
import { CONSENT_VERSION } from '../lib/consentVersion';

const CONTACT_EMAIL = 'contact@vveclean.co.uk';
const LAST_UPDATED = new Date(`${CONSENT_VERSION}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function CookieSettingsLink() {
  const { openSettings } = useCookieConsent();
  return (
    <button
      type="button"
      onClick={openSettings}
      className="text-royal-600 underline hover:text-royal-800 font-semibold"
    >
      cookie settings
    </button>
  );
}

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: 'who-we-are',
    title: '1. Who We Are',
    content: (
      <>
        <p>
          This Privacy Policy explains how <strong>VVE LIMITED</strong> (trading as <strong>VVE Clean</strong>),
          Company Registration Number 17234391, registered in England and Wales, collects, uses, and protects
          your personal data when you use our website or services.
        </p>
        <p className="mt-3">
          Our website is <strong>www.vveclean.co.uk</strong>. You can contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-royal-600 hover:underline">{CONTACT_EMAIL}</a>{' '}
          or by phone on <a href="tel:02080502233" className="text-royal-600 hover:underline">020 8050 2233</a>.
        </p>
        <p className="mt-3">
          VVE LIMITED is the data controller for the personal information we hold about you.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: '2. What Personal Data We Collect',
    content: (
      <>
        <p>We may collect and process the following personal data:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Full name',
            'Phone number',
            'Email address',
            'Property address and postcode',
            'Booking details (service type, preferred date and time)',
            'Payment and deposit status (we do not store full card details — see Section 5)',
            'Messages and notes you send us when requesting a quote or support',
            'Photos you share to help us assess a job or provide a quote',
            'Website usage data where analytics or advertising tracking is in use (see Section 7)',
            // Attribution capture moved from /leaflet only to every public
            // route, so the policy now describes it explicitly rather than
            // leaving it to the general "website usage data" line above. It is
            // advertising storage, not essential storage — the wording has to
            // say so, and Section 7 has to match.
            'How you reached our website — for example the advertising campaign, search click or link you arrived from. This is only stored on your device if you accept advertising cookies, and is only sent to us, attached to your booking, if you go on to make one',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'why-we-collect',
    title: '3. Why We Collect It',
    content: (
      <>
        <p>We use your personal data for the following purposes:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'To provide quotes and respond to enquiries',
            'To manage and confirm bookings',
            'To process deposit payments securely via Stripe',
            'To deliver cleaning and property services to you',
            'To provide customer support and follow up after a service',
            'To improve our website, services, and advertising',
            'To meet our legal, accounting, and tax obligations',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'legal-basis',
    title: '4. Legal Basis for Processing',
    content: (
      <>
        <p>We rely on the following legal bases under UK GDPR:</p>
        <div className="mt-3 space-y-3">
          {[
            {
              basis: 'Performance of a contract',
              detail:
                'When you request a quote, make a booking, or pay a deposit, processing your data is necessary to carry out our agreement with you.',
            },
            {
              basis: 'Legitimate interests',
              detail:
                'We may process data to improve our services, respond to feedback, and market to existing customers — provided this does not override your rights.',
            },
            {
              basis: 'Legal obligation',
              detail:
                'We are required to retain certain records for tax, accounting, and legal compliance purposes.',
            },
            {
              basis: 'Consent',
              detail:
                'Where required (for example, certain cookies or marketing communications), we will ask for your consent and you may withdraw it at any time.',
            },
          ].map(({ basis, detail }) => (
            <div key={basis} className="bg-silver-50 rounded-xl px-5 py-4 border border-silver-200">
              <div className="font-semibold text-navy-900 text-sm mb-1">{basis}</div>
              <div className="text-silver-600 text-sm leading-relaxed">{detail}</div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'payments',
    title: '5. Payments',
    content: (
      <p>
        All card payments and deposits are processed securely by <strong>Stripe</strong>, a PCI-DSS compliant
        payment processor. We do not receive, store, or have access to your full card number, CVV, or other
        sensitive payment credentials. Stripe's own privacy policy applies to data you submit during checkout.
        You can view it at{' '}
        <span className="text-royal-600">stripe.com/gb/privacy</span>.
      </p>
    ),
  },
  {
    id: 'who-we-share-with',
    title: '6. Who We Share Data With',
    content: (
      <>
        <p>
          We only share your data with third parties where necessary. This may include:
        </p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Stripe — to process deposit payments securely',
            'Google — for advertising (Google Ads), analytics (Google Analytics), and related services, where in use',
            'Email service providers — to send booking confirmations and customer communications',
            'Hosting and infrastructure providers (e.g. Vercel) — to operate the website',
            'Booking or CRM tools we use to manage appointments',
            'Our accountants or legal advisers — where required for business or legal purposes',
            'Regulatory authorities or law enforcement — if required by law',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          We do not sell your personal data to third parties.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '7. Cookies and Tracking',
    content: (
      <>
        <p>
          When you first visit our website, we ask you to choose which of the cookie categories below you're
          happy for us to use. You can change your choice at any time — see{' '}
          <strong>&ldquo;How to change your choice&rdquo;</strong> below.
        </p>

        <h3 className="font-semibold text-navy-900 text-sm mt-5 mb-2">Essential storage (always on)</h3>
        <p>
          Some storage on your device is required for the website to work at all, and is not switched off by
          your cookie choice. This includes: remembering your quote and booking selections as you move between
          pages, restoring your booking details if you leave and come back, keeping your visit to our booking
          and payment pages working correctly, and remembering a discount code you have asked us to apply — for
          example the 20% offer from one of our leaflets — so that we can honour it when you book. None of this
          is used for advertising or measurement.
        </p>

        <h3 className="font-semibold text-navy-900 text-sm mt-5 mb-2">Analytics storage (optional)</h3>
        <p>
          If you agree, we use analytics storage to understand how visitors use our site — for example, which
          pages are viewed — so we can improve it. This is switched off until you agree to it.
        </p>

        <h3 className="font-semibold text-navy-900 text-sm mt-5 mb-2">Advertising storage (optional)</h3>
        <p>
          If you agree, we allow Google to use advertising storage to measure and improve the relevance of our
          adverts (for example, Google Ads). We also record on your device how you reached our site — the
          advertising campaign, search click or link you arrived from — so that if you go on to book, we can
          tell which adverts actually bring us work. That record is attached to your booking and sent to us only
          at the point you submit it; it is never sent while you are simply browsing, and it is never shown on
          the page. All of this is switched off until you agree to it. If you refuse, or later withdraw your
          agreement using <CookieSettingsLink />, we store none of it and delete anything already stored — your
          quote, your booking and any discount you were promised carry on working exactly as before.
        </p>

        <h3 className="font-semibold text-navy-900 text-sm mt-5 mb-2">Google Consent Mode</h3>
        <p>
          We use a Google feature called <strong>Consent Mode</strong>. In plain terms: until you tell us
          otherwise, Google's advertising and analytics tools are set to a "no cookies, no storage" mode by
          default. If you accept analytics and/or advertising cookies, we tell Google to switch the relevant
          storage on for you. If you reject them, Google's tools stay in that reduced, cookie-free mode — we do
          not separately load or duplicate Google's tracking tag to work around your choice.
        </p>

        <h3 className="font-semibold text-navy-900 text-sm mt-5 mb-2">How to change your choice</h3>
        <p>
          You can accept all cookies, reject optional cookies, or choose exactly which categories to allow, at
          any time, using the <CookieSettingsLink /> link in the website footer. You can also manage or disable
          cookies through your browser settings. Disabling essential storage may prevent parts of the booking
          and payment process from working correctly.
        </p>
      </>
    ),
  },
  {
    id: 'how-long',
    title: '8. How Long We Keep Your Data',
    content: (
      <>
        <p>
          We retain personal data only for as long as is reasonably necessary for the purpose it was collected:
        </p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Enquiries and quote requests: retained for a reasonable period in case you return or for reference',
            'Booking and payment records: retained for as long as required for legal, accounting, and tax purposes (typically 6–7 years under UK tax rules)',
            'Marketing communications: until you opt out or withdraw consent',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: '9. Your Rights',
    content: (
      <>
        <p>Under UK data protection law, you have the right to:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Access the personal data we hold about you',
            'Request correction of inaccurate or incomplete data',
            'Request deletion of your data in certain circumstances',
            'Object to processing based on legitimate interests',
            'Request restriction of processing in certain circumstances',
            'Withdraw consent at any time where processing is based on consent',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          To exercise any of these rights, please contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-royal-600 hover:underline">{CONTACT_EMAIL}</a>.
          We will respond within one month.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '10. How to Contact Us',
    content: (
      <p>
        If you have any questions about this Privacy Policy or how we handle your data, please contact us:
        <br /><br />
        <strong>VVE LIMITED (trading as VVE Clean)</strong><br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-royal-600 hover:underline">{CONTACT_EMAIL}</a><br />
        Phone: <a href="tel:02080502233" className="text-royal-600 hover:underline">020 8050 2233</a>
      </p>
    ),
  },
  {
    id: 'complaints',
    title: '11. How to Make a Complaint',
    content: (
      <p>
        If you are unhappy with how we have handled your personal data, you have the right to complain to the
        UK's data protection regulator, the <strong>Information Commissioner's Office (ICO)</strong>. You can
        contact the ICO at <span className="text-royal-600">ico.org.uk</span> or by calling{' '}
        <span className="font-semibold">0303 123 1113</span>. We would, however, appreciate the chance to
        address your concerns first — please contact us directly before escalating to the ICO.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f8] mobile-page-bottom lg:pb-0">
      <Navbar />
      <main id="main-content">

      {/* Hero */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Legal</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-silver-300 text-base max-w-xl mx-auto">
            How VVE Clean collects, uses, and protects your personal data.
          </p>
          <p className="text-silver-500 text-xs mt-4">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-14">
        {/* Quick nav */}
        <div className="bg-white rounded-2xl border border-silver-200 shadow-sm p-6 mb-10">
          <h2 className="font-semibold text-navy-900 text-sm uppercase tracking-widest mb-4">Contents</h2>
          <nav className="space-y-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-sm text-royal-600 hover:text-royal-800 hover:underline transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="bg-white rounded-2xl border border-silver-200 shadow-sm p-6 md:p-8"
            >
              <h2 className="font-display text-xl font-bold text-navy-900 mb-4">{s.title}</h2>
              <div className="text-silver-700 text-sm leading-relaxed">{s.content}</div>
            </section>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-10 flex gap-6 text-sm">
          <Link to="/" className="text-royal-600 hover:underline">← Back to Home</Link>
          <Link to="/terms-of-service" className="text-royal-600 hover:underline">Terms of Service →</Link>
        </div>
      </div>

      </main>
      <Footer />

      <MobileActionDock
        variant="general"
        analyticsLocation="privacy_page_dock"
        whatsappText="Hi VVE Clean, I'd like to get a quote."
      />
    </div>
  );
}
