import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Modal from './Modal';
import { useAuth } from '../auth/useAuth';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/bookings', label: 'Bookings' },
  { to: '/enquiries', label: 'Enquiries' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/receipts', label: 'Receipts' },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/media', label: 'Media' },
  { to: '/website-prices', label: 'Website prices' },
  { to: '/customers', label: 'Customers' },
  { to: '/search', label: 'Search' },
];

const mobileNavItems = navItems.filter((item) => ['/', '/bookings', '/invoices'].includes(item.to));
const moreNavItems = navItems.filter((item) => !mobileNavItems.includes(item));

function navLinkClasses(isActive: boolean) {
  return `flex min-h-11 min-w-24 flex-1 items-center justify-center px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset ${
    isActive ? 'text-sky-600' : 'text-navy-700 hover:text-navy-950'
  }`;
}

// The only content ever rendered inside this shell is what RequireAuth has
// already confirmed belongs to a verified admin (ADMIN_CRM_PLAN.md §8).
export default function ProtectedShell() {
  const { admin, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const menuOpen = menuPath === pathname;
  const moreActive = moreNavItems.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  function closeMenu() {
    setMenuPath(null);
    moreButton.current?.focus();
  }

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 640px)');
    const closeOnDesktop = () => { if (desktop.matches) setMenuPath(null); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

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

      <nav className="hidden overflow-x-auto border-b border-silver-300 bg-white px-4 sm:flex" aria-label="Primary">
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
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-silver-300 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Primary"
      >
        {mobileNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex min-h-12 items-center justify-center px-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${isActive ? 'bg-sky-50 text-sky-700' : 'text-navy-700'}`}>
            {item.label}
          </NavLink>
        ))}
        <button ref={moreButton} type="button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuPath(pathname)} className={`min-h-12 px-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${moreActive ? 'bg-sky-50 text-sky-700' : 'text-navy-700'}`}>
          More
        </button>
      </nav>
      {menuOpen && (
        <div className="sm:hidden">
          <Modal titleId="crm-navigation-title" title="More in your CRM" onClose={closeMenu}>
            <nav aria-label="More CRM sections" className="grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
              {moreNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={closeMenu} className={({ isActive }) => `flex min-h-12 items-center rounded-xl border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-sky-400 ${isActive ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-silver-300 text-navy-900 hover:bg-silver-100'}`}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </Modal>
        </div>
      )}
    </div>
  );
}
