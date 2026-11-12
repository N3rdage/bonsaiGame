import { describe, expect, it } from 'vitest';
import { SHOP_CATALOGUE, shopBuy } from '../sim/shop';
import { createNewGameState } from '../sim/state';
import { PANEL_CLOSE_LABEL, PANEL_INSET, panelClose, panelTitleY } from './panels';
import { SHED_ROOM } from './shedRoom';
import {
  SHOP_KIOSK_KEY,
  SHOP_PANEL,
  SHOP_ROWS_PER_BLOCK,
  shopColumns,
  shopItemFor,
  shopPanel,
} from './shopPanel';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const lines = (state = createNewGameState()) => {
  const byY = new Map<number, string[]>();
  for (const row of shopPanel(state).rows) byY.set(row.y, [...(byY.get(row.y) ?? []), row.text]);
  return [...byY.values()];
};

describe('shop panel', () => {
  it('opens from the shed kiosk, titled Shop', () => {
    expect(SHED_ROOM.props.find((p) => p.key === SHOP_KIOSK_KEY)?.prompt).toBe('Shop');
    const model = shopPanel(createNewGameState());
    expect([model.key, model.title, model.box]).toEqual(['shop', 'Shop', SHOP_PANEL]);
  });

  it('lists the catalogue in order under the headers, with prices, counts and the footer', () => {
    const state = createNewGameState();
    state.inventory.clay = 3;
    state.inventory.fancy_pot = 1;
    state.inventory.seed_pine = 2;
    expect(lines(state)).toEqual([
      ['Item', 'Price', 'Owned', 'Item', 'Price', 'Owned'],
      ['Clay', '$4', '3', 'Buy', 'Juniper Seed', '$9', '1', 'Buy'],
      ['Pot', '$12', String(state.inventory.pot), 'Buy', 'Maple Seed', '$9', '1', 'Buy'],
      ['Wire', '$8', String(state.inventory.wire), 'Buy', 'Pine Seed', '$9', '2', 'Buy'],
      ['Fertilizer', '$10', String(state.inventory.fertilizer), 'Buy'],
      ['Fancy Pot', '$80', '1', 'Buy'],
      ['Akadama Mix', '$18', String(state.inventory.soil_premium), 'Buy'],
      ['Money: $100'],
    ]);
  });

  it('enables a Buy only while the money covers one unit', () => {
    const state = createNewGameState();
    const enabled = () =>
      shopPanel(state)
        .rows.filter((r) => r.id !== '' && r.enabled !== false)
        .map((r) => r.id);
    state.money = 80;
    expect(enabled()).toEqual(SHOP_CATALOGUE.map((i) => `panel-buy-${i.key}`));
    state.money = 79;
    expect(enabled()).not.toContain('panel-buy-fancy_pot');
    state.money = 10;
    expect(enabled()).toEqual([
      'panel-buy-clay',
      'panel-buy-wire',
      'panel-buy-fertilizer',
      'panel-buy-seed_juniper',
      'panel-buy-seed_maple',
      'panel-buy-seed_pine',
    ]);
    state.money = 8;
    expect(enabled()).toEqual(['panel-buy-clay', 'panel-buy-wire']);
    state.money = 3;
    expect(enabled()).toEqual([]);
  });

  it('maps a Buy id back to its item, and a buy shows in the next model', () => {
    const state = createNewGameState();
    const clay = shopItemFor('panel-buy-clay');
    expect(clay).toEqual({ key: 'clay', label: 'Clay', price: 4 });
    expect(shopItemFor('panel-close')).toBeUndefined();
    const owned = state.inventory.clay;
    if (clay) expect(shopBuy(state, clay.key, 1, clay.price)).toBe(true);
    expect(lines(state)[1]).toEqual([
      'Clay',
      '$4',
      String(owned + 1),
      'Buy',
      'Juniper Seed',
      '$9',
      '1',
      'Buy',
    ]);
    expect(lines(state)[7]).toEqual(['Money: $96']);
  });

  it('fits the 480x270 canvas: columns apart, lines apart, all above Close', () => {
    expect(SHOP_PANEL.x * 2 + SHOP_PANEL.w).toBe(480);
    expect(SHOP_PANEL.y * 2 + SHOP_PANEL.h).toBe(270);
    const state = createNewGameState();
    state.money = 9_999_999;
    state.inventory.clay = 999;
    state.inventory.seed_pine = 999;
    const rows = shopPanel(state).rows;
    const edges = [0, 1].flatMap((block) => {
      const cols = shopColumns(block);
      return [cols.item, cols.price, cols.owned, cols.buy];
    });
    expect(edges).toEqual([...edges].sort((a, b) => a - b));
    for (const row of rows) {
      const left = row.x ?? NaN;
      // A block's Buy stops short of the next block's Item, the last one short of the inset.
      const next =
        edges.find((e) => e > left) ?? SHOP_PANEL.x + SHOP_PANEL.w - PANEL_INSET + GLYPH_W;
      // The footer spans the line; columns stay short of the next one.
      const limit = row.text.startsWith('Money') ? SHOP_PANEL.x + SHOP_PANEL.w : next - GLYPH_W;
      expect(left + row.text.length * GLYPH_W).toBeLessThanOrEqual(limit);
    }
    const ys = [...new Set(rows.map((r) => r.y))];
    expect(ys).toHaveLength(SHOP_ROWS_PER_BLOCK + 2);
    expect(SHOP_CATALOGUE.length).toBeLessThanOrEqual(2 * SHOP_ROWS_PER_BLOCK);
    let above = panelTitleY(SHOP_PANEL);
    expect(above - LINE_H / 2).toBeGreaterThanOrEqual(SHOP_PANEL.y);
    for (const y of ys) {
      expect(y - above).toBeGreaterThanOrEqual(LINE_H);
      above = y;
    }
    const close = panelClose(SHOP_PANEL);
    expect(above + LINE_H / 2).toBeLessThanOrEqual(close.y - LINE_H / 2);
    expect(close.y + LINE_H / 2).toBeLessThanOrEqual(SHOP_PANEL.y + SHOP_PANEL.h);
    expect((PANEL_CLOSE_LABEL.length * GLYPH_W) / 2).toBeLessThan(SHOP_PANEL.w / 2);
  });
});
