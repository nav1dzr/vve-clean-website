// Static local dependency tracing only. Does not load environment files, link
// Vercel projects, import API handlers, or contact any external service.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { nodeFileTrace } = await import(process.env.NFT_MODULE || '@vercel/nft');
const root = fileURLToPath(new URL('../', import.meta.url));
async function entries(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await entries(file));
    else if (/\.(?:js|ts)$/.test(entry.name)) result.push(file);
  }
  return result.sort();
}
const report = [];
for (const [name, base] of [['website', root], ['crm', path.join(root, 'admin')]]) {
  const files = await entries(path.join(base, 'api'));
  const allowed = file => {
    const relative = path.relative(base, file);
    return !relative.startsWith('..') && !path.isAbsolute(relative) && !(name === 'website' && relative.replaceAll('\\', '/').startsWith('admin/node_modules/'));
  };
  const read = method => async file => {
    if (!allowed(file)) return null;
    try { return await fs[method](file); } catch (error) { if (['ENOENT','ENOTDIR','EINVAL'].includes(error.code)) return null; throw error; }
  };
  const trace = await nodeFileTrace(files, { base, processCwd: base, readFile: read('readFile'), stat: read('stat'), readlink: read('readlink') });
  const warnings = [...trace.warnings].map(error => error.message);
  const bundled = [...trace.fileList].map(file => file.replaceAll('\\', '/'));
  const missingRelative = warnings.filter(message => /Failed to resolve dependency ['"]\./.test(message));
  const dependencies = Object.keys(JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8')).dependencies || {});
  const missingRequired = warnings.filter(message => dependencies.some(dependency => message.includes(`'${dependency}'`) || message.includes(`"${dependency}"`)));
  const outside = bundled.filter(file => file.startsWith('../'));
  const optionalWarnings = warnings.filter(message => message.includes('"@opentelemetry/api"'));
  const unexpectedWarnings = warnings.filter(message => !optionalWarnings.includes(message));
  const item = { project: name, routeCount: files.length, routeLimit: 12, routes: files.map(file => path.relative(base, file).replaceAll('\\', '/')), tracedFiles: bundled.length, warnings, optionalWarnings, unexpectedWarnings, missingRelative, missingRequired, outsideRoot: outside, stripeBundled: bundled.some(file => file.startsWith('node_modules/stripe/')), sharedJourneyBundled: bundled.some(file => file.endsWith('api/_lib/bookingJourney.js')), sharedEnquiryBundled: bundled.some(file => file.endsWith('api/_lib/enquiryNotifications.js')) };
  report.push(item);
  if (files.length > 12 || missingRelative.length || missingRequired.length || unexpectedWarnings.length || outside.length || (name === 'website' && !item.stripeBundled) || !item.sharedJourneyBundled || !item.sharedEnquiryBundled) process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
