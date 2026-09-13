import { ClipboardCheck, Brush, Droplets, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import LazyVideo from '../media/LazyVideo';
import { CARPET_PROCESS_VIDEO } from '../../data/carpetMedia';

const steps = [
 { icon: ClipboardCheck, title: 'Inspect & agree', body: 'We check the fibre, condition and visible marks, then agree what can be treated and the areas to clean.' },
 { icon: Brush, title: 'Prepare & treat', body: 'Accessible areas are prepared and suitable treatment is applied to loosen soiling. Individual stains are assessed separately.' },
 { icon: Droplets, title: 'Extract the soil', body: 'For suitable carpets, hot-water extraction lifts the loosened dirt and moisture from the pile. Delicate fibres may need another approach.' },
 { icon: Wind, title: 'Check & advise', body: 'We check the cleaned areas with you and explain drying and aftercare. Results vary; permanent marks and wear may remain.' },
];
export default function CarpetProcessSection({ compact = false }: { compact?: boolean }) {
 return <section id="process" className="scroll-mt-24 bg-sky-50 px-4 py-12 sm:py-16" aria-label="Carpet cleaning process"><div className="mx-auto max-w-6xl">
  <p className="text-xs font-bold uppercase tracking-[.18em] text-royal-700">What happens at your visit</p>
  <h2 className="mt-3 font-display text-3xl font-bold text-navy-950">How we clean your carpets</h2>
  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">A clear process, chosen for your carpet's fibre and condition.</p>
  <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(({icon: Icon,title,body},i) => <li key={title} className="rounded-2xl border border-sky-100 bg-white p-5"><div className="flex items-center justify-between text-royal-700"><span className="text-xs font-bold">0{i+1}</span><Icon size={23} aria-hidden="true" /></div><h3 className="mt-4 font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p></li>)}</ol>
  {compact ? <Link to="/carpet-cleaning-london#quote" className="mt-5 inline-flex min-h-[44px] items-center text-sm font-semibold text-royal-700 underline underline-offset-4">Choose rooms and see carpet prices</Link> : CARPET_PROCESS_VIDEO && <details data-disclosure="process-video" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer py-2 font-semibold text-navy-900">See extraction equipment in action</summary><div className="mt-4 max-w-3xl"><LazyVideo video={CARPET_PROCESS_VIDEO} className="aspect-video w-full" /></div></details>}
 </div></section>;
}
