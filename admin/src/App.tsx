import { lazy, Suspense } from 'react';
import ClientPackPage from './pages/ClientPackPage';

// The customer viewer does not initialize CRM authentication or Supabase browser auth.
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));
export default function App() {
  if (window.location.pathname === '/report-view') return <ClientPackPage />;
  return <Suspense fallback={<p className="p-6">Loading…</p>}><AuthenticatedApp /></Suspense>;
}
