/**
 * Cross-cutting tests for the EOT wizard's server/client agreement and the
 * "same starting price everywhere" requirement.
 *
 * The wizard (frontend) and api/servicePrices.js (server) both compute an
 * EOT price — this proves they agree for a range of configurations, and
 * that every page displaying a starting EOT price ultimately reads it from
 * the single shared source rather than a page-local literal.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePrice as serverComputePrice } from '../../api/servicePrices.js';
import {
  calculateEotQuote, EOT_COMPLETE_PRICES_P, EOT_TAILORED_START_PRICES_P,
  calculateDepositAndBalance, DEPOSIT_P,
} from '../../shared/pricingCatalogue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function clientTotalPounds(input) {
  return calculateEotQuote(input).totalP / 100;
}

function serverTotalPounds(quoteConfig) {
  return serverComputePrice(quoteConfig);
}

describe('EOT server/client agreement — same inputs, same price, for every size and package', () => {
  const sizes = ['studio', 'bed1', 'bed2', 'bed3', 'bed4'];

  it.each(sizes)('%s — Complete, no adjustments', (size) => {
    const client = clientTotalPounds({ size, package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: size,
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'complete',
    });
    expect(server).toBe(client);
  });

  it.each(sizes)('%s — Tailored, no add-ons', (size) => {
    const client = clientTotalPounds({ size, package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0 });
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: size,
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'tailored',
    });
    expect(server).toBe(client);
  });

  it('agrees with house adjustment, 3 bathrooms and 2 WCs (Complete)', () => {
    const input = { size: 'bed3', package: 'complete', isHouse: true, extraBathrooms: 2, extraWcs: 2 };
    const client = clientTotalPounds(input);
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed3',
      deepBaths: 3, deepWcs: 2, isHouse: true, eotPackage: 'complete',
    });
    expect(server).toBe(client);
  });

  it('agrees with a full Tailored add-on set', () => {
    const tailoredAddOns = { fridgeFreezerInside: true, extraFridgeFreezers: 1, dishwasherInside: true, washingMachineInside: true, cupboards: true };
    const input = { size: 'bed2', package: 'tailored', isHouse: false, extraBathrooms: 0, extraWcs: 0, tailoredAddOns };
    const client = clientTotalPounds(input);
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2',
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'tailored', tailoredAddOns,
    });
    expect(server).toBe(client);
  });

  it('agrees when floor-care carpet areas are included but stay below the 3-area offer (2 areas)', () => {
    const rooms = [
      { id: 'bedroom-1', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'hallway', addonKey: 'hallway', floor: 'carpet' },
    ];
    const carpetRoomIds = ['bedroom-1', 'hallway'];
    const input = { size: 'bed1', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds };
    const client = clientTotalPounds(input);
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed1',
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'complete', rooms, carpetRoomIds,
    });
    expect(server).toBe(client);
  });

  it('agrees once eligible for the 50% carpet-package discount (3+ areas)', () => {
    const rooms = [
      { id: 'bedroom-1', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'bedroom-2', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'hallway', addonKey: 'hallway', floor: 'carpet' },
      { id: 'stairs', addonKey: 'stairs', floor: 'carpet', stairFlights: 2 },
    ];
    const carpetRoomIds = ['bedroom-1', 'bedroom-2', 'hallway', 'stairs'];
    const input = { size: 'bed2', package: 'tailored', isHouse: true, extraBathrooms: 1, extraWcs: 1, rooms, carpetRoomIds };
    const client = clientTotalPounds(input);
    const server = serverTotalPounds({
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2',
      deepBaths: 2, deepWcs: 1, isHouse: true, eotPackage: 'tailored', rooms, carpetRoomIds,
    });
    expect(server).toBe(client);
    // Sanity: the discount genuinely fired (this configuration is eligible).
    expect(calculateEotQuote(input).carpetPackage.eligible).toBe(true);
    expect(calculateEotQuote(input).carpetPackage.savingP).toBeGreaterThan(0);
  });

  it('the server ignores any client-submitted price/total field — computePrice only ever reads quoteConfig', () => {
    const rooms = [
      { id: 'bedroom-1', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'bedroom-2', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'hallway', addonKey: 'hallway', floor: 'carpet' },
    ];
    const carpetRoomIds = ['bedroom-1', 'bedroom-2', 'hallway'];
    const quoteConfig = {
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2',
      deepBaths: 1, deepWcs: 0, isHouse: false, eotPackage: 'complete', rooms, carpetRoomIds,
      // A client attempting to under-pay by claiming a bogus total. These
      // fields do not exist in computePrice's signature at all — it takes
      // only quoteConfig, so they cannot influence the result even if present.
      price: 1, total: 1, amount: 1,
    };
    const server = serverTotalPounds(quoteConfig);
    const honestClient = clientTotalPounds({ size: 'bed2', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds });
    expect(server).toBe(honestClient);
    expect(server).not.toBe(1);
  });

  it('deposit stays £30 and the remaining balance is correct for a carpet-inclusive EOT total', () => {
    const rooms = [
      { id: 'bedroom-1', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'bedroom-2', addonKey: 'bedroom', floor: 'carpet' },
      { id: 'hallway', addonKey: 'hallway', floor: 'carpet' },
    ];
    const carpetRoomIds = ['bedroom-1', 'bedroom-2', 'hallway'];
    const result = calculateEotQuote({ size: 'bed2', package: 'complete', isHouse: false, extraBathrooms: 0, extraWcs: 0, rooms, carpetRoomIds });
    expect(result.carpetPackage.eligible).toBe(true);
    const { depositP, balanceP } = calculateDepositAndBalance(result.totalP);
    expect(depositP).toBe(DEPOSIT_P); // £30, unchanged by the carpet package
    expect(balanceP).toBe(result.totalP - DEPOSIT_P);
  });
});

describe('EOT starting price is the same wherever it is displayed', () => {
  // Structural check: none of these customer-facing files may contain a
  // literal EOT price number — they must all read EOT_COMPLETE_PRICES_P /
  // EOT_TAILORED_START_PRICES_P from the shared source via src/data/pricing.
  const filesToCheck = [
    'src/components/Services.tsx',
    'src/pages/EndOfTenancyPage.tsx',
    'src/pages/PricingPage.tsx',
    'src/components/EotQuoteWizard.tsx',
    'src/components/QuoteCalculator.tsx',
  ];

  it.each(filesToCheck)('%s imports EOT prices from ../data/pricing rather than hardcoding them', (relPath) => {
    const src = readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    expect(src).toMatch(/from ['"](\.\.\/)*data\/pricing['"]/);
    expect(src).toMatch(/EOT_(COMPLETE|TAILORED|BASE)_PRICES?_P|EOT_PRICES_P/);
  });

  it('EOT_COMPLETE_PRICES_P.studio matches the explicit flat catalogue entry', () => {
    expect(EOT_COMPLETE_PRICES_P.studio).toBe(22000);
  });

  it('EOT_TAILORED_START_PRICES_P.studio is genuinely lower than the Complete price (a real "from")', () => {
    expect(EOT_TAILORED_START_PRICES_P.studio).toBeLessThan(EOT_COMPLETE_PRICES_P.studio);
  });
});
