import sharp from 'sharp';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const srcFile = path.join(projectRoot, 'unburdened_icon.png');
const outDir = path.join(projectRoot, 'public', 'icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sizes = [
  { name: 'icon-16.png',   size: 16 },
  { name: 'icon-32.png',   size: 32 },
  { name: 'icon-57.png',   size: 57 },
  { name: 'icon-60.png',   size: 60 },
  { name: 'icon-72.png',   size: 72 },
  { name: 'icon-76.png',   size: 76 },
  { name: 'icon-114.png',  size: 114 },
  { name: 'icon-120.png',  size: 120 },
  { name: 'icon-144.png',  size: 144 },
  { name: 'icon-152.png',  size: 152 },
  { name: 'icon-167.png',  size: 167 },
  { name: 'icon-180.png',  size: 180 },
  { name: 'icon-192.png',  size: 192 },
  { name: 'icon-512.png',  size: 512 },
];

async function generateIcons() {
  console.log('Generating PWA icons from unburdened_icon.png...');

  for (const { name, size } of sizes) {
    await sharp(srcFile)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, name));
    console.log(`  ✓ ${name} (${size}×${size})`);
  }

  // Maskable icon — add ~20% padding around the image so the knot sits safely inside the safe zone
  const maskableSize = 512;
  const padding = Math.round(maskableSize * 0.15); // 15% padding each side
  const innerSize = maskableSize - padding * 2;

  await sharp(srcFile)
    .resize(innerSize, innerSize, { fit: 'cover' })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 8, g: 42, b: 44, alpha: 1 }, // #082a2c
    })
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('  ✓ icon-maskable-512.png (512×512, maskable)');

  // favicon.ico (32×32 PNG renamed — browsers accept PNG ICO)
  await sharp(srcFile)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(path.join(outDir, 'favicon.ico'));
  console.log('  ✓ favicon.ico (32×32)');

  console.log(`\nAll icons written to public/icons/`);
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
