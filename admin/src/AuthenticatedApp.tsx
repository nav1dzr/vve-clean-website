import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom';
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
import ReceiptEditorPage from './pages/ReceiptEditorPage';
import ReceiptDetailPage from './pages/ReceiptDetailPage';
import CustomerListPage from './pages/CustomerListPage';
import CustomerFormPage from './pages/CustomerFormPage';
import CustomerEmailPage from './pages/CustomerEmailPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CatalogueListPage from './pages/CatalogueListPage';
import MediaManagerPage from './pages/MediaManagerPage';
import EnquiriesPage from './pages/EnquiriesPage';
import WebsitePricebookPage from './pages/WebsitePricebookPage';
import CompletionReportsPage from './pages/CompletionReportsPage';
import ClientPacksPage from './pages/ClientPacksPage';

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<AuthProvider><Outlet /></AuthProvider>}>
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
      <Route path="/catalogue" element={<CatalogueListPage />} />
      <Route path="/media" element={<MediaManagerPage />} />
      <Route path="/enquiries" element={<EnquiriesPage />} />
      <Route path="/website-prices" element={<WebsitePricebookPage />} />
      <Route path="/receipts" element={<ReceiptListPage />} />
      <Route path="/client-packs" element={import.meta.env.VITE_CLIENT_PACKS_ENABLED === 'true' ? <ClientPacksPage /> : <p className="p-6">Customer report packs are not enabled in this environment yet.</p>} />
      <Route path="/completion-reports" element={import.meta.env.VITE_COMPLETION_REPORTS_ENABLED === 'true' ? <CompletionReportsPage /> : <p className="p-6">Completion reports are not enabled in this environment yet.</p>} />
      <Route path="/receipts/new" element={<ReceiptEditorPage />} />
      <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
      <Route path="/customers" element={<CustomerListPage />} />
      <Route path="/customers/new" element={<CustomerFormPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/customers/:id/email" element={<CustomerEmailPage />} />
      <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
));

export default function AuthenticatedApp() {
  return <RouterProvider router={router} />;
}
