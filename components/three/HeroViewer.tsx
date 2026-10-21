'use client';

import { Component, Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel';
import { getCharacter } from '@/lib/characters';
import type { AppliedTattoo } from '@/lib/types';

class HeroBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SlowOrbit({ enabled }: { enabled: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    if (enabled) group.rotation.y += delta * 0.14;
    group.rotation.x += (pointer.current.y * 0.035 - group.rotation.x) * Math.min(1, delta * 1.6);
    group.rotation.z += (-pointer.current.x * 0.03 - group.rotation.z) * Math.min(1, delta * 1.6);
  });

  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <HeroCharacter enabled={enabled} />
      </Suspense>
    </group>
  );
}

function HeroCharacter({ enabled }: { enabled: boolean }) {
  const character = getCharacter('male');
  const tattoos: AppliedTattoo[] = HERO_TATTOOS;
  return (
    <CharacterModel
      character={character}
      tattoos={tattoos}
      highlightRegion={null}
      highlightStrength={0}
      showInk
    />
  );
}

export const HERO_TATTOOS: AppliedTattoo[] = [
  {
    id: 'hero-moth',
    designId: 'lunar-moth',
    characterId: 'male',
    bodyRegion: 'chest',
    offset: [0, 0.1],
    rotation: 0,
    scale: 1,
    opacity: 0.95,
    mirrored: false,
  },
  {
    id: 'hero-rose',
    designId: 'rose-noir',
    characterId: 'male',
    bodyRegion: 'forearm-l',
    offset: [0, 0.12],
    rotation: 6,
    scale: 1,
    opacity: 0.92,
    mirrored: false,
  },
  {
    id: 'hero-knot',
    designId: 'norse-knot',
    characterId: 'male',
    bodyRegion: 'shoulder-r',
    offset: [0, 0],
    rotation: 0,
    scale: 1,
    opacity: 0.9,
    mirrored: false,
  },
];

export function HeroViewer({ poster }: { poster: string }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return (
    <div className="absolute inset-0">
      <HeroBoundary
        fallback={
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${poster})` }}
            role="img"
            aria-label="3D character with tattoo work (static preview)"
          />
        }
      >
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [0.35, 1.16, 3.1], fov: 32 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <ambientLight intensity={0.2} />
          <directionalLight position={[2.6, 4.2, 3.4]} intensity={2.4} color="#fff1e0" castShadow />
          <spotLight position={[-2.4, 2.6, -1.8]} intensity={26} angle={0.8} penumbra={1} color="#a8c4ff" />
          <pointLight position={[0, 1.2, -2.2]} intensity={3} color="#d6ff52" />
          <Environment resolution={192} frames={1}>
            <color attach="background" args={['#0a0a0a']} />
            <Lightformer form="rect" intensity={3.2} position={[0, 2.2, 2.4]} scale={[3.5, 2.6, 1]} target={[0, 1.2, 0]} color="#fff2e4" />
            <Lightformer form="rect" intensity={1.5} position={[-2.8, 1.4, -1]} scale={[2.6, 3.4, 1]} rotation-y={Math.PI / 2} color="#8fb2ff" />
            <Lightformer form="rect" intensity={1.0} position={[2.8, 1.2, 0.2]} scale={[2.2, 2.8, 1]} rotation-y={-Math.PI / 2} color="#ffd9b8" />
          </Environment>
          <group position={[0, -0.02, 0]}>
            <SlowOrbit enabled={!reduced} />
            <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={3.2} blur={2.6} far={1.6} resolution={256} frames={1} color="#000" />
          </group>
        </Canvas>
      </HeroBoundary>
    </div>
  );
}
