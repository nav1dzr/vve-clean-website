const FAQS = [
  {
    q: 'How does the deposit-back guarantee work?',
    a: 'We clean to a 67-point checklist that mirrors the standard London letting-agency inventory form — the same document your check-out clerk uses. If the agent or landlord flags any cleaning issue within 48 hours of our visit, we come back and re-clean those areas free of charge. Cleaning is the single biggest cause of deposit deductions in London — this is how we remove it from the equation.',
  },
  {
    q: "What's included in an end of tenancy clean?",
    a: 'Every room, top to bottom: kitchen including inside cupboards and appliances, a full oven clean included free, bathrooms descaled, internal windows, skirting boards, doors, light switches and all floors. If your agent has a specific checklist, send it over — we\'ll work from theirs.',
  },
  {
    q: 'Are your cleaners insured and vetted?',
    a: 'Yes. Every cleaner is DBS-checked and we carry £5m public liability insurance. Happy to show certificates before your booking — just ask on WhatsApp.',
  },
  {
    q: 'Do I need to be home during the clean?',
    a: 'No. Most end of tenancy customers leave keys with us or with the agent. We send photos when the job is done and return keys however suits you.',
  },
  {
    q: 'Do you bring equipment and products?',
    a: 'Yes — everything is included in the price. Professional equipment, professional products. Nothing to provide, nothing extra to pay.',
  },
  {
    q: 'When do I pay?',
    a: "A £30 deposit is paid by secure card link when you submit your booking request (it comes off your total) — we confirm availability within one business hour. The balance is due on completion, after you've checked the work — card link, bank transfer or cash. Businesses are invoiced monthly with 14-day payment terms.",
  },
  {
    q: 'Can the price change?',
    a: 'Our prices are fixed for normal condition properties based on the details provided. If we arrive and the property has heavy soiling, mould, excessive rubbish, biohazard contamination, strong odours, pet accidents, or large/permanent stains, we will explain the issue and confirm any revised price before starting.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'Yes — free of charge until 12pm the day before your booking. After that the £30 deposit covers the reserved slot, since we\'ll have turned other work away for it. To move a booking, just message us on WhatsApp.',
  },
  {
    q: 'How quickly can you come?',
    a: 'Book by 12pm and we can usually clean the same day or next day. End-of-month slots go fastest — if you\'re moving out, book your date as soon as you have it.',
  },
  {
    q: 'Which areas do you cover?',
    a: 'East and North London: E1, E2, E3, E5, E8, E9, E10, E14, E15, E17, N1, N4, N5, N7, N15 and N16. Just outside? WhatsApp us — if we can\'t help, we\'ll recommend someone good who can.',
  },
  {
    q: 'Do you clean occupied homes?',
    a: 'Right now we specialise in vacant properties, commercial spaces and outdoor work — end of tenancy, move-in cleans, after-builders, offices, communal areas, windows, pressure washing and gardens. Regular cleaning of occupied homes is coming later once the team grows.',
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

export default function FAQ() {
  return (
    <>
      {/* JSON-LD FAQPage schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <section
        id="faq"
        className="py-20 px-4"
        style={{ background: '#F7FAF8' }}
      >
        <div style={{ maxWidth: 780, margin: '0 auto' }}>

          {/* Eyebrow */}
          <p
            className="text-center text-xs font-semibold tracking-[0.18em] uppercase mb-3"
            style={{ color: '#0E5E47', fontVariant: 'small-caps' }}
          >
            ✦ Questions
          </p>

          {/* Heading */}
          <h2
            className="text-center font-bold text-navy-900 mb-10"
            style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', lineHeight: 1.15 }}
          >
            Before you book
          </h2>

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
            <p className="text-sm mb-4" style={{ color: '#5C6E66' }}>
              Still unsure about something?
            </p>
            <a
              href={WA_QUESTION}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 font-bold text-navy-900 px-7 py-3.5 rounded-full transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 text-sm"
              style={{ background: 'linear-gradient(135deg, #d4a843 0%, #f0c85a 50%, #d4a843 100%)' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Ask us — we reply fast
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
