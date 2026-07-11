import { Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

const serviceLinks = [
  'Window Cleaning',
  'Move-In / Move-Out Deep Clean',
  'End of Tenancy',
  'Office & Commercial',
];

const quickLinks = [
  { label: 'Get a Quote', href: '/#quote', external: false },
  { label: 'Price Guide', href: '/pricing', external: false },
  { label: 'Book via WhatsApp', href: WA_LINK, external: true },
  { label: 'Our Services', href: '/#services', external: false },
  { label: 'Before & After', href: '/#gallery', external: false },
  { label: 'Areas We Cover', href: '/#areas', external: false },
  { label: 'Contact Us', href: '/#contact', external: false },
];

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size, height: size }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand column */}
          <div>
            <div className="flex flex-col leading-none gap-0.5 mb-4">
              <div className="font-display font-bold text-4xl tracking-widest leading-none">
                <span className="text-white">V</span><span style={{ color: '#b8960c' }}>V</span><span className="text-white">E</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="block h-px w-4" style={{ background: '#b8960c' }} />
                <span className="text-[9px] tracking-[0.25em] font-semibold uppercase text-silver-400">CLEAN</span>
                <span className="block h-px w-4" style={{ background: '#b8960c' }} />
              </div>
            </div>
            <p className="text-silver-400 text-sm leading-relaxed mb-2">
              London's premium cleaning and property services. Specialising in commercial sites, empty     properties, and exterior cleaning.
            </p>
            <p className="text-royal-400 text-xs mb-5">Serving East &amp; North London — E1, E2, E8, E9, E14, E15, E17, E20, N1, N4, N5, N7, N8, N10, N15, N16, N17, N19, N22, NW1, NW5</p>
            <div className="flex gap-3">
              <a href="https://www.facebook.com/share/1LXXHgnhvc/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all duration-200 hover:opacity-90" style={{ backgroundColor: '#1877F2' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="https://www.instagram.com/vve__clean?igsh=MWo1OHVpdHNsN2k5cg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all duration-200 hover:opacity-90" style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all duration-200 hover:opacity-90" style={{ backgroundColor: '#25D366' }}>
                <WhatsAppIcon size={16} />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5">Services</h4>
            <ul className="space-y-2.5">
              {serviceLinks.map((s) => (
                <li key={s}>
                  <a href="/#services" className="text-silver-400 text-sm hover:text-white transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-royal-500 group-hover:bg-royal-300 transition-colors flex-shrink-0" />
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5">Quick Links</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target={l.external ? '_blank' : undefined}
                    rel={l.external ? 'noopener noreferrer' : undefined}
                    className="text-silver-400 text-sm hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-royal-500 group-hover:bg-royal-300 transition-colors flex-shrink-0" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-5">Contact</h4>
            <ul className="space-y-4">
              {/* Calling line */}
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-royal-500/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="text-royal-400" size={14} />
                </div>
                <div>
                  <div className="text-silver-500 text-[10px] uppercase tracking-widest mb-0.5">Call Us</div>
                  <a href="tel:02080502233" className="text-silver-200 text-sm font-semibold hover:text-white transition-colors">
                    020 8050 2233
                  </a>
                </div>
              </li>
              {/* WhatsApp line */}
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: '#25D366' }}>
                  <WhatsAppIcon size={14} />
                </div>
                <div>
                  <div className="text-silver-500 text-[10px] uppercase tracking-widest mb-0.5">WhatsApp</div>
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
                    className="text-green-400 text-sm font-semibold hover:text-green-300 transition-colors">
                    07845 451111
                  </a>
                </div>
              </li>
            </ul>

            {/* WhatsApp CTA — directly under the numbers */}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 w-full text-white font-semibold py-2 rounded-lg transition-all duration-200 text-xs hover:opacity-90"
              style={{ backgroundColor: '#25D366' }}>
              <WhatsAppIcon size={13} /> Chat on WhatsApp
            </a>

            <ul className="space-y-4 mt-4">
              <li className="flex items-start gap-3">
                <Mail className="text-royal-400 flex-shrink-0 mt-0.5" size={15} />
                <a href="mailto:contact@vveclean.co.uk" className="text-silver-300 text-sm hover:text-white transition-colors">
                  contact@vveclean.co.uk
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="text-royal-400 flex-shrink-0 mt-0.5" size={15} />
                <div>
                  <span className="text-silver-300 text-sm block">VVE Limited</span>
                  <span className="text-silver-300 text-sm block">23-25 Queensway</span>
                  <span className="text-silver-500 text-xs block">London, W2 4QP</span>
                  <span className="text-silver-500 text-xs block">Company Registration Number 17234391</span>
                  
                  <span className="text-silver-600 text-xs italic mt-1 block">Visits by appointment only. Please book before visiting.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-silver-600 text-xs">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>&copy; {new Date().getFullYear()} VVE Clean Ltd. All rights reserved. Registered in England &amp; Wales.</span>
            <span className="hidden sm:inline text-silver-800">|</span>
            <span className="text-silver-500">Company Registration Number: <span className="text-silver-400 font-medium">17234391</span></span>
          </div>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-silver-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-silver-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
