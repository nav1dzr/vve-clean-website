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
    setupFiles: ['./src/setupTests.ts'],
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
