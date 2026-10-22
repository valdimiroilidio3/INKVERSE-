/**
 * Scene audit — spatial rules as executable assertions.
 *
 * The 3D studio keeps its contract in `lib/scene.ts`. This module turns that
 * contract into checks with severities, so a wrong camera, a light on the wrong
 * side of the body or a floor that ends inside the frame fails loudly instead of
 * being discovered as "the 3D looks off".
 *
 * Pure maths, no three.js, no DOM: runnable in vitest and in the browser.
 */

import {
  CAMERA_FLOOR_CLEARANCE,
  CHARACTER_FORWARD,
  CHARACTER_HEIGHT_M,
  FLOOR_RADIUS,
  KEY_LIGHT_POSITION,
  STUDIO_DISTANCE,
  STUDIO_FOV,
  STUDIO_MAX_DISTANCE,
  STUDIO_MAX_POLAR,
  STUDIO_MIN_DISTANCE,
  STUDIO_TARGET,
  STUDIO_VIEWS,
  cameraHeightAt,
  framingAt,
} from './scene';
import type { StudioView } from './types';

export type Severity = 'error' | 'warn' | 'info';

export interface AuditFinding {
  id: string;
  severity: Severity;
  /** Short imperative summary. */
  message: string;
  /** Measured values that back the finding. */
  detail?: Record<string, number | string | boolean>;
}

export interface SceneSnapshot {
  bodyHeight: number;
  /** Highest and lowest point of the body mesh in world space. */
  bodyTop: number;
  bodyBottom: number;
  fov: number;
  distance: number;
  targetY: number;
  /** Camera position for the current view. */
  camera: [number, number, number];
  view: StudioView;
  /** Direction the character's face points, normalised. */
  forward: [number, number, number];
}

const VIEW_LABELS: Record<StudioView, string> = {
  front: 'front',
  back: 'back',
  left: 'left',
  right: 'right',
};

type Vec3 = readonly [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const distance3 = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Half-height of the frustum at a given camera distance. */
export const halfHeightAt = (distance: number, fov = STUDIO_FOV) =>
  distance * Math.tan((fov * Math.PI) / 360);

/** Camera position for a studio view, derived from the contract (not hard-coded). */
export function viewCamera(view: StudioView): [number, number, number] {
  return [...STUDIO_VIEWS[view]] as [number, number, number];
}

/**
 * Everything the audit needs, derived from the contract. Passing an override lets
 * a test prove the checks catch a broken scene.
 */
export function studioSnapshot(overrides: Partial<SceneSnapshot> = {}): SceneSnapshot {
  const view = overrides.view ?? 'front';
  const camera = overrides.camera ?? viewCamera(view);
  return {
    bodyHeight: CHARACTER_HEIGHT_M,
    bodyTop: CHARACTER_HEIGHT_M,
    bodyBottom: 0,
    fov: STUDIO_FOV,
    distance: STUDIO_DISTANCE,
    targetY: STUDIO_TARGET[1],
    camera,
    view,
    forward: [...CHARACTER_FORWARD] as [number, number, number],
    ...overrides,
  };
}

function framing(findings: AuditFinding[], snap: SceneSnapshot) {
  const distance = Math.hypot(
    snap.camera[0] - STUDIO_TARGET[0],
    snap.camera[1] - snap.targetY,
    snap.camera[2] - STUDIO_TARGET[2],
  );
  const framingCheck = framingAt(distance, snap.fov, snap.targetY, snap.bodyHeight);
  findings.push({
    id: 'framing.body-fits',
    severity: framingCheck.ok ? 'info' : 'error',
    message: framingCheck.ok
      ? 'The full body fits inside the studio view with margin.'
      : `The ${VIEW_LABELS[snap.view]} view crops the body: ${framingCheck.visibleHeight.toFixed(2)} m visible for a ${snap.bodyHeight.toFixed(2)} m character.`,
    detail: {
      visibleHeight: Number(framingCheck.visibleHeight.toFixed(3)),
      required: Number(framingCheck.required.toFixed(3)),
      distance: Number(distance.toFixed(3)),
      cropTop: Number((snap.bodyTop - framingCheck.visibleTop).toFixed(3)),
      cropBottom: Number((framingCheck.visibleBottom - snap.bodyBottom).toFixed(3)),
    },
  });

  if (distance < STUDIO_MIN_DISTANCE || distance > STUDIO_MAX_DISTANCE) {
    findings.push({
      id: 'framing.distance-limits',
      severity: 'error',
      message: 'The camera distance is outside the orbit limits, so the clamp will fight the view preset.',
      detail: { distance: Number(distance.toFixed(3)), min: STUDIO_MIN_DISTANCE, max: STUDIO_MAX_DISTANCE },
    });
  }
}

function orientation(findings: AuditFinding[], snap: SceneSnapshot) {
  for (const view of Object.keys(VIEW_LABELS) as StudioView[]) {
    // Audit the live camera for the view on screen, the contract preset otherwise.
    const camera = view === snap.view ? snap.camera : viewCamera(view);
    // Vector from the body to the camera.
    const toCamera: Vec3 = [camera[0] - STUDIO_TARGET[0], camera[1] - snap.targetY, camera[2] - STUDIO_TARGET[2]];
    const facing = dot(toCamera, snap.forward) / (Math.hypot(...toCamera) || 1);

    if (view === 'front' && facing <= 0.5) {
      findings.push({
        id: 'orientation.front-camera',
        severity: 'error',
        message: 'The "front" view does not look at the character\'s face.',
        detail: { facing },
      });
    }
    if (view === 'back' && facing >= -0.5) {
      findings.push({
        id: 'orientation.back-camera',
        severity: 'error',
        message: 'The "back" view is not behind the character.',
        detail: { facing },
      });
    }
    if ((view === 'left' || view === 'right') && Math.abs(facing) > 0.15) {
      findings.push({
        id: `orientation.${view}-camera`,
        severity: 'warn',
        message: `The "${view}" preset is not a true profile view.`,
        detail: { facing },
      });
    }
  }

  if (Math.abs(dot(snap.forward, [0, 1, 0])) > 0.01) {
    findings.push({
      id: 'orientation.forward-level',
      severity: 'warn',
      message: 'The character forward vector is not horizontal.',
      detail: { forward: snap.forward.join(', ') },
    });
  }
}

function lighting(findings: AuditFinding[], snap: SceneSnapshot) {
  const camera = snap.camera;
  const toCamera: Vec3 = [camera[0], camera[1] - 1.2, camera[2]];
  const length = Math.hypot(...toCamera) || 1;
  const key: Vec3 = [KEY_LIGHT_POSITION[0], KEY_LIGHT_POSITION[1] - 1.2, KEY_LIGHT_POSITION[2]];
  const keyDot = dot(key, toCamera) / ((Math.hypot(...key) || 1) * length);

  if (keyDot <= 0.05) {
    findings.push({
      id: 'lighting.key-behind-camera-subject',
      severity: 'error',
      message: 'The key light is not on the camera side of the body, so the front view is back-lit.',
      detail: { alignment: Number(keyDot.toFixed(3)) },
    });
  } else if (keyDot > 0.95) {
    findings.push({
      id: 'lighting.key-flat',
      severity: 'warn',
      message: 'The key light is almost on the camera axis — the form will read flat.',
      detail: { alignment: Number(keyDot.toFixed(3)) },
    });
  }

  if (KEY_LIGHT_POSITION[1] <= CHARACTER_HEIGHT_M * 0.5) {
    findings.push({
      id: 'lighting.key-height',
      severity: 'warn',
      message: 'The key light is below chest height, which flattens the face.',
      detail: { y: KEY_LIGHT_POSITION[1] },
    });
  }
}

function orbit(findings: AuditFinding[], snap: SceneSnapshot) {
  for (const distance of [STUDIO_MIN_DISTANCE, STUDIO_DISTANCE, STUDIO_MAX_DISTANCE]) {
    const height = cameraHeightAt(distance, STUDIO_MAX_POLAR);
    if (height < CAMERA_FLOOR_CLEARANCE) {
      findings.push({
        id: 'orbit.below-floor',
        severity: 'error',
        message: 'The orbit allows the camera to drop below the floor plane, exposing the void under the stage.',
        detail: { distance: Number(distance.toFixed(2)), cameraY: Number(height.toFixed(3)) },
      });
      break;
    }
  }
  if (STUDIO_MAX_POLAR < Math.PI / 2) {
    findings.push({
      id: 'orbit.max-polar',
      severity: 'warn',
      message: 'The orbit stops above the horizon, so low-angle views of the feet are unreachable.',
      detail: { maxPolar: Number(STUDIO_MAX_POLAR.toFixed(3)) },
    });
  }
}

function floor(findings: AuditFinding[], snap: SceneSnapshot) {
  const camera = snap.camera;
  const distance = Math.hypot(camera[0], camera[2]);
  const half = halfHeightAt(distance, snap.fov);
  const visibleWidth = half * 2 * 1.6; // 16:9-ish framing, generous
  if (FLOOR_RADIUS * 2 < visibleWidth) {
    findings.push({
      id: 'floor.radius',
      severity: 'warn',
      message: 'The studio floor edge can enter the frame at the current distance.',
      detail: { radius: FLOOR_RADIUS, visibleWidth: Number(visibleWidth.toFixed(2)) },
    });
  }
  if (distance > STUDIO_MAX_DISTANCE + FLOOR_RADIUS) {
    findings.push({
      id: 'floor.reach',
      severity: 'warn',
      message: 'The orbit can pull the camera past the floor, exposing the void underneath.',
      detail: { distance: Number(distance.toFixed(2)) },
    });
  }
}

function target(findings: AuditFinding[], snap: SceneSnapshot) {
  const centre = (snap.bodyTop + snap.bodyBottom) / 2;
  // Framing is centred on the *eye line* rather than the geometric centre: a
  // head-heavy composition reads as deliberate, a dead-centre one does not.
  if (Math.abs(snap.targetY - centre) > snap.bodyHeight * 0.18) {
    findings.push({
      id: 'target.height',
      severity: 'warn',
      message: 'The orbit target is far from the body centre; rotation will feel eccentric.',
      detail: { target: snap.targetY, centre: Number(centre.toFixed(2)) },
    });
  }
}

function body(findings: AuditFinding[], snap: SceneSnapshot) {
  if (snap.bodyTop - snap.bodyBottom < 1.4 || snap.bodyTop - snap.bodyBottom > 2.2) {
    findings.push({
      id: 'body.unit-scale',
      severity: 'error',
      message: 'The body mesh is not at human scale in metres — lights and framing are tuned for 1.86 m.',
      detail: { height: snap.bodyTop - snap.bodyBottom },
    });
  }
  if (Math.abs(snap.bodyBottom) > 0.02) {
    findings.push({
      id: 'body.ground-contact',
      severity: 'warn',
      message: 'The feet do not rest on the floor plane, so the contact shadow will float.',
      detail: { soles: snap.bodyBottom },
    });
  }
}

/** Run every studio check. Deterministic and side-effect free. */
export function auditStudioScene(overrides: Partial<SceneSnapshot> = {}): AuditFinding[] {
  const snap = studioSnapshot(overrides);
  const findings: AuditFinding[] = [];
  body(findings, snap);
  framing(findings, snap);
  orientation(findings, snap);
  lighting(findings, snap);
  floor(findings, snap);
  orbit(findings, snap);
  target(findings, snap);
  return findings;
}

/** Views whose presets are at the same distance from the subject. */
export function viewDistances(): Record<StudioView, number> {
  return (Object.keys(STUDIO_VIEWS) as StudioView[]).reduce(
    (acc, view) => {
      acc[view] = Number(distance3(STUDIO_VIEWS[view], STUDIO_TARGET).toFixed(3));
      return acc;
    },
    {} as Record<StudioView, number>,
  );
}

export function summarise(findings: AuditFinding[]) {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warn');
  return {
    errors: errors.length,
    warnings: warnings.length,
    infos: findings.length - errors.length - warnings.length,
    ok: errors.length === 0,
    worst: errors.map((f) => f.message),
  };
}

/**
 * WebGL stalls when too many fragments sample high-resolution textures. The studio
 * budget keeps a single 2K skin map, 1K ink atlas and 1K paged region masks.
 */
export function auditTextureBudget(textures: { name: string; width: number; height: number; count?: number }[]) {
  const findings: AuditFinding[] = [];
  let vram = 0;
  for (const texture of textures) {
    const count = texture.count ?? 1;
    const bytes = texture.width * texture.height * 4 * 1.34 * count; // + mipmaps
    vram += bytes;
    if (Math.max(texture.width, texture.height) > 2048) {
      findings.push({
        id: `texture.${texture.name}.size`,
        severity: 'warn',
        message: `${texture.name} exceeds 2048 px on its long edge.`,
        detail: { width: texture.width, height: texture.height },
      });
    }
  }
  const megabytes = vram / 1024 / 1024;
  findings.push({
    id: 'texture.total',
    severity: megabytes > 96 ? 'warn' : 'info',
    message: megabytes > 96 ? 'Decoded texture memory is high for a mobile GPU.' : 'Texture memory is within budget.',
    detail: { megabytes: Number(megabytes.toFixed(1)) },
  });
  return findings;
}
