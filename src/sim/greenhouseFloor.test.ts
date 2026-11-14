import { describe, expect, it } from 'vitest';
import { GREENHOUSE_FLOOR, PLACEABLE_SIZES, onGreenhouseFloor } from './greenhouseFloor';

describe('greenhouse floor', () => {
  it('is 5 x 3.5 m, 10 x 7 tiles of 50 cm (16 px), centred on x 240', () => {
    expect(GREENHOUSE_FLOOR).toEqual({ x: 160, y: 80, w: 160, h: 112 });
    expect([GREENHOUSE_FLOOR.w / 16, GREENHOUSE_FLOOR.h / 16]).toEqual([10, 7]);
    expect([(GREENHOUSE_FLOOR.w / 16) * 0.5, (GREENHOUSE_FLOOR.h / 16) * 0.5]).toEqual([5, 3.5]);
    expect(GREENHOUSE_FLOOR.x + GREENHOUSE_FLOOR.w / 2).toBe(240);
  });

  it('gives a pedestal one tile and a floor shelf two', () => {
    expect(PLACEABLE_SIZES).toEqual({ pedestal: { w: 16, h: 16 }, floor_shelf: { w: 32, h: 16 } });
  });

  it('holds a footprint only wholly inside it', () => {
    expect(onGreenhouseFloor('pedestal', 160, 80)).toBe(true);
    expect(onGreenhouseFloor('floor_shelf', 288, 176)).toBe(true);
    expect(onGreenhouseFloor('pedestal', 144, 80)).toBe(false);
    expect(onGreenhouseFloor('pedestal', 160, 64)).toBe(false);
    expect(onGreenhouseFloor('floor_shelf', 304, 160)).toBe(false);
    expect(onGreenhouseFloor('pedestal', 304, 192)).toBe(false);
  });
});
