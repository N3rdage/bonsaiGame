import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import { nearestInteractable } from './interactables';
import { SHED_ROOM } from './shedRoom';
import {
  FLOOR_GRID,
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
  it('halves the prototype floor grid: (340, 320), 64 by 80, five to a row', () => {
    expect(FLOOR_GRID).toEqual({ x: 170, y: 160, dx: 32, dy: 40, perRow: 5 });
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
    const state = stateWith('displayed:shed_window', 'displayed:shed_main', 'displayed:garden_1');
    const sprites = treeSprites(state, SHED_ROOM);
    expect(sprites.map((s) => [s.tree.id, s.pedestalKey, s.x, s.y, s.depth])).toEqual([
      [1, 'shed_main', 310, 77, 93.5],
      [0, 'shed_window', 350, 77, 93.5],
    ]);
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
    const state = stateWith('shed', 'displayed:shed_main');
    const targets = treeTargets(treeSprites(state, SHED_ROOM));
    expect(targets.map((t) => [t.key, t.prompt, t.x, t.y])).toEqual([
      ['tree:0', TREE_PROMPT, 170, 160],
    ]);
    expect(TREE_PROMPT).toBe('Inspect');
    const near = nearestInteractable({ x: 170, y: 140 }, [...SHED_ROOM.props, ...targets]);
    expect(near?.key).toBe('tree:0');
  });
});
