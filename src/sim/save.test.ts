import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MemorySaveStorage,
  SAVE_SLOT_COUNT,
  SAVE_VERSION,
  deserializeSave,
  formatSaveTimestamp,
  importPrototypeSave,
  loadGame,
  mostRecentSaveSlot,
  saveGame,
  saveSlotMetadata,
  serializeState,
} from './save';
import { scoreTree } from './scoring';
import { createNewGameState } from './state';
import type { GameState } from './types';

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected a value');
  return v;
}

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
}

const DAY14 = fixture('prototype-save-v1-day14.json');
const DAY730 = fixture('prototype-save-v1-day730.json');
const NOW = new Date(2026, 0, 2, 3, 4);

function expectIntegerIds(state: GameState): void {
  expect(Number.isInteger(state.day)).toBe(true);
  expect(Number.isInteger(state.nextTreeId)).toBe(true);
  for (const t of state.trees) {
    expect(Number.isInteger(t.id)).toBe(true);
    expect(Number.isInteger(t.ageDays)).toBe(true);
    for (const b of t.branches) {
      expect(Number.isInteger(b.id)).toBe(true);
      expect(Number.isInteger(b.parentId)).toBe(true);
    }
    for (const w of t.wiresApplied) {
      expect(Number.isInteger(w.branchId)).toBe(true);
      expect(Number.isInteger(w.appliedDay)).toBe(true);
    }
  }
}

describe('constants', () => {
  it('match the spec', () => {
    expect(SAVE_VERSION).toBe(5);
    expect(SAVE_SLOT_COUNT).toBe(3);
  });
});

describe('formatSaveTimestamp', () => {
  it('zero-pads every field', () => {
    expect(formatSaveTimestamp(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04');
    expect(formatSaveTimestamp(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59');
  });
});

describe('v5 round trip', () => {
  it('is deep-equal and does not alias the original', () => {
    const state = createNewGameState();
    must(state.trees[0]).trunk.movement.push({ y: 5, angleDeg: 90 });
    const text = serializeState(state, NOW);
    expect(JSON.parse(text)).toMatchObject({
      version: 5,
      savedAt: '2026-01-02 03:04',
      seasonTipShown: false,
      placed: [],
      nextPlacedId: 0,
    });
    const loaded = deserializeSave(text);
    expect(loaded).toEqual(state);
    expect(loaded.trees).not.toBe(state.trees);
    expect(loaded.trees[0]).not.toBe(state.trees[0]);
    expect(loaded.inventory).not.toBe(state.inventory);
    must(must(loaded.trees[0]).branches[0]).length = 999;
    expect(must(must(state.trees[0]).branches[0]).length).not.toBe(999);
  });

  it('round-trips through saveGame/loadGame', () => {
    const storage = new MemorySaveStorage();
    const state = createNewGameState();
    expect(loadGame(storage, 2)).toBeUndefined();
    saveGame(storage, state, 2, NOW);
    expect(loadGame(storage, 2)).toEqual(state);
    storage.remove(2);
    expect(loadGame(storage, 2)).toBeUndefined();
  });

  it('never writes paused and always loads unpaused', () => {
    const state = createNewGameState();
    expect(state.paused).toBe(false);
    state.paused = true;
    const text = serializeState(state, NOW);
    expect(JSON.parse(text)).not.toHaveProperty('paused');
    const loaded = deserializeSave(text);
    expect(loaded.paused).toBe(false);
    expect(loaded).toEqual({ ...state, paused: false });
  });

  it('tolerates a trailing NUL byte', () => {
    const state = createNewGameState();
    expect(deserializeSave(serializeState(state, NOW) + '\0')).toEqual(state);
  });

  it('keeps seasonTipShown once the tip has fired', () => {
    const state = createNewGameState();
    state.seasonTipShown = true;
    expect(deserializeSave(serializeState(state, NOW)).seasonTipShown).toBe(true);
  });

  it('keeps the placed furniture and the next id', () => {
    const state = createNewGameState();
    state.placed = [
      { id: 0, kind: 'pedestal', room: 'greenhouse', x: 64, y: 64 },
      { id: 2, kind: 'floor_shelf', room: 'greenhouse', x: 96, y: 160 },
    ];
    state.nextPlacedId = 3;
    must(state.trees[0]).location = 'displayed:placed_2_2';
    const loaded = deserializeSave(serializeState(state, NOW));
    expect(loaded).toEqual(state);
    expect(loaded.placed[0]).not.toBe(state.placed[0]);
  });

  it('coerces placed items and refuses an unknown kind', () => {
    const file = JSON.parse(serializeState(createNewGameState(), NOW)) as Record<string, unknown>;
    const item = { id: 1.0, kind: 'pedestal', room: 'greenhouse', x: '80', y: 96.0 };
    const loaded = deserializeSave(JSON.stringify({ ...file, placed: [item], nextPlacedId: 2.0 }));
    expect(loaded.placed).toEqual([{ id: 1, kind: 'pedestal', room: 'greenhouse', x: 80, y: 96 }]);
    expect(loaded.nextPlacedId).toBe(2);
    const bad = JSON.stringify({ ...file, placed: [{ ...item, kind: 'throne' }] });
    expect(() => deserializeSave(bad)).toThrow(/throne/);
  });

  it('refuses a duplicate placed id and keeps nextPlacedId above every id', () => {
    const file = JSON.parse(serializeState(createNewGameState(), NOW)) as Record<string, unknown>;
    const at = (id: number) => ({
      id,
      kind: 'pedestal',
      room: 'greenhouse',
      x: 64 + id * 16,
      y: 64,
    });
    const dup = JSON.stringify({ ...file, placed: [at(1), at(1)], nextPlacedId: 2 });
    expect(() => deserializeSave(dup)).toThrow('Save v5: duplicate placed id 1');
    const load = (nextPlacedId: number) =>
      deserializeSave(JSON.stringify({ ...file, placed: [at(0), at(4)], nextPlacedId }));
    expect(load(2).nextPlacedId).toBe(5);
    expect(load(9).nextPlacedId).toBe(9);
  });
});

/** A save of `version` whose trees stand at `locations`, otherwise a new game's; before 5, without the placed furniture. */
function savedWith(version: number, ...locations: string[]): string {
  const state = createNewGameState();
  const starter = must(state.trees[0]);
  state.trees = locations.map((location, id) => ({ ...structuredClone(starter), id, location }));
  state.nextTreeId = locations.length;
  const file = JSON.parse(serializeState(state, NOW)) as Record<string, unknown>;
  if (version < 5) {
    delete file.placed;
    delete file.nextPlacedId;
  }
  return JSON.stringify({ ...file, version });
}

describe('v4 -> v5 migration', () => {
  it('loads a version-4 save with no placed furniture', () => {
    const text = savedWith(4, 'shed', 'displayed:lounge_mantel');
    expect(JSON.parse(text)).not.toHaveProperty('placed');
    const loaded = deserializeSave(text);
    expect(loaded.placed).toEqual([]);
    expect(loaded.nextPlacedId).toBe(0);
    expect(locationsOf(loaded)).toEqual(['shed', 'displayed:lounge_mantel']);
  });

  it('loads every older version and the prototype saves with no placed furniture', () => {
    for (const text of [savedWith(2), savedWith(3), DAY14, DAY730]) {
      const loaded = deserializeSave(text);
      expect([loaded.placed, loaded.nextPlacedId]).toEqual([[], 0]);
      expect([loaded.inventory.pedestal, loaded.inventory.floor_shelf]).toEqual([0, 0]);
    }
  });
});

const locationsOf = (state: GameState): string[] => state.trees.map((t) => t.location);

describe('v3 -> v4 migration', () => {
  it('moves the shed pedestals to the lounge and renames the house display keys', () => {
    const loaded = deserializeSave(
      savedWith(3, 'shed', 'displayed:shed_main', 'displayed:study_window', 'inventory'),
    );
    expect(locationsOf(loaded)).toEqual([
      'shed',
      'displayed:lounge_mantel',
      'displayed:study_bookshelf',
      'inventory',
    ]);
  });

  it('maps every old key through one table', () => {
    const old = ['lounge_main', 'lounge_window', 'study_main', 'study_window'];
    expect(locationsOf(deserializeSave(savedWith(3, ...old.map((k) => `displayed:${k}`))))).toEqual(
      [
        'displayed:lounge_mantel',
        'displayed:lounge_side_table',
        'displayed:study_desk',
        'displayed:study_bookshelf',
      ],
    );
    expect(
      locationsOf(deserializeSave(savedWith(3, 'displayed:shed_window', 'displayed:garden_1'))),
    ).toEqual(['displayed:lounge_side_table', 'displayed:garden_1']);
  });

  it("keeps a lounge tree on its spot and puts the shed's down on the shed floor", () => {
    const loaded = deserializeSave(
      savedWith(3, 'displayed:shed_main', 'displayed:lounge_main', 'displayed:shed_window'),
    );
    expect(locationsOf(loaded)).toEqual([
      'shed',
      'displayed:lounge_mantel',
      'displayed:lounge_side_table',
    ]);
  });

  it('migrates a version-2 save too', () => {
    expect(locationsOf(deserializeSave(savedWith(2, 'displayed:shed_main')))).toEqual([
      'displayed:lounge_mantel',
    ]);
  });

  it('round-trips a version-4 save with every final key as written', () => {
    const final = ['lounge_mantel', 'lounge_side_table', 'study_desk', 'study_bookshelf'];
    const text = savedWith(4, 'shed', ...final.map((k) => `displayed:${k}`));
    const loaded = deserializeSave(text);
    expect(locationsOf(loaded)).toEqual(['shed', ...final.map((k) => `displayed:${k}`)]);
    expect(JSON.parse(serializeState(loaded, NOW))).toEqual({
      ...(JSON.parse(text) as Record<string, unknown>),
      version: 5,
      placed: [],
      nextPlacedId: 0,
    });
  });

  it('leaves the old keys alone in a version-4 save', () => {
    expect(locationsOf(deserializeSave(savedWith(4, 'displayed:shed_main')))).toEqual([
      'displayed:shed_main',
    ]);
  });
});

describe('v2 -> v3 migration', () => {
  it('reads a version-2 save as it was, with seasonTipShown false so the tip can still fire', () => {
    const state = createNewGameState();
    state.day = 40;
    state.tutorialStep = -1;
    const v5 = JSON.parse(serializeState(state, NOW)) as Record<string, unknown>;
    const { seasonTipShown, placed, nextPlacedId, ...rest } = v5;
    expect([placed, nextPlacedId]).toEqual([[], 0]);
    expect(seasonTipShown).toBe(false);
    const v2 = JSON.stringify({ ...rest, version: 2 });
    expect(deserializeSave(v2)).toEqual(state);
    // Even a v2 save carrying a stray `seasonTipShown: true` predates the field.
    expect(
      deserializeSave(JSON.stringify({ ...rest, version: 2, seasonTipShown: true })).seasonTipShown,
    ).toBe(false);
  });

  it('imports prototype saves with seasonTipShown false', () => {
    expect(deserializeSave(DAY14).seasonTipShown).toBe(false);
    expect(deserializeSave(DAY730).seasonTipShown).toBe(false);
  });
});

describe('deserializeSave version dispatch', () => {
  it('throws on an unknown version, naming it', () => {
    expect(() => deserializeSave('{"version":6,"trees":[]}')).toThrow(/6/);
    expect(() => deserializeSave('{"trees":[]}')).toThrow(/version/);
  });

  it('rejects malformed prototype saves descriptively', () => {
    expect(() => importPrototypeSave({ version: 1, trees: {} })).toThrow(/trees/);
    expect(() => importPrototypeSave({ version: 1, trees: [{ id: 0 }] })).toThrow(/species_key/);
    expect(() => importPrototypeSave(null)).toThrow();
  });
});

describe('prototype import: day 14', () => {
  const state = deserializeSave(DAY14 + '\0');

  it('reads the header', () => {
    expect(state.day).toBe(14);
    expect(state.money).toBe(132);
    expect(state.nextTreeId).toBe(10);
    expect(state.tutorialStep).toBe(-1);
    expect(state.inventory.soil_premium).toBe(0);
    expect(state.inventory.wire).toBe(3);
    expect(state.inventory.seed_pine).toBe(0);
    expect(state.trees).toHaveLength(2);
    expect(state.paused).toBe(false);
    expectIntegerIds(state);
  });

  it('migrates fields the early save lacks', () => {
    for (const t of state.trees) {
      expect(t.soilTier).toBe(0);
      expect(t.lastRepotDay).toBe(0);
      expect(t.revision).toBe(0);
      for (const b of t.branches) expect(b.bendV).toBe(0);
    }
  });

  it('maps tree fields', () => {
    const [t0, t1] = state.trees;
    expect(t0?.trunk.movement).toHaveLength(7);
    expect(t0?.targetStyle).toBe('cascade');
    expect(t0?.name).toBe('Starter');
    expect(t0?.origin).toBe('seed');
    expect(t0?.vitality).toBe(85);
    expect(t0?.branches).toHaveLength(5);
    expect(t0?.branches[0]).toMatchObject({ id: 0, parentId: -1, angle: 30, originY: 8 });
    expect(t1?.potTier).toBe(1);
    expect(t1?.targetStyle).toBe('');
  });

  it("moves the tree on the prototype's shed_window to the lounge's side table", () => {
    expect(locationsOf(state)).toEqual(['shed', 'displayed:lounge_side_table']);
    const direct = importPrototypeSave(JSON.parse(DAY14) as unknown);
    expect(locationsOf(direct)).toEqual(['shed', 'displayed:lounge_side_table']);
  });
});

describe('prototype import: day 730', () => {
  const state = deserializeSave(DAY730);

  it('reads the mature save', () => {
    expect(state.day).toBe(730);
    expect(state.money).toBe(3768);
    expect(state.trees).toHaveLength(2);
    expect(state.trees.map((t) => t.branches.length)).toEqual([15, 15]);
    expect(state.trees.map((t) => t.wiresApplied.length)).toEqual([18, 17]);
    expect(state.trees.map((t) => t.soilTier)).toEqual([1, 1]);
    expect(state.inventory.soil_premium).toBe(3);
    expect(state.inventory.seed_pine).toBe(0);
    expect(state.paused).toBe(false);
    expectIntegerIds(state);
  });

  it('scores every imported tree as an integer in 0..100', () => {
    for (const t of state.trees) {
      const { total } = scoreTree(t);
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it("moves both trees off the prototype's shed pedestals to the lounge's", () => {
    expect(locationsOf(state)).toEqual(['displayed:lounge_side_table', 'displayed:lounge_mantel']);
  });

  it('survives a v5 round trip unchanged', () => {
    expect(deserializeSave(serializeState(state, NOW))).toEqual(state);
  });
});

describe('slot metadata', () => {
  it('reads v1 and v5 headers', () => {
    const storage = new MemorySaveStorage();
    storage.write(1, DAY14 + '\0');
    saveGame(storage, createNewGameState(), 2, NOW);
    expect(saveSlotMetadata(storage, 1)).toEqual({
      slot: 1,
      day: 14,
      money: 132,
      savedAt: '2026-05-08 20:13',
      version: 1,
    });
    expect(saveSlotMetadata(storage, 2)).toEqual({
      slot: 2,
      day: 0,
      money: 100,
      savedAt: '2026-01-02 03:04',
      version: 5,
    });
    expect(saveSlotMetadata(storage, 3)).toBeUndefined();
  });

  it('gives an empty savedAt when the field is missing', () => {
    const storage = new MemorySaveStorage();
    storage.write(1, '{"version":1,"game_day":3,"money":5,"trees":[]}');
    expect(saveSlotMetadata(storage, 1)?.savedAt).toBe('');
  });
});

describe('mostRecentSaveSlot', () => {
  const at = (savedAt: string) =>
    `{"version":2,"day":1,"money":0,"trees":[],"savedAt":"${savedAt}"}`;

  it('is -1 with no saves', () => {
    expect(mostRecentSaveSlot(new MemorySaveStorage())).toBe(-1);
  });

  it('picks the latest timestamp', () => {
    const s = new MemorySaveStorage();
    s.write(1, at('2026-01-01 10:00'));
    s.write(2, at('2026-03-01 09:00'));
    s.write(3, at('2026-02-01 23:59'));
    expect(mostRecentSaveSlot(s)).toBe(2);
  });

  it('counts an empty-savedAt save when it is the only one, but a timestamp beats it', () => {
    const s = new MemorySaveStorage();
    s.write(2, at(''));
    expect(mostRecentSaveSlot(s)).toBe(2);
    s.write(3, at('2026-01-01 00:00'));
    expect(mostRecentSaveSlot(s)).toBe(3);
  });

  it('keeps the first slot on a tie, including two empty timestamps', () => {
    const s = new MemorySaveStorage();
    s.write(1, at(''));
    s.write(3, at(''));
    expect(mostRecentSaveSlot(s)).toBe(1);
    const t = new MemorySaveStorage();
    t.write(2, at('2026-01-01 00:00'));
    t.write(3, at('2026-01-01 00:00'));
    expect(mostRecentSaveSlot(t)).toBe(2);
  });
});
