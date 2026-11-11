import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserializeSave } from '../sim/save';
import { createNewGameState } from '../sim/state';
import { TUTORIAL_DONE, TUTORIAL_SKIP_WEEK, TUTORIAL_TRAIN, TUTORIAL_WATER } from '../sim/tutorial';
import type { BonsaiTree, GameState } from '../sim/types';
import { STYLE_KEYS } from '../sim/styles';
import { MAX_TREE_NAME_LENGTH } from '../sim/tree';
import {
  GLYPH_W,
  INSPECTOR_CLOSE,
  INSPECTOR_CLOSE_LABEL,
  INSPECTOR_FOOTER_Y,
  INSPECTOR_INSET,
  INSPECTOR_LEFT_COLUMN,
  INSPECTOR_PANEL,
  INSPECTOR_SCORE_COLUMN,
  INSPECTOR_TITLE_H,
  INSPECTOR_TOP,
  SKIP_DAYS,
  SMALL_GLYPH_W,
  inspectorAction,
  inspectorButtonRows,
  inspectorFitsOneColumn,
  inspectorLine,
  inspectorPanel,
  type InspectorModel,
  type InspectorText,
} from './inspector';
import {
  DESKTOP_UI,
  PHONE_UI,
  estimatedBox,
  hitRect,
  rectsOverlap,
  type UiMetrics,
  type UiRect,
} from './uiScale';

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

const CARE = ['water', 'fertilise', 'skip', 'pickup', 'view'];
/** The sub-panel buttons a tree whose repot is refused shows: Repot greyed. */
const SUB = ['rename', 'style', 'sell'];
const texts = (lines: readonly { text: string }[]): string[] => lines.map((l) => l.text);
const enabled = (m: InspectorModel): string[] =>
  m.buttons.filter((b) => b.enabled).map((b) => b.id);

describe('inspector panel model', () => {
  it('shows the new-game starter as the prototype did', () => {
    const { state, tree } = starter();
    const m = inspectorPanel(tree, state, DESKTOP_UI);
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
      'Rename',
      'Set Style',
      'Sell',
      'Repot',
    ]);
    expect(enabled(m)).toEqual([...CARE, ...SUB]);
    expect(m.footer.text).toBe('Fertilizer: 50  |  Wire: 10  |  Day: 0  |  $100');
  });

  it('formats the score and its breakdown from scoreTree', () => {
    const { state, tree } = starter();
    const m = inspectorPanel(tree, state, DESKTOP_UI);
    expect(m.score.text).toMatch(/^Score: \d+ \/ 100$/);
    const last = m.breakdown.at(-1);
    expect([last?.label.text, last?.value.text]).toEqual(['Vitality', 'x 1.00']);
    tree.vitality = 87.5;
    expect(inspectorPanel(tree, state, DESKTOP_UI).breakdown.at(-1)?.value.text).toBe('x 0.88');
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
    const m = inspectorPanel(tree, state, DESKTOP_UI);
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
    expect(enabled(m)).toEqual(['water', 'fertilise', 'pickup', 'view', ...SUB]);
  });

  it('notes dormancy, cooldown and low vigor', () => {
    const { state, tree } = starter();
    state.day = 85; // winter
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).notes)).toEqual([
      'Dormant - Winter operations limited',
      'Repot: requires spring',
    ]);
    state.day = 120; // spring, year 2
    tree.lastRepotDay = 100;
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).notes)).toEqual([
      'Repot: cooldown - wait 40d',
    ]);
    tree.lastRepotDay = 0;
    tree.vigor = 30;
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).notes)).toEqual([
      'Low vigor - repotting would refresh it',
    ]);
  });

  it('hides the low-vigor nudge while repotting is out of season or on cooldown', () => {
    const { state, tree } = starter();
    tree.vigor = 30;
    state.day = 85; // winter: dormant, repot out of season
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).notes)).toEqual([
      'Dormant - Winter operations limited',
      'Repot: requires spring',
    ]);
    state.day = 120; // spring, year 2, 20 days after a repot
    tree.lastRepotDay = 100;
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).notes)).toEqual([
      'Repot: cooldown - wait 40d',
    ]);
  });

  it('greys Fertilise in dormancy and without fertiliser, Skip below its cost', () => {
    const { state, tree } = starter();
    state.day = 85;
    expect(enabled(inspectorPanel(tree, state, DESKTOP_UI))).toEqual([
      'water',
      'skip',
      'pickup',
      'view',
      ...SUB,
    ]);
    state.day = 0;
    state.inventory.fertilizer = 3;
    expect(enabled(inspectorPanel(tree, state, DESKTOP_UI))).toEqual([
      'water',
      'fertilise',
      'pickup',
      'view',
      ...SUB,
    ]);
    state.inventory.fertilizer = 0;
    expect(enabled(inspectorPanel(tree, state, DESKTOP_UI))).toEqual([
      'water',
      'pickup',
      'view',
      ...SUB,
    ]);
  });

  it('offers Repot only in season, off cooldown and with a pot of either tier', () => {
    const { state, tree } = starter();
    const repot = (): boolean =>
      inspectorPanel(tree, state, DESKTOP_UI).buttons.find((b) => b.id === 'repot')?.enabled ??
      false;
    expect(repot()).toBe(false); // day 0: cooldown
    state.day = 85; // winter
    expect(repot()).toBe(false);
    state.day = 120; // spring, year 2
    expect(state.inventory.pot).toBeGreaterThan(0);
    expect(repot()).toBe(true);
    state.inventory.pot = 0;
    state.inventory.fancy_pot = 0;
    expect(repot()).toBe(false);
    state.inventory.fancy_pot = 1;
    expect(repot()).toBe(true);
    tree.lastRepotDay = 100; // 20 days ago
    expect(repot()).toBe(false);
  });

  it('adds the fertilised days left to the footer', () => {
    const { state, tree } = starter();
    expect(inspectorAction(state, tree, 'fertilise')).toBe(true);
    state.day = 3;
    expect(inspectorPanel(tree, state, DESKTOP_UI).footer.text).toBe(
      'Fertilizer: 49  |  Wire: 10  |  Day: 3  |  $100  |  Fertilized: 4d left',
    );
  });

  it('splits Pot and Soil into two lines in the two-column layout, the notes under them', () => {
    const { state, tree } = starter();
    tree.potTier = 1;
    tree.soilTier = 1;
    const m = inspectorPanel(tree, state, PHONE_UI);
    expect(texts(m.stats).slice(4)).toEqual([
      'Pot: Fancy (+25% display)',
      'Soil: Akadama (slower vigor loss)',
    ]);
    expect(texts(m.notes)).toEqual(['Repot: cooldown - wait 60d']);
    expect(texts(inspectorPanel(tree, state, DESKTOP_UI).stats)[4]).toBe(
      'Pot: Fancy (+25% display)  |  Soil: Akadama (slower vigor loss)',
    );
  });
});

/** Every state the layout must hold for, at one screen's metrics. */
function layoutModels(ui: UiMetrics): InspectorModel[] {
  const models = [
    inspectorPanel(starter().tree, starter().state, ui),
    inspectorPanel(day730().tree, day730().state, ui),
  ];
  // Winter with low vigor: the two notes that can show together, never a third.
  const winter = starter();
  winter.state.day = 85;
  winter.tree.vigor = 30;
  models.push(inspectorPanel(winter.tree, winter.state, ui));
  // The longest note: spring, off cooldown, low vigor.
  const spring = starter();
  spring.state.day = 120;
  spring.tree.vigor = 30;
  models.push(inspectorPanel(spring.tree, spring.state, ui));
  // The widest stat lines and breakdown labels: every style, a fancy pot and akadama, fed.
  for (const key of STYLE_KEYS) {
    const wide = starter();
    wide.tree.targetStyle = key;
    wide.tree.potTier = 1;
    wide.tree.soilTier = 1;
    wide.tree.fertilizedUntilDay = 7;
    wide.state.money = 123456;
    models.push(inspectorPanel(wide.tree, wide.state, ui));
  }
  return models;
}

/**
 * The glyph width of the label-sized lines each layout is checked at. At the
 * desktop metrics, the monospace fallback's upper bound; at the phone's
 * 10 px, VT323's own 4 px advance (as `estimatedBox`), which BootScene loads
 * before any text draws: the fallback's 6 px would not fit the two columns.
 */
const METRICS = [
  { name: 'desktop', ui: DESKTOP_UI, small: SMALL_GLYPH_W },
  { name: 'phone', ui: PHONE_UI, small: PHONE_UI.label * 0.4 },
] as const;

const rightOf = (l: InspectorText, glyph: number): number => l.x + l.text.length * glyph;

describe('inspector layout', () => {
  const { x, y, w, h } = INSPECTOR_PANEL;

  it('centres a box larger than the 400x150 panel inside 480x270', () => {
    expect(x * 2 + w).toBe(480);
    expect(y * 2 + h).toBe(270);
    expect(w).toBeGreaterThan(400);
    expect(h).toBeGreaterThan(150);
  });

  it('keeps the desktop layout: stats full width, then bars and score, at 11 px', () => {
    expect(inspectorLine(DESKTOP_UI)).toBe(11);
    expect(inspectorFitsOneColumn(DESKTOP_UI)).toBe(true);
    const m = inspectorPanel(starter().tree, starter().state, DESKTOP_UI);
    expect(m.stats.map((l) => [l.x, l.y])).toEqual([
      [30, 34],
      [30, 45],
      [30, 56],
      [30, 67],
      [30, 78],
    ]);
    expect([m.notes[0]?.x, m.notes[0]?.y]).toEqual([30, 89]);
    expect(m.bars.map((b) => [b.x, b.y, b.trackX, b.trackW, b.textX])).toEqual([
      [30, 117, 78, 100, 184],
      [30, 128, 78, 100, 184],
      [30, 139, 78, 100, 184],
    ]);
    expect([m.score.x, m.score.y]).toEqual([240, 117]);
    const first = m.breakdown[0];
    expect([first?.label.x, first?.label.y, first?.value.x]).toEqual([240, 128, 365]);
    expect(inspectorButtonRows(DESKTOP_UI)).toEqual([222, 236]);
    expect(m.buttons.map((b) => b.y)).toEqual([222, 222, 222, 222, 222, 236, 236, 236, 236]);
    expect([m.footer.x, m.footer.y]).toEqual([30, 254]);
    expect(INSPECTOR_FOOTER_Y).toBe(254);
    expect(INSPECTOR_CLOSE).toEqual({ x: 450, y: 15 });
  });

  it('lays the phone out in two columns at 12 px: stats, notes and bars left, score right', () => {
    expect(inspectorLine(PHONE_UI)).toBe(12);
    expect(inspectorFitsOneColumn(PHONE_UI)).toBe(false);
    const m = inspectorPanel(starter().tree, starter().state, PHONE_UI);
    expect(m.stats.map((l) => [l.x, l.y])).toEqual([
      [30, 34],
      [30, 46],
      [30, 58],
      [30, 70],
      [30, 82],
      [30, 94],
    ]);
    expect([m.notes[0]?.x, m.notes[0]?.y]).toEqual([30, 106]);
    expect(m.bars.map((b) => [b.x, b.y, b.trackX, b.trackW, b.textX])).toEqual([
      [30, 136, 78, 100, 184],
      [30, 148, 78, 100, 184],
      [30, 160, 78, 100, 184],
    ]);
    expect([m.score.x, m.score.y]).toEqual([240, INSPECTOR_TOP]);
    expect(inspectorButtonRows(PHONE_UI)).toEqual([202, 233]);
    expect([m.footer.x, m.footer.y]).toEqual([30, 254]);
    expect(INSPECTOR_LEFT_COLUMN).toEqual({ x: 30, w: 200 });
    expect(INSPECTOR_SCORE_COLUMN).toEqual({ x: 240, w: 210 });
  });

  it('fits a 20-character name and the close hint in the title bar', () => {
    const title = MAX_TREE_NAME_LENGTH * GLYPH_W;
    const hint = INSPECTOR_CLOSE_LABEL.length * GLYPH_W;
    expect(title + GLYPH_W + hint).toBeLessThanOrEqual(w - 2 * INSPECTOR_INSET);
  });

  describe.each(METRICS)('at the $name metrics', ({ ui, small }) => {
    const models = layoutModels(ui);
    const line = inspectorLine(ui);
    const oneColumn = inspectorFitsOneColumn(ui);
    const barTexts = (m: InspectorModel): InspectorText[] =>
      m.bars.flatMap((b) => [
        { text: b.label, x: b.x, y: b.y },
        { text: b.text, x: b.textX, y: b.y },
      ]);
    const lines = (m: InspectorModel): InspectorText[] => [
      ...m.stats,
      ...m.notes,
      m.score,
      ...m.breakdown.flatMap((c) => [c.label, c.value]),
      ...barTexts(m),
      m.footer,
    ];
    /** A label-sized line's box, text origin (0, 0.5). */
    const lineBox = (l: InspectorText): UiRect => ({
      x: l.x,
      y: l.y - ui.label / 2,
      w: l.text.length * small,
      h: ui.label,
    });
    const buttonHit = (b: { label: string; x: number; y: number }): UiRect =>
      hitRect(estimatedBox(b.label, b.x, b.y, 0, 0.5, ui), ui.hit);
    const closeHit = hitRect(
      estimatedBox(INSPECTOR_CLOSE_LABEL, INSPECTOR_CLOSE.x, INSPECTOR_CLOSE.y, 1, 0.5, ui),
      ui.hit,
    );

    it('keeps every line inside the box, under the title bar', () => {
      for (const m of models) {
        for (const l of lines(m)) {
          expect(l.y - line / 2).toBeGreaterThanOrEqual(y + INSPECTOR_TITLE_H);
          expect(l.y + line / 2).toBeLessThanOrEqual(y + h);
          expect(l.x).toBeGreaterThanOrEqual(x + INSPECTOR_INSET);
          expect(rightOf(l, small)).toBeLessThanOrEqual(x + w - INSPECTOR_INSET);
        }
      }
    });

    it("keeps every button's tap target inside the box, Close's inside the canvas", () => {
      for (const m of models) {
        for (const b of m.buttons) {
          const r = buttonHit(b);
          expect(r.h).toBe(Math.max(ui.hit, ui.body));
          expect(r.x).toBeGreaterThanOrEqual(x);
          expect(r.y).toBeGreaterThanOrEqual(y);
          expect(r.x + r.w).toBeLessThanOrEqual(x + w);
          expect(r.y + r.h).toBeLessThanOrEqual(y + h);
        }
      }
      expect(closeHit.h).toBe(Math.max(ui.hit, ui.body));
      expect(closeHit.y).toBeGreaterThanOrEqual(0);
      expect(closeHit.x + closeHit.w).toBeLessThanOrEqual(x + w);
    });

    it('keeps the tap targets apart from each other, from every line and from the footer', () => {
      for (const m of models) {
        const hits = [...m.buttons.map(buttonHit), closeHit];
        hits.forEach((a, i) => {
          for (const b of hits.slice(i + 1)) expect(rectsOverlap(a, b)).toBe(false);
          for (const l of lines(m)) expect(rectsOverlap(a, lineBox(l))).toBe(false);
        });
      }
    });

    it('stacks the rows: stats, notes, the bars under them, then the buttons and the footer', () => {
      const [button, second] = inspectorButtonRows(ui);
      expect(second - button).toBe(Math.max(14, ui.hit));
      for (const m of models) {
        const top = [...m.stats, ...m.notes].map((l) => l.y);
        for (let i = 1; i < top.length; i++) {
          expect((top[i] ?? 0) - (top[i - 1] ?? 0)).toBeGreaterThanOrEqual(line);
        }
        const lowest = Math.max(...top);
        expect((m.bars[0]?.y ?? 0) - lowest).toBeGreaterThanOrEqual(line);
        if (oneColumn) expect(m.score.y - lowest).toBeGreaterThanOrEqual(line);
        expect(m.buttons.map((b) => b.y)).toEqual([
          ...Array<number>(5).fill(button),
          ...Array<number>(4).fill(second),
        ]);
        expect(m.footer.y - second).toBeGreaterThanOrEqual(line);
        expect(m.footer.y + line / 2).toBeLessThanOrEqual(y + h);
      }
    });

    it('keeps the two columns disjoint, the bars clear of their labels and values', () => {
      const leftEnd = INSPECTOR_LEFT_COLUMN.x + INSPECTOR_LEFT_COLUMN.w;
      const rightEnd = INSPECTOR_SCORE_COLUMN.x + INSPECTOR_SCORE_COLUMN.w;
      expect(leftEnd).toBeLessThan(INSPECTOR_SCORE_COLUMN.x);
      for (const m of models) {
        const left = [...(oneColumn ? [] : [...m.stats, ...m.notes]), ...barTexts(m)];
        const right = [m.score, ...m.breakdown.flatMap((c) => [c.label, c.value])];
        for (const l of left) {
          expect(l.x).toBeGreaterThanOrEqual(INSPECTOR_LEFT_COLUMN.x);
          expect(rightOf(l, small)).toBeLessThanOrEqual(leftEnd);
        }
        for (const l of right) {
          expect(l.x).toBeGreaterThanOrEqual(INSPECTOR_SCORE_COLUMN.x);
          expect(rightOf(l, small)).toBeLessThanOrEqual(rightEnd);
        }
        for (const b of m.bars) {
          expect(b.x + b.label.length * small).toBeLessThan(b.trackX);
          expect(b.trackX + b.trackW).toBeLessThan(b.textX);
        }
        for (const c of m.breakdown) expect(rightOf(c.label, small)).toBeLessThan(c.value.x);
      }
    });

    it('fits the longest stat line and note in their column', () => {
      const end = oneColumn
        ? x + w - INSPECTOR_INSET
        : INSPECTOR_LEFT_COLUMN.x + INSPECTOR_LEFT_COLUMN.w;
      const all = models.flatMap((m) => [...m.stats, ...m.notes]);
      expect(all.map((l) => l.text)).toContain('Low vigor - repotting would refresh it');
      expect(all.map((l) => l.text)).toContain('Branches: 4  |  Style: Windswept (Fukinagashi)');
      for (const l of all) expect(rightOf(l, small)).toBeLessThanOrEqual(end);
    });
  });

  it('spreads each row of buttons (five, then four) across the box, the last inside the edge', () => {
    for (const m of [...layoutModels(DESKTOP_UI), ...layoutModels(PHONE_UI)]) {
      const rowsOf = [m.buttons.slice(0, 5), m.buttons.slice(5)];
      expect(rowsOf.map((r) => r.length)).toEqual([5, 4]);
      for (const b of rowsOf) {
        expect(new Set(b.map((button) => button.y)).size).toBe(1);
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
