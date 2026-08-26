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
    q: 'Do I need to be home during the clean?',
    a: 'No. Most end of tenancy customers leave keys with us or with the agent. We send photos when the job is done and return keys however suits you.',
  },
  {
    q: 'Do you bring equipment and products?',
    a: 'Yes. We bring the equipment and cleaning products needed for the booked work. If a surface needs a specialist treatment outside the agreed scope, we will discuss it before adding anything to the price.',
  },
  {
    q: 'When do I pay?',
    a: "You pay a £30 deposit by secure card when you submit a booking request. It is deducted from the final total. We confirm availability separately, and the remaining balance is due on completion under the payment terms shown during booking.",
  },
  {
    q: 'Can the price change?',
    a: 'Our prices are fixed for normal condition properties based on the details provided. If we arrive and the property has heavy soiling, mould, excessive rubbish, biohazard contamination, strong odours, pet accidents, or large/permanent stains, we will explain the issue and confirm any revised price before starting.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'You can cancel or reschedule without charge until 12pm on the day before the confirmed appointment. Later changes are handled under our cancellation terms. Message us as soon as possible if your plans change.',
  },
  {
    q: 'How quickly can you come?',
    a: 'Availability changes by service, area and property size. Send your preferred date in the booking request or ask us on WhatsApp before paying if the timing is critical.',
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
    a: 'We will contact you with the closest alternatives we can offer. If none of them works for you, we refund your £30 deposit in full. We start the refund within one business day of you telling us, and it reaches your card within 14 business days — usually sooner, as the exact timing depends on your bank.',
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

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const WA_QUESTION = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20quick%20question';

export default function FAQ({ standalone = false }: { standalone?: boolean }) {
  return (
    <>
      {/* JSON-LD FAQPage schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
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
            {FAQS.map(({ q, a }) => (
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
