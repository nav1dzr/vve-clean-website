import { useAuth } from '../auth/AuthContext';

// Shown when a Supabase session is valid but the account is not present in
// admin_users. Never renders any booking/customer data — there is none to
// render on this path in the first place.
export default function UnauthorisedPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-silver-100 px-6 text-center">
      <h1 className="font-semibold text-xl text-navy-950">Access not authorised</h1>
      <p className="max-w-sm text-sm text-navy-700">
        This account is signed in but is not set up as an admin user. Contact
        the site owner if you believe this is a mistake.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-navy-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
      >
        Sign out
      </button>
    </div>
  );
}
