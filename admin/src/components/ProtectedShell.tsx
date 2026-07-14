import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/bookings', label: 'Bookings' },
  { to: '/search', label: 'Search' },
];

function navLinkClasses(isActive: boolean) {
  return `flex min-h-11 flex-1 items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset ${
    isActive ? 'text-sky-600' : 'text-navy-700 hover:text-navy-950'
  }`;
}

// The only content ever rendered inside this shell is what RequireAuth has
// already confirmed belongs to a verified admin (ADMIN_CRM_PLAN.md §8).
export default function ProtectedShell() {
  const { admin, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-silver-100">
      <header className="flex items-center justify-between border-b border-silver-300 bg-white px-4 py-3">
        <span className="font-semibold text-navy-950">VVE Admin</span>
        <div className="flex items-center gap-3">
          {admin && <span className="hidden text-sm text-navy-700 sm:inline">{admin.displayName}</span>}
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 transition-colors hover:bg-silver-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:hidden"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Desktop nav: Home / Bookings / Search / Logout, per ADMIN_CRM_PLAN.md
          Phase 2 §11. The header's own Log out button (above) stays as the
          mobile logout affordance, since the mobile bottom nav is
          deliberately Home/Bookings/Search only — matching what the spec
          lists for mobile vs. desktop navigation. */}
      <nav className="hidden border-b border-silver-300 bg-white px-4 sm:flex" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => navLinkClasses(isActive)}>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-11 flex-1 items-center justify-center text-sm font-medium text-navy-700 transition-colors hover:text-navy-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset"
        >
          Logout
        </button>
      </nav>

      <main className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-silver-300 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Primary"
      >
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => navLinkClasses(isActive)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
