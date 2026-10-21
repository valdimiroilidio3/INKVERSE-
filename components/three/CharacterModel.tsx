'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { createEyeMaterial, createEyeTexture, createSkinMaterial, type InkSlot, type SkinMaterialResult } from './skin-material';
import { useSoftMask, useInkAtlas } from './assets';
import { regionMaskUrl } from '@/lib/regions';
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
  onPickRegion?: (regionId: string) => void;
  faceRegions?: Int8Array | null;
  inkColor?: string;
}

export function CharacterModel({
  character,
  tattoos,
  highlightRegion,
  highlightStrength = 0.65,
  selectedTattooId = null,
  showInk = true,
  onPickRegion,
  faceRegions,
  inkColor,
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
    return node.geometry as THREE.BufferGeometry;
  }, [gltf]);

  const eyeGeometry = useMemo(() => {
    const node = gltf.nodes.Eyes as THREE.Mesh | undefined;
    return (node?.geometry as THREE.BufferGeometry | undefined) ?? null;
  }, [gltf]);

  const regions = useMemo(() => getRegions(character.id), [character.id]);

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
    const result = createSkinMaterial({
      map: skinMap,
      normalMap,
      roughnessMap,
      regionIds,
      inkAtlas,
      inkColor,
    });
    materialRef.current = result;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  useEffect(() => {
    const result = materialRef.current;
    if (!result) return;
    result.uniforms.uInkAtlas.value = inkAtlas;
    result.material.needsUpdate = true;
  }, [inkAtlas, atlasReady]);

  useEffect(() => {
    materialRef.current?.setCloth(clothMap);
  }, [clothMap]);

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
  }, [tattoos, regions, showInk, selectedTattooId, atlasReady]);

  // highlight
  useEffect(() => {
    const result = materialRef.current;
    if (!result) return;
    result.setHighlight(highlightMask, highlightMask ? highlightStrength : 0);
  }, [highlightMask, highlightStrength]);

  useEffect(() => {
    const result = materialRef.current;
    return () => {
      result?.material.dispose();
    };
  }, []);

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

  const handlePointer = (event: { stopPropagation: () => void; faceIndex?: number }) => {
    if (!onPickRegion || !faceRegions) return;
    const faceIndex = event.faceIndex;
    if (faceIndex === undefined || faceIndex < 0 || faceIndex >= faceRegions.length) return;
    const regionIndex = faceRegions[faceIndex] ?? 0;
    const region = regions.find((r) => r.index === regionIndex);
    if (!region) return;
    event.stopPropagation();
    onPickRegion(region.id);
  };

  return (
    <group name={`character-${character.id}`}>
      <mesh
        geometry={bodyGeometry}
        material={material.material}
        castShadow
        receiveShadow
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

useGLTF.preload('/models/inkverse-male.glb');
