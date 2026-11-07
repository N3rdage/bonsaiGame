import Phaser from 'phaser';
import { seasonForDay, seasonLabel } from '../sim/seasons';

/** Placeholder first scene: proves the pipeline end to end while the port lands. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    const day = 1;
    const season = seasonForDay(day);

    this.add
      .text(width / 2, height / 2 - 24, 'Bonsai Greenhouse', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#d8e6c8',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 12, `Day ${String(day)} - ${seasonLabel(season)}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
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
    };
  }
}
