import { Link } from 'react-router-dom';
import {
  EOT_GUARANTEE_HOURS,
  COVERAGE_POSTCODE_LIST,
  EOT_CARPET_PACKAGE_DISCOUNT_PCT,
  EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS,
} from '../data/pricing';

export const FAQS = [
  {
    q: 'How does the end of tenancy re-clean guarantee work?',
    a: `The Complete End of Tenancy package follows our 67-point checklist. If your agent or landlord reports a cleaning issue covered by that package within ${EOT_GUARANTEE_HOURS} hours of the visit, contact us with their report and we will arrange one free re-clean of the affected area. The guarantee covers cleaning only and does not guarantee the return of a tenancy deposit.`,
  },
  {
    q: "What's included in an end of tenancy clean?",
    a: 'Every Complete End of Tenancy Clean covers the kitchen including the oven, hob, extractor, emptied fridge and defrosted freezer, accessible appliance compartments, cupboards inside and out, descaled bathrooms, internal windows, skirting boards, doors, switches and all floors. Carpet steam cleaning, exterior windows and other genuine scope expansions are shown separately.',
  },
  {
    q: 'Are your cleaners insured and vetted?',
    a: 'VVE Clean carries £5m public liability insurance. If you need a copy of the certificate or want to ask who will attend your property, message us before booking.',
  },
  {
    // Previously claimed most customers leave keys with us, that we always send
    // completion photos, and that keys are returned however the customer likes.
    // None of that is an agreed operational commitment, so the answer now
    // describes the arrangement as something confirmed per booking.
    q: 'Do I need to be home during the clean?',
    a: 'You do not normally need to remain at the property, provided access and key arrangements are agreed before the appointment. Confirm the key-return and completion-photo arrangements for your particular booking.',
  },
  {
    q: 'Do you bring equipment and products?',
    a: 'Yes. We bring the equipment and cleaning products needed for the booked work. If a surface needs a specialist treatment outside the agreed scope, we will discuss it before adding anything to the price.',
  },
  {
    q: 'When do I pay?',
    a: 'There is no payment when you request a preferred time. We check availability, scope and the final price, then contact you to confirm the appointment. For standard residential work, payment is normally due after the service unless a different arrangement is agreed in writing.',
  },
  {
    q: 'Can the price change?',
    a: 'Our prices are fixed for normal condition properties based on the details provided. If we arrive and the property has heavy soiling, mould, excessive rubbish, biohazard contamination, strong odours, pet accidents, or large/permanent stains, we will explain the issue and confirm any revised price before starting.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'Rescheduling is free if you contact us before 12 noon on the day before the confirmed appointment. If you need to cancel later than that, contact us as soon as possible. Any cancellation or call-out charge applies only if it was stated and agreed in writing when the appointment was confirmed.',
  },
  {
    q: 'How quickly can you come?',
    a: 'Availability changes by service, area and property size. Send your preferred date online with no payment, or ask us on WhatsApp if the timing is critical. We will check and contact you with what is available.',
  },
  {
    q: 'Which areas do you cover?',
    a: `Our main coverage is East and North London: ${COVERAGE_POSTCODE_LIST}. If your postcode is outside that list, ask us before booking and we will confirm whether we can travel to you.`,
  },
  {
    q: 'Do you clean occupied homes?',
    a: 'Our main services are end of tenancy, move-in, after-builders, carpet, upholstery and commercial cleaning. Tell us if the property will be occupied so we can confirm the right service and scope before you book.',
  },
  {
    q: 'What if the date I request is not available?',
    a: 'We will contact you with the closest alternatives we can offer. If none works for you, you can decline them. Nothing is charged for sending or declining a request.',
  },
  {
    q: 'Can I add carpet cleaning to an end of tenancy booking?',
    a: `Yes. Add the rooms you want cleaned while building your end of tenancy quote and the price updates before you pay. Carpet cleaning booked with an end of tenancy clean is charged at up to ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off the standalone price once you select ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} or more qualifying areas — see the next question for the conditions.`,
  },
  {
    q: `How does the "up to ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off carpet cleaning" work?`,
    a: `It applies when carpet cleaning is booked together with an end of tenancy clean, and only once you select at least ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} qualifying areas. Qualifying areas are bedrooms, living rooms, large lounges, hallways, landings and stairs. Fewer than ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} areas are charged at the normal standalone price. We say "up to" because the £85 carpet minimum still applies, so a small selection may be discounted by less than ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}%. Rugs, wool, silk and other delicate fibres, severe pet or biohazard contamination and exceptional staining are not included and are quoted separately after a photo review. The exact price is always shown before you pay.`,
  },
  {
    q: 'What happens if my agent or landlord flags a cleaning issue?',
    a: `Send us their report. If the issue is covered by the Complete End of Tenancy package and you contact us within ${EOT_GUARANTEE_HOURS} hours of the visit, we arrange one free re-clean of the affected area. Tell us as soon as you can, since the ${EOT_GUARANTEE_HOURS}-hour window runs from the clean. The guarantee covers cleaning work only — it does not guarantee that a tenancy deposit will be returned, and it does not cover damage, repairs or issues outside the booked scope.`,
  },
];

/**
 * The six questions that block a booking, shown on the homepage.
 *
 * The homepage previously rendered all 15 — a byte-identical copy of /faq that
 * was 39% of the page. These are matched against FAQS rather than retyped, so
 * the homepage and /faq can never give different answers to the same question.
 * Order here is the order shown.
 */
const HOMEPAGE_FAQ_QUESTIONS = [
  'How does the end of tenancy re-clean guarantee work?',
  'When do I pay?',
  'Can the price change?',
  'Can I reschedule or cancel?',
  'What if the date I request is not available?',
  'Which areas do you cover?',
] as const;

export const HOMEPAGE_FAQS = HOMEPAGE_FAQ_QUESTIONS.map((question) => {
  const faq = FAQS.find(({ q }) => q === question);
  // A question renamed in FAQS without updating this list would otherwise drop
  // silently off the homepage and out of its schema.
  if (!faq) throw new Error(`Homepage FAQ "${question}" is not in FAQS`);
  return faq;
});

/**
 * FAQPage schema built from exactly the questions the page renders — the
 * homepage advertises its six, /faq advertises all 15. Structured data that
 * claims answers a visitor cannot see on that page is what Google's FAQ
 * guidance prohibits, and what the parity specs check.
 */
const schemaFor = (faqs: readonly { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

const WA_QUESTION = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20quick%20question';

export default function FAQ({ standalone = false }: { standalone?: boolean }) {
  // /faq is the full reference; everywhere else shows the booking-blocking six
  // and links to it.
  const faqs = standalone ? FAQS : HOMEPAGE_FAQS;

  return (
    <>
      {/* JSON-LD FAQPage schema — exactly the questions rendered below */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFor(faqs)) }}
      />

      <section
        id="faq"
        className="bg-surface py-20 px-4 scroll-mt-24"
      >
        <div style={{ maxWidth: 780, margin: '0 auto' }}>

          {/* Eyebrow */}
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-royal-600"
          >
            Questions
          </p>

          {/* Heading */}
          {standalone ? (
            <h1
              className="text-center font-bold text-navy-900 mb-10"
              style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', lineHeight: 1.15 }}
            >
              Before you book
            </h1>
          ) : (
            <h2
              className="text-center font-bold text-navy-900 mb-10"
              style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', lineHeight: 1.15 }}
            >
              Before you book
            </h2>
          )}

          {/* FAQ cards */}
          <div className="faq-list">
            {faqs.map(({ q, a }) => (
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

          {/* Route to the remaining questions. Only shown where the list is a
              subset — on /faq itself there is nowhere further to go. */}
          {!standalone && (
            <div className="text-center mt-8">
              <Link
                to="/faq"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-royal-600 px-7 py-3 text-sm font-bold text-royal-700 transition-colors hover:bg-royal-50"
              >
                View all {FAQS.length} FAQs
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}

          {/* CTA */}
          <div className="text-center mt-10">
            <p className="mb-4 text-sm text-muted">
              Still unsure about something?
            </p>
            <a
              href={WA_QUESTION}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp inline-flex min-h-[48px] items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-bold transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
