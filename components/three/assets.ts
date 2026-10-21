'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ATLAS_SIZE, buildInkAtlas, loadInkImage, type AtlasEntry } from '@/lib/atlas';

const maskCache = new Map<string, THREE.Texture>();
const faceRegionCache = new Map<string, Promise<Int8Array>>();

/**
 * Soft region masks are used for the body-region highlight. They are loaded
 * imperatively (never suspending the canvas) and blurred once at 512².
 */
export function loadSoftMask(url: string): Promise<THREE.Texture> {
  const cached = maskCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D canvas unavailable'));
        return;
      }
      ctx.filter = 'blur(7px)';
      ctx.drawImage(img, 0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = true;
      texture.needsUpdate = true;
      maskCache.set(url, texture);
      resolve(texture);
    };
    img.onerror = () => reject(new Error(`Mask not found: ${url}`));
  });
}

export function useSoftMask(url: string | null, enabled: boolean): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(() => (url ? maskCache.get(url) ?? null : null));
  useEffect(() => {
    if (!url || !enabled) {
      setTexture(url ? maskCache.get(url) ?? null : null);
      return;
    }
    let active = true;
    loadSoftMask(url)
      .then((tex) => {
        if (active) setTexture(tex);
      })
      .catch(() => {
        if (active) setTexture(null);
      });
    return () => {
      active = false;
    };
  }, [url, enabled]);
  return texture;
}

export async function loadFaceRegions(url: string): Promise<Int8Array> {
  const cached = faceRegionCache.get(url);
  if (cached) return cached;
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load ${url}`);
      return res.arrayBuffer();
    })
    .then((buffer) => new Uint8Array(buffer))
    .then((bytes) => Int8Array.from(bytes));
  faceRegionCache.set(url, promise);
  return promise;
}

export function useFaceRegions(url: string): Int8Array | null {
  const [data, setData] = useState<Int8Array | null>(null);
  useEffect(() => {
    let active = true;
    loadFaceRegions(url)
      .then((bytes) => {
        if (active) setData(bytes);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [url]);
  return data;
}

/**
 * Keeps one CanvasTexture alive and repaints it whenever the composition
 * changes. Artwork is preloaded so the repaint itself is synchronous.
 */
export function useInkAtlas(entries: AtlasEntry[]): { texture: THREE.CanvasTexture; ready: boolean } {
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [ready, setReady] = useState(false);
  const signature = entries.map((e) => `${e.tile}:${e.url}`).join('|');
  const previous = useRef<{ canvas: HTMLCanvasElement; signature: string[] } | null>(null);

  useEffect(() => {
    let active = true;
    const urls = Array.from(new Set(entries.map((e) => e.url)));
    Promise.allSettled(urls.map((url) => loadInkImage(url)))
      .then(() => {
        if (!active) return;
        const canvas = textureRef.current ? textureRef.current.image as HTMLCanvasElement : document.createElement('canvas');
        const result = buildInkAtlas(entries, canvas, previous.current ?? undefined);
        previous.current = result;
        if (!textureRef.current) {
          const texture = new THREE.CanvasTexture(result.canvas);
          texture.colorSpace = THREE.NoColorSpace;
          texture.flipY = false;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.anisotropy = 4;
          texture.needsUpdate = true;
          textureRef.current = texture;
        } else {
          textureRef.current.needsUpdate = true;
        }
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(
    () => () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    },
    [],
  );

  const fallback = useRef<THREE.CanvasTexture | null>(null);
  if (!fallback.current) {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = false;
    fallback.current = texture;
  }

  return { texture: textureRef.current ?? fallback.current, ready };
}
