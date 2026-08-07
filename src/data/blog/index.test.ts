import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BLOG_POSTS, BLOG_POSTS_BY_SLUG } from './index';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prerender = readFileSync(resolve(root, 'prerender.mjs'), 'utf8');
const appRoutes = readFileSync(resolve(root, 'src/AppRoutes.tsx'), 'utf8');

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

  it('is wired into prerender.mjs so every post gets a real, prerendered route', () => {
    expect(prerender).toContain("path: '/blog'");
    expect(prerender).toContain('for (const post of BLOG_POSTS)');
    expect(prerender).toContain('/blog/${post.slug}');
  });
});
