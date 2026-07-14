/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
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
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.js'],
  },
});
