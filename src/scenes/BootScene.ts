import Phaser from 'phaser';
import { LocalStorageSaveStorage } from '../platform/localStorageSaveStorage';
import { SEASONS } from '../sim/seasons';
import { VIEWER_FIXTURES, isViewerFixtureKey } from '../viewer/viewerFixtures';
import type { TitleSceneData } from './sceneData';

/**
 * Entry scene: creates the one save storage the game uses, reads the viewer's
 * test parameters and hands both to the title.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    // `?tree=<fixture>` makes the viewer show a fixture tree instead of the
    // starter, for its screenshot tests; it stays until R4's interactables give
    // a real way to pick a tree.
    const params = new URLSearchParams(window.location.search);
    const fixtureKey = params.get('tree');
    // `?season=<spring|summer|autumn|winter>` overrides the game's season in
    // the viewer only, for the foliage screenshot tests; it stays like `?tree=`.
    const seasonParam = params.get('season');

    const data: TitleSceneData = {
      storage: new LocalStorageSaveStorage(),
      overrides: {
        tree: isViewerFixtureKey(fixtureKey) ? VIEWER_FIXTURES[fixtureKey] : undefined,
        season: SEASONS.find((s) => s === seasonParam),
      },
    };
    this.scene.start('title', data);
  }
}
