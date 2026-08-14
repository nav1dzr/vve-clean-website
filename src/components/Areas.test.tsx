// Only the five implemented local pages should be real links — every other
// area name must stay plain text so this section never links to a page that
// doesn't exist.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Areas from './Areas';
import { LOCAL_EOT_AREAS } from '../data/localEotAreas';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
});

function renderAreas() {
  return render(
    <MemoryRouter>
      <Areas />
    </MemoryRouter>,
  );
}

describe('Areas', () => {
  it('links each of the five implemented area names to its real local page', () => {
    renderAreas();
    for (const area of LOCAL_EOT_AREAS) {
      const link = screen.getByRole('link', { name: area.areaName });
      expect(link).toHaveAttribute('href', area.path);
    }
  });

  it('leaves every other area name as plain text, not a link', () => {
    renderAreas();
    const implementedNames = new Set(LOCAL_EOT_AREAS.map((a) => a.areaName));
    const otherNames = ['Shoreditch', 'Canary Wharf', 'Bethnal Green', 'Dalston', 'Bow', 'Stoke Newington', 'Finsbury Park', 'Highbury', 'Holloway', 'Tottenham', 'Crouch End', 'Wood Green', 'Highgate'];
    for (const name of otherNames) {
      expect(implementedNames.has(name)).toBe(false);
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
