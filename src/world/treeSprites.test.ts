import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import { nearestInteractable } from './interactables';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { SHED_ROOM, insideWalls } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import {
  FLOOR_GRID,
  FLOOR_LAP_DEPTH,
  floorRows,
  floorSpot,
  SPRITE_MAX_PX,
  SPRITE_MIN_PX,
  TREE_PROMPT,
  spriteSize,
  treeLabel,
  treeSprites,
  treeTargets,
} from './treeSprites';

function stateWith(...locations: string[]): GameState {
  const state = createNewGameState();
  state.trees = locations.map((location, id) => ({
    ...createTree('juniper', 'cutting', id),
    name: `T${String(id)}`,
    location,
  }));
  return state;
}

const at = (s: { x: number; y: number }) => [s.x, s.y];

describe('tree sprites', () => {
  it('halves the prototype floor grid: (340, 320), 64 by 80, five to a row, two rows', () => {
    expect(FLOOR_GRID).toEqual({ x: 170, y: 160, dx: 32, dy: 40, perRow: 5, rows: 2 });
  });

  it('keeps both rows inside the shed walls; a third, as the prototype drew it, would be outside', () => {
    const inside = insideWalls(SHED_ROOM);
    const last = floorSpot(9);
    expect(last).toEqual({ x: 298, y: 200, depth: 200 });
    expect(last.x + FLOOR_GRID.dx).toBeLessThan(inside.x + inside.w);
    expect(last.y).toBeLessThan(inside.y + inside.h);
    // Other_4's third row, prototype y 480, is below the bottom wall (SHED_Y1 416).
    expect(FLOOR_GRID.y + 2 * FLOOR_GRID.dy).toBeGreaterThan(SHED_ROOM.walls[1]?.y ?? 0);
  });

  it('wraps the eleventh floor tree onto the first spot, behind the tree there, which E reaches', () => {
    const state = stateWith(...Array.from({ length: 12 }, () => 'shed'));
    const sprites = treeSprites(state, SHED_ROOM);
    expect(sprites).toHaveLength(12);
    expect(sprites.slice(10).map((s) => [s.tree.id, s.x, s.y])).toEqual([
      [10, 170, 160],
      [11, 202, 160],
    ]);
    expect(sprites[10]?.depth).toBeLessThan(sprites[0]?.depth ?? 0);
    expect(floorSpot(20)).toEqual({ x: 170, y: 160, depth: 160 - 2 * FLOOR_LAP_DEPTH });
    const near = nearestInteractable({ x: 170, y: 150 }, treeTargets(sprites));
    expect(near?.key).toBe('tree:0');
  });

  it('puts the i-th floor tree at grid spot i, in state order', () => {
    const state = stateWith('shed', 'sold', 'shed', 'shed', 'shed', 'shed', 'shed');
    const sprites = treeSprites(state, SHED_ROOM);
    expect(sprites.map((s) => s.tree.id)).toEqual([0, 2, 3, 4, 5, 6]);
    expect(sprites.map(at)).toEqual([
      [170, 160],
      [202, 160],
      [234, 160],
      [266, 160],
      [298, 160],
      [170, 200],
    ]);
    expect(sprites.every((s) => s.pedestalKey === undefined && s.depth === s.y)).toBe(true);
  });

  it('stands a displayed tree on its pedestal top, in front of the pedestal', () => {
    const state = stateWith(
      'displayed:lounge_side_table',
      'displayed:lounge_mantel',
      'displayed:study_desk',
    );
    const sprites = treeSprites(state, LOUNGE_ROOM);
    expect(sprites.map((s) => [s.tree.id, s.pedestalKey, s.x, s.y, s.depth])).toEqual([
      [1, 'lounge_mantel', 68, 104, 120.5],
      [0, 'lounge_side_table', 412, 104, 120.5],
    ]);
  });

  it("keeps only the grid's second row in the hallway, whose corridor floor is too low for the first", () => {
    expect(floorRows(SHED_ROOM)).toEqual([160, 200]);
    expect(floorRows(LOUNGE_ROOM)).toEqual([160, 200]);
    expect(floorRows(STUDY_ROOM)).toEqual([160, 200]);
    expect(floorRows(HALLWAY_ROOM)).toEqual([200]);
    const sprites = treeSprites(
      stateWith(...Array.from({ length: 6 }, () => 'hallway')),
      HALLWAY_ROOM,
    );
    expect(sprites.map(at)).toEqual([
      [170, 200],
      [202, 200],
      [234, 200],
      [266, 200],
      [298, 200],
      [170, 200],
    ]);
    expect(sprites[5]?.depth).toBeLessThan(sprites[0]?.depth ?? 0);
  });

  it('draws no displayed tree in the shed, which has no pedestals', () => {
    expect(treeSprites(stateWith('displayed:lounge_mantel'), SHED_ROOM)).toEqual([]);
  });

  it('leaves out carried, sold and other-room trees', () => {
    const state = stateWith('inventory', 'sold', 'garden', 'displayed:elsewhere');
    expect(treeSprites(state, SHED_ROOM)).toEqual([]);
  });

  it('draws the new game starter at the first spot, labelled with its name', () => {
    const [starter] = treeSprites(createNewGameState(), SHED_ROOM);
    expect(starter?.label).toBe("Granny's");
    expect(starter && at(starter)).toEqual([170, 160]);
  });

  it('scales the sprite from trunk height: 25 cm is 24 px, clamped', () => {
    expect(spriteSize(25)).toBe(24);
    expect(spriteSize(12.5)).toBe(12);
    expect(spriteSize(8)).toBe(SPRITE_MIN_PX);
    expect(spriteSize(2)).toBe(12);
    expect(spriteSize(50)).toBe(48);
    expect(spriteSize(200)).toBe(SPRITE_MAX_PX);
  });

  it('labels an unnamed tree with its species display name', () => {
    const tree: BonsaiTree = createTree('maple', 'seed', 0);
    expect(treeLabel(tree)).toBe('Japanese Maple');
    expect(treeLabel({ ...tree, name: 'Kaede' })).toBe('Kaede');
  });

  it('makes floor trees interactables that prompt Inspect; displayed ones are not', () => {
    const state = stateWith('lounge', 'displayed:lounge_mantel');
    const targets = treeTargets(treeSprites(state, LOUNGE_ROOM));
    expect(targets.map((t) => [t.key, t.prompt, t.x, t.y])).toEqual([
      ['tree:0', TREE_PROMPT, 170, 160],
    ]);
    expect(TREE_PROMPT).toBe('Inspect');
    const near = nearestInteractable({ x: 170, y: 140 }, [...LOUNGE_ROOM.props, ...targets]);
    expect(near?.key).toBe('tree:0');
  });
});
