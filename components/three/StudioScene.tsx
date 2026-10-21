'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ComponentRef } from 'react';
import { CharacterModel } from './CharacterModel';
import { useFaceRegions } from './assets';
import { CHARACTERS, getCharacter } from '@/lib/characters';
import type { AppliedTattoo, CharacterModel as CharacterModelType, StudioView } from '@/lib/types';

type Controls = ComponentRef<typeof OrbitControls>;

const TARGET = new THREE.Vector3(0, 1.04, 0);
const VIEWS: Record<StudioView, [number, number, number]> = {
  front: [0, 1.14, 3.05],
  back: [0, 1.14, -3.05],
  left: [3.05, 1.14, 0],
  right: [-3.05, 1.14, 0],
};

export interface SceneApi {
  zoom: (factor: number) => void;
  reset: () => void;
}

function CameraRig({ view, controls }: { view: StudioView; controls: Controls | null }) {
  const camera = useThree((state) => state.camera);
  const goal = useRef(new THREE.Vector3(...VIEWS.front));
  const animating = useRef(true);

  useEffect(() => {
    goal.current.set(...VIEWS[view]);
    animating.current = true;
  }, [view]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      animating.current = false;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    const step = 1 - Math.pow(0.0015, Math.min(delta, 0.05));
    camera.position.lerp(goal.current, step);
    if (controls) {
      controls.target.lerp(TARGET, Math.min(1, step * 1.4));
      controls.update();
    }
    if (camera.position.distanceTo(goal.current) < 0.004) animating.current = false;
  });

  return null;
}

interface StudioSceneProps {
  characterId: CharacterModelType['id'];
  tattoos: AppliedTattoo[];
  regionId: string;
  selectedTattooId: string | null;
  compare: boolean;
  view: StudioView;
  spotlight: boolean;
  onPickRegion: (regionId: string) => void;
  onApi?: (api: SceneApi) => void;
  onReady?: (canvas: HTMLCanvasElement) => void;
  onError?: () => void;
}

export function StudioScene({
  characterId,
  tattoos,
  regionId,
  selectedTattooId,
  compare,
  view,
  spotlight,
  onPickRegion,
  onApi,
  onReady,
  onError,
}: StudioSceneProps) {
  const character = getCharacter(characterId);
  const [controls, setControls] = useState<Controls | null>(null);
  const faceRegions = useFaceRegions(character.faceRegionsUrl);
  const handleControls = useCallback((node: Controls | null) => {
    setControls(node);
  }, []);

  useEffect(() => {
    if (!onApi) return;
    onApi({
      zoom: (factor: number) => {
        if (!controls) return;
        const camera = controls.object;
        const offset = camera.position.clone().sub(controls.target);
        const next = offset.multiplyScalar(factor);
        const distance = next.length();
        if (distance < 1.1 || distance > 4.6) return;
        camera.position.copy(controls.target).add(next);
        controls.update();
      },
      reset: () => {
        if (!controls) return;
        controls.object.position.set(...VIEWS.front);
        controls.target.copy(TARGET);
        controls.update();
      },
    });
  }, [onApi, controls]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.9]}
      camera={{ position: VIEWS.front, fov: 30, near: 0.1, far: 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.fog = null;
        onReady?.(gl.domElement);
        gl.domElement.addEventListener('webglcontextlost', () => onError?.(), { once: true });
      }}
      className="touch-none"
    >
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[2.8, 4.2, 3.2]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        color="#fff4e8"
      />
      <spotLight position={[-2.6, 3.4, -2.2]} intensity={38} angle={0.7} penumbra={0.9} color="#9fc0ff" distance={10} />
      <spotLight position={[0.4, 1.9, 3.4]} intensity={12} angle={1} penumbra={1} color="#ffe9d2" distance={8} />
      <pointLight position={[0, 1.4, -2.4]} intensity={4} color="#d6ff52" distance={5} />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0a0a0a']} />
        <Lightformer form="rect" intensity={3} position={[0, 2.4, 2.6]} scale={[4, 3, 1]} target={[0, 1.2, 0]} color="#fff3e6" />
        <Lightformer form="rect" intensity={1.6} position={[-3, 1.6, -1.2]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} color="#93b4ff" />
        <Lightformer form="rect" intensity={1.1} position={[3, 1.4, 0.4]} scale={[2.5, 3, 1]} rotation-y={-Math.PI / 2} color="#ffd9b8" />
        <Lightformer form="circle" intensity={0.9} position={[0, -1.2, 0]} scale={4} rotation-x={Math.PI / 2} color="#141414" />
      </Environment>

      <group position={[0, 0, 0]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
          <circleGeometry args={[2.7, 72]} />
          <meshStandardMaterial color="#0a0a0b" roughness={0.92} metalness={0.08} />
        </mesh>
        <ContactShadows
          key={character.id}
          position={[0, 0.001, 0]}
          opacity={0.62}
          scale={3.6}
          blur={2.8}
          far={2.1}
          resolution={512}
          frames={1}
          color="#000000"
        />
        <Suspense fallback={null}>
          <CharacterModel
            character={character}
            tattoos={tattoos}
            highlightRegion={spotlight ? regionId : null}
            highlightStrength={spotlight ? 0.6 : 0}
            selectedTattooId={selectedTattooId}
            showInk={!compare}
            onPickRegion={onPickRegion}
            faceRegions={faceRegions}
          />
        </Suspense>
      </group>

      <OrbitControls
        ref={handleControls}
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.65}
        zoomSpeed={0.7}
        minDistance={1.1}
        maxDistance={4.6}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.5}
      />
      <CameraRig view={view} controls={controls} />
    </Canvas>
  );
}

export const STUDIO_CHARACTERS = CHARACTERS;
