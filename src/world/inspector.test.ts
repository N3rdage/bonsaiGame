import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserializeSave } from '../sim/save';
import { createNewGameState } from '../sim/state';
import { TUTORIAL_DONE, TUTORIAL_SKIP_WEEK, TUTORIAL_TRAIN, TUTORIAL_WATER } from '../sim/tutorial';
import type { BonsaiTree, GameState } from '../sim/types';
import {
  GLYPH_W,
  INSPECTOR_INSET,
  INSPECTOR_LINE,
  INSPECTOR_PANEL,
  INSPECTOR_TITLE_H,
  SKIP_DAYS,
  SMALL_GLYPH_W,
  inspectorAction,
  inspectorPanel,
  type InspectorModel,
} from './inspector';

const NEVER = (): number => 0.99;

function starter(): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  const tree = state.trees[0];
  if (!tree) throw new Error('no starter');
  return { state, tree };
}

/** The day-730 prototype save: autumn, 3 fertiliser, two trained junipers with premium soil. */
function day730(): { state: GameState; tree: BonsaiTree } {
  const text = readFileSync(
    new URL('../sim/__fixtures__/prototype-save-v1-day730.json', import.meta.url),
    'utf8',
  );
  const state = deserializeSave(text);
  const tree = state.trees[0];
  if (!tree) throw new Error('no fixture tree');
  return { state, tree };
}

const texts = (lines: readonly { text: string }[]): string[] => lines.map((l) => l.text);
const enabled = (m: InspectorModel): string[] =>
  m.buttons.filter((b) => b.enabled).map((b) => b.id);

describe('inspector panel model', () => {
  it('shows the new-game starter as the prototype did', () => {
    const { state, tree } = starter();
    const m = inspectorPanel(tree, state);
    expect([m.key, m.title]).toEqual(['tree:0', "Granny's"]);
    expect(texts(m.stats)).toEqual([
      'Species: Juniper',
      'Age: 0 days  |  Origin: seed',
      'Trunk: 25.0 cm tall, 18.0 mm thick',
      'Branches: 4  |  Style: (none)',
      'Pot: Standard  |  Soil: Basic',
    ]);
    // lastRepotDay starts at 0, so a new tree waits out the cooldown, as in the prototype.
    expect(texts(m.notes)).toEqual(['Repot: cooldown - wait 60d']);
    expect(m.bars.map((b) => [b.label, b.text])).toEqual([
      ['Vitality', '100/100'],
      ['Water', '50/100'],
      ['Vigor', '50/100'],
    ]);
    expect(m.buttons.map((b) => b.label)).toEqual([
      'Water',
      'Fertilise',
      'Skip 7d (4f)',
      'Pick up',
      'View in 3D',
    ]);
    expect(enabled(m)).toEqual(['water', 'fertilise', 'skip', 'pickup', 'view']);
    expect(m.footer.text).toBe('Fertilizer: 50  |  Wire: 10  |  Day: 0  |  $100');
  });

  it('formats the score and its breakdown from scoreTree', () => {
    const { state, tree } = starter();
    const m = inspectorPanel(tree, state);
    expect(m.score.text).toMatch(/^Score: \d+ \/ 100$/);
    const last = m.breakdown.at(-1);
    expect([last?.label.text, last?.value.text]).toEqual(['Vitality', 'x 1.00']);
    tree.vitality = 87.5;
    expect(inspectorPanel(tree, state).breakdown.at(-1)?.value.text).toBe('x 0.88');
    for (const c of m.breakdown.slice(0, -1)) expect(c.value.text).toMatch(/^\d+\.\d pts$/);
    expect(m.breakdown.map((c) => c.label.text)).toEqual([
      'Trunk taper',
      'Trunk proportion',
      'Branch count',
      'Angular spread',
      'Vertical spread',
      'Foliage',
      'Vitality',
    ]);
  });

  it('shows a fixture tree: style, fancy pot, premium soil, dormancy and repot notes', () => {
    const { state, tree } = day730();
    const m = inspectorPanel(tree, state);
    expect(m.title).toBe("Granny's");
    expect(m.stats[3]?.text).toMatch(/^Branches: \d+ {2}\| {2}Style: /);
    expect(m.stats[3]?.text).not.toContain('(none)');
    expect(m.stats[4]?.text).toBe(
      `Pot: ${tree.potTier === 1 ? 'Fancy (+25% display)' : 'Standard'}  |  Soil: ${
        tree.soilTier === 1 ? 'Akadama (slower vigor loss)' : 'Basic'
      }`,
    );
    // Day 730 is autumn: the juniper still grows, a repot needs spring.
    expect(texts(m.notes)).toEqual(['Repot: requires spring']);
    expect(m.breakdown.some((c) => c.label.text.startsWith('Style: '))).toBe(true);
    expect(m.footer.text).toBe(
      `Fertilizer: 3  |  Wire: ${String(state.inventory.wire)}  |  Day: 730  |  $${String(state.money)}`,
    );
    expect(enabled(m)).toEqual(['water', 'fertilise', 'pickup', 'view']);
  });

  it('notes dormancy, cooldown and low vigor', () => {
    const { state, tree } = starter();
    state.day = 85; // winter
    expect(texts(inspectorPanel(tree, state).notes)).toEqual([
      'Dormant - Winter operations limited',
      'Repot: requires spring',
    ]);
    state.day = 120; // spring, year 2
    tree.lastRepotDay = 100;
    expect(texts(inspectorPanel(tree, state).notes)).toEqual(['Repot: cooldown - wait 40d']);
    tree.lastRepotDay = 0;
    tree.vigor = 30;
    expect(texts(inspectorPanel(tree, state).notes)).toEqual([
      'Low vigor - repotting would refresh it',
    ]);
  });

  it('greys Fertilise in dormancy and without fertiliser, Skip below its cost', () => {
    const { state, tree } = starter();
    state.day = 85;
    expect(enabled(inspectorPanel(tree, state))).toEqual(['water', 'skip', 'pickup', 'view']);
    state.day = 0;
    state.inventory.fertilizer = 3;
    expect(enabled(inspectorPanel(tree, state))).toEqual(['water', 'fertilise', 'pickup', 'view']);
    state.inventory.fertilizer = 0;
    expect(enabled(inspectorPanel(tree, state))).toEqual(['water', 'pickup', 'view']);
  });

  it('adds the fertilised days left to the footer', () => {
    const { state, tree } = starter();
    expect(inspectorAction(state, tree, 'fertilise')).toBe(true);
    state.day = 3;
    expect(inspectorPanel(tree, state).footer.text).toBe(
      'Fertilizer: 49  |  Wire: 10  |  Day: 3  |  $100  |  Fertilized: 4d left',
    );
  });
});

describe('inspector layout', () => {
  const { x, y, w, h } = INSPECTOR_PANEL;
  const models = [
    inspectorPanel(starter().tree, starter().state),
    inspectorPanel(day730().tree, day730().state),
  ];
  const winter = starter();
  winter.state.day = 85;
  models.push(inspectorPanel(winter.tree, winter.state));

  it('centres a box larger than the 400x150 panel inside 480x270', () => {
    expect(x * 2 + w).toBe(480);
    expect(y * 2 + h).toBe(270);
    expect(w).toBeGreaterThan(400);
    expect(h).toBeGreaterThan(150);
  });

  it('keeps every line inside the box, under the title bar', () => {
    for (const m of models) {
      const lines = [
        ...m.stats,
        ...m.notes,
        m.score,
        ...m.breakdown.flatMap((c) => [c.label, c.value]),
        m.footer,
      ];
      for (const line of lines) {
        expect(line.y - INSPECTOR_LINE / 2).toBeGreaterThanOrEqual(y + INSPECTOR_TITLE_H);
        expect(line.y + INSPECTOR_LINE / 2).toBeLessThanOrEqual(y + h);
        expect(line.x).toBeGreaterThanOrEqual(x + INSPECTOR_INSET);
        expect(line.x + line.text.length * SMALL_GLYPH_W).toBeLessThanOrEqual(
          x + w - INSPECTOR_INSET,
        );
      }
    }
  });

  it('stacks the rows without overlap: stats, notes, then bars and score, buttons, footer', () => {
    for (const m of models) {
      const top = [...m.stats, ...m.notes].map((l) => l.y);
      for (let i = 1; i < top.length; i++) {
        expect((top[i] ?? 0) - (top[i - 1] ?? 0)).toBeGreaterThanOrEqual(INSPECTOR_LINE);
      }
      const lowest = Math.max(...top);
      expect(m.score.y - lowest).toBeGreaterThanOrEqual(INSPECTOR_LINE);
      expect((m.bars[0]?.y ?? 0) - lowest).toBeGreaterThanOrEqual(INSPECTOR_LINE);
      const lower = [...m.bars.map((b) => b.y), ...m.breakdown.map((c) => c.label.y)];
      const button = m.buttons[0]?.y ?? 0;
      expect(button - Math.max(...lower)).toBeGreaterThanOrEqual(INSPECTOR_LINE);
      expect(m.footer.y - button).toBeGreaterThanOrEqual(INSPECTOR_LINE);
    }
  });

  it('keeps the bars column clear of the score column', () => {
    for (const m of models) {
      const barsRight = Math.max(...m.bars.map((b) => b.textX + b.text.length * SMALL_GLYPH_W));
      const scoreLeft = Math.min(m.score.x, ...m.breakdown.map((c) => c.label.x));
      expect(barsRight).toBeLessThan(scoreLeft);
      for (const b of m.bars) {
        expect(b.x + b.label.length * SMALL_GLYPH_W).toBeLessThan(b.trackX);
        expect(b.trackX + b.trackW).toBeLessThan(b.textX);
      }
      for (const c of m.breakdown) {
        expect(c.label.x + c.label.text.length * SMALL_GLYPH_W).toBeLessThan(c.value.x);
      }
    }
  });

  it('spreads the five buttons across the box, left to right, the last inside the edge', () => {
    for (const m of models) {
      const b = m.buttons;
      expect(b).toHaveLength(5);
      for (let i = 1; i < b.length; i++) {
        const prev = b[i - 1];
        const cur = b[i];
        if (!prev || !cur) throw new Error('buttons');
        expect(cur.x).toBeGreaterThan(prev.x + prev.label.length * GLYPH_W);
      }
      const last = b.at(-1);
      if (!last) throw new Error('buttons');
      expect(last.x + last.label.length * GLYPH_W).toBeLessThanOrEqual(x + w - INSPECTOR_INSET);
      expect(b[0]?.x).toBe(x + INSPECTOR_INSET);
    }
  });
});

describe('inspector actions', () => {
  it('waters to 100 and advances the Water tutorial step', () => {
    const { state, tree } = starter();
    expect(state.tutorialStep).toBe(TUTORIAL_WATER);
    expect(inspectorAction(state, tree, 'water')).toBe(true);
    expect(tree.waterLevel).toBe(100);
    expect(state.tutorialStep).toBe(TUTORIAL_SKIP_WEEK);
  });

  it('waters without rewinding a later tutorial step', () => {
    const { state, tree } = starter();
    state.tutorialStep = TUTORIAL_DONE;
    expect(inspectorAction(state, tree, 'water')).toBe(true);
    expect(state.tutorialStep).toBe(TUTORIAL_DONE);
  });

  it('fertilises for 7 days at the cost of one', () => {
    const { state, tree } = starter();
    expect(inspectorAction(state, tree, 'fertilise')).toBe(true);
    expect(state.inventory.fertilizer).toBe(49);
    expect(tree.fertilizedUntilDay).toBe(7);
  });

  it('refuses Fertilise in dormancy and without fertiliser, consuming nothing', () => {
    const { state, tree } = starter();
    state.day = 85;
    expect(inspectorAction(state, tree, 'fertilise')).toBe(false);
    expect(state.inventory.fertilizer).toBe(50);
    state.day = 0;
    state.inventory.fertilizer = 0;
    expect(inspectorAction(state, tree, 'fertilise')).toBe(false);
    expect(tree.fertilizedUntilDay).toBe(0);
  });

  it('skips 7 days for 4 fertiliser and advances the Skip tutorial step', () => {
    const { state, tree } = starter();
    state.tutorialStep = TUTORIAL_SKIP_WEEK;
    const age = tree.ageDays;
    const revision = tree.revision;
    expect(inspectorAction(state, tree, 'skip', NEVER)).toBe(true);
    expect(state.inventory.fertilizer).toBe(46);
    expect(tree.ageDays).toBe(age + SKIP_DAYS);
    expect(tree.revision).toBeGreaterThan(revision);
    expect(state.tutorialStep).toBe(TUTORIAL_TRAIN);
  });

  it('refuses Skip with too little fertiliser and leaves the tutorial where it was', () => {
    const { state, tree } = starter();
    state.tutorialStep = TUTORIAL_SKIP_WEEK;
    state.inventory.fertilizer = 3;
    const before = structuredClone(tree);
    expect(inspectorAction(state, tree, 'skip', NEVER)).toBe(false);
    expect(state.inventory.fertilizer).toBe(3);
    expect(tree).toEqual(before);
    expect(state.tutorialStep).toBe(TUTORIAL_SKIP_WEEK);
  });
});
