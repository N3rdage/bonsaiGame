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
  const { x, y } = await toPage(page, control.x, control.y);
  if (test.info().project.use.hasTouch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
}

/**
 * Presses at a logical point and drags `dx` logical px to the right, the
 * joystick gesture. The mouse is used on every project: Playwright's
 * touchscreen only taps, and Phaser routes both through the same pointer events.
 */
export async function dragLogical(page: Page, x: number, y: number, dx: number): Promise<void> {
  const from = await toPage(page, x, y);
  const to = await toPage(page, x + dx, y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = (): void => {
          n += 1;
          if (n >= 10) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.mouse.up();
}

/** A logical point on the 480x270 canvas in page px, through the canvas's bounding box. */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return { x: box.x + (x * box.width) / 480, y: box.y + (y * box.height) / 270 };
}
