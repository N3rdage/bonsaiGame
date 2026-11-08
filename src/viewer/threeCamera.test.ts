import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../sim/types';
import { FAR, FOV_DEGREES, NEAR, createOrbitCamera, toViewerSpace } from './camera';
import { placeCamera } from './threeCamera';

function project(camera: PerspectiveCamera, world: Vec3): Vector3 {
  const p = toViewerSpace(world);
  return new Vector3(p.x, p.y, p.z).project(camera);
}

describe('placeCamera handedness', () => {
  // The prototype's look-at flips screen-x handedness
  // (archive/gamemaker/objects/obj_viewer_3d/Draw_64.gml lines 356-362):
  // at yaw 45, screen-right is world (-1,-1,0). The port must show the same image.
  const cam = createOrbitCamera();
  const camera = new PerspectiveCamera(FOV_DEGREES, 16 / 9, NEAR, FAR);
  camera.up.set(0, 0, 1);
  placeCamera(camera, cam);
  camera.updateMatrixWorld();
  const { x, y, z } = cam.target;

  it('puts world (-1,-1,0) from the target on screen-right at yaw 45', () => {
    expect(project(camera, { x: x - 1, y: y - 1, z }).x).toBeGreaterThan(0);
    expect(project(camera, { x: x + 1, y: y + 1, z }).x).toBeLessThan(0);
  });

  it('keeps world +z up on screen', () => {
    expect(project(camera, { x, y, z: z + 1 }).y).toBeGreaterThan(0);
  });
});
