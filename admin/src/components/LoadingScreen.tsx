// Rendered while auth/session state is being resolved. Intentionally blank of
// any protected content — this is what prevents a flash of admin data before
// authentication and authorisation are confirmed (ADMIN_CRM_PLAN.md §8).
export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-screen items-center justify-center bg-silver-100"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"
        aria-hidden="true"
      />
    </div>
  );
}
