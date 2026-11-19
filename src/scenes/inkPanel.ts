import Phaser from 'phaser';
import { PANEL_STYLE, panelFrame, type FrameRect } from './textStyle';

/**
 * The ink-and-paper panel (PANEL_STYLE in src/scenes/textStyle.ts) drawn: the
 * paper box, interactive so a press on it reaches nothing beneath, and a
 * Graphics with the title band (`titleH` px, none for 0) and the ink rules.
 * The caller sets their depth.
 */
export function drawPanel(
  scene: Phaser.Scene,
  box: FrameRect,
  titleH = 0,
): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Graphics] {
  const paper = scene.add
    .rectangle(box.x, box.y, box.w, box.h, PANEL_STYLE.paper)
    .setOrigin(0)
    .setInteractive();
  const frame = panelFrame(box, titleH);
  const g = scene.add.graphics();
  if (frame.band) {
    const b = frame.band;
    g.fillStyle(PANEL_STYLE.band).fillRect(b.x, b.y, b.w, b.h);
  }
  for (const r of frame.rules) g.fillStyle(PANEL_STYLE.ink, r.alpha).fillRect(r.x, r.y, r.w, r.h);
  return [paper, g];
}

/** A button's ink underline under `text`'s glyph run (its box less the padding), at its depth. */
export function underline(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text,
): Phaser.GameObjects.Rectangle {
  const b = text.getBounds();
  const left = text.padding.left ?? 0;
  const right = text.padding.right ?? 0;
  const t = PANEL_STYLE.rule;
  return scene.add
    .rectangle(b.x + left, b.bottom, b.width - left - right, t, PANEL_STYLE.ink)
    .setAlpha(PANEL_STYLE.underline.alpha)
    .setOrigin(0)
    .setDepth(text.depth);
}

/**
 * The ink rule round every plated text (one drawn over the room): an ink
 * rectangle a rule wider than the text's box each side, kept just under the
 * text in the display list, so the text's own paper plate fills its middle.
 * Each frame before rendering it follows its text's box, depth, camera and
 * visibility (hidden with an empty text too); it goes when its text does.
 */
export class PlateEdges {
  private readonly edges = new Map<Phaser.GameObjects.Text, Phaser.GameObjects.Rectangle>();

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.sync);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.sync);
      this.edges.clear();
    });
  }

  /** Edges `text` from now until it is destroyed. */
  add(text: Phaser.GameObjects.Text): void {
    const edge = this.scene.add.rectangle(0, 0, 1, 1, PANEL_STYLE.ink).setOrigin(0);
    this.scene.children.moveBelow(edge, text);
    this.edges.set(text, edge);
    text.once(Phaser.GameObjects.Events.DESTROY, () => {
      edge.destroy();
      this.edges.delete(text);
    });
  }

  private readonly sync = (): void => {
    const t = PANEL_STYLE.rule;
    for (const [text, edge] of this.edges) {
      const b = text.getBounds();
      edge.cameraFilter = text.cameraFilter;
      edge
        .setPosition(b.x - t, b.y - t)
        .setSize(b.width + 2 * t, b.height + 2 * t)
        .setVisible(text.visible && text.text !== '');
      if (edge.depth !== text.depth) edge.setDepth(text.depth);
    }
  };
}
