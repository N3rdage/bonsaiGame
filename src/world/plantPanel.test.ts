import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import type { GameState } from '../sim/types';
import { TALL_PANEL, panelClose, panelTitleY } from './panels';
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

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): generous upper bounds of a glyph's width and a line's height.
const GLYPH_W = 6;
const LINE_H = 12;

/** Each line's texts, left to right. */
const lines = (state: GameState, sel: PlantSelection = NO_SELECTION): string[][] => {
  const byY = new Map<number, string[]>();
  for (const row of plantPanel(state, sel).rows) {
    byY.set(row.y, [...(byY.get(row.y) ?? []), row.text]);
  }
  return [...byY.values()];
};

/** The ids of the rows that are controls (an id and not greyed). */
const controls = (state: GameState, sel: PlantSelection = NO_SELECTION): string[] =>
  plantPanel(state, sel)
    .rows.filter((r) => r.id !== '' && r.enabled !== false)
    .map((r) => r.id);

const stocked = (): GameState => {
  const state = createNewGameState();
  state.inventory.cutting_juniper = 2;
  state.inventory.cutting_maple = 1;
  state.inventory.fancy_pot = 1;
  state.inventory.soil_premium = 3;
  return state;
};

describe('plant panel', () => {
  it('opens from the planting table; the workbench makes pots', () => {
    const prompts = Object.fromEntries(SHED_ROOM.props.map((p) => [p.key, p.prompt]));
    expect(prompts[PLANTING_TABLE_KEY]).toBe('Plant Cutting');
    expect(prompts[WORKBENCH_KEY]).toBe('Make Pot');
    const model = plantPanel(createNewGameState(), NO_SELECTION);
    expect([model.key, model.title, model.box]).toEqual(['plant', 'Plant a Cutting', TALL_PANEL]);
  });

  it('says so with no cuttings, in pink, and greys Plant with the select hint', () => {
    const model = plantPanel(createNewGameState(), NO_SELECTION);
    expect(lines(createNewGameState())).toEqual([
      ['Available cuttings:'],
      ['No cuttings available.'],
      ['Take some from plants in the garden.'],
      ['Pots: 2  |  Fancy pots: 0'],
      ['Akadama mix: 0'],
      ['Select a cutting first.'],
      ['Plant Cutting'],
    ]);
    expect(model.rows[1]?.color).toBe(NONE_COLOR);
    expect(model.rows[2]?.color).toBe(NONE_COLOR);
    expect(model.rows[5]?.color).toBe(HINT_COLOR);
    expect(model.rows[6]).toMatchObject({ id: 'panel-plant', enabled: false });
    expect(controls(createNewGameState())).toEqual([]);
  });

  it('lists the cuttings in species order with Select, the toggles while in stock', () => {
    const state = stocked();
    expect(lines(state)).toEqual([
      ['Available cuttings:'],
      ['Juniper  x2', 'Select'],
      ['Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 1'],
      ['[ ] Use fancy pot (+25% display)'],
      ['Akadama mix: 3'],
      ['[ ] Use premium soil (slower vigor loss)'],
      ['Select a cutting first.'],
      ['Plant Cutting'],
    ]);
    expect(controls(state)).toEqual([
      'panel-select-juniper',
      'panel-select-maple',
      'panel-fancy',
      'panel-soil',
    ]);
  });

  it('marks the chosen species Selected, ticks the toggles and enables Plant', () => {
    const state = stocked();
    const sel = { species: 'juniper', useFancyPot: true, usePremiumSoil: true } as const;
    expect(lines(state, sel)).toEqual([
      ['Available cuttings:'],
      ['Juniper  x2', 'Selected'],
      ['Japanese Maple  x1', 'Select'],
      ['Pots: 2  |  Fancy pots: 1'],
      ['[x] Use fancy pot (+25% display)'],
      ['Akadama mix: 3'],
      ['[x] Use premium soil (slower vigor loss)'],
      ['Plant Cutting'],
    ]);
    expect(controls(state, sel)).toEqual([
      'panel-select-maple',
      'panel-fancy',
      'panel-soil',
      'panel-plant',
    ]);
  });

  it('greys Plant with the pot hint when the chosen pot kind is out', () => {
    const state = stocked();
    state.inventory.pot = 0;
    const sel = { species: 'maple', useFancyPot: false, usePremiumSoil: false } as const;
    expect(lines(state, sel).slice(-2)).toEqual([['You need a pot.'], ['Plant Cutting']]);
    expect(controls(state, sel)).not.toContain('panel-plant');
    state.inventory.pot = 2;
    expect(controls(state, sel)).toContain('panel-plant');
  });

  it('clears the fancy and soil flags while their stock is 0', () => {
    const state = stocked();
    const sel = { species: 'juniper', useFancyPot: true, usePremiumSoil: true } as const;
    expect(plantSelection(state, sel)).toEqual(sel);
    state.inventory.fancy_pot = 0;
    state.inventory.soil_premium = 0;
    expect(plantSelection(state, sel)).toEqual({
      ...sel,
      useFancyPot: false,
      usePremiumSoil: false,
    });
    // The fancy flag cleared, so Plant falls back to the standard pots in stock.
    expect(controls(state, sel)).toEqual(['panel-select-maple', 'panel-plant']);
    state.inventory.pot = 0;
    expect(lines(state, sel).at(-2)).toEqual(['You need a pot.']);
  });

  it('never asks for a fancy pot: the fancy flag only holds while one is in stock', () => {
    const state = stocked();
    state.inventory.pot = 0;
    const sel = { species: 'juniper', useFancyPot: true, usePremiumSoil: false } as const;
    expect(controls(state, sel)).toContain('panel-plant');
    state.inventory.fancy_pot = 0;
    expect(lines(state, sel).slice(-2)).toEqual([['You need a pot.'], ['Plant Cutting']]);
  });

  it('keeps every line inside the box, a line apart and above Close, at the fullest', () => {
    const state = stocked();
    state.inventory.cutting_juniper = 999;
    state.inventory.cutting_maple = 999;
    state.inventory.pot = 999;
    state.inventory.fancy_pot = 999;
    state.inventory.soil_premium = 999;
    const box = TALL_PANEL;
    for (const sel of [NO_SELECTION, { ...NO_SELECTION, species: 'maple' as const }]) {
      const rows = plantPanel(state, sel).rows;
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
  });
});
