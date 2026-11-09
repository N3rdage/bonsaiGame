import { test as base, type Page } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * How the drivers below reach a game action. With `tapRoute` (the S22
 * projects) every action goes through its visible control by touch; without
 * it (desktop and Pixel 7) through its keyboard shortcut, or a click where the
 * control has no key. The suite so proves tap parity on the phone and keeps
 * the shortcuts tested on desktop.
 */
export interface RouteOptions {
  tapRoute: boolean;
}

export const test = base.extend<RouteOptions>({ tapRoute: [false, { option: true }] });

function tapRoute(): boolean {
  return (test.info().project.use as Partial<RouteOptions>).tapRoute === true;
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

export async function hook(page: Page): Promise<BonsaiTestHook> {
  const h = await page.evaluate(() => window.__bonsai);
  if (!h) throw new Error('hook missing');
  return h;
}

/** A logical point on the 480x270 canvas in page px, through the canvas's bounding box. */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return { x: box.x + (x * box.width) / 480, y: box.y + (y * box.height) / 270 };
}

/**
 * Taps the Phaser control `id` from `window.__bonsai.controls` at its centre.
 * Touch projects tap with the touchscreen, the others click with the mouse.
 */
export async function tapControl(page: Page, id: string): Promise<void> {
  const controls = (await hook(page)).controls;
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

/** The Phaser control `id` by touch on the tap route, else its `key`. */
async function phaser(page: Page, key: string, id: string): Promise<void> {
  if (tapRoute()) await tapControl(page, id);
  else await page.keyboard.press(key);
}

// Title.

export async function toTitle(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__bonsai?.scene === 'title');
}

export const startNewGame = (page: Page): Promise<void> => phaser(page, 'Enter', 'new');
export const continueGame = (page: Page): Promise<void> => phaser(page, 'c', 'continue');
export const openLoadPicker = (page: Page): Promise<void> => phaser(page, 'l', 'load');
export const pickSlot = (page: Page, n: number): Promise<void> =>
  phaser(page, String(n), `slot-${String(n)}`);
export const confirmOverwrite = (page: Page, yes: boolean): Promise<void> =>
  phaser(page, yes ? 'y' : 'n', yes ? 'confirm-yes' : 'confirm-no');

/** Title, New Game, world. Each test has a fresh browser context, so no saves: New Game starts slot 1. */
export async function bootWorld(page: Page, url = '/'): Promise<void> {
  await toTitle(page, url);
  await startNewGame(page);
  await page.waitForFunction(
    () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
  );
}

// World.

export const openViewer = (page: Page): Promise<void> => phaser(page, 'v', 'view');

/** Opens the HUD menu panel by tap. */
export async function openMenu(page: Page): Promise<void> {
  await tapControl(page, 'menu');
  await page.waitForFunction(() => window.__bonsai?.panel === 'menu');
}

/** A HUD menu row by tap on the tap route, else its `key`. */
async function menuRow(page: Page, key: string, row: string): Promise<void> {
  if (!tapRoute()) {
    await page.keyboard.press(key);
    return;
  }
  await openMenu(page);
  await tapControl(page, row);
}

export const saveGame = (page: Page): Promise<void> => menuRow(page, 'F5', 'menu-save');
export const loadGame = (page: Page): Promise<void> => menuRow(page, 'F9', 'menu-load');
export const backToTitle = (page: Page): Promise<void> => menuRow(page, 'Escape', 'menu-title');

/** Uses the prop in range: E, or the Interact button on the tap route. */
export const interact = (page: Page): Promise<void> => phaser(page, 'e', 'interact');
/** Closes the open modal panel: Escape, or its Close button on the tap route. */
export const closePanel = (page: Page): Promise<void> => phaser(page, 'Escape', 'panel-close');
/** Picks slot `n` in the in-room Load Game picker: its number key, or its row on the tap route. */
export const pickPanelSlot = (page: Page, n: number): Promise<void> =>
  phaser(page, String(n), `panel-slot-${String(n)}`);

/**
 * Walks with the arrow keys (movement stays keys on every project): to row
 * `y` first, then along it toward `dx` until `near` is `key`.
 */
export async function walkTo(
  page: Page,
  y: number,
  dx: 'left' | 'right',
  key: string,
): Promise<void> {
  const from = (await hook(page)).player.y;
  const vertical = from < y ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.down(vertical);
  await page.waitForFunction(
    ([target, down]) => {
      const at = window.__bonsai?.player.y ?? NaN;
      return down ? at >= target : at <= target;
    },
    [y, from < y] as const,
  );
  await page.keyboard.up(vertical);
  const horizontal = dx === 'left' ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(horizontal);
  await page.waitForFunction((k) => window.__bonsai?.near === k, key);
  await page.keyboard.up(horizontal);
}

/** Interacts with the tree in range (on the floor or a pedestal) and taps its panel's Pick up. */
export async function pickUpTree(page: Page): Promise<void> {
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel.startsWith('tree:') === true);
  await tapControl(page, 'panel-pickup');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
}

/** Interacts with the empty pedestal in range and taps its panel's Place row. */
export async function placeTree(page: Page): Promise<void> {
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel.startsWith('pedestal:') === true);
  await tapControl(page, 'panel-place');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
}

/** Opens the HUD menu and taps Put down. */
export async function putDownTree(page: Page): Promise<void> {
  await openMenu(page);
  await tapControl(page, 'menu-putdown');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
}

// Viewer: DOM controls.

/** Presses a DOM control: a tap on the tap route, else a click. */
export async function press(page: Page, selector: string, force = false): Promise<void> {
  const control = page.locator(selector);
  if (tapRoute()) await control.tap({ force });
  else await control.click({ force });
}

const MODE_KEYS: Record<string, string> = { view: 'v', wire: 'w', clip: 'c', prune: 'p' };

export async function setMode(page: Page, mode: string): Promise<void> {
  if (tapRoute()) await press(page, `#viewer-toolbar [data-mode="${mode}"]`);
  else await page.keyboard.press(MODE_KEYS[mode] ?? '');
}

export async function closeViewer(page: Page): Promise<void> {
  if (tapRoute()) await press(page, '#viewer-toolbar [data-exit]');
  else await page.keyboard.press('Escape');
}

/** Presses the on-screen hotspot `kind` `id` where the hook says it is. */
export async function pressHotspot(
  page: Page,
  kind: 'branch' | 'trunk',
  id: number,
): Promise<void> {
  const hotspots = (await page.evaluate(() => window.__bonsai?.viewer?.hotspots)) ?? [];
  const hotspot = hotspots.find((h) => h.kind === kind && h.id === id);
  if (!hotspot) throw new Error(`no ${kind} hotspot ${String(id)} on screen`);
  if (tapRoute()) await page.touchscreen.tap(hotspot.x, hotspot.y);
  else await page.mouse.click(hotspot.x, hotspot.y);
}

// Gestures (the joystick and camera drags, pinch, wheel) are not shortcuts for
// a control, so they run the same on every project.

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
