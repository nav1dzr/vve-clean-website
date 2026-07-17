import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const FILENAME = '20260724000000_seed_document_numbering_start.sql';

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration() {
  return readFileSync(resolve(MIGRATIONS_DIR, FILENAME), 'utf8');
}

// Static content checks on the migration file, same pattern and rationale
// as tests/supabase/invoiceReceiptMigration.test.js (no live database in
// this test environment).
describe('supabase migration — seed document numbering to start at 13245', () => {
  it('exists in supabase/migrations, after the customers/payment-options migration', () => {
    const files = migrationFiles();
    expect(files).toContain(FILENAME);
    expect(FILENAME > '20260723000000_add_customers_and_payment_options.sql').toBe(true);
  });

  it('seeds both invoice and receipt counters for 2026 at last_number 13244 (next call returns 13245)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/VALUES \('invoice', 2026, 13244\), \('receipt', 2026, 13244\)/);
  });

  it('uses GREATEST so an already-higher counter is never lowered (existing numbers never change)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/DO UPDATE SET last_number = GREATEST\(document_number_counters\.last_number, 13244\)/);
  });

  it('is a plain idempotent upsert — no DROP, DELETE, TRUNCATE, or RLS changes', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('does not touch next_document_number() or any other function/table definition', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(sql).not.toMatch(/CREATE TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE/i);
  });

  it('only touches the document_number_counters table', () => {
    const sql = readMigration();
    const statementLines = sql.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim().length > 0);
    expect(statementLines.join('\n')).toMatch(/document_number_counters/);
    expect(statementLines.join('\n')).not.toMatch(/\binvoices\b|\breceipts\b|\bcustomers\b/);
  });
});
