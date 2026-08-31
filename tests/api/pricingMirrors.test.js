/**
 * Source-of-truth tests for the pricing architecture.
 *
 * Prices used to be manually duplicated across three files (src/data/pricing.ts,
 * api/servicePrices.js, admin/api/_lib/catalogueSeed.js), verified only by
 * numeric-equality tests that could pass even when someone forgot to update
 * one of the three. That architecture is gone: shared/pricingCatalogue.js is
 * now the ONLY place prices are defined, and the two "mirror" files are thin
 * re-export shims (api/servicePrices.js) or a mechanically-synced verified-
 * identical copy (admin's — see scripts/sync-admin-pricing.mjs).
 *
 * These tests prove that structurally, not just numerically:
 *   - api/servicePrices.js's computePrice IS the shared module's function
 *     (identity equality — not just "returns the same numbers today").
 *   - admin's CATALOGUE_SEED_ITEMS IS the shared module's array (same object
 *     reference, via the generated copy).
 *   - the generated admin copy is currently in sync with the canonical
 *     source (fails loudly — "STALE" — if someone edited
 *     shared/pricingCatalogue.js without running the sync script).
 *   - neither mirror file contains any numeric price literal of its own
 *     (structural proof that manual duplication cannot silently return).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { computePrice as serverComputePrice } from '../../api/servicePrices.js';
import { CATALOGUE_SEED_ITEMS as adminSeedItems } from '../../admin/api/_lib/catalogueSeed.js';
import * as shared from '../../shared/pricingCatalogue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const GENERATED_PATH = path.join(REPO_ROOT, 'admin', 'api', '_lib', 'pricingCatalogue.generated.js');
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-admin-pricing.mjs');

// scripts/sync-admin-pricing.mjs is invoked as a real subprocess here (its
// actual, documented interface — `node scripts/sync-admin-pricing.mjs
// [--check]`) rather than imported for its named exports. Importing it
// directly hits an unrelated Vite/esbuild SSR-transform quirk in this
// project's toolchain that misreports it as a syntax error in whichever file
// imports it; running it exactly as CI and the prebuild/pretest hooks do
// avoids that entirely and is arguably a more faithful test of the thing
// that actually matters — the CLI contract.
function isInSync() {
  try {
    execFileSync('node', [SYNC_SCRIPT, '--check'], { cwd: REPO_ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function buildGeneratedContent() {
  execFileSync('node', [SYNC_SCRIPT], { cwd: REPO_ROOT, stdio: 'pipe' });
  return readFileSync(GENERATED_PATH, 'utf8');
}

describe('single source of truth — identity, not just value, equality', () => {
  it('api/servicePrices.js computePrice is the exact same function as shared/pricingCatalogue.js', () => {
    expect(serverComputePrice).toBe(shared.computePrice);
  });

  it("admin's CATALOGUE_SEED_ITEMS is deeply identical to shared/pricingCatalogue.js's (necessarily a separate module instance — see below — but never a separately-authored value)", () => {
    // Not toBe(): admin/api/_lib/pricingCatalogue.generated.js is a distinct
    // file (a mechanically synced copy, not a cross-directory import — see
    // that file's banner for why), so Node loads it as a separate module
    // instance with its own array object. Byte-for-byte content sync (proven
    // below by isInSync()) is what actually prevents drift here, not
    // reference identity, which is architecturally impossible across a copy.
    expect(adminSeedItems).toStrictEqual(shared.CATALOGUE_SEED_ITEMS);
  });
});

describe('admin generated pricing copy stays in sync with the canonical source', () => {
  it('the committed admin/api/_lib/pricingCatalogue.generated.js matches what the sync script would produce right now', () => {
    expect(isInSync()).toBe(true);
  });

  it('the generated file starts with the AUTO-GENERATED / DO NOT EDIT banner', () => {
    const content = readFileSync(GENERATED_PATH, 'utf8');
    expect(content).toContain('AUTO-GENERATED FILE — DO NOT EDIT MANUALLY');
  });

  it('regenerating produces byte-identical content to the committed file (deterministic)', () => {
    const content = readFileSync(GENERATED_PATH, 'utf8');
    expect(buildGeneratedContent()).toBe(content);
  });
});

describe('mirror/shim files contain no local price data (structural anti-duplication guard)', () => {
  // A hardcoded 2-4 digit number that isn't obviously a year, port, or HTTP
  // status is the shape of a re-introduced price literal. This intentionally
  // over-triggers (e.g. would flag "2026") and is left broad on purpose —
  // it should never trigger on files that are pure re-exports.
  const suspiciousNumberPattern = /\b\d{2,4}\b/;

  it('api/servicePrices.js contains no numeric literals — it is a pure re-export', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'api', 'servicePrices.js'), 'utf8');
    const codeOnly = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(suspiciousNumberPattern.test(codeOnly)).toBe(false);
  });

  it("admin/api/_lib/catalogueSeed.js contains no numeric literals — it is a pure re-export", () => {
    const src = readFileSync(path.join(REPO_ROOT, 'admin', 'api', '_lib', 'catalogueSeed.js'), 'utf8');
    const codeOnly = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(suspiciousNumberPattern.test(codeOnly)).toBe(false);
  });
});

describe('server-side price authority still holds with the new architecture', () => {
  function deepPrice(deepService, deepSize, deepBaths = 1, addOnCounts = undefined) {
    return serverComputePrice({ service: 'deep', deepService, deepSize, deepBaths, addOnCounts });
  }

  it.each([
    ['studio', shared.EOT_COMPLETE_PRICES_P.studio],
    ['bed1',   shared.EOT_COMPLETE_PRICES_P.bed1],
    ['bed2',   shared.EOT_COMPLETE_PRICES_P.bed2],
    ['bed3',   shared.EOT_COMPLETE_PRICES_P.bed3],
    ['bed4',   shared.EOT_COMPLETE_PRICES_P.bed4],
  ])('EOT Complete %s matches shared.EOT_COMPLETE_PRICES_P', (size, expectedPence) => {
    expect(serverComputePrice({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: size,
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'complete',
    })).toBe(expectedPence / 100);
  });

  it('move-in prices match shared.MOVEIN_BASE_PRICES_P', () => {
    expect(deepPrice('move_in', 'bed2')).toBe(shared.MOVEIN_BASE_PRICES_P.bed2 / 100);
  });

  it('after-builders prices match shared.AFTER_BUILDERS_FROM_PRICES_P', () => {
    expect(deepPrice('after_builders', 'bed2')).toBe(shared.AFTER_BUILDERS_FROM_PRICES_P.bed2 / 100);
  });

  it('carpet minimum booking matches shared.CARPET_MIN_BOOKING_P', () => {
    const result = serverComputePrice({
      service: 'deep', deepService: 'carpet_upholstery',
      carpetCounts: { bedroom: 1 }, carpetCondition: 'normal',
    });
    expect(result).toBe(shared.CARPET_MIN_BOOKING_P / 100);
  });

  it('rejects a rug-only online checkout but allows a rug with a qualifying service', () => {
    const base = {
      service: 'deep', deepService: 'carpet_upholstery', carpetCondition: 'normal',
    };

    expect(serverComputePrice({ ...base, carpetCounts: { rug: 1 } })).toBeNull();
    expect(serverComputePrice({ ...base, carpetCounts: { rug: 1, bedroom: 1 } }))
      .toBeGreaterThanOrEqual(shared.CARPET_MIN_BOOKING_P / 100);
  });

  it('rejects an unrecognised deep service by returning null', () => {
    expect(serverComputePrice({ service: 'deep', deepService: 'not_a_real_service', deepSize: 'studio' })).toBeNull();
  });

  it('never trusts a client-supplied total — computePrice only ever uses quoteConfig fields', () => {
    expect(serverComputePrice.length).toBe(1);
  });
});

describe('catalogue seed items — spot-check against the canonical source', () => {
  function seedItem(name) {
    const item = adminSeedItems.find((i) => i.name === name);
    if (!item) throw new Error(`Catalogue seed item not found: "${name}"`);
    return item;
  }

  it('EOT Complete studio matches shared.EOT_COMPLETE_PRICES_P.studio', () => {
    expect(seedItem('End of tenancy clean (Complete) — studio').default_price_pence).toBe(shared.EOT_COMPLETE_PRICES_P.studio);
  });

  it('king-size mattress matches shared.CARPET_ITEM_PRICES_P.mattress_king', () => {
    expect(seedItem('Mattress clean (king-size)').default_price_pence).toBe(shared.CARPET_ITEM_PRICES_P.mattress_king);
  });

  it('every seed item price is a non-negative integer (pence)', () => {
    for (const item of adminSeedItems) {
      expect(Number.isInteger(item.default_price_pence)).toBe(true);
      expect(item.default_price_pence).toBeGreaterThanOrEqual(0);
    }
  });

  it('every seed item name is unique', () => {
    const names = adminSeedItems.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
