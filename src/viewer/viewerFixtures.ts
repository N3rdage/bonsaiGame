/**
 * Trees for the viewer's screenshot tests, each grown only through the
 * simulation's own actions so the pictures show reachable morphology.
 */

import { createNewGameState } from '../sim/state';
import { wireTrunk } from '../sim/training';
import { createTree, markDirty } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';

export type ViewerFixtureKey = 'cutting' | 'bent' | 'cascade';

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
};

export function isViewerFixtureKey(key: string | null): key is ViewerFixtureKey {
  return key !== null && Object.hasOwn(VIEWER_FIXTURES, key);
}
