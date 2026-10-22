import * as THREE from 'three';
import { MAX_TATTOOS } from '@/lib/schemas';
import type { ShaderTransform } from '@/lib/placement';

/**
 * Skin material with a real tattoo layer.
 *
 * Rather than floating planes or decals, ink is composited in the skin shader
 * using the mesh UV atlas, so it follows curvature, folds and rotation exactly
 * like a real tattoo and can never detach from the body.
 *
 * Per pixel:
 *  1. transform the skin UV into each tattoo's local square
 *  2. sample the ink density atlas (only if the pixel belongs to that region)
 *  3. multiply the ink into the skin albedo (ink sits *under* the skin)
 * plus a soft region highlight driven by a mask texture.
 */

export interface InkSlot {
  transform: ShaderTransform;
}

export interface SkinUniforms {
  uInkAtlas: { value: THREE.Texture | null };
  uInkCount: { value: number };
  uInkTf: { value: THREE.Vector4[] };
  uInkRot: { value: number[] };
  uInkOpacity: { value: number[] };
  uInkRegion: { value: number[] };
  uInkTile: { value: number[] };
  uInkMirror: { value: number[] };
  uRegionIds: { value: THREE.Texture | null };
  uHighlightMask: { value: THREE.Texture | null };
  uHighlightStrength: { value: number };
  uSelected: { value: number };
  uInkColor: { value: THREE.Color };
  uInkStrength: { value: number };
  uCloth: { value: THREE.Texture | null };
  uClothEnabled: { value: number };
  uTime: { value: number };
}

export interface SkinMaterialResult {
  material: THREE.MeshPhysicalMaterial;
  uniforms: SkinUniforms;
  setInk: (slots: InkSlot[]) => void;
  setHighlight: (texture: THREE.Texture | null, strength: number) => void;
  setSelected: (index: number) => void;
  setInkStrength: (value: number) => void;
  setCloth: (texture: THREE.Texture | null) => void;
  dispose: () => void;
}

export interface SkinMaterialOptions {
  /** When false the material is a plain PBR skin — ink can be re-enabled by rebuilding. */
  injectInk?: boolean;
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  regionIds?: THREE.Texture | null;
  inkAtlas?: THREE.Texture | null;
  inkColor?: string;
}

export const INK_VERT_PARS = /* glsl */ `
varying vec2 vInkUv;
`;

const INK_FRAG_PARS = /* glsl */ `
#define INK_MAX ${MAX_TATTOOS}
varying vec2 vInkUv;
uniform sampler2D uInkAtlas;
uniform sampler2D uRegionIds;
uniform sampler2D uHighlightMask;
uniform float uHighlightStrength;
uniform float uSelected;
uniform float uInkStrength;
uniform vec3 uInkColor;
uniform sampler2D uCloth;
uniform float uClothEnabled;
uniform int uInkCount;
uniform vec4 uInkTf[INK_MAX];
uniform float uInkRot[INK_MAX];
uniform float uInkOpacity[INK_MAX];
uniform float uInkRegion[INK_MAX];
uniform float uInkTile[INK_MAX];
uniform float uInkMirror[INK_MAX];

float inkDensityAt(vec2 uv, int i) {
  vec4 tf = uInkTf[i];
  vec2 p = uv - tf.xy;
  float c = cos(uInkRot[i]);
  float s = sin(uInkRot[i]);
  p = mat2(c, s, -s, c) * p;
  vec2 q = p / (2.0 * max(tf.zw, vec2(1e-5))) + 0.5;
  // a mirrored layer reflects the artwork, it does not rotate it
  if (uInkMirror[i] > 0.5) q.x = 1.0 - q.x;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  float region = texture2D(uRegionIds, uv).r * 255.0;
  if (abs(region - uInkRegion[i]) > 0.6) return 0.0;
  float tile = uInkTile[i];
  vec2 tileOrigin = vec2(mod(tile, 4.0), floor(tile / 4.0)) * 0.25;
  // The atlas is uploaded with flipY = false, so texture coords run top-down in canvas
  // space while the design's q.y runs bottom-up. Mirror q.y inside the tile.
  vec2 atlasUv = vec2(tileOrigin.x + q.x * 0.25, 1.0 - tileOrigin.y - 0.25 + q.y * 0.25);
  return texture2D(uInkAtlas, atlasUv).r;
}

float tattooDensity(vec2 uv, float selectedOnly) {
  float density = 0.0;
  for (int i = 0; i < INK_MAX; i++) {
    if (i >= uInkCount) break;
    float d = inkDensityAt(uv, i) * uInkOpacity[i];
    if (d <= 0.001) continue;
    density = max(density, d);
    if (abs(float(i) - uSelected) < 0.5 && selectedOnly > 0.5) {
      vec2 tf = uInkTf[i];
      vec2 p = uv - tf.xy;
      float c = cos(uInkRot[i]);
      float s = sin(uInkRot[i]);
      p = mat2(c, s, -s, c) * p;
      vec2 q = abs(p) / max(tf.zw, vec2(1e-5));
      float edge = max(q.x, q.y);
      float line = smoothstep(0.985, 1.0, edge) * (1.0 - smoothstep(1.0, 1.03, edge));
      density = max(density, line * 0.85);
    }
  }
  return clamp(density, 0.0, 1.0);
}
`;

/** 1×1 opaque black; keeps every sampler bound even before the real asset arrives. */
function createPlaceholderTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export function createSkinMaterial(options: SkinMaterialOptions): SkinMaterialResult {
  const placeholder = createPlaceholderTexture();
  const injectInk = options.injectInk !== false;
  const uniforms: SkinUniforms = {
    uInkAtlas: { value: options.inkAtlas ?? placeholder },
    uInkCount: { value: 0 },
    uInkTf: { value: Array.from({ length: MAX_TATTOOS }, () => new THREE.Vector4(0.5, 0.5, 0.1, 0.1)) },
    uInkRot: { value: new Array<number>(MAX_TATTOOS).fill(0) },
    uInkOpacity: { value: new Array<number>(MAX_TATTOOS).fill(0) },
    uInkRegion: { value: new Array<number>(MAX_TATTOOS).fill(0) },
    uInkTile: { value: new Array<number>(MAX_TATTOOS).fill(0) },
    uInkMirror: { value: new Array<number>(MAX_TATTOOS).fill(0) },
    uRegionIds: { value: options.regionIds ?? placeholder },
    uHighlightMask: { value: placeholder },
    uHighlightStrength: { value: 0 },
    uSelected: { value: -1 },
    uInkColor: { value: new THREE.Color(options.inkColor ?? '#101a24') },
    uInkStrength: { value: 0.92 },
    uCloth: { value: placeholder },
    uClothEnabled: { value: 0 },
    uTime: { value: 0 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    map: options.map,
    normalMap: options.normalMap ?? null,
    roughnessMap: options.roughnessMap ?? null,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    sheen: 0.28,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#8d5a45'),
    envMapIntensity: 1.05,
  });
  material.name = 'InkverseSkin';

  const state = { inkCount: 0, selected: -1 };

  if (injectInk) material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${INK_VERT_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInkUv = uv;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${INK_FRAG_PARS}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float inkHighlight = 0.0;
        if (uHighlightStrength > 0.001) {
          vec2 maskUv = vInkUv;
          inkHighlight = texture2D(uHighlightMask, maskUv).r * uHighlightStrength;
        }
        float inkDensity = 0.0;
        if (uInkCount > 0) {
          inkDensity = tattooDensity(vInkUv, 1.0) * uInkStrength;
          // ink sits in the dermis: boost mid-tone density so fine lines read solid
          inkDensity = pow(clamp(inkDensity, 0.0, 1.0), 0.62);
          vec3 inked = mix(diffuseColor.rgb, uInkColor, inkDensity * 0.95);
          inked += vec3(0.012, 0.02, 0.028) * inkDensity;
          diffuseColor.rgb = mix(diffuseColor.rgb, inked, step(0.0005, inkDensity));
        }
        float clothMask = 0.0;
        if (uClothEnabled > 0.5) {
          float cw = texture2D(uCloth, vInkUv).r;
          clothMask = smoothstep(0.30, 0.58, cw);
          if (clothMask > 0.001) {
            float weave = 0.94 + 0.06 * sin(vInkUv.x * 1450.0) * sin(vInkUv.y * 1450.0);
            vec3 fabric = vec3(0.030, 0.032, 0.035) * weave;
            fabric += vec3(0.02) * clothMask * smoothstep(0.4, 1.0, cw);
            diffuseColor.rgb = mix(diffuseColor.rgb, fabric, clothMask);
            // fabric swallows the tattoo
            inkDensity *= (1.0 - clothMask);
          }
        }
        if (inkHighlight > 0.001) {
          vec3 hi = vec3(0.70, 0.94, 0.26);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + hi * 0.45, clamp(inkHighlight * 0.5, 0.0, 0.6));
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        if (uInkCount > 0) {
          float d = tattooDensity(vInkUv, 0.0);
          roughnessFactor = mix(roughnessFactor, 0.5, d * 0.55);
        }
        roughnessFactor = mix(roughnessFactor, 0.94, clothMask);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.70, 0.94, 0.26) * inkHighlight * 0.08;
        totalEmissiveRadiance += uInkColor * inkDensity * 0.03;`,
      );
  };

  material.customProgramCacheKey = () => `inkverse-skin-v5-${options.regionIds ? 'r' : 'n'}`;

  const setInk = (slots: InkSlot[]) => {
    const count = Math.min(slots.length, MAX_TATTOOS);
    state.inkCount = count;
    uniforms.uInkCount.value = count;
    for (let i = 0; i < MAX_TATTOOS; i += 1) {
      const slot = slots[i];
      if (!slot) {
        uniforms.uInkOpacity.value[i] = 0;
        uniforms.uInkTile.value[i] = 0;
        uniforms.uInkMirror.value[i] = 0;
        continue;
      }
      const t = slot.transform;
      uniforms.uInkTf.value[i]!.set(t.center[0], t.center[1], t.half[0], t.half[1]);
      uniforms.uInkRot.value[i] = t.rotation;
      uniforms.uInkOpacity.value[i] = t.opacity;
      uniforms.uInkRegion.value[i] = t.regionIndex;
      uniforms.uInkTile.value[i] = t.tile;
      uniforms.uInkMirror.value[i] = t.mirrored ? 1 : 0;
    }
    material.needsUpdate = true;
  };

  const setHighlight = (texture: THREE.Texture | null, strength: number) => {
    uniforms.uHighlightMask.value = texture ?? placeholder;
    uniforms.uHighlightStrength.value = strength;
    material.needsUpdate = true;
  };

  const setSelected = (index: number) => {
    state.selected = index;
    uniforms.uSelected.value = index;
  };

  const setInkStrength = (value: number) => {
    uniforms.uInkStrength.value = value;
  };

  const setCloth = (texture: THREE.Texture | null) => {
    uniforms.uCloth.value = texture ?? placeholder;
    uniforms.uClothEnabled.value = texture ? 1 : 0;
    material.needsUpdate = true;
  };

  material.userData.uniforms = uniforms;
  material.userData.inkState = state;

  const dispose = () => {
    material.dispose();
    placeholder.dispose();
  };

  return { material, uniforms, setInk, setHighlight, setSelected, setInkStrength, setCloth, dispose };
}

/** Eye material: procedurally generated iris, kept deliberately simple. */
export function createEyeMaterial(texture?: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map: texture ?? null,
    color: texture ? 0xffffff : 0x1b1512,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.6,
  });
}

export function createEyeTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  // sclera
  ctx.fillStyle = '#d9d2c7';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.06, cx, cy, size * 0.48);
  grad.addColorStop(0, '#4a2f1c');
  grad.addColorStop(0.55, '#6b4526');
  grad.addColorStop(0.72, '#2a1a12');
  grad.addColorStop(1, '#171310');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // iris fibres
  ctx.strokeStyle = 'rgba(200,150,90,0.35)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 160; i += 1) {
    const a = (i / 160) * Math.PI * 2;
    const r0 = size * 0.13;
    const r1 = size * 0.32 * (0.9 + 0.1 * Math.sin(i * 3.7));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  // pupil
  ctx.fillStyle = '#070605';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // limbal ring
  ctx.strokeStyle = 'rgba(10,8,6,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  // catchlight
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.07, cy - size * 0.08, size * 0.035, size * 0.05, -0.4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
