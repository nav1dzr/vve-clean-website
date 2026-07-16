import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const FILENAME = '20260722000000_create_invoice_receipt_tables.sql';

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration() {
  return readFileSync(resolve(MIGRATIONS_DIR, FILENAME), 'utf8');
}

// INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md — Phase 1. No live database in
// this test environment, so these are static content checks on the
// migration file itself: the expected tables/function/bucket/grants are
// present, RLS is enabled everywhere with zero anon/authenticated
// policies, and nothing outside this feature's own new objects is touched.
describe('supabase migration — invoice & receipt schema', () => {
  it('exists in supabase/migrations', () => {
    expect(migrationFiles()).toContain(FILENAME);
  });

  it('creates all six new tables', () => {
    const sql = readMigration();
    for (const table of [
      'document_number_counters',
      'invoices',
      'invoice_items',
      'invoice_payments',
      'receipts',
      'invoice_events',
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
  });

  it('creates the next_document_number RPC using an atomic upsert', () => {
    const sql = readMigration();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION next_document_number/);
    expect(sql).toMatch(/ON CONFLICT \(doc_type, year\)/);
    expect(sql).toMatch(/DO UPDATE SET last_number = document_number_counters\.last_number \+ 1/);
  });

  it('assembles independent INV-/REC- prefixes for invoice vs receipt', () => {
    const sql = readMigration();
    expect(sql).toMatch(/v_prefix := 'INV'/);
    expect(sql).toMatch(/v_prefix := 'REC'/);
  });

  it('year is part of the counter primary key (natural year-boundary reset)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/PRIMARY KEY \(doc_type, year\)/);
  });

  it('enables RLS on all six new tables', () => {
    const sql = readMigration();
    for (const table of [
      'document_number_counters',
      'invoices',
      'invoice_items',
      'invoice_payments',
      'receipts',
      'invoice_events',
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table}\\s+ENABLE ROW LEVEL SECURITY`));
    }
  });

  it('never disables RLS and never creates an anon/authenticated policy', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('grants service_role explicit access to every new table and the RPC', () => {
    const sql = readMigration();
    for (const table of [
      'document_number_counters',
      'invoices',
      'invoice_items',
      'invoice_payments',
      'receipts',
      'invoice_events',
    ]) {
      expect(sql).toMatch(new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.${table}\\s+TO service_role`));
    }
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION next_document_number\(text\) TO service_role/);
  });

  it('creates a private (non-public) storage bucket for the PDFs', () => {
    const sql = readMigration();
    expect(sql).toMatch(/INSERT INTO storage\.buckets \(id, name, public\)/);
    expect(sql).toMatch(/VALUES \('financial-documents', 'financial-documents', false\)/);
  });

  it('does not create, drop, or truncate anything outside this feature', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/\bALTER TABLE bookings\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE admin_users\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE internal_notes\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE processed_stripe_events\b/i);
  });

  it('invoice_items/invoice_payments cascade-delete with their parent invoice, but invoices itself never cascade-deletes from bookings', () => {
    const sql = readMigration();
    expect(sql).toMatch(/invoice_id\s+uuid\s+NOT NULL REFERENCES public\.invoices\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/booking_id\s+uuid\s+REFERENCES public\.bookings\(id\) ON DELETE SET NULL/);
  });

  it('invoice_payments is append-only in schema shape (reversal columns, no delete-related trigger)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/reversed_at\s+timestamptz/);
    expect(sql).toMatch(/reversed_by_admin_id\s+uuid/);
    expect(sql).toMatch(/reversal_reason\s+text/);
  });

  it('document_status and payment_status are constrained to the documented value sets', () => {
    const sql = readMigration();
    expect(sql).toMatch(/CHECK \(document_status IN \('draft','issued','void','cancelled'\)\)/);
    expect(sql).toMatch(/CHECK \(payment_status IN \('unpaid','partially_paid','paid'\)\)/);
  });

  it('includes manual verification SQL for numbering, RLS status, policy absence, and the storage bucket', () => {
    const sql = readMigration();
    expect(sql).toMatch(/select next_document_number\('invoice'\)/);
    expect(sql).toMatch(/relrowsecurity/);
    expect(sql).toMatch(/pg_policies/);
    expect(sql).toMatch(/storage\.buckets where id = 'financial-documents'/);
  });
});
