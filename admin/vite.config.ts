/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { websiteMediaManifest } from './plugins/websiteMediaManifest';
import { privateReviewGuard } from './plugins/privateReviewGuard';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [privateReviewGuard(), react(), websiteMediaManifest()],
  server: {
    port: 5174,
  },
  preview: {
    port: 4174,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
});
