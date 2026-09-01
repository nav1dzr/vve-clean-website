import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, '../../supabase/migrations/20260901120000_create_media_preview_isolation.sql'), 'utf8');
const executableSql = sql.replace(/^--.*$/gm, '');

describe('temporary VVE OS media Preview migration', () => {
  it('creates only prefixed Preview objects', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_preview_admin_users/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_preview_assets/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.media_preview_slots/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.public_media_preview_slots/i);
  });

  it('contains no destructive or VVE OS mutation statements', () => {
    expect(executableSql).not.toMatch(/^\s*DROP\s+(TABLE|FUNCTION|POLICY|SCHEMA)\b/im);
    expect(executableSql).not.toMatch(/^\s*(TRUNCATE|DELETE\s+FROM|UPDATE\s+)/im);
    expect(executableSql).not.toMatch(/^\s*ALTER\s+TABLE\s+(?!public\.media_preview_)/im);
    expect(executableSql).not.toMatch(/\b(vve_os|admin_users|storage\.|auth\.)\b/i);
  });

  it('keeps browser table access closed and grants only the public delivery RPC', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/g);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.public_media_preview_slots\(\) TO anon, authenticated/i);
  });
});
