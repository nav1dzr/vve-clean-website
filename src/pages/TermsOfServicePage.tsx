import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileActionDock from '../components/MobileActionDock';
import { TERMS_VERSION } from '../lib/termsVersion';
import { DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT } from '../data/policies';

const CONTACT_EMAIL = 'contact@vveclean.co.uk';
// Derived from TERMS_VERSION (single source of truth, shared with the
// booking page's terms-acceptance record) so this display date can never
// drift out of sync with the version actually being recorded.
const LAST_UPDATED = new Date(`${TERMS_VERSION}T00:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: 'about',
    title: '1. About VVE Clean',
    content: (
      <p>
        These Terms of Service govern your use of the services provided by <strong>VVE LIMITED</strong>{' '}
        (trading as <strong>VVE Clean</strong>), Company Registration Number 17234391, registered in England
        and Wales. By requesting a quote, making a booking, or using our services, you agree to these terms.
      </p>
    ),
  },
  {
    id: 'services',
    title: '2. Services Provided',
    content: (
      <>
        <p>VVE Clean provides professional cleaning services, including but not limited to:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Carpet cleaning',
            'Sofa and upholstery cleaning',
            'Rug cleaning',
            'End of tenancy cleaning',
            'Move-in deep cleaning',
            'After builders cleaning',
            'General deep cleaning',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          We operate primarily across East and North London. Service availability may vary by location —
          please contact us to confirm we cover your area.
        </p>
      </>
    ),
  },
  {
    id: 'quotes',
    title: '3. Quotes and Pricing',
    content: (
      <>
        <p>
          Quotes are based on the information and photos you provide, the size of the property, and the
          service type. Our standard prices are listed on our website and apply to properties in normal,
          reasonably clean condition.
        </p>
        <p className="mt-3">
          We reserve the right to revise a quote before starting work if, upon arrival, the actual
          condition or size of the job differs significantly from what was described or shown. This may
          include (but is not limited to) heavy soiling, mould, excessive rubbish, biohazard contamination,
          pet accidents, strong odours, or large or permanent stains. In such cases, we will explain the
          issue and confirm any revised price with you before proceeding.
        </p>
        <p className="mt-3">
          No extra work will begin, and no price change will apply, without your agreement. If we believe the
          job differs materially from what was quoted, we will pause and discuss it with you before continuing.
        </p>
      </>
    ),
  },
  {
    id: 'bookings',
    title: '4. Bookings and Deposits',
    content: (
      <>
        <p>
          When you pay online, you are paying a <strong>£30 deposit</strong> — not the full price of your
          clean. This deposit is processed securely by Stripe and is deducted from your final total; it is
          not an extra charge.
        </p>
        <p className="mt-3">
          Paying the deposit submits a <strong>booking request</strong> for your preferred date and arrival
          window. It does not, by itself, guarantee that date or time. We aim to confirm availability within
          one business hour of receiving your request, and will contact you to confirm the appointment
          separately. Until we have confirmed your appointment, please treat your requested date and time as
          provisional rather than fixed.
        </p>
        <p className="mt-3">
          The remaining balance is due after the service has been completed and you have had the opportunity
          to check the work, unless a different payment arrangement has been agreed in writing in advance.
        </p>
      </>
    ),
  },
  {
    id: 'cancellations',
    title: '5. Cancellations and Rescheduling',
    content: (
      <>
        <p>
          We understand that circumstances change. We ask for reasonable notice if you need to cancel or
          reschedule your booking:
        </p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Free reschedule if you contact us before 12:00 noon the day before your booking',
            'Late cancellations (less than 24 hours notice) or cancellations on the day of the booking may result in the deposit being forfeited',
            'If we cannot access the property at the agreed time due to no-show, no access, or locked premises, the deposit may be non-refundable (see Section 8)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          We may also need to reschedule in exceptional circumstances (for example, severe weather, staff
          illness, or vehicle issues). We will notify you as soon as possible and offer the earliest
          available alternative date.
        </p>
        <p className="mt-3">
          {DEPOSIT_REFUND_ON_UNAVAILABLE_SLOT}
        </p>
      </>
    ),
  },
  {
    id: 'customer-responsibilities',
    title: '6. Customer Responsibilities',
    content: (
      <>
        <p>To allow us to carry out your service properly, you agree to:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Provide accurate property address, contact details, and a correct description of the job',
            'Arrange suitable parking or access at no additional cost where possible',
            'Ensure access to the property at the agreed date and time',
            'Ensure electricity and hot water are available on the day of the service, unless otherwise agreed',
            'Remove or store fragile, valuable, or sentimental items before the clean',
            'Inform us in advance of any delicate fabrics, previous damage, or conditions that could affect the service',
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
    id: 'results',
    title: '7. Stains, Results, and Limitations',
    content: (
      <p>
        We always aim to achieve the best possible results for every job. However, we cannot guarantee the
        complete removal of every stain, odour, mark, or discolouration. Results depend on the type of
        material, the nature and age of the stain, previous treatments, and the condition of the item.
        We are not responsible for pre-existing damage, normal wear and tear, fabric shrinkage or colour
        change where we have disclosed a risk before starting, or dye transfer from rugs, carpets, or
        upholstery. We will always raise any concerns before beginning work.
      </p>
    ),
  },
  {
    id: 'access',
    title: '8. Access and No-Show',
    content: (
      <p>
        If our team arrives at the agreed time and cannot gain access to the property — whether due to
        incorrect address details, locked premises, or no response — we may treat this as a failed
        appointment. In such cases, the deposit may be non-refundable and a call-out charge may apply
        to cover travel and labour costs. We will always attempt to contact you before leaving.
      </p>
    ),
  },
  {
    id: 'payment',
    title: '9. Payment',
    content: (
      <>
        <p>We accept the following payment methods:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Debit or credit card (via Stripe secure checkout)',
            'Bank transfer (for agreed commercial or repeat-booking arrangements)',
            'Cash (by prior arrangement only)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Commercial customers are invoiced on 14-day payment terms unless otherwise agreed. Late payment
          may result in suspension of future bookings.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: '10. Liability',
    content: (
      <>
        <p>
          VVE LIMITED is fully insured for public liability and cleaning services. If we cause damage to
          your property through our own negligence, please report it immediately (see Section 11).
        </p>
        <p className="mt-3">We are not liable for:</p>
        <ul className="mt-3 space-y-2 list-none">
          {[
            'Pre-existing damage or defects not reported to us before the service',
            'Normal wear and tear on fabrics, carpets, or surfaces',
            'Shrinkage, colour fading, or fabric damage where a risk was disclosed to the customer before work began and the customer chose to proceed',
            'Results affected by inaccurate or incomplete information provided by the customer',
            'Items of value, cash, or personal belongings left unsecured in the property',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-silver-700">
              <span className="w-1.5 h-1.5 rounded-full bg-royal-500 flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Our total liability in any claim shall not exceed the total amount paid for the specific service
          to which the claim relates, except where required by law.
        </p>
      </>
    ),
  },
  {
    id: 'complaints',
    title: '11. Complaints',
    content: (
      <p>
        If you are unhappy with any aspect of our service, please contact us as soon as possible — ideally
        within 24 hours of the service being completed. Please provide your contact details, booking reference,
        a description of the issue, and photos where relevant. We will investigate promptly and aim to resolve
        any complaint within a reasonable timeframe. You can reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-royal-600 hover:underline">{CONTACT_EMAIL}</a>{' '}
        or by calling <a href="tel:02080502233" className="text-royal-600 hover:underline">020 8050 2233</a>.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '12. Changes to These Terms',
    content: (
      <p>
        We may update these Terms of Service from time to time. The current version will always be available
        on our website. Continued use of our services after changes are posted constitutes acceptance of the
        updated terms. We will not apply changes retroactively to bookings already confirmed.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: '13. Governing Law',
    content: (
      <p>
        These terms are governed by the law of England and Wales. Any disputes arising under them will be
        subject to the exclusive jurisdiction of the courts of England and Wales.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '14. Contact',
    content: (
      <p>
        If you have any questions about these terms, please contact us:
        <br /><br />
        <strong>VVE LIMITED (trading as VVE Clean)</strong><br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-royal-600 hover:underline">{CONTACT_EMAIL}</a><br />
        Phone: <a href="tel:02080502233" className="text-royal-600 hover:underline">020 8050 2233</a>
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-silver-300 text-base max-w-xl mx-auto">
            The terms that apply when you use VVE Clean services.
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
          <Link to="/privacy-policy" className="text-royal-600 hover:underline">Privacy Policy →</Link>
        </div>
      </div>

      </main>
      <Footer />

      <MobileActionDock
        variant="general"
        analyticsLocation="terms_page_dock"
        whatsappText="Hi VVE Clean, I'd like to get a quote."
      />
    </div>
  );
}
