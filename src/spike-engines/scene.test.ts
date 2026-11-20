import { describe, expect, it } from 'vitest';
import { CAST_SHADOW } from '../world/lighting';
import { MOVE_SPEED, STEPS_PER_SECOND } from '../world/player';
import { collide } from './movement';
import { SHED, WALK_SPEED, blockCorners, boundsOf, buildScene, roomAt, toRender } from './scene';
import { SITE } from './site';

const scene = buildScene();
const named = (name: string) => scene.boxes.filter((b) => b.name === name);

describe('the engine spike scene', () => {
  it('keeps the front garden, leaves the side gate open and adds the shed at plan B3 positions', () => {
    expect(named('house')).toHaveLength(1);
    expect(named('side gate')).toEqual([]);
    expect(named('pedestal')).toHaveLength(1);
    expect(SHED).toMatchObject({ x0: 0, x1: 5, y0: 4.5, y1: 8 });
    expect(scene.doorways.map((d) => d.name)).toEqual(['shed door', 'side gate']);
  });

  it('textures every material it uses, and only from the Inked sheets in public/assets', () => {
    for (const box of scene.boxes) expect(scene.materials[box.material], box.name).toBeDefined();
    for (const spec of Object.values(scene.materials)) {
      if (spec.sheet) expect(spec.sheet.art).toBe('inked');
    }
    expect(scene.materials.shedFloor.sheet?.key).toBe('spr_floor_shed');
    expect(scene.materials.lawn.sheet?.key).toBe('spr_floor_garden');
    expect(scene.materials.roof.sheet?.key).toBe('spr_house_roof');
  });

  it('puts the house, garage and shed walls and roof into occluders', () => {
    expect(Object.keys(scene.occluders).sort()).toEqual(
      [
        'fenceEast',
        'fenceSouth',
        'fenceWest',
        'garage',
        'house',
        'shedEast',
        'shedNorth',
        'shedRoof',
        'shedSouth',
        'shedWest',
      ].sort(),
    );
    const house = scene.occluders.house;
    expect(house?.x0).toBeLessThanOrEqual(SITE.house.x0);
    expect(house?.x1).toBeGreaterThanOrEqual(SITE.house.x1);
    // The roof's ridge is the top.
    expect(house?.z1).toBeGreaterThan(SITE.house.eaves);
  });

  it('walks in through the shed door and nowhere else in its south wall', () => {
    const door = scene.doorways[0]?.gap;
    expect(door).toBeDefined();
    if (!door) return;
    const mid = (door.x0 + door.x1) / 2;
    // In the doorway, the player is untouched; a metre along the wall, it is pushed out.
    expect(collide({ x: mid, y: SHED.y1 - 0.06 }, scene.colliders)).toEqual({
      x: mid,
      y: SHED.y1 - 0.06,
    });
    const blocked = collide({ x: mid + 1, y: SHED.y1 - 0.06 }, scene.colliders);
    expect(blocked.y).not.toBeCloseTo(SHED.y1 - 0.06, 3);
  });

  it('keeps the road, the roofs and the ground out of the colliders', () => {
    expect(scene.boxes.filter((b) => b.solid && b.ground)).toEqual([]);
    expect(named('roof north').every((b) => !b.solid)).toBe(true);
    expect(named('shed roof').every((b) => !b.solid)).toBe(true);
    expect(named('workbench').every((b) => b.solid)).toBe(true);
    // A walker on the road is pushed back off it.
    expect(collide({ x: 2, y: -5.5 }, scene.colliders).y).not.toBe(-5.5);
  });

  it('knows the shed from the garden', () => {
    expect(roomAt(scene, scene.spawns.shed)).toBe('shed');
    expect(roomAt(scene, scene.spawns.shedDoor)).toBe('garden');
    expect(roomAt(scene, scene.spawns.frontDoor)).toBe('garden');
  });

  it('starts every spawn clear of the colliders', () => {
    for (const p of Object.values(scene.spawns)) expect(collide(p, scene.colliders)).toEqual(p);
  });

  it("lights the scene from the rooms' one light: high, from the north-west", () => {
    const { x, y, z } = scene.light;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    // A 1 m post's shadow falls CAST_SHADOW.length m along the screen's (0.8, 0.6), south-east.
    expect(-x / z).toBeCloseTo(CAST_SHADOW.length * CAST_SHADOW.direction[0], 12);
    expect(-y / z).toBeCloseTo(CAST_SHADOW.length * CAST_SHADOW.direction[1], 12);
  });

  it('walks at the 2D game speed', () => {
    expect(WALK_SPEED).toBeCloseTo((MOVE_SPEED * STEPS_PER_SECOND) / 32, 12);
  });

  it('turns a tilted slab about its centre so its south end rises', () => {
    const slab = {
      name: 's',
      wash: 'tile' as const,
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 2,
      z0: 0,
      z1: 0,
      tilt: Math.PI / 6,
    };
    const corners = blockCorners(slab);
    const south = corners.filter((p) => p.y > 1);
    expect(south.every((p) => p.z > 0)).toBe(true);
    const b = boundsOf([slab]);
    expect(b.z1).toBeCloseTo(Math.sin(Math.PI / 6), 12);
  });

  it('maps site metres into the Y-up render frame', () => {
    expect(toRender({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: 2 });
  });
});
