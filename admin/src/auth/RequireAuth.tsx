import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import UnauthorisedPage from '../pages/UnauthorisedPage';

// Wraps every protected route. No child is rendered — and no data-fetching
// child can mount — until `status === 'authenticated'`. This is what
// satisfies "No customer data can load before authentication and admin
// authorisation complete" (ADMIN_CRM_PLAN.md §8).
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (status === 'unauthorized') {
    return <UnauthorisedPage />;
  }

  if (status === 'error') {
    return <ErrorScreen onRetry={retry} />;
  }

  return <>{children}</>;
}
