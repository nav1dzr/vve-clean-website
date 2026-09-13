import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
function run(url) {
  const robot = { content: 'index, follow' }, appendChild = vi.fn();
  const context = { location: new URL(url), localStorage: { getItem: () => null }, document: { querySelector: () => robot, createElement: () => ({}), head: { appendChild } } };
  context.window = context;
  for (const script of scripts) runInNewContext(script, context);
  return { context, appendChild, robot };
}
describe('early Google tag privacy guard', () => {
  it.each(['/manage-booking', '/Manage-Booking/', '/%6danage-booking', '/manage%2dbooking'])('keeps %s private before React loads', path => {
    const { context, appendChild, robot } = run(`https://www.vveclean.co.uk${path}?token=private`);
    expect(context.dataLayer).toHaveLength(0);
    expect(appendChild.mock.calls.flat().some(node => node.src)).toBe(false);
    expect(robot.content).toBe('noindex, nofollow');
    expect(appendChild).toHaveBeenCalledWith({ name: 'referrer', content: 'no-referrer' });
  });
  it.each(['http://localhost:5173/', 'http://127.0.0.1:4173/', 'https://vve-clean-preview.vercel.app/', 'https://www.vveclean.co.uk.evil.example/'])('never loads Google tags on %s', url => {
    const { context, appendChild } = run(url);
    expect(context.dataLayer).toHaveLength(0); expect(appendChild).not.toHaveBeenCalled();
  });
  it('loads the existing Ads tag only on a public production page with denied consent first', () => {
    const { context, appendChild } = run('https://www.vveclean.co.uk/sofa-cleaning-london');
    expect([...context.dataLayer[0]]).toMatchObject(['consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' }]);
    expect(appendChild.mock.calls[0][0].src).toContain('AW-18214693277');
  });
});
