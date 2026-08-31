// Every-page inspection over the prerendered dist/ output.
// Read-only: reports, never edits.
//
//   npm run build && node scripts/audit-pages.mjs
//
// Checks title/description length, single H1, heading-level order, canonical
// and robots state, image alt text, JSON-LD validity, and crawls every
// internal link.
//
// KNOWN FALSE POSITIVES — these are correct as they are, do not "fix" them:
//
//   /googleaf3438b5e2c947d4.html   Google's site-verification file. It must
//                                  contain exactly the token line and nothing
//                                  else, so it has no title, H1 or canonical
//                                  by design.
//
//   /server/*                      Vite SSR build artefacts, not routes any
//                                  visitor can reach. They duplicate whatever
//                                  the real page reports.
//
//   /confirmation.html             Three H1s, one per mutually exclusive
//                                  state (checking / unverified / verified).
//                                  All but one are display:none; a static
//                                  scan cannot see the runtime toggle. It is
//                                  also noindex, so the missing description
//                                  does not matter.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const ORIGIN = 'https://www.vveclean.co.uk';

function findHtml(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'assets') continue;
      findHtml(full, out);
    } else if (entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const routeOf = (file) => {
  const rel = file.replace(/\\/g, '/').replace(`${DIST}/`, '');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.replace('/index.html', '');
  return '/' + rel;
};

const one = (html, re) => html.match(re)?.[1]?.trim() ?? null;
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

const rows = [];
const problems = [];

for (const file of findHtml(DIST).sort()) {
  const html = readFileSync(file, 'utf8');
  const route = routeOf(file);

  const title = one(html, /<title>([^<]*)<\/title>/);
  const description = one(html, /<meta name="description" content="([^"]*)"/);
  const canonical = one(html, /<link rel="canonical" href="([^"]*)"/);
  const robots = one(html, /<meta name="robots" content="([^"]*)"/) ?? 'index,follow (default)';
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g).map((h) =>
    h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );
  const headings = all(html, /<(h[1-6])[^>]*>/g);
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((t) => !/\balt=/.test(t));
  const ldjson = all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);

  const schemaTypes = [];
  for (const block of ldjson) {
    try {
      const parsed = JSON.parse(block);
      const collect = (o) => {
        if (Array.isArray(o)) return o.forEach(collect);
        if (o && typeof o === 'object') {
          if (o['@type']) schemaTypes.push(o['@type']);
          Object.values(o).forEach(collect);
        }
      };
      collect(parsed);
    } catch (e) {
      problems.push(`${route}: INVALID JSON-LD — ${e.message}`);
    }
  }

  // Checks
  if (!title) problems.push(`${route}: missing <title>`);
  else if (title.length > 65) problems.push(`${route}: title ${title.length} chars (>65)`);
  if (!description) problems.push(`${route}: missing meta description`);
  else if (description.length > 165)
    problems.push(`${route}: description ${description.length} chars (>165)`);
  if (h1s.length === 0) problems.push(`${route}: no <h1>`);
  if (h1s.length > 1) problems.push(`${route}: ${h1s.length} <h1> elements`);
  if (imgsNoAlt.length) problems.push(`${route}: ${imgsNoAlt.length} <img> without alt`);

  const isNoindex = /noindex/.test(robots);
  if (!isNoindex && !canonical && route !== '/404.html')
    problems.push(`${route}: indexable but no canonical`);
  if (canonical && !canonical.startsWith(ORIGIN))
    problems.push(`${route}: canonical not on ${ORIGIN} — ${canonical}`);

  // Heading order (no skipped levels)
  let prev = 0;
  for (const h of headings) {
    const level = Number(h[1]);
    if (prev && level > prev + 1) {
      problems.push(`${route}: heading jumps h${prev} → h${level}`);
      break;
    }
    prev = level;
  }

  rows.push({
    route,
    title,
    h1: h1s[0] ?? null,
    canonical,
    robots: isNoindex ? 'noindex' : 'index',
    schema: [...new Set(schemaTypes)].sort().join(', '),
    imgs: imgs.length,
    bytes: html.length,
  });
}

// Internal link crawl
const routes = new Set(rows.map((r) => r.route));
const broken = [];
for (const file of findHtml(DIST)) {
  const html = readFileSync(file, 'utf8');
  const route = routeOf(file);
  for (const href of all(html, /<a\b[^>]*href="(\/[^"#?]*)"/g)) {
    const clean = href.replace(/\/$/, '') || '/';
    if (routes.has(clean) || routes.has(href)) continue;
    if (existsSync(resolve(DIST, href.replace(/^\//, '')))) continue;
    broken.push(`${route} → ${href}`);
  }
}

console.log(`\n=== ${rows.length} PAGES ===\n`);
for (const r of rows) {
  console.log(`${r.robots === 'noindex' ? '[noindex]' : '[index]  '} ${r.route}`);
  console.log(`   title:  ${r.title}`);
  console.log(`   h1:     ${r.h1}`);
  console.log(`   schema: ${r.schema || '(none)'}`);
}

console.log(`\n=== PROBLEMS (${problems.length}) ===`);
problems.forEach((p) => console.log(' •', p));

console.log(`\n=== BROKEN INTERNAL LINKS (${[...new Set(broken)].length}) ===`);
[...new Set(broken)].forEach((b) => console.log(' •', b));

console.log(`\nIndexable: ${rows.filter((r) => r.robots === 'index').length}`);
console.log(`Noindex:   ${rows.filter((r) => r.robots === 'noindex').length}`);
