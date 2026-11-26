import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTERACT_RANGE, nearestInteractable } from '../world/interactables';
import { ARMCHAIR, LOUNGE_ROOM, SOFA } from '../world/loungeRoom';
import { hitsWall } from '../world/shedRoom';
import { BODY_SCALE } from './character';
import { readClips, readGlb } from './glb';
import { metres } from './plan';
import {
  SEATS,
  SEAT_HEIGHT,
  SIT_HIPS_BACK,
  bodyPlace,
  seatOf,
  seatTargets,
  type Seat,
} from './seats';

function seat(key: Seat['key']): Seat {
  const found = SEATS.find((s) => s.key === key);
  if (!found) throw new Error(`no seat ${key}`);
  return found;
}

describe('the seats', () => {
  it('are the lounge sofa and armchair', () => {
    expect(SEATS.map((s) => [s.key, s.room])).toEqual([
      ['sofa', 'lounge'],
      ['armchair', 'lounge'],
    ]);
  });

  it('rest the hips on the cushion, 10 px back from the front edge and centred along it', () => {
    expect([seat('sofa').x, seat('sofa').y]).toEqual([194, 128]);
    expect([seat('armchair').x, seat('armchair').y]).toEqual([286, 124]);
    for (const s of SEATS) {
      expect(s.x).toBeGreaterThan(s.on.x);
      expect(s.x).toBeLessThan(s.on.x + s.on.w);
      expect(s.y).toBe(s.on.y + s.on.h / 2);
    }
  });

  it('face out from the back: the sofa, its back on the west wall, east; the armchair, its back east, west', () => {
    expect(seat('sofa').heading).toBe(0);
    expect(seat('sofa').on).toBe(SOFA);
    expect(seat('armchair').heading).toBe(Math.PI);
    expect(seat('armchair').on).toBe(ARMCHAIR);
  });

  it('sit the body at the height of the cushions: 0.08 + 0.3 + 0.13 m', () => {
    expect(SEAT_HEIGHT).toBeCloseTo(0.51, 9);
  });

  it('draw the hips back from the body origin as far as Sit_Chair_Down keys them', () => {
    const bytes = readFileSync(new URL('./player/animations.glb', import.meta.url));
    const clips = readClips(
      readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    );
    const hips = clips.get('Sit_Chair_Down')?.nodes.get('hips')?.translation;
    const last = hips ? hips.values.subarray(hips.values.length - 3) : undefined;
    expect(last?.[2]).toBeCloseTo(-SIT_HIPS_BACK, 3);
  });
});

describe('the seat targets', () => {
  it('are the lounge seats, prompting Sit, only while the 3D world draws', () => {
    expect(seatTargets('lounge', false)).toEqual([]);
    expect(seatTargets('shed', true)).toEqual([]);
    const targets = seatTargets('lounge', true);
    expect(targets.map((t) => [t.key, t.prompt])).toEqual([
      ['seat_sofa', 'Sit'],
      ['seat_armchair', 'Sit'],
    ]);
    expect(seatOf('seat_sofa')).toBe(seat('sofa'));
    expect(seatOf('seat_armchair')).toBe(seat('armchair'));
    expect(seatOf('door_hallway')).toBeUndefined();
  });

  it("are in reach from the lane west of the sofa, its east face and the armchair's west face", () => {
    const targets = seatTargets('lounge', true);
    const at = (x: number, y: number): string | undefined =>
      nearestInteractable({ x, y }, targets)?.key;
    expect(at(170, 128)).toBe('seat_sofa');
    expect(at(205, 128)).toBe('seat_sofa');
    expect(at(275, 124)).toBe('seat_armchair');
    expect(at(240, 190)).toBeUndefined();
  });

  it('are stood next to off the solid furniture, within reach', () => {
    for (const [x, y] of [
      [170, 128],
      [205, 128],
      [275, 124],
    ] as const) {
      expect(hitsWall(LOUNGE_ROOM, x, y)).toBe(false);
    }
    const [sofa] = seatTargets('lounge', true);
    expect(Math.hypot((sofa?.x ?? 0) - 205, (sofa?.y ?? 0) - 128)).toBeLessThan(INTERACT_RANGE);
  });
});

describe('where the body is drawn', () => {
  const standing = { x: metres(207), y: metres(128), heading: Math.PI / 2 };
  const scale = BODY_SCALE * 0.7;

  it('is the standing spot and heading at no blend, on the floor', () => {
    expect(bodyPlace(standing, seat('sofa'), 0, scale)).toEqual({ ...standing, z: 0 });
  });

  it("puts the hips on the seat point facing out when seated: the origin forward of it by the clips' draw-back", () => {
    const placed = bodyPlace(standing, seat('sofa'), 1, scale);
    expect(placed.heading).toBeCloseTo(0, 9);
    expect(placed.x).toBeCloseTo(metres(194) + SIT_HIPS_BACK * scale, 9);
    expect(placed.y).toBeCloseTo(metres(128), 9);
    const chair = bodyPlace(standing, seat('armchair'), 1, scale);
    expect(chair.heading).toBeCloseTo(Math.PI, 9);
    expect(chair.x).toBeCloseTo(metres(286) - SIT_HIPS_BACK * scale, 9);
    expect(chair.y).toBeCloseTo(metres(124), 9);
  });

  it("lifts the feet by the cushions' height less the height the clips sit at, drawn size", () => {
    const lifted = bodyPlace(standing, seat('sofa'), 1, scale).z;
    expect(lifted).toBeGreaterThan(0);
    expect(lifted).toBeLessThan(SEAT_HEIGHT);
    expect(bodyPlace(standing, seat('sofa'), 1, BODY_SCALE).z).toBeLessThan(lifted);
  });

  it('is halfway at half the blend, so the body slides in with no snap', () => {
    const start = bodyPlace(standing, seat('sofa'), 0, scale);
    const end = bodyPlace(standing, seat('sofa'), 1, scale);
    const half = bodyPlace(standing, seat('sofa'), 0.5, scale);
    expect(half.x).toBeCloseTo((start.x + end.x) / 2, 9);
    expect(half.y).toBeCloseTo((start.y + end.y) / 2, 9);
    expect(half.z).toBeCloseTo(end.z / 2, 9);
  });

  it('turns the short way round to face out', () => {
    const north = { ...standing, heading: -Math.PI / 2 };
    // From facing north to facing west is a quarter turn one way, three the other.
    expect(bodyPlace(north, seat('armchair'), 0.5, scale).heading).toBeCloseTo(
      (-Math.PI / 2 - Math.PI) / 2,
      9,
    );
    const south = { ...standing, heading: 3.0 };
    expect(bodyPlace(south, seat('armchair'), 0.5, scale).heading).toBeCloseTo(
      (3.0 + Math.PI) / 2,
      9,
    );
  });
});
