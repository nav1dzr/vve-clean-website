import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root, entryPoints: ['src/data/websiteMediaPositionSource.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node', plugins: [{
    name: 'source-gallery', setup(builder) {
      builder.onResolve({ filter: /^virtual:eot-gallery$/ }, () => ({ path: 'gallery', namespace: 'eot' }));
      builder.onLoad({ filter: /.*/, namespace: 'eot' }, () => {
        const files = readdirSync(path.join(root, 'public/end_of_tenancy/gallery'))
          .filter(name => /\.(avif|jpe?g|png|webp)$/i.test(name))
          .sort(new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare).slice(0, 15)
          .map(name => `/end_of_tenancy/gallery/${encodeURIComponent(name)}`);
        return { contents: `export default ${JSON.stringify(files)}` };
      });
    },
  }],
});
const { createWebsiteMediaPositions } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const positions = createWebsiteMediaPositions();
const content = `// Generated from src/data/websiteMediaPositionSource.ts. Do not edit by hand.\n// Regenerate with node scripts/generateWebsiteMediaPositions.mjs.\nexport const WEBSITE_MEDIA_POSITIONS = Object.freeze(${JSON.stringify(positions, null, 2)});\n`;
const target = path.join(root, 'admin/shared/mediaWebsiteCatalogue.js');
const runtime = positions.map(({ key, kind, defaultMedia }) => ({ key, kind, defaultMedia: defaultMedia
  ? defaultMedia.type === 'before-after' ? { type: defaultMedia.type, before: defaultMedia.before, after: defaultMedia.after }
    : { type: defaultMedia.type, src: defaultMedia.src } : null }));
const runtimeContent = `// Generated public lookup only; captions and CRM placement descriptions stay out of the website bundle.\nexport const WEBSITE_MEDIA_RUNTIME = ${JSON.stringify(runtime)};\n`;
const runtimeTarget = path.join(root, 'shared/websiteMediaRuntime.js');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== content) throw new Error('Website media catalogue is out of date. Regenerate it from the website manifests.');
  if (readFileSync(runtimeTarget, 'utf8').replace(/\r\n/g, '\n') !== runtimeContent) throw new Error('Website media runtime lookup is out of date.');
  console.log(`Verified ${positions.length} website media positions against the source manifests.`);
} else {
  writeFileSync(target, content);
  writeFileSync(runtimeTarget, runtimeContent);
  console.log(`Wrote ${positions.length} website media positions.`);
}
