import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import ProtectedShell from './components/ProtectedShell';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardHome from './pages/DashboardHome';
import BookingListPage from './pages/BookingListPage';
import BookingDetailPage from './pages/BookingDetailPage';
import SearchPage from './pages/SearchPage';
import InvoiceListPage from './pages/InvoiceListPage';
import InvoiceEditorPage from './pages/InvoiceEditorPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import ReceiptListPage from './pages/ReceiptListPage';
import ReceiptDetailPage from './pages/ReceiptDetailPage';
import CustomerListPage from './pages/CustomerListPage';
import CustomerFormPage from './pages/CustomerFormPage';
import CustomerDetailPage from './pages/CustomerDetailPage';

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
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/new" element={<InvoiceEditorPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/receipts" element={<ReceiptListPage />} />
            <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
            <Route path="/customers" element={<CustomerListPage />} />
            <Route path="/customers/new" element={<CustomerFormPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
