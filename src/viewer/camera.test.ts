import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISTANCE,
  DEFAULT_PITCH,
  DEFAULT_YAW,
  DRAG_DEGREES_PER_PIXEL,
  FAR,
  FOV_DEGREES,
  NEAR,
  PINCH_PX_PER_NOTCH,
  PITCH_LIMIT,
  RESET_DISTANCE,
  RESET_PITCH,
  RESET_YAW,
  WHEEL_ZOOM_STEP,
  ZOOM_MAX,
  ZOOM_MIN,
  cameraEye,
  createOrbitCamera,
  pinchZoom,
  resetCamera,
  rotateCamera,
  targetZForTree,
  zoomCamera,
} from './camera';

describe('orbit camera constants (obj_viewer_3d)', () => {
  it('pins the prototype numbers', () => {
    expect(DEFAULT_YAW).toBe(45);
    expect(DEFAULT_PITCH).toBe(10);
    expect(DEFAULT_DISTANCE).toBe(2.5);
    expect(ZOOM_MIN).toBe(0.8);
    expect(ZOOM_MAX).toBe(6.0);
    expect(DRAG_DEGREES_PER_PIXEL).toBe(0.4);
    expect(WHEEL_ZOOM_STEP).toBe(0.08);
    expect(PITCH_LIMIT).toBe(80);
    expect(RESET_YAW).toBe(45);
    expect(RESET_PITCH).toBe(20);
    expect(RESET_DISTANCE).toBe(0.8);
    expect(FOV_DEGREES).toBe(60);
    expect(NEAR).toBe(0.01);
    expect(FAR).toBe(20);
  });
});

describe('orbit camera', () => {
  it('starts at the prototype defaults', () => {
    expect(createOrbitCamera()).toEqual({
      yaw: 45,
      pitch: 10,
      distance: 2.5,
      target: { x: 0, y: 0, z: 0.5 },
    });
  });

  it('rotates by drag pixels without mutating the input', () => {
    const cam = createOrbitCamera();
    const moved = rotateCamera(cam, 10, 5);
    expect(moved.yaw).toBeCloseTo(41);
    expect(moved.pitch).toBeCloseTo(8);
    expect(cam.yaw).toBe(45);
  });

  it('clamps pitch at +-80', () => {
    const cam = createOrbitCamera();
    expect(rotateCamera(cam, 0, -1000).pitch).toBe(80);
    expect(rotateCamera(cam, 0, 1000).pitch).toBe(-80);
  });

  it('zooms by wheel notches and clamps both ends', () => {
    const cam = createOrbitCamera();
    expect(zoomCamera(cam, 1).distance).toBeCloseTo(2.58);
    expect(zoomCamera(cam, -1).distance).toBeCloseTo(2.42);
    expect(zoomCamera(cam, 1000).distance).toBe(6.0);
    expect(zoomCamera(cam, -1000).distance).toBe(0.8);
  });

  it('pins the pinch scale at 20 px of finger distance per wheel notch', () => {
    expect(PINCH_PX_PER_NOTCH).toBe(20);
  });

  it('pinches closer with fingers apart and away with fingers together', () => {
    const cam = createOrbitCamera();
    expect(pinchZoom(cam, 100, 200).distance).toBeLessThan(2.5);
    expect(pinchZoom(cam, 200, 100).distance).toBeGreaterThan(2.5);
    expect(pinchZoom(cam, 150, 150).distance).toBe(2.5);
  });

  it('moves one wheel step for one notch of finger distance, continuously', () => {
    const cam = createOrbitCamera();
    expect(pinchZoom(cam, 100, 100 + PINCH_PX_PER_NOTCH).distance).toBeCloseTo(2.42);
    expect(pinchZoom(cam, 100 + PINCH_PX_PER_NOTCH, 100).distance).toBeCloseTo(2.58);
    // Half a notch is half a step: not rounded.
    expect(pinchZoom(cam, 100, 110).distance).toBeCloseTo(2.46);
  });

  it('clamps pinch zoom at both ends', () => {
    const cam = createOrbitCamera();
    expect(pinchZoom(cam, 10, 10_000).distance).toBe(ZOOM_MIN);
    expect(pinchZoom(cam, 10_000, 10).distance).toBe(ZOOM_MAX);
  });

  it('never rotates or retargets during a pinch', () => {
    const cam = { ...rotateCamera(createOrbitCamera(), 30, -12), target: { x: 1, y: 2, z: 3 } };
    const pinched = pinchZoom(cam, 120, 300);
    expect(pinched.yaw).toBe(cam.yaw);
    expect(pinched.pitch).toBe(cam.pitch);
    expect(pinched.target).toEqual({ x: 1, y: 2, z: 3 });
    expect(cam.distance).toBe(2.5);
  });

  it('leaves the camera unchanged for a zero or negative start distance', () => {
    const cam = createOrbitCamera();
    expect(pinchZoom(cam, 0, 200)).toEqual(cam);
    expect(pinchZoom(cam, -5, 200)).toEqual(cam);
  });

  it('resets yaw, pitch and distance but keeps the target', () => {
    const cam = { ...rotateCamera(createOrbitCamera(), 50, 20), target: { x: 1, y: 2, z: 3 } };
    expect(resetCamera(cam)).toEqual({
      yaw: 45,
      pitch: 20,
      distance: 0.8,
      target: { x: 1, y: 2, z: 3 },
    });
  });

  it('targets halfway up the trunk in display units', () => {
    expect(targetZForTree(20)).toBeCloseTo(0.4);
    expect(targetZForTree(0)).toBe(0);
  });

  it('places the eye along +x at yaw 0 pitch 0', () => {
    const eye = cameraEye({ yaw: 0, pitch: 0, distance: 2, target: { x: 1, y: 2, z: 3 } });
    expect(eye.x).toBeCloseTo(3);
    expect(eye.y).toBeCloseTo(2);
    expect(eye.z).toBeCloseTo(3);
  });

  it('places the eye straight above at pitch 90', () => {
    const eye = cameraEye({ yaw: 30, pitch: 90, distance: 2, target: { x: 1, y: 2, z: 3 } });
    expect(eye.x).toBeCloseTo(1);
    expect(eye.y).toBeCloseTo(2);
    expect(eye.z).toBeCloseTo(5);
  });

  it('moves toward -y as yaw increases', () => {
    const eye = cameraEye({ yaw: 90, pitch: 0, distance: 1, target: { x: 0, y: 0, z: 0 } });
    expect(eye.x).toBeCloseTo(0);
    expect(eye.y).toBeCloseTo(-1);
  });
});
