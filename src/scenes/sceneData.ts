import type { SaveStorage } from '../sim/save';
import type { Season } from '../sim/seasons';
import type { BonsaiTree, GameState } from '../sim/types';

/** The viewer's test parameters (`?tree=`, `?season=`), read once by the boot scene. */
export interface ViewerOverrides {
  /** Builds the fixture tree the viewer shows instead of the first tree. */
  readonly tree: (() => BonsaiTree) | undefined;
  /** Season the viewer draws instead of the game's. */
  readonly season: Season | undefined;
}

/** What every scene after boot carries: the one save storage and the viewer overrides. */
export interface SharedSceneData {
  readonly storage: SaveStorage;
  readonly overrides: ViewerOverrides;
}

export type TitleSceneData = SharedSceneData;

export interface WorldSceneData extends SharedSceneData {
  /** The state the world plays: a new game or the one loaded from `slot`. */
  readonly state: GameState;
  /** Slot F5 saves to and F9 loads from (1..SAVE_SLOT_COUNT). */
  readonly slot: number;
}

/** Hook fields the title publishes with nothing loaded. */
export const IDLE_HOOK = {
  season: '',
  day: -1,
  trees: 0,
  starterScore: -1,
  starterHeightCm: -1,
  paused: false,
  room: '',
  player: { x: 0, y: 0, facing: '' },
  hud: '',
  frames: 0,
  panel: '',
  near: '',
} as const;
