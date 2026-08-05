import { Link } from 'react-router-dom';
import { Home, Sparkles, Tag, Phone, Calculator } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BrandLogo from '../components/BrandLogo';

// Branded 404.
//
// Two things have to be true for this to actually work, and only one of them
// lives in React:
//
//   1. This component renders for an unknown path in the running app, so a
//      client-side navigation to a bad link does not dump the visitor on a
//      blank screen. That is the `path="*"` route in AppRoutes.
//   2. The SERVER returns HTTP 404. That is not React's job — prerender.mjs
//      writes this page to dist/404.html and vercel.json no longer rewrites
//      unmatched paths to /index.html. Without that second half the page would
//      look right and still report 200, which is the bug this replaces: every
//      unknown URL served the homepage with a success status, so Google indexed
//      duplicates and a missing asset came back as HTML instead of an error.
//
// Deliberately noindex (set in prerender.mjs): a 404 must never be indexed.

const LINKS = [
  { to: '/', icon: Home, label: 'Home', hint: 'Start again from the top' },
  { to: '/#services', icon: Sparkles, label: 'Services', hint: 'Carpet, sofa, end of tenancy and more' },
  { to: '/pricing', icon: Tag, label: 'Pricing', hint: 'Fixed prices, no hidden fees' },
  { to: '/#contact', icon: Phone, label: 'Contact', hint: 'Call, WhatsApp or email us' },
];

export default function NotFoundPage() {
  return (
    <>
      <Navbar />

      <main id="main-content" className="navy-gradient px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            {/* inverse: the wordmark's default #1268D9 is unreadable on the
                navy gradient this page sits on. */}
            <BrandLogo inverse />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
            Error 404
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            We couldn&rsquo;t find that page
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-silver-200 sm:text-lg">
            The link may be out of date, or the address may have a typo in it. Everything below
            still works &mdash; including a quote in about a minute.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/#quote"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-royal-500 px-7 py-3.5 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-royal-600 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              <Calculator size={20} aria-hidden="true" />
              Get a quote
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              <Home size={20} aria-hidden="true" />
              Back to home
            </Link>
          </div>

          <nav aria-label="Popular pages" className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-silver-300">
              Or try one of these
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {LINKS.map(({ to, icon: Icon, label, hint }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-left transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"
                    >
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">{label}</span>
                      <span className="block truncate text-sm text-silver-300">{hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>

      <Footer />
    </>
  );
}
