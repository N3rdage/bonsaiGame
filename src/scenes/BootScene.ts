import Phaser from 'phaser';
import { SEASONS, seasonForDay } from '../sim/seasons';
import { createNewGameState } from '../sim/state';
import { scoreTree } from '../sim/scoring';
import { VIEWER_FIXTURES, isViewerFixtureKey } from '../viewer/viewerFixtures';
import type { WorldSceneData } from './WorldScene';

/**
 * Entry scene: creates a real new game, reads the viewer's test parameters
 * and hands both to the world, which publishes the test hook.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const state = createNewGameState();
    const season = seasonForDay(state.day);
    const starter = state.trees[0];

    // `?tree=<fixture>` makes the viewer show a fixture tree instead of the
    // starter, for its screenshot tests; it stays until R4's interactables give
    // a real way to pick a tree.
    const params = new URLSearchParams(window.location.search);
    const fixtureKey = params.get('tree');
    const viewTree = isViewerFixtureKey(fixtureKey) ? VIEWER_FIXTURES[fixtureKey]() : starter;
    // `?season=<spring|summer|autumn|winter>` overrides the game's season in
    // the viewer only, for the foliage screenshot tests; it stays like `?tree=`.
    const seasonParam = params.get('season');
    const viewerSeason = SEASONS.find((s) => s === seasonParam) ?? season;

    const data: WorldSceneData = {
      state,
      viewTree,
      viewerSeason,
      hookBase: {
        version: __APP_VERSION__,
        season,
        day: state.day,
        trees: state.trees.length,
        starterScore: starter ? scoreTree(starter).total : -1,
        starterHeightCm: starter ? starter.trunk.heightCm : -1,
      },
    };
    this.scene.start('world', data);
  }
}
