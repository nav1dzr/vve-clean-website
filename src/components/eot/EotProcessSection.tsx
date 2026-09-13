import { ClipboardCheck, ListChecks, Flame, Camera, RefreshCw } from 'lucide-react';
import { EOT_GUARANTEE_HOURS } from '../../data/pricing';

// Process and inclusions drawn from the existing end of tenancy service scope.
const STEPS = [
  {
    icon: ClipboardCheck,
    title: 'Arrival & walkthrough',
    body: 'We walk through the vacant property, check the tasks in your quote and discuss any access or condition issues before starting.',
  },
  {
    icon: ListChecks,
    title: 'Room-by-room clean',
    body: 'We work through the booked kitchen, bathroom and living-area tasks, including accessible surfaces, skirting boards, internal windows and floors.',
  },
  {
    icon: Flame,
    title: 'Kitchen appliances',
    body: 'The oven, hob, grill and extractor are included in both packages. Complete also includes the listed appliance and storage interiors; Tailored includes those you select.',
  },
  {
    icon: Camera,
    title: 'Photographic receipt',
    body: 'We photograph the finished clean so you have dated evidence to share with your letting agent or landlord.',
  },
  {
    icon: RefreshCw,
    title: `${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`,
    body: `Report missed tasks from the agreed scope within ${EOT_GUARANTEE_HOURS / 24} days, with photos or an inspection report. We arrange one free return for covered work; the return date is agreed separately.`,
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
            From the first walkthrough to checking the finished work.
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

const INCLUSIONS = [
  { title: 'Kitchen and appliances', items: ['Oven, hob, grill and extractor', 'Inside the microwave, emptied fridge and defrosted freezer', 'Accessible dishwasher and washing-machine compartments', 'Empty cupboards and drawers, inside and out'] },
  { title: 'Bathrooms', items: ['Baths, showers, toilets and basins', 'Accessible tiles, grouting and fittings', 'Limescale cleaning; permanent staining and corrosion may remain'] },
  { title: 'Bedrooms and living areas', items: ['Empty wardrobes and storage interiors', 'Accessible internal windows', 'Skirting boards, doors, door frames and switches', 'Vacuuming and mopping suitable floors'] },
];

export function EotInclusions() {
  return (
    <section id="checklist" aria-labelledby="eot-inclusions-heading" className="scroll-mt-24 bg-white px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 id="eot-inclusions-heading" className="font-display text-3xl font-bold text-navy-900">What the Complete clean includes</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate-600">These are the cleaning tasks covered by our existing Complete package. The property must be vacant, with cupboards and appliances empty and accessible. We confirm the work for your property in your quote.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {INCLUSIONS.map(({ title, items }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-surface p-6">
              <h3 className="font-display text-xl font-bold text-navy-900">{title}</h3>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-600">
                {items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 border-t border-slate-200 pt-8 md:grid-cols-2">
          <div><h3 className="font-display text-xl font-bold text-navy-900">Choosing Tailored</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">Tailored includes the core property clean and the oven, hob, grill and extractor. Microwave, fridge/freezer, dishwasher, washing-machine and cupboard interiors are separate selections. Your quote lists the tasks you choose.</p></div>
          <div><h3 className="font-display text-xl font-bold text-navy-900">Work outside the package</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">Professional carpet extraction and upholstery cleaning are optional. Exterior windows, balconies and rubbish removal are outside the standard package. Repairs, appliance dismantling, wear and permanent damage are not cleaning tasks. Tell us about unusual conditions before booking.</p></div>
        </div>
      </div>
    </section>
  );
}
