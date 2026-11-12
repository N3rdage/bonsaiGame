import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { DISPLAYED_PREFIX, pickUpTree, placeTree } from '../sim/tree';
import type { GameState, PlacedItem } from '../sim/types';
import { advanceDayAllTrees } from '../sim/world';
import { SHEETS } from './assets';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import {
  PLACEABLES,
  footprint,
  pickUpItem,
  placeItem,
  placedSpots,
  placementCheck,
  snapToGrid,
} from './placement';
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
    const door = GREENHOUSE_ROOM.props[0];
    if (door === undefined) throw new Error('the greenhouse has its door');
    const room: Room = {
      ...GREENHOUSE_ROOM,
      props: [{ ...door, x: 104, y: 104 }],
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
    expect(check(stocked(), 'pedestal', 240, 192)).toBe('too close');
    expect(check(stocked(), 'pedestal', 240, 208)).toBe('ok');
  });

  it('takes furniture only in the greenhouse', () => {
    const at = SHED_ROOM.bounds;
    const result = placementCheck(SHED_ROOM, stocked(), 'pedestal', at.x + 32, at.y + 32, PLAYER);
    expect(result).toBe('not here');
  });

  it('refuses none left with none in the inventory, after the spot check', () => {
    const state = createNewGameState();
    expect(state.inventory.pedestal).toBe(0);
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
