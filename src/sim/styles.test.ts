import { describe, expect, it } from 'vitest';
import type { BonsaiTree, Branch, StyleKey, TrunkMovement } from './types';
import { STYLES, STYLE_KEYS, getStyle } from './styles';

function makeTree(
  opts: { heightCm?: number; movement?: TrunkMovement[]; branches?: Partial<Branch>[] } = {},
): BonsaiTree {
  const branches: Branch[] = (opts.branches ?? []).map((b, i) => ({
    id: i,
    parentId: -1,
    originY: 10,
    angle: 0,
    length: 8,
    girth: 3,
    wired: false,
    bend: 0,
    bendV: 0,
    ...b,
  }));
  return {
    id: 0,
    speciesKey: 'juniper',
    origin: 'cutting',
    name: 'Test',
    ageDays: 0,
    vitality: 100,
    vigor: 50,
    waterLevel: 100,
    lastWateredDay: 1,
    lastFedDay: 1,
    fertilizedUntilDay: 0,
    potTier: 0,
    soilTier: 0,
    lastRepotDay: 0,
    location: 'shed',
    timeAccel: 1,
    trunk: {
      heightCm: opts.heightCm ?? 30,
      girthMm: 10,
      taper: 0.5,
      movement: opts.movement ?? [],
    },
    branches,
    foliageDensity: 0.5,
    wiresApplied: [],
    clipsHistory: [],
    prunesHistory: [],
    repotsHistory: [],
    styleTags: [],
    targetStyle: '',
    revision: 0,
  };
}

const score = (key: StyleKey, tree: BonsaiTree) => getStyle(key).score(tree);

describe('style table', () => {
  it('lists six styles in prototype order, keyed consistently', () => {
    expect(STYLE_KEYS).toEqual([
      'formal_upright',
      'informal_upright',
      'slanting',
      'cascade',
      'broom',
      'windswept',
    ]);
    for (const key of STYLE_KEYS) {
      expect(STYLES[key].key).toBe(key);
      expect(getStyle(key)).toBe(STYLES[key]);
    }
  });

  it('keeps the prototype display names and descriptions', () => {
    expect(STYLES.formal_upright.displayName).toBe('Formal Upright (Chokkan)');
    expect(STYLES.informal_upright.displayName).toBe('Informal Upright (Moyogi)');
    expect(STYLES.slanting.displayName).toBe('Slanting (Shakan)');
    expect(STYLES.cascade.displayName).toBe('Cascade (Kengai)');
    expect(STYLES.broom.displayName).toBe('Broom (Hokidachi)');
    expect(STYLES.windswept.displayName).toBe('Windswept (Fukinagashi)');
    expect(STYLES.cascade.description).toBe("Main growth descends below the pot's rim.");
  });
});

describe('formal_upright', () => {
  it('returns 0.5 with fewer than 2 branches', () => {
    expect(score('formal_upright', makeTree())).toBe(0.5);
    expect(score('formal_upright', makeTree({ branches: [{}] }))).toBe(0.5);
  });

  it('scores alternating 0/180 angles as 1.0', () => {
    const tree = makeTree({
      branches: [
        { originY: 5, angle: 0 },
        { originY: 10, angle: 180 },
        { originY: 15, angle: 0 },
        { originY: 20, angle: 180 },
      ],
    });
    expect(score('formal_upright', tree)).toBe(1);
  });

  it('scores identical angles as 0', () => {
    const tree = makeTree({
      branches: [
        { originY: 5, angle: 90 },
        { originY: 10, angle: 90 },
        { originY: 15, angle: 90 },
      ],
    });
    expect(score('formal_upright', tree)).toBe(0);
  });

  it('sorts by height and uses the shortest arc', () => {
    // Unsorted input; by height: 0 (y=5), 350 (y=10) -> arc 10 -> 10/180.
    const tree = makeTree({
      branches: [
        { originY: 10, angle: 350 },
        { originY: 5, angle: 0 },
      ],
    });
    expect(score('formal_upright', tree)).toBeCloseTo(10 / 180, 12);
  });
});

describe('informal_upright', () => {
  it('scores a straight trunk 0 (max lean 0 -> curve score 0)', () => {
    expect(score('informal_upright', makeTree())).toBe(0);
  });

  it('rewards a bend that returns to vertical', () => {
    // +20 then -20: max lean 20, apex lean 0 -> (1 - 5/25) * 1 = 0.8
    const tree = makeTree({
      movement: [
        { y: 5, angleDeg: 0 },
        { y: 15, angleDeg: 180 },
      ],
    });
    expect(score('informal_upright', tree)).toBeCloseTo(0.8, 9);
  });

  it('penalises an apex left leaning', () => {
    // One 20 degree event: curve 0.8, upright 1 - 20/30.
    const tree = makeTree({ movement: [{ y: 5, angleDeg: 0 }] });
    expect(score('informal_upright', tree)).toBeCloseTo(0.8 * (1 - 20 / 30), 9);
  });
});

describe('slanting', () => {
  it('scores a straight trunk 0', () => {
    expect(score('slanting', makeTree())).toBe(0);
  });

  it('scores two same-direction events (40 degree lean) as 1', () => {
    const tree = makeTree({
      movement: [
        { y: 5, angleDeg: 45 },
        { y: 10, angleDeg: 45 },
      ],
    });
    expect(score('slanting', tree)).toBeCloseTo(1, 9);
  });

  it('falls off outside the 25..45 plateau', () => {
    // 20 degree lean: 1 - (15 - 10)/30
    const tree = makeTree({ movement: [{ y: 5, angleDeg: 0 }] });
    expect(score('slanting', tree)).toBeCloseTo(1 - 5 / 30, 9);
  });
});

describe('cascade', () => {
  it('scores a straight trunk 0', () => {
    expect(score('cascade', makeTree())).toBe(0);
  });

  it('scores > 0 once many same-direction events carry the tip below the base', () => {
    const movement: TrunkMovement[] = [];
    for (let i = 0; i < 9; i++) movement.push({ y: 0, angleDeg: 0 });
    // 180 degrees at the base: trunk points straight down, drop = full arc -> clamped 1.
    expect(score('cascade', makeTree({ movement }))).toBeCloseTo(1, 9);

    const spread: TrunkMovement[] = [];
    for (let y = 0; y <= 20; y += 2.5) spread.push({ y, angleDeg: 90 });
    const s = score('cascade', makeTree({ heightCm: 30, movement: spread }));
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('broom', () => {
  it('scores 0 with no branches', () => {
    expect(score('broom', makeTree())).toBe(0);
  });

  it('scores near 1 for evenly spread branches all in the upper third', () => {
    const tree = makeTree({
      heightCm: 30,
      branches: [0, 90, 180, 270].map((angle, i) => ({ originY: 22 + i, angle })),
    });
    expect(score('broom', tree)).toBeCloseTo(1, 9);
  });

  it('uses 0.66 as the upper-third threshold', () => {
    const tree = makeTree({
      heightCm: 100,
      branches: [
        { originY: 66, angle: 0 },
        { originY: 65, angle: 180 },
      ],
    });
    expect(score('broom', tree)).toBeCloseTo(0.5, 9);
  });
});

describe('windswept', () => {
  it('returns 0.5 with fewer than 2 branches', () => {
    expect(score('windswept', makeTree({ branches: [{}] }))).toBe(0.5);
  });

  it('scores identical angles as 1', () => {
    const tree = makeTree({ branches: [{ angle: 45 }, { angle: 45 }, { angle: 45 }] });
    expect(score('windswept', tree)).toBeCloseTo(1, 12);
  });

  it('scores opposite angles as 0', () => {
    const tree = makeTree({ branches: [{ angle: 0 }, { angle: 180 }] });
    expect(score('windswept', tree)).toBeCloseTo(0, 12);
  });
});
