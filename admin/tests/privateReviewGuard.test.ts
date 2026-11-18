// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { privateReviewGuard } from '../plugins/privateReviewGuard';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vve-private-review-build-'));
  roots.push(root);
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Synthetic build test</title>');
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('private customer review build guard', () => {
  it('stops a real production build before Vite can copy private review files', async () => {
    const root = fixture();
    const privateDirectory = join(root, 'public', '__hart_review__');
    mkdirSync(privateDirectory, { recursive: true });
    writeFileSync(join(privateDirectory, 'pack.json'), '{"synthetic":"never publish"}');
    await expect(build({ root, configFile: false, logLevel: 'silent', plugins: [privateReviewGuard()] }))
      .rejects.toThrow('Build blocked: private customer review files');
    expect(existsSync(join(root, 'dist', '__hart_review__', 'pack.json'))).toBe(false);
  });

  it('allows a clean production checkout to build', async () => {
    const root = fixture();
    await build({ root, configFile: false, logLevel: 'silent', plugins: [privateReviewGuard()] });
    expect(existsSync(join(root, 'dist', 'index.html'))).toBe(true);
  });
});
