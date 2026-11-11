import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import type { GameState } from '../sim/types';
import { TALL_PANEL, fitRows, panelClose, panelTitleY } from './panels';
import {
  HINT_COLOR,
  NONE_COLOR,
  NO_SELECTION,
  PLANTING_TABLE_KEY,
  WORKBENCH_KEY,
  plantPanel,
  plantSelection,
  type PlantSelection,
} from './plantPanel';
import { SHED_ROOM } from './shedRoom';
import { DESKTOP_UI, PHONE_UI, type UiMetrics } from './uiScale';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): generous upper bounds of a glyph's width and a line's height.
const GLYPH_W = 6;
const LINE_H = 12;

/** Each line's texts, left to right. */
const lines = (
  state: GameState,
  sel: PlantSelection = NO_SELECTION,
  ui: UiMetrics = DESKTOP_UI,
): string[][] => {
  const byY = new Map<number, string[]>();
  for (const row of plantPanel(state, sel, ui).rows) {
    byY.set(row.y, [...(byY.get(row.y) ?? []), row.text]);
  }
  return [...byY.values()];
};

/** The ids of the rows that are controls (an id and not greyed). */
const controls = (
  state: GameState,
  sel: PlantSelection = NO_SELECTION,
  ui: UiMetrics = DESKTOP_UI,
): string[] =>
  plantPanel(state, sel, ui)
    .rows.filter((r) => r.id !== '' && r.enabled !== false)
    .map((r) => r.id);

/** A new game (a juniper and a maple seed) with cuttings, a fancy pot and akadama. */
const stocked = (): GameState => {
  const state = createNewGameState();
  state.inventory.cutting_juniper = 2;
  state.inventory.cutting_maple = 1;
  state.inventory.fancy_pot = 1;
  state.inventory.soil_premium = 3;
  return state;
};

/** A new game with no seeds. */
const empty = (): GameState => {
  const state = createNewGameState();
  state.inventory.seed_juniper = 0;
  state.inventory.seed_maple = 0;
  return state;
};

const cutting = (species: 'juniper' | 'maple'): PlantSelection => ({
  ...NO_SELECTION,
  species,
});
const seed = (species: 'juniper' | 'maple'): PlantSelection => ({
  ...NO_SELECTION,
  kind: 'seed',
  species,
});

describe('plant panel', () => {
  it('opens from the planting table; the workbench makes pots', () => {
    const prompts = Object.fromEntries(SHED_ROOM.props.map((p) => [p.key, p.prompt]));
    expect(prompts[PLANTING_TABLE_KEY]).toBe('Plant Cutting');
    expect(prompts[WORKBENCH_KEY]).toBe('Make Pot');
    const model = plantPanel(createNewGameState(), NO_SELECTION);
    expect([model.key, model.title, model.box]).toEqual(['plant', 'Plant', TALL_PANEL]);
  });

  it('says so with no cuttings or seeds, in pink, and greys Plant with the select hint', () => {
    const model = plantPanel(empty(), NO_SELECTION);
    expect(lines(empty())).toEqual([
      ['No cuttings or seeds available.'],
      ['Take some from plants in the garden.'],
      ['Pots: 2  |  Fancy pots: 0'],
      ['Akadama mix: 0'],
      ['Select a cutting or seed first.'],
      ['Plant Cutting'],
    ]);
    expect(model.rows[0]?.color).toBe(NONE_COLOR);
    expect(model.rows[1]?.color).toBe(NONE_COLOR);
    expect(model.rows[4]?.color).toBe(HINT_COLOR);
    expect(model.rows[5]).toMatchObject({ id: 'panel-plant', enabled: false });
    expect(controls(empty())).toEqual([]);
  });

  it("lists a new game's seeds with Select and no cuttings section", () => {
    const state = createNewGameState();
    expect(lines(state)).toEqual([
      ['Seeds:'],
      ['Juniper  x1', 'Select'],
      ['Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 0'],
      ['Akadama mix: 0'],
      ['Select a cutting or seed first.'],
      ['Plant Cutting'],
    ]);
    expect(controls(state)).toEqual(['panel-select-seed-juniper', 'panel-select-seed-maple']);
  });

  it('lists only the cuttings in species order when no seeds are in stock', () => {
    const state = stocked();
    state.inventory.seed_juniper = 0;
    state.inventory.seed_maple = 0;
    expect(lines(state).slice(0, 3)).toEqual([
      ['Available cuttings:'],
      ['Juniper  x2', 'Select'],
      ['Japanese Maple  x1', 'Select'],
    ]);
    expect(controls(state).slice(0, 2)).toEqual(['panel-select-juniper', 'panel-select-maple']);
  });

  it('sets the seeds beside the cuttings in species order with Select, the toggles while in stock', () => {
    const state = stocked();
    expect(lines(state)).toEqual([
      ['Available cuttings:', 'Seeds:'],
      ['Juniper  x2', 'Select', 'Juniper  x1', 'Select'],
      ['Japanese Maple  x1', 'Select', 'Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 1'],
      ['[ ] Use fancy pot (+25% display)'],
      ['Akadama mix: 3'],
      ['[ ] Use premium soil (slower vigor loss)'],
      ['Select a cutting or seed first.'],
      ['Plant Cutting'],
    ]);
    const model = plantPanel(state, NO_SELECTION);
    expect(model.rows.find((r) => r.text === 'Juniper  x1')?.x).toBe(240);
    expect(controls(state)).toEqual([
      'panel-select-juniper',
      'panel-select-seed-juniper',
      'panel-select-maple',
      'panel-select-seed-maple',
      'panel-fancy',
      'panel-soil',
    ]);
  });

  it('marks the chosen cutting Selected, ticks the toggles and enables Plant Cutting', () => {
    const state = stocked();
    const sel = { ...cutting('juniper'), useFancyPot: true, usePremiumSoil: true };
    expect(lines(state, sel)).toEqual([
      ['Available cuttings:', 'Seeds:'],
      ['Juniper  x2', 'Selected', 'Juniper  x1', 'Select'],
      ['Japanese Maple  x1', 'Select', 'Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 1'],
      ['[x] Use fancy pot (+25% display)'],
      ['Akadama mix: 3'],
      ['[x] Use premium soil (slower vigor loss)'],
      ['Plant Cutting'],
    ]);
    expect(controls(state, sel)).toEqual([
      'panel-select-seed-juniper',
      'panel-select-maple',
      'panel-select-seed-maple',
      'panel-fancy',
      'panel-soil',
      'panel-plant',
    ]);
  });

  it('marks the chosen seed Selected, not the cutting of its species, and offers Plant Seed', () => {
    const state = stocked();
    const sel = seed('juniper');
    expect(lines(state, sel).slice(0, 3)).toEqual([
      ['Available cuttings:', 'Seeds:'],
      ['Juniper  x2', 'Select', 'Juniper  x1', 'Selected'],
      ['Japanese Maple  x1', 'Select', 'Japanese Maple  x1', 'Select'],
    ]);
    expect(lines(state, sel).at(-1)).toEqual(['Plant Seed']);
    expect(controls(state, sel)).toEqual([
      'panel-select-juniper',
      'panel-select-maple',
      'panel-select-seed-maple',
      'panel-fancy',
      'panel-soil',
      'panel-plant',
    ]);
  });

  it('greys Plant with the pot hint when the chosen pot kind is out', () => {
    const state = stocked();
    state.inventory.pot = 0;
    expect(lines(state, cutting('maple')).slice(-2)).toEqual([
      ['You need a pot.'],
      ['Plant Cutting'],
    ]);
    expect(lines(state, seed('maple')).slice(-2)).toEqual([['You need a pot.'], ['Plant Seed']]);
    expect(controls(state, cutting('maple'))).not.toContain('panel-plant');
    expect(controls(state, seed('maple'))).not.toContain('panel-plant');
    state.inventory.pot = 2;
    expect(controls(state, cutting('maple'))).toContain('panel-plant');
    expect(controls(state, seed('maple'))).toContain('panel-plant');
  });

  it('clears the fancy and soil flags while their stock is 0', () => {
    const state = stocked();
    const sel = { ...cutting('juniper'), useFancyPot: true, usePremiumSoil: true };
    expect(plantSelection(state, sel)).toEqual(sel);
    state.inventory.fancy_pot = 0;
    state.inventory.soil_premium = 0;
    expect(plantSelection(state, sel)).toEqual({
      ...sel,
      useFancyPot: false,
      usePremiumSoil: false,
    });
    // The fancy flag cleared, so Plant falls back to the standard pots in stock.
    expect(controls(state, sel)).toEqual([
      'panel-select-seed-juniper',
      'panel-select-maple',
      'panel-select-seed-maple',
      'panel-plant',
    ]);
    state.inventory.pot = 0;
    expect(lines(state, sel).at(-2)).toEqual(['You need a pot.']);
  });

  it('never asks for a fancy pot: the fancy flag only holds while one is in stock', () => {
    const state = stocked();
    state.inventory.pot = 0;
    const sel = { ...cutting('juniper'), useFancyPot: true };
    expect(controls(state, sel)).toContain('panel-plant');
    state.inventory.fancy_pot = 0;
    expect(lines(state, sel).slice(-2)).toEqual([['You need a pot.'], ['Plant Cutting']]);
  });

  it('sets the seeds beside the cuttings, akadama beside the pots and the hint beside Plant on the phone', () => {
    const state = stocked();
    expect(lines(state, NO_SELECTION, PHONE_UI)).toEqual([
      ['Available cuttings:', 'Seeds:'],
      ['Juniper  x2', 'Select', 'Juniper  x1', 'Select'],
      ['Japanese Maple  x1', 'Select', 'Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 1', 'Akadama mix: 3'],
      ['[ ] Use fancy pot (+25% display)'],
      ['[ ] Use premium soil (slower vigor loss)'],
      ['Plant Cutting', 'Select a cutting or seed first.'],
    ]);
    expect(controls(state, NO_SELECTION, PHONE_UI)).toEqual([
      'panel-select-juniper',
      'panel-select-seed-juniper',
      'panel-select-maple',
      'panel-select-seed-maple',
      'panel-fancy',
      'panel-soil',
    ]);
    // Only seeds: one column, at the left.
    expect(lines(createNewGameState(), seed('maple'), PHONE_UI).slice(0, 3)).toEqual([
      ['Seeds:'],
      ['Juniper  x1', 'Select'],
      ['Japanese Maple  x1', 'Selected'],
    ]);
  });

  it('keeps every line inside the box, a line apart and above Close, at the fullest', () => {
    const state = stocked();
    for (const key of [
      'cutting_juniper',
      'cutting_maple',
      'seed_juniper',
      'seed_maple',
      'pot',
      'fancy_pot',
      'soil_premium',
    ] as const) {
      state.inventory[key] = 999;
    }
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      for (const sel of [NO_SELECTION, cutting('maple'), seed('juniper')]) {
        const model = fitRows(plantPanel(state, sel, ui), ui);
        const box = model.box ?? TALL_PANEL;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.h).toBeLessThanOrEqual(270);
        const rows = model.rows;
        for (const row of rows) {
          const left = row.x ?? NaN;
          const others = rows.filter((r) => r.y === row.y && (r.x ?? NaN) > left);
          const limit = Math.min(box.x + box.w - 10, ...others.map((r) => (r.x ?? NaN) - GLYPH_W));
          expect(left + row.text.length * GLYPH_W).toBeLessThanOrEqual(limit);
        }
        let above = panelTitleY(box);
        expect(above - LINE_H / 2).toBeGreaterThanOrEqual(box.y);
        for (const y of [...new Set(rows.map((r) => r.y))]) {
          expect(y - above).toBeGreaterThanOrEqual(LINE_H);
          above = y;
        }
        const close = panelClose(box);
        expect(close.y - above).toBeGreaterThanOrEqual(LINE_H);
        expect(close.y + LINE_H / 2).toBeLessThanOrEqual(box.y + box.h);
      }
    }
  });
});
