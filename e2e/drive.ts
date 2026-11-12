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

/** Sleeps one night: Z, or the menu's Sleep row on the tap route. */
export const sleepOneNight = (page: Page): Promise<void> => menuRow(page, 'z', 'menu-sleep');

/** Starts placement mode in the greenhouse: P, or the menu's Place item row on the tap route. */
export async function startPlacing(page: Page): Promise<void> {
  await menuRow(page, 'p', 'menu-place');
  await page.waitForFunction(() => window.__bonsai?.placing !== undefined);
}

/** Switches placement mode to the next kind in stock: P, or the menu's Next row on the tap route. */
export async function nextPlacingKind(page: Page): Promise<void> {
  const before = (await hook(page)).placing?.kind;
  await menuRow(page, 'p', 'menu-place-next');
  await page.waitForFunction((k) => window.__bonsai?.placing?.kind !== k, before);
}

/** Leaves placement mode: Escape, or the menu's Stop placing row on the tap route. */
export async function stopPlacing(page: Page): Promise<void> {
  await menuRow(page, 'Escape', 'menu-place');
  await page.waitForFunction(() => window.__bonsai?.placing === undefined);
}

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

// Walking. Each leg runs inside the page in one evaluate: it dispatches the
// arrow's keydown on window (Phaser's KeyboardManager listens there, reads
// keyCode and applies the event as it is dispatched), watches the hook every
// animation frame, and dispatches the keyup in the callback that sees the
// goal. Releasing with Playwright's keyboard.up instead cost a round trip,
// during which a slow CI runner walked the player 25 to 32 px on, past the
// 20 px interact reach (INTERACT_RANGE), and once parked a garden walk on the
// far fence until the test budget ran out (N3rdage/agentic-gaming#81).

/** A leg that takes this long has failed; the test budget stays for the rest. */
const LEG_BUDGET_MS = 20_000;
/** A held key that moves the player for neither this many frames nor this long is pinned against a wall. */
const STALL = { frames: 30, ms: 500 };
/** How long a leg waits after its keyup for the world step that shows where the player stopped. */
const STOP_MS = 250;

/** The arrows' legacy keyCodes, which Phaser keys on. */
const ARROWS = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 } as const;

/** What a leg holds its arrow until, checked every animation frame. */
type Goal =
  /** Until `y` reaches `row`. */
  | { until: 'row'; row: number; down: boolean }
  /** Until `near` is `key`. */
  | { until: 'near'; key: string };

interface Stop {
  readonly x: number;
  readonly y: number;
  readonly near: string;
  readonly room: string;
}

interface Leg {
  /** False when the leg ended on a stall or its time budget instead of its goal. */
  readonly reached: boolean;
  /** Where the player stood on the last frame before the leg ended. */
  readonly before: Stop;
  /** Where the player stopped, read on the first world step after the keyup. */
  readonly stop: Stop;
}

interface LegArgs {
  readonly arrow: keyof typeof ARROWS;
  readonly keyCode: number;
  readonly goal: Goal;
  readonly legMs: number;
  readonly stall: { readonly frames: number; readonly ms: number };
  readonly stopMs: number;
}

/**
 * Holds `arrow` until `goal`, a stall or the leg budget, all in the page. The
 * keyup goes out in the animation-frame callback that first sees the goal in
 * the hook, and Phaser's KeyboardPlugin applies it as it is dispatched, before
 * the world's next step. So the player moves past the goal by at most the
 * steps of the frame that reached it: MAX_STEPS_PER_FRAME (5) steps of
 * 1.25 px, 6.25 px, however slow the runner.
 */
async function leg(page: Page, arrow: keyof typeof ARROWS, goal: Goal): Promise<Leg> {
  const args: LegArgs = {
    arrow,
    keyCode: ARROWS[arrow],
    goal,
    legMs: LEG_BUDGET_MS,
    stall: STALL,
    stopMs: STOP_MS,
  };
  try {
    return await page.evaluate(
      (a) =>
        new Promise<Leg>((resolve) => {
          const send = (type: 'keydown' | 'keyup'): void => {
            // KeyboardEventInit's keyCode is deprecated; Phaser keys on it, so it goes on the event.
            const event = new KeyboardEvent(type, { key: a.arrow, code: a.arrow, bubbles: true });
            Object.defineProperty(event, 'keyCode', { value: a.keyCode });
            window.dispatchEvent(event);
          };
          const at = (): Stop | undefined => {
            const h = window.__bonsai;
            return h && { x: h.player.x, y: h.player.y, near: h.near, room: h.room };
          };
          const start = performance.now();
          let before = at() ?? { x: NaN, y: NaN, near: '', room: '' };
          let sameFrames = 0;
          let sameSince = start;
          send('keydown');
          const tick = (): void => {
            const now = performance.now();
            const h = window.__bonsai;
            const pos = at();
            if (!h || !pos) {
              requestAnimationFrame(tick);
              return;
            }
            const reached =
              a.goal.until === 'row'
                ? a.goal.down
                  ? pos.y >= a.goal.row
                  : pos.y <= a.goal.row
                : pos.near === a.goal.key;
            if (pos.x === before.x && pos.y === before.y) {
              sameFrames += 1;
            } else {
              sameFrames = 0;
              sameSince = now;
            }
            const stalled = sameFrames >= a.stall.frames && now - sameSince >= a.stall.ms;
            if (!reached && !stalled && now - start < a.legMs) {
              before = pos;
              requestAnimationFrame(tick);
              return;
            }
            send('keyup');
            const released = h.frames;
            const settle = (): void => {
              const after = window.__bonsai;
              if (after && after.frames <= released && performance.now() - now < a.stopMs) {
                requestAnimationFrame(settle);
                return;
              }
              resolve({ reached, before, stop: at() ?? pos });
            };
            requestAnimationFrame(settle);
          };
          requestAnimationFrame(tick);
        }),
      args,
    );
  } catch (err) {
    // The evaluate failed mid-leg; if the page is still there, let go of the arrow.
    await page
      .evaluate((a) => {
        const event = new KeyboardEvent('keyup', { key: a.arrow, code: a.arrow, bubbles: true });
        Object.defineProperty(event, 'keyCode', { value: a.keyCode });
        window.dispatchEvent(event);
      }, args)
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Walks with the arrow keys (movement stays keys on every project): to row
 * `y` first, then along it toward `dx` until `near` is `key`, and returns
 * with the player stopped in reach of `key`. Each leg stops at most one
 * frame's steps (6.25 px) past its goal (see `leg`), so the row leg lands
 * within 6.25 px of the row and the along leg inside the 20 px reach; nothing
 * is nudged afterwards. A walk that cannot arrive (pinned on a wall for 30
 * frames and 500 ms, or 20 s on one leg) throws with where the player
 * stopped instead of running out the test's budget.
 *
 * Every walk is recorded as a `walk` annotation on its test, and on CI as a
 * `[walk]` log line: the target, how far the player stopped past the row and
 * past its last position before `near` became the key ('-' for a leg not
 * walked), the nudges taken (always 0) and the walk's wall time.
 */
export async function walkTo(
  page: Page,
  y: number,
  dx: 'left' | 'right',
  key: string,
): Promise<void> {
  const began = Date.now();
  const fail = (what: string, at: Stop): Error =>
    new Error(
      `walkTo(${key}): ${what}: stopped at (${String(at.x)}, ${String(at.y)}), near='${at.near}', room=${at.room}`,
    );
  const record = (row?: number, reach?: number): void => {
    const px = (n?: number): string => (n === undefined ? '-' : n.toFixed(2));
    const description = `key=${key} row_overshoot=${px(row)} reach_overshoot=${px(reach)} nudges=0 ms=${String(Date.now() - began)}`;
    test.info().annotations.push({ type: 'walk', description });
    // Worker stdout reaches the CI log through the github reporter (no-console allows only warn and error).
    if (process.env.CI) process.stdout.write(`[walk] ${description}\n`);
  };

  const h = await hook(page);
  let at: Stop = { x: h.player.x, y: h.player.y, near: h.near, room: h.room };
  let rowOvershoot: number | undefined;
  if (at.y !== y) {
    const down = at.y < y;
    const vertical = await leg(page, down ? 'ArrowDown' : 'ArrowUp', {
      until: 'row',
      row: y,
      down,
    });
    at = vertical.stop;
    if (!vertical.reached) throw fail(`never reached row ${String(y)}`, at);
    rowOvershoot = down ? at.y - y : y - at.y;
  }
  if (at.near === key) {
    record(rowOvershoot);
    return;
  }

  const along = await leg(page, dx === 'left' ? 'ArrowLeft' : 'ArrowRight', { until: 'near', key });
  at = along.stop;
  if (!along.reached) throw fail(`never came in reach walking ${dx}`, at);
  if (at.near !== key) throw fail(`carried out of reach walking ${dx}`, at);
  record(rowOvershoot, Math.abs(at.x - along.before.x));
}

/** Walks straight up or down to row `y`, stopping at most 6.25 px past it (see `leg`), facing the way it walked. */
export async function walkToRow(page: Page, y: number): Promise<void> {
  const down = (await hook(page)).player.y < y;
  const { reached, stop } = await leg(page, down ? 'ArrowDown' : 'ArrowUp', {
    until: 'row',
    row: y,
    down,
  });
  if (!reached) {
    throw new Error(`walkToRow(${String(y)}): stopped at (${String(stop.x)}, ${String(stop.y)})`);
  }
}

export type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Holds `arrow` until `key` is in reach, or not at all if it already is. The
 * walks here end against the wall the player walks into (both doors sit in
 * one, the pedestals in a corner), so the wall stops the walk inside reach
 * however late Playwright's key release lands. (Before backlog #81 walkTo
 * released through Playwright too and a slow runner could carry the player
 * past its target; these walks were written to avoid that.)
 */
export async function holdUntilNear(page: Page, arrow: Arrow, key: string): Promise<void> {
  if ((await hook(page)).near === key) return;
  await page.keyboard.down(arrow);
  await page.waitForFunction((k) => window.__bonsai?.near === k, key);
  await page.keyboard.up(arrow);
}

/** Holds `arrow` (up or left) until the player's coordinate on `axis` is at most `max`; a late release ends at the wall. */
export async function holdUntilAtMost(
  page: Page,
  arrow: Arrow,
  axis: 'x' | 'y',
  max: number,
): Promise<void> {
  await page.keyboard.down(arrow);
  await page.waitForFunction(([a, limit]) => (window.__bonsai?.player[a] ?? NaN) <= limit, [
    axis,
    max,
  ] as const);
  await page.keyboard.up(arrow);
}

/** Holds `arrow` (down or right) until the player's coordinate on `axis` is at least `min`; a late release ends at the wall. */
export async function holdUntilAtLeast(
  page: Page,
  arrow: Arrow,
  axis: 'x' | 'y',
  min: number,
): Promise<void> {
  await page.keyboard.down(arrow);
  await page.waitForFunction(([a, limit]) => (window.__bonsai?.player[a] ?? -Infinity) >= limit, [
    axis,
    min,
  ] as const);
  await page.keyboard.up(arrow);
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

/** Walks up to the planting table's row and left to it (from right of it), then opens the Plant panel. */
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
