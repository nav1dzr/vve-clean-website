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
  return (
    <figure className="relative mx-auto w-full min-w-0 max-w-xl">
      {/* Decorative glow. The horizontal spread is clamped to 12px on phones
          because the hero's own padding is only px-4 (16px): at the authored
          -inset-5 (20px) the glow reached 4px past each edge of the viewport and
          made /sofa-cleaning-london the one route with horizontal overflow.
          It only bit below 608px — above that max-w-xl stops the figure filling
          the column, leaving slack — so the full spread is restored from sm up
          and the design is unchanged at every width where it fits. Vertical
          spread is untouched; nothing constrains it. */}
      <div aria-hidden="true" className="absolute -inset-y-5 -inset-x-3 sm:-inset-x-5 rounded-[2rem] bg-gradient-to-br from-sky-400/20 to-fuchsia-400/10 blur-2xl" />
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/20 bg-navy-950 shadow-2xl shadow-black/30 sm:aspect-[3/2] lg:aspect-[4/3]">
        <img
          src="/images/sofa-cleaning-hero.webp"
          alt="Professional upholstery cleaning on a purple armchair beside a teal sofa"
          width={1536}
          height={1025}
        loading="eager"
        decoding="async"
        className="h-full w-full object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/10 to-transparent" />

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-navy-950/75 px-3 py-1.5 text-xs font-bold text-sky-200 shadow-lg backdrop-blur-sm sm:left-5 sm:top-5">
          <ShieldCheck size={15} aria-hidden="true" />
          Sofa &amp; upholstery cleaning
        </div>

        <figcaption className="absolute inset-x-0 bottom-0 p-5 text-left sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Fabric-first care</p>
          <p className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">Fabric checked before cleaning</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-200">
            Professional hot-water extraction, matched to the upholstery in front of us.
          </p>
        </figcaption>
      </div>
    </figure>
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
