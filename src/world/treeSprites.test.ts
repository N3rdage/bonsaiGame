import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, GameState, PlacedItem } from '../sim/types';
import { PLAYER_FEET, sheetPxPerLogical } from './assets';
import { ROOMS } from './gardenRoom';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { nearestInteractable } from './interactables';
import { HALLWAY_ROOM } from './hallwayRoom';
import { FIREPLACE, LOUNGE_ROOM, SIDE_TABLE } from './loungeRoom';
import { placedProps } from './placement';
import { PEDESTAL_EMPTY_LABEL, PEDESTAL_LABEL_DY } from './roomArt';
import { SHED_ROOM, hitsWall, insideWalls, type Room } from './shedRoom';
import { BOOKSHELF, DESK, STUDY_ROOM } from './studyRoom';
import {
  DISPLAY_LABEL_DEPTH,
  DISPLAY_LABEL_JOIN,
  displayLabels,
  type DisplayLabel,
  FLOOR_GRID,
  FLOOR_LAP_DEPTH,
  floorColumns,
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

  it('stands a displayed tree on the top of the furniture its spot is on, in front of it', () => {
    const state = stateWith(
      'displayed:lounge_side_table',
      'displayed:lounge_mantel',
      'displayed:study_desk',
      'displayed:study_bookshelf',
    );
    const at = (room: Room) =>
      treeSprites(state, room).map((s) => [s.tree.id, s.pedestalKey, s.x, s.y, s.depth]);
    // The mantel's shelf, the table top, the desk top and the bookcase's top, each spot's rect
    // top; each piece's front edge plus 0.5 for the depth, so in front of the piece's sprite.
    expect(at(LOUNGE_ROOM)).toEqual([
      [1, 'lounge_mantel', 240, 66, 88.5],
      [0, 'lounge_side_table', 168, 68, 80.5],
    ]);
    expect(at(STUDY_ROOM)).toEqual([
      [2, 'study_desk', 176, 60, 80.5],
      [3, 'study_bookshelf', 296, 65, 80.5],
    ]);
    for (const [room, piece, top] of [
      [LOUNGE_ROOM, FIREPLACE, 66],
      [LOUNGE_ROOM, SIDE_TABLE, 68],
      [STUDY_ROOM, DESK, 60],
      [STUDY_ROOM, BOOKSHELF, 65],
    ] as const) {
      const s = treeSprites(state, room).find((t) => t.y === top);
      // On the piece: across it, and on the top face its Inked sprite draws over its footprint's
      // depth, the sprite standing on the footprint's bottom edge.
      expect(s && s.x >= piece.x && s.x <= piece.x + piece.w).toBe(true);
      const spriteTop =
        piece.y + piece.h - piece.sheet.frameHeight / sheetPxPerLogical(piece.sheet);
      expect(top).toBeGreaterThan(spriteTop);
      expect(top).toBeLessThan(spriteTop + piece.h);
    }
  });

  it("keeps both of the grid's rows in every house room and only its middle three columns in the hallway, whose floor is 3 m wide", () => {
    for (const room of [SHED_ROOM, LOUNGE_ROOM, STUDY_ROOM, HALLWAY_ROOM]) {
      expect(floorRows(room), room.key).toEqual([160, 200]);
    }
    for (const room of [SHED_ROOM, LOUNGE_ROOM, STUDY_ROOM]) {
      expect(floorColumns(room), room.key).toEqual([170, 202, 234, 266, 298]);
    }
    expect(floorColumns(HALLWAY_ROOM)).toEqual([202, 234, 266]);
    const sprites = treeSprites(
      stateWith(...Array.from({ length: 7 }, () => 'hallway')),
      HALLWAY_ROOM,
    );
    expect(sprites.map(at)).toEqual([
      [202, 160],
      [234, 160],
      [266, 160],
      [202, 200],
      [234, 200],
      [266, 200],
      [202, 160],
    ]);
    expect(sprites[6]?.depth).toBeLessThan(sprites[0]?.depth ?? 0);
    // Every spot in every house room is on its floor, clear of the walls and the solid furniture.
    for (const room of [LOUNGE_ROOM, STUDY_ROOM, HALLWAY_ROOM]) {
      const floor = insideWalls(room);
      const spots = floorRows(room).length * floorColumns(room).length;
      for (let i = 0; i < spots; i += 1) {
        const { x, y } = floorSpot(i, room);
        expect(x > floor.x && x < floor.x + floor.w && y > floor.y && y <= floor.y + floor.h).toBe(
          true,
        );
        expect(hitsWall(room, x, y - 1), `${room.key} ${String(i)}`).toBe(false);
      }
    }
  });

  it('draws no displayed tree in the shed, which has no display spots', () => {
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

describe('display labels', () => {
  /** The greenhouse with `placed` down, as the scene's live room has it. */
  function greenhouse(state: GameState, ...placed: PlacedItem[]): Room {
    state.placed = placed;
    return {
      ...GREENHOUSE_ROOM,
      props: [...GREENHOUSE_ROOM.props, ...placedProps(state, GREENHOUSE_ROOM, false)],
    };
  }
  const pedestal: PlacedItem = { id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 128 };
  const shelf: PlacedItem = { id: 1, kind: 'floor_shelf', room: 'greenhouse', x: 288, y: 128 };
  const show = (labels: DisplayLabel[]) => labels.map((l) => [l.x, l.y, l.text, l.empty]);

  it('gives an empty floor shelf one `(empty)`, centred under both its spots', () => {
    const state = stateWith();
    const labels = displayLabels(state, greenhouse(state, shelf));
    // The spots' centres are 296 and 312, 16 px apart; their centre y is 136.
    expect(show(labels)).toEqual([[304, 136 + PEDESTAL_LABEL_DY, PEDESTAL_EMPTY_LABEL, true]]);
  });

  it("gives a shelf with one tree that tree's name alone, on either spot", () => {
    for (const key of ['placed_1', 'placed_1_2']) {
      const state = stateWith(`displayed:${key}`);
      expect(show(displayLabels(state, greenhouse(state, shelf)))).toEqual([
        [304, 151, 'T0', false],
      ]);
    }
  });

  it("joins a shelf's two trees' names, left spot first", () => {
    const state = stateWith('displayed:placed_1_2', 'displayed:placed_1');
    expect(show(displayLabels(state, greenhouse(state, shelf)))).toEqual([
      [304, 151, `T1${DISPLAY_LABEL_JOIN}T0`, false],
    ]);
  });

  it('gives a placed pedestal and a built-in pedestal one label each', () => {
    const state = stateWith('displayed:placed_0');
    expect(show(displayLabels(state, greenhouse(state, pedestal)))).toEqual([
      [248, 151, 'T0', false],
    ]);
    const spots = LOUNGE_ROOM.props.filter((p) => p.pedestalKey !== undefined);
    expect(spots).toHaveLength(2);
    expect(show(displayLabels(stateWith('displayed:lounge_mantel'), LOUNGE_ROOM))).toEqual(
      spots.map((p) => [
        p.x,
        p.y + PEDESTAL_LABEL_DY,
        p.pedestalKey === 'lounge_mantel' ? 'T0' : PEDESTAL_EMPTY_LABEL,
        p.pedestalKey !== 'lounge_mantel',
      ]),
    );
  });

  it("keeps a room's labels apart when a shelf's spots are 16 px apart", () => {
    // Caveat at the world label size: under 4 px a character, plus the plate's padding.
    const width = (l: DisplayLabel) => l.text.length * 4 + 4;
    const layouts = [[], ['displayed:placed_0'], ['displayed:placed_0', 'displayed:placed_1']];
    for (const trees of layouts) {
      const state = stateWith(...trees);
      const labels = displayLabels(state, greenhouse(state, pedestal, shelf));
      expect(labels).toHaveLength(2);
      const [a, b] = labels;
      if (!a || !b) throw new Error('two labels');
      expect(Math.abs(a.x - b.x)).toBeGreaterThan((width(a) + width(b)) / 2);
    }
  });

  it('draws the labels over the player and every sorted piece in any room', () => {
    const state = stateWith('displayed:placed_0');
    const labels = displayLabels(state, greenhouse(state, pedestal, shelf));
    expect(labels.every((l) => l.depth === DISPLAY_LABEL_DEPTH)).toBe(true);
    for (const room of Object.values(ROOMS)) {
      expect(DISPLAY_LABEL_DEPTH).toBeGreaterThan(room.bounds.y + room.bounds.h + PLAYER_FEET);
    }
  });
});
