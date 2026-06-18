import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src   = resolve(__dir, '../public/favicon.png');
const out   = resolve(__dir, '../public');

const PNG_SIZES = [16, 32, 48, 180, 192, 512];
const ICO_SIZES = [16, 32, 48];

async function main() {
  // Generate all PNGs
  for (const size of PNG_SIZES) {
    const name =
      size === 180 ? 'apple-touch-icon.png'
      : size === 192 ? 'android-chrome-192x192.png'
      : size === 512 ? 'android-chrome-512x512.png'
      : `favicon-${size}x${size}.png`;

    await sharp(src)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(`${out}/${name}`);

    console.log(`✓ ${name}`);
  }

  // Build favicon.ico from 16, 32, 48 buffers
  const icoBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(src)
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
    )
  );

  const ico = await pngToIco(icoBuffers);
  writeFileSync(`${out}/favicon.ico`, ico);
  console.log('✓ favicon.ico (16/32/48px)');
}

main().catch((err) => { console.error(err); process.exit(1); });
