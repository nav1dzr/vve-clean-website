// The homepage shows six booking-blocking questions; /faq shows all fifteen.
//
// Before this, both rendered the same 15 questions and the homepage FAQ was 39%
// of the page (docs/HOMEPAGE_SIMPLIFICATION_REVIEW.md). The risk in splitting
// them is that the two lists drift, or that the structured data on one page
// advertises answers a visitor cannot see there. These specs pin both.

import { beforeAll, describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FAQ, { FAQS, HOMEPAGE_FAQS } from './FAQ';

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

function renderFaq(standalone: boolean) {
  return render(
    <MemoryRouter>
      <FAQ standalone={standalone} />
    </MemoryRouter>,
  );
}

/** Question text of every rendered accordion, in document order. */
function visibleQuestions(container: HTMLElement) {
  return [...container.querySelectorAll('.faq-question')].map((n) => n.textContent?.trim() ?? '');
}

/** Question/answer pairs from every FAQPage script in the container. */
function schemaQuestions(container: HTMLElement) {
  const out: { name: string; text: string }[] = [];
  for (const script of container.querySelectorAll('script[type="application/ld+json"]')) {
    const parsed = JSON.parse(script.textContent ?? '{}');
    if (parsed['@type'] !== 'FAQPage') continue;
    for (const q of parsed.mainEntity ?? []) {
      out.push({ name: q.name, text: q.acceptedAnswer?.text ?? '' });
    }
  }
  return out;
}

describe('the six homepage questions', () => {
  const EXPECTED = [
    'How does the end of tenancy re-clean guarantee work?',
    'When do I pay?',
    'Can the price change?',
    'Can I reschedule or cancel?',
    'What if the date I request is not available?',
    'Which areas do you cover?',
  ];

  it('shows exactly six, in the agreed order', () => {
    const { container } = renderFaq(false);
    expect(visibleQuestions(container)).toEqual(EXPECTED);
  });

  it('covers each of the topics the brief named', () => {
    const questions = HOMEPAGE_FAQS.map(({ q }) => q).join(' | ');
    for (const topic of [
      /re-clean guarantee/i,
      /when do i pay/i,
      /price change/i,
      /reschedule or cancel/i,
      /not available/i,
      /areas do you cover/i,
    ]) {
      expect(questions, `no homepage FAQ matches ${topic}`).toMatch(topic);
    }
  });

  it('takes its answers from FAQS rather than a second copy', () => {
    // Object identity: the homepage cannot hold a divergent edit of an answer.
    for (const faq of HOMEPAGE_FAQS) {
      expect(FAQS).toContain(faq);
    }
  });

  it('fails loudly if a question is renamed in FAQS without updating the list', () => {
    // HOMEPAGE_FAQS is built by exact-matching question text, and throws on a
    // miss. This documents that a silent drop is impossible.
    const names = new Set(FAQS.map(({ q }) => q));
    for (const q of EXPECTED) expect(names).toContain(q);
  });
});

describe('/faq remains the full reference', () => {
  it('still renders all fifteen questions', () => {
    const { container } = renderFaq(true);
    expect(visibleQuestions(container)).toEqual(FAQS.map(({ q }) => q));
    expect(FAQS).toHaveLength(15);
  });

  it('shows more questions than the homepage', () => {
    expect(FAQS.length).toBeGreaterThan(HOMEPAGE_FAQS.length);
  });
});

describe('structured data matches what each page renders', () => {
  it.each([
    ['homepage', false],
    ['/faq', true],
  ])('%s advertises only its visible questions', (_label, standalone) => {
    const { container } = renderFaq(standalone as boolean);

    const schema = schemaQuestions(container);
    const visible = visibleQuestions(container);

    expect(schema.length).toBeGreaterThan(0);
    expect(schema.map((s) => s.name)).toEqual(visible);
  });

  it('carries the full answer text, not just the questions', () => {
    const { container } = renderFaq(false);
    const schema = schemaQuestions(container);

    expect(schema).toHaveLength(6);
    for (const { name, text } of schema) {
      const source = FAQS.find((f) => f.q === name);
      expect(source, `${name} is not a real FAQ`).toBeDefined();
      expect(text).toBe(source?.a);
    }
  });

  it('does not advertise the nine questions that live only on /faq', () => {
    const { container } = renderFaq(false);
    const advertised = new Set(schemaQuestions(container).map((s) => s.name));
    const homepageSet = new Set(HOMEPAGE_FAQS.map(({ q }) => q));

    for (const { q } of FAQS) {
      if (!homepageSet.has(q)) expect(advertised).not.toContain(q);
    }
  });
});

describe('the route to the remaining questions', () => {
  it('links to /faq from the homepage', () => {
    const { container } = renderFaq(false);
    const link = within(container).getByRole('link', { name: /View all \d+ FAQs/i });
    expect(link).toHaveAttribute('href', '/faq');
  });

  it('names the real total rather than a hard-coded number', () => {
    const { container } = renderFaq(false);
    expect(within(container).getByRole('link', { name: new RegExp(`View all ${FAQS.length} FAQs`) }))
      .toBeInTheDocument();
  });

  it('meets the 48px touch target the brand guide requires', () => {
    const { container } = renderFaq(false);
    const link = within(container).getByRole('link', { name: /View all/i });
    expect(link.className).toContain('min-h-[48px]');
  });

  it('does not link /faq to itself', () => {
    const { container } = renderFaq(true);
    expect(within(container).queryByRole('link', { name: /View all/i })).not.toBeInTheDocument();
  });
});
