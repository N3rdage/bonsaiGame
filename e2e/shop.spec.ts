import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  expect,
  hook,
  openShop,
  tapControl,
  test,
} from './drive';

const SEEDS = ['panel-buy-seed_juniper', 'panel-buy-seed_maple', 'panel-buy-seed_pine'];

const buys = (h: BonsaiTestHook): string[] =>
  h.controls.map((c) => c.id).filter((id) => id.startsWith('panel-buy-'));

/** Taps `item`'s Buy and waits for the money to drop; the shop stays open. */
async function buy(page: Page, item: string): Promise<BonsaiTestHook> {
  const before = (await hook(page)).money;
  await tapControl(page, `panel-buy-${item}`);
  await page.waitForFunction((m) => window.__bonsai?.money !== m, before);
  const h = await hook(page);
  expect(h.panel).toBe('shop');
  return h;
}

test.describe('shop kiosk', () => {
  test('buys one Clay for $4, greys out what the money no longer covers, and closes', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openShop(page);
    let h = await hook(page);
    expect(h.money).toBe(100);
    expect(buys(h)).toEqual([
      'panel-buy-clay',
      'panel-buy-pot',
      'panel-buy-wire',
      'panel-buy-fertilizer',
      'panel-buy-fancy_pot',
      'panel-buy-soil_premium',
      ...SEEDS,
    ]);
    expect(h.controls.map((c) => c.id)).toContain('panel-close');

    const clay = h.inventory.clay ?? 0;
    h = await buy(page, 'clay');
    expect([h.money, h.inventory.clay]).toEqual([96, clay + 1]);
    expect(h.hud).toContain('$96');

    // $96 - $80 leaves $16: the Fancy Pot and the Akadama Mix are out of reach.
    h = await buy(page, 'fancy_pot');
    expect([h.money, h.inventory.fancy_pot]).toEqual([16, 1]);
    expect(buys(h)).toEqual([
      'panel-buy-clay',
      'panel-buy-pot',
      'panel-buy-wire',
      'panel-buy-fertilizer',
      ...SEEDS,
    ]);

    h = await buy(page, 'pot');
    expect(h.money).toBe(4);
    expect(buys(h)).toEqual(['panel-buy-clay']);
    h = await buy(page, 'clay');
    expect([h.money, h.inventory.clay, buys(h)]).toEqual([0, clay + 2, []]);

    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect(errors).toEqual([]);
  });

  // e2e/tap.spec.ts checks the nine Buy targets are apart and on the canvas.
  test('sells the three seed packets at $9', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openShop(page);
    let h = await hook(page);
    const pine = h.inventory.seed_pine ?? 0;
    h = await buy(page, 'seed_pine');
    expect([h.money, h.inventory.seed_pine]).toEqual([91, pine + 1]);
    h = await buy(page, 'seed_maple');
    expect([h.money, h.inventory.seed_maple]).toEqual([82, 2]);
    expect(errors).toEqual([]);
  });
});
