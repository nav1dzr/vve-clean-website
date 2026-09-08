import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
const csp = config.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value;
const directives = Object.fromEntries(csp.split(';').map(part => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]));
describe('CRM upload Content Security Policy', () => {
  it('allows only the CRM, Supabase, R2 and the documented Mux direct-upload destination', () => {
    expect(directives['connect-src']).toEqual(["'self'", 'https://*.supabase.co', 'https://*.r2.cloudflarestorage.com', 'https://storage.googleapis.com']);
    expect(directives['connect-src']).not.toEqual(expect.arrayContaining(['*', 'https:', 'https://*.googleapis.com']));
  });
  it('preserves the existing script, frame, form and document restrictions', () => {
    const rest = Object.fromEntries(Object.entries(directives).filter(([name]) => name !== 'connect-src'));
    expect(rest).toEqual({ 'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:', 'https:'], 'font-src': ["'self'"], 'frame-src': ['https://player.mux.com'], 'frame-ancestors': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'self'"] });
  });
});
