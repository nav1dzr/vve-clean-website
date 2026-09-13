import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, '../../supabase/migrations/20260902090000_add_crm_media_library.sql'), 'utf8');
const executableSql = sql.replace(/^--.*$/gm, '');

describe('isolated CRM media migration', () => {
  it('creates dedicated CRM media objects only', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_assets/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_gallery_slots/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_website_slots/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.public_media_references/i);
  });

  it('contains no destructive or non-media table mutation statements', () => {
    expect(executableSql).not.toMatch(/^\s*DROP\s+(TABLE|FUNCTION|POLICY|SCHEMA)\b/im);
    expect(executableSql).not.toMatch(/^\s*(TRUNCATE|DELETE\s+FROM|UPDATE\s+)/im);
    expect(executableSql).not.toMatch(/^\s*ALTER\s+TABLE\s+(?!public\.media_)/im);
    expect(executableSql).not.toMatch(/\b(vve_os|storage\.|auth\.)\b/i);
  });

  it('keeps browser table access closed and grants only the public delivery RPC', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/g);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.public_media_references\(\) TO anon, authenticated/i);
  });
});
