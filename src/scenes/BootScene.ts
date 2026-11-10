import Phaser from 'phaser';
import { LocalStorageSaveStorage } from '../platform/localStorageSaveStorage';
import { LocalStorageSettingsStorage } from '../platform/localStorageSettingsStorage';
import { loadSettings } from '../platform/settings';
import { SEASONS } from '../sim/seasons';
import { VIEWER_FIXTURES, isViewerFixtureKey } from '../viewer/viewerFixtures';
import { ALL_SHEETS, sheetUrl } from '../world/assets';
import { parseTimeScale } from '../world/clock';
import type { TitleSceneData } from './sceneData';

/**
 * Entry scene: loads the sprite sheets, creates the one save storage the game
 * uses, loads the settings, reads the viewer's test parameters and hands them
 * to the title.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  /** The room, prop and player sprite sheets (src/world/assets.ts), from public/assets under the app's base path. */
  preload(): void {
    for (const sheet of ALL_SHEETS) {
      this.load.spritesheet(sheet.key, sheetUrl(import.meta.env.BASE_URL, sheet), {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
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
    // `?timeScale=<n>` speeds the day clock up for the day-passing tests.
    const timeScale = parseTimeScale(params.get('timeScale'));

    // Loaded only: a stored fullscreen is not re-applied, browsers refuse it outside a tap.
    const settingsStorage = new LocalStorageSettingsStorage();
    const data: TitleSceneData = {
      storage: new LocalStorageSaveStorage(),
      settings: loadSettings(settingsStorage),
      settingsStorage,
      overrides: {
        tree: isViewerFixtureKey(fixtureKey) ? VIEWER_FIXTURES[fixtureKey] : undefined,
        season: SEASONS.find((s) => s === seasonParam),
        timeScale,
      },
    };
    this.scene.start('title', data);
  }
}
