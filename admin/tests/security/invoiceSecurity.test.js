import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidUuid } from '../../api/_lib/normalise.js';
import { invoicePdfPath, receiptPdfPath } from '../../api/_lib/invoiceStorage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, '../../src');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// Static source scan, not a built-bundle scan (building inside a test isn't
// practical) — but architecturally equivalent: Vite only ever includes
// what admin/src/ actually imports/references, and none of these files
// import anything from admin/api/. This test exists so a future accidental
// cross-import (e.g. someone importing businessSettings.js's bank details
// helper "for convenience" into a component) fails CI immediately rather
// than only being caught by a manual audit.
describe('invoice/receipt secrets never referenced from admin/src (client bundle)', () => {
  const files = listFiles(SRC_DIR);
  const sources = files.map((f) => readFileSync(f, 'utf8')).join('\n');

  it('never references the Supabase service-role key', () => {
    expect(sources).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('never references the mailer credentials', () => {
    expect(sources).not.toMatch(/GMAIL_APP_PASSWORD/);
    expect(sources).not.toMatch(/GMAIL_SENDER/);
  });

  it('never references bank account details or the business-settings module directly', () => {
    expect(sources).not.toMatch(/INVOICE_BANK_ACCOUNT_NUMBER/);
    expect(sources).not.toMatch(/INVOICE_BANK_SORT_CODE/);
    // admin/src/ has no reason to import the server-only settings module at
    // all — it only ever reads business identity via the API response
    // shapes (InvoiceDetail.businessSnapshot is deliberately NOT even
    // exposed by toInvoiceDetail — see admin/api/_lib/invoiceFields.js).
    expect(sources).not.toMatch(/from ['"].*_lib\/businessSettings\.js['"]/);
  });

  it('never imports admin/api/_lib/supabaseAdmin.js (the only module that touches the service-role client)', () => {
    expect(sources).not.toMatch(/from ['"].*_lib\/supabaseAdmin\.js['"]/);
  });
});

describe('invoice/receipt IDOR and path-traversal defences', () => {
  it('rejects a path-traversal string as an invoice/receipt id before it ever reaches a storage path', () => {
    const attempts = ['../../etc/passwd', '..%2F..%2Fetc%2Fpasswd', '/etc/passwd', '../../../secrets.env'];
    for (const attempt of attempts) {
      expect(isValidUuid(attempt)).toBe(false);
    }
  });

  it('storage paths are always built from a real UUID plus a fixed prefix/suffix, never from arbitrary input', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(invoicePdfPath(id, 1)).toBe(`invoices/${id}/invoice-v1.pdf`);
    expect(receiptPdfPath(id, 1)).toBe(`receipts/${id}/receipt-v1.pdf`);
    // The function signature only accepts (id, version) — there is no
    // parameter through which a caller could inject an alternate path
    // segment, filename, or ".." traversal sequence.
  });

  it('the migration allocates invoice/receipt ids via gen_random_uuid() (unguessable), never a sequential integer', () => {
    const migrationPath = resolve(__dirname, '../../../supabase/migrations/20260722000000_create_invoice_receipt_tables.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/id\s+uuid\s+PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
  });
});
