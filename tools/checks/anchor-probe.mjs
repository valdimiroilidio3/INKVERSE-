/** Verifies that each slot's anchor lands on that slot's own region id. */
import sharp from 'sharp';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('public/models/regions.json', 'utf8'));
let failures = 0;

for (const character of ['male', 'female']) {
  const { data: px, info } = await sharp(`public/models/region-ids-${character}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = info.width;
  const sample = (u, v) => {
    const x = Math.min(size - 1, Math.max(0, Math.round(u * (size - 1))));
    const y = Math.min(size - 1, Math.max(0, Math.round((1 - v) * (size - 1))));
    return px[(y * size + x) * 4];
  };
  console.log(`\n=== ${character}`);
  for (const meta of data.regions) {
    const region = data.characters[character][meta.id];
    for (const [i, slot] of region.slots.entries()) {
      const a = slot.anchor;
      if (!a) { console.log(`  ✗ ${meta.id}[${i}] no anchor`); failures++; continue; }
      const id = sample(a[0], a[1]);
      const ok = id === meta.index;
      if (!ok) failures++;
      const [u0, v0, u1, v1] = slot.uvBox;
      const centre = sample((u0 + u1) / 2, (v0 + v1) / 2);
      console.log(
        `  ${ok ? '✓' : '✗'} ${meta.id.padEnd(12)}[${i}] anchor id ${String(id).padStart(2)} (want ${String(meta.index).padStart(2)})  r=${slot.anchorRadius.toFixed(3)}  box-centre id ${String(centre).padStart(2)}${centre !== meta.index ? '  <-- box centre is off-region' : ''}`,
      );
    }
  }
}
console.log(`\n${failures === 0 ? 'all anchors sit on their own region' : failures + ' bad anchor(s)'}`);
process.exitCode = failures ? 1 : 0;
