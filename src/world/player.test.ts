import { describe, expect, it } from 'vitest';
import { WALK_ANIM_STEP, WALK_FRAMES, footstepDue } from './player';

describe('footstepDue', () => {
  it('sounds on entering a contact frame, 0 or 2, the wrap included', () => {
    expect(footstepDue(1.9, 2.04)).toBe(true);
    expect(footstepDue(3.96, 0.1)).toBe(true);
  });

  it('is silent on entering a stride frame, 1 or 3', () => {
    expect(footstepDue(0.9, 1.04)).toBe(false);
    expect(footstepDue(2.9, 3.04)).toBe(false);
  });

  it('is silent within a frame, on starting to walk and on stopping', () => {
    expect(footstepDue(2.1, 2.24)).toBe(false);
    expect(footstepDue(0, WALK_ANIM_STEP)).toBe(false);
    expect(footstepDue(1.5, 0)).toBe(false);
    expect(footstepDue(0, 0)).toBe(false);
  });

  it('sounds twice per walk cycle, at stepPlayer pace', () => {
    let anim = 0;
    let steps = 0;
    const cycles = 5;
    const n = Math.round((cycles * WALK_FRAMES) / WALK_ANIM_STEP);
    for (let i = 0; i < n; i += 1) {
      let next = anim + WALK_ANIM_STEP;
      if (next >= WALK_FRAMES) next -= WALK_FRAMES;
      if (footstepDue(anim, next)) steps += 1;
      anim = next;
    }
    expect(steps).toBeGreaterThanOrEqual(2 * cycles - 1);
    expect(steps).toBeLessThanOrEqual(2 * cycles);
  });
});
