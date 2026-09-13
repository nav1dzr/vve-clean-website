/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EOT_GALLERY_ID = 'virtual:eot-gallery';
const EOT_GALLERY_RESOLVED_ID = `\0${EOT_GALLERY_ID}`;
const EOT_GALLERY_DIR = fileURLToPath(new URL('./public/end_of_tenancy/gallery/', import.meta.url));
const PUBLIC_IMAGE_EXTENSION = /\.(avif|jpe?g|png|webp)$/i;

function eotGalleryManifest() {
  return {
    name: 'vve-eot-gallery-manifest',
    resolveId(id: string) {
      return id === EOT_GALLERY_ID ? EOT_GALLERY_RESOLVED_ID : undefined;
    },
    load(id: string) {
      if (id !== EOT_GALLERY_RESOLVED_ID) return undefined;

      const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
      const images = readdirSync(EOT_GALLERY_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && PUBLIC_IMAGE_EXTENSION.test(entry.name))
        .map((entry) => entry.name)
        .sort(collator.compare)
        .slice(0, 15)
        .map((filename) => `/end_of_tenancy/gallery/${encodeURIComponent(filename)}`);

      return `export default ${JSON.stringify(images)};`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), eotGalleryManifest()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    // Vitest's 5s default is too tight for this suite. Several specs render a
    // whole page (ServiceLandingLayout + QuoteCalculator + galleries) and then
    // drive it with userEvent; on a loaded machine or a slow CI runner those
    // exceed 5s and fail as timeouts with no underlying defect — two
    // consecutive local runs produced 9 and then 11 spurious failures from
    // *different* files, while the same suite passed 1209/1209 at a higher
    // timeout. A genuinely hung test still fails, just 20s later.
    testTimeout: 20000,
    // Named vitestSetup.ts, NOT setupTests.ts — admin/ has its own
    // vite.config.ts with setupFiles: ['./src/setupTests.ts'], and giving
    // this file the identical relative path (src/setupTests.ts) causes
    // Vite's workspace-root resolution to load THIS file when running
    // admin's own `npm test` from within admin/, instead of admin's own
    // setup file — silently breaking every admin test. Confirmed by
    // reproducing and fixing during this change; keep the names distinct.
    setupFiles: ['./src/vitestSetup.ts'],
    globals: true,
    // admin/ is a fully separate app with its own vite.config.ts and test
    // suite (its own `npm test` inside admin/) — keep the two projects'
    // test runs independent rather than have the root config sweep into it.
    //
    // API route tests live under tests/api/, not api/ itself — Vercel treats
    // every non-underscore-prefixed file under api/ as a deployable Serverless
    // Function, so a co-located *.test.js file would be deployed (and error,
    // having no default-exported handler) rather than just being test-only.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.js', 'cloudflare/**/*.{test,spec}.js'],
  },
});
