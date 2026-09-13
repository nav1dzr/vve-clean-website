import { Component, Suspense, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { clientPages } from './clientRoutePages';
import { ROUTE_READY_EVENT } from './lib/routeReady';

class RouteLoadingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main id="main-content" className="mx-auto max-w-xl px-5 py-20">
      <h1 className="font-display text-3xl font-bold text-navy-950">This page couldn’t load</h1>
      <p role="alert" className="mt-4 leading-relaxed text-slate-700">Please reload the page to try again. Your saved cleaning selection stays in your basket.</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-[44px] rounded-xl bg-royal-600 px-5 py-3 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">Reload page</button>
      <p className="mt-5"><a href="/" className="font-semibold text-royal-700 underline underline-offset-4">Return to the homepage</a></p>
    </main>;
    return this.props.children;
  }
}

function RouteReady({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  // This effect commits only after the suspended page is ready. A slow chunk
  // must not make #quote navigation or keyboard focus miss its destination.
  // Query-only changes (such as gallery tabs) keep their own focus and scroll.
  useEffect(() => { window.dispatchEvent(new Event(ROUTE_READY_EVENT)); }, [pathname, hash]);
  return children;
}

export default function ClientAppRoutes() {
  const { pathname } = useLocation();
  return <RouteLoadingBoundary key={pathname}>
    <Suspense fallback={<main id="main-content" aria-busy="true" className="mx-auto max-w-xl px-5 py-20"><p role="status" className="text-base text-slate-700">Loading page…</p></main>}>
      <RouteReady><AppRoutes pages={clientPages} /></RouteReady>
    </Suspense>
  </RouteLoadingBoundary>;
}
