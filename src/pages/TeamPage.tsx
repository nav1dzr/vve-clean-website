import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

// Six placeholder slots for the owner to fill in later — real photo, name and
// role for each. Nothing here is invented; every field is deliberately a
// visible "coming soon" placeholder rather than a guessed name or job title.
// To add a real team member, replace one slot's `photo` with an image path
// and set `name` / `role`.
const TEAM_SLOTS: { photo: string | null; name: string | null; role: string | null }[] = [
  { photo: null, name: null, role: null },
  { photo: null, name: null, role: null },
  { photo: null, name: null, role: null },
  { photo: null, name: null, role: null },
  { photo: null, name: null, role: null },
  { photo: null, name: null, role: null },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
      <Navbar />
      <main id="main-content">

        {/* Hero */}
        <div className="navy-gradient pt-32 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Our Team</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Meet the team
            </h1>
            <p className="text-silver-200 text-base sm:text-lg max-w-xl mx-auto">
              VVE Clean started with three friends, and we're growing carefully from there. Full profiles are
              on their way — here's where you'll find them.
            </p>
          </div>
        </div>

        {/* Team grid */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {TEAM_SLOTS.map((member, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-full aspect-square rounded-2xl bg-silver-100 border border-dashed border-silver-300 flex items-center justify-center mb-3">
                  <User className="text-silver-400" size={40} aria-hidden="true" />
                </div>
                <p className="text-navy-800 font-semibold text-sm">
                  {member.name ?? 'Name coming soon'}
                </p>
                <p className="text-silver-500 text-xs">
                  {member.role ?? 'Role coming soon'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-silver-500 text-sm text-center mt-10">
            Photos and profiles are being added as the team grows — check back soon.
          </p>
        </section>

        {/* CTA */}
        <section className="bg-white border-t border-silver-200 py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold text-navy-900 mb-3">
              Want to know more about how we started?
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-royal-500 hover:bg-royal-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-md"
              >
                Read our story
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] btn-whatsapp font-semibold px-6 py-3 rounded-lg transition-all duration-200"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl"
        style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}>
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href="tel:02080502233"
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            Call us
          </a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm btn-whatsapp transition-colors">
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
