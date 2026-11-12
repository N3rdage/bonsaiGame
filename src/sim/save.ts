/**
 * Save/load: versioned JSON save files behind a pluggable SaveStorage.
 *
 * Ported from archive/gamemaker/scripts/scr_save_load/scr_save_load.gml.
 * Version 1 is the GameMaker prototype's snake_case shape (every number written
 * as a float, plus a trailing NUL byte); `importPrototypeSave` converts it to
 * the TS model. Version 2 is this port's camelCase shape; version 3 adds
 * `seasonTipShown`, read as false from older saves; version 4 (`SaveFileV4`)
 * is version 3 with the display spots' final keys (`PRE_V4_DISPLAY_KEYS`);
 * version 5 (`SaveFileV5`) adds the placed furniture (`placed`, `nextPlacedId`),
 * read as none from older saves.
 * Storage is injected (MemorySaveStorage here, localStorage in src/platform)
 * so this module stays free of DOM APIs.
 */

import { createInventory } from './inventory';
import { SPECIES_KEYS } from './species';
import { STYLE_KEYS } from './styles';
import { DISPLAYED_PREFIX, createTree } from './tree';
import { tutorialStepFromSave } from './tutorial';
import type {
  BonsaiTree,
  Branch,
  ClipRecord,
  GameState,
  Inventory,
  InventoryKey,
  Origin,
  PlaceableKind,
  PlacedItem,
  PruneRecord,
  RepotRecord,
  SpeciesKey,
  StyleKey,
  TrunkMovement,
  WireRecord,
} from './types';

export const SAVE_VERSION = 5;
export const SAVE_SLOT_COUNT = 3;

/**
 * The shape `serializeState` writes. Version 4 was the same without `placed`
 * and `nextPlacedId`; version 3 was version 4 with the old display keys;
 * version 2 was version 3 without `seasonTipShown`.
 */
export interface SaveFileV5 {
  version: 5;
  savedAt: string;
  day: number;
  money: number;
  inventory: Inventory;
  trees: BonsaiTree[];
  nextTreeId: number;
  tutorialStep: number;
  seasonTipShown: boolean;
  placed: PlacedItem[];
  nextPlacedId: number;
}

export interface SaveStorage {
  /** The stored text, or undefined when the slot is empty or storage is unavailable. */
  read(slot: number): string | undefined;
  /** Throws when the write cannot be completed; callers surface that to the player. */
  write(slot: number, text: string): void;
  remove(slot: number): void;
}

/** In-memory storage for tests and headless runs. */
export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<number, string>();

  read(slot: number): string | undefined {
    return this.slots.get(slot);
  }

  write(slot: number, text: string): void {
    this.slots.set(slot, text);
  }

  remove(slot: number): void {
    this.slots.delete(slot);
  }
}

export interface SaveSlotMetadata {
  slot: number;
  day: number;
  money: number;
  savedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Serialisation

function pad2(n: number): string {
  return n < 10 ? `0${String(n)}` : String(n);
}

/** "YYYY-MM-DD HH:MM" in local time, so lexicographic order is chronological. */
export function formatSaveTimestamp(date: Date): string {
  return (
    `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/** Writes a version-5 save. `state.paused` is transient and never written; loads start unpaused. */
export function serializeState(state: GameState, now: Date): string {
  const file: SaveFileV5 = {
    version: SAVE_VERSION,
    savedAt: formatSaveTimestamp(now),
    day: state.day,
    money: state.money,
    inventory: state.inventory,
    trees: state.trees,
    nextTreeId: state.nextTreeId,
    tutorialStep: state.tutorialStep,
    seasonTipShown: state.seasonTipShown,
    placed: state.placed,
    nextPlacedId: state.nextPlacedId,
  };
  // The JSON text is the deep copy: nothing read back from it aliases `state`.
  return JSON.stringify(file);
}

/** Strip the trailing NUL byte(s) the prototype's fixed-size buffer wrote. */
function stripNul(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0) end--;
  return text.slice(0, end);
}

function parseSaveText(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(stripNul(text));
  if (!isRecord(parsed)) throw new Error('Save file is not a JSON object');
  return parsed;
}

export function deserializeSave(text: string): GameState {
  const raw = parseSaveText(text);
  // GameMaker writes the prototype's version as 1.0; Number() compares it as 1.
  const version = Number(raw.version);
  if (version === 1) return importPrototypeSave(raw);
  if (version === 2) return migrateDisplayKeys(readV2Save(raw));
  if (version === 3) return migrateDisplayKeys(readV3Save(raw));
  if (version === 4) return readV4Save(raw);
  if (version === 5) return readV5Save(raw);
  throw new Error(`Unsupported save version: ${String(raw.version)}`);
}

// ---------------------------------------------------------------------------
// Coercion helpers

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

/** Number(v), or `fallback` when missing or not numeric. */
function num(v: unknown, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Integer coercion for ids, counts and days (GameMaker writes them as floats). */
function int(v: unknown, fallback: number): number {
  return Math.round(num(v, fallback));
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown): boolean {
  return v === true || (typeof v === 'number' && v !== 0);
}

function tier(v: unknown, fallback: 0 | 1 = 0): 0 | 1 {
  return int(v, fallback) === 1 ? 1 : 0;
}

/** Map an array field if present; otherwise keep the existing value. */
function mapArray<T>(v: unknown, existing: T[], fn: (r: Record<string, unknown>) => T): T[] {
  return Array.isArray(v) ? (v as unknown[]).map((item) => fn(asRecord(item))) : existing;
}

function speciesKey(v: unknown, where: string): SpeciesKey {
  const key = SPECIES_KEYS.find((k) => k === v);
  if (key === undefined) throw new Error(`${where}: unknown species_key ${String(v)}`);
  return key;
}

function origin(v: unknown): Origin {
  return v === 'seed' ? 'seed' : 'cutting';
}

function styleKey(v: unknown): StyleKey | '' {
  return STYLE_KEYS.find((k) => k === v) ?? '';
}

/**
 * Saved counts over an all-zero inventory. The prototype replaced the whole
 * inventory struct on load and read absent keys as 0, so a key an old save
 * lacks (e.g. `soil_premium` before premium soil existed) must be 0, never
 * the new-game starting stock.
 */
function mergeInventory(v: unknown): Inventory {
  const inv = createInventory();
  const src = asRecord(v);
  for (const k of Object.keys(inv) as InventoryKey[]) {
    inv[k] = int(src[k], 0);
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Tree coercion, shared by every save version

/** snake_case -> camelCase, applied recursively to keys (values untouched). */
function camelizeKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(camelizeKeys);
  if (!isRecord(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = camelizeKeys(val);
  }
  return out;
}

/**
 * Build a tree from a camelCase record, starting from `createTree`'s defaults
 * and overwriting only the fields the record carries (the GML load loop's
 * field copy, made strict). Every save version goes through here, so a field
 * added to BonsaiTree later needs no per-version migration: older saves simply
 * keep the constructor default. Unknown species throw; unknown styles become ''.
 */
function coerceTree(data: unknown, where: string): BonsaiTree {
  if (!isRecord(data)) throw new Error(`${where} is not an object`);
  if (!('speciesKey' in data)) throw new Error(`${where} lacks speciesKey (species_key)`);
  const t = createTree(speciesKey(data.speciesKey, where), origin(data.origin), int(data.id, 0));

  t.name = str(data.name, t.name);
  t.ageDays = int(data.ageDays, t.ageDays);
  t.vitality = num(data.vitality, t.vitality);
  t.vigor = num(data.vigor, t.vigor);
  t.waterLevel = num(data.waterLevel, t.waterLevel);
  t.lastWateredDay = int(data.lastWateredDay, t.lastWateredDay);
  t.lastFedDay = int(data.lastFedDay, t.lastFedDay);
  t.fertilizedUntilDay = int(data.fertilizedUntilDay, t.fertilizedUntilDay);
  t.potTier = tier(data.potTier, t.potTier);
  t.soilTier = tier(data.soilTier, t.soilTier);
  t.lastRepotDay = int(data.lastRepotDay, t.lastRepotDay);
  t.location = str(data.location, t.location);
  t.timeAccel = num(data.timeAccel, t.timeAccel);
  t.foliageDensity = num(data.foliageDensity, t.foliageDensity);
  if ('targetStyle' in data) t.targetStyle = styleKey(data.targetStyle);
  if (Array.isArray(data.styleTags)) {
    t.styleTags = (data.styleTags as unknown[]).map((v) => String(v));
  }

  if (isRecord(data.trunk)) {
    const tr = data.trunk;
    t.trunk.heightCm = num(tr.heightCm, t.trunk.heightCm);
    t.trunk.girthMm = num(tr.girthMm, t.trunk.girthMm);
    t.trunk.taper = num(tr.taper, t.trunk.taper);
    t.trunk.movement = mapArray(tr.movement, t.trunk.movement, (r): TrunkMovement => ({
      y: num(r.y, 0),
      angleDeg: num(r.angleDeg, 0),
    }));
  }

  t.branches = mapArray(data.branches, t.branches, (r): Branch => ({
    id: int(r.id, 0),
    parentId: int(r.parentId, -1),
    originY: num(r.originY, 0),
    angle: num(r.angle, 0),
    length: num(r.length, 0),
    girth: num(r.girth, 0),
    wired: bool(r.wired),
    bend: num(r.bend, 0),
    bendV: num(r.bendV, 0), // pre-bend_v prototype saves migrate to 0
  }));
  t.wiresApplied = mapArray(data.wiresApplied, t.wiresApplied, (r): WireRecord => ({
    branchId: int(r.branchId, 0),
    appliedDay: int(r.appliedDay, 0),
    removedDay: int(r.removedDay, -1),
    bendTarget: num(r.bendTarget, 0),
    bendTargetV: num(r.bendTargetV, 0),
  }));
  t.clipsHistory = mapArray(data.clipsHistory, t.clipsHistory, (r): ClipRecord => ({
    branchId: int(r.branchId, 0),
    day: int(r.day, 0),
    amount: num(r.amount, 0),
  }));
  t.prunesHistory = mapArray(data.prunesHistory, t.prunesHistory, (r): PruneRecord => ({
    branchId: int(r.branchId, 0),
    day: int(r.day, 0),
  }));
  t.repotsHistory = mapArray(data.repotsHistory, t.repotsHistory, (r): RepotRecord => ({
    day: int(r.day, 0),
    toTier: tier(r.toTier),
    soilTier: tier(r.soilTier),
  }));

  // Render-cache counter; carried through so a round trip is exact, 0 for prototype saves.
  t.revision = int(data.revision, 0);
  return t;
}

function coerceTrees(trees: unknown, where: string): BonsaiTree[] {
  if (!Array.isArray(trees)) throw new Error(`${where}: trees is not an array`);
  return (trees as unknown[]).map((d, i) => coerceTree(d, `${where} tree ${String(i)}`));
}

// ---------------------------------------------------------------------------
// Version 1: the GameMaker prototype (snake_case; camelized, then coerced)

/** Convert a parsed prototype (version 1) save into the TS model. */
export function importPrototypeSave(raw: unknown): GameState {
  if (!isRecord(raw)) throw new Error('Prototype save is not an object');
  const trees = coerceTrees(camelizeKeys(raw.trees), 'Prototype save');
  return migrateDisplayKeys({
    day: int(raw.game_day, 0),
    money: num(raw.money, 0),
    inventory: mergeInventory(raw.inventory),
    trees,
    nextTreeId: int(raw.next_tree_id, 0),
    tutorialStep: tutorialStepFromSave(
      raw.tutorial_step === undefined ? undefined : int(raw.tutorial_step, -1),
    ),
    // The prototype had no season tip, so it can still fire once.
    seasonTipShown: false,
    placed: [],
    nextPlacedId: 0,
    paused: false,
  });
}

// ---------------------------------------------------------------------------
// Versions 2 to 5: this port's shape

/**
 * A version-2 save: version 3's fields without `seasonTipShown`, which
 * migrates as false so the tip can still fire once. No version before 5 had
 * placed furniture, so they all load with none.
 */
function readV2Save(raw: Record<string, unknown>, where = 'Save v2'): GameState {
  return {
    day: int(raw.day, 0),
    money: num(raw.money, 0),
    inventory: mergeInventory(raw.inventory),
    trees: coerceTrees(raw.trees, where),
    nextTreeId: int(raw.nextTreeId, 0),
    tutorialStep: tutorialStepFromSave(
      typeof raw.tutorialStep === 'number' ? raw.tutorialStep : undefined,
    ),
    seasonTipShown: false,
    placed: [],
    nextPlacedId: 0,
    paused: false,
  };
}

/** A version-3 save: version 2 plus `seasonTipShown`. */
function readV3Save(raw: Record<string, unknown>, where = 'Save v3'): GameState {
  return { ...readV2Save(raw, where), seasonTipShown: raw.seasonTipShown === true };
}

/** A version-4 save: version 3's shape, its display keys already final. */
function readV4Save(raw: Record<string, unknown>, where = 'Save v4'): GameState {
  return readV3Save(raw, where);
}

function placeableKind(v: unknown, where: string): PlaceableKind {
  if (v === 'pedestal' || v === 'floor_shelf') return v;
  throw new Error(`${where}: unknown placed kind ${String(v)}`);
}

/** A version-5 save: version 4 plus the placed furniture. */
function readV5Save(raw: Record<string, unknown>): GameState {
  const where = 'Save v5';
  const placed = Array.isArray(raw.placed) ? (raw.placed as unknown[]) : [];
  return {
    ...readV4Save(raw, where),
    placed: placed.map((item, i): PlacedItem => {
      const r = asRecord(item);
      return {
        id: int(r.id, 0),
        kind: placeableKind(r.kind, `${where} placed ${String(i)}`),
        room: str(r.room, ''),
        x: int(r.x, 0),
        y: int(r.y, 0),
      };
    }),
    nextPlacedId: int(raw.nextPlacedId, 0),
  };
}

/**
 * The display keys version 4 renamed, old pedestal key to new, in priority
 * order. The shed's pedestals (the prototype's too) moved to the lounge, and the
 * lounge's and study's spots took the furniture names they keep from then on.
 * The plain renames come first, so a lounge tree keeps its spot over a shed tree.
 */
const PRE_V4_DISPLAY_KEYS: readonly (readonly [string, string])[] = [
  ['lounge_main', 'lounge_mantel'],
  ['lounge_window', 'lounge_side_table'],
  ['study_main', 'study_desk'],
  ['study_window', 'study_bookshelf'],
  ['shed_main', 'lounge_mantel'],
  ['shed_window', 'lounge_side_table'],
];

/**
 * Every save from before version 4 passes through here: each displayed tree
 * moves to its key's new name. A shed tree whose lounge spot is already taken
 * (a version-3 save with trees on both) is put down on the shed floor instead.
 */
function migrateDisplayKeys(state: GameState): GameState {
  const renamed = new Set(PRE_V4_DISPLAY_KEYS.map(([from]) => DISPLAYED_PREFIX + from));
  const taken = new Set(state.trees.map((t) => t.location).filter((l) => !renamed.has(l)));
  for (const [from, to] of PRE_V4_DISPLAY_KEYS) {
    for (const t of state.trees) {
      if (t.location !== DISPLAYED_PREFIX + from) continue;
      t.location = taken.has(DISPLAYED_PREFIX + to) ? 'shed' : DISPLAYED_PREFIX + to;
      taken.add(t.location);
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// Slots

export function saveGame(
  storage: SaveStorage,
  state: GameState,
  slot = 1,
  now: Date = new Date(),
): void {
  storage.write(slot, serializeState(state, now));
}

/** Undefined when the slot is empty. Throws on a corrupt or unknown-version save. */
export function loadGame(storage: SaveStorage, slot = 1): GameState | undefined {
  const text = storage.read(slot);
  if (text === undefined) return undefined;
  return deserializeSave(text);
}

/** Header fields only, for the slot picker. Works for every save version. Throws on a corrupt slot. */
export function saveSlotMetadata(storage: SaveStorage, slot: number): SaveSlotMetadata | undefined {
  const text = storage.read(slot);
  if (text === undefined) return undefined;
  const raw = parseSaveText(text);
  const version = num(raw.version, 0);
  const v1 = version === 1;
  return {
    slot,
    day: int(v1 ? raw.game_day : raw.day, 0),
    money: num(raw.money, 0),
    savedAt: str(v1 ? raw.saved_at : raw.savedAt, ''),
    version,
  };
}

/**
 * The slot with the most recent savedAt, or -1 if none. The first existing
 * slot always counts (so a save with an empty savedAt is still found); a later
 * slot wins only with a strictly greater timestamp.
 */
export function mostRecentSaveSlot(storage: SaveStorage): number {
  let best = -1;
  let bestAt = '';
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
    let meta: SaveSlotMetadata | undefined;
    try {
      meta = saveSlotMetadata(storage, i);
    } catch {
      continue; // one corrupt slot must not hide the intact ones
    }
    if (meta === undefined) continue;
    if (best === -1 || meta.savedAt > bestAt) {
      bestAt = meta.savedAt;
      best = i;
    }
  }
  return best;
}
