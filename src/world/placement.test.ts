import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { DISPLAYED_PREFIX, pickUpTree, placeTree } from '../sim/tree';
import type { GameState, PlacedItem } from '../sim/types';
import { advanceDayAllTrees } from '../sim/world';
import { SHEETS } from './assets';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import {
  DISPLAY_PROMPT,
  PICK_UP_PROMPT,
  PLACEABLES,
  footprint,
  ghostFootprint,
  landingTiles,
  pickUpItem,
  placeItem,
  placedFurniture,
  placedProps,
  placedSpots,
  placementCheck,
  snapToGrid,
} from './placement';
import type { Facing } from './player';
import { SHED_ROOM, type Room } from './shedRoom';

/** Clear of everything placed in these tests: the door's landing. */
const PLAYER = { x: 240, y: 206 };

function stocked(): GameState {
  const state = createNewGameState();
  state.inventory.pedestal = 2;
  state.inventory.floor_shelf = 1;
  return state;
}

function placed(result: ReturnType<typeof placeItem>): PlacedItem {
  if (typeof result === 'string') throw new Error(`refused: ${result}`);
  return result;
}

const check = (state: GameState, kind: 'pedestal' | 'floor_shelf', x: number, y: number) =>
  placementCheck(GREENHOUSE_ROOM, state, kind, x, y, PLAYER);

describe('placement', () => {
  it('snaps to the 16 px grid by flooring', () => {
    expect(snapToGrid(64, 64)).toEqual({ x: 64, y: 64 });
    expect(snapToGrid(79.9, 95)).toEqual({ x: 64, y: 80 });
  });

  it('gives a pedestal one 16x16 tile and a floor shelf two side by side', () => {
    expect(PLACEABLES.pedestal).toEqual({ label: 'Pedestal', w: 16, h: 16, spots: 1 });
    expect(PLACEABLES.floor_shelf).toEqual({ label: 'Floor shelf', w: 32, h: 16, spots: 2 });
    expect(footprint('floor_shelf', 96, 80)).toEqual({ x: 96, y: 80, w: 32, h: 16 });
    const shelf: PlacedItem = { id: 3, kind: 'floor_shelf', room: 'greenhouse', x: 96, y: 80 };
    expect(placedSpots(shelf)).toEqual([
      { key: 'placed_3', x: 96, y: 80, w: 16, h: 16 },
      { key: 'placed_3_2', x: 112, y: 80, w: 16, h: 16 },
    ]);
  });

  it('accepts a pedestal and a shelf on the greenhouse floor, even at its edges', () => {
    const state = stocked();
    expect(check(state, 'pedestal', 64, 64)).toBe('ok');
    expect(check(state, 'floor_shelf', 384, 208)).toBe('ok');
  });

  it('refuses a footprint off the floor, in the wall band', () => {
    const state = stocked();
    expect(check(state, 'pedestal', 48, 64)).toBe('off the floor');
    expect(check(state, 'floor_shelf', 400, 64)).toBe('off the floor');
    expect(check(state, 'pedestal', 64, 224)).toBe('off the floor');
    // The door sits in the bottom wall's band, so a footprint over it is off the floor first.
    expect(check(state, 'pedestal', 232, 224)).toBe('off the floor');
  });

  it('refuses a footprint over a prop, solid furniture or another placed item', () => {
    const state = stocked();
    const room: Room = {
      ...GREENHOUSE_ROOM,
      props: [{ key: 'urn', label: 'Urn', prompt: 'Look', x: 104, y: 104, w: 16, h: 16 }],
      furniture: [{ x: 160, y: 160, w: 32, h: 16, solid: true, sheet: SHEETS.sideTable }],
    };
    const at = (x: number, y: number) => placementCheck(room, state, 'pedestal', x, y, PLAYER);
    expect(at(96, 96)).toBe('in the way');
    expect(at(112, 112)).toBe('ok');
    expect(at(176, 160)).toBe('in the way');
    placed(placeItem(state, GREENHOUSE_ROOM, 'floor_shelf', 64, 64, PLAYER));
    expect(check(state, 'pedestal', 80, 64)).toBe('in the way');
    expect(check(state, 'pedestal', 96, 64)).toBe('ok');
  });

  it("refuses a footprint over the player's position", () => {
    const player = { x: 100, y: 100 };
    const at = (x: number, y: number) =>
      placementCheck(GREENHOUSE_ROOM, stocked(), 'pedestal', x, y, player);
    expect(at(96, 96)).toBe('too close');
    expect(at(96, 80)).toBe('ok');
  });

  it('keeps a tile of clearance round every door', () => {
    const state = stocked();
    for (const kind of ['pedestal', 'floor_shelf'] as const) {
      expect(check(state, kind, 240, 208)).toBe('blocks the door');
      expect(check(state, kind, 224, 208)).toBe('blocks the door');
      expect(check(state, kind, 256, 208)).toBe('blocks the door');
    }
    // The door's x 232..248 grows to 216..264, half a tile off the grid, so it reaches into 208 and 256.
    expect(check(state, 'pedestal', 208, 208)).toBe('blocks the door');
    expect(check(state, 'pedestal', 192, 208)).toBe('ok');
    expect(check(state, 'pedestal', 272, 208)).toBe('ok');
    expect(check(state, 'floor_shelf', 192, 208)).toBe('blocks the door');
    expect(check(state, 'floor_shelf', 176, 208)).toBe('ok');
  });

  it('reports off the floor and in the way before blocks the door', () => {
    const state = stocked();
    expect(check(state, 'pedestal', 240, 224)).toBe('off the floor');
    state.placed = [{ id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 208 }];
    state.nextPlacedId = 1;
    expect(check(state, 'pedestal', 240, 208)).toBe('in the way');
  });

  it("keeps the tile a door lands the player on clear, ahead of the player's own tile", () => {
    const state = stocked();
    // The garden's greenhouse door (and the room's own start) lands the player at (240, 206), tile (240, 192).
    expect(landingTiles(GREENHOUSE_ROOM)).toEqual([
      { x: 240, y: 192, w: 16, h: 16 },
      { x: 240, y: 192, w: 16, h: 16 },
    ]);
    const away = { x: 100, y: 100 };
    for (const kind of ['pedestal', 'floor_shelf'] as const) {
      expect(placementCheck(GREENHOUSE_ROOM, state, kind, 240, 192, away)).toBe('blocks the door');
      // Standing on the landing itself, the door's refusal comes before `too close`.
      expect(check(state, kind, 240, 192)).toBe('blocks the door');
    }
    // A shelf beside the landing covers it; a pedestal beside it, or the tile above, does not.
    expect(placementCheck(GREENHOUSE_ROOM, state, 'floor_shelf', 224, 192, away)).toBe(
      'blocks the door',
    );
    expect(placementCheck(GREENHOUSE_ROOM, state, 'pedestal', 224, 192, away)).toBe('ok');
    expect(placementCheck(GREENHOUSE_ROOM, state, 'pedestal', 256, 192, away)).toBe('ok');
    expect(check(state, 'pedestal', 240, 176)).toBe('ok');
    expect(check(state, 'floor_shelf', 224, 176)).toBe('ok');
  });

  it('keeps no ring in a room without doors, only the landings from the other rooms', () => {
    const room: Room = { ...GREENHOUSE_ROOM, props: [] };
    const state = stocked();
    expect(placementCheck(room, state, 'pedestal', 240, 208, PLAYER)).toBe('ok');
    expect(placementCheck(room, state, 'floor_shelf', 224, 208, PLAYER)).toBe('ok');
    expect(placementCheck(room, state, 'pedestal', 240, 192, PLAYER)).toBe('blocks the door');
    const lone: Room = { ...room, key: 'greenhouse', playerStart: { x: 100, y: 100 } };
    expect(landingTiles(lone, {})).toEqual([{ x: 96, y: 96, w: 16, h: 16 }]);
  });

  it('puts the ghost on the tile the player faces, reaching away from the player', () => {
    const at = (facing: Facing) => ({ ...PLAYER, facing });
    expect(ghostFootprint('pedestal', at('right'))).toEqual({ x: 256, y: 192, w: 16, h: 16 });
    expect(ghostFootprint('pedestal', at('left'))).toEqual({ x: 224, y: 192, w: 16, h: 16 });
    expect(ghostFootprint('pedestal', at('down'))).toEqual({ x: 240, y: 208, w: 16, h: 16 });
    expect(ghostFootprint('pedestal', at('up'))).toEqual({ x: 240, y: 176, w: 16, h: 16 });
    expect(ghostFootprint('floor_shelf', at('right'))).toEqual({ x: 256, y: 192, w: 32, h: 16 });
    expect(ghostFootprint('floor_shelf', at('left'))).toEqual({ x: 208, y: 192, w: 32, h: 16 });
    expect(ghostFootprint('floor_shelf', at('down'))).toEqual({ x: 240, y: 208, w: 32, h: 16 });
    expect(ghostFootprint('floor_shelf', at('up'))).toEqual({ x: 240, y: 176, w: 32, h: 16 });
  });

  it('snaps the ghost from a position off the grid', () => {
    const player = { x: 250.5, y: 199.25 };
    expect(ghostFootprint('floor_shelf', { ...player, facing: 'left' })).toEqual({
      x: 208,
      y: 192,
      w: 32,
      h: 16,
    });
    expect(ghostFootprint('pedestal', { ...player, facing: 'down' })).toEqual({
      x: 240,
      y: 208,
      w: 16,
      h: 16,
    });
  });

  it("never covers the player's own position, so is never too close", () => {
    for (const facing of ['right', 'left', 'down', 'up'] as const) {
      for (const kind of ['pedestal', 'floor_shelf'] as const) {
        const player = { x: 250.5, y: 199.25, facing };
        const g = ghostFootprint(kind, player);
        expect(placementCheck(GREENHOUSE_ROOM, stocked(), kind, g.x, g.y, player)).not.toBe(
          'too close',
        );
      }
    }
  });

  it('refuses a ghost over the door or over a placed item', () => {
    const state = stocked();
    // Walked down from the landing into the bottom wall (y 223.5): the door's tile is in the wall band.
    const door = ghostFootprint('pedestal', { x: 240, y: 223.5, facing: 'down' });
    expect(door).toEqual({ x: 240, y: 224, w: 16, h: 16 });
    expect(check(state, 'pedestal', door.x, door.y)).toBe('off the floor');
    const ghost = ghostFootprint('pedestal', { ...PLAYER, facing: 'up' });
    placed(placeItem(state, GREENHOUSE_ROOM, 'pedestal', ghost.x, ghost.y, PLAYER));
    const shelf = ghostFootprint('floor_shelf', { ...PLAYER, facing: 'up' });
    expect(check(state, 'floor_shelf', shelf.x, shelf.y)).toBe('in the way');
  });

  it('takes furniture only in the greenhouse', () => {
    const at = SHED_ROOM.bounds;
    const result = placementCheck(SHED_ROOM, stocked(), 'pedestal', at.x + 32, at.y + 32, PLAYER);
    expect(result).toBe('not here');
  });

  it('refuses none left with none in the inventory, after the spot check', () => {
    const state = createNewGameState();
    state.inventory.pedestal = 0;
    expect(placeItem(state, GREENHOUSE_ROOM, 'pedestal', 64, 64, PLAYER)).toBe('none left');
    expect(placeItem(state, GREENHOUSE_ROOM, 'pedestal', 48, 64, PLAYER)).toBe('off the floor');
    expect(state.placed).toEqual([]);
  });

  it('debits one on placing and credits it back on picking up', () => {
    const state = stocked();
    const first = placed(placeItem(state, GREENHOUSE_ROOM, 'pedestal', 64, 64, PLAYER));
    const second = placed(placeItem(state, GREENHOUSE_ROOM, 'pedestal', 96, 64, PLAYER));
    expect(first).toEqual({ id: 0, kind: 'pedestal', room: 'greenhouse', x: 64, y: 64 });
    expect(second.id).toBe(1);
    expect(state.nextPlacedId).toBe(2);
    expect(state.inventory.pedestal).toBe(0);
    expect(state.placed).toEqual([first, second]);

    expect(pickUpItem(state, 0)).toBe('ok');
    expect(state.inventory.pedestal).toBe(1);
    expect(state.placed).toEqual([second]);
    expect(pickUpItem(state, 0)).toBe('not found');
  });

  it('refuses a pick-up while a tree is displayed on any of its spots', () => {
    const state = stocked();
    const shelf = placed(placeItem(state, GREENHOUSE_ROOM, 'floor_shelf', 64, 64, PLAYER));
    const tree = state.trees[0];
    if (tree === undefined) throw new Error('a new game has its starter tree');
    tree.location = DISPLAYED_PREFIX + `placed_${String(shelf.id)}_2`;
    expect(pickUpItem(state, shelf.id)).toBe('a tree is on it');
    expect(state.placed).toEqual([shelf]);
    expect(state.inventory.floor_shelf).toBe(0);
    tree.location = 'greenhouse';
    expect(pickUpItem(state, shelf.id)).toBe('ok');
  });

  it('pays display revenue for a tree on a placed pedestal', () => {
    const state = stocked();
    const pedestal = placed(placeItem(state, GREENHOUSE_ROOM, 'pedestal', 64, 64, PLAYER));
    const tree = state.trees[0];
    if (tree === undefined) throw new Error('a new game has its starter tree');
    const key = placedSpots(pedestal)[0]?.key ?? '';
    expect(pickUpTree(state, tree)).toBe(true);
    expect(placeTree(state, tree, key)).toBe(true);
    expect(tree.location).toBe('displayed:placed_0');
    const money = state.money;
    const revenue = advanceDayAllTrees(state, 1, () => 0.999);
    expect(revenue).toBeGreaterThan(0);
    expect(state.money).toBe(money + revenue);
  });
});

describe('placed furniture in the room', () => {
  function laidOut(): GameState {
    const state = createNewGameState();
    state.placed = [
      { id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 160 },
      { id: 1, kind: 'floor_shelf', room: 'greenhouse', x: 304, y: 160 },
      { id: 2, kind: 'pedestal', room: 'lounge', x: 96, y: 160 },
    ];
    state.nextPlacedId = 3;
    return state;
  }

  it("gives each spot of the room's items a prop centred on its tile, nothing for another room's", () => {
    const props = placedProps(laidOut(), GREENHOUSE_ROOM, false);
    expect(
      props.map((p) => [p.key, p.label, p.pedestalKey, p.placedId, p.x, p.y, p.w, p.h]),
    ).toEqual([
      ['placed_0', 'Pedestal', 'placed_0', 0, 248, 168, 16, 16],
      ['placed_1', 'Floor shelf', 'placed_1', 1, 312, 168, 16, 16],
      ['placed_1_2', 'Floor shelf', 'placed_1_2', 1, 328, 168, 16, 16],
    ]);
    expect(placedProps(laidOut(), SHED_ROOM, false)).toEqual([]);
  });

  it('prompts Pick up at an empty spot empty-handed, else Display', () => {
    const state = laidOut();
    expect(PICK_UP_PROMPT).toBe('Pick up');
    expect(DISPLAY_PROMPT).toBe('Display');
    expect(placedProps(state, GREENHOUSE_ROOM, false).map((p) => p.prompt)).toEqual([
      PICK_UP_PROMPT,
      PICK_UP_PROMPT,
      PICK_UP_PROMPT,
    ]);
    expect(placedProps(state, GREENHOUSE_ROOM, true).map((p) => p.prompt)).toEqual([
      DISPLAY_PROMPT,
      DISPLAY_PROMPT,
      DISPLAY_PROMPT,
    ]);
    const [tree] = state.trees;
    if (!tree) throw new Error('no starter tree');
    tree.location = `${DISPLAYED_PREFIX}placed_1_2`;
    expect(placedProps(state, GREENHOUSE_ROOM, false).map((p) => p.prompt)).toEqual([
      PICK_UP_PROMPT,
      PICK_UP_PROMPT,
      DISPLAY_PROMPT,
    ]);
  });

  it("draws the room's items as sorted walk-through furniture over their footprints", () => {
    expect(placedFurniture(laidOut(), GREENHOUSE_ROOM)).toEqual([
      { x: 240, y: 160, w: 16, h: 16, sheet: SHEETS.pedestal, solid: false, sorted: true },
      { x: 304, y: 160, w: 32, h: 16, sheet: SHEETS.floorShelf, solid: false, sorted: true },
    ]);
    expect(placedFurniture(laidOut(), SHED_ROOM)).toEqual([]);
  });
});
