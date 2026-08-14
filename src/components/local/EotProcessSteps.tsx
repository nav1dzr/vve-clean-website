import { EOT_GUARANTEE_HOURS } from '../../data/pricing';

// The same confirmed end-of-tenancy workflow described in prose elsewhere on
// the site (EndOfTenancyPage's FAQ/CTA copy) — shown here as a scannable
// numbered process. Universal by design: booking mechanics don't vary by
// area, so this is intentionally identical on every local page.
const STEPS = [
  {
    title: 'Get your instant quote',
    body: 'Build your fixed price online using the calculator above — choose Complete Agency-Ready cover or a Tailored Checklist.',
  },
  {
    title: 'Pay a £30 booking-request deposit',
    body: "It's deducted from your final bill, not an extra charge. We confirm availability within one business hour.",
  },
  {
    title: 'We clean to the 67-point checklist',
    body: "The team follows the same checklist standard your letting agent's clerk is likely to use.",
  },
  {
    title: 'Check the work before we leave',
    body: 'Inspect the property and sign off — the balance is only due once you\'re happy with the result.',
  },
  {
    title: `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
    body: 'If your agent flags anything within the guarantee window, we return to address it for free.',
  },
];

export default function EotProcessSteps() {
  return (
    <section className="bg-slate-50 py-16 px-4" aria-label="How our end of tenancy clean works">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
            How it works
          </h2>
        </div>
        <ol className="grid sm:grid-cols-2 gap-5">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-royal-500/10 text-royal-600 font-display font-bold text-sm flex items-center justify-center">
                  {i + 1}
                </span>
                <h3 className="font-display font-bold text-navy-900 text-base leading-snug">{step.title}</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
