import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAST_SHADOW, SHADOW_ALPHA, castOffset } from './lighting';

/** art/inked/style.mjs's source: the generator's module is untyped JavaScript the tests cannot import. */
const STYLE_SOURCE = readFileSync(new URL('../../art/inked/style.mjs', import.meta.url), 'utf8');

describe('the one light', () => {
  it("mirrors art/inked/style.mjs's STYLE.castShadow and STYLE.shadowAlpha", () => {
    const cast =
      /^\s*castShadow: \{ direction: \[([-\d.]+), ([-\d.]+)\], length: ([\d.]+) \},$/m.exec(
        STYLE_SOURCE,
      );
    expect(cast).not.toBeNull();
    const [, dx, dy, length] = cast ?? [];
    expect(CAST_SHADOW.direction).toEqual([Number(dx), Number(dy)]);
    expect(CAST_SHADOW.length).toBe(Number(length));
    const alpha = /^\s*shadowAlpha: ([\d.]+),$/m.exec(STYLE_SOURCE)?.[1];
    expect(SHADOW_ALPHA).toBe(Number(alpha));
  });

  it('pins the light high in the upper left: shadows fall down and right, half a caster long', () => {
    expect(CAST_SHADOW).toEqual({ direction: [0.8, 0.6], length: 0.5 });
    expect(Math.hypot(...CAST_SHADOW.direction)).toBeCloseTo(1, 12);
    expect(SHADOW_ALPHA).toBe(0.45);
  });

  it("throws a caster's shadow along the direction, as far as its height times the length", () => {
    // The 0.9 m workbench stands 20 px: its top falls 10 px away, 8 right and 6 down.
    const workbench = castOffset(20);
    expect(workbench.x).toBeCloseTo(8, 12);
    expect(workbench.y).toBeCloseTo(6, 12);
    // The 2.4 m back wall's band is 14.4 px deep.
    expect(castOffset(48).y).toBeCloseTo(14.4, 12);
    expect(castOffset(0)).toEqual({ x: 0, y: 0 });
  });
});
