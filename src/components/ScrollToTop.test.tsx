import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import ScrollToTop from './ScrollToTop';
import { applyRouteMetadata, metadataForPath, NOT_FOUND_METADATA, ROUTE_METADATA } from '../lib/routeMetadata';

const initialHead = document.head.innerHTML;
const template = readFileSync('index.html', 'utf8');
const prerender = readFileSync('prerender.mjs', 'utf8');
// Execute the real prerender head transformation with a controlled body. The
// same definitions must yield the same metadata in initial HTML and the DOM.
const rendererFunctions = prerender.slice(prerender.indexOf('function setMeta'), prerender.indexOf('// ── Prerender every real route'));
const buildHtml = new Function('template', 'render', 'OG_IMAGE', 'OG_IMAGE_W', 'OG_IMAGE_H',
  `${rendererFunctions}; return buildHtml;`)(template, () => '<main><h1>Test page</h1></main>', 'https://www.vveclean.co.uk/og-image.jpg', '1200', '630');
const content = (doc: Document, selector: string) => doc.head.querySelector(selector)?.getAttribute('content');
beforeEach(() => { document.head.innerHTML = ''; });
afterEach(() => { document.head.innerHTML = initialHead; });

describe('route metadata on direct loads and client navigation', () => {
  it.each(ROUTE_METADATA.map((route) => [route.path, route] as const))('%s has matching title, description, social tags and robots in both render paths', (path, route) => {
    const direct = new DOMParser().parseFromString(buildHtml(route, route.canonical), 'text/html');
    applyRouteMetadata('/leaflet');
    applyRouteMetadata(path);
    expect(document.title).toBe(direct.title);
    for (const selector of ['meta[name="description"]', 'meta[name="robots"]', 'meta[name="referrer"]',
      'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]',
      'meta[name="twitter:title"]', 'meta[name="twitter:description"]']) {
      expect(content(document, selector), selector).toBe(content(direct, selector));
      expect(document.head.querySelectorAll(selector)).toHaveLength(1);
      expect(content(document, selector)).not.toMatch(/undefined|null/);
    }
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(route.canonical);
  });

  it('updates all metadata when actual router links change the page, including leaflet and recovery from a missing page', () => {
    render(<MemoryRouter><ScrollToTop /><main><h1>Navigation test</h1>
      <Link to="/leaflet">Leaflet</Link><Link to="/missing-page">Missing</Link><Link to="/carpet-cleaning-london">Carpets</Link>
    </main></MemoryRouter>);
    fireEvent.click(screen.getByText('Leaflet'));
    expect(document.title).toBe(metadataForPath('/leaflet').title);
    expect(content(document, 'meta[name="robots"]')).toBe('noindex, follow');
    fireEvent.click(screen.getByText('Missing'));
    expect(document.title).toBe(NOT_FOUND_METADATA.title);
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    fireEvent.click(screen.getByText('Carpets'));
    expect(content(document, 'meta[name="robots"]')).toBe('index, follow');
    expect(content(document, 'meta[name="description"]')).toBe(metadataForPath('/carpet-cleaning-london').description);
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.vveclean.co.uk/carpet-cleaning-london');
  });

  it('replaces duplicate private tags and restores public metadata without leaking URL tokens', () => {
    document.head.innerHTML = '<meta name="robots" content="index, follow"><meta name="robots" content="noindex"><link rel="canonical" href="https://wrong.example">';
    applyRouteMetadata('/MANAGE-BOOKING/?token=never-in-head');
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(content(document, 'meta[name="robots"]')).toBe('noindex, nofollow, noarchive');
    expect(content(document, 'meta[name="referrer"]')).toBe('no-referrer');
    expect(document.head.innerHTML).not.toContain('never-in-head');
    applyRouteMetadata('/');
    expect(content(document, 'meta[name="referrer"]')).toBe('strict-origin-when-cross-origin');
    expect(content(document, 'meta[name="robots"]')).toBe('index, follow');
  });

  it('preserves the two evidenced indexable areas and the other thirteen noindex areas', () => {
    const local = ROUTE_METADATA.filter((route) => route.path.startsWith('/cleaning-'));
    expect(local).toHaveLength(15);
    expect(local.filter((route) => route.robots === 'index, follow').map((route) => route.path).sort()).toEqual(['/cleaning-islington', '/cleaning-stratford']);
    expect(local.filter((route) => route.robots === 'noindex, follow')).toHaveLength(13);
  });

  it('uses only neutral, shared policy and qualified catalogue price claims', () => {
    const text = JSON.stringify(ROUTE_METADATA);
    expect(text).not.toMatch(/72.hour|67.point|monthly invoicing|no hidden fees|no travel surcharge/i);
    expect(metadataForPath('/end-of-tenancy-cleaning-london').description).toContain('7-day re-clean for missed agreed tasks');
    for (const path of ['/pricing', '/carpet-cleaning-london', '/sofa-cleaning-london']) {
      expect(metadataForPath(path).description).toContain('£85 visit minimum');
    }
  });
});
