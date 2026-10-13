import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import CarpetCleaningPage from './CarpetCleaningPage';
import SofaCleaningPage from './SofaCleaningPage';
import EndOfTenancyPage from './EndOfTenancyPage';
import AfterBuildersPage from './AfterBuildersPage';
import CommercialCarpetPage from './CommercialCarpetPage';
import HowWeCleanCarpetsPage from './HowWeCleanCarpetsPage';
import HowWeCleanSofasPage from './HowWeCleanSofasPage';
import HowWeCleanEndOfTenancyPage from './HowWeCleanEndOfTenancyPage';
import CommercialPage from './CommercialPage';
import AreaPage from './AreaPage';
import { AREAS } from '../data/areas';
import { DEPOSIT_P, penceToDisplay } from '../data/pricing';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({
    matches: false, addEventListener() {}, removeEventListener() {},
  }) });
});
const pages = [CarpetCleaningPage, SofaCleaningPage, EndOfTenancyPage, AfterBuildersPage,
  CommercialCarpetPage, HowWeCleanCarpetsPage, HowWeCleanSofasPage, HowWeCleanEndOfTenancyPage];
const wrap = (node: React.ReactNode) => <MemoryRouter><CookieConsentProvider>{node}</CookieConsentProvider></MemoryRouter>;
describe('deposit reassurance beside service hero actions', () => {
  it.each(pages)('%s keeps configured deposit beside existing actions without a payment CTA', (Page) => {
    const { container } = render(wrap(<Page />));
    const actions = container.querySelector('.service-hero-actions')!;
    expect(actions).toBeInTheDocument();
    expect(actions.nextElementSibling).toHaveTextContent(`No payment now. Once we agree the details, a ${penceToDisplay(DEPOSIT_P)} deposit secures your booking and comes off the total.`);
    expect(actions.querySelectorAll('a')).toHaveLength(2);
    expect(actions).not.toHaveTextContent(/pay now|pay £30/i);
  });
  it('covers local landing pages through the shared layout', () => {
    const { container } = render(wrap(<AreaPage area={AREAS[0]} />));
    expect(container.querySelector('.service-hero-actions')?.nextElementSibling).toHaveTextContent('£30 deposit');
  });
  it('keeps commercial site visits free and any deposit conditional on the written quote', () => {
    const { container } = render(wrap(<CommercialPage />));
    expect(container).toHaveTextContent('No payment to request a site visit. If a £30 booking deposit is required');
    expect(container).toHaveTextContent('Commercial payment is due after the clean');
  });
});
