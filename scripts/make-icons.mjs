#!/usr/bin/env node
/**
 * Rasterises public/icon.svg into the PNGs Android needs for a real install.
 * Run after changing the icon: npm run icons
 *
 * Two shapes:
 *  - "any"      the icon as drawn, rounded-square, for legacy launchers
 *  - "maskable" the same mark inside Android's 80% safe zone, so the launcher can
 *               crop it to a circle/squircle without clipping the ring
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const mark = (size, { maskable }) => {
  // Safe zone: on a maskable icon the launcher may crop everything outside the middle 80%.
  const s = size;
  const glowR = maskable ? s * 0.28 : s * 0.33;
  const ringR = maskable ? s * 0.115 : s * 0.135;
  const radius = maskable ? 0 : s * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#b3a7f8" stop-opacity="0.98"/>
      <stop offset="55%" stop-color="#7c6ce0" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#7c6ce0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" fill="#0c0c10"/>
  <circle cx="${s / 2}" cy="${s / 2}" r="${glowR}" fill="url(#g)"/>
  <circle cx="${s / 2}" cy="${s / 2}" r="${ringR}" fill="none"
          stroke="#c9c0ff" stroke-opacity="0.85" stroke-width="${Math.max(1.5, s * 0.006)}"/>
</svg>`;
};

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const t of targets) {
  const svg = Buffer.from(mark(t.size, { maskable: t.maskable }));
  // A smooth radial gradient compresses badly as truecolour PNG; a 128-colour palette is
  // visually identical at icon size and roughly 20× smaller.
  const png = await sharp(svg, { density: 384 })
    .png({ compressionLevel: 9, palette: true, colours: 128, dither: 1 })
    .toBuffer();
  writeFileSync(join(pub, t.file), png);
  console.log(`  ${t.file}  ${t.size}×${t.size}${t.maskable ? ' (maskable)' : ''}`);
}

// Keep the scalable version in sync with the raster ones.
writeFileSync(join(pub, 'icon.svg'), mark(512, { maskable: false }));
console.log('  icon.svg');
