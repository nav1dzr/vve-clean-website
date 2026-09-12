import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CommercialPage from './CommercialPage';
import { COMMERCIAL_REGULAR_HOURLY_P } from '../data/pricing';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/commercial']}>
      <CookieConsentProvider>
        <CommercialPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('CommercialPage premium preview', () => {
  it('explains the enquiry journey without relying on stock photography', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /Commercial cleaning for offices, shops and residential blocks/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What your quote covers/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How to get a commercial quote/i })).toBeInTheDocument();
    expect(container.querySelectorAll('main img')).toHaveLength(0);
  });

  it('keeps commercial rates connected to the central pricing catalogue', () => {
    renderPage();
    expect(screen.getByText(`from £${COMMERCIAL_REGULAR_HOURLY_P / 100}/cleaner-hour`)).toBeInTheDocument();
  });

  it('keeps both WhatsApp and email enquiry routes visible', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: /site visit|WhatsApp your address/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('link', { name: /Email your requirements/i }).length).toBeGreaterThanOrEqual(2);
  });
});
