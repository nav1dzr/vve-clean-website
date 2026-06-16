import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { SERVICE_IMAGES } from '../data/services';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

const services = [
  {
    title: 'End of tenancy cleaning',
    price: 'FROM £159 FIXED',
    priceFixed: true,
    description:
      'Vacant properties only. Our 67-point agency checklist: inside cupboards, appliances, oven included free, bathrooms descaled, internal windows. 48-hour re-clean guarantee.',
    cta: 'Get your price →',
    ctaHref: '#quote',
    featured: true,
    badge: 'Most booked',
    img: SERVICE_IMAGES.endOfTenancy,
  },
  {
    title: 'Move-in deep clean',
    price: 'FROM £139 FIXED',
    priceFixed: true,
    description:
      'A vacant-property deep clean before you move in — or between tenancies for landlords. Start fresh in a property cleaned to checklist standard.',
    cta: 'Get your price →',
    ctaHref: '#quote',
    featured: false,
    img: SERVICE_IMAGES.deepCleaning,
  },
  {
    title: 'After builders clean',
    price: 'FROM £199',
    priceFixed: false,
    description:
      'Fine dust, paint specks, sticker residue and debris. Final price confirmed after a quick photo via WhatsApp — we\'ll reply within the hour.',
    cta: 'WhatsApp a photo →',
    ctaHref: WA_LINK,
    ctaExternal: true,
    featured: false,
    img: SERVICE_IMAGES.officeService,
  },
  {
    title: 'Carpet & upholstery',
    price: 'FROM £85',
    priceFixed: false,
    description:
      'Professional hot-water extraction for carpets, rugs and sofas. Removes stains, odours and allergens. Dry in hours, not days.',
    cta: 'Get your price →',
    ctaHref: '#quote',
    featured: false,
    img: SERVICE_IMAGES.deepCleaning,
  },
  {
    title: 'Commercial & communal',
    price: 'TAILORED QUOTE',
    priceFixed: false,
    description:
      'Offices, shops, cafés and the communal hallways of residential blocks. Contract cleaning, out-of-hours visits, monthly invoicing.',
    cta: 'For businesses →',
    ctaHref: '/commercial',
    featured: false,
    img: SERVICE_IMAGES.officeService,
  },
  {
    title: 'Window cleaning',
    price: 'FROM £45',
    priceFixed: false,
    description:
      'Interior and exterior, streak-free, up to second-floor reach. Add to any clean or book on its own.',
    cta: 'WhatsApp for a quote →',
    ctaHref: WA_LINK,
    ctaExternal: true,
    featured: false,
    img: SERVICE_IMAGES.windowCleaning,
  },
  {
    title: 'Pressure washing',
    price: 'FROM £120',
    priceFixed: false,
    description:
      'Driveways, patios, decking, paths and bin areas jet-washed back to their original colour. Instant kerb-appeal for sales and lettings.',
    cta: 'WhatsApp a photo →',
    ctaHref: WA_LINK,
    ctaExternal: true,
    featured: false,
    img: SERVICE_IMAGES.pressureWashing,
  },
  {
    title: 'Garden services',
    price: 'FROM £45',
    priceFixed: false,
    description:
      'Lawn mowing, hedge trimming, weeding and garden tidy-ups with green-waste removal. Send a photo of your garden — priced in minutes.',
    cta: 'WhatsApp a photo →',
    ctaHref: WA_LINK,
    ctaExternal: true,
    featured: false,
    img: SERVICE_IMAGES.gardeningService,
  },
];

export default function Services() {
  const { ref, visible } = useReveal();

  return (
    <section id="services" ref={ref} className="py-24 bg-[#f5f5f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1c2b1e] mb-4 tracking-tight">
            Fixed-price cleaning, no surprises
          </h2>
          <p className="text-[#4a5c4d] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Every price below is what you actually pay — equipment and products included. We specialise in vacant properties, business premises and outdoor work.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <div
              key={i}
              className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-700 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              } ${
                s.featured
                  ? 'bg-[#1c3d24] text-white shadow-xl'
                  : 'bg-white text-[#1c2b1e] shadow-sm border border-stone-200/80 hover:shadow-md'
              }`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              {/* Badge */}
              {s.badge && (
                <div className="px-5 pt-4">
                  <span className="inline-block bg-[#d4a017] text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                    {s.badge}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className={`flex flex-col flex-1 px-5 ${s.badge ? 'pt-3' : 'pt-5'} pb-5`}>
                <h3 className={`font-display text-xl font-bold leading-snug mb-1 ${s.featured ? 'text-white' : 'text-[#1c2b1e]'}`}>
                  {s.title}
                </h3>
                <p className={`text-[11px] font-bold tracking-widest uppercase mb-3 ${s.featured ? 'text-[#d4a017]' : 'text-[#1c7a4a]'}`}>
                  {s.price}
                </p>
                <p className={`text-sm leading-relaxed flex-1 mb-6 ${s.featured ? 'text-white/80' : 'text-[#4a5c4d]'}`}>
                  {s.description}
                </p>
                {'ctaExternal' in s && s.ctaExternal ? (
                  <a
                    href={s.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm font-semibold transition-colors ${s.featured ? 'text-white hover:text-[#d4a017]' : 'text-[#1c7a4a] hover:text-[#155f39]'}`}
                  >
                    {s.cta}
                  </a>
                ) : s.ctaHref.startsWith('/') ? (
                  <Link
                    to={s.ctaHref}
                    className={`text-sm font-semibold transition-colors ${s.featured ? 'text-white hover:text-[#d4a017]' : 'text-[#1c7a4a] hover:text-[#155f39]'}`}
                  >
                    {s.cta}
                  </Link>
                ) : (
                  <a
                    href={s.ctaHref}
                    className={`text-sm font-semibold transition-colors ${s.featured ? 'text-white hover:text-[#d4a017]' : 'text-[#1c7a4a] hover:text-[#155f39]'}`}
                  >
                    {s.cta}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
