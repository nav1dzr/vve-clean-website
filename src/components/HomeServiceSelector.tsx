import {
  Armchair,
  ArrowRight,
  Waves,
  KeyRound,
  Paintbrush,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export type HomepageQuoteService =
  | 'carpet_upholstery'
  | 'carpet'
  | 'upholstery'
  | 'end_of_tenancy'
  | 'move_in'
  | 'after_builders';

type ServiceCard = {
  title: string;
  description: string;
  quoteService: HomepageQuoteService;
  icon: LucideIcon;
  colour: string;
  background: string;
  pageHref?: string;
};

const services: ServiceCard[] = [
  {
    title: 'Carpet Cleaning',
    description: 'Deep cleaning for fitted carpets and stubborn stains. Rugs can be assessed as an add-on.',
    quoteService: 'carpet',
    icon: Waves,
    colour: 'text-blue-600',
    background: 'bg-blue-50',
    pageHref: '/carpet-cleaning-london',
  },
  {
    title: 'Sofa & Upholstery',
    description: 'Refresh sofas, chairs, mattresses and soft furnishings.',
    quoteService: 'upholstery',
    icon: Armchair,
    colour: 'text-emerald-600',
    background: 'bg-emerald-50',
    pageHref: '/sofa-cleaning-london',
  },
  {
    title: 'End of Tenancy',
    description: 'A detailed clean built around move-out requirements.',
    quoteService: 'end_of_tenancy',
    icon: KeyRound,
    colour: 'text-amber-600',
    background: 'bg-amber-50',
    pageHref: '/end-of-tenancy-cleaning-london',
  },
  {
    title: 'Deep Cleaning',
    description: 'A thorough clean for empty homes before you move in.',
    quoteService: 'move_in',
    icon: Sparkles,
    colour: 'text-violet-600',
    background: 'bg-violet-50',
  },
  {
    title: 'After Builders',
    description: 'Careful removal of fine dust and post-work residue.',
    quoteService: 'after_builders',
    icon: Paintbrush,
    colour: 'text-cyan-700',
    background: 'bg-cyan-50',
    pageHref: '/after-builders-cleaning-london',
  },
];

interface Props {
  onChoose: (service: HomepageQuoteService) => void;
}

export default function HomeServiceSelector({ onChoose }: Props) {
  return (
    // Deliberately not id="services": the existing Services section further
    // down the homepage already owns that anchor, and Navbar, Footer,
    // BookingPage and LeafletPage all link to /#services. Two elements sharing
    // an id would send every one of those links to whichever came first.
    <section id="choose-service" className="bg-white py-16 scroll-mt-28 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-royal-700">Choose your service</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            What would you like cleaned today?
          </h2>
          <p className="mt-3 text-base text-muted">Start with a service, then build your quote using our existing live calculator.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {services.map(({ title, description, quoteService, icon: Icon, colour, background, pageHref }) => (
            <article
              key={title}
              className={`group flex flex-col rounded-2xl border border-line bg-white p-4 text-left shadow-[0_10px_35px_rgba(16,36,62,0.06)] transition duration-300 hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_18px_45px_rgba(16,36,62,0.11)] motion-reduce:transform-none sm:min-h-[235px] sm:p-5 ${title === 'After Builders' ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <span className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl sm:mb-5 sm:h-14 sm:w-14 sm:rounded-2xl ${background} ${colour}`}>
                <Icon size={24} strokeWidth={1.8} />
              </span>
              {pageHref ? (
                <Link
                  to={pageHref}
                  className="font-display text-base font-bold leading-tight text-navy-900 transition-colors hover:text-royal-700 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:text-lg"
                >
                  {title}
                </Link>
              ) : (
                <h3 className="font-display text-lg font-bold text-navy-900">{title}</h3>
              )}
              <p className="mt-2 flex-1 text-[13px] leading-5 text-muted sm:text-sm sm:leading-6">{description}</p>
              <div className="mt-3 flex flex-col items-start gap-1 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                <button
                  type="button"
                  onClick={() => onChoose(quoteService)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm font-bold text-royal-700 transition-colors hover:text-royal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                >
                  Get quote
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
                </button>
                {pageHref && (
                  <Link
                    to={pageHref}
                    className="inline-flex min-h-[44px] items-center text-xs font-semibold text-muted underline decoration-line underline-offset-4 transition-colors hover:text-navy-900 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    Service details
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
