import { ClipboardCheck, ListChecks, Flame, Camera, RefreshCw } from 'lucide-react';
import { EOT_GUARANTEE_HOURS } from '../../data/pricing';

// A numbered-steps explainer for the "How We Clean" process page. Unlike the
// Carpet/Sofa process sections, there's no equipment-in-action footage
// specific to end of tenancy cleaning to show here (EotResultsSection already
// covers the real before/after photos elsewhere) — so this is genuinely new
// UI, not a reuse of an existing component. Every fact below is already
// published on EndOfTenancyPage.tsx; nothing new is asserted here.
const STEPS = [
  {
    icon: ClipboardCheck,
    title: 'Arrival & walkthrough',
    body: 'Our team arrives in your confirmed window and walks the property against the checklist before starting, so we know exactly what needs covering.',
  },
  {
    icon: ListChecks,
    title: 'Room-by-room clean',
    body: 'Every item on the 67-point agency checklist — the same standard letting agents check at inventory — kitchens, bathrooms, bedrooms and living areas, cupboards, skirting boards and internal windows.',
  },
  {
    icon: Flame,
    title: 'Appliances, included free',
    body: 'Oven, hob, extractor filter and grill, cleaned inside and out. There is no separate appliance charge to worry about.',
  },
  {
    icon: Camera,
    title: 'Photographic receipt',
    body: 'We photograph the finished clean so you have dated evidence to share with your letting agent or landlord.',
  },
  {
    icon: RefreshCw,
    title: `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
    body: `If your agent or landlord flags anything within ${EOT_GUARANTEE_HOURS} hours of completion, we return and fix it for free.`,
  },
];

export default function EotProcessSection() {
  return (
    <section id="process" className="scroll-mt-24 bg-[#f0f7ff] py-16 px-4" aria-label="End of tenancy cleaning process">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
            How we clean for end of tenancy
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
            The same five steps on every Complete Agency-Ready clean, so nothing gets missed.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-royal-500 text-white text-xs font-bold">
                    {i + 1}
                  </span>
                  <Icon size={20} className="text-royal-500" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold text-navy-900 text-base leading-snug mb-1.5">
                  {step.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
