/**
 * The planting table's panel (obj_planting_table, obj_ui_plant_cutting) as a
 * PanelModel: the cuttings and the seeds in stock with Select, the pot and
 * premium-soil stock with their toggles, and Plant Cutting (Plant Seed with a
 * seed chosen), greyed with a hint until it can plant. Pure; WorldScene keeps
 * the selection, plants through `plantCutting` or `plantSeed` and reopens the
 * panel after every Select and toggle.
 */

import { inventoryCount } from '../sim/inventory';
import { SEED_KEYS } from '../sim/planting';
import { CUTTING_KEYS } from '../sim/sourcePlant';
import { SPECIES_KEYS, getSpecies } from '../sim/species';
import type { GameState, InventoryKey, Origin, SpeciesKey } from '../sim/types';
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
/** The seeds' column beside the cuttings, and the akadama count's where the rows need a taller pitch: the box's right half. */
const SEED_COLUMN_X = TALL_PANEL.x + TALL_PANEL.w / 2;
/** A column's Select, past `Japanese Maple  x999` (20 characters at 6 px) and a gap. */
const COLUMN_SELECT_DX = 130;

/** The panel's scene state, never saved: what is chosen (a cutting or a seed of a species) and the two flags. */
export interface PlantSelection {
  readonly kind: Origin;
  readonly species: SpeciesKey | undefined;
  readonly useFancyPot: boolean;
  readonly usePremiumSoil: boolean;
}

export const NO_SELECTION: PlantSelection = {
  kind: 'cutting',
  species: undefined,
  useFancyPot: false,
  usePremiumSoil: false,
};

/** The control id of the Select button of `species`' cutting, or of its seed. */
export function selectId(species: SpeciesKey, kind: Origin = 'cutting'): string {
  return kind === 'seed' ? `panel-select-seed-${species}` : `panel-select-${species}`;
}

/** `selection` with each flag cleared while its stock is 0, as the prototype's draw did. */
export function plantSelection(
  state: Pick<GameState, 'inventory'>,
  selection: PlantSelection,
): PlantSelection {
  return {
    kind: selection.kind,
    species: selection.species,
    useFancyPot: selection.useFancyPot && inventoryCount(state.inventory, 'fancy_pot') > 0,
    usePremiumSoil: selection.usePremiumSoil && inventoryCount(state.inventory, 'soil_premium') > 0,
  };
}

/** The species of each `kind` in stock, in SPECIES_KEYS order, with the count. */
function inStock(state: Pick<GameState, 'inventory'>, kind: Origin): [SpeciesKey, number][] {
  const keys: Partial<Record<SpeciesKey, InventoryKey>> =
    kind === 'seed' ? SEED_KEYS : CUTTING_KEYS;
  return SPECIES_KEYS.flatMap((species): [SpeciesKey, number][] => {
    const key = keys[species];
    const count = key === undefined ? 0 : inventoryCount(state.inventory, key);
    return count > 0 ? [[species, count]] : [];
  });
}

const toggle = (on: boolean, label: string): string => `[${on ? 'x' : ' '}] ${label}`;

type Row = Omit<PanelRow, 'y'>;

/**
 * The planting table's panel over `state` with `selection` (flags cleared at
 * 0 stock first). With both cuttings and seeds in stock the seeds run down
 * the box's right half beside the cuttings. Where the rows need a taller
 * pitch (`needsFit`), the hint shares the Plant line, right of it, and
 * `Akadama mix: N` shares the pots' line in the right half, so the box still
 * fits the canvas.
 */
export function plantPanel(
  state: Pick<GameState, 'inventory'>,
  selection: PlantSelection,
  ui: UiMetrics = DESKTOP_UI,
): PanelModel {
  const sel = plantSelection(state, selection);
  const fit = needsFit(TALL_PANEL, ui);
  const count = (key: 'pot' | 'fancy_pot' | 'soil_premium') => inventoryCount(state.inventory, key);
  const plain = (text: string, color = TEXT_COLOR): Row[] => [{ text, id: '', color }];
  const section = (kind: Origin, x: number, selectX: number): Row[][] => {
    const stock = inStock(state, kind);
    if (stock.length === 0) return [];
    const header = kind === 'seed' ? 'Seeds:' : 'Available cuttings:';
    return [
      [{ text: header, id: '', color: TEXT_COLOR, x }],
      ...stock.map(([species, n]): Row[] => [
        { text: `${getSpecies(species).displayName}  x${String(n)}`, id: '', color: TEXT_COLOR, x },
        sel.kind === kind && sel.species === species
          ? { text: 'Selected', id: '', x: selectX }
          : { text: 'Select', id: selectId(species, kind), x: selectX },
      ]),
    ];
  };
  const left = TALL_PANEL.x + PANEL_INSET;
  // TALL_PANEL holds ten lines at the desktop pitch: with both in stock the seeds take the right half.
  const columns = inStock(state, 'cutting').length > 0 && inStock(state, 'seed').length > 0;
  const cuttings = section('cutting', left, columns ? left + COLUMN_SELECT_DX : SELECT_X);
  const seeds = columns
    ? section('seed', SEED_COLUMN_X, SEED_COLUMN_X + COLUMN_SELECT_DX)
    : section('seed', left, SELECT_X);
  const lines: Row[][] = columns
    ? Array.from({ length: Math.max(cuttings.length, seeds.length) }, (_, i) => [
        ...(cuttings[i] ?? []),
        ...(seeds[i] ?? []),
      ])
    : [...cuttings, ...seeds];
  if (lines.length === 0) {
    lines.push(plain('No cuttings or seeds available.', NONE_COLOR));
    lines.push(plain('Take some from plants in the garden.', NONE_COLOR));
  }
  const pots = plain(`Pots: ${String(count('pot'))}  |  Fancy pots: ${String(count('fancy_pot'))}`);
  const akadama = plain(`Akadama mix: ${String(count('soil_premium'))}`);
  lines.push(fit ? [...pots, ...akadama.map((row) => ({ ...row, x: SEED_COLUMN_X }))] : pots);
  if (count('fancy_pot') > 0) {
    lines.push([
      { text: toggle(sel.useFancyPot, 'Use fancy pot (+25% display)'), id: 'panel-fancy' },
    ]);
  }
  if (!fit) lines.push(akadama);
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
  const label = sel.species !== undefined && sel.kind === 'seed' ? 'Plant Seed' : 'Plant Cutting';
  const plant = { text: label, id: 'panel-plant', enabled: canPlant };
  // The prototype's `You need a fancy pot.` never shows: the fancy flag clears at 0 stock first.
  const hint = canPlant
    ? []
    : plain(
        sel.species === undefined ? 'Select a cutting or seed first.' : 'You need a pot.',
        HINT_COLOR,
      );
  if (fit) {
    lines.push([plant, ...hint.map((row) => ({ ...row, x: HINT_BESIDE_X }))]);
  } else {
    if (hint.length > 0) lines.push(hint);
    lines.push([plant]);
  }
  return {
    key: 'plant',
    title: 'Plant',
    box: TALL_PANEL,
    rows: lines.flatMap((line, i) =>
      line.map((row) => ({ x: left, ...row, y: rowY(TALL_PANEL, i) })),
    ),
  };
}
