import { Link } from 'react-router-dom';
import {
  Building2,
  KeyRound,
  Paintbrush,
  Sparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import type { HomepageQuoteService } from './HomeServiceSelector';
import {
  EOT_BASE_PRICES_P,
  MOVEIN_BASE_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  CARPET_MIN_BOOKING_P,
  EOT_GUARANTEE_HOURS,
} from '../data/pricing';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

type ServiceCard = {
  title: string;
  price: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  iconColour: string;
  iconBackground: string;
  quoteService?: HomepageQuoteService;
  pageHref?: string;
  ctaHref?: string;
  ctaExternal?: boolean;
};

const services: ServiceCard[] = [
  {
    title: 'End of tenancy cleaning',
    price: `FROM £${EOT_BASE_PRICES_P.studio / 100} FIXED`,
    description:
      `Vacant properties only. Inside cupboards, appliances, oven cleaning, bathrooms and internal windows are covered by the published scope. ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee.`,
    cta: 'Get your price →',
    quoteService: 'end_of_tenancy' as HomepageQuoteService,
    pageHref: '/end-of-tenancy-cleaning-london',
    icon: KeyRound,
    iconColour: 'text-amber-600',
    iconBackground: 'bg-amber-50',
  },
  {
    title: 'Move-in deep clean',
    price: `FROM £${MOVEIN_BASE_PRICES_P.studio / 100} FIXED`,
    description:
      'A vacant-property deep clean before you move in — or between tenancies for landlords. Start fresh in a property cleaned to checklist standard.',
    cta: 'Get your price →',
    quoteService: 'move_in' as HomepageQuoteService,
    icon: Sparkles,
    iconColour: 'text-violet-600',
    iconBackground: 'bg-violet-50',
  },
  {
    title: 'After builders clean',
    price: `FROM £${AFTER_BUILDERS_START_FROM_P / 100}`,
    description:
      'Fine dust, paint specks, sticker residue and debris. Send photos on WhatsApp so we can review the scope.',
    cta: 'WhatsApp a photo →',
    ctaHref: WA_LINK,
    ctaExternal: true,
    icon: Paintbrush,
    iconColour: 'text-cyan-700',
    iconBackground: 'bg-cyan-50',
  },
  {
    title: 'Carpet & upholstery',
    price: `FROM £${CARPET_MIN_BOOKING_P / 100}`,
    description:
      'Hot-water extraction for suitable carpets and upholstery. Rugs can be assessed as an add-on to a qualifying clean.',
    cta: 'Get your price →',
    quoteService: 'carpet_upholstery' as HomepageQuoteService,
    pageHref: '/carpet-cleaning-london',
    icon: Waves,
    iconColour: 'text-blue-600',
    iconBackground: 'bg-blue-50',
  },
  {
    title: 'Commercial & communal',
    price: 'TAILORED QUOTE',
    // Contract terms, out-of-hours access and invoicing arrangements are
    // agreed per site in the written scope — they are not standing offers, so
    // the card points at the enquiry rather than promising them.
    description:
      'Offices, shops, cafés and the communal hallways of residential blocks. Tell us your site and access needs and we will quote against a written scope.',
    cta: 'For businesses →',
    ctaHref: '/commercial',
    icon: Building2,
    iconColour: 'text-emerald-700',
    iconBackground: 'bg-emerald-50',
  },
];

export default function Services({ onChoose }: { onChoose: (service: HomepageQuoteService) => void }) {
  const { ref, visible } = useReveal();

  return (
    <section id="services" ref={ref} className="bg-surface py-20 scroll-mt-24 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-royal-700">Our main services</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-950 mb-4 tracking-tight">
            Choose what you need cleaned
          </h2>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            See a clear starting price, then build your quote or send the details we need. Requesting a preferred time does not require payment.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <article
                key={s.title}
                className={`group flex min-h-[280px] flex-col rounded-2xl border border-line bg-white p-5 text-navy-950 shadow-[0_12px_38px_rgba(16,36,62,0.08)] transition-all duration-700 hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_20px_48px_rgba(16,36,62,0.13)] motion-reduce:transform-none ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${s.iconBackground} ${s.iconColour}`} aria-hidden="true">
                  <Icon size={25} strokeWidth={1.8} />
                </span>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-royal-700">{s.price}</p>
                <h3 className="font-display text-lg font-bold leading-snug text-navy-950">
                  {s.pageHref ? <Link to={s.pageHref} className="transition-colors hover:text-royal-700">{s.title}</Link> : s.title}
                </h3>
                <p className="mb-5 mt-3 flex-1 text-sm leading-relaxed text-muted">
                  {s.description}
                </p>
                {s.ctaExternal ? (
                  <a
                    href={s.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-whatsapp inline-flex items-center justify-center gap-1.5 self-start px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1aa851]"
                  >
                    {s.cta}
                  </a>
                ) : s.quoteService ? (
                  <button
                    type="button"
                    onClick={() => s.quoteService && onChoose(s.quoteService)}
                    className="inline-flex min-h-[44px] items-center justify-center self-start rounded-lg bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-royal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    {s.cta}
                  </button>
                ) : s.ctaHref?.startsWith('/') ? (
                  <Link
                    to={s.ctaHref}
                    className="inline-flex min-h-[44px] items-center justify-center self-start rounded-lg bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-royal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    {s.cta}
                  </Link>
                ) : (
                  <a
                    href={s.ctaHref}
                    className="inline-flex min-h-[44px] items-center justify-center self-start rounded-lg bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-royal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    {s.cta}
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
