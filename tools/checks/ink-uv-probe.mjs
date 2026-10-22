/**
 * Ink-UV asset probe.
 *
 * The shader samples tattoos with TEXCOORD_1 (`inkUv`), a second UV set where every
 * body zone has its own compact chart. Two failure modes are silent in the browser
 * and both are caught here:
 *
 *  1. a stale GLB — someone re-ran `build_meshes.py` without `ink_uv.py`, so
 *     TEXCOORD_1 vanished and the shader fell back to the skin unwrap (the snake
 *     that capped back pieces at 11 cm);
 *  2. overlapping charts — a packing bug putting two zones in the same texture
 *     cell, which the region gate would then clip in a way that looks like a
 *     "broken" design rather than a broken atlas.
 *
 * Reads the shipped GLB directly (JSON chunk + BIN chunk), no three.js, no DOM.
 */
import fs from 'node:fs';
import path from 'node:path';

const MODELS = 'public/models';
const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${file} is not a GLB`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === CHUNK_JSON) json = JSON.parse(buf.subarray(start, start + len).toString('utf8'));
    if (type === CHUNK_BIN) bin = buf.subarray(start, start + len);
    offset = start + len;
  }
  if (!json || !bin) throw new Error(`${file} is missing a chunk`);
  return { json, bin };
}

function accessor(json, bin, index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
  if (!comps || !bytes) throw new Error(`unsupported accessor ${index}`);
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = new Float64Array(acc.count * comps);
  for (let i = 0; i < acc.count * comps; i += 1) {
    const at = base + i * bytes;
    out[i] =
      bytes === 4 && acc.componentType === 5126
        ? bin.readFloatLE(at)
        : bytes === 1
          ? bin.readUInt8(at)
          : bytes === 2
            ? bin.readUInt16LE(at)
            : bin.readUInt32LE(at);
  }
  return { data: out, count: acc.count, comps };
}

const regions = JSON.parse(fs.readFileSync(path.join(MODELS, 'regions.json'), 'utf8'));
const indexToId = new Map(regions.regions.map((r) => [r.index, r.id]));
const failures = [];

for (const kind of ['male', 'female']) {
  const { json, bin } = readGlb(path.join(MODELS, `inkverse-${kind}.glb`));
  const node = json.nodes.find((n) => n.name === 'Body');
  if (!node) {
    failures.push(`${kind}: no Body node`);
    continue;
  }
  const prim = json.meshes[node.mesh].primitives[0];
  const attrs = prim.attributes;
  if (attrs.TEXCOORD_1 === undefined) {
    failures.push(`${kind}: Body has no TEXCOORD_1 — rerun "npm run assets:models"`);
    continue;
  }
  const pos = accessor(json, bin, attrs.POSITION);
  const ink = accessor(json, bin, attrs.TEXCOORD_1);
  const idx = accessor(json, bin, prim.indices);
  if (ink.count !== pos.count) {
    failures.push(`${kind}: TEXCOORD_1 has ${ink.count} entries for ${pos.count} vertices`);
    continue;
  }

  // face -> zone from the baked byte array; after the seam split every vertex
  // belongs to exactly one zone, so this is unambiguous
  const faceRegions = fs.readFileSync(path.join(MODELS, `face-regions-${kind}.bin`));
  const faceCount = idx.count / 3;
  if (faceRegions.length !== faceCount) {
    failures.push(`${kind}: face-regions has ${faceRegions.length} entries for ${faceCount} triangles — stale asset`);
    continue;
  }
  const vertexZone = new Int16Array(pos.count).fill(-1);
  for (let f = 0; f < faceCount; f += 1) {
    const z = faceRegions[f];
    for (let c = 0; c < 3; c += 1) {
      const v = idx.data[f * 3 + c];
      if (vertexZone[v] === -1) vertexZone[v] = z;
      else if (vertexZone[v] !== z) {
        failures.push(`${kind}: vertex ${v} spans zones ${vertexZone[v]} and ${z} — seam split missing`);
        break;
      }
    }
  }

  const boxes = new Map();
  for (let v = 0; v < pos.count; v += 1) {
    const z = vertexZone[v];
    if (z <= 0) continue;
    const u = ink.data[v * 2];
    const w = ink.data[v * 2 + 1];
    if (!(u >= -1e-4 && u <= 1 + 1e-4 && w >= -1e-4 && w <= 1 + 1e-4)) {
      failures.push(`${kind}: vertex ${v} has ink UV outside [0,1]: ${u},${w}`);
      break;
    }
    const box = boxes.get(z) ?? { u0: 1, v0: 1, u1: 0, v1: 0 };
    box.u0 = Math.min(box.u0, u);
    box.v0 = Math.min(box.v0, w);
    box.u1 = Math.max(box.u1, u);
    box.v1 = Math.max(box.v1, w);
    boxes.set(z, box);
  }

  const metresPerUv = 2.42;
  console.log(`\n=== ${kind} — ${boxes.size} zone charts in TEXCOORD_1 (${pos.count} verts)`);
  const entries = [...boxes.entries()].sort((a, b) => a[0] - b[0]);
  let overlaps = 0;
  for (let i = 0; i < entries.length; i += 1) {
    const [za, ba] = entries[i];
    for (let j = i + 1; j < entries.length; j += 1) {
      const [zb, bb] = entries[j];
      const pad = 0.004; // bake adds a 2 texel margin to each printed box
      const hit =
        ba.u0 < bb.u1 + pad && bb.u0 < ba.u1 + pad && ba.v0 < bb.v1 + pad && bb.v0 < ba.v1 + pad;
      if (hit) {
        overlaps += 1;
        failures.push(`${kind}: charts ${indexToId.get(za)} and ${indexToId.get(zb)} overlap`);
      }
    }
  }
  for (const [z, b] of entries) {
    console.log(
      `  ${String(indexToId.get(z)).padEnd(12)} ${((b.u1 - b.u0) * metresPerUv).toFixed(2)} x ${((b.v1 - b.v0) * metresPerUv).toFixed(2)} m` +
        `  at (${b.u0.toFixed(3)}, ${b.v0.toFixed(3)})`,
    );
  }
  console.log(`  ${overlaps === 0 ? '✓ no overlapping charts' : `✗ ${overlaps} overlapping chart pairs`}`);
}

if (failures.length) {
  for (const f of failures) console.error('✗ ' + f);
  process.exitCode = 1;
} else {
  console.log('\nink UV set present, complete and non-overlapping on both bodies');
}
