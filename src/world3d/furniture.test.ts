import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { ROOMS } from '../world/gardenRoom';
import { GREENHOUSE_ROOM } from '../world/greenhouseRoom';
import { HALLWAY_ROOM, HALL_TABLE } from '../world/hallwayRoom';
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
import { OBJECTS } from './look';
import { isPackKind } from './packModels';
import { MANTEL_HEIGHT, heightMetres, metres, roomPlan3d } from './plan';
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

  it("stands the lounge's furniture over its 2D footprints, each as tall as its sprite stands", () => {
    const [fireplace, sideTable, sofa, table, chair, bookcase, lamp, plant, counter, counterV] =
      furniturePieces(LOUNGE_ROOM);
    expect(furniturePieces(LOUNGE_ROOM)).toHaveLength(10);
    expect(counter).toMatchObject({ kind: 'counter', w: 3, d: 0.625, h: heightMetres(20) });
    expect(counterV).toMatchObject({ kind: 'counter_v', w: 0.625, d: 1.875, h: heightMetres(20) });
    expect(sofa).toMatchObject({
      kind: 'sofa',
      x: metres(112 + 14),
      y: metres(98 + 30),
      w: 0.875,
      d: 1.875,
      h: heightMetres(20),
      rotation: 0,
    });
    // The mantel is 1 m by 0.75 m and drawn at the mantel's height, so the model needs no scaling.
    expect(fireplace).toMatchObject({
      kind: 'fireplace',
      x: metres(240),
      y: metres(76),
      w: 1,
      d: 0.75,
      h: MANTEL_HEIGHT,
    });
    expect(sideTable).toMatchObject({
      kind: 'side_table',
      x: metres(104),
      y: metres(72),
      w: 0.5,
      d: 0.5,
      h: heightMetres(8),
    });
    expect(table).toMatchObject({ kind: 'coffee_table', w: 0.625, d: 1, h: heightMetres(8) });
    expect(chair).toMatchObject({ kind: 'armchair', w: 0.75, d: 0.75, h: heightMetres(20) });
    expect(bookcase).toMatchObject({
      kind: 'bookcase',
      x: metres(258 + 14),
      y: metres(64 + 6),
      w: 0.875,
      d: 0.375,
      h: heightMetres(38),
    });
    expect(lamp).toMatchObject({
      kind: 'floor_lamp',
      w: 0.4375,
      d: 0.4375,
      h: heightMetres(32),
    });
    expect(plant).toMatchObject({
      kind: 'potted_plant',
      w: 0.625,
      d: 0.5,
      h: heightMetres(24),
    });
  });

  it("keeps the lounge's furniture solid in the plan, where the renderer collides with it", () => {
    const boxes = roomPlan3d(LOUNGE_ROOM).furniture.filter((b) => b.model !== undefined);
    expect(boxes.map((b) => [b.model, b.solid])).toEqual([
      ['fireplace', true],
      ['side_table', true],
      ['sofa', true],
      ['coffee_table', true],
      ['armchair', true],
      ['bookcase', true],
      ['floor_lamp', true],
      ['potted_plant', true],
      ['counter', true],
      ['counter_v', true],
    ]);
    expect(boxes.map((b) => [b.x0, b.x1, b.y0, b.y1])).toEqual([
      [7, 8, 2, 2.75],
      [3, 3.5, 2, 2.5],
      [3.5, 4.375, 3.0625, 4.9375],
      [4.5625, 5.1875, 3.5, 4.5],
      [8.625, 9.375, 3.5, 4.25],
      [8.0625, 8.9375, 2, 2.375],
      [8.78125, 9.21875, 4.375, 4.8125],
      [9.1875, 9.8125, 2, 2.5],
      [10.5, 13.5, 5.875, 6.5],
      [12.875, 13.5, 4, 5.875],
    ]);
  });

  it('leaves the modelled pieces out of the plan boxes the renderer draws', () => {
    const plan = roomPlan3d(SHED_ROOM);
    expect(plan.furniture.filter((b) => b.model !== undefined)).toHaveLength(7);
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
    expect(furnitureVertices(SHED_ROOM)).toBe(6480);
  });

  it("counts the lounge's ten pieces: 11,117 vertices, inside the budget", () => {
    expect(furnitureVertices(LOUNGE_ROOM)).toBe(11117);
    expect(furnitureVertices(LOUNGE_ROOM)).toBeLessThanOrEqual(FURNITURE_VERTEX_BUDGET);
  });

  it('counts the fireplace: ten rounded boxes, under 2,500 vertices', () => {
    expect(FURNITURE_MODELS.fireplace.parts).toHaveLength(10);
    expect(modelVertices('fireplace')).toBe(2160);
  });

  it('counts a lamp from its file and a plant from its round parts', () => {
    // The lamp is the pack's `lamp_standing`, 304 vertices.
    expect(modelVertices('floor_lamp')).toBe(304);
    // The pot, rim, soil and stem are cylinders; four balls of foliage.
    expect(modelVertices('potted_plant')).toBe(4 * 22 + 4 * 42);
  });
});

describe('the fireplace model', () => {
  const { size, parts } = FURNITURE_MODELS.fireplace;
  const shelf = parts.reduce((top, p) => (p.z1 > top.z1 ? p : top));
  const firebox = parts.filter((p) => p.object === 'soot');

  it('is the footprint and the drawn height of the lounge fireplace', () => {
    expect(MODELLED_SHEETS.spr_fireplace).toBe('fireplace');
    expect(size).toEqual({ w: 1, d: 0.75, h: MANTEL_HEIGHT });
  });

  it('ends in a mantel shelf of wood, wider than the surround and overhanging its front', () => {
    expect(shelf.object).toBe('wood');
    expect(shelf.z1).toBe(MANTEL_HEIGHT);
    const surround = parts.filter((p) => p.object === 'stone' && p.z0 > 0);
    for (const p of surround) {
      expect(shelf.x1 - shelf.x0).toBeGreaterThan(p.x1 - p.x0 - 1e-9);
      expect(shelf.y1).toBeGreaterThan(p.y1);
      expect(shelf.y0).toBeCloseTo(p.y0, 9);
    }
  });

  it('opens its dark firebox to the front (+y), the way the room faces', () => {
    const [back, floor] = [...firebox].sort((a, b) => b.z1 - a.z1);
    // The back is against the north edge; the floor runs out from it, and nothing but the hearth is in front.
    expect(back?.y0).toBeCloseTo(-size.d / 2, 9);
    const front = Math.max(...parts.filter((p) => p.z0 > 0.05).map((p) => p.y1));
    expect(floor?.y1).toBeLessThan(front);
    const jambs = parts.filter((p) => p.object === 'stone' && p.z0 > 0 && p.z1 < size.h - 0.1);
    expect(jambs).toHaveLength(2);
    expect(Math.max(...jambs.map((j) => j.x0))).toBeCloseTo(back?.x1 ?? 0, 9);
    expect(Math.min(...jambs.map((j) => j.x1))).toBeCloseTo(back?.x0 ?? 0, 9);
  });

  it('steps a hearth out in front of the surround and lays logs in the firebox', () => {
    const hearthTop = 0.06;
    const hearth = parts[0];
    expect(hearth).toMatchObject({ object: 'stone', z0: 0, y1: size.d / 2 });
    const surroundFront = Math.max(...parts.filter((p) => p.z0 >= hearthTop).map((p) => p.y1));
    expect(hearth?.y1).toBeGreaterThan(surroundFront);
    expect(hearth?.z1).toBe(hearthTop);
    const logs = parts.filter((p) => p.object === 'bark' || p.object === 'woodDark');
    expect(logs).toHaveLength(3);
  });

  it('stands the mantel tree on the shelf top, at its drawn height', () => {
    const state = createNewGameState();
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: 'displayed:lounge_mantel' }];
    expect(treeStands(state, LOUNGE_ROOM, 'spring')[0]?.z).toBe(shelf.z1);
  });
});

describe('furniture models', () => {
  const kinds = Object.keys(FURNITURE_MODELS) as FurnitureKind[];

  it('has a model for every kind a sheet maps to, and a sheet or a shed prop for every model', () => {
    const propKinds: FurnitureKind[] = ['workbench', 'planting_table', 'bicycle'];
    expect(new Set([...Object.values(MODELLED_SHEETS), ...propKinds])).toEqual(new Set(kinds));
  });

  it('colours every part from the object palette', () => {
    for (const kind of kinds) {
      for (const { object } of FURNITURE_MODELS[kind].parts) {
        expect(object in OBJECTS, `${kind}: ${object}`).toBe(true);
        expect(OBJECTS[object]).toEqual(expect.any(Number));
      }
    }
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
        if (isPackKind(kind)) {
          // A pack kind's box is the sharp wood one the plan drew, over the model's extent.
          expect(part.radius).toBeUndefined();
        } else if (part.shape === undefined) {
          expect(part.radius).toBeGreaterThan(0);
          expect(part.radius).toBeLessThanOrEqual(
            Math.min(part.x1 - part.x0, part.y1 - part.y0, part.z1 - part.z0) / 2,
          );
        } else {
          expect(part.radius).toBeUndefined();
        }
        if (part.shape === 'cone') {
          expect(part.taper ?? 0).toBeGreaterThanOrEqual(0);
          expect(part.taper ?? 0).toBeLessThanOrEqual(1);
        } else {
          expect(part.taper).toBeUndefined();
        }
      }
      expect(Math.min(...parts.map((p) => p.z0))).toBe(0);
      expect(Math.max(...parts.map((p) => p.z1))).toBeCloseTo(size.h, 9);
    },
  );
});

describe("the hallway's console table model", () => {
  const { size, parts } = FURNITURE_MODELS.hall_table;

  it('is the piece: 0.5 x 0.375 m and 0.75 m high, in the object palette', () => {
    expect(MODELLED_SHEETS.spr_hall_table).toBe('hall_table');
    expect(size).toEqual({ w: 0.5, d: 0.375, h: 0.75 });
    const [piece] = furniturePieces(HALLWAY_ROOM).filter((p) => p.kind === 'hall_table');
    expect([piece?.w, piece?.d, piece?.h]).toEqual([size.w, size.d, size.h]);
    expect(HALL_TABLE.solid).toBe(false);
  });

  it('is a top on four legs with a drawer front and a knob: seven parts', () => {
    expect(parts).toHaveLength(7);
    expect(parts.filter((p) => p.z0 === 0)).toHaveLength(4);
    const top = parts.reduce((best, p) => (p.z1 > best.z1 ? p : best));
    expect(top).toMatchObject({ object: 'wood', z1: 0.75, x0: -0.25, x1: 0.25 });
    expect(parts.map((p) => p.object).sort()).toEqual(
      ['brass', 'wood', 'wood', 'wood', 'wood', 'wood', 'woodDark'].sort(),
    );
  });

  it('draws a rug and a table in the hallway, well inside the budget', () => {
    expect(modelVertices('runner_rug')).toBe(48);
    expect(furnitureVertices(HALLWAY_ROOM)).toBe(48 + modelVertices('hall_table'));
    expect(furnitureVertices(HALLWAY_ROOM)).toBeLessThanOrEqual(FURNITURE_VERTEX_BUDGET);
  });
});
