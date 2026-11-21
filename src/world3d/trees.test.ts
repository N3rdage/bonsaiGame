import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import { SHED_ROOM } from '../world/shedRoom';
import { floorSpot, treeSprites } from '../world/treeSprites';
import { heightMetres, metres } from './plan';
import { treeKey, treeStands } from './trees';

function stateWith(...locations: string[]): GameState {
  const state = createNewGameState();
  state.trees = locations.map((location, id) => ({
    ...createTree('juniper', 'cutting', id),
    location,
  }));
  return state;
}

describe('treeStands', () => {
  it('stands each floor tree where its sprite stands, in metres on the floor', () => {
    const stands = treeStands(stateWith('shed', 'lounge', 'shed'), SHED_ROOM, 'spring');
    expect(stands.map((s) => s.tree.id)).toEqual([0, 2]);
    const [first, second] = stands;
    expect([first?.x, first?.y, first?.z]).toEqual([
      metres(floorSpot(0, SHED_ROOM).x),
      metres(floorSpot(0, SHED_ROOM).y),
      0,
    ]);
    expect([second?.x, second?.y]).toEqual([
      metres(floorSpot(1, SHED_ROOM).x),
      metres(floorSpot(1, SHED_ROOM).y),
    ]);
  });

  it('stands a displayed tree on top of its furniture, in the middle of its spot, and skips an empty spot', () => {
    // The mantel (pedestal_1) is empty; the side table holds a tree; another stands on the lounge floor.
    const state = stateWith('displayed:lounge_side_table', 'lounge');
    const stands = treeStands(state, LOUNGE_ROOM, 'summer');
    expect(stands).toHaveLength(2);
    const spot = LOUNGE_ROOM.props.find((p) => p.pedestalKey === 'lounge_side_table');
    const onTable = stands.find((s) => s.tree.id === 0);
    expect(onTable?.x).toBeCloseTo(metres(spot?.x ?? NaN));
    expect(onTable?.y).toBeCloseTo(metres(spot?.y ?? NaN));
    expect(onTable?.z).toBeCloseTo(heightMetres(8));
    const onFloor = stands.find((s) => s.tree.id === 1);
    expect(onFloor?.z).toBe(0);
  });

  it('stands exactly the trees the 2D world draws, and none for an empty room', () => {
    const state = stateWith('displayed:lounge_mantel', 'lounge', 'displayed:lounge_side_table');
    expect(treeStands(state, LOUNGE_ROOM, 'spring').map((s) => s.tree.id)).toEqual(
      treeSprites(state, LOUNGE_ROOM).map((s) => s.tree.id),
    );
    expect(treeStands(stateWith(), LOUNGE_ROOM, 'spring')).toEqual([]);
  });
});

describe('treeKey', () => {
  const tree = createTree('juniper', 'cutting', 4);

  it('is stable for a tree that has not changed', () => {
    expect(treeKey(tree, 'spring')).toBe(treeKey({ ...tree }, 'spring'));
  });

  it.each([
    ['a morphology change (revision)', { revision: tree.revision + 1 }],
    ['growth in height', { trunk: { ...tree.trunk, heightCm: tree.trunk.heightCm + 1 } }],
    ['a new foliage density', { foliageDensity: tree.foliageDensity + 0.1 }],
    ['a new pot', { potTier: 1 as const }],
  ])('changes with %s', (_name, change) => {
    expect(treeKey({ ...tree, ...change }, 'spring')).not.toBe(treeKey(tree, 'spring'));
  });

  it('changes with the season and not with what the meshes do not read', () => {
    expect(treeKey(tree, 'autumn')).not.toBe(treeKey(tree, 'spring'));
    expect(treeKey({ ...tree, name: 'Renamed', location: 'lounge' }, 'spring')).toBe(
      treeKey(tree, 'spring'),
    );
  });
});
