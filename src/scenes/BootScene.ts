import Phaser from 'phaser';
import { seasonForDay, seasonLabel } from '../sim/seasons';
import { createNewGameState } from '../sim/state';
import { scoreTree } from '../sim/scoring';
import { getSpecies } from '../sim/species';

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

    window.__bonsai = {
      ready: true,
      version: __APP_VERSION__,
      scene: this.scene.key,
      season,
      day: state.day,
      trees: state.trees.length,
      starterScore: starter ? scoreTree(starter).total : -1,
    };
  }
}
