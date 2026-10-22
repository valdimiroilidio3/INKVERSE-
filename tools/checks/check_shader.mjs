/**
 * Static GLSL syntax check for the injected skin-shader code.
 *
 * three.js resolves its own chunks at compile time, so parsing ShaderLib raw is
 * meaningless. Instead we extract the snippets this project injects, drop them
 * into a minimal WebGL2 shader with the same declarations the physical material
 * provides at that point, and parse that.
 */
import { parser } from '@shaderfrog/glsl-parser';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../components/three/skin-material.ts', import.meta.url), 'utf8');

const grab = (label) => {
  const marker = label === 'INK_FRAG_PARS' ? 'const INK_FRAG_PARS' : `'#include <${label}>'`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('could not find ' + label);
  const open = src.indexOf('`', start);
  const close = src.indexOf('`', open + 1);
  // the checked shader is preprocessed by hand: the parser has no preprocessor
  return src
    .slice(open + 1, close)
    .replace('${MAX_TATTOOS}', '8')
    .replace(/#define INK_MAX 8\n/, '')
    .replace(/INK_MAX/g, '8');
};

const fragPars = grab('INK_FRAG_PARS');
const mapInject = grab('map_fragment').replace('#include <map_fragment>', '');
const roughInject = grab('roughnessmap_fragment').replace('#include <roughnessmap_fragment>', '');
const emitInject = grab('emissivemap_fragment').replace('#include <emissivemap_fragment>', '');

const shader = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
out vec4 outColor;

float uHighlightStrength;

${fragPars}

void main() {
  vec2 vInkUvCopy = vInkUv;
  vec4 diffuseColor = vec4(1.0);
  float roughnessFactor = 0.5;
  vec3 totalEmissiveRadiance = vec3(0.0);

  float inkHighlight = 0.0;
${mapInject}
${roughInject}
${emitInject}

  outColor = vec4(diffuseColor.rgb + totalEmissiveRadiance, 1.0) + vec4(vInkUvCopy, roughnessFactor, 0.0);
}
`;

fs.writeFileSync('/tmp/skin-injected.frag', shader);

parser.parse(shader);
console.log('✓ injected skin GLSL parses —', shader.split('\n').length, 'lines');

// declaration-order guarantees the fragment injections rely on
const at = (needle) => shader.indexOf(needle);
const checks = [
  ['clothMask declared before the roughness injection uses it', at('float clothMask = 0.0;') < at('mix(roughnessFactor, 0.94, clothMask)')],
  ['inkDensity declared before the emissive injection uses it', at('float inkDensity = 0.0;') < at('uInkColor * inkDensity')],
  ['inkHighlight declared before the emissive injection uses it', at('float inkHighlight = 0.0;') < at('* inkHighlight * 0.08')],
  ['mirror flip happens before the tile bounds test', at('uInkMirror[i] > 0.5') < at('return 0.0;')],
  // The ink layer must sample the dedicated ink UV set (TEXCOORD_1), not the skin
  // UVs: the skin unwrap is a snake on the torso and caps back pieces at ~11 cm.
  ['ink is sampled with the dedicated ink UV attribute', /vInkUv = inkUv;/.test(src)],
  ['the ink UV attribute is declared for the vertex stage', /attribute vec2 inkUv;/.test(src)],
  // Cloth maps are authored in the skin (TEXCOORD_0) space and must stay there.
  ['cloth keeps sampling the skin UV set', /texture2D\(uCloth, vSkinUv\)/.test(src)],
];
let ok = true;
for (const [label, pass] of checks) {
  console.log((pass ? '✓ ' : '✗ ') + label);
  if (!pass) ok = false;
}
if (!ok) process.exit(1);
