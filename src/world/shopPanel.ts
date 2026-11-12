/**
 * The shop kiosk's panel (obj_shop_kiosk, obj_ui_shop) as a PanelModel:
 * `Item`, `Price` and `Owned` headers over each block, one line per
 * SHOP_CATALOGUE entry with its `Buy` button, and the `Money: $N` footer. Pure; WorldScene draws it and
 * buys through `shopBuy`, then reopens it with the new state.
 */

import { inventoryCount } from '../sim/inventory';
import { SHOP_CATALOGUE, type ShopItem } from '../sim/shop';
import type { GameState } from '../sim/types';
import { PANEL_INSET, needsFit, panelClose, rowY, type PanelModel, type PanelRow } from './panels';
import { DESKTOP_UI, type UiMetrics } from './uiScale';

/** The prop whose interaction opens the shop. */
export const SHOP_KIOSK_KEY = 'shop_kiosk';

/**
 * The shop's box, centred on the canvas: two blocks side by side, each with
 * headers and up to `SHOP_ROWS_PER_BLOCK` items, and the footer above Close.
 */
export const SHOP_PANEL = { x: 10, y: 25, w: 460, h: 220, rowSpacing: 20 } as const;

/**
 * Items per block: six lines of Buy buttons is what the box holds at a
 * phone's tap pitch, so the catalogue's seed packets start a second block.
 */
export const SHOP_ROWS_PER_BLOCK = 6;

/** Left edges of block `block`'s columns (obj_ui_shop's item, price, owned and buy columns, scaled to half the box). */
export function shopColumns(block: number): {
  item: number;
  price: number;
  owned: number;
  buy: number;
} {
  const left = SHOP_PANEL.x + (block * SHOP_PANEL.w) / 2;
  return { item: left + PANEL_INSET, price: left + 100, owned: left + 140, buy: left + 185 };
}

/** obj_ui_shop's header colour, rgb(140, 180, 120), and its footer's, rgb(150, 150, 150). */
export const SHOP_HEADER_COLOR = '#8cb478';
export const SHOP_FOOTER_COLOR = '#969696';
const ITEM_COLOR = '#ffffff';

/** The control id of `item`'s Buy button. */
export function buyId(item: ShopItem): string {
  return `panel-buy-${item.key}`;
}

/** The catalogue entry a Buy control id names, if any. */
export function shopItemFor(id: string): ShopItem | undefined {
  return SHOP_CATALOGUE.find((item) => buyId(item) === id);
}

/**
 * The shop over `state`: a Buy is enabled only while the player can afford
 * one unit. Where the Buy rows need a taller pitch (`needsFit`), the footer
 * moves onto Close's line, left of it, so the box still fits the canvas.
 */
export function shopPanel(
  state: Pick<GameState, 'money' | 'inventory'>,
  ui: UiMetrics = DESKTOP_UI,
): PanelModel {
  const cell = (line: number, x: number, text: string, color = ITEM_COLOR): PanelRow => ({
    text,
    id: '',
    x,
    y: rowY(SHOP_PANEL, line),
    color,
  });
  const blocks = Math.ceil(SHOP_CATALOGUE.length / SHOP_ROWS_PER_BLOCK);
  const header = Array.from({ length: blocks }, (_, b) => shopColumns(b)).flatMap((cols) => [
    cell(0, cols.item, 'Item', SHOP_HEADER_COLOR),
    cell(0, cols.price, 'Price', SHOP_HEADER_COLOR),
    cell(0, cols.owned, 'Owned', SHOP_HEADER_COLOR),
  ]);
  const items = SHOP_CATALOGUE.flatMap((item, i) => {
    const cols = shopColumns(Math.floor(i / SHOP_ROWS_PER_BLOCK));
    const line = (i % SHOP_ROWS_PER_BLOCK) + 1;
    return [
      cell(line, cols.item, item.label),
      cell(line, cols.price, `$${String(item.price)}`),
      cell(line, cols.owned, String(inventoryCount(state.inventory, item.key))),
      {
        text: 'Buy',
        id: buyId(item),
        x: cols.buy,
        y: rowY(SHOP_PANEL, line),
        enabled: state.money >= item.price,
      },
    ];
  });
  const money = `Money: $${String(state.money)}`;
  const left = shopColumns(0).item;
  const footer = needsFit(SHOP_PANEL, ui)
    ? { ...cell(0, left, money, SHOP_FOOTER_COLOR), y: panelClose(SHOP_PANEL).y }
    : cell(SHOP_ROWS_PER_BLOCK + 1, left, money, SHOP_FOOTER_COLOR);
  return { key: 'shop', title: 'Shop', box: SHOP_PANEL, rows: [...header, ...items, footer] };
}
