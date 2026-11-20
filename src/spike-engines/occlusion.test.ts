import { describe, expect, it } from 'vitest';
import { blockingOccluders, segmentHitsBox } from './occlusion';
import { eyeOf, targetOf } from './orbit';
import { buildScene } from './scene';

const box = { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };

describe('occlusion', () => {
  it('finds a segment through a box, not one passing it or stopping short', () => {
    expect(segmentHitsBox({ x: -1, y: 0.5, z: 0.5 }, { x: 2, y: 0.5, z: 0.5 }, box)).toBe(true);
    expect(segmentHitsBox({ x: -1, y: 2, z: 0.5 }, { x: 2, y: 2, z: 0.5 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -1, y: 0.5, z: 0.5 }, { x: -0.1, y: 0.5, z: 0.5 }, box)).toBe(false);
    // Along an axis, on the skin only: not through.
    expect(segmentHitsBox({ x: -1, y: 1, z: 0.5 }, { x: 2, y: 1, z: 0.5 }, box)).toBe(false);
  });

  const scene = buildScene();

  it('fades the house when the camera looks over it at the player in the front garden', () => {
    const feet = scene.spawns.frontDoor;
    // From the south, over the house.
    const eye = eyeOf({ yaw: 0, pitch: 30, distance: 10 }, targetOf(feet));
    expect(blockingOccluders(eye, feet, scene.occluders)).toContain('house');
    // From the road, nothing stands between.
    const road = eyeOf({ yaw: 180, pitch: 30, distance: 6 }, targetOf(feet));
    expect(blockingOccluders(road, feet, scene.occluders)).toEqual([]);
  });

  it('fades the shed roof over a player inside it seen from above', () => {
    const feet = scene.spawns.shed;
    const eye = eyeOf({ yaw: 0, pitch: 60, distance: 9 }, targetOf(feet));
    const faded = blockingOccluders(eye, feet, scene.occluders);
    expect(faded).toContain('shedRoof');
    expect(faded).not.toContain('house');
  });
});
