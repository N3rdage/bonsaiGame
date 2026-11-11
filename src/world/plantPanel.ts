/**
 * The planting table's panel (obj_planting_table, obj_ui_plant_cutting) as a
 * PanelModel: the cuttings in stock with Select, the pot and premium-soil
 * stock with their toggles, and Plant Cutting, greyed with a hint until it
 * can plant. Pure; WorldScene keeps the selection, plants through
 * `plantCutting` and reopens the panel after every Select and toggle.
 */

import { inventoryCount } from '../sim/inventory';
import { CUTTING_KEYS } from '../sim/sourcePlant';
import { SPECIES_KEYS, getSpecies } from '../sim/species';
import type { GameState, SpeciesKey } from '../sim/types';
import { PANEL_INSET, TALL_PANEL, needsFit, rowY, type PanelModel, type PanelRow } from './panels';
import { DESKTOP_UI, type UiMetrics } from './uiScale';

/** The prop whose interaction opens the panel. */
export const PLANTING_TABLE_KEY = 'planting_table';
/** The prop whose interaction makes a pot. */
export const WORKBENCH_KEY = 'workbench';

/** obj_ui_plant_cutting's "none" pink, rgb(200, 150, 150), and its hint grey, rgb(150, 150, 150). */
export const NONE_COLOR = '#c89696';
export const HINT_COLOR = '#969696';
const TEXT_COLOR = '#ffffff';
/** The Select column, near the box's right edge as the prototype's button was. */
const SELECT_X = TALL_PANEL.x + TALL_PANEL.w - 80;
/** The hint's left edge beside Plant Cutting: past the button's 13 characters at 6 px, and a gap. */
const HINT_BESIDE_X = TALL_PANEL.x + PANEL_INSET + 'Plant Cutting'.length * 6 + 12;

/** The panel's scene state, never saved: the chosen species and the two flags. */
export interface PlantSelection {
  readonly species: SpeciesKey | undefined;
  readonly useFancyPot: boolean;
  readonly usePremiumSoil: boolean;
}

export const NO_SELECTION: PlantSelection = {
  species: undefined,
  useFancyPot: false,
  usePremiumSoil: false,
};

/** The control id of `species`' Select button. */
export function selectId(species: SpeciesKey): string {
  return `panel-select-${species}`;
}

/** `selection` with each flag cleared while its stock is 0, as the prototype's draw did. */
export function plantSelection(
  state: Pick<GameState, 'inventory'>,
  selection: PlantSelection,
): PlantSelection {
  return {
    species: selection.species,
    useFancyPot: selection.useFancyPot && inventoryCount(state.inventory, 'fancy_pot') > 0,
    usePremiumSoil: selection.usePremiumSoil && inventoryCount(state.inventory, 'soil_premium') > 0,
  };
}

/** The species of each cutting in stock, in SPECIES_KEYS order, with the count. */
function cuttings(state: Pick<GameState, 'inventory'>): [SpeciesKey, number][] {
  return SPECIES_KEYS.flatMap((species): [SpeciesKey, number][] => {
    const key = CUTTING_KEYS[species];
    const count = key === undefined ? 0 : inventoryCount(state.inventory, key);
    return count > 0 ? [[species, count]] : [];
  });
}

const toggle = (on: boolean, label: string): string => `[${on ? 'x' : ' '}] ${label}`;

/**
 * Plant a Cutting over `state` with `selection` (flags cleared at 0 stock
 * first). Where the rows need a taller pitch (`needsFit`), the hint shares the
 * Plant Cutting line, right of it, so the box still fits the canvas.
 */
export function plantPanel(
  state: Pick<GameState, 'inventory'>,
  selection: PlantSelection,
  ui: UiMetrics = DESKTOP_UI,
): PanelModel {
  const sel = plantSelection(state, selection);
  const count = (key: 'pot' | 'fancy_pot' | 'soil_premium') => inventoryCount(state.inventory, key);
  const plain = (text: string, color = TEXT_COLOR): Omit<PanelRow, 'y'>[] => [
    { text, id: '', color },
  ];
  const stock = cuttings(state);
  const lines: Omit<PanelRow, 'y'>[][] = [plain('Available cuttings:')];
  for (const [species, n] of stock) {
    const chosen = sel.species === species;
    lines.push([
      { text: `${getSpecies(species).displayName}  x${String(n)}`, id: '', color: TEXT_COLOR },
      chosen
        ? { text: 'Selected', id: '', x: SELECT_X }
        : { text: 'Select', id: selectId(species), x: SELECT_X },
    ]);
  }
  if (stock.length === 0) {
    lines.push(plain('No cuttings available.', NONE_COLOR));
    lines.push(plain('Take some from plants in the garden.', NONE_COLOR));
  }
  lines.push(plain(`Pots: ${String(count('pot'))}  |  Fancy pots: ${String(count('fancy_pot'))}`));
  if (count('fancy_pot') > 0) {
    lines.push([
      { text: toggle(sel.useFancyPot, 'Use fancy pot (+25% display)'), id: 'panel-fancy' },
    ]);
  }
  lines.push(plain(`Akadama mix: ${String(count('soil_premium'))}`));
  if (count('soil_premium') > 0) {
    lines.push([
      {
        text: toggle(sel.usePremiumSoil, 'Use premium soil (slower vigor loss)'),
        id: 'panel-soil',
      },
    ]);
  }
  const potHave = count(sel.useFancyPot ? 'fancy_pot' : 'pot');
  const canPlant = sel.species !== undefined && potHave > 0;
  const plant = { text: 'Plant Cutting', id: 'panel-plant', enabled: canPlant };
  // The prototype's `You need a fancy pot.` never shows: the fancy flag clears at 0 stock first.
  const hint = canPlant
    ? []
    : plain(sel.species === undefined ? 'Select a cutting first.' : 'You need a pot.', HINT_COLOR);
  if (needsFit(TALL_PANEL, ui)) {
    lines.push([plant, ...hint.map((row) => ({ ...row, x: HINT_BESIDE_X }))]);
  } else {
    if (hint.length > 0) lines.push(hint);
    lines.push([plant]);
  }
  return {
    key: 'plant',
    title: 'Plant a Cutting',
    box: TALL_PANEL,
    rows: lines.flatMap((line, i) =>
      line.map((row) => ({ x: TALL_PANEL.x + PANEL_INSET, ...row, y: rowY(TALL_PANEL, i) })),
    ),
  };
}
