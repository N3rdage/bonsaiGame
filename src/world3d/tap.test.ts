import { describe, expect, it } from 'vitest';
import { MOVE_SPEED } from '../world/player';
import { TAP_MAX_MOVE_PX, TAP_MAX_MS, TapTracker, isTap, nearestSpot, routeInput } from './tap';

describe('nearestSpot', () => {
  const spots = [
    { id: 'tree', x: 100, y: 100 },
    { id: 'bench', x: 130, y: 100 },
  ];

  it('takes the prop whose middle is within the radius of a near miss', () => {
    expect(nearestSpot({ x: 100, y: 125 }, spots, 31)).toBe('tree');
  });

  it('leaves a tap beyond the radius to the floor', () => {
    expect(nearestSpot({ x: 100, y: 140 }, spots, 31)).toBeUndefined();
  });

  it('takes the nearer of two overlapping targets', () => {
    expect(nearestSpot({ x: 112, y: 100 }, spots, 31)).toBe('tree');
    expect(nearestSpot({ x: 118, y: 100 }, spots, 31)).toBe('bench');
  });

  it('takes only a direct hit with no radius', () => {
    expect(nearestSpot({ x: 100, y: 125 }, spots, 0)).toBeUndefined();
    expect(nearestSpot({ x: 100, y: 125 }, spots, 0, 'tree')).toBe('tree');
  });

  it('lets a nearer prop win over a direct hit on a box that reaches past its middle', () => {
    expect(nearestSpot({ x: 128, y: 100 }, spots, 31, 'tree')).toBe('bench');
  });
});

describe('isTap', () => {
  it('takes a short, still press', () => {
    expect(isTap(0, 80)).toBe(true);
    expect(isTap(TAP_MAX_MOVE_PX, TAP_MAX_MS)).toBe(true);
  });

  it('refuses a press that moved or lingered', () => {
    expect(isTap(TAP_MAX_MOVE_PX + 0.1, 80)).toBe(false);
    expect(isTap(0, TAP_MAX_MS + 1)).toBe(false);
  });
});

describe('TapTracker', () => {
  it('closes a tap on a quick release in place', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, 0);
    t.move(1, 101, 100);
    expect(t.up(1, 120)).toBe(true);
  });

  it('never calls a drag a tap, even one that came back to where it began', () => {
    const t = new TapTracker();
    t.down(1, 100, 100, 0);
    t.move(1, 140, 100);
    t.move(1, 100, 100);
    expect(t.up(1, 120)).toBe(false);
  });

  it('refuses a slow press', () => {
    const t = new TapTracker();
    t.down(1, 0, 0, 0);
    expect(t.up(1, TAP_MAX_MS + 1)).toBe(false);
  });

  it('refuses a pinch: neither finger is a tap', () => {
    const t = new TapTracker();
    t.down(1, 0, 0, 0);
    t.down(2, 50, 0, 10);
    expect(t.up(2, 30)).toBe(false);
    expect(t.up(1, 40)).toBe(false);
    t.down(3, 0, 0, 100);
    expect(t.up(3, 120)).toBe(true);
  });

  it('knows nothing of a press it did not see', () => {
    const t = new TapTracker();
    expect(t.up(9, 10)).toBe(false);
  });
});

describe('routeInput', () => {
  it('heads for the goal at full speed', () => {
    const { input, arrived } = routeInput({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(arrived).toBe(false);
    expect(input).toEqual({ x: 1, y: 0 });
  });

  it('keeps the direction on a diagonal, at unit length', () => {
    const { input } = routeInput({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(Math.hypot(input.x, input.y)).toBeCloseTo(1);
    expect(input.y / input.x).toBeCloseTo(4 / 3);
  });

  it('shortens the last step so it lands on the goal', () => {
    const { input } = routeInput({ x: 0, y: 0 }, { x: MOVE_SPEED / 2, y: 0 });
    expect(input.x * MOVE_SPEED).toBeCloseTo(MOVE_SPEED / 2);
  });

  it('has arrived at the goal', () => {
    expect(routeInput({ x: 5, y: 6 }, { x: 5, y: 6 })).toEqual({
      input: { x: 0, y: 0 },
      arrived: true,
    });
  });
});
