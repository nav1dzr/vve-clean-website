import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BLOG_POSTS, BLOG_POSTS_BY_SLUG } from './index';
import { ROUTE_METADATA } from '../../lib/routeMetadata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prerender = readFileSync(resolve(root, 'prerender.mjs'), 'utf8');
const appRoutes = readFileSync(resolve(root, 'src/routeDefinitions.tsx'), 'utf8');

describe('BLOG_POSTS data integrity', () => {
  it('has at least one post, each with a unique slug and a real (non-future) publish date', () => {
    expect(BLOG_POSTS.length).toBeGreaterThan(0);
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const today = new Date().toISOString().slice(0, 10);
    for (const post of BLOG_POSTS) {
      expect(post.publishedDate <= today, `${post.slug} is dated in the future`).toBe(true);
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it('BLOG_POSTS_BY_SLUG indexes every post', () => {
    for (const post of BLOG_POSTS) {
      expect(BLOG_POSTS_BY_SLUG[post.slug]).toBe(post);
    }
  });

  it('is wired into routing (/blog and /blog/:slug)', () => {
    expect(appRoutes).toContain('path="/blog"');
    expect(appRoutes).toContain('path="/blog/:slug"');
  });

  it('generates the blog index and exactly one prerender metadata entry for every post', () => {
    expect(ROUTE_METADATA.filter((route) => route.path === '/blog')).toHaveLength(1);
    const routes = ROUTE_METADATA.filter((route) => route.path.startsWith('/blog/'));
    expect(routes.map((route) => route.path).sort()).toEqual(
      BLOG_POSTS.map((post) => `/blog/${post.slug}`).sort(),
    );
    for (const post of BLOG_POSTS) {
      const route = routes.find((entry) => entry.path === `/blog/${post.slug}`)!;
      expect(route.title).toBe(post.seoTitle ? `${post.seoTitle} | VVE Clean` : `${post.title} | VVE Clean Blog`);
      expect(route.description).toBe(post.excerpt);
      expect(route.ogTitle).toBe(post.title);
      expect(route.canonical).toBe(`https://www.vveclean.co.uk/blog/${post.slug}`);
      expect(route.robots).toBe('noindex, follow');
    }
    expect(prerender).toContain('ROUTE_METADATA: routes');
    expect(prerender).toContain("await import('./dist/server/entry-server.js')");
  });
});
