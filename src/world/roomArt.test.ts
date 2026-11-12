import { describe, expect, it } from 'vitest';
import { SEASONS } from '../sim/seasons';
import { PLAYER_SCALE, SHEETS } from './assets';
import { DOORWAY, GARDEN_ROOM, ROOMS } from './gardenRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import {
  PEDESTAL_LABEL_DY,
  ROOM_STYLES,
  SHED_FLOOR_DIM,
  SHED_RUG,
  TILE,
  fenceCorners,
  floorTiles,
  furnitureRuns,
  furnitureShadows,
  furnitureSprites,
  playerShadow,
  propShadow,
  propSprite,
  seasonWash,
  sortedFurnitureShadows,
  treeShadow,
  wallRuns,
  windowRuns,
  type Shadow,
} from './roomArt';
import { SHED_ROOM, hitsWall, insideWalls, type Prop, type Room } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';

const propByKey = (props: readonly Prop[], key: string): Prop => {
  const p = props.find((q) => q.key === key);
  if (!p) throw new Error(key);
  return p;
};

describe('floor', () => {
  it('tiles only the inside of the shed ring in 16 px tiles, hashed on their column and row in the room', () => {
    const shed = floorTiles(SHED_ROOM);
    expect(TILE).toBe(16);
    expect(shed.sheet).toBe(SHEETS.floorShed);
    // Draw_0: (SHED_X0 + 32, SHED_Y0 + 32)..(SHED_X1, SHED_Y1) = (192, 128)..(768, 416), halved.
    expect(shed.area).toEqual({ x: 96, y: 64, w: 288, h: 144 });
    expect(shed.frames).toHaveLength(9);
    expect(shed.frames[0]).toHaveLength(18);
    // Column 6, row 4: (6 * 7 + 4 * 13) mod 3 = 1.
    expect(shed.frames[0]?.slice(0, 4)).toEqual([1, 2, 0, 1]);
    expect(shed.frames[1]?.slice(0, 4)).toEqual([2, 0, 1, 2]);
  });

  it('tiles the whole garden', () => {
    const garden = floorTiles(GARDEN_ROOM);
    expect(garden.sheet).toBe(SHEETS.floorGarden);
    expect(garden.area).toEqual({ x: 0, y: 0, w: 480, h: 270 });
    expect(garden.frames).toHaveLength(17);
    expect(garden.frames[0]).toHaveLength(30);
    expect(garden.frames[0]?.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it("tiles only the inside of each house room's own ring with its own floor, hashed as the shed's", () => {
    for (const [room, sheet, area, rows, columns] of [
      [LOUNGE_ROOM, SHEETS.floorLounge, { x: 64, y: 112, w: 352, h: 96 }, 6, 22],
      [HALLWAY_ROOM, SHEETS.floorHallway, { x: 96, y: 176, w: 288, h: 32 }, 2, 18],
      [STUDY_ROOM, SHEETS.floorStudy, { x: 144, y: 112, w: 192, h: 96 }, 6, 12],
    ] as const) {
      const tiles = floorTiles(room);
      expect(tiles.sheet).toBe(sheet);
      expect(tiles.area).toEqual(area);
      expect(tiles.frames).toHaveLength(rows);
      expect(tiles.frames.every((row) => row.length === columns)).toBe(true);
      // The first tile's frame hashes its column and row in the room, wherever the floor starts.
      expect(tiles.frames[0]?.[0]).toBe(((area.x / 16) * 7 + (area.y / 16) * 13) % 3);
      expect(ROOM_STYLES[room.key]).toMatchObject({ inset: true, fenced: false });
    }
  });

  it('dims and rugs the shed floor only', () => {
    expect(ROOM_STYLES.shed).toMatchObject({ floorDim: SHED_FLOOR_DIM, rug: SHED_RUG });
    expect(SHED_FLOOR_DIM).toBe(0.12);
    for (const key of ['garden', 'lounge', 'hallway', 'study'] as const) {
      expect(ROOM_STYLES[key].floorDim).toBe(0);
      expect(ROOM_STYLES[key].rug).toBeUndefined();
    }
  });

  it('has the shed rug at the prototype (360, 220)..(600, 360), halved', () => {
    expect([SHED_RUG.x, SHED_RUG.y, SHED_RUG.w, SHED_RUG.h, SHED_RUG.inset]).toEqual([
      180, 110, 120, 70, 3.5,
    ]);
  });
});

describe('walls', () => {
  it('rings the inset shed with spr_wall, corners included, over its collision bands', () => {
    const runs = wallRuns(SHED_ROOM)
      .slice(0, 4)
      .map((r) => [r.sheet.key, r.x, r.y, r.w, r.h]);
    expect(runs).toEqual([
      ['spr_wall', 80, 48, 320, 16],
      ['spr_wall', 80, 208, 320, 16],
      ['spr_wall', 80, 64, 16, 144],
      ['spr_wall', 384, 64, 16, 144],
    ]);
    // Every drawn wall tile collides.
    for (const [, x, y, w, h] of runs as [string, number, number, number, number][]) {
      expect(hitsWall(SHED_ROOM, x, y) && hitsWall(SHED_ROOM, x + w - 0.1, y + h - 0.1)).toBe(true);
    }
  });

  it("fences the garden, rows spr_fence and columns spr_fence_v, without corners or the doorway, then the shed's back wall", () => {
    expect(wallRuns(GARDEN_ROOM).map((r) => [r.sheet.key, r.x, r.y, r.w, r.h])).toEqual([
      ['spr_fence', 16, 0, 448, 16],
      ['spr_fence', 16, 254, 448, 16],
      ['spr_fence_v', 0, 16, 16, DOORWAY.top - 16],
      ['spr_fence_v', 0, DOORWAY.bottom, 16, 16],
      ['spr_fence_v', 464, 16, 16, 240],
      ['spr_shed_exterior', 0, 196, 32, 56],
    ]);
  });

  it("rings each house room's own bounds with its own wall sheet, every tile over a collision band", () => {
    for (const [room, sheet, runs] of [
      [
        LOUNGE_ROOM,
        SHEETS.wallLounge,
        [
          [48, 96, 384, 16],
          [48, 208, 384, 16],
          [48, 112, 16, 96],
          [416, 112, 16, 96],
        ],
      ],
      [
        HALLWAY_ROOM,
        SHEETS.wallHallway,
        [
          [80, 160, 320, 16],
          [80, 208, 320, 16],
          [80, 176, 16, 32],
          [384, 176, 16, 32],
        ],
      ],
      [
        STUDY_ROOM,
        SHEETS.wallStudy,
        [
          [128, 96, 224, 16],
          [128, 208, 224, 16],
          [128, 112, 16, 96],
          [336, 112, 16, 96],
        ],
      ],
    ] as const) {
      // The ring's four runs come first, then the windows and the furniture.
      const walls = wallRuns(room).slice(0, 4);
      expect(walls.every((r) => r.sheet === sheet)).toBe(true);
      expect(walls.map(({ x, y, w, h }) => [x, y, w, h])).toEqual(runs);
      for (const { x, y, w, h } of walls) {
        expect(hitsWall(room, x, y) && hitsWall(room, x + w - 0.1, y + h - 0.1)).toBe(true);
      }
      expect(fenceCorners(room)).toEqual([]);
    }
  });

  it('keeps every inset room on the 16 px tile grid, so its floor and wall tiles hash and repeat whole', () => {
    for (const room of Object.values(ROOMS).filter((r) => ROOM_STYLES[r.key].inset)) {
      const { x, y, w, h } = room.bounds;
      expect(
        [x, y, w, h].map((n) => n % TILE),
        room.key,
      ).toEqual([0, 0, 0, 0]);
    }
  });

  it('has two windows in the lounge, one in the study and the shed, none in the hallway or the garden', () => {
    expect(SHEETS.window).toMatchObject({ key: 'spr_window', frames: 1 });
    expect(LOUNGE_ROOM.windows).toEqual([
      { x: 144, w: 32 },
      { x: 304, w: 32 },
    ]);
    expect(STUDY_ROOM.windows).toEqual([{ x: 224, w: 32 }]);
    expect(windowRuns(SHED_ROOM).map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual([
      ['spr_window', 264, 48, 32, 16],
    ]);
    for (const room of [HALLWAY_ROOM, GARDEN_ROOM]) {
      expect(room.windows).toEqual([]);
      expect(windowRuns(room)).toEqual([]);
    }
  });

  it('draws each window as spr_window over the top wall band, after the walls, inside the corners', () => {
    for (const room of [LOUNGE_ROOM, STUDY_ROOM, SHED_ROOM]) {
      const runs = windowRuns(room);
      expect(runs.map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual(
        room.windows.map(({ x, w }) => ['spr_window', x, room.bounds.y, w, TILE]),
      );
      // After the ring's runs, so drawn over the wall row.
      expect(wallRuns(room).slice(4, 4 + runs.length)).toEqual(runs);
      const top = wallRuns(room)[0];
      for (const r of runs) {
        // Whole panes; the house windows on the tile grid, the shed's centred where the prototype drew it.
        if (room !== SHED_ROOM) expect(r.x % TILE).toBe(0);
        expect(r.w % TILE).toBe(0);
        // Clear of the corner tiles, and over the top wall, which still collides under it.
        expect(r.x).toBeGreaterThanOrEqual(room.bounds.x + TILE);
        expect(r.x + r.w).toBeLessThanOrEqual(room.bounds.x + room.bounds.w - TILE);
        expect([r.y, r.h]).toEqual(top && [top.y, top.h]);
        expect(hitsWall(room, r.x, r.y) && hitsWall(room, r.x + r.w - 0.1, r.y + r.h - 0.1)).toBe(
          true,
        );
      }
    }
  });

  it("ends each room's runs with its furniture, each sheet over its rect, so the bake draws it over the floor and walls", () => {
    const furniture = (room: Room) =>
      furnitureRuns(room).map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h]);
    expect(furniture(LOUNGE_ROOM)).toEqual([
      ['spr_fireplace', 224, 112, 32, 24],
      ['spr_side_table', 400, 112, 16, 16],
    ]);
    expect(furniture(STUDY_ROOM)).toEqual([
      ['spr_desk', 144, 112, 32, 16],
      ['spr_bookshelf', 288, 112, 48, 16],
    ]);
    expect(furniture(HALLWAY_ROOM)).toEqual([
      ['spr_runner', 128, 180, 208, 24],
      ['spr_hall_table', 344, 176, 16, 12],
    ]);
    for (const room of Object.values(ROOMS)) {
      const runs = furnitureRuns(room);
      expect(wallRuns(room).slice(wallRuns(room).length - runs.length)).toEqual(runs);
      for (const r of runs) {
        // A one-frame piece is its sheet's size, halved; a run is whole tiles of it.
        expect((r.w * 2) % r.sheet.frameWidth, `${room.key} ${r.sheet.key}`).toBe(0);
        expect(r.h * 2).toBe(r.sheet.frameHeight);
        // On the floor, clear of the walls' bands, but for the shed's back wall over the garden's fence.
        const f = insideWalls(room);
        expect(
          r.x >= f.x && r.x + r.w <= f.x + f.w && r.y >= f.y && r.y + r.h <= f.y + f.h,
          `${room.key} ${r.sheet.key}`,
        ).toBe(r.sheet !== SHEETS.shedExterior);
      }
    }
    // The shed's floor clutter is sorted against the player (furnitureSprites); only the wall-mounted shelf is baked.
    expect(furniture(SHED_ROOM)).toEqual([['spr_shelf', 206, 65, 28, 22]]);
    expect(furniture(GARDEN_ROOM)).toEqual([['spr_shed_exterior', 0, 196, 32, 56]]);
  });

  it("bakes the shed's back wall after the fence, over the doorway's end tiles, with no shadow", () => {
    const runs = wallRuns(GARDEN_ROOM);
    const surround = runs.at(-1);
    expect(surround).toEqual({ sheet: SHEETS.shedExterior, x: 0, y: 196, w: 32, h: 56 });
    // The left fence column's tiles either side of the doorway, which the surround overlaps.
    const [above, below] = runs.filter((r) => r.sheet === SHEETS.fenceV && r.x === 0);
    expect(above && above.y + above.h).toBe(DOORWAY.top);
    expect(below?.y).toBe(DOORWAY.bottom);
    expect(furnitureShadows(GARDEN_ROOM)).toEqual([]);
    // The door is drawn over the bake, in the surround's opening, sorted at its top edge as before.
    const d = propSprite(propByKey(GARDEN_ROOM.props, 'door'));
    expect(d && [d.sheet.key, d.x, d.y, d.scale, d.depth]).toEqual(['spr_door', 16, 228, 0.5, 220]);
  });

  it('mitres the garden corners with two rails each, three bands a leg, inside the corner tiles', () => {
    const rects = fenceCorners(GARDEN_ROOM);
    expect(fenceCorners(SHED_ROOM)).toEqual([]);
    expect(fenceCorners(LOUNGE_ROOM)).toEqual([]);
    // 4 corners x 2 L's x 2 legs x 3 bands.
    expect(rects).toHaveLength(48);
    const inTile = (r: (typeof rects)[number]): boolean =>
      [0, 464].some((x) => r.x >= x && r.x + r.w <= x + 16) &&
      [0, 254].some((y) => r.y >= y && r.y + r.h <= y + 16);
    expect(rects.every(inTile)).toBe(true);
    // Top-left, outer L: the horizontal leg on rows 13-15 from column 12 to the tile's edge.
    expect(rects.slice(0, 3)).toEqual([
      { colour: 0x785537, x: 6, y: 6.5, w: 10, h: 1.5 },
      { colour: 0xa06e46, x: 6, y: 6.5, w: 10, h: 0.5 },
      { colour: 0x462d19, x: 6, y: 7.5, w: 10, h: 0.5 },
    ]);
  });
});

describe('props', () => {
  it('draws the shed props from their sprites, centred', () => {
    const at = (key: string) => {
      const s = propSprite(propByKey(SHED_ROOM.props, key));
      return s && [s.sheet.key, s.frame, s.x, s.y, s.scale];
    };
    expect(at('workbench')).toEqual(['spr_workbench', 0, 125, 90, 0.5]);
    expect(at('planting_table')).toEqual(['spr_planting_table', 0, 165, 90, 0.5]);
    expect(at('shop_kiosk')).toEqual(['spr_shop_kiosk', 0, 125, 145, 0.5]);
    expect(at('door')).toEqual(['spr_door', 0, 240, 216, 0.5]);
  });

  it('sorts a prop at its bottom edge and a door, in its wall, at its top edge', () => {
    const depth = (props: readonly Prop[], key: string) => propSprite(propByKey(props, key))?.depth;
    expect(depth(SHED_ROOM.props, 'workbench')).toBe(100);
    expect(depth(SHED_ROOM.props, 'door')).toBe(208);
    expect(depth(GARDEN_ROOM.props, 'door')).toBe(220);
  });

  it("draws the shed door on the bottom wall: inst_52E224DC's 32 px square at top-left (464, 416)", () => {
    const door = propSprite(propByKey(SHED_ROOM.props, 'door'));
    expect(door && [door.x - 8, door.y - 8]).toEqual([232, 208]);
    const bottomWall = wallRuns(SHED_ROOM)[1];
    expect(door && [door.y - 8, door.y + 8]).toEqual(
      bottomWall && [bottomWall.y, bottomWall.y + bottomWall.h],
    );
  });

  it("draws each source plant's species frame and the garden door on its top-left origin", () => {
    const frame = (key: string) => propSprite(propByKey(GARDEN_ROOM.props, key))?.frame;
    expect([frame('source_juniper'), frame('source_maple'), frame('source_pine')]).toEqual([
      0, 1, 2,
    ]);
    const door = propSprite(propByKey(GARDEN_ROOM.props, 'door'));
    // Prototype top-left (16, 440), 32 px: logical (8, 220)..(24, 236).
    expect(door && [door.x - 8, door.y - 8]).toEqual([8, 220]);
  });

  it('draws no pedestal and no shadow for a display spot, which its furniture draws in the bake', () => {
    for (const room of [LOUNGE_ROOM, STUDY_ROOM]) {
      const spots = room.props.filter((p) => p.pedestalKey !== undefined);
      expect(spots).toHaveLength(2);
      for (const p of spots) {
        expect(propSprite(p)).toBeUndefined();
        expect(propShadow(p)).toBeUndefined();
      }
    }
  });

  it("draws the lounge's door on the bottom wall, the shed's lounge door on the top", () => {
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.key, s.x, s.y, s.scale, s.depth];
    };
    expect(at(LOUNGE_ROOM.props, 'door')).toEqual(['spr_door', 240, 216, 0.5, 208]);
    const topWall = wallRuns(SHED_ROOM)[0];
    expect(at(SHED_ROOM.props, 'door_lounge')).toEqual(['spr_door', 240, 56, 0.5, topWall?.y]);
  });

  it('draws the doors on the row y 190 in the side walls, sorted at their top edge', () => {
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.key, s.x, s.y, s.scale, s.depth];
    };
    expect(at(LOUNGE_ROOM.props, 'door_hallway')).toEqual(['spr_door', 424, 190, 0.5, 182]);
    expect(at(HALLWAY_ROOM.props, 'door_lounge')).toEqual(['spr_door', 88, 190, 0.5, 182]);
    expect(at(HALLWAY_ROOM.props, 'door_study')).toEqual(['spr_door', 392, 190, 0.5, 182]);
    expect(at(STUDY_ROOM.props, 'door_hallway')).toEqual(['spr_door', 136, 190, 0.5, 182]);
  });

  it("draws the study's glazed double door over its 32x16 rect and the garden's glazed leaf on its fence, sorted at their top edge", () => {
    expect(SHEETS.doorGlass).toEqual({
      key: 'spr_door_glass',
      frameWidth: 64,
      frameHeight: 32,
      frames: 1,
    });
    expect(SHEETS.doorGlassSingle).toEqual({
      key: 'spr_door_glass_single',
      frameWidth: 32,
      frameHeight: 32,
      frames: 1,
    });
    const at = (props: readonly Prop[], key: string) => {
      const p = propByKey(props, key);
      const s = propSprite(p);
      // The frame at the sprite's scale covers the prop's rect exactly.
      expect(s && [s.sheet.frameWidth * s.scale, s.sheet.frameHeight * s.scale]).toEqual([
        p.w,
        p.h,
      ]);
      return s && [s.sheet.key, s.x, s.y, s.scale, s.depth];
    };
    expect(at(STUDY_ROOM.props, 'door_garden')).toEqual(['spr_door_glass', 320, 216, 0.5, 208]);
    expect(at(GARDEN_ROOM.props, 'door_study')).toEqual([
      'spr_door_glass_single',
      472,
      190,
      0.5,
      182,
    ]);
    // Every other door keeps the prototype's spr_door.
    const doors = Object.values(ROOMS).flatMap((r) => r.props.filter((p) => p.target));
    expect(doors.filter((p) => propSprite(p)?.sheet !== SHEETS.door).map((p) => p.key)).toEqual([
      'door_study',
      'door_garden',
    ]);
  });

  it("puts a spot's label 30 prototype px below its centre, just under the furniture's front edge", () => {
    expect(PEDESTAL_LABEL_DY).toBe(15);
    for (const room of [LOUNGE_ROOM, STUDY_ROOM]) {
      for (const p of room.props.filter((q) => q.pedestalKey !== undefined)) {
        const front = p.y + p.h / 2;
        const label = p.y + PEDESTAL_LABEL_DY;
        expect(label, p.key).toBeGreaterThanOrEqual(front);
        expect(label, p.key).toBeLessThanOrEqual(front + 10);
      }
    }
  });
});

describe('shadows', () => {
  it("halves the prototype's ellipses round each origin", () => {
    expect(propShadow(propByKey(GARDEN_ROOM.props, 'source_juniper'))).toEqual({
      x: 140,
      y: 90 + 10,
      w: 18,
      h: 2,
      alpha: 0.25,
    });
    expect(propShadow(propByKey(SHED_ROOM.props, 'workbench'))).toBeUndefined();
    expect(playerShadow(240, 135)).toEqual({ x: 240, y: 141.75, w: 16, h: 4.5, alpha: 0.25 });
    expect(treeShadow(100, 100, 1)).toEqual({ x: 100, y: 118.5, w: 32, h: 5, alpha: 0.25 });
  });

  it("puts Draw_0's faint ellipse, (dx - w/3, dy - 4)..(dx + w/3, dy + 2), under each piece of the shed's decor", () => {
    // Centre, width x 3 (the shadow is 2w/3 prototype px wide, halved, so x 3 gives w), height, alpha:
    // spr_shelf's foot at prototype (440, 174) gives x 440 +- 56/3, y 170..176, halved.
    const shadows = (list: readonly Shadow[]) =>
      list.map((s) => [s.x, s.y, Math.round(s.w * 3), s.h, s.alpha]);
    // The bake has the shelf's; the sorted pieces' are drawn live, the same ellipses.
    expect(shadows(furnitureShadows(SHED_ROOM))).toEqual([[220, 86.5, 56, 3, 0.18]]);
    expect(shadows(sortedFurnitureShadows(SHED_ROOM))).toEqual([
      [106, 175.5, 36, 3, 0.18],
      [353, 127.5, 32, 3, 0.18],
      [353, 193.5, 40, 3, 0.18],
      [150, 191.5, 32, 3, 0.18],
    ]);
    // The house furniture has none.
    for (const room of [LOUNGE_ROOM, STUDY_ROOM, HALLWAY_ROOM, GARDEN_ROOM]) {
      expect(furnitureShadows(room)).toEqual([]);
      expect(sortedFurnitureShadows(room)).toEqual([]);
    }
  });

  it("draws the shed's floor clutter as sprites sorted at their bottom edge, the player behind above it and in front below", () => {
    expect(
      furnitureSprites(SHED_ROOM).map((s) => [s.sheet.key, s.frame, s.x, s.y, s.scale, s.depth]),
    ).toEqual([
      ['spr_tools', 0, 106, 163, 0.5, 176],
      ['spr_watering_can', 0, 353, 120.5, 0.5, 128],
      ['spr_pot_stack', 0, 353, 184, 0.5, 194],
      ['spr_sack', 0, 150, 183.5, 0.5, 192],
    ]);
    // No house room or the garden sorts any furniture; their runs are all of it.
    for (const room of [LOUNGE_ROOM, STUDY_ROOM, HALLWAY_ROOM, GARDEN_ROOM]) {
      expect(furnitureSprites(room)).toEqual([]);
      expect(furnitureRuns(room)).toHaveLength(room.furniture.length);
    }
    // drawPlayer: the player's depth is its centre y + PLAYER_H / 2, spr_player's 32 px at 1.5x halved = 24.
    const playerDepth = (y: number) => y + (SHEETS.player.frameHeight * PLAYER_SCALE) / 2;
    expect(playerDepth(0)).toBe(12);
    const sack = furnitureSprites(SHED_ROOM).find((s) => s.sheet === SHEETS.sack);
    expect(sack && playerDepth(175) < sack.depth).toBe(true);
    expect(sack && playerDepth(185) > sack.depth).toBe(true);
  });
});

describe('season wash', () => {
  it('washes the garden per season, summer left as it was', () => {
    expect(SEASONS.map((season) => seasonWash(GARDEN_ROOM, season))).toEqual([
      { colour: 0xc8f0a0, alpha: 0.12 },
      undefined,
      { colour: 0xbe6e28, alpha: 0.5 },
      { colour: 0xe6eef6, alpha: 0.5 },
    ]);
  });

  it('never washes an indoor room', () => {
    for (const room of Object.values(ROOMS).filter((r) => r.key !== 'garden')) {
      for (const season of SEASONS) expect(seasonWash(room, season)).toBeUndefined();
    }
  });

  it('is the same wash through a season, so only a season turn rebakes the garden', () => {
    expect(seasonWash(GARDEN_ROOM, 'winter')).toBe(seasonWash(GARDEN_ROOM, 'winter'));
  });
});
