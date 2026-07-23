import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname      = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const FILENAME       = '20260724000001_switch_to_vve_invoice_series.sql';

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration() {
  return readFileSync(resolve(MIGRATIONS_DIR, FILENAME), 'utf8');
}

describe('supabase migration — VVE-INV invoice series (20260724000001)', () => {
  it('exists and comes after the seed migration (20260724000000)', () => {
    const files = migrationFiles();
    expect(files).toContain(FILENAME);
    expect(FILENAME > '20260724000000_seed_document_numbering_start.sql').toBe(true);
  });

  it('uses year=0 global sentinel row for invoices (counter never resets between years)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/VALUES\s*\('invoice',\s*0,/);
  });

  it('stores VVE-INV prefix on the global invoice row', () => {
    const sql = readMigration();
    expect(sql).toMatch(/'VVE-INV'/);
  });

  it('derives the starting counter from GREATEST of three sources (counter max, issued max, baseline 13244)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/GREATEST\s*\(\s*v_counter_max,\s*v_issued_max,\s*13244\s*\)/);
  });

  it('reads the highest issued invoice number from actual invoice_number values (not COUNT(*))', () => {
    const sql = readMigration();
    expect(sql).toMatch(/MAX\s*\(\s*substring\s*\(\s*invoice_number/i);
    expect(sql).not.toMatch(/COUNT\s*\(\s*\*\s*\)/i);
  });

  it('deletes old per-year invoice rows after creating the global row', () => {
    const sql = readMigration();
    expect(sql).toMatch(/DELETE FROM document_number_counters[\s\S]*?doc_type\s*=\s*'invoice'\s*AND\s*year\s*!=\s*0/);
  });

  it('restricts receipt correction to the exact known bad seed state (last_number = 13244, no real receipt >= 13244)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/last_number\s*=\s*13244/);
    expect(sql).toMatch(/v_actual_max\s*<\s*13244/);
    // Must NOT use the broad > condition that could rewind a legitimate counter.
    expect(sql).not.toMatch(/last_number\s*>\s*v_actual_max/);
  });

  it('reads the highest issued receipt number from actual receipt_number values (not COUNT(*))', () => {
    const sql = readMigration();
    expect(sql).toMatch(/MAX\s*\(\s*substring\s*\(\s*receipt_number/i);
  });

  it('adds prefix column as nullable before backfilling, then enforces NOT NULL', () => {
    const sql = readMigration();
    // Nullable add must appear before NOT NULL enforcement.
    const nullablePos  = sql.indexOf('ADD COLUMN IF NOT EXISTS prefix text');
    const notNullPos   = sql.indexOf('ALTER COLUMN prefix SET NOT NULL');
    expect(nullablePos).toBeGreaterThan(-1);
    expect(notNullPos).toBeGreaterThan(-1);
    expect(nullablePos).toBeLessThan(notNullPos);
  });

  it('function uses year=0 for invoices and v_year for receipts', () => {
    const sql = readMigration();
    expect(sql).toMatch(/v_counter_year\s*:=\s*0/);
    expect(sql).toMatch(/v_counter_year\s*:=\s*v_year/);
  });

  it('function uses INSERT ON CONFLICT with single-statement atomicity (concurrency guarantee)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/INSERT INTO document_number_counters[\s\S]*?ON CONFLICT \(doc_type, year\)[\s\S]*?DO UPDATE SET last_number = document_number_counters\.last_number \+ 1/);
  });

  it('function reads prefix from RETURNING clause (not hardcoded in the RETURN expression)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/RETURNING last_number, prefix INTO v_number, v_prefix/);
    expect(sql).toMatch(/RETURN v_prefix \|\| '-' \|\| v_year/);
  });

  it('verification comment instructs BEGIN/ROLLBACK for function testing — not a bare SELECT', () => {
    const sql = readMigration();
    expect(sql).toMatch(/BEGIN;/);
    expect(sql).toMatch(/ROLLBACK;/);
  });

  it('does not alter existing invoice_number values in the invoices table', () => {
    const sql = readMigration();
    // No UPDATE targeting invoices table directly.
    const nonCommentLines = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(nonCommentLines).not.toMatch(/UPDATE\s+invoices\b/i);
    expect(nonCommentLines).not.toMatch(/ALTER\s+TABLE\s+invoices\b/i);
  });
});
