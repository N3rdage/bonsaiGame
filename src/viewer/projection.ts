import { Vector3, type PerspectiveCamera } from 'three';
import type { Vec3 } from '../sim/types';
import { toViewerSpace } from './camera';
import type { ScreenPoint } from './hotspots';

/**
 * Projects a world point to CSS px in a `width` x `height` viewport (y down),
 * through the same y mirror as the meshes. Undefined when the point is behind
 * the camera or outside the near/far range. Updates the camera's matrices
 * first, so it is correct right after `placeCamera`.
 *
 * Ported from `project_3d_to_screen` in
 * archive/gamemaker/scripts/scr_math_3d/scr_math_3d.gml.
 */
export function projectToScreen(
  camera: PerspectiveCamera,
  p: Vec3,
  width: number,
  height: number,
): ScreenPoint | undefined {
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const v = toViewerSpace(p);
  const point = new Vector3(v.x, v.y, v.z);
  if (point.clone().applyMatrix4(camera.matrixWorldInverse).z >= 0) return undefined;
  const ndc = point.project(camera);
  if (ndc.z < -1 || ndc.z > 1) return undefined;
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height };
}
