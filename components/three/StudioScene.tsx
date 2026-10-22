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
import {
  FLOOR_RADIUS,
  KEY_LIGHT_POSITION,
  STUDIO_FOV,
  STUDIO_MAX_DISTANCE,
  STUDIO_MAX_POLAR,
  STUDIO_MIN_DISTANCE,
  STUDIO_MIN_POLAR,
  STUDIO_TARGET,
  STUDIO_VIEWS,
} from '@/lib/scene';

type Controls = ComponentRef<typeof OrbitControls>;

const TARGET = new THREE.Vector3(...STUDIO_TARGET);
const VIEWS = STUDIO_VIEWS as Record<StudioView, readonly [number, number, number]>;
const FRONT = Math.sign(STUDIO_VIEWS.front[2]) || 1;

export interface SceneApi {
  zoom: (factor: number) => void;
  reset: () => void;
}

function CameraRig({ view, controls }: { view: StudioView; controls: Controls | null }) {
  const camera = useThree((state) => state.camera);
  const goal = useRef(new THREE.Vector3(...VIEWS.front));
  const animating = useRef(true);

  useEffect(() => {
    goal.current.set(VIEWS[view][0], VIEWS[view][1], VIEWS[view][2]);
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
  /** Fired when the ink shader fails to compile and the plain skin material is used. */
  onDegraded?: () => void;
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
  onDegraded,
}: StudioSceneProps) {
  const character = getCharacter(characterId);
  const [controls, setControls] = useState<Controls | null>(null);
  const [inkShaderBroken, setInkShaderBroken] = useState(false);
  // Track *which* body is on stage rather than a boolean: a cached GLB resolves
  // synchronously, so a "reset on character change" effect would race its load.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const modelReady = readyFor === characterId;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The loading overlay and the contact-shadow bake both need the body to exist,
  // not merely the WebGL context.
  useEffect(() => {
    if (modelReady && canvasRef.current) onReady?.(canvasRef.current);
  }, [modelReady, onReady]);
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
        // Clamp instead of bailing out: a no-op button reads as a broken button.
        const distance = THREE.MathUtils.clamp(
          offset.length() * factor,
          STUDIO_MIN_DISTANCE,
          STUDIO_MAX_DISTANCE,
        );
        if (Math.abs(distance - offset.length()) < 1e-4) return;
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
      },
      reset: () => {
        if (!controls) return;
        controls.object.position.set(VIEWS.front[0], VIEWS.front[1], VIEWS.front[2]);
        controls.target.copy(TARGET);
        controls.update();
      },
    });
  }, [onApi, controls]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.9]}
      camera={{ position: VIEWS.front as unknown as [number, number, number], fov: STUDIO_FOV, near: 0.1, far: 60 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        canvasRef.current = gl.domElement;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.fog = null;
        gl.domElement.addEventListener('webglcontextlost', () => onError?.(), { once: true });

        // A shader that fails to link would leave the body black with no explanation.
        // Detect a failure originating in our injection and fall back to plain skin.
        gl.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
          const source = context.getShaderSource(fragmentShader) ?? '';
          const log =
            context.getShaderInfoLog(fragmentShader) || context.getProgramInfoLog(program) || 'unknown shader error';
          console.error('[inkverse] shader compile failed:', log.slice(0, 600));
          if (source.includes('inkDensityAt') || source.includes('uInkMirror')) {
            setInkShaderBroken(true);
            onDegraded?.();
          }
        };

      }}
      className="touch-none"
    >
      <ambientLight intensity={0.22} />
      <directionalLight
        position={KEY_LIGHT_POSITION as unknown as [number, number, number]}
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
      {/* rim lights sit behind the body (−Z) so they separate it from the backdrop */}
      <spotLight position={[2.6 * FRONT, 3.4, -2.2 * FRONT]} intensity={26} angle={0.8} penumbra={1} color="#9fc0ff" distance={12} />
      <spotLight position={[-0.4 * FRONT, 1.9, 2.4 * FRONT]} intensity={9} angle={1} penumbra={1} color="#ffe9d2" distance={9} />
      <pointLight position={[0, 1.4, -2.0 * FRONT]} intensity={3} color="#d6ff52" distance={5} />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0a0a0a']} />
        <Lightformer form="rect" intensity={3} position={[0, 2.4, 2.6 * FRONT]} scale={[4, 3, 1]} target={[0, 1.2, 0]} color="#fff3e6" />
        <Lightformer form="rect" intensity={1.6} position={[-3 * FRONT, 1.6, -1.2 * FRONT]} scale={[3, 4, 1]} rotation-y={(Math.PI / 2) * -FRONT} color="#93b4ff" />
        <Lightformer form="rect" intensity={1.1} position={[3 * FRONT, 1.4, 0.4 * FRONT]} scale={[2.5, 3, 1]} rotation-y={(-Math.PI / 2) * -FRONT} color="#ffd9b8" />
        <Lightformer form="circle" intensity={0.9} position={[0, -1.2, 0]} scale={4} rotation-x={Math.PI / 2} color="#141414" />
      </Environment>

      <group position={[0, 0, 0]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
          <circleGeometry args={[FLOOR_RADIUS, 96]} />
          <meshStandardMaterial color="#0a0a0b" roughness={0.92} metalness={0.08} />
        </mesh>
        {modelReady ? (
          // Baked once, but only after the mesh exists: a frame-1 bake on an empty
          // scene leaves the character floating with no ground contact.
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
        ) : null}
        <Suspense fallback={null}>
          <CharacterModel
            character={character}
            tattoos={tattoos}
            highlightRegion={spotlight ? regionId : null}
            highlightStrength={spotlight ? 0.6 : 0}
            selectedTattooId={selectedTattooId}
            showInk={!compare}
            injectInk={!inkShaderBroken}
            onPickRegion={onPickRegion}
            faceRegions={faceRegions}
            onLoaded={() => setReadyFor(characterId)}
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
        minDistance={STUDIO_MIN_DISTANCE}
        maxDistance={STUDIO_MAX_DISTANCE}
        minPolarAngle={STUDIO_MIN_POLAR}
        maxPolarAngle={STUDIO_MAX_POLAR}
      />
      <CameraRig view={view} controls={controls} />
    </Canvas>
  );
}

export const STUDIO_CHARACTERS = CHARACTERS;
