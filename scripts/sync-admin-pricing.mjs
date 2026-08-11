#!/usr/bin/env node
// Syncs shared/pricingCatalogue.js into admin/api/_lib/pricingCatalogue.generated.js.
//
// WHY THIS EXISTS (rather than a direct import):
// admin/ is deployed as its own, separate Vercel project (see admin/vercel.json),
// most likely with its own "Root Directory" setting of `admin/`. Vercel's
// serverless file-tracing only reliably includes files that live within the
// configured project root at build time — a relative import reaching up to
// the repository root (`../../../shared/pricingCatalogue.js`) is NOT
// guaranteed to be included unless "Include files outside the Root Directory"
// is enabled in that project's dashboard settings, which cannot be verified
// from the repository. To stay safe regardless of that unverifiable setting,
// admin/ gets a mechanically-produced, verified-identical copy INSIDE its own
// directory tree instead of a cross-root import.
//
// This script is the ONLY thing that writes the generated file. It is run:
//   - manually: `npm run sync-admin-pricing`
//   - automatically before root and admin builds (see package.json "prebuild")
//   - in --check mode by tests/api/pricingSource.test.js, which fails the
//     test suite (and therefore CI) if the committed generated file has
//     drifted from what would currently be generated.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const SOURCE_PATH = path.join(REPO_ROOT, 'shared', 'pricingCatalogue.js');
export const GENERATED_PATH = path.join(REPO_ROOT, 'admin', 'api', '_lib', 'pricingCatalogue.generated.js');

const BANNER_LINES = [
  '// WARNING: AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.',
  '//',
  '// This is a mechanically synced, verified-identical copy of',
  '// shared/pricingCatalogue.js (the single canonical pricing source for the',
  '// whole repository), produced by scripts/sync-admin-pricing.mjs.',
  '//',
  '// WHY A COPY, NOT AN IMPORT: admin/ is deployed as a separate Vercel project',
  '// and cannot be guaranteed to have build-time access to files outside its',
  '// own directory tree — see that script\'s header comment for the full',
  '// explanation.',
  '//',
  '// To change a price: edit shared/pricingCatalogue.js at the repository',
  '// root, NOT this file. Then run \'npm run sync-admin-pricing\' from the',
  '// repository root (this also runs automatically before \'npm run build\' in',
  '// both the root and admin/ projects). This file is committed to the repo so',
  '// admin\'s isolated build always has it — a test',
  '// (tests/api/pricingSource.test.js) fails loudly if it is ever out of date.',
  '//',
  '// ─────────────────────────────────────────────────────────────────────────',
  '',
  '',
];
const BANNER = BANNER_LINES.join('\n');

export function buildGeneratedContent() {
  // Normalize the source's line endings to LF before concatenating. On a
  // Windows checkout (core.autocrlf=true), shared/pricingCatalogue.js is
  // checked out with CRLF while BANNER above is authored in-memory with LF
  // (`.join('\n')` never goes through git's checkout conversion). Writing
  // that mismatch straight to disk produced a file with a mixed banner/body
  // line ending that never matched the pure-LF committed blob — so this
  // script left the generated file "modified" every time it ran, even with
  // no real change. Stripping CR here makes the output pure LF regardless of
  // platform, matching what git stores.
  const source = readFileSync(SOURCE_PATH, 'utf8').replace(/\r\n?/g, '\n');
  return BANNER + source;
}

/** Returns true if the committed generated file matches what would be generated now. */
export function isInSync() {
  if (!existsSync(GENERATED_PATH)) return false;
  const existing = readFileSync(GENERATED_PATH, 'utf8');
  return existing === buildGeneratedContent();
}

export function writeGeneratedFile() {
  writeFileSync(GENERATED_PATH, buildGeneratedContent(), 'utf8');
}

// ── CLI entry point ─────────────────────────────────────────────────────────
// Only runs the write/check side effect when this file is executed directly
// (`node scripts/sync-admin-pricing.mjs`), not when imported by a test.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    if (isInSync()) {
      console.log('[sync-admin-pricing] admin/api/_lib/pricingCatalogue.generated.js is in sync.');
      process.exit(0);
    } else {
      console.error(
        '[sync-admin-pricing] STALE: admin/api/_lib/pricingCatalogue.generated.js does not match ' +
        'shared/pricingCatalogue.js. Run `npm run sync-admin-pricing` to regenerate.',
      );
      process.exit(1);
    }
  } else {
    writeGeneratedFile();
    console.log(`[sync-admin-pricing] wrote ${path.relative(REPO_ROOT, GENERATED_PATH)}`);
  }
}
