import { test, type Page } from '@playwright/test';

/**
 * Taps the Phaser control `id` from `window.__bonsai.controls`, mapping its
 * logical position (480x270) to page px through the canvas's bounding box.
 * Touch projects tap with the touchscreen, the others click with the mouse.
 */
export async function tapControl(page: Page, id: string): Promise<void> {
  const controls = await page.evaluate(() => window.__bonsai?.controls ?? []);
  const control = controls.find((c) => c.id === id);
  if (!control) {
    throw new Error(`no control '${id}' in [${controls.map((c) => c.id).join(', ')}]`);
  }
  await tapLogical(page, control.x, control.y);
}

/** Taps the canvas at a logical point (480x270), by touch or mouse as the project has. */
export async function tapLogical(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const px = box.x + (x * box.width) / 480;
  const py = box.y + (y * box.height) / 270;
  if (test.info().project.use.hasTouch) {
    await page.touchscreen.tap(px, py);
  } else {
    await page.mouse.click(px, py);
  }
}
