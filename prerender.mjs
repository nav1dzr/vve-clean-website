import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

const routes = [
  {
    path: '/',
    title: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    description:
      'Professional carpet, sofa, upholstery, deep and end of tenancy cleaning across London. Fixed quotes, reliable service and fast booking. Get a free quote today.',
  },
  {
    path: '/pricing',
    title: 'Cleaning Prices East & North London | End of Tenancy, Carpet & Upholstery | VVE Clean',
    description:
      'Fixed cleaning prices for East & North London. End of tenancy from £159, carpet cleaning from £90, upholstery cleaning from £40, move-in deep clean from £139, after builders from £199. No hidden fees — the price you see is the price you pay.',
  },
  {
    path: '/commercial',
    title: 'Commercial & Communal Cleaning East London | Offices, Shops & Blocks | VVE Clean',
    description:
      'Contract cleaning for offices, shops, cafés and communal areas for landlords and managing agents across East & North London (E1–E17, N1–N16). Free site visit within 48 hours, fixed written quote the same day, monthly invoicing.',
  },
];

const { render } = await import('./dist/server/entry-server.js');
const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

for (const route of routes) {
  const html = render(route.path);

  let output = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`
  );

  output = output.replace(
    /<title>[^<]*<\/title>/,
    `<title>${route.title}</title>`
  );

  output = output.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${route.description}"`
  );

  const outPath =
    route.path === '/'
      ? resolve(distDir, 'index.html')
      : resolve(distDir, route.path.slice(1), 'index.html');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`Pre-rendered ${route.path}`);
}
