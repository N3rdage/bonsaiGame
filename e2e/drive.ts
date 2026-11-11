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

/** Opens the title's Settings panel: S, or its `Settings (S)` button on the tap route. */
export async function openSettingsFromTitle(page: Page): Promise<void> {
  await phaser(page, 's', 'settings');
  await page.waitForFunction(() => window.__bonsai?.panel === 'settings');
}

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

/** Opens the HUD menu and taps its Settings row (it has no key), on every project. */
export async function openSettingsFromMenu(page: Page): Promise<void> {
  await openMenu(page);
  await tapControl(page, 'menu-settings');
  await page.waitForFunction(() => window.__bonsai?.panel === 'settings');
}

/** Uses the prop in range: E, or the Interact button on the tap route. */
export const interact = (page: Page): Promise<void> => phaser(page, 'e', 'interact');
/** Closes the open modal panel: Escape, or its Close button on the tap route. */
export const closePanel = (page: Page): Promise<void> => phaser(page, 'Escape', 'panel-close');
/** Picks slot `n` in the in-room Load Game picker: its number key, or its row on the tap route. */
export const pickPanelSlot = (page: Page, n: number): Promise<void> =>
  phaser(page, String(n), `panel-slot-${String(n)}`);

// Walking. A key release reaches Phaser only after the page notices the goal,
// Playwright sends keyboard.up and the next frame runs, and the player keeps
// walking meanwhile: on a slow CI runner 25 to 32 px, more than the 20 px
// interact reach (INTERACT_RANGE), which once parked a garden walk on the far
// fence until the test budget ran out (N3rdage/agentic-gaming#81). So every
// leg below is settled from the position the player stops at, not trusted.

/**
 * How far off its row a walk may stop before the horizontal leg. Every walk's
 * row is its target's own row except the shed door's, which is already in
 * reach when that leg lands. 12 px off the row the 20 px reach circle still
 * spans a 32 px chord of it, and the horizontal leg ends on `near` anyway. A
 * nudge moves under 12 px, so under twice this, and the settle converges.
 */
const ROW_TOLERANCE = 12;
/** Nudges allowed to bring the player back to its row or into reach before the walk fails. */
const SETTLE_TRIES = 12;
/** A long leg that takes this long has failed; the test budget stays for the rest. */
const LEG_BUDGET_MS = 20_000;
/** A held key that moves the player for neither this many frames nor this long is pinned against a wall. */
const STALL = { frames: 30, ms: 500 };
/** The player has stopped once unmoved for this many frames and this long (up to `budgetMs`). */
const STILL = { frames: 3, ms: 50, budgetMs: 2_000 };
/**
 * A nudge holds its key until one world frame has stepped, or this long: the
 * smallest move the game makes, from 1 step (1.25 px) to about a frame of
 * release lag (under 12 px); 0 px when down and up land in one frame.
 */
const NUDGE_MS = 300;

/** What a watch below waits for, checked every frame. */
type Watch =
  /** A long leg: until `y` reaches `row`. */
  | { until: 'row'; row: number; down: boolean }
  /** A long leg: until `near` is `key`. */
  | { until: 'near'; key: string }
  /** A nudge: until the hook's `frames` passes `from`. */
  | { until: 'frame'; from: number }
  /** Until the player stops. */
  | { until: 'still' };

interface Watched {
  /** False when the watch ended on a stall or its time budget instead of its goal. */
  readonly reached: boolean;
  readonly x: number;
  readonly y: number;
  readonly near: string;
  readonly room: string;
  readonly frames: number;
}

/** Polls the hook every frame until `w`'s goal, a stall (long legs only) or its time budget. */
function watch(page: Page, w: Watch): Promise<Watched> {
  const limits = {
    legMs: LEG_BUDGET_MS,
    nudgeMs: NUDGE_MS,
    stall: STALL,
    still: STILL,
  };
  return page.evaluate(
    ([w, limits]) =>
      new Promise<Watched>((resolve) => {
        const start = performance.now();
        const budget =
          w.until === 'frame'
            ? limits.nudgeMs
            : w.until === 'still'
              ? limits.still.budgetMs
              : limits.legMs;
        let last = '';
        let sameFrames = 0;
        let sameSince = start;
        const tick = (): void => {
          const now = performance.now();
          const h = window.__bonsai;
          if (h) {
            const { x, y } = h.player;
            const at = { x, y, near: h.near, room: h.room, frames: h.frames };
            const pos = `${String(x)},${String(y)}`;
            if (pos === last) {
              sameFrames += 1;
            } else {
              last = pos;
              sameFrames = 0;
              sameSince = now;
            }
            const unmoved = (n: { frames: number; ms: number }): boolean =>
              sameFrames >= n.frames && now - sameSince >= n.ms;
            let reached: boolean;
            switch (w.until) {
              case 'row':
                reached = w.down ? y >= w.row : y <= w.row;
                break;
              case 'near':
                reached = h.near === w.key;
                break;
              case 'frame':
                reached = h.frames > w.from;
                break;
              case 'still':
                reached = unmoved(limits.still);
                break;
            }
            const stalled = (w.until === 'row' || w.until === 'near') && unmoved(limits.stall);
            if (reached || stalled || now - start >= budget) {
              resolve({ reached, ...at });
              return;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [w, limits] as const,
  );
}

/** Holds `key` while watching `w`, then releases it. */
async function hold(page: Page, key: string, w: Watch): Promise<Watched> {
  await page.keyboard.down(key);
  const at = await watch(page, w);
  await page.keyboard.up(key);
  return at;
}

/** Taps `key` for one world frame from where the player stopped, `at`, and waits for it to stop again. */
async function nudge(page: Page, key: string, at: Watched): Promise<Watched> {
  await hold(page, key, { until: 'frame', from: at.frames });
  return watch(page, { until: 'still' });
}

/**
 * Walks with the arrow keys (movement stays keys on every project): to row
 * `y` first, then along it toward `dx` until `near` is `key`, and returns
 * with the player stopped in reach of `key`. Each leg is settled with short
 * nudges where the release lag carried the player past it, and a walk that
 * cannot arrive (pinned on a wall, out of nudges or out of time) throws with
 * where the player stopped instead of running out the test's budget.
 */
export async function walkTo(
  page: Page,
  y: number,
  dx: 'left' | 'right',
  key: string,
): Promise<void> {
  const fail = (what: string, at: Watched): Error =>
    new Error(
      `walkTo(${key}): ${what}: stopped at (${String(at.x)}, ${String(at.y)}), near='${at.near}', room=${at.room}`,
    );

  const from = (await hook(page)).player.y;
  if (from !== y) {
    const down = from < y;
    const leg = await hold(page, down ? 'ArrowDown' : 'ArrowUp', { until: 'row', row: y, down });
    if (!leg.reached) throw fail(`never reached row ${String(y)}`, leg);
  }
  let at = await watch(page, { until: 'still' });
  for (
    let tries = SETTLE_TRIES;
    at.near !== key && Math.abs(at.y - y) > ROW_TOLERANCE;
    tries -= 1
  ) {
    if (tries === 0) throw fail(`could not settle on row ${String(y)}`, at);
    at = await nudge(page, at.y < y ? 'ArrowDown' : 'ArrowUp', at);
  }
  if (at.near === key) return;

  const leg = await hold(page, dx === 'left' ? 'ArrowLeft' : 'ArrowRight', { until: 'near', key });
  if (!leg.reached) throw fail(`never came in reach walking ${dx}`, leg);
  at = await watch(page, { until: 'still' });
  const back = dx === 'left' ? 'ArrowRight' : 'ArrowLeft';
  for (let tries = SETTLE_TRIES; at.near !== key; tries -= 1) {
    if (tries === 0) throw fail(`carried out of reach walking ${dx}`, at);
    at = await nudge(page, back, at);
  }
}

/** Interacts with the tree in range (on the floor or a pedestal) and waits for its inspector. */
export async function openInspector(page: Page): Promise<void> {
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel.startsWith('tree:') === true);
}

/**
 * Taps an inspector button ('water', 'fertilise', 'skip', 'pickup', 'view',
 * 'rename', 'style', 'sell', 'repot') on every project: panel buttons have
 * no keyboard route.
 */
export const inspectorAction = (page: Page, id: string): Promise<void> =>
  tapControl(page, `panel-${id}`);

/** Walks from the shed's start down to the kiosk's row and left to it, then opens the shop. */
export async function openShop(page: Page): Promise<void> {
  await walkTo(page, 145, 'left', 'shop_kiosk');
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel === 'shop');
}

/** Walks up to the planting table's row and left to it (from right of it), then opens Plant a Cutting. */
export async function openPlanting(page: Page): Promise<void> {
  await walkTo(page, 90, 'left', 'planting_table');
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel === 'plant');
}

/** Opens Granny's notebook: J, or its `Notebook (J)` HUD button on the tap route. */
export async function openNotebook(page: Page): Promise<void> {
  await phaser(page, 'j', 'notebook');
  await page.waitForFunction(() => window.__bonsai?.panel === 'notebook');
}

/** Taps the notebook's `< Prev` or `Next >` (no keys, as in the prototype) and waits for the page to change. */
export async function turnNotebookPage(page: Page, id: 'panel-prev' | 'panel-next'): Promise<void> {
  const before = (await hook(page)).notebook?.indicator;
  await tapControl(page, id);
  await page.waitForFunction((b) => window.__bonsai?.notebook?.indicator !== b, before);
}

/** Taps the tutorial corner panel's Skip, then the confirmation's Skip (`confirm`) or Cancel. */
export async function skipTutorial(page: Page, confirm: boolean): Promise<void> {
  await tapControl(page, 'tutorial-skip');
  await page.waitForFunction(() => window.__bonsai?.panel === 'tutorial-skip');
  await tapControl(page, confirm ? 'panel-skip' : 'panel-cancel');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
}

/** Types `name` into the Rename panel's DOM input and taps its Save row. */
export async function fillRename(page: Page, name: string): Promise<void> {
  await page.fill('#rename-input', name);
  await tapControl(page, 'panel-rename-save');
}

/** Opens the inspector of the tree in range and taps its Pick up. */
export async function pickUpTree(page: Page): Promise<void> {
  await openInspector(page);
  await inspectorAction(page, 'pickup');
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
