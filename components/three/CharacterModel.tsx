'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { createEyeMaterial, createEyeTexture, createSkinMaterial, type InkSlot, type SkinMaterialResult } from './skin-material';
import { useSoftMask, useInkAtlas } from './assets';
import { regionMaskUrl } from '@/lib/regions';
import { CHARACTERS } from '@/lib/characters';
import { getDesign } from '@/lib/tattoos';
import { getRegions, primarySlot } from '@/lib/regions';
import { shaderTransform } from '@/lib/placement';
import type { AppliedTattoo, CharacterModel as CharacterModelType } from '@/lib/types';

interface CharacterModelProps {
  character: CharacterModelType;
  tattoos: AppliedTattoo[];
  highlightRegion: string | null;
  highlightStrength?: number;
  selectedTattooId?: string | null;
  showInk?: boolean;
  /** false = plain PBR skin, used when the ink shader cannot compile on this GPU */
  injectInk?: boolean;
  onPickRegion?: (regionId: string) => void;
  faceRegions?: Int8Array | null;
  inkColor?: string;
  /** Fires once the GLB is mounted and the body geometry exists. */
  onLoaded?: () => void;
}

export function CharacterModel({
  character,
  tattoos,
  highlightRegion,
  highlightStrength = 0.65,
  selectedTattooId = null,
  showInk = true,
  injectInk = true,
  onPickRegion,
  faceRegions,
  inkColor,
  onLoaded,
}: CharacterModelProps) {
  const gltf = useGLTF(character.modelUrl);
  const [skinMapRaw, normalMapRaw, roughnessMapRaw, regionIdsRaw, clothMapRaw] = useTexture([
    `/textures/skin-${character.id}.webp`,
    '/textures/skin-normal.webp',
    '/textures/skin-roughness.webp',
    character.regionIdsUrl,
    `/textures/cloth-${character.id}.webp`,
  ]);

  const skinMap = skinMapRaw as THREE.Texture;
  const normalMap = normalMapRaw as THREE.Texture;
  const roughnessMap = roughnessMapRaw as THREE.Texture;
  const regionIds = regionIdsRaw as THREE.Texture;
  const clothMap = clothMapRaw as THREE.Texture;

  const bodyGeometry = useMemo(() => {
    const node = gltf.nodes.Body as THREE.Mesh | undefined;
    if (!node?.geometry) throw new Error('Character model is missing its body mesh');
    const geometry = node.geometry as THREE.BufferGeometry;
    // The ink shader reads its own UV set through a dedicated `inkUv` attribute.
    // Using TEXCOORD_1 directly would make three emit an unused `uv1` varying for
    // the PBR maps; a named attribute keeps the ink path explicit. Old GLBs without
    // TEXCOORD_1 fall back to the skin UV so the stage never renders garbage.
    const ink = geometry.getAttribute('uv1') ?? geometry.getAttribute('uv');
    if (ink) geometry.setAttribute('inkUv', ink);
    return geometry;
  }, [gltf]);

  const eyeGeometry = useMemo(() => {
    const node = gltf.nodes.Eyes as THREE.Mesh | undefined;
    return (node?.geometry as THREE.BufferGeometry | undefined) ?? null;
  }, [gltf]);

  const regions = useMemo(() => getRegions(character.id), [character.id]);

  // useGLTF suspends until the file is parsed, so this effect runs exactly when the
  // body is available to render.
  useEffect(() => {
    onLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  const atlasEntries = useMemo(() => {
    if (!showInk) return [];
    return tattoos
      .map((tattoo, index) => {
        const design = getDesign(tattoo.designId);
        if (!design) return null;
        return { url: design.inkUrl, tile: index, mirrored: tattoo.mirrored };
      })
      .filter((entry): entry is { url: string; tile: number; mirrored: boolean } => entry !== null);
  }, [tattoos, showInk]);

  const { texture: inkAtlas, ready: atlasReady } = useInkAtlas(atlasEntries);

  const highlightUrl = highlightRegion ? regionMaskUrl(highlightRegion, character.id) : null;
  const highlightMask = useSoftMask(highlightUrl, Boolean(highlightRegion));

  const materialRef = useRef<SkinMaterialResult | null>(null);

  // Configure textures once per character.
  useEffect(() => {
    skinMap.colorSpace = THREE.SRGBColorSpace;
    skinMap.anisotropy = 8;
    skinMap.flipY = true;
    skinMap.needsUpdate = true;

    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(5, 5);
    normalMap.anisotropy = 4;
    normalMap.flipY = true;
    normalMap.needsUpdate = true;

    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(7, 7);
    roughnessMap.flipY = true;
    roughnessMap.needsUpdate = true;

    regionIds.colorSpace = THREE.NoColorSpace;
    regionIds.flipY = true;
    regionIds.minFilter = THREE.NearestFilter;
    regionIds.magFilter = THREE.NearestFilter;
    regionIds.generateMipmaps = false;
    regionIds.needsUpdate = true;

    clothMap.colorSpace = THREE.NoColorSpace;
    clothMap.flipY = true;
    clothMap.minFilter = THREE.LinearFilter;
    clothMap.generateMipmaps = false;
    clothMap.needsUpdate = true;
  }, [skinMap, normalMap, roughnessMap, regionIds, clothMap, character.id]);

  const material = useMemo(() => {
    // Replacing the material (character swap or ink-shader fallback) must release
    // the previous program and its placeholder textures.
    materialRef.current?.dispose();
    const result = createSkinMaterial({
      map: skinMap,
      normalMap,
      roughnessMap,
      regionIds,
      inkAtlas,
      inkColor,
      injectInk,
    });
    materialRef.current = result;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id, injectInk]);

  useEffect(() => {
    const result = materialRef.current;
    if (!result) return;
    result.uniforms.uInkAtlas.value = inkAtlas;
    result.material.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inkAtlas, atlasReady, material]);

  useEffect(() => {
    materialRef.current?.setCloth(clothMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clothMap, material]);

  // push placement transforms
  useEffect(() => {
    const result = materialRef.current;
    if (!result) return;
    const slots: InkSlot[] = [];
    if (showInk) {
      tattoos.forEach((tattoo) => {
        const design = getDesign(tattoo.designId);
        const region = regions.find((r) => r.id === tattoo.bodyRegion);
        const slot = primarySlot(region);
        if (!design || !region || !slot) return;
        const tile = slots.length;
        slots.push({
          transform: shaderTransform(
            tattoo,
            slot,
            design.defaultSize,
            region.index,
            tile,
          ),
        });
      });
    }
    result.setInk(slots);
    const selectedIndex = selectedTattooId ? tattoos.findIndex((t) => t.id === selectedTattooId) : -1;
    result.setSelected(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tattoos, regions, showInk, selectedTattooId, atlasReady, material]);

  // highlight
  useEffect(() => {
    const result = materialRef.current;
    if (!result) return;
    result.setHighlight(highlightMask, highlightMask ? highlightStrength : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightMask, highlightStrength, material]);

  useEffect(
    () => () => {
      materialRef.current?.dispose();
    },
    [],
  );

  const eyeTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return createEyeTexture();
  }, []);

  const eyeMaterial = useMemo(() => createEyeMaterial(eyeTexture), [eyeTexture]);

  useEffect(
    () => () => {
      eyeMaterial.dispose();
      eyeTexture?.dispose();
    },
    [eyeMaterial, eyeTexture],
  );

  // A drag to orbit must not be read as a region pick. R3F synthesises click on
  // pointerup, so track where the press started and require a near-stationary release.
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    pressOrigin.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointer = (event: ThreeEvent<MouseEvent>) => {
    if (!onPickRegion || !faceRegions) return;
    const origin = pressOrigin.current;
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) return;
    const faceIndex = event.faceIndex;
    if (faceIndex === undefined || faceIndex === null || faceIndex < 0 || faceIndex >= faceRegions.length) return;
    const regionIndex = faceRegions[faceIndex] ?? 0;
    // 0 is deliberately un-inkable (the groin band); every other id is 1–17.
    const region = regions.find((r) => r.index === regionIndex);
    if (!region) return;
    event.stopPropagation();
    onPickRegion(region.id);
  };

  // Never leave the page wearing a crosshair if the stage unmounts mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  return (
    <group name={`character-${character.id}`}>
      <mesh
        geometry={bodyGeometry}
        material={material.material}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onClick={handlePointer}
        onPointerOver={(event) => {
          if (!onPickRegion) return;
          event.stopPropagation();
          document.body.style.cursor = 'crosshair';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      />
      {eyeGeometry && <mesh geometry={eyeGeometry} material={eyeMaterial} />}
    </group>
  );
}

// Warm the cache for both characters and the shared skin maps so switching bodies
// does not drop the stage to an empty frame.
// Preload through the catalogue so the warm-up hits the *versioned* URL: an unversioned
// preload would download the file twice and warm the wrong cache entry.
for (const character of CHARACTERS) useGLTF.preload(character.modelUrl);
useTexture.preload('/textures/skin-normal.webp');
useTexture.preload('/textures/skin-roughness.webp');
