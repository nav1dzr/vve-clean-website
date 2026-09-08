import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, '../../supabase/migrations/20260902090000_add_crm_media_library.sql'), 'utf8');
const executableSql = sql.replace(/^--.*$/gm, '');

describe('two-part CRM media model migration', () => {
  it('creates isolated Gallery, Website, assignment, and reference objects', () => {
    for (const name of ['gallery_topics', 'gallery_slots', 'website_slots', 'assignments', 'page_references']) {
      expect(sql).toContain(`public.media_${name}`);
    }
    expect(sql).toContain('public_media_references');
  });

  it('seeds exactly five comparisons, four videos, and ten photos for each initial topic', () => {
    expect(sql).toContain("generate_series(1, 19)");
    expect(sql).toContain("'carpet', 'Carpet'");
    expect(sql).toContain("'sofa', 'Sofa'");
    expect(sql).toContain("'end-of-tenancy', 'End of Tenancy'");
  });

  it('does not destructively change CRM business data or external projects', () => {
    expect(executableSql).not.toMatch(/^\s*DROP\s+(TABLE|FUNCTION|POLICY|SCHEMA)\b/im);
    expect(executableSql).not.toMatch(/^\s*(TRUNCATE|DELETE\s+FROM|UPDATE\s+)/im);
    expect(executableSql).not.toMatch(/\b(vve_os|storage\.|auth\.)\b/i);
    expect(executableSql).toContain('REFERENCES public.admin_users');
  });
});
