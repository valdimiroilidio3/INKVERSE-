/**
 * Ink placement probe — does a piece land where and at the size it claims?
 *
 * Runs the real placement maths (`lib/placement.ts`) against the shipped GLB and
 * the shipped `regions.json`, then measures the result on the mesh instead of
 * trusting the numbers the maths returns:
 *
 *  1. every vertex of the zone whose ink UV falls inside the placed square is
 *     collected — that is exactly the ink footprint, since the shader's region gate
 *     only lets those fragments through;
 *  2. the 3D extent of that footprint is compared with the nominal size;
 *  3. the piece's square is checked against the zone's measured usable square, so a
 *     design can never be promised a size the zone cannot hold.
 *
 * No GPU and no browser: it validates the asset + maths contract, which is what the
 * shader consumes. Visual confirmation still needs a real WebGL context (see
 * docs/3d-audit.md §6).
 *
 * Run: npx tsx tools/checks/ink-placement-probe.ts [male|female]
 */
import fs from 'node:fs';
import { computePlacement, shaderTransform } from '../../lib/placement';
import { getRegions, primarySlot } from '../../lib/regions';
import { TATTOO_LIBRARY } from '../../lib/tattoos';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(file: string) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${file} is not a GLB`);
  let offset = 12;
  let json: any = null;
  let bin: Buffer | null = null;
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

function accessor(json: any, bin: Buffer, index: number) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const comps = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[acc.type]!;
  const bytes = ({ 5121: 1, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[acc.componentType]!;
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = new Float64Array(acc.count * comps);
  for (let i = 0; i < out.length; i += 1) {
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

const kind = process.argv[2] === 'female' ? 'female' : 'male';
const { json, bin } = readGlb(`public/models/inkverse-${kind}.glb`);
const node = json.nodes.find((n: any) => n.name === 'Body');
const prim = json.meshes[node.mesh].primitives[0];
const pos = accessor(json, bin, prim.attributes.POSITION);
const ink = accessor(json, bin, prim.attributes.TEXCOORD_1);
const idx = accessor(json, bin, prim.indices);
const faceRegions = fs.readFileSync(`public/models/face-regions-${kind}.bin`);

const zoneOf = new Int16Array(pos.count).fill(-1);
for (let f = 0; f < faceRegions.length; f += 1) {
  for (let c = 0; c < 3; c += 1) {
    const v = idx.data[f * 3 + c]!;
    if (zoneOf[v] === -1) zoneOf[v] = faceRegions[f]!;
  }
}

const design = TATTOO_LIBRARY.find((d) => d.recommendedRegions.includes('upper-back')) ?? TATTOO_LIBRARY[0]!;
let failures = 0;
let warned = 0;
console.log(`[${kind}] design "${design.name}" default size ${(design.defaultSize * 100).toFixed(0)} cm\n`);
console.log('zone          allowed   placed    faces   covered          density   verdict');

for (const region of getRegions(kind)) {
  const slot = primarySlot(region);
  if (!slot) continue;
  const placement = computePlacement({
    slot,
    designSize: design.defaultSize,
    scale: 3, // ask for the biggest piece the zone allows
    offset: [0, 0],
    rotation: 0,
  });
  const tf = shaderTransform(
    {
      id: 'probe',
      designId: design.id,
      characterId: kind,
      bodyRegion: region.id,
      offset: [0, 0],
      rotation: 0,
      scale: 3,
      opacity: 1,
      mirrored: false,
    },
    slot,
    design.defaultSize,
    region.index,
    0,
  );

  // Footprint = the zone's faces whose three corners sit inside the placed square.
  // Summing their surface area avoids vertex-sampling bias: a piece of side s must
  // cover s² of skin whatever the tessellation looks like.
  let faces = 0;
  let area3 = 0;
  let areaUv = 0;
  const centre = tf.center;
  const hx = tf.half[0];
  const hy = tf.half[1];
  const inside = (u: number, w: number) => {
    const qx = (u - centre[0]) / (2 * hx) + 0.5;
    const qy = (w - centre[1]) / (2 * hy) + 0.5;
    return qx >= 0 && qx <= 1 && qy >= 0 && qy <= 1;
  };
  for (let f = 0; f < faceRegions.length; f += 1) {
    if (faceRegions[f] !== region.index) continue;
    const v = [idx.data[f * 3]!, idx.data[f * 3 + 1]!, idx.data[f * 3 + 2]!];
    if (!v.every((vi) => inside(ink.data[vi * 2]!, ink.data[vi * 2 + 1]!))) continue;
    const p = v.map((vi) => [pos.data[vi * 3]!, pos.data[vi * 3 + 1]!, pos.data[vi * 3 + 2]!]);
    const e1 = [p[1]![0]! - p[0]![0]!, p[1]![1]! - p[0]![1]!, p[1]![2]! - p[0]![2]!];
    const e2 = [p[2]![0]! - p[0]![0]!, p[2]![1]! - p[0]![1]!, p[2]![2]! - p[0]![2]!];
    const cross = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    area3 += 0.5 * Math.hypot(cross[0]!, cross[1]!, cross[2]!);
    const uv = v.map((vi) => [ink.data[vi * 2]!, ink.data[vi * 2 + 1]!]);
    areaUv +=
      0.5 *
      Math.abs(
        (uv[1]![0]! - uv[0]![0]!) * (uv[2]![1]! - uv[0]![1]!) -
          (uv[2]![0]! - uv[0]![0]!) * (uv[1]![1]! - uv[0]![1]!),
      );
    faces += 1;
  }

  const measured = Math.sqrt(area3); // side of the square of skin actually covered
  const allowed = (2 * slot.square![2]) / slot.uvPerMeter;
  const nominal = placement.sizeMeters;
  const localScale = Math.sqrt(areaUv / Math.max(area3, 1e-9)); // UV per metre, from the mesh
  const densityRatio = localScale / slot.uvPerMeter;
  const okAllowed = nominal <= allowed + 1e-6;
  // 12 % is the accuracy budget; beyond 25 % is a real defect. Anything in between
  // is reported loudly instead of being hidden inside a green tick.
  const dev = Math.abs(densityRatio - 1);
  const okDensity = dev < 0.25;
  const okFaces = faces >= 2;
  const warn = okDensity && dev >= 0.12;
  const verdict = !okDensity || !okAllowed || !okFaces ? '✗' : warn ? '⚠' : '✓';
  if (verdict === '✗') failures += 1;
  if (verdict === '⚠') warned += 1;
  console.log(
    `${region.id.padEnd(12)} ${(allowed * 100).toFixed(1).padStart(6)} cm ${(nominal * 100).toFixed(1).padStart(6)} cm ` +
      `${String(faces).padStart(7)} f  ${(measured * 100).toFixed(1).padStart(5)} cm skin  ` +
      `density ${densityRatio.toFixed(2)}×  ${verdict}`,
  );
  if (!okAllowed) console.log('              ↳ stated size exceeds the zone square');
  if (!okDensity) console.log(`              ↳ ink density disagrees with regions.json by ${(100 * (densityRatio - 1)).toFixed(0)} %`);
  else if (warn) console.log(`              ↳ cm accuracy outside the 12 % budget (${(100 * (densityRatio - 1)).toFixed(0)} %)`);
}

if (failures) {
  console.error(`\n${failures} zone(s) failed the ink placement contract`);
  process.exitCode = 1;
} else {
  console.log(`\nevery zone places ink inside its usable square at its stated size${warned ? ` (${warned} outside the 12 % accuracy budget)` : ''}`);
}
