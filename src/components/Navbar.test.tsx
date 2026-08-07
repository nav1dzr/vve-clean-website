import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navbar from './Navbar';

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar service navigation', () => {
  it('opens an accessible desktop menu with direct links to every core service page', async () => {
    const user = userEvent.setup();
    renderNavbar();

    const servicesButtons = screen.getAllByRole('button', { name: 'Services' });
    await user.click(servicesButtons[0]);

    expect(servicesButtons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /End of Tenancy Complete move-out cleaning/i })).toHaveAttribute('href', '/end-of-tenancy-cleaning-london');
    expect(screen.getByRole('link', { name: /Carpet Cleaning Professional extraction cleaning/i })).toHaveAttribute('href', '/carpet-cleaning-london');
    expect(screen.getByRole('link', { name: /Sofa & Upholstery Fabric-safe upholstery care/i })).toHaveAttribute('href', '/sofa-cleaning-london');
    expect(screen.getByRole('link', { name: /After Builders Fine dust and post-work cleaning/i })).toHaveAttribute('href', '/after-builders-cleaning-london');
    expect(screen.getByRole('link', { name: /Commercial Cleaning Offices, retail and communal areas/i })).toHaveAttribute('href', '/commercial');
  });

  it('removes the closed mobile menu from the DOM and restores trigger focus on Escape', async () => {
    const user = userEvent.setup();
    renderNavbar();

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(document.getElementById('mobile-nav-menu')).toBeNull();

    await user.click(trigger);
    expect(document.getElementById('mobile-nav-menu')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(document.getElementById('mobile-nav-menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
