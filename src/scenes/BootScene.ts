import Phaser from 'phaser';
import { SEASONS, seasonForDay, seasonLabel } from '../sim/seasons';
import { createNewGameState } from '../sim/state';
import { scoreTree } from '../sim/scoring';
import { getSpecies } from '../sim/species';
import { TreeViewer } from '../viewer/TreeViewer';
import { VIEWER_FIXTURES, isViewerFixtureKey } from '../viewer/viewerFixtures';

/**
 * Placeholder first scene: proves the pipeline end to end while the port lands.
 * It boots a real new game and shows the starter tree's score, so the browser
 * test exercises the simulation in the bundle, not just the renderer.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    const state = createNewGameState();
    const season = seasonForDay(state.day);
    const starter = state.trees[0];
    const starterLine = starter
      ? `${starter.name} ${getSpecies(starter.speciesKey).displayName.toLowerCase()} - score ${String(scoreTree(starter).total)}`
      : 'no trees';

    this.add
      .text(width / 2, height / 2 - 32, 'Bonsai Greenhouse', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#d8e6c8',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 4, `Day ${String(state.day)} - ${seasonLabel(season)}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9fb88f',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 24, starterLine, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9fb88f',
      })
      .setOrigin(0.5);

    this.add
      .text(width - 6, height - 6, `v${__APP_VERSION__} - rewrite in progress`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#6e8463',
      })
      .setOrigin(1, 1);

    const viewer = new TreeViewer(document.body);
    const viewLink = this.add
      .text(width / 2, height / 2 + 48, 'View tree (3D)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8e6c8',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const hookBase = {
      ready: true,
      version: __APP_VERSION__,
      scene: this.scene.key,
      season,
      day: state.day,
      trees: state.trees.length,
      starterScore: starter ? scoreTree(starter).total : -1,
      starterHeightCm: starter ? starter.trunk.heightCm : -1,
    };
    const publishHook = (): void => {
      // `paused` is read from the game state itself, not the viewer, so a test
      // sees what the simulation would see after the viewer has let go.
      window.__bonsai = { ...hookBase, paused: state.paused, viewer: viewer.snapshot() };
    };
    viewer.onRender = publishHook;
    viewer.onClose = publishHook;
    this.events.once('shutdown', () => {
      viewer.destroy();
    });
    // `?tree=<fixture>` shows a fixture tree instead of the starter, for the
    // viewer's screenshot tests; it stays until R4's rooms give a real way to
    // pick a tree.
    const params = new URLSearchParams(window.location.search);
    const fixtureKey = params.get('tree');
    const shown = isViewerFixtureKey(fixtureKey) ? VIEWER_FIXTURES[fixtureKey]() : starter;
    // `?season=<spring|summer|autumn|winter>` overrides the game's season in
    // the viewer only, for the foliage screenshot tests; it stays until R4
    // like `?tree=`.
    const seasonParam = params.get('season');
    const viewerSeason = SEASONS.find((s) => s === seasonParam) ?? season;
    viewLink.on('pointerup', () => {
      if (!shown) return;
      viewer.open(shown, viewerSeason, state);
      publishHook();
    });
    publishHook();
  }
}
