import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration(filename) {
  return readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf8');
}

// SECURITY_AUDIT_REPORT.md finding F2 — this migration removes the stale
// `authenticated USING (true)` SELECT policies on quote_requests and
// contact_messages. There's no live database in this test environment, so
// these are static content checks on the migration file itself (the exact
// DROP POLICY statements are present, nothing else is touched) rather than
// a run against a real Postgres instance.
describe('supabase migration — remove stale quote_requests/contact_messages SELECT policies (F2)', () => {
  const FILENAME = '20260721000000_remove_stale_quote_contact_select_policies.sql';

  it('exists in supabase/migrations', () => {
    expect(migrationFiles()).toContain(FILENAME);
  });

  it('drops every historical authenticated-SELECT policy name variant on quote_requests', () => {
    const sql = readMigration(FILENAME);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Authenticated users can view quotes"\s+ON quote_requests;/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Authenticated users can read quote requests" ON quote_requests;/);
  });

  it('drops every historical authenticated-SELECT policy name variant on contact_messages', () => {
    const sql = readMigration(FILENAME);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Authenticated users can view contact messages" ON contact_messages;/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Authenticated users can read contact messages" ON contact_messages;/);
  });

  it('uses DROP POLICY IF EXISTS (idempotent/safe to re-run), never a bare DROP POLICY', () => {
    const sql = readMigration(FILENAME);
    const dropLines = sql.split('\n').filter((l) => /^\s*DROP POLICY/i.test(l));
    expect(dropLines.length).toBeGreaterThan(0);
    for (const line of dropLines) {
      expect(line).toMatch(/DROP POLICY IF EXISTS/i);
    }
  });

  it('does not disable RLS on either table', () => {
    const sql = readMigration(FILENAME);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it('does not drop, truncate, or delete from either table (no data/schema loss)', () => {
    const sql = readMigration(FILENAME);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
  });

  it('does not create a replacement SELECT policy for anon or authenticated', () => {
    const sql = readMigration(FILENAME);
    // No CREATE POLICY at all in this migration — it is drop-only.
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('leaves the public INSERT policies untouched (no DROP POLICY statement targets them)', () => {
    const sql = readMigration(FILENAME);
    const dropLines = sql.split('\n').filter((l) => /^\s*DROP POLICY/i.test(l)).join('\n');
    expect(dropLines).not.toMatch(/public_insert_quote_requests/);
    expect(dropLines).not.toMatch(/public_insert_contact_messages/);
  });

  it('does not touch bookings, admin_users, internal_notes, or processed_stripe_events policies', () => {
    const sql = readMigration(FILENAME);
    expect(sql).not.toMatch(/\bON bookings\b/);
    expect(sql).not.toMatch(/\bON admin_users\b/);
    expect(sql).not.toMatch(/\bON internal_notes\b/);
    expect(sql).not.toMatch(/\bON processed_stripe_events\b/);
  });

  it('includes manual verification SQL for RLS status, absence of SELECT policies, and row-count stability', () => {
    const sql = readMigration(FILENAME);
    expect(sql).toMatch(/relrowsecurity/);
    expect(sql).toMatch(/pg_policies/);
    expect(sql.toLowerCase()).toMatch(/count\(\*\)/);
  });
});
