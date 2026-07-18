import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const FILENAME = '20260725000000_widen_invoice_events_event_type.sql';

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function readMigration() {
  return readFileSync(resolve(MIGRATIONS_DIR, FILENAME), 'utf8');
}

// Static content checks on the migration file, same pattern and rationale
// as tests/supabase/invoiceReceiptMigration.test.js (no live database in
// this test environment). Fixes D19: admin/api/invoices/[id].js's
// handleRemind/handlePaymentAck have been inserting event types the
// original CHECK constraint never allowed, silently losing the audit
// trail for every reminder/acknowledgement send.
describe('supabase migration — widen invoice_events.event_type for reminder/ack events', () => {
  it('exists in supabase/migrations, after the document-numbering seed migration', () => {
    const files = migrationFiles();
    expect(files).toContain(FILENAME);
    expect(FILENAME > '20260724000000_seed_document_numbering_start.sql').toBe(true);
  });

  it('adds all four reminder/acknowledgement event types', () => {
    const sql = readMigration();
    expect(sql).toMatch(/'reminder_sent'/);
    expect(sql).toMatch(/'reminder_failed'/);
    expect(sql).toMatch(/'payment_ack_sent'/);
    expect(sql).toMatch(/'payment_ack_failed'/);
  });

  it('preserves every original event_type value — nothing removed', () => {
    const sql = readMigration();
    for (const original of [
      'created', 'updated', 'issued', 'previewed', 'pdf_generated',
      'sent', 'resent', 'send_failed', 'payment_recorded',
      'payment_reversed', 'paid', 'receipt_created', 'downloaded',
      'duplicated', 'voided', 'cancelled',
    ]) {
      expect(sql).toMatch(new RegExp(`'${original}'`));
    }
  });

  it('drops and recreates only the event_type CHECK constraint, not document_type', () => {
    const sql = readMigration();
    const statementLines = sql.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim().length > 0);
    expect(sql).toMatch(/DROP CONSTRAINT/i);
    expect(sql).toMatch(/ADD CONSTRAINT invoice_events_event_type_check/);
    expect(statementLines.join('\n')).not.toMatch(/document_type/);
  });

  it('is a plain constraint widening — no DROP TABLE, DELETE, TRUNCATE, or RLS/policy changes', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('only touches the invoice_events table', () => {
    const sql = readMigration();
    const statementLines = sql.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim().length > 0);
    expect(statementLines.join('\n')).toMatch(/invoice_events/);
    expect(statementLines.join('\n')).not.toMatch(/\binvoices\b|\breceipts\b|\bcustomers\b/);
  });
});
