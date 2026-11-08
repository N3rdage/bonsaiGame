import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { FAR, FOV_DEGREES, NEAR, cameraEye, createOrbitCamera } from './camera';
import { projectToScreen } from './projection';
import { placeCamera } from './threeCamera';

describe('projectToScreen', () => {
  const width = 1600;
  const height = 900;
  const cam = createOrbitCamera();
  const camera = new PerspectiveCamera(FOV_DEGREES, width / height, NEAR, FAR);
  camera.up.set(0, 0, 1);
  placeCamera(camera, cam);
  const { x, y, z } = cam.target;

  it('puts the orbit target at the centre of the viewport', () => {
    const p = projectToScreen(camera, cam.target, width, height);
    expect(p?.x).toBeCloseTo(width / 2, 6);
    expect(p?.y).toBeCloseTo(height / 2, 6);
  });

  it('drops a point behind the camera', () => {
    const eye = cameraEye(cam);
    const len = Math.hypot(x - eye.x, y - eye.y, z - eye.z);
    const behind = {
      x: eye.x - (x - eye.x) / len,
      y: eye.y - (y - eye.y) / len,
      z: eye.z - (z - eye.z) / len,
    };
    expect(projectToScreen(camera, behind, width, height)).toBeUndefined();
  });

  it('drops a point beyond the far plane', () => {
    const eye = cameraEye(cam);
    const far = { x: x + (x - eye.x) * 20, y: y + (y - eye.y) * 20, z: z + (z - eye.z) * 20 };
    expect(projectToScreen(camera, far, width, height)).toBeUndefined();
  });

  // The prototype's handedness (see placeCamera's test): at yaw 45 world
  // (-1,-1,0) from the target is screen-right; screen y grows downward.
  it('puts world (-1,-1,0) from the target right of centre at yaw 45', () => {
    const p = projectToScreen(camera, { x: x - 0.2, y: y - 0.2, z }, width, height);
    expect(p?.x).toBeGreaterThan(width / 2);
  });

  it('puts world +z from the target above centre', () => {
    const p = projectToScreen(camera, { x, y, z: z + 0.2 }, width, height);
    expect(p?.y).toBeLessThan(height / 2);
  });
});
