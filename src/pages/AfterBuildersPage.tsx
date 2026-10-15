import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import AfterBuildersContent, { AfterBuildersQuoteCard } from '../components/AfterBuildersContent';
import AfterBuildersPhoto from '../components/AfterBuildersPhoto';
import { BUILDERS_FAQS, BUILDERS_WHATSAPP } from '../data/afterBuildersContent';
import './after-builders.css';
import { WhatsAppActionIcon } from '../components/MobileActionBar';

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
      description: 'After-builders cleaning in East and North London. Indicative budget ranges, with a fixed written quote after assessment of rooms, dust, residue, finishes and access.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: ['East London', 'North London'],
      url: PAGE_URL,
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
  heroSubtitle: 'The building work is done. Let us take care of the clean. Tell us about the rooms and dust; we’ll agree the cleaning list and total before you book.',
  heroPriceChip: 'See the budget guide. Get a fixed quote for your home.',
  heroTaxNoteCompact: true,
  heroBadges: ['Fixed written quote', '£5m public liability insurance', 'Equipment and products supplied'],
  heroGoogleBadge: true,
  heroAside: <div className="builders-hero-visual"><AfterBuildersPhoto slot="hero" /><AfterBuildersQuoteCard /></div>,
  heroAsideOnMobile: true,
  heroCompactMobile: true,
  primaryHref: '#builders-quote',
  primaryLabel: 'Get my cleaning quote',
  secondaryHref: BUILDERS_WHATSAPP,
  secondaryLabel: 'Send photos on WhatsApp',
  secondaryIsWa: true,
  mobileSecondaryAction: <a href={BUILDERS_WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp — send after-builders photos" data-track-location="after_builders_sticky_whatsapp" className="builders-mobile-whatsapp"><WhatsAppActionIcon /><span>WhatsApp</span></a>,
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
  ctaH2: 'Need to talk it through?',
  ctaBody: 'We’ll review your photos and agree the cleaning list, fixed price and time with you. No payment is needed to ask for a quote.',
  ctaPrimary: { href: '#builders-quote', label: 'Get my cleaning quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function AfterBuildersPage() {
  return <div className="builders-page"><ServiceLandingLayout data={DATA} /></div>;
}
