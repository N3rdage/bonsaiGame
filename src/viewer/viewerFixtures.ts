/**
 * Trees for the viewer's screenshot tests, each grown only through the
 * simulation's own actions so the pictures show reachable morphology.
 */

import { repotTree } from '../sim/growth';
import { DAYS_PER_SEASON, SEASONS } from '../sim/seasons';
import { SHOP_CATALOGUE, shopBuy } from '../sim/shop';
import { createNewGameState } from '../sim/state';
import { applyWire, wireTrunk } from '../sim/training';
import { addBranch, createTree, markDirty } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';

export type ViewerFixtureKey = 'cutting' | 'bent' | 'cascade' | 'maple' | 'wired' | 'fancy';

/** Screen-right at the default yaw of 45 (world (-1,-1,0)), as the prototype's trunk wiring UI used. */
export const SCREEN_RIGHT_ANGLE = -135;
export const BENT_EVENT_HEIGHTS_CM = [5, 12];
/**
 * Nine 20-degree bends every 2.5 cm sweep the trunk through 180 degrees on a
 * tight curve (radius about 0.29 units), so it turns over within about 0.57
 * units of the pot centre and the last 10 cm hang straight down. A wider
 * spacing swings the trunk out of the portrait phone frame.
 */
export const CASCADE_HEIGHT_CM = 30;
/** One bend every this many cm from the soil line. */
export const CASCADE_EVENT_SPACING_CM = 2.5;
export const CASCADE_EVENTS = 9;
/**
 * A young maple: height, girth and foliage density set the way the new-game
 * bootstrap sets the starter's (state.ts), then three branches added with the
 * sim's `addBranch`, all above the 0.3 foliage gate.
 */
export const MAPLE_HEIGHT_CM = 20;
export const MAPLE_GIRTH_MM = 12;
export const MAPLE_FOLIAGE_DENSITY = 0.5;
/** [originY cm, angle deg, length cm] per branch. */
export const MAPLE_BRANCHES: readonly (readonly [number, number, number])[] = [
  [9, 45, 9],
  [13, 200, 8],
  [17, 120, 6],
];

/**
 * The starter's 210-degree branch (14 cm up, 11 cm long) lies in the screen-right
 * half at yaw 45; a +40 degree wire sweeps its tip round to 250 degrees, toward
 * the camera, so both the coil and the trunk anchor face the default view.
 */
export const WIRED_BRANCH_ID = 1;
export const WIRED_BEND_DEG = 40;
/**
 * Repotting is spring-only and the starter was last repotted on day 0, so the
 * first day it can go into a fancy pot is the first day of the second spring.
 */
export const FANCY_REPOT_DAY = DAYS_PER_SEASON * SEASONS.length + 1;

function starter(): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  const tree = state.trees[0];
  if (!tree) throw new Error('new game has no starter tree');
  return { state, tree };
}

export const VIEWER_FIXTURES: Record<ViewerFixtureKey, () => BonsaiTree> = {
  cutting: () => createTree('juniper', 'cutting', 1),

  bent: () => {
    const { state, tree } = starter();
    for (const y of BENT_EVENT_HEIGHTS_CM) wireTrunk(tree, state, y, SCREEN_RIGHT_ANGLE);
    return tree;
  },

  cascade: () => {
    const { state, tree } = starter();
    tree.trunk.heightCm = CASCADE_HEIGHT_CM;
    markDirty(tree);
    for (let i = 0; i < CASCADE_EVENTS; i++) {
      wireTrunk(tree, state, i * CASCADE_EVENT_SPACING_CM, SCREEN_RIGHT_ANGLE);
    }
    return tree;
  },

  maple: () => {
    const tree = createTree('maple', 'seed', 1);
    tree.trunk.heightCm = MAPLE_HEIGHT_CM;
    tree.trunk.girthMm = MAPLE_GIRTH_MM;
    tree.foliageDensity = MAPLE_FOLIAGE_DENSITY;
    markDirty(tree);
    for (const [y, angle, length] of MAPLE_BRANCHES) addBranch(tree, -1, y, angle, length);
    return tree;
  },

  wired: () => {
    const { state, tree } = starter();
    if (!applyWire(tree, state, WIRED_BRANCH_ID, WIRED_BEND_DEG)) {
      throw new Error('wired fixture: applyWire refused');
    }
    return tree;
  },

  fancy: () => {
    const { state, tree } = starter();
    state.day = FANCY_REPOT_DAY;
    const price = SHOP_CATALOGUE.find((item) => item.key === 'fancy_pot')?.price ?? Infinity;
    if (!shopBuy(state, 'fancy_pot', 1, price) || !repotTree(tree, state, 1)) {
      throw new Error('fancy fixture: could not buy a fancy pot and repot');
    }
    return tree;
  },
};

export function isViewerFixtureKey(key: string | null): key is ViewerFixtureKey {
  return key !== null && Object.hasOwn(VIEWER_FIXTURES, key);
}
