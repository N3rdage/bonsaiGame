import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { ROOMS } from '../world/gardenRoom';
import { GREENHOUSE_ROOM } from '../world/greenhouseRoom';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import {
  PLACEABLES,
  placeItem,
  pickUpItem,
  placedFurniture,
  placedProps,
} from '../world/placement';
import { SHED_ROOM, type Room } from '../world/shedRoom';
import { FURNITURE_VERTEX_BUDGET, furniturePieces, furnitureVertices } from './furniture';
import {
  FURNITURE_MODELS,
  MODELLED_SHEETS,
  modelVertices,
  type FurnitureKind,
} from './furnitureModels';
import { heightMetres, metres, roomPlan3d } from './plan';
import { meshSpecs } from './meshes';
import { treeStands } from './trees';

/** The greenhouse as the world scene shows it: the room with the state's placed items in it. */
function live(state: GameState): Room {
  return {
    ...GREENHOUSE_ROOM,
    props: [...GREENHOUSE_ROOM.props, ...placedProps(state, GREENHOUSE_ROOM, false)],
    furniture: [...GREENHOUSE_ROOM.furniture, ...placedFurniture(state, GREENHOUSE_ROOM)],
  };
}

const player = { x: 0, y: 0 };

describe('furniturePieces', () => {
  it("stands the shed's clutter on its foot, as tall as the room data says it stands", () => {
    const pieces = furniturePieces(SHED_ROOM);
    expect(pieces.map((p) => p.kind)).toEqual([
      'shelf',
      'tools',
      'watering_can',
      'pot_stack',
      'sack',
      'workbench',
      'planting_table',
      'kiosk',
    ]);
    // spr_shelf: (208, 67, 24, 20) px, 12 px tall on the bottom 8 px of its frame.
    expect(pieces[0]).toMatchObject({
      x: (6.5 + 7.25) / 2,
      y: (79 / 32 + 87 / 32) / 2,
      w: 0.75,
      d: 0.25,
      h: heightMetres(12),
      rotation: 0,
    });
  });

  it('has none in a room whose furniture has no model', () => {
    expect(furniturePieces(LOUNGE_ROOM)).toEqual([]);
  });

  it('leaves the modelled pieces out of the plan boxes the renderer draws', () => {
    const plan = roomPlan3d(SHED_ROOM);
    expect(plan.furniture.filter((b) => b.model !== undefined)).toHaveLength(8);
    expect(
      meshSpecs(plan)
        .map((spec) => spec.name)
        .filter((name) => name.startsWith('furniture.')),
    ).toEqual(['furniture.rug.spr_shed_rug']);
  });

  it('puts every placed item at its footprint, at the height its sheet stands', () => {
    const state = createNewGameState();
    state.inventory.pedestal = 1;
    state.inventory.floor_shelf = 1;
    placeItem(state, GREENHOUSE_ROOM, 'pedestal', 224, 128, player);
    placeItem(state, GREENHOUSE_ROOM, 'floor_shelf', 256, 96, player);
    const [pedestal, shelf] = furniturePieces(live(state));
    expect(pedestal).toMatchObject({
      kind: 'pedestal',
      x: metres(224 + 8),
      y: metres(128 + 8),
      w: metres(PLACEABLES.pedestal.w),
      d: metres(PLACEABLES.pedestal.h),
    });
    expect(shelf).toMatchObject({ kind: 'floor_shelf', w: 1, d: 0.5 });
  });

  it('gives a piece a new key when it is placed elsewhere and the same key while it stays', () => {
    const state = createNewGameState();
    state.inventory.pedestal = 2;
    placeItem(state, GREENHOUSE_ROOM, 'pedestal', 224, 128, player);
    const [before] = furniturePieces(live(state));
    placeItem(state, GREENHOUSE_ROOM, 'pedestal', 256, 128, player);
    const pieces = furniturePieces(live(state));
    expect(pieces).toHaveLength(2);
    expect(pieces[0]?.key).toBe(before?.key);
    expect(pieces[1]?.key).not.toBe(before?.key);
  });

  it('drops a picked-up item from the pieces', () => {
    const state = createNewGameState();
    state.inventory.pedestal = 1;
    const placed = placeItem(state, GREENHOUSE_ROOM, 'pedestal', 224, 128, player);
    expect(furniturePieces(live(state))).toHaveLength(1);
    if (typeof placed === 'string') throw new Error(placed);
    expect(pickUpItem(state, placed.id)).toBe('ok');
    expect(furniturePieces(live(state))).toEqual([]);
  });

  it("draws a placed item's top at the height a tree on it stands", () => {
    const state = createNewGameState();
    state.inventory.pedestal = 1;
    const placed = placeItem(state, GREENHOUSE_ROOM, 'pedestal', 224, 128, player);
    if (typeof placed === 'string') throw new Error(placed);
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: 'displayed:placed_0' }];
    const [stand] = treeStands(state, live(state), 'spring');
    const [piece] = furniturePieces(live(state));
    expect(piece?.h).toBeGreaterThan(0);
    expect(stand?.z).toBe(piece?.h);
  });
});

describe('the furniture vertex budget', () => {
  it.each(Object.entries(ROOMS))('%s draws its furniture within the budget', (_key, room) => {
    expect(furnitureVertices(room)).toBeLessThanOrEqual(FURNITURE_VERTEX_BUDGET);
  });

  it("counts each piece's model once: the shed's pieces add up", () => {
    const kinds = furniturePieces(SHED_ROOM).map((p) => p.kind);
    expect(furnitureVertices(SHED_ROOM)).toBe(
      kinds.reduce((sum, kind) => sum + modelVertices(kind), 0),
    );
    expect(furnitureVertices(SHED_ROOM)).toBe(7560);
  });
});

describe('furniture models', () => {
  const kinds = Object.keys(FURNITURE_MODELS) as FurnitureKind[];

  it('has a model for every kind a sheet maps to, and a sheet or a shed prop for every model', () => {
    const propKinds: FurnitureKind[] = ['workbench', 'planting_table', 'kiosk'];
    expect(new Set([...Object.values(MODELLED_SHEETS), ...propKinds])).toEqual(new Set(kinds));
  });

  it.each(kinds)(
    '%s: parts stand on the floor inside the footprint and end at the height',
    (kind) => {
      const { size, parts } = FURNITURE_MODELS[kind];
      expect(parts.length).toBeGreaterThan(0);
      const eps = 1e-9;
      for (const part of parts) {
        expect(part.z0).toBeGreaterThanOrEqual(0);
        expect(part.z1).toBeGreaterThan(part.z0);
        expect(Math.min(part.x0, part.x1)).toBeGreaterThanOrEqual(-size.w / 2 - eps);
        expect(Math.max(part.x0, part.x1)).toBeLessThanOrEqual(size.w / 2 + eps);
        expect(part.y0).toBeGreaterThanOrEqual(-size.d / 2 - eps);
        expect(part.y1).toBeLessThanOrEqual(size.d / 2 + eps);
        expect(part.radius).toBeGreaterThan(0);
        expect(part.radius).toBeLessThanOrEqual(
          Math.min(part.x1 - part.x0, part.y1 - part.y0, part.z1 - part.z0) / 2,
        );
      }
      expect(Math.min(...parts.map((p) => p.z0))).toBe(0);
      expect(Math.max(...parts.map((p) => p.z1))).toBeCloseTo(size.h, 9);
    },
  );
});
