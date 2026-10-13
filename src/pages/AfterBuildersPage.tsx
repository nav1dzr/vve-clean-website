import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import AfterBuildersContent, { AfterBuildersQuoteCard } from '../components/AfterBuildersContent';
import { BUILDERS_FAQS, BUILDERS_PRICES, BUILDERS_WHATSAPP } from '../data/afterBuildersContent';
import { AFTER_BUILDERS_START_FROM_P, penceToDisplay } from '../data/pricing';
import './after-builders.css';
import { Phone } from 'lucide-react';

const PAGE_URL = 'https://www.vveclean.co.uk/after-builders-cleaning-london';
const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'After Builders Cleaning London', item: PAGE_URL },
      ],
    },
    {
      '@type': 'Service',
      name: 'After Builders Cleaning London',
      description: `After-builders cleaning from ${penceToDisplay(AFTER_BUILDERS_START_FROM_P)}. Fixed written quotations after assessment of the rooms, dust, residue, finishes and access.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: ['East London', 'North London'],
      url: PAGE_URL,
      offers: BUILDERS_PRICES.map((price) => ({
        '@type': 'Offer',
        name: `After Builders — ${price.label}`,
        priceSpecification: { '@type': 'PriceSpecification', minPrice: price.pence / 100, priceCurrency: 'GBP' },
        description: `From ${penceToDisplay(price.pence)}. Starting guide only; the final cleaning list and fixed price require assessment. ${price.note}`,
        url: `${PAGE_URL}#builders-prices`,
      })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: BUILDERS_FAQS.map((faq) => ({
        '@type': 'Question', name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'After Builders Cleaning London',
  eyebrow: 'After renovation · East & North London',
  h1: 'After Builders Cleaning London',
  h1Highlight: '',
  heroSubtitle: 'The building work is done. Let us take care of the clean. Send photos of the dust, rooms and residue for a fixed quote before you book.',
  heroPriceChip: `From ${penceToDisplay(AFTER_BUILDERS_START_FROM_P)} · small renovation / one main area`,
  heroTaxNoteCompact: true,
  heroBadges: ['Fixed written quote', '£5m public liability insurance', 'Equipment and products supplied'],
  heroGoogleBadge: true,
  heroAside: <AfterBuildersQuoteCard />,
  heroAsideOnMobile: true,
  heroCompactMobile: true,
  primaryHref: BUILDERS_WHATSAPP,
  primaryLabel: 'WhatsApp a photo for a quote',
  primaryIsWa: true,
  secondaryHref: 'tel:02080502233',
  secondaryLabel: 'Call 020 8050 2233',
  mobileSecondaryAction: <a href="tel:02080502233" aria-label="Call VVE Clean on 020 8050 2233" data-track-location="after_builders_sticky_phone" className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-royal-700"><Phone size={18} aria-hidden="true" />Call us</a>,
  afterHeroSection: <AfterBuildersContent />,
  // This page uses the shared conversion shell with its own detailed sections.
  // Empty middle slots avoid a second price list or duplicated FAQ.
  introH2: '', introText: '', benefitsH2: '', benefits: [], whyH2: '', whyPoints: [],
  faqs: BUILDERS_FAQS,
  sectionOrder: ['related'],
  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/commercial', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/contact?service=after_builders', label: 'Send an enquiry' },
  ],
  ctaH2: 'Tell us what the builders have left.',
  ctaBody: 'We’ll review your photos and agree the cleaning list, fixed price and time with you. No payment is needed to ask for a quote.',
  ctaPrimary: { href: BUILDERS_WHATSAPP, label: 'WhatsApp photos for a quote', isWa: true },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function AfterBuildersPage() {
  return <div className="builders-page"><ServiceLandingLayout data={DATA} /></div>;
}
