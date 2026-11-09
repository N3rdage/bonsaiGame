/**
 * Orbit camera for the 3D tree viewer, as plain data. Pure: no three.js import,
 * every function returns a fresh camera.
 *
 * Ported from archive/gamemaker/objects/obj_viewer_3d (Create_0 for defaults,
 * Step_0 for drag/zoom/reset, Draw_72 for the eye position and projection).
 * Angles are in degrees; the world is z-up.
 */

import type { Vec3 } from '../sim/types';
import { DISPLAY_SCALE } from '../sim/geometry';
import { clamp, dcos, dsin } from '../sim/vec3';

export interface OrbitCamera {
  yaw: number;
  pitch: number;
  distance: number;
  target: Vec3;
}

export const DEFAULT_YAW = 45;
export const DEFAULT_PITCH = 10;
export const DEFAULT_DISTANCE = 2.5;
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 6.0;
export const DRAG_DEGREES_PER_PIXEL = 0.4;
export const WHEEL_ZOOM_STEP = 0.08;
export const PITCH_LIMIT = 80;
/**
 * Change in finger distance, in CSS px, worth one wheel notch. At 20 px a
 * comfortable thumb-and-finger spread on a phone (about 200 px) moves as far
 * as ten notches, so the zoom tracks the fingers without twitching, and the
 * whole range (65 notches) still takes only a few pinches.
 */
export const PINCH_PX_PER_NOTCH = 20;

/** Camera pose restored by the reset button and the `R` key. */
export const RESET_YAW = 45;
export const RESET_PITCH = 20;
export const RESET_DISTANCE = 0.8;

export const FOV_DEGREES = 60;
export const NEAR = 0.01;
export const FAR = 20;

export function createOrbitCamera(): OrbitCamera {
  return {
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    distance: DEFAULT_DISTANCE,
    target: { x: 0, y: 0, z: 0.5 },
  };
}

/** Drag rotation: pixels moved since the last pointer event. */
export function rotateCamera(cam: OrbitCamera, dxPixels: number, dyPixels: number): OrbitCamera {
  return {
    ...cam,
    yaw: cam.yaw - dxPixels * DRAG_DEGREES_PER_PIXEL,
    pitch: clamp(cam.pitch - dyPixels * DRAG_DEGREES_PER_PIXEL, -PITCH_LIMIT, PITCH_LIMIT),
  };
}

/** Wheel zoom: positive notches (wheel down) move the camera away. */
export function zoomCamera(cam: OrbitCamera, wheelNotches: number): OrbitCamera {
  return {
    ...cam,
    distance: clamp(cam.distance + wheelNotches * WHEEL_ZOOM_STEP, ZOOM_MIN, ZOOM_MAX),
  };
}

/**
 * Pinch zoom: the camera as it was when the pinch began, moved by the change in
 * finger distance since. Fingers apart (`nowDistancePx` above
 * `startDistancePx`) bring it closer. Continuous, so the zoom follows the
 * fingers; a non-positive start distance leaves the camera unchanged.
 */
export function pinchZoom(
  camAtPinchStart: OrbitCamera,
  startDistancePx: number,
  nowDistancePx: number,
): OrbitCamera {
  if (startDistancePx <= 0) return camAtPinchStart;
  const notches = (startDistancePx - nowDistancePx) / PINCH_PX_PER_NOTCH;
  return zoomCamera(camAtPinchStart, notches);
}

export function resetCamera(cam: OrbitCamera): OrbitCamera {
  return { ...cam, yaw: RESET_YAW, pitch: RESET_PITCH, distance: RESET_DISTANCE };
}

/** Orbit target height: halfway up the trunk, in display units. */
export function targetZForTree(heightCm: number): number {
  return (heightCm / 100) * DISPLAY_SCALE * 0.5;
}

/**
 * Maps a world point into the viewer's render space by mirroring y.
 *
 * The prototype's look-at was left-handed (z-up, up vector (0,0,-1), negated
 * aspect; see obj_viewer_3d/Draw_64.gml), so at yaw 45 screen-right is world
 * (-1,-1,0), which its `_trunk_bend_world_angle` relies on. Three.js is
 * right-handed and would show a mirror image; flipping y restores the
 * prototype's picture, and lets R3d's direction formulas port unchanged.
 */
export function toViewerSpace(p: Vec3): Vec3 {
  return { x: p.x, y: -p.y, z: p.z };
}

export function cameraEye(cam: OrbitCamera): Vec3 {
  const { yaw, pitch, distance, target } = cam;
  return {
    x: target.x + dcos(yaw) * dcos(pitch) * distance,
    y: target.y - dsin(yaw) * dcos(pitch) * distance,
    z: target.z + dsin(pitch) * distance,
  };
}
