#!/usr/bin/env node
/**
 * Rasterise the INKVERSE tattoo library.
 *   assets/tattoos-src/*.svg  ->  public/tattoos/<id>.png      (1024², transparent ink)
 *                                 public/tattoos/thumbs/<id>.webp (640², dark card)
 *
 * Run: npm run assets:tattoos
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..', '..');
const srcDir = path.join(root, 'assets', 'tattoos-src');
const outDir = path.join(root, 'public', 'tattoos');
const thumbDir = path.join(root, 'public', 'tattoos', 'thumbs');

const CARD = 640;

function cardSvg(inkBuffer) {
  const b64 = inkBuffer.toString('base64');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD}" height="${CARD}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#232323"/>
        <stop offset="55%" stop-color="#161616"/>
        <stop offset="100%" stop-color="#0b0b0b"/>
      </radialGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/>
        <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
        <feComposite operator="over" in2="SourceGraphic"/></filter>
    </defs>
    <rect width="${CARD}" height="${CARD}" fill="url(#bg)"/>
    <rect x="18" y="18" width="${CARD - 36}" height="${CARD - 36}" fill="none" stroke="#2a2a2a" stroke-width="1"/>
    <image href="data:image/png;base64,${b64}" x="86" y="86" width="${CARD - 172}" height="${CARD - 172}"
      opacity="0.94" style="mix-blend-mode:screen"/>
    <rect width="${CARD}" height="${CARD}" filter="url(#grain)" opacity="0.5" fill="none"/>
  </svg>`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(thumbDir, { recursive: true });
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.svg')).sort();
  for (const file of files) {
    const id = path.basename(file, '.svg');
    const svg = await fs.readFile(path.join(srcDir, file));
    // ink plate (white ink on transparent, inverted later) -> use black on transparent
    const png = await sharp(svg, { density: 144 })
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    await fs.writeFile(path.join(outDir, `${id}.png`), png);
    // Gallery card: ink inverted to warm white so it reads on the dark card
    const white = await sharp(png).negate({ alpha: false }).png().toBuffer();
    const card = await sharp(cardSvg(white)).webp({ quality: 88 }).toBuffer();
    await fs.writeFile(path.join(thumbDir, `${id}.webp`), card);
    const meta = await sharp(png).metadata();
    console.log(`  ${id.padEnd(20)} ${(png.length / 1024).toFixed(0)} KB  ${meta.width}x${meta.height}`);
  }
  console.log(`${files.length} tattoo designs rasterised`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
