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
    environment: 'node',
    // admin/ is a fully separate app with its own vite.config.ts and test
    // suite (its own `npm test` inside admin/) — keep the two projects'
    // test runs independent rather than have the root config sweep into it.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
