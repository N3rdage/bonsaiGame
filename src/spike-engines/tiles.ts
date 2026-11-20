/**
 * The scene's textures (backlog #378): frame 0 of each material's Inked sheet
 * cut out onto its own canvas, so an engine can repeat it across a face (a
 * sheet is a strip of variants, which a repeating texture cannot index).
 * DOM, engine-neutral: three.js wraps a canvas in a CanvasTexture, Babylon.js
 * in a DynamicTexture or from `toDataURL()`.
 */

import { sheetUrl, type Sheet } from '../world/assets';
import type { MaterialKey, SpikeScene } from './scene';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`could not load ${url}`));
    };
    image.src = url;
  });
}

/** Frame 0 of `sheet` on a canvas its frame's size. */
export async function tileCanvas(base: string, sheet: Sheet): Promise<HTMLCanvasElement> {
  const image = await loadImage(sheetUrl(base, sheet));
  const canvas = document.createElement('canvas');
  canvas.width = sheet.frameWidth;
  canvas.height = sheet.frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas context');
  ctx.drawImage(
    image,
    0,
    0,
    sheet.frameWidth,
    sheet.frameHeight,
    0,
    0,
    sheet.frameWidth,
    sheet.frameHeight,
  );
  return canvas;
}

/** Every textured material's tile, by material. */
export async function sceneTiles(
  base: string,
  scene: SpikeScene,
): Promise<Partial<Record<MaterialKey, HTMLCanvasElement>>> {
  const entries = await Promise.all(
    (
      Object.entries(scene.materials) as [MaterialKey, SpikeScene['materials'][MaterialKey]][]
    ).flatMap(([key, spec]) =>
      spec.sheet ? [tileCanvas(base, spec.sheet).then((canvas) => [key, canvas] as const)] : [],
    ),
  );
  return Object.fromEntries(entries);
}
