import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import ProtectedShell from './components/ProtectedShell';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardHome from './pages/DashboardHome';
import BookingListPage from './pages/BookingListPage';
import BookingDetailPage from './pages/BookingDetailPage';
import SearchPage from './pages/SearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            element={
              <RequireAuth>
                <ProtectedShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardHome />} />
            <Route path="/bookings" element={<BookingListPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
