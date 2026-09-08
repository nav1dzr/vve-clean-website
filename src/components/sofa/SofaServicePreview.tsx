import ServiceHeroPhoto from '../ServiceHeroPhoto';
import {
  CheckCircle2,
  Clock3,
  Droplets,
  Search,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react';

const PROCESS = [
  {
    icon: Search,
    step: '01',
    title: 'Inspect and test',
    body: 'We check the fabric, care label and dye stability before applying any product.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'Treat problem areas',
    body: 'Visible marks and heavily used areas receive focused pre-treatment first.',
  },
  {
    icon: Droplets,
    step: '03',
    title: 'Extract and rinse',
    body: 'Professional hot-water extraction lifts embedded soil without soaking the fabric.',
  },
  {
    icon: Wind,
    step: '04',
    title: 'Final check and dry',
    body: 'We inspect the cushions with you and explain how to help the upholstery dry evenly.',
  },
];

export function SofaHeroPanel() {
  return <ServiceHeroPhoto src="/sofa_upholstery/web/gallery/sofa-gallery-01.webp" alt="A technician cleaning sofa upholstery" caption="Upholstery cleaning in progress" detail="The fabric, care label and colour test guide the cleaning method. Delicate fabrics need assessment first." />;
}

export function SofaCareGuide() {
  return (
    <section className="overflow-hidden border-y border-slate-200 bg-white px-4 py-20" aria-labelledby="sofa-process-heading">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-end gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">A careful process</p>
            <h2 id="sofa-process-heading" className="mt-3 font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
              The right method starts with the fabric.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Upholstery behaves differently from carpet. We inspect first, work section by section and set honest expectations for older stains before cleaning begins.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-navy-800">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2"><ShieldCheck size={17} className="text-sky-600" /> Fabric-safety test</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2"><Clock3 size={17} className="text-sky-600" /> Typical drying: 3–6 hours</span>
            </div>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {PROCESS.map(({ icon: Icon, step, title, body }) => (
              <li key={step} className="relative rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-950 text-sky-300">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm font-bold text-sky-600">{step}</span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-navy-800">
          <CheckCircle2 size={20} className="mt-0.5 flex-none text-sky-600" aria-hidden="true" />
          <p><strong>Honest result expectations:</strong> fresh marks usually respond best. Older or previously treated stains can leave a residual shadow, and we will explain that before proceeding.</p>
        </div>
      </div>
    </section>
  );
}
