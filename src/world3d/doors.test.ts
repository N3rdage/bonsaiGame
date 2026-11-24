import { describe, expect, it } from 'vitest';
import { SHEETS } from '../world/assets';
import { ROOMS } from '../world/gardenRoom';
import type { Prop } from '../world/shedRoom';
import { roomDetails } from './details';
import { DOOR_WIDTH, doorWidth, isGlazedDoor, roomPlan3d } from './plan';

/** Every door of every room: [room, key, width along its wall (m), glazed]. */
const DOORS: readonly (readonly [keyof typeof ROOMS, string, number, boolean])[] = [
  ['shed', 'door', 1, false],
  ['shed', 'door_lounge', 1, false],
  ['garden', 'door', 1, false],
  ['garden', 'door_study', 1, true],
  ['garden', 'door_greenhouse', 1, true],
  ['garden', 'gate', 1, false],
  ['frontGarden', 'door_house', 1, false],
  ['frontGarden', 'gate', 1, false],
  ['lounge', 'door', 1, false],
  ['lounge', 'door_hallway', 1, false],
  ['hallway', 'door_lounge', 1, false],
  ['hallway', 'door_front', 1, false],
  ['hallway', 'door_study', 1, false],
  ['study', 'door_hallway', 1, false],
  ['study', 'door_garden', 1.5, true],
  ['greenhouse', 'door_garden', 1, true],
];

const propOf = (room: keyof typeof ROOMS, key: string): Prop => {
  const prop = ROOMS[room].props.find((p) => p.key === key);
  if (prop === undefined) throw new Error(`${room} has no ${key}`);
  return prop;
};

const alongXOf = (prop: Prop): boolean => prop.wall === 'N' || prop.wall === 'S';

describe('door widths', () => {
  it('covers every door prop of every room', () => {
    const listed = DOORS.map(([room, key]) => `${room}.${key}`).sort();
    const all = Object.values(ROOMS)
      .flatMap((room) =>
        room.props.filter((p) => p.wall !== undefined).map((p) => `${room.key}.${p.key}`),
      )
      .sort();
    expect(listed).toEqual(all);
  });

  it.each(DOORS)('%s %s is %f m wide, glazed %s', (room, key, width, glazed) => {
    const prop = propOf(room, key);
    expect(doorWidth(prop, alongXOf(prop))).toBe(width);
    expect(isGlazedDoor(prop)).toBe(glazed);
  });

  it("takes a front-on door's width from its art, a side-on door's from the prop", () => {
    const base = propOf('study', 'door_garden');
    const narrow: Prop = { ...base, w: 16 };
    expect(doorWidth(narrow, true)).toBe(SHEETS.doorGlass.frameWidth / 4 / 32);
    const side: Prop = { ...propOf('hallway', 'door_lounge'), h: 80 };
    expect(doorWidth(side, false)).toBe(2.5);
    const small: Prop = { ...side, h: 16 };
    expect(doorWidth(small, false)).toBe(DOOR_WIDTH);
  });

  it('cuts each wall door as wide as doorWidth says, and glazes the glazed ones', () => {
    for (const [room, key, width, glazed] of DOORS) {
      const opening = roomPlan3d(ROOMS[room]).openings.find((o) => o.name === key);
      if (opening === undefined) continue;
      const along = Math.max(opening.x1 - opening.x0, opening.y1 - opening.y0);
      expect(along).toBeLessThanOrEqual(width + 1e-9);
      expect(opening.glazed === true).toBe(glazed);
    }
    const study = roomPlan3d(ROOMS.study).openings.find((o) => o.name === 'door_garden');
    expect((study?.x1 ?? 0) - (study?.x0 ?? 0)).toBeCloseTo(1.5, 9);
  });

  it('draws a glazed door as a glass pane in wood and any other as planks', () => {
    for (const [room, key, , glazed] of DOORS) {
      const detail = roomDetails(ROOMS[room], roomPlan3d(ROOMS[room])).find(
        (d) => d.kind === 'door' && d.name === key,
      );
      if (detail === undefined) continue;
      const panes = detail.parts.filter((p) => p.glass === true);
      expect(panes.length).toBe(glazed ? 1 : 0);
      expect(detail.parts.some((p) => p.wash === 'floor')).toBe(!glazed);
    }
  });

  it("frames a face door as wide as the plan's cut would be, the glazed ones in glass", () => {
    const details = roomDetails(ROOMS.garden, roomPlan3d(ROOMS.garden));
    for (const key of ['door_study', 'door_greenhouse']) {
      const door = details.find((d) => d.name === key);
      expect(door?.parts.filter((p) => p.glass === true)).toHaveLength(1);
      const x0 = Math.min(...(door?.parts ?? []).map((p) => p.x0));
      const x1 = Math.max(...(door?.parts ?? []).map((p) => p.x1));
      const prop = propOf('garden', key);
      expect(x1 - x0).toBeCloseTo(doorWidth(prop, true), 9);
    }
  });

  it('puts a meeting stile in the study double door and none in a single glazed one', () => {
    const study = roomDetails(ROOMS.study, roomPlan3d(ROOMS.study)).find(
      (d) => d.name === 'door_garden',
    );
    const single = roomDetails(ROOMS.greenhouse, roomPlan3d(ROOMS.greenhouse)).find(
      (d) => d.name === 'door_garden',
    );
    expect(study?.parts).toHaveLength((single?.parts.length ?? 0) + 1);
  });
});
