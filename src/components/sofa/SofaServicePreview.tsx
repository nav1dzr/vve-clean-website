import {
  Armchair,
  BedDouble,
  CheckCircle2,
  Clock3,
  Droplets,
  Search,
  ShieldCheck,
  Sofa,
  Sparkles,
  Wind,
} from 'lucide-react';

const CLEANABLE_ITEMS = [
  { icon: Sofa, label: 'Fabric sofas' },
  { icon: Armchair, label: 'Armchairs' },
  { icon: BedDouble, label: 'Mattresses' },
  { icon: Sparkles, label: 'Dining chairs' },
];

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
  return (
    <div className="relative mx-auto max-w-lg" aria-label="Sofa and upholstery cleaning overview">
      <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-sky-400/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.08] p-6 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">One visit, more than sofas</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">Upholstery care around your home</h2>
          </div>
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-sky-400 text-navy-950 shadow-lg shadow-sky-500/20">
            <Sofa size={25} aria-hidden="true" />
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {CLEANABLE_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/10 bg-navy-950/35 px-4 py-3">
              <Icon size={21} className="flex-none text-sky-300" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy-950">
          <ShieldCheck size={22} className="flex-none text-royal-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Fabric checked before cleaning</p>
            <p className="text-xs text-slate-500">We tell you first if extraction is not suitable.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SofaCareGuide() {
  return (
    <section className="overflow-hidden border-y border-slate-200 bg-white px-4 py-20" aria-labelledby="sofa-process-heading">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-end gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">A careful process</p>
            <h2 id="sofa-process-heading" className="mt-3 font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
              Built around the fabric, not a one-size-fits-all clean.
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
