import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'icons');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#f97373"/>
      <stop offset="48%" stop-color="#e50914"/>
      <stop offset="100%" stop-color="#7f0910"/>
    </radialGradient>
    <linearGradient id="card" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#25252d"/>
      <stop offset="100%" stop-color="#101014"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="118" fill="#08080a"/>
  <circle cx="256" cy="256" r="188" fill="url(#glow)" opacity="0.22"/>
  <rect x="116" y="118" width="280" height="276" rx="44" fill="url(#card)" stroke="rgba(255,255,255,0.16)" stroke-width="10"/>
  <path fill="#e50914" d="M156 160h200v52H156z"/>
  <path fill="#ffffff" fill-opacity="0.94" d="M206 239v96l86-48-86-48z"/>
  <path fill="#f5f5f7" fill-opacity="0.74" d="M156 351h200v22H156z"/>
  <path fill="#f5f5f7" fill-opacity="0.28" d="M156 225h44v28h-44zm156 0h44v28h-44zM156 286h44v28h-44zm156 0h44v28h-44z"/>
</svg>`;

const buffer = Buffer.from(svg);

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 }
];

async function run() {
  for (const target of targets) {
    await sharp(buffer, { density: 384 })
      .resize(target.size, target.size, { fit: 'cover' })
      .png()
      .toFile(path.join(iconsDir, target.file));
    console.log(`generated ${target.file}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
