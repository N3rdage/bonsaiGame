import type { PerspectiveCamera } from 'three';
import { cameraEye, toViewerSpace, type OrbitCamera } from './camera';

/** Positions a z-up Three.js camera at the orbit's eye, in mirrored viewer space. */
export function placeCamera(camera: PerspectiveCamera, cam: OrbitCamera): void {
  const eye = toViewerSpace(cameraEye(cam));
  const target = toViewerSpace(cam.target);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z);
}
