import { describe, expect, it } from 'vitest';
import { BENCH_SECONDS } from './bench';
import { DEFAULT_ORBIT, PITCH_MAX } from './orbit';
import { parseOptions } from './session';

describe("the engine pages' query string", () => {
  it('defaults to the front door, the default camera and the full benchmark', () => {
    expect(parseOptions('')).toEqual({
      spawn: 'frontDoor',
      orbit: DEFAULT_ORBIT,
      benchSeconds: BENCH_SECONDS,
    });
  });

  it('reads a spawn, a camera and a short benchmark, clamped', () => {
    expect(parseOptions('?spawn=shedDoor&yaw=-90&pitch=200&distance=6&bench=3')).toEqual({
      spawn: 'shedDoor',
      orbit: { yaw: 270, pitch: PITCH_MAX, distance: 6 },
      benchSeconds: 3,
    });
  });

  it('ignores what it does not know', () => {
    expect(parseOptions('?spawn=roof&yaw=x&bench=-1')).toEqual(parseOptions(''));
  });
});
