/**
 * The shop kiosk's panel (obj_shop_kiosk, obj_ui_shop) as a PanelModel:
 * `Item`, `Price` and `Owned` headers, one line per SHOP_CATALOGUE entry with
 * its `Buy` button, and the `Money: $N` footer. Pure; WorldScene draws it and
 * buys through `shopBuy`, then reopens it with the new state.
 */

import { inventoryCount } from '../sim/inventory';
import { SHOP_CATALOGUE, type ShopItem } from '../sim/shop';
import type { GameState } from '../sim/types';
import { PANEL_INSET, rowY, type PanelModel, type PanelRow } from './panels';

/** The prop whose interaction opens the shop. */
export const SHOP_KIOSK_KEY = 'shop_kiosk';

/** The shop's box, centred on the canvas: headers, six items and the footer above Close. */
export const SHOP_PANEL = { x: 90, y: 25, w: 300, h: 220, rowSpacing: 20 } as const;

/** Left edges of the columns (obj_ui_shop's 0, 220, 300 and 380 px, scaled to the box). */
export const SHOP_COLUMNS = {
  item: SHOP_PANEL.x + PANEL_INSET,
  price: SHOP_PANEL.x + 130,
  owned: SHOP_PANEL.x + 180,
  buy: SHOP_PANEL.x + 240,
} as const;

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

/** The shop over `state`: a Buy is enabled only while the player can afford one unit. */
export function shopPanel(state: Pick<GameState, 'money' | 'inventory'>): PanelModel {
  const cell = (line: number, x: number, text: string, color = ITEM_COLOR): PanelRow => ({
    text,
    id: '',
    x,
    y: rowY(SHOP_PANEL, line),
    color,
  });
  const header = [
    cell(0, SHOP_COLUMNS.item, 'Item', SHOP_HEADER_COLOR),
    cell(0, SHOP_COLUMNS.price, 'Price', SHOP_HEADER_COLOR),
    cell(0, SHOP_COLUMNS.owned, 'Owned', SHOP_HEADER_COLOR),
  ];
  const items = SHOP_CATALOGUE.flatMap((item, i) => [
    cell(i + 1, SHOP_COLUMNS.item, item.label),
    cell(i + 1, SHOP_COLUMNS.price, `$${String(item.price)}`),
    cell(i + 1, SHOP_COLUMNS.owned, String(inventoryCount(state.inventory, item.key))),
    {
      text: 'Buy',
      id: buyId(item),
      x: SHOP_COLUMNS.buy,
      y: rowY(SHOP_PANEL, i + 1),
      enabled: state.money >= item.price,
    },
  ]);
  const footer = cell(
    SHOP_CATALOGUE.length + 1,
    SHOP_COLUMNS.item,
    `Money: $${String(state.money)}`,
    SHOP_FOOTER_COLOR,
  );
  return { key: 'shop', title: 'Shop', box: SHOP_PANEL, rows: [...header, ...items, footer] };
}
