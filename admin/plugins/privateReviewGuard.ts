import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** Vite copies public files verbatim, even when Git ignores them. */
export function privateReviewGuard(): Plugin {
  return {
    name: 'exclude-private-customer-review',
    apply: 'build',
    configResolved(config) {
      if (config.publicDir && existsSync(join(config.publicDir, '__hart_review__'))) {
        throw new Error('Build blocked: private customer review files are present in the public directory. Build from a clean checkout without these files.');
      }
    },
  };
}
