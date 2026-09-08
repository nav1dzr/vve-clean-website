import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadWebsitePricebook } from './lib/websitePricebook';
import { isPrivatePage } from './lib/privatePage';
import './index.css';

async function start() {
  const host = document.getElementById('root')!;
  try {
    window.__VVE_PRICEBOOK__ = isPrivatePage()
      ? { id: 'bundled', version: 'bundled', overrides: {} }
      : await loadWebsitePricebook();
    // Price tables are created at module evaluation, so import after resolving the version.
    const { default: App } = await import('./App.tsx');
    createRoot(host).render(<StrictMode><App /></StrictMode>);
  } catch {
    createRoot(host).render(<main className="mx-auto max-w-xl px-5 py-20"><h1 className="font-display text-3xl font-bold text-navy-950">We couldn’t load the current price list</h1><p className="mt-4 leading-relaxed text-slate-700">Please try again, or contact VVE Clean to discuss your service and preferred date.</p><button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-royal-600 px-5 py-3 font-bold text-white">Try again</button><p className="mt-6"><a href="tel:02080502233" className="font-semibold text-royal-700 underline">Call 020 8050 2233</a></p><p className="mt-3"><a href="mailto:contact@vveclean.co.uk" className="text-royal-700 underline">Email VVE Clean</a></p></main>);
  }
}
void start();
