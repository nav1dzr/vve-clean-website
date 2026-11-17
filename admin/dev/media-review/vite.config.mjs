import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { websiteMediaManifest } from '../../plugins/websiteMediaManifest';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

// Local-only visual regression harness. Auth and every CRM request are replaced;
// publishing changes only the synthetic browser fixture, never a remote record.
export default defineConfig({
  root: here('.'),
  envDir: here('.'),
  plugins: [react(), websiteMediaManifest(), {
    name: 'synthetic-media-review', enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('/lib/authFetch')) return here('./mockFetch.ts');
      if (source.endsWith('/auth/useAuth')) return here('./mockAuth.ts');
      return null;
    },
  }],
  server: { host: '127.0.0.1', port: 8963, strictPort: true, fs: { allow: [here('../../..')] } },
});
