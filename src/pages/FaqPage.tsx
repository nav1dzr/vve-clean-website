import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileActionDock from '../components/MobileActionDock';
import { FAQ_ITEMS } from '../data/faq';
import { WA_BASE } from '../data/contactDetails';
import { usePageMeta } from '../hooks/usePageMeta';

const WA_TEXT = 'Hi VVE Clean, quick question';
const WA_FAQ = `${WA_BASE}?text=${encodeURIComponent(WA_TEXT)}`;

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function FaqPage() {
  usePageMeta(
    'FAQs | VVE Clean London',
    'Answers to the questions customers ask most about pricing, the re-clean guarantee, booking, cancellations and coverage across East and North London.',
    '/faq',
  );

  return (
    <div className="min-h-screen bg-[#f5f6f8] mobile-page-bottom lg:pb-0">
      {/* JSON-LD FAQPage schema for this page's own URL */}
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
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Questions</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-silver-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Everything customers ask us about pricing, the guarantee, booking and coverage — in one place.
          </p>
        </div>
      </div>

      {/* FAQ list */}
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="faq-list">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details key={q} className="faq-item">
              <summary className="faq-summary">
                <span className="faq-question">{q}</span>
                <span className="faq-icon" aria-hidden="true">+</span>
              </summary>
              <div className="faq-answer">
                <p>{a}</p>
              </div>
            </details>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-navy-950 rounded-2xl px-6 py-10">
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            Still got a question?
          </h2>
          <p className="text-silver-400 text-sm mb-7 max-w-md mx-auto">
            Message us on WhatsApp, or see the full price list.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={WA_FAQ}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 btn-whatsapp font-bold px-6 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:shadow-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Ask us on WhatsApp
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-bold px-6 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:bg-white hover:text-navy-900 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See full pricing
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 text-silver-300 hover:text-white font-semibold px-6 py-3.5 min-h-[44px] text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>

      </main>
      <Footer />

      <MobileActionDock variant="general" analyticsLocation="faq_page_dock" whatsappText={WA_TEXT} />
    </div>
  );
}
