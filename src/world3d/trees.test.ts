import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { ROOMS } from '../world/gardenRoom';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import { SHED_ROOM, type Room } from '../world/shedRoom';
import { STUDY_ROOM } from '../world/studyRoom';
import { floorSpot, treeSprites } from '../world/treeSprites';
import { DESK_HEIGHT, MANTEL_HEIGHT, heightMetres, metres, roomPlan3d } from './plan';
import { spotMats, treeKey, treeStands } from './trees';

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

  it('stands the mantel tree at 0.8 m and the desk tree at 0.65 m', () => {
    const mantel = treeStands(stateWith('displayed:lounge_mantel'), LOUNGE_ROOM, 'spring');
    const desk = treeStands(stateWith('displayed:study_desk'), STUDY_ROOM, 'spring');
    expect(MANTEL_HEIGHT).toBe(0.8);
    expect(DESK_HEIGHT).toBe(0.65);
    expect(mantel[0]?.z).toBe(MANTEL_HEIGHT);
    expect(desk[0]?.z).toBe(DESK_HEIGHT);
  });

  it.each(Object.values(ROOMS).filter((room) => room.props.some((p) => p.pedestalKey)))(
    '$key: each displayed tree stands on the top of the box under it, not floating or inside it',
    (room) => {
      const spots = room.props.flatMap((p) => (p.pedestalKey ? [p.pedestalKey] : []));
      const stands = treeStands(
        stateWith(...spots.map((spot) => `displayed:${spot}`)),
        room,
        'spring',
      );
      expect(stands).toHaveLength(spots.length);
      const boxes = roomPlan3d(room).furniture.filter((b) => b.z1 - b.z0 > 0.1);
      for (const stand of stands) {
        const under = boxes.filter(
          (b) => b.x0 <= stand.x && stand.x < b.x1 && b.y0 <= stand.y && stand.y < b.y1,
        );
        expect(under.length).toBeGreaterThan(0);
        expect(stand.z).toBeCloseTo(Math.max(...under.map((b) => b.z1)), 9);
      }
    },
  );

  it('stands exactly the trees the 2D world draws, and none for an empty room', () => {
    const state = stateWith('displayed:lounge_mantel', 'lounge', 'displayed:lounge_side_table');
    expect(treeStands(state, LOUNGE_ROOM, 'spring').map((s) => s.tree.id)).toEqual(
      treeSprites(state, LOUNGE_ROOM).map((s) => s.tree.id),
    );
    expect(treeStands(stateWith(), LOUNGE_ROOM, 'spring')).toEqual([]);
  });
});

describe('spotMats', () => {
  const at = (room: Room, pedestalKey: string): { x: number; y: number } => {
    const spot = room.props.find((p) => p.pedestalKey === pedestalKey);
    if (!spot) throw new Error(`no spot ${pedestalKey}`);
    return { x: metres(spot.x), y: metres(spot.y) };
  };

  it('marks each empty spot of the lounge in the middle of the spot, on the top of its furniture', () => {
    const mats = spotMats(stateWith(), LOUNGE_ROOM);
    expect(mats).toEqual([
      { key: 'lounge_mantel', ...at(LOUNGE_ROOM, 'lounge_mantel'), z: MANTEL_HEIGHT },
      { key: 'lounge_side_table', ...at(LOUNGE_ROOM, 'lounge_side_table'), z: heightMetres(8) },
    ]);
  });

  it('marks each empty spot of the study on the desk and the bookcase', () => {
    expect(spotMats(stateWith(), STUDY_ROOM)).toEqual([
      { key: 'study_desk', ...at(STUDY_ROOM, 'study_desk'), z: DESK_HEIGHT },
      { key: 'study_bookshelf', ...at(STUDY_ROOM, 'study_bookshelf'), z: heightMetres(12) },
    ]);
  });

  it('marks no spot that holds a tree, and no room without spots', () => {
    const state = stateWith('displayed:lounge_side_table');
    expect(spotMats(state, LOUNGE_ROOM).map((m) => m.key)).toEqual(['lounge_mantel']);
    expect(
      spotMats(stateWith('displayed:lounge_mantel', 'displayed:lounge_side_table'), LOUNGE_ROOM),
    ).toEqual([]);
    expect(spotMats(stateWith(), SHED_ROOM)).toEqual([]);
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
