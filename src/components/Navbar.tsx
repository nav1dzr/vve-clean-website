import { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Services',  href: '/#services' },
  { label: 'Gallery',   href: '/#gallery' },
  { label: 'Reviews',   href: '/#reviews' },
  { label: 'Areas',     href: '/#areas' },
  { label: 'Commercial', href: '/commercial', route: true },
  { label: 'Pricing',   href: '/pricing',  route: true },
  { label: 'Contact',   href: '/#contact' },
];

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onPricing = location.pathname === '/pricing';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 shadow-sm"
      style={{ background: 'rgba(249,249,245,0.94)', backdropFilter: 'blur(10px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col leading-none gap-0.5">
              {/* VVE — first+last chars charcoal, middle V gold */}
              <div className="font-display font-bold text-4xl tracking-widest leading-none" style={{ color: '#1c1917' }}>
                <span>V</span><span style={{ color: '#b8960c' }}>V</span><span>E</span>
              </div>
              {/* CLEAN with thin gold lines either side */}
              <div className="flex items-center gap-1.5">
                <span className="block h-px w-4" style={{ background: '#b8960c' }} />
                <span className="text-[9px] tracking-[0.25em] font-semibold uppercase" style={{ color: '#1c1917' }}>CLEAN</span>
                <span className="block h-px w-4" style={{ background: '#b8960c' }} />
              </div>
            </div>
            <div className="w-px h-8 bg-slate-300 mx-1" />
            <span className="text-[9px] tracking-[0.15em] font-light uppercase leading-tight max-w-[80px]" style={{ color: '#1e3a5f' }}>
              Cleaning &<br />Property Services
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) =>
              link.route ? (
                <Link key={link.href} to={link.href}
                  className="nav-link text-sm font-medium tracking-wide transition-colors duration-200 text-slate-700 hover:text-sky-600">
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href}
                  className="nav-link text-slate-700 hover:text-sky-600 text-sm font-medium tracking-wide transition-colors duration-200">
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* Right CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <a href="tel:02080502233"
              className="flex items-center gap-1.5 text-slate-700 hover:text-sky-600 text-sm transition-colors">
              <Phone size={13} />
              <span>020 8050 2233</span>
            </a>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <a href="/#quote" className="btn-silver text-xs px-4 py-2.5">Get Instant Quote</a>
          </div>

          {/* Mobile Book Now button */}
          <a href="/#quote"
            className="lg:hidden flex items-center gap-1.5 bg-royal-500 hover:bg-royal-600 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-200">
            Pricing
          </a>

          <button className="lg:hidden text-slate-800 p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`lg:hidden transition-all duration-300 overflow-hidden ${menuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ background: 'rgba(249,249,245,0.96)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="px-4 py-6 space-y-4">
          {navLinks.map((link) =>
            link.route ? (
              <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)}
                className="block text-slate-700 hover:text-sky-600 font-medium py-2 border-b border-slate-100 transition-colors">
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className="block text-slate-700 hover:text-sky-600 font-medium py-2 border-b border-slate-100 transition-colors">
                {link.label}
              </a>
            )
          )}
          <a href="/#quote" onClick={() => setMenuOpen(false)} className="block mt-4 btn-silver text-center justify-center">
            Get Instant Quote
          </a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 mt-2 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg text-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Chat on WhatsApp
          </a>
          <a href="tel:02080502233" className="flex items-center gap-2 text-slate-600 text-sm pt-2">
            <Phone size={14} /> 020 8050 2233
          </a>
        </div>
      </div>
    </header>
  );
}
