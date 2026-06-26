import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'icons');
const sourcePath = path.join(iconsDir, 'logo-source.png');
const THEME_BG = { r: 8, g: 8, b: 10, alpha: 1 };

if (!fs.existsSync(sourcePath)) {
  console.error('Missing icons/logo-source.png — положите исходник логотипа в эту папку.');
  process.exit(1);
}

function isBgPixel(r, g, b) {
  const avg = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (r > 235 && g > 235 && b > 235) return true;
  return avg > 185 && spread < 28;
}

function isColorfulPixel(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b) > 34;
}

/** Убирает шахматный/белый фон; белая «K» и серые точки остаются (смежны с тёмной зоной). */
function removeLogoBackground(data, width, height, channels) {
  const out = Buffer.from(data);
  const keep = new Uint8Array(width * height);

  for (let idx = 0; idx < width * height; idx += 1) {
    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isBgPixel(r, g, b)) {
      keep[idx] = 1;
      continue;
    }

    const x = idx % width;
    const y = (idx - x) / width;
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = (ny * width + nx) * channels;
      const nr = data[j];
      const ng = data[j + 1];
      const nb = data[j + 2];
      if (!isBgPixel(nr, ng, nb) && !isColorfulPixel(nr, ng, nb)) {
        keep[idx] = 1;
        break;
      }
    }
  }

  for (let idx = 0; idx < width * height; idx += 1) {
    if (keep[idx]) continue;
    const i = idx * channels;
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    if (channels === 4) out[i + 3] = 0;
  }

  return out;
}

async function loadLogoRgba() {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = removeLogoBackground(data, info.width, info.height, info.channels);
  return sharp(cleaned, {
    raw: { width: info.width, height: info.height, channels: info.channels }
  }).png().toBuffer();
}

const uiTargets = [
  { file: 'brand-mark.png', size: 56 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-16.png', size: 16 }
];

const appTargets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 }
];

async function saveTransparentPng(logoBuffer, size, file) {
  await sharp(logoBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(iconsDir, file));
  console.log(`generated ${file}`);
}

async function saveOnThemeBg(logoBuffer, size, file, padRatio = 0) {
  const pad = Math.round(size * padRatio);
  const inner = size - pad * 2;
  const resized = await sharp(logoBuffer)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: THEME_BG
    }
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, file));
  console.log(`generated ${file}`);
}

async function run() {
  const logoBuffer = await loadLogoRgba();
  await fs.promises.writeFile(path.join(iconsDir, 'logo-clean.png'), logoBuffer);

  for (const target of uiTargets) {
    await saveTransparentPng(logoBuffer, target.size, target.file);
  }
  for (const target of appTargets) {
    await saveOnThemeBg(logoBuffer, target.size, target.file);
  }
  await saveOnThemeBg(logoBuffer, 512, 'maskable-512.png', 0.12);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
