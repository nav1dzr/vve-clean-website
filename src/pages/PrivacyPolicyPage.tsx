import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CONTACT_EMAIL = 'contact@vveclean.co.uk';
const LAST_UPDATED = '6 July 2026';

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
          Our website may use cookies and similar tracking technologies, including those set by Google for
          analytics and advertising purposes. These help us understand how visitors use our site and to show
          relevant adverts.
        </p>
        <p className="mt-3">
          You can manage or disable cookies at any time through your browser settings. Disabling cookies may
          affect some functionality of the website.
        </p>
        <p className="mt-3">
          Where required by law, we will ask for your consent before setting non-essential cookies.
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
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <Navbar />

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

      <Footer />

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl">
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href="tel:02080502233"
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Call us
          </a>
          <a href="https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote."
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm bg-[#22C55E] active:opacity-90 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
