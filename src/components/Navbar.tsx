import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Menu, X, Phone } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { trackPhoneClick } from '../lib/analytics';

// Max 5 links per the design spec — Reviews and Areas stay reachable by
// scrolling the homepage (not removed), just not repeated in the nav.
const navLinks = [
  { label: 'About',      href: '/about', route: true },
  { label: 'Gallery',    href: '/gallery', route: true },
  { label: 'Pricing',    href: '/pricing', route: true },
  { label: 'Commercial', href: '/commercial', route: true },
  { label: 'Contact',    href: '/contact', route: true },
];

const serviceLinks = [
  { label: 'End of Tenancy', description: 'Complete move-out cleaning', href: '/end-of-tenancy-cleaning-london' },
  { label: 'Carpet Cleaning', description: 'Professional extraction cleaning', href: '/carpet-cleaning-london' },
  { label: 'Sofa & Upholstery', description: 'Fabric-safe upholstery care', href: '/sofa-cleaning-london' },
  { label: 'After Builders', description: 'Fine dust and post-work cleaning', href: '/after-builders-cleaning-london' },
  { label: 'Commercial Cleaning', description: 'Offices, retail and communal areas', href: '/commercial' },
];

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 rounded';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const wasOpen = menuOpen;
        setMenuOpen(false);
        setServicesOpen(false);
        setMobileServicesOpen(false);
        if (wasOpen) requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setServicesOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [menuOpen]);

  return (
    <header
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 shadow-sm"
      style={{ background: 'rgba(249,249,245,0.94)', backdropFilter: 'blur(10px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 xl:h-20">
          {/* Logo */}
          <Link
            to="/"
            aria-label="VVE Clean home"
            className="flex flex-shrink-0 items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-600"
          >
            <BrandLogo compact className="w-[82px] sm:w-[92px]" />

            <span
              aria-hidden="true"
              className="mx-2 h-8 w-px bg-slate-300 sm:mx-3"
            />

            {/* 7px was unreadable on a phone. At 10px/11px the two-word wrap
                still fits the header without pushing the call, WhatsApp and
                menu controls, which keep their 44px targets. */}
            <span className="max-w-[76px] text-[10px] font-bold uppercase leading-[1.3] tracking-[0.06em] text-navy-700 sm:max-w-[96px] sm:text-[11px]">
              Cleaning &amp; Property Services
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden xl:flex items-center gap-7">
            <div className="relative">
              <button
                type="button"
                onClick={() => setServicesOpen((open) => !open)}
                aria-expanded={servicesOpen}
                aria-controls="desktop-services-menu"
                className={`nav-link inline-flex min-h-[44px] items-center gap-1 text-sm font-medium tracking-wide text-slate-700 transition-colors duration-200 hover:text-sky-600 ${FOCUS_RING}`}
              >
                Services
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {servicesOpen && (
                <div
                  id="desktop-services-menu"
                  className="absolute left-1/2 top-full mt-2 w-[340px] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-navy-950/15"
                >
                  <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">
                    Choose a service
                  </p>
                  {serviceLinks.map((service) => (
                    <Link
                      key={service.href}
                      to={service.href}
                      aria-label={`${service.label} ${service.description}`}
                      onClick={() => setServicesOpen(false)}
                      className="group flex min-h-[58px] items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-royal-600"
                    >
                      <span>
                        <span className="block text-sm font-bold text-navy-900 group-hover:text-royal-700">{service.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{service.description}</span>
                      </span>
                      <span aria-hidden="true" className="ml-4 text-sky-500 transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  ))}
                  <a
                    href="/#services"
                    onClick={() => setServicesOpen(false)}
                    className="mt-1 flex min-h-[44px] items-center justify-center rounded-xl bg-navy-950 px-4 text-sm font-bold text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
                  >
                    See every service
                  </a>
                </div>
              )}
            </div>
            {navLinks.map((link) =>
              link.route ? (
                <NavLink key={link.href} to={link.href}
                  className={({ isActive }) => `nav-link text-sm font-medium tracking-wide transition-colors duration-200 hover:text-sky-600 ${isActive ? 'text-royal-700' : 'text-slate-700'} ${FOCUS_RING}`}>
                  {link.label}
                </NavLink>
              ) : (
                <a key={link.href} href={link.href}
                  className={`nav-link text-slate-700 hover:text-sky-600 text-sm font-medium tracking-wide transition-colors duration-200 ${FOCUS_RING}`}>
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* Right side — phone/WhatsApp stay visibly secondary; "Get my
              price" is the one visually dominant CTA (solid brand blue). */}
          <div className="hidden xl:flex items-center gap-3">
            <a href="tel:02080502233" onClick={() => trackPhoneClick('navbar')}
              className={`flex items-center gap-1.5 text-slate-700 hover:text-sky-600 text-sm transition-colors ${FOCUS_RING}`}>
              <Phone size={13} />
              <span>020 8050 2233</span>
            </a>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 btn-whatsapp text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200 ${FOCUS_RING}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <Link to="/#quote"
              className={`inline-flex items-center gap-1.5 bg-royal-500 hover:bg-royal-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all duration-200 hover:shadow-md ${FOCUS_RING}`}>
              Get my price
            </Link>
          </div>

          {/* Mobile: compact header — logo + call/WhatsApp shortcuts +
              hamburger. Urgent mobile visitors can reach us in one tap;
              the persistent booking CTA stays in MobileStickyFooter. */}
          <div className="xl:hidden flex items-center gap-1">
            <a href="tel:02080502233"
              className={`text-slate-800 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center ${FOCUS_RING}`}
              aria-label="Call VVE Clean on 020 8050 2233">
              <Phone size={22} />
            </a>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              className={`text-[#075e54] p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center ${FOCUS_RING}`}
              aria-label="Chat with VVE Clean on WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <button
              ref={menuButtonRef}
              className={`text-slate-800 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center ${FOCUS_RING}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Removing the closed menu from the DOM prevents invisible links from
          remaining in the keyboard tab order. */}
      {menuOpen && <div id="mobile-nav-menu" className="xl:hidden overflow-hidden"
        style={{ background: 'rgba(249,249,245,0.96)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="px-4 py-6 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setMobileServicesOpen((open) => !open)}
              aria-expanded={mobileServicesOpen}
              aria-controls="mobile-services-list"
              className={`flex min-h-[44px] w-full items-center justify-between py-2.5 text-left font-medium text-slate-700 transition-colors hover:text-sky-600 ${FOCUS_RING}`}
            >
              Services
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {mobileServicesOpen && (
              <div id="mobile-services-list" className="mb-2 space-y-1 rounded-xl bg-sky-50 p-2">
                {serviceLinks.map((service) => (
                  <Link
                    key={service.href}
                    to={service.href}
                    onClick={() => {
                      setMenuOpen(false);
                      setMobileServicesOpen(false);
                    }}
                    className="flex min-h-[48px] items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600"
                  >
                    {service.label}
                    <span aria-hidden="true" className="text-sky-500">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {navLinks.map((link) =>
            link.route ? (
              <NavLink key={link.href} to={link.href} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `block hover:text-sky-600 font-medium py-2.5 min-h-[44px] border-b border-slate-100 transition-colors ${isActive ? 'text-royal-700' : 'text-slate-700'} ${FOCUS_RING}`}>
                {link.label}
              </NavLink>
            ) : (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className={`block text-slate-700 hover:text-sky-600 font-medium py-2.5 min-h-[44px] border-b border-slate-100 transition-colors ${FOCUS_RING}`}>
                {link.label}
              </a>
            )
          )}
          <Link to="/#quote" onClick={() => setMenuOpen(false)}
            className={`flex items-center justify-center min-h-[44px] mt-4 bg-royal-500 hover:bg-royal-600 text-white font-semibold rounded-lg transition-all duration-200 ${FOCUS_RING}`}>
            Get my price
          </Link>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-2 min-h-[44px] mt-2 btn-whatsapp font-semibold px-4 rounded-lg text-sm ${FOCUS_RING}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Chat on WhatsApp
          </a>
          <a href="tel:02080502233" onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-2 min-h-[44px] text-slate-600 text-sm ${FOCUS_RING}`}>
            <Phone size={14} /> 020 8050 2233
          </a>
        </div>
      </div>}
    </header>
  );
}
