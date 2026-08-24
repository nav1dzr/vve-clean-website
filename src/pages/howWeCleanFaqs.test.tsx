import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import HowWeCleanCarpetsPage from './HowWeCleanCarpetsPage';
import HowWeCleanSofasPage from './HowWeCleanSofasPage';
import HowWeCleanEndOfTenancyPage from './HowWeCleanEndOfTenancyPage';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const pages = [
  ['carpets', '/how-we-clean-carpets', <HowWeCleanCarpetsPage />],
  ['sofas', '/how-we-clean-sofas-upholstery', <HowWeCleanSofasPage />],
  ['end of tenancy', '/how-we-clean-end-of-tenancy', <HowWeCleanEndOfTenancyPage />],
] as const;

describe('How we clean FAQs', () => {
  it.each(pages)('%s shows at least seven useful questions and keeps schema in sync', (_name, path, page) => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <CookieConsentProvider>{page}</CookieConsentProvider>
      </MemoryRouter>,
    );

    const visibleQuestions = [...container.querySelectorAll<HTMLElement>('.faq-question')]
      .map((element) => element.textContent?.trim())
      .filter(Boolean);

    expect(visibleQuestions.length).toBeGreaterThanOrEqual(7);
    expect(visibleQuestions.length).toBeLessThanOrEqual(9);

    const schemaElement = container.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    expect(schemaElement).not.toBeNull();

    const schema = JSON.parse(schemaElement?.textContent ?? '{}');
    const faqSchema = schema['@graph']?.find((entry: { '@type'?: string }) => entry['@type'] === 'FAQPage');
    const schemaQuestions = faqSchema?.mainEntity?.map((entry: { name: string }) => entry.name);

    expect(schemaQuestions).toEqual(visibleQuestions);
  });
});
