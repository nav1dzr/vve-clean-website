import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import GoogleBadge from './GoogleBadge';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileStickyFooter from './MobileStickyFooter';
import Gallery from './Gallery';
import Reviews from './Reviews';
import { BookingProvider } from '../context/BookingContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ServiceBenefit {
  icon: ReactNode;
  title: string;
  body: string;
}

export interface ServiceFaq {
  q: string;
  a: string;
}

// The movable middle sections between the hero/quote (always first) and the
// final CTA (always last). Pages default to DEFAULT_SECTION_ORDER below —
// that preserves today's exact layout for every page that doesn't opt in.
// A page only needs `sectionOrder` when it wants a different reading order
// (e.g. moving real proof media directly under its quote); omitting a key
// simply skips that section for that page.
export type ServiceSectionKey =
  | 'intro'
  | 'benefits'
  | 'gallery'
  | 'reviews'
  | 'why'
  | 'pricing'
  | 'media'
  | 'faq'
  | 'related';

const DEFAULT_SECTION_ORDER: ServiceSectionKey[] = [
  'intro', 'benefits', 'gallery', 'reviews', 'why', 'pricing', 'media', 'faq', 'related',
];

export interface ServiceLandingData {
  // Schema
  schema: string;
  breadcrumb: string;

  // Hero
  eyebrow: string;
  h1: string;
  h1Highlight: string;
  heroSubtitle?: string;
  heroBadges: string[];
  heroBgImage?: string;
  // Optional higher-resolution desktop variant of heroBgImage (served at
  // ≥1024px via <picture>). If the file is missing the <img> error handler
  // falls back to heroBgImage, so the hero never renders broken.
  heroBgImageDesktop?: string;
  heroTrustLine?: string;
  // Renders the compact Google rating badge directly below the hero CTAs
  // (replaces the faint ★ text trust line as the primary trust signal).
  heroGoogleBadge?: boolean;
  // Tightens mobile-only vertical spacing in the hero so the CTAs, Google
  // badge and trust line all fit above the sticky footer on short screens
  // (e.g. 360×741). Desktop (≥640px) spacing is unchanged.
  heroCompactMobile?: boolean;
  primaryHref: string;
  primaryLabel: string;
  primaryIsWa?: boolean;
  secondaryHref: string;
  secondaryLabel: string;
  secondaryIsWa?: boolean;

  // Optional section rendered directly after the hero (before Intro) — used
  // for the compact, service-specific quote calculator so it sits as close
  // to the top of the page as the design allows.
  afterHeroSection?: React.ReactNode;

  // Intro
  introH2: string;
  introText: string;

  // Benefits
  benefitsH2: string;
  benefits: ServiceBenefit[];

  // Why VVE Clean
  whyH2: string;
  whyPoints: string[];

  // Pricing
  pricingH2: string;
  pricingIntro: string;
  pricingRows?: { label: string; price: string }[];
  pricingNote?: string;
  pricingCta: { href: string; label: string; isWa?: boolean };

  // Content for the optional 'media' section (e.g. page-specific proof
  // gallery). Rendered wherever 'media' falls in sectionOrder — between
  // Pricing and FAQ by default, but a page can reorder it (e.g. directly
  // under its quote) via sectionOrder without renaming this field.
  afterPricingSection?: React.ReactNode;

  // FAQ
  faqs: ServiceFaq[];

  // Related services
  relatedLinks: { href: string; label: string }[];

  // Final CTA
  ctaH2: string;
  ctaBody: string;
  ctaPrimary: { href: string; label: string; isWa?: boolean };
  ctaSecondary: { href: string; label: string; isTel?: boolean };

  // Optional reading order for the movable middle sections (see
  // ServiceSectionKey). Defaults to DEFAULT_SECTION_ORDER — every existing
  // page keeps its current layout unless it explicitly opts into a
  // different order.
  sectionOrder?: ServiceSectionKey[];
}

// ── Shared primitives ──────────────────────────────────────────────────────────

const WA_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const CAL_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
        <path
          d="M12 2C8.5 2 6 5 6 8c0 4 6 14 6 14s6-10 6-14c0-3-2.5-6-6-6zm0 9a3 3 0 110-6 3 3 0 010 6z"
          fill={dark ? '#7dd3fc' : '#0ea5e9'}
          opacity="0.4"
        />
        <circle cx="12" cy="8" r="2.5" fill={dark ? '#7dd3fc' : '#0ea5e9'} />
      </svg>
      <span className={`text-xs font-semibold tracking-[0.2em] uppercase ${dark ? 'text-sky-300' : 'text-sky-600'}`}>
        {children}
      </span>
    </div>
  );
}

function CtaButton({
  href,
  label,
  isWa,
  variant = 'primary',
}: {
  href: string;
  label: string;
  isWa?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const base =
    'inline-flex items-center gap-2.5 font-bold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base w-full sm:w-auto justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const primaryCls = isWa
    ? `${base} btn-whatsapp`
    : `${base} bg-royal-500 hover:bg-royal-600 text-white`;
  // WhatsApp is a brand-recognised action — give it the same solid green
  // treatment used everywhere else on the site (btn-whatsapp), even when it's
  // rendered in the "secondary" hero slot, rather than the plain outlined
  // style used for non-WhatsApp secondary actions.
  const secondaryCls = isWa
    ? `${base} btn-whatsapp`
    : `${base} border-2 border-white/40 hover:border-white text-white hover:bg-white/10`;
  const external = href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:');

  return external ? (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className={variant === 'primary' ? primaryCls : secondaryCls}
    >
      {isWa && WA_SVG}
      {!isWa && variant === 'primary' && CAL_SVG}
      {label}
    </a>
  ) : (
    <Link to={href} className={variant === 'primary' ? primaryCls : secondaryCls}>
      {isWa && WA_SVG}
      {!isWa && variant === 'primary' && CAL_SVG}
      {label}
    </Link>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

// Hero photo with an optional desktop-resolution variant. The <source> is
// removed on error so a missing desktop asset falls back to the mobile image
// instead of rendering a broken hero.
function HeroBackground({ mobile, desktop }: { mobile: string; desktop: string }) {
  const [desktopOk, setDesktopOk] = useState(true);
  return (
    <picture>
      {desktopOk && <source media="(min-width: 1024px)" srcSet={desktop} />}
      <img
        src={mobile}
        alt=""
        aria-hidden="true"
        decoding="async"
        onError={() => setDesktopOk(false)}
        className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
      />
    </picture>
  );
}

export default function ServiceLandingLayout({ data }: { data: ServiceLandingData }) {
  const heroReveal    = useReveal();
  const introReveal   = useReveal();
  const benefitsReveal = useReveal();
  const whyReveal     = useReveal();
  const pricingReveal = useReveal();
  const faqReveal     = useReveal();
  const relatedReveal = useReveal();
  const ctaReveal     = useReveal();

  const sections: Record<ServiceSectionKey, ReactNode> = {
    intro: (
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div
          ref={introReveal.ref}
          className={`transition-all duration-700 ${introReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <Eyebrow>About this service</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight text-center mb-5">
            {data.introH2}
          </h2>
          <p className="text-slate-600 text-base leading-relaxed text-center">{data.introText}</p>
        </div>
      </section>
    ),

    benefits: (
      <section className="bg-[#f0f7ff] py-16 px-4">
        <div
          ref={benefitsReveal.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${benefitsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-12">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
              {data.benefitsH2}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.benefits.map((b, i) => (
              <div
                key={b.title}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="mb-4 text-royal-500" aria-hidden="true">{b.icon}</div>
                <h3 className="font-display font-bold text-navy-900 text-lg leading-snug mb-2">{b.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    gallery: <Gallery />,

    reviews: <Reviews />,

    why: (
      <section className="bg-navy-900 py-16 px-4">
        <div
          ref={whyReveal.ref}
          className={`max-w-4xl mx-auto transition-all duration-700 ${whyReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <Eyebrow dark>Why choose us</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              {data.whyH2}
            </h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
            {data.whyPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-silver-200 text-sm leading-relaxed">
                <span className="text-[#F6B62B] font-bold text-base mt-0.5 flex-shrink-0">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),

    pricing: (
      <section className="max-w-3xl mx-auto px-4 py-20">
        <div
          ref={pricingReveal.ref}
          className={`transition-all duration-700 ${pricingReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
              {data.pricingH2}
            </h2>
            <p className="text-slate-500 text-sm mt-3 max-w-lg mx-auto">{data.pricingIntro}</p>
          </div>

          {data.pricingRows && data.pricingRows.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-navy-900 px-6 py-4">
                <p className="font-mono text-silver-400 text-xs tracking-widest uppercase">VVE Clean · Fixed Prices</p>
              </div>
              <div className="divide-y divide-dashed divide-slate-200">
                {data.pricingRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-6 py-4 gap-4">
                    <span className="text-slate-700 text-sm">{row.label}</span>
                    <span className="font-mono text-navy-900 font-bold text-sm whitespace-nowrap tabular-nums">
                      {row.price}
                    </span>
                  </div>
                ))}
              </div>
              {data.pricingNote && (
                <div className="border-t border-dashed border-slate-200 px-6 py-4 bg-slate-50">
                  <p className="text-slate-500 text-xs leading-relaxed">{data.pricingNote}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md text-center">
              <p className="text-slate-600 text-base leading-relaxed mb-6">{data.pricingNote}</p>
            </div>
          )}

          <div className="flex justify-center mt-8">
            {data.pricingCta.isWa ? (
              <a
                href={data.pricingCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp inline-flex items-center gap-2.5 font-bold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {WA_SVG}
                {data.pricingCta.label}
              </a>
            ) : (
              <Link
                to={data.pricingCta.href}
                className="inline-flex items-center gap-2 bg-royal-500 hover:bg-royal-600 text-white font-bold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {data.pricingCta.label}
              </Link>
            )}
          </div>
        </div>
      </section>
    ),

    media: data.afterPricingSection,

    faq: (
      <section className="bg-[#f0f7ff] py-16 px-4">
        <div
          ref={faqReveal.ref}
          className={`max-w-3xl mx-auto transition-all duration-700 ${faqReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <Eyebrow>FAQs</Eyebrow>
            <h2 className="font-display text-3xl font-bold text-navy-900">Common questions</h2>
          </div>
          <ul className="faq-list">
            {data.faqs.map((faq) => (
              <li key={faq.q} className="faq-item">
                <details>
                  <summary className="faq-summary">
                    <span className="faq-question">{faq.q}</span>
                    <span className="faq-icon" aria-hidden="true">+</span>
                  </summary>
                  <div className="faq-answer"><p>{faq.a}</p></div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),

    related: (
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div
          ref={relatedReveal.ref}
          className={`transition-all duration-700 ${relatedReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="font-display text-xl font-bold text-navy-900 mb-5 text-center">
            Other services
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {data.relatedLinks.map((link) => {
              const external = link.href.startsWith('http');
              return external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-royal-500 text-slate-700 hover:text-royal-600 text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 bg-white hover:bg-royal-50"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-royal-500 text-slate-700 hover:text-royal-600 text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 bg-white hover:bg-royal-50"
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    ),
  };

  return (
    <BookingProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: data.schema }}
      />

      <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
        <Navbar />

        {/* ── Breadcrumb ── */}
        <nav
          aria-label="Breadcrumb"
          className="pt-24 pb-2 px-4 max-w-7xl mx-auto"
        >
          <ol className="flex items-center gap-2 text-xs text-silver-500 flex-wrap">
            <li>
              <Link to="/" className="hover:text-navy-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true" className="text-silver-300">›</li>
            <li className="text-navy-700 font-medium">{data.breadcrumb}</li>
          </ol>
        </nav>

        {/* ── 1. HERO ── */}
        <section
          className={`relative ${data.heroCompactMobile ? 'pt-6 pb-16 sm:pt-8 sm:pb-20' : 'pt-8 pb-20'} px-4${!data.heroBgImage ? ' navy-gradient' : ''}`}
          style={data.heroBgImage && !data.heroBgImageDesktop ? {
            backgroundImage: `url(${data.heroBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
          } : undefined}
        >
          {data.heroBgImage && data.heroBgImageDesktop && (
            <HeroBackground mobile={data.heroBgImage} desktop={data.heroBgImageDesktop} />
          )}
          {data.heroBgImage && (
            <div className="absolute inset-0 bg-gradient-to-b from-navy-900/90 via-navy-900/80 to-navy-900/88" aria-hidden="true" />
          )}
          <div
            ref={heroReveal.ref}
            className={`relative z-10 max-w-4xl mx-auto text-center transition-all duration-700 ${heroReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <Eyebrow dark>{data.eyebrow}</Eyebrow>
            <h1 className={`font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight ${data.heroSubtitle ? 'mb-3' : 'mb-5'}`}>
              {data.h1}
              {data.h1Highlight && (
                <>
                  <br className="hidden sm:block" />
                  <span className="text-gradient-metallic">{data.h1Highlight}</span>
                </>
              )}
            </h1>
            {data.heroSubtitle && (
              <p className={`text-silver-200 text-base sm:text-lg ${data.heroCompactMobile ? 'mb-4 sm:mb-6' : 'mb-6'}`}>{data.heroSubtitle}</p>
            )}

            <div className={`flex flex-wrap justify-center gap-x-6 gap-y-2 ${data.heroCompactMobile ? 'mb-5 sm:mb-8' : 'mb-8'} text-silver-400 text-sm`}>
              {data.heroBadges.map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <span className="text-sky-400 font-bold">✓</span> {badge}
                </span>
              ))}
            </div>

            <div className={`flex flex-col sm:flex-row items-center justify-center ${data.heroCompactMobile ? 'gap-3 sm:gap-4' : 'gap-4'}`}>
              <CtaButton href={data.primaryHref} label={data.primaryLabel} isWa={data.primaryIsWa} variant="primary" />
              <CtaButton href={data.secondaryHref} label={data.secondaryLabel} isWa={data.secondaryIsWa} variant="secondary" />
            </div>
            {data.heroGoogleBadge && (
              <div className={`${data.heroCompactMobile ? 'mt-4 sm:mt-5' : 'mt-5'} flex justify-center`}>
                <GoogleBadge />
              </div>
            )}
            {data.heroTrustLine && (
              <p className={`${data.heroCompactMobile ? 'mt-3 sm:mt-4' : 'mt-4'} text-silver-200 text-xs tracking-wide`}>{data.heroTrustLine}</p>
            )}
          </div>
        </section>

        {/* ── 1b. SERVICE-SPECIFIC QUOTE (optional, directly after hero) ── */}
        {data.afterHeroSection}

        {/* ── 2-9. MOVABLE MIDDLE SECTIONS — see data.sectionOrder ── */}
        {(data.sectionOrder ?? DEFAULT_SECTION_ORDER).map((key) => (
          <Fragment key={key}>{sections[key]}</Fragment>
        ))}

        {/* ── 10. FINAL CTA ── */}
        <section
          ref={ctaReveal.ref}
          className={`navy-gradient py-20 px-4 transition-all duration-700 ${ctaReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="max-w-2xl mx-auto text-center">
            <Eyebrow dark>Get started</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {data.ctaH2}
            </h2>
            <p className="text-silver-300 text-base mb-10 leading-relaxed">{data.ctaBody}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {data.ctaPrimary.isWa ? (
                <a
                  href={data.ctaPrimary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp inline-flex items-center gap-2.5 font-bold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base w-full sm:w-auto justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {WA_SVG}
                  {data.ctaPrimary.label}
                </a>
              ) : (
                <Link
                  to={data.ctaPrimary.href}
                  className="inline-flex items-center gap-2.5 bg-royal-500 hover:bg-royal-600 text-white font-bold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base w-full sm:w-auto justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {CAL_SVG}
                  {data.ctaPrimary.label}
                </Link>
              )}
              {data.ctaSecondary.isTel ? (
                <a
                  href={data.ctaSecondary.href}
                  className="inline-flex items-center gap-2 border-2 border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:bg-white/10 text-base w-full sm:w-auto justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {data.ctaSecondary.label}
                </a>
              ) : (
                <Link
                  to={data.ctaSecondary.href}
                  className="inline-flex items-center gap-2 border-2 border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 min-h-[44px] rounded-xl transition-all duration-200 hover:bg-white/10 text-base w-full sm:w-auto justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {data.ctaSecondary.label}
                </Link>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </div>

      <MobileStickyFooter />
    </BookingProvider>
  );
}
