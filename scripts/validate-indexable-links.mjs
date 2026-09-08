/** Run after npm run build. Only reads the generated site; makes no requests. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { JSDOM } from 'jsdom';

const directory = resolve(process.argv[2] || 'dist');
const sitemap = await readFile(join(directory, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
assert.ok(urls.length > 0, 'The sitemap must list indexable pages');
const pathOf = url => url.pathname.replace(/\/$/, '') || '/';
const paths = urls.map(pathOf);
const incoming = new Map(paths.map(path => [path, new Map()]));
const outgoing = new Map(paths.map(path => [path, new Set()]));

for (const url of urls) {
  const from = pathOf(url);
  const filename = join(directory, from.replace(/^\//, ''), 'index.html');
  const dom = new JSDOM(await readFile(filename, 'utf8'));
  const document = dom.window.document;
  assert.ok(!/noindex/i.test(document.querySelector('meta[name="robots"]')?.content || ''), `Sitemap page is noindex: ${from}`);
  for (const anchor of document.querySelectorAll('a[href]')) {
    let target;
    try { target = new URL(anchor.getAttribute('href'), url); } catch { continue; }
    const to = pathOf(target);
    if (target.origin !== url.origin || from === to || !incoming.has(to)) continue;
    const label = anchor.textContent.trim() || anchor.getAttribute('aria-label') || anchor.querySelector('img')?.alt || '';
    if (!incoming.get(to).has(from)) incoming.get(to).set(from, label);
    outgoing.get(from).add(to);
  }
  dom.window.close();
}

const reachable = new Set(['/']);
const queue = ['/'];
while (queue.length) {
  for (const target of outgoing.get(queue.shift()) || []) {
    if (!reachable.has(target)) { reachable.add(target); queue.push(target); }
  }
}
const orphans = paths.filter(path => incoming.get(path).size === 0);
const unreachable = paths.filter(path => !reachable.has(path));
const originalOrphans = ['/how-we-clean-carpets', '/how-we-clean-sofas-upholstery', '/how-we-clean-end-of-tenancy', '/cleaning-islington', '/cleaning-stratford'];
console.log(JSON.stringify({
  indexableRoutes: paths.length,
  orphans,
  unreachableFromHomepage: unreachable,
  incomingSourceCounts: Object.fromEntries([...incoming].map(([path, sources]) => [path, sources.size])),
  repairedAuditRoutes: Object.fromEntries(originalOrphans.map(path => [path, Object.fromEntries(incoming.get(path) || [])])),
}, null, 2));
assert.deepEqual(orphans, [], 'Each indexable page needs an incoming link from another indexable page');
assert.deepEqual(unreachable, [], 'Every indexable page must be reachable through HTML links from the homepage');
