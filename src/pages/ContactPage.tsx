import Contact from '../components/Contact';
import FaqSchema from '../components/FaqSchema';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';

const CONTACT_FAQS = [
  { q: 'What details should I send for a quote?', a: 'Send the service you need, the property postcode, property size or items to clean, its current condition and your preferred date. Photos are helpful for unusual staining or after-builders work.' },
  { q: 'Is the Queensway address a walk-in office?', a: 'No. It is the registered office. Cleaning services are delivered at customer premises, so contact VVE Clean before arranging anything in person.' },
  { q: 'Can I check availability before paying?', a: 'Yes. Request your preferred time online with no payment. We check availability, scope and the final price, then contact you to confirm the appointment.' },
];

export default function ContactPage() {
  return (
    <div className="mobile-page-bottom min-h-screen bg-white lg:pb-0">
      <FaqSchema items={CONTACT_FAQS} />
      <Navbar />
      <main id="main-content" className="pt-16 lg:pt-20">
        <Contact standalone />
        <section className="bg-surface px-4 pb-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-bold text-navy-900">Contact questions</h2>
            <div className="mt-7 faq-list">
              {CONTACT_FAQS.map(({ q, a }) => (
                <details key={q} className="faq-item">
                  <summary className="faq-summary"><span className="faq-question">{q}</span><span className="faq-icon" aria-hidden="true">+</span></summary>
                  <div className="faq-answer"><p>{a}</p></div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
