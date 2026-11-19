import { describe, expect, it } from 'vitest';
import { SEASONS } from '../sim/seasons';
import { PLAYER_FEET, SHEETS, sheetPxPerLogical, type Sheet } from './assets';
import { FRONT_GARDEN_ROOM } from './frontGardenRoom';
import { GARDEN_ROOM, KITCHEN_WINDOW, ROOMS } from './gardenRoom';
import { PALETTE } from './palette';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { HALLWAY_BLOCK, HALLWAY_BLOCK_CAPS, LOUNGE_ROOM } from './loungeRoom';
import {
  BACK_WALL_FACE,
  CAST_SHADOW_WASH,
  PEDESTAL_LABEL_DY,
  ROOM_STYLES,
  SHED_RUG,
  TILE,
  WALL_CAP,
  bakeScale,
  castShadow,
  castShadows,
  clipToRect,
  convexHull,
  floorTiles,
  furnitureCaster,
  furnitureRuns,
  furnitureSprites,
  paperTiles,
  pieceShadows,
  playerShadow,
  propCaster,
  propShadow,
  propSprite,
  seasonWash,
  subtractConvex,
  treeShadow,
  wallRuns,
  washPieces,
  windowRuns,
  type RoomStyle,
} from './roomArt';
import { SHED_ROOM, hitsWall, insideWalls, type Prop, type Rect, type Room } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import { isIndoor } from './weather';

const propByKey = (props: readonly Prop[], key: string): Prop => {
  const p = props.find((q) => q.key === key);
  if (!p) throw new Error(key);
  return p;
};

/** The rects' bounding box, [x0, y0, x1, y1]. */
const extent = (list: readonly Rect[]): number[] => [
  Math.min(...list.map((r) => r.x)),
  Math.min(...list.map((r) => r.y)),
  Math.max(...list.map((r) => r.x + r.w)),
  Math.max(...list.map((r) => r.y + r.h)),
];

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

  it('tiles the whole garden in its 16 px Inked lawn, three variants', () => {
    const garden = floorTiles(GARDEN_ROOM);
    expect(garden.sheet).toBe(SHEETS.floorGarden);
    expect(SHEETS.floorGarden).toMatchObject({ frameWidth: 64, frameHeight: 64, frames: 3 });
    expect(garden.area).toEqual({ x: 0, y: 0, w: 464, h: 512 });
    expect(garden.frames).toHaveLength(32);
    expect(garden.frames[0]).toHaveLength(29);
    expect(garden.frames[0]?.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it("tiles only the inside of each house room's own ring with its own floor, hashed as the shed's", () => {
    for (const [room, sheet, area, rows, columns] of [
      [LOUNGE_ROOM, SHEETS.floorLounge, { x: 160, y: 64, w: 272, h: 144 }, 9, 17],
      [HALLWAY_ROOM, SHEETS.floorHallway, { x: 192, y: 144, w: 96, h: 64 }, 4, 6],
      [STUDY_ROOM, SHEETS.floorStudy, { x: 160, y: 64, w: 144, h: 144 }, 9, 9],
      [GREENHOUSE_ROOM, SHEETS.floorGreenhouse, { x: 160, y: 80, w: 160, h: 112 }, 7, 10],
    ] as const) {
      const tiles = floorTiles(room);
      expect(tiles.sheet).toBe(sheet);
      expect(tiles.area).toEqual(area);
      expect(tiles.frames).toHaveLength(rows);
      expect(tiles.frames.every((row) => row.length === columns)).toBe(true);
      // The first tile's frame hashes its column and row in the room, wherever the floor starts.
      expect(tiles.frames[0]?.[0]).toBe(((area.x / 16) * 7 + (area.y / 16) * 13) % 3);
      expect(ROOM_STYLES[room.key].inset).toBe(true);
      expect(ROOM_STYLES[room.key].corner).toBeUndefined();
    }
  });

  it('draws the shed floor as its 16 px Inked boards, three variants', () => {
    expect(SHEETS.floorShed).toEqual({
      key: 'spr_floor_shed',
      frameWidth: 64,
      frameHeight: 64,
      frames: 3,
      art: 'inked',
    });
    const shed = floorTiles(SHED_ROOM);
    expect(shed.sheet.frameWidth / 4).toBe(TILE);
  });

  it("lays the shed's Inked rug over the prototype's (360, 220)..(600, 360), halved, and no other room's", () => {
    expect([SHED_RUG.x, SHED_RUG.y, SHED_RUG.w, SHED_RUG.h]).toEqual([180, 110, 120, 70]);
    expect(ROOM_STYLES.shed.rug).toEqual({ sheet: SHEETS.shedRug, ...SHED_RUG });
    // The sheet is the rect at 4 sheet px per logical px.
    expect([SHEETS.shedRug.frameWidth / 4, SHEETS.shedRug.frameHeight / 4]).toEqual([120, 70]);
    for (const key of [
      'garden',
      'frontGarden',
      'lounge',
      'hallway',
      'study',
      'greenhouse',
    ] as const) {
      expect(ROOM_STYLES[key].rug).toBeUndefined();
    }
  });
});

describe('bake', () => {
  it('lays paper in the shed, the house rooms and the greenhouse, not the gardens, and bakes every room at 4 px per logical px', () => {
    const papered = [SHED_ROOM, LOUNGE_ROOM, HALLWAY_ROOM, STUDY_ROOM, GREENHOUSE_ROOM];
    for (const room of Object.values(ROOMS)) {
      expect(ROOM_STYLES[room.key].paper, room.key).toBe(papered.includes(room));
      if (!papered.includes(room)) expect(paperTiles(room)).toEqual([]);
      expect(bakeScale(room), room.key).toBe(4);
    }
  });

  it("lays the shed's paper over the whole room from (0, 0) in 64 px steps; paper alone bakes at 4", () => {
    const door = SHEETS.door;
    const pixel: RoomStyle = {
      floor: door,
      wallRow: door,
      wallColumn: door,
      wallHeight: { row: BACK_WALL_FACE, column: BACK_WALL_FACE },
      inset: true,
      paper: false,
    };
    expect(bakeScale(GREENHOUSE_ROOM, pixel)).toBe(2);
    expect(bakeScale(GREENHOUSE_ROOM, { ...pixel, paper: true })).toBe(4);
    const tiles = paperTiles(SHED_ROOM);
    // The shed's 480x270 canvas: 8 columns (8 * 64 = 512 >= 480), 5 rows (5 * 64 = 320 >= 270).
    expect(tiles).toHaveLength(8 * 5);
    expect(tiles.every((t) => t.sheet === SHEETS.paper)).toBe(true);
    expect(tiles.slice(0, 2).map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [64, 0],
    ]);
    expect(tiles.at(-1)).toMatchObject({ x: 448, y: 256 });
    // Every logical px of the room lies in exactly one tile.
    for (const [px, py] of [
      [0, 0],
      [479, 269],
      [63.5, 64],
      [240, 135],
    ] as const) {
      expect(
        tiles.filter((t) => px >= t.x && px < t.x + 64 && py >= t.y && py < t.y + 64),
      ).toHaveLength(1);
    }
  });

  it('bakes at 4 when any sheet it draws is Inked, paper or not', () => {
    const door = SHEETS.door;
    const pixel: RoomStyle = {
      floor: door,
      wallRow: door,
      wallColumn: door,
      wallHeight: { row: BACK_WALL_FACE, column: BACK_WALL_FACE },
      inset: true,
      paper: false,
    };
    expect(bakeScale(GREENHOUSE_ROOM, { ...pixel, floor: SHEETS.paper })).toBe(4);
    expect(bakeScale(GREENHOUSE_ROOM, { ...pixel, wallColumn: SHEETS.paper })).toBe(4);
    const face = { sheet: SHEETS.paper, height: BACK_WALL_FACE, cap: WALL_CAP };
    expect(bakeScale(GREENHOUSE_ROOM, { ...pixel, face })).toBe(4);
    const rug = { sheet: SHEETS.paper, x: 0, y: 0, w: 64, h: 64 };
    expect(bakeScale(GREENHOUSE_ROOM, { ...pixel, rug })).toBe(4);
  });
});

describe('walls', () => {
  it("draws the shed's back wall as a 48 px face standing on the floor line and its other walls as 8 px caps against the floor", () => {
    expect([BACK_WALL_FACE, WALL_CAP]).toEqual([48, 8]);
    expect(ROOM_STYLES.shed.face).toEqual({ sheet: SHEETS.shedWall, height: 48, cap: 8 });
    expect([ROOM_STYLES.shed.wallRow, ROOM_STYLES.shed.wallColumn]).toEqual([
      SHEETS.shedCap,
      SHEETS.shedCapV,
    ]);
    const runs = wallRuns(SHED_ROOM);
    const of = (sheet: (typeof runs)[number]['sheet'], x?: number) =>
      runs.filter((r) => r.sheet === sheet && (x === undefined || r.x === x));
    const floor = insideWalls(SHED_ROOM);
    // The face: 18 tiles of 16 x 48 across the top band between the side walls, x 96..384,
    // its bottom on the floor line (y 64), rising 32 px above the ring's top (y 48) to y 16.
    const face = of(SHEETS.shedWall);
    expect(face).toHaveLength(18);
    expect(face.every((r) => r.w === 16 && r.h === 48)).toBe(true);
    expect(extent(face)).toEqual([96, 16, 384, 64]);
    expect(floor.y).toBe(64);
    // The side caps, 8 px on the bands' inner edges (x 88..96, 384..392), from the face's top to the south band.
    expect(extent(of(SHEETS.shedCapV, 88))).toEqual([88, 16, 96, 208]);
    expect(extent(of(SHEETS.shedCapV, 384))).toEqual([384, 16, 392, 208]);
    expect(of(SHEETS.shedCapV)).toHaveLength(24);
    // The south cap on its band's inner edge (y 208..216), across both side caps.
    const south = of(SHEETS.shedCap);
    expect(south).toHaveLength(19);
    expect(extent(south)).toEqual([88, 208, 392, 216]);
    // Each cap abuts the floor.
    expect([floor.x, floor.x + floor.w, floor.y + floor.h]).toEqual([96, 384, 208]);
    // The ring's runs come first (61 tiles), then the window.
    expect(runs).toHaveLength(61 + 1);
    // Every cap tile in the ring's bounds lies on a collision band; collision is still the whole ring.
    for (const r of [...of(SHEETS.shedCapV), ...south].filter((t) => t.y >= SHED_ROOM.bounds.y)) {
      expect(
        hitsWall(SHED_ROOM, r.x, r.y) && hitsWall(SHED_ROOM, r.x + r.w - 0.1, r.y + r.h - 0.1),
      ).toBe(true);
    }
    // Each tile's frame is hashed from where it lands, so neighbours along a run differ.
    expect(face.map((r) => r.frame).slice(0, 4)).toEqual([1, 2, 0, 1]);
    for (const list of [face, of(SHEETS.shedCapV, 88), south]) {
      for (let i = 1; i < list.length; i += 1) expect(list[i]?.frame).not.toBe(list[i - 1]?.frame);
    }
  });

  it('fences the garden tile by tile, rows spr_fence and columns spr_fence_v, its corners spr_fence_corner', () => {
    const runs = wallRuns(GARDEN_ROOM);
    // 27 tiles in each row (x 16..448), 30 in each column (y 16..496), the four corners.
    const ring = runs.slice(0, 2 * 27 + 2 * 30 + 4);
    const of = (sheet: Sheet) => ring.filter((r) => r.sheet === sheet);
    expect(ring.every((r) => r.w === 16 && r.h === 16)).toBe(true);
    expect([of(SHEETS.fence).length, ...extent(of(SHEETS.fence))]).toEqual([54, 16, 0, 448, 512]);
    expect([of(SHEETS.fenceV).length, ...extent(of(SHEETS.fenceV))]).toEqual([60, 0, 16, 464, 496]);
    // The corners last in the ring, frames NW, NE, SW, SE, each on its corner tile.
    expect(ring.slice(-4).map((r) => [r.sheet.key, r.frame, r.x, r.y])).toEqual([
      ['spr_fence_corner', 0, 0, 0],
      ['spr_fence_corner', 1, 448, 0],
      ['spr_fence_corner', 2, 0, 496],
      ['spr_fence_corner', 3, 448, 496],
    ]);
    expect(SHEETS.fenceCorner).toMatchObject({ frameWidth: 64, frameHeight: 64, frames: 4 });
    expect(ROOM_STYLES.garden.corner).toBe(SHEETS.fenceCorner);
    // The variants scatter: neighbours along a row and down a column differ.
    for (const list of [
      of(SHEETS.fence).filter((r) => r.y === 0),
      of(SHEETS.fenceV).filter((r) => r.x === 448),
    ]) {
      for (let i = 1; i < list.length; i += 1) expect(list[i]?.frame).not.toBe(list[i - 1]?.frame);
    }
    // The ring is all of it: the buildings are furniture, baked over it (furnitureRuns).
    expect(runs).toHaveLength(ring.length);
  });

  it("draws the buildings' roofs over their footprints first, then each 48 px face standing on its footprint's south edge, the caps on the edges", () => {
    const runs = furnitureRuns(GARDEN_ROOM);
    const at = (sheet: Sheet, x?: number) =>
      runs.filter((r) => r.sheet === sheet && (x === undefined || r.x === x));
    const summary = (sheet: Sheet, x?: number) => [at(sheet, x).length, ...extent(at(sheet, x))];
    // The house: its tiled roof over the whole footprint, its east wall's cap down the passage's
    // side, its back face along the notch (x 160..408, y 96..144) with the kitchen window in it;
    // the face's whole 16 px tiles run to 416, and the cap covers the last one's 8 px overhang.
    expect(summary(SHEETS.houseRoof)).toEqual([26 * 9, 0, 0, 416, 144]);
    expect(summary(SHEETS.houseCapV)).toEqual([9, 408, 0, 416, 144]);
    expect(summary(SHEETS.houseFace)).toEqual([16, 160, 96, 416, 144]);
    expect(summary(SHEETS.houseWindow)).toEqual([1, 204, 100, 244, 124]);
    expect(KITCHEN_WINDOW).toEqual({ x: 204, y: 100, w: 40, h: 24 });
    // The shed: its iron roof, its weatherboarded face along the lawn (y 208..256).
    expect(summary(SHEETS.shedRoof)).toEqual([10 * 7, 0, 144, 160, 256]);
    expect(summary(SHEETS.shedFace)).toEqual([10, 0, 208, 160, 256]);
    // The greenhouse: its glass roof, its frame rails on the north (y 304..312), west and east
    // edges (down to its face's top, y 368), its glass face in the lawn (y 368..416).
    expect(summary(SHEETS.greenhouseRoof)).toEqual([10 * 7, 256, 304, 416, 416]);
    expect(summary(SHEETS.greenhouseCap)).toEqual([10, 256, 304, 416, 312]);
    expect(summary(SHEETS.greenhouseCapV, 256)).toEqual([4, 256, 304, 264, 368]);
    expect(summary(SHEETS.greenhouseCapV, 408)).toEqual([4, 408, 304, 416, 368]);
    expect(summary(SHEETS.greenhouseFace)).toEqual([10, 256, 368, 416, 416]);
    // Every face is the scale rule's 2.4 m and its tiles 16 wide; every cap 8 px.
    for (const sheet of [SHEETS.houseFace, SHEETS.shedFace, SHEETS.greenhouseFace]) {
      expect(at(sheet).every((r) => r.w === 16 && r.h === BACK_WALL_FACE)).toBe(true);
    }
    for (const r of [...at(SHEETS.houseCapV), ...at(SHEETS.greenhouseCapV)]) expect(r.w).toBe(8);
    for (const r of at(SHEETS.greenhouseCap)) expect(r.h).toBe(WALL_CAP);
    // Each roof draws before its face, so the face covers the roof's lower 32 px; the window after the house's face.
    const first = (sheet: Sheet) => runs.findIndex((r) => r.sheet === sheet);
    const last = (sheet: Sheet) => runs.map((r) => r.sheet).lastIndexOf(sheet);
    expect(last(SHEETS.houseRoof)).toBeLessThan(first(SHEETS.houseFace));
    expect(last(SHEETS.houseFace)).toBeLessThan(first(SHEETS.houseWindow));
    expect(last(SHEETS.houseFace)).toBeLessThan(first(SHEETS.houseCapV));
    expect(last(SHEETS.shedRoof)).toBeLessThan(first(SHEETS.shedFace));
    expect(last(SHEETS.greenhouseRoof)).toBeLessThan(first(SHEETS.greenhouseCap));
    expect(last(SHEETS.greenhouseCapV)).toBeLessThan(first(SHEETS.greenhouseFace));
    // The variants scatter along each face, as the shed's back wall's do.
    for (const sheet of [SHEETS.houseFace, SHEETS.shedFace, SHEETS.greenhouseFace]) {
      const list = at(sheet);
      for (let i = 1; i < list.length; i += 1) expect(list[i]?.frame).not.toBe(list[i - 1]?.frame);
    }
  });

  it('cuts a furniture piece of variants into hashed tiles and keeps a one-frame piece one run', () => {
    const room: Room = {
      ...LOUNGE_ROOM,
      furniture: [
        { sheet: SHEETS.houseRoof, x: 32, y: 48, w: 48, h: 16, solid: false },
        { sheet: SHEETS.door, x: 32, y: 64, w: 48, h: 16, solid: false },
      ],
    };
    expect(furnitureRuns(room).map((r) => [r.sheet.key, r.frame, r.x, r.y, r.w, r.h])).toEqual([
      // Column 2, row 3: (2 * 7 + 3 * 13) mod 3 = 2, then on by 7 a column.
      ['spr_house_roof', 2, 32, 48, 16, 16],
      ['spr_house_roof', 0, 48, 48, 16, 16],
      ['spr_house_roof', 1, 64, 48, 16, 16],
      ['spr_door', undefined, 32, 64, 48, 16],
    ]);
  });

  it("leaves the fence showing only where plan B2 has one: east, south, west of the lawn and across the passage's top", () => {
    const runs = wallRuns(GARDEN_ROOM);
    const buildings = furnitureRuns(GARDEN_ROOM);
    /** True if the 16 px tile at (x, y) is drawn over by a building. */
    const hidden = (x: number, y: number): boolean =>
      buildings.some((b) => x >= b.x && y >= b.y && x + 16 <= b.x + b.w && y + 16 <= b.y + b.h);
    const fenceTiles = runs
      .filter((r) => r.sheet === SHEETS.fence || r.sheet === SHEETS.fenceV)
      .flatMap((r) =>
        Array.from({ length: (r.w / 16) * (r.h / 16) }, (_, i) => ({
          x: r.x + (i % (r.w / 16)) * 16,
          y: r.y + Math.floor(i / (r.w / 16)) * 16,
        })),
      );
    const shown = fenceTiles.filter((t) => !hidden(t.x, t.y));
    // The north fence: the passage's top, x 416..448, then the corner post at 448; the
    // north-west corner tile lies under the house's roof.
    expect(shown.filter((t) => t.y === 0).map((t) => t.x)).toEqual([416, 432]);
    expect(hidden(0, 0)).toBe(true);
    expect(hidden(448, 0)).toBe(false);
    // The west fence from the shed's south face (y 256) down to the south corner.
    expect(shown.filter((t) => t.x === 0).map((t) => t.y)).toEqual(
      Array.from({ length: 15 }, (_, i) => 256 + i * 16),
    );
    // The east fence and the south fence whole.
    expect(shown.filter((t) => t.x === 448)).toHaveLength(30);
    expect(shown.filter((t) => t.y === 496)).toHaveLength(27);
    // Every fence tile and every building piece collides.
    for (const r of [...runs, ...buildings]) {
      expect(
        hitsWall(GARDEN_ROOM, r.x, r.y) && hitsWall(GARDEN_ROOM, r.x + r.w - 0.1, r.y + r.h - 0.1),
        r.sheet.key,
      ).toBe(true);
    }
  });

  it("draws the greenhouse's back wall as its glass face on the floor line between the garden's frame rails as caps", () => {
    expect(ROOM_STYLES.greenhouse.face).toEqual({
      sheet: SHEETS.greenhouseWall,
      height: BACK_WALL_FACE,
      cap: WALL_CAP,
    });
    expect([ROOM_STYLES.greenhouse.wallRow, ROOM_STYLES.greenhouse.wallColumn]).toEqual([
      SHEETS.greenhouseCap,
      SHEETS.greenhouseCapV,
    ]);
    const runs = wallRuns(GREENHOUSE_ROOM);
    const of = (sheet: Sheet, x?: number) =>
      runs.filter((r) => r.sheet === sheet && (x === undefined || r.x === x));
    const floor = insideWalls(GREENHOUSE_ROOM);
    // The face: 10 tiles of 16 x 48 between the side caps, x 160..320, its bottom on the floor
    // line (y 80), rising 32 px above the ring's top (y 64) to y 32.
    const face = of(SHEETS.greenhouseWall);
    expect(face).toHaveLength(10);
    expect(face.every((r) => r.w === 16 && r.h === BACK_WALL_FACE)).toBe(true);
    expect(extent(face)).toEqual([160, 32, 320, 80]);
    expect(floor).toEqual({ x: 160, y: 80, w: 160, h: 112 });
    // The side rails on the bands' inner edges, from the face's top down to the south band.
    expect(extent(of(SHEETS.greenhouseCapV, 152))).toEqual([152, 32, 160, 192]);
    expect(extent(of(SHEETS.greenhouseCapV, 320))).toEqual([320, 32, 328, 192]);
    expect(of(SHEETS.greenhouseCapV)).toHaveLength(20);
    // The south rail on its band's inner edge, across both side rails.
    expect(of(SHEETS.greenhouseCap)).toHaveLength(11);
    expect(extent(of(SHEETS.greenhouseCap))).toEqual([152, 192, 328, 200]);
    expect(runs).toHaveLength(41);
    for (const r of runs.filter((t) => t.sheet !== SHEETS.greenhouseWall && t.y >= 64)) {
      expect(
        hitsWall(GREENHOUSE_ROOM, r.x, r.y) &&
          hitsWall(GREENHOUSE_ROOM, r.x + r.w - 0.1, r.y + r.h - 0.1),
      ).toBe(true);
    }
    for (const list of [face, of(SHEETS.greenhouseCapV, 152), of(SHEETS.greenhouseCap)]) {
      for (let i = 1; i < list.length; i += 1) expect(list[i]?.frame).not.toBe(list[i - 1]?.frame);
    }
  });

  it("draws each house room's back wall as its own 48 px face on the floor line and its other walls as its own 8 px caps, as the shed's", () => {
    for (const [room, face, cap, capV, faceExtent, sides, southExtent] of [
      [
        LOUNGE_ROOM,
        SHEETS.wallLounge,
        SHEETS.loungeCap,
        SHEETS.loungeCapV,
        [160, 16, 432, 64],
        [152, 432],
        [152, 208, 440, 216],
      ],
      [
        HALLWAY_ROOM,
        SHEETS.wallHallway,
        SHEETS.hallwayCap,
        SHEETS.hallwayCapV,
        [192, 96, 288, 144],
        [184, 288],
        [184, 208, 296, 216],
      ],
      [
        STUDY_ROOM,
        SHEETS.wallStudy,
        SHEETS.studyCap,
        SHEETS.studyCapV,
        [160, 16, 304, 64],
        [152, 304],
        [152, 208, 312, 216],
      ],
    ] as const) {
      const style = ROOM_STYLES[room.key];
      expect(style.face, room.key).toEqual({ sheet: face, height: BACK_WALL_FACE, cap: WALL_CAP });
      expect([style.wallRow, style.wallColumn]).toEqual([cap, capV]);
      const runs = wallRuns(room);
      const of = (sheet: Sheet, x?: number) =>
        runs.filter((r) => r.sheet === sheet && (x === undefined || r.x === x));
      expect(extent(of(face)), room.key).toEqual(faceExtent);
      expect(of(face).every((r) => r.w === 16 && r.h === 48)).toBe(true);
      // The face stands on the floor line, the floor's top edge.
      expect(faceExtent[3]).toBe(insideWalls(room).y);
      for (const x of sides) {
        expect(extent(of(capV, x)), `${room.key} ${String(x)}`).toEqual([
          x,
          faceExtent[1],
          x + WALL_CAP,
          208,
        ]);
      }
      // The south cap across both side caps; the lounge's block draws more of both caps after it.
      expect(extent(of(cap).filter((r) => r.y === 208))).toEqual(southExtent);
      // Every cap tile in the ring's bounds lies on a collision band.
      const ringCaps = [
        ...sides.flatMap((x) => of(capV, x)),
        ...of(cap).filter((r) => r.y === 208),
      ];
      for (const r of ringCaps.filter((t) => t.y >= room.bounds.y)) {
        expect(hitsWall(room, r.x, r.y) && hitsWall(room, r.x + r.w - 0.1, r.y + r.h - 0.1)).toBe(
          true,
        );
      }
    }
  });

  it("draws the lounge's hallway block as paper inside the lounge's caps on its open edges, solid as a whole", () => {
    expect(HALLWAY_BLOCK).toEqual({
      sheet: SHEETS.paper,
      x: 336,
      y: 64,
      w: 96,
      h: 64,
      solid: true,
      stands: { height: BACK_WALL_FACE },
    });
    const runs = furnitureRuns(LOUNGE_ROOM);
    const of = (sheet: Sheet) => runs.filter((r) => r.sheet === sheet);
    expect(of(SHEETS.paper).map(({ x, y, w, h }) => [x, y, w, h])).toEqual([[336, 64, 96, 64]]);
    // spr_lounge_cap_v down its west edge, spr_lounge_cap along its south edge, tile by tile.
    expect(extent(of(SHEETS.loungeCapV))).toEqual([336, 64, 344, 128]);
    expect(of(SHEETS.loungeCapV)).toHaveLength(4);
    expect(extent(of(SHEETS.loungeCap))).toEqual([336, 120, 432, 128]);
    expect(of(SHEETS.loungeCap)).toHaveLength(6);
    for (const list of [of(SHEETS.loungeCapV), of(SHEETS.loungeCap)]) {
      for (let i = 1; i < list.length; i += 1) expect(list[i]?.frame).not.toBe(list[i - 1]?.frame);
    }
    // The caps are drawn, not collision; the block is collision whole.
    expect(HALLWAY_BLOCK_CAPS.every((f) => !f.solid)).toBe(true);
    for (const [x, y] of [
      [336, 64],
      [431, 127],
      [380, 100],
    ] as const) {
      expect(hitsWall(LOUNGE_ROOM, x, y)).toBe(true);
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

  it('has two windows in the lounge, one in the study and the shed, none in the hallway, the garden or the glass greenhouse', () => {
    // The lounge's both west of the hallway block (x 336), either side of the fireplace (x 224..256).
    expect(LOUNGE_ROOM.windows).toEqual([
      { x: 176, w: 32 },
      { x: 288, w: 32 },
    ]);
    // The study's between the desk (x 160..192) and the bookcase (x 256..304).
    expect(STUDY_ROOM.windows).toEqual([{ x: 208, w: 32 }]);
    // The shed's is its own Inked window on the back wall's face: 32 x 24, its top 44 px above
    // the floor line (y 64), its sill 20 px (0.94 m) above it, inside the face (y 16..64).
    expect(windowRuns(SHED_ROOM).map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual([
      ['spr_shed_window', 264, 20, 32, 24],
    ]);
    expect(ROOM_STYLES.shed.window).toEqual({ sheet: SHEETS.shedWindow, top: 44 });
    expect(wallRuns(SHED_ROOM).at(-1)).toEqual(windowRuns(SHED_ROOM)[0]);
    for (const room of [HALLWAY_ROOM, GARDEN_ROOM, FRONT_GARDEN_ROOM, GREENHOUSE_ROOM]) {
      expect(room.windows).toEqual([]);
      expect(ROOM_STYLES[room.key].window).toBeUndefined();
      expect(windowRuns(room)).toEqual([]);
    }
  });

  it("draws each house window as its room's own Inked window on the face, as the shed's, after the face, inside the side caps", () => {
    for (const [room, sheet] of [
      [LOUNGE_ROOM, SHEETS.loungeWindow],
      [STUDY_ROOM, SHEETS.studyWindow],
    ] as const) {
      expect(ROOM_STYLES[room.key].window).toEqual({ sheet, top: 44 });
      const runs = windowRuns(room);
      // Each 32 x 24 on the face (y 16..64), its sill 20 px above the floor line, y 64.
      expect(runs.map(({ sheet: s, x, y, w, h }) => [s.key, x, y, w, h])).toEqual(
        room.windows.map(({ x, w }) => [sheet.key, x, 20, w, 24]),
      );
      const all = wallRuns(room);
      const lastFace = all
        .map((r) => r.sheet)
        .lastIndexOf(ROOM_STYLES[room.key].face?.sheet ?? sheet);
      for (const r of runs) {
        expect(all.findIndex((w) => w.sheet === sheet && w.x === r.x)).toBeGreaterThan(lastFace);
        expect(r.x).toBeGreaterThanOrEqual(room.bounds.x + TILE);
        expect(r.x + r.w).toBeLessThanOrEqual(room.bounds.x + room.bounds.w - TILE);
      }
    }
  });

  it("bakes each room's furniture after its walls, each sheet over its rect, what lies flat under the cast shadows and the rest over them", () => {
    const furniture = (room: Room) =>
      furnitureRuns(room).map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h]);
    // The lounge's baked pieces: the kitchen's tiles (6 x 5), the hallway block's paper and its
    // caps (4 down its west edge, 6 along its south edge); its furniture is sorted.
    const lounge = furniture(LOUNGE_ROOM);
    expect(lounge).toHaveLength(30 + 1 + 4 + 6);
    expect(extent(furnitureRuns(LOUNGE_ROOM).slice(0, 30))).toEqual([336, 128, 432, 208]);
    expect(lounge.slice(0, 30).every(([key]) => key === 'spr_floor_kitchen')).toBe(true);
    expect(lounge[30]).toEqual(['spr_paper', 336, 64, 96, 64]);
    // The study's desk and bookcase are sorted; the hallway's runner lies flat in the bake.
    expect(furniture(STUDY_ROOM)).toEqual([]);
    expect(furniture(HALLWAY_ROOM)).toEqual([['spr_runner', 200, 184, 60, 24]]);
    // Flat: the kitchen's tiles, the hallway's runner, the front garden's road, drive, path and beds.
    expect(furnitureRuns(LOUNGE_ROOM, 'flat').every((r) => r.sheet === SHEETS.floorKitchen)).toBe(
      true,
    );
    expect(furnitureRuns(HALLWAY_ROOM, 'flat').map((r) => r.sheet.key)).toEqual(['spr_runner']);
    expect(new Set(furnitureRuns(FRONT_GARDEN_ROOM, 'flat').map((r) => r.sheet.key))).toEqual(
      new Set(['spr_road', 'spr_drive', 'spr_path', 'spr_bed']),
    );
    for (const room of Object.values(ROOMS)) {
      const runs = furnitureRuns(room);
      // The flat pieces come first in each room's furniture, so baking them first keeps its order.
      expect([...furnitureRuns(room, 'flat'), ...furnitureRuns(room, 'standing')]).toEqual(runs);
      for (const r of runs) {
        // A one-frame piece is its sheet's logical size; a run is whole tiles of it, a row
        // indoors, rows and columns outdoors. The lounge's hallway block is the paper over it,
        // its grain cropped to the block.
        const outdoor = room === GARDEN_ROOM || room === FRONT_GARDEN_ROOM;
        const px = sheetPxPerLogical(r.sheet);
        if (r.sheet === SHEETS.paper) {
          expect([r.x, r.y, r.w, r.h]).toEqual([336, 64, 96, 64]);
          continue;
        }
        expect((r.w * px) % r.sheet.frameWidth, `${room.key} ${r.sheet.key}`).toBe(0);
        if (outdoor) expect((r.h * px) % r.sheet.frameHeight).toBe(0);
        else expect(r.h * px).toBe(r.sheet.frameHeight);
        // Indoors, on the floor clear of the walls' bands; in the garden, over a building's solid
        // footprint; in the front garden, anywhere on its canvas (the road and roofs outside bounds).
        const f = insideWalls(room);
        const onFloor =
          r.x >= f.x && r.x + r.w <= f.x + f.w && r.y >= f.y && r.y + r.h <= f.y + f.h;
        const onSolid = room.walls.some(
          (w) => r.x >= w.x && r.x + r.w <= w.x + w.w && r.y >= w.y && r.y + r.h <= w.y + w.h,
        );
        const onCanvas =
          r.x >= 0 && r.y >= 0 && r.x + r.w <= room.width && r.y + r.h <= room.height;
        const placed =
          room === GARDEN_ROOM ? onSolid : room === FRONT_GARDEN_ROOM ? onCanvas : onFloor;
        expect(placed, `${room.key} ${r.sheet.key}`).toBe(true);
      }
    }
    // The shed's floor clutter is sorted against the player (furnitureSprites); only the shelf is baked.
    expect(furniture(SHED_ROOM)).toEqual([['spr_shelf', 208, 67, 24, 20]]);
    // The garden's eleven pieces, cut into their tiles but the one-frame kitchen window.
    expect(GARDEN_ROOM.furniture).toHaveLength(11);
    expect(furniture(GARDEN_ROOM)).toHaveLength(234 + 16 + 9 + 1 + 70 + 10 + 70 + 10 + 8 + 10);
  });

  it("stands each Inked door in the garden's buildings in its face on the footprint's edge", () => {
    const runs = furnitureRuns(GARDEN_ROOM);
    for (const [key, sheet, door] of [
      ['door', SHEETS.shedFace, SHEETS.shedDoor],
      ['door_study', SHEETS.houseFace, SHEETS.doorGlazed],
      ['door_greenhouse', SHEETS.greenhouseFace, SHEETS.doorGlazed],
    ] as const) {
      const p = propByKey(GARDEN_ROOM.props, key);
      const d = propSprite(p);
      if (!d) throw new Error(key);
      // The 24 x 40 leaf stands bottom-centre on the rect's bottom edge, the face's foot, inside
      // the face; it sorts at the rect's top edge.
      const [w, h] = [d.sheet.frameWidth * d.scale, d.sheet.frameHeight * d.scale];
      expect([d.sheet, d.originY, w, h, d.y, d.depth], key).toEqual([
        door,
        1,
        24,
        40,
        p.y + 8,
        p.y - 8,
      ]);
      const [x0, y0, x1, y1] = extent(runs.filter((r) => r.sheet === sheet));
      expect(d.x - w / 2 >= (x0 ?? 0) && d.x + w / 2 <= (x1 ?? 0), key).toBe(true);
      expect(d.y - h >= (y0 ?? 0) && d.y === y1, key).toBe(true);
    }
  });
});

describe('props', () => {
  it("stands the shed's Inked props bottom-centre on their footprints' bottom edges at 0.25", () => {
    const at = (key: string) => {
      const s = propSprite(propByKey(SHED_ROOM.props, key));
      return s && [s.sheet.key, s.frame, s.x, s.y, s.originY, s.scale];
    };
    // The workbench's 40 x 20 footprint centred on (125, 90): its bottom edge y 100.
    expect(at('workbench')).toEqual(['spr_workbench', 0, 125, 100, 1, 0.25]);
    expect(at('planting_table')).toEqual(['spr_planting_table', 0, 165, 100, 1, 0.25]);
    expect(at('shop_kiosk')).toEqual(['spr_shop_kiosk', 0, 125, 157, 1, 0.25]);
    expect(at('door')).toEqual(['spr_shed_door_s', 0, 240, 224, 1, 0.25]);
    expect(at('door_lounge')).toEqual(['spr_shed_door', 0, 240, 64, 1, 0.25]);
    // Drawn at the scale rule's sizes: the workbench 48 x 40, the planting table 32 x 40, the kiosk
    // 24 x 56, the lounge door 24 x 40 front-on, the garden door's opening 24 x 16.
    const size = (key: string) => {
      const s = propSprite(propByKey(SHED_ROOM.props, key));
      return s && [s.sheet.frameWidth * s.scale, s.sheet.frameHeight * s.scale];
    };
    expect(['workbench', 'planting_table', 'shop_kiosk', 'door_lounge', 'door'].map(size)).toEqual([
      [48, 40],
      [32, 40],
      [24, 56],
      [24, 40],
      [24, 16],
    ]);
  });

  it("centres a pixel prop's sprite on its rect at 0.5, as the prototype drew it", () => {
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.art, s.x, s.y, s.originY, s.scale];
    };
    expect(at(LOUNGE_ROOM.props, 'door')).toEqual(['pixel', 240, 216, 0.5, 0.5]);
    expect(at(HALLWAY_ROOM.props, 'door_front')).toEqual(['pixel', 240, 136, 0.5, 0.5]);
  });

  it('sorts a prop at its bottom edge and a door, in its wall, at its top edge', () => {
    const depth = (props: readonly Prop[], key: string) => propSprite(propByKey(props, key))?.depth;
    expect(depth(SHED_ROOM.props, 'workbench')).toBe(100);
    expect(depth(SHED_ROOM.props, 'door')).toBe(208);
    expect(depth(GARDEN_ROOM.props, 'door')).toBe(240);
  });

  it("draws the shed door in the bottom wall: inst_52E224DC's 32 px square at top-left (464, 416), its opening over the band", () => {
    const p = propByKey(SHED_ROOM.props, 'door');
    expect([p.x - 8, p.y - 8, p.w, p.h]).toEqual([232, 208, 16, 16]);
    const door = propSprite(p);
    // The 24 x 16 opening stands on the band's bottom edge, so it covers the band (y 208..224),
    // the south cap's 8 px (y 208..216) its top half, centred on the door.
    const band = SHED_ROOM.walls[1];
    expect(door && [door.x - 12, door.y - 16, door.y]).toEqual(
      band && [228, band.y, band.y + band.h],
    );
  });

  it("draws the shed's lounge door front-on in the back wall's face, its bottom on the floor line", () => {
    const door = propSprite(propByKey(SHED_ROOM.props, 'door_lounge'));
    const face = wallRuns(SHED_ROOM).filter((r) => r.sheet === SHEETS.shedWall);
    // x 228..252, y 24..64: inside the face (y 16..64), clear of the window (x 264..296).
    expect(door && [door.x - 12, door.y - 40, door.x + 12, door.y]).toEqual([228, 24, 252, 64]);
    expect(face.some((r) => r.y <= 24 && r.y + r.h === 64 && r.x <= 228)).toBe(true);
  });

  it("stands each Inked source plant's species frame on its rect's bottom edge, the shed's door in its south face and the side gate in the fence", () => {
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.key, s.frame, s.x, s.y, s.originY, s.scale, s.depth];
    };
    // The plants' 24 px squares centred on the bed's row y 472: each 24 x 32 frame stands on y 484.
    expect(
      ['source_juniper', 'source_maple', 'source_pine'].map((k) => at(GARDEN_ROOM.props, k)),
    ).toEqual([
      ['spr_source_plant', 0, 80, 484, 1, 0.25, 484],
      ['spr_source_plant', 1, 112, 484, 1, 0.25, 484],
      ['spr_source_plant', 2, 144, 484, 1, 0.25, 484],
    ]);
    expect([SHEETS.sourcePlant.frameWidth / 4, SHEETS.sourcePlant.frameHeight / 4]).toEqual([
      24, 32,
    ]);
    // The shed's plank door front-on in its south face (x 68..92, y 216..256), sorted at its rect's top.
    expect(at(GARDEN_ROOM.props, 'door')).toEqual(['spr_shed_door', 0, 80, 256, 1, 0.25, 240]);
    // The gate is a door in a wall drawn as a board gate as tall as the fence, filling the north
    // fence's band (y 0..16) over the passage, sorted at its top.
    expect(at(GARDEN_ROOM.props, 'gate')).toEqual(['spr_gate', 0, 432, 16, 1, 0.25, 0]);
    expect([SHEETS.gate.frameWidth / 4, SHEETS.gate.frameHeight / 4]).toEqual([16, 16]);
    // Its other side, in the front garden's south band (y 208..224), is the same gate.
    expect(at(FRONT_GARDEN_ROOM.props, 'gate')).toEqual(['spr_gate', 0, 544, 224, 1, 0.25, 208]);
  });

  it("stands the front garden's front door in the house's face on its foot, sorted at its drawn top so the player at it draws in front", () => {
    const p = propByKey(FRONT_GARDEN_ROOM.props, 'door_house');
    const s = propSprite(p);
    // The 24 x 40 leaf, x 324..348, y 184..224: inside the face (y 176..224), on its foot.
    expect(s && [s.sheet.key, s.x - 12, s.y - 40, s.x + 12, s.y, s.scale]).toEqual([
      'spr_front_door',
      324,
      184,
      348,
      224,
      0.25,
    ]);
    const face = furnitureRuns(FRONT_GARDEN_ROOM).filter((r) => r.sheet === SHEETS.houseFace);
    expect(face.some((r) => r.y === 176 && r.y + r.h === 224 && r.x <= 324)).toBe(true);
    // Sorted at its top, y 184, not its rect's (208): the player at its landing, (336, 190), has
    // its feet at y 202, in front of it, and is never behind it, being always north of the wall.
    expect(s?.depth).toBe(184);
    expect(190 + PLAYER_FEET).toBeGreaterThan(s?.depth ?? Infinity);
    // A south wall's door no taller than its band keeps its rect's top.
    expect(propSprite(propByKey(SHED_ROOM.props, 'door'))?.depth).toBe(208);
    expect(propSprite(propByKey(LOUNGE_ROOM.props, 'door'))?.depth).toBe(208);
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

  it("draws the lounge's door on the bottom wall, the shed's lounge door on the top, each sorted at its top edge", () => {
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.key, s.x, s.y, s.scale, s.depth];
    };
    expect(at(LOUNGE_ROOM.props, 'door')).toEqual(['spr_door', 240, 216, 0.5, 208]);
    expect(at(SHED_ROOM.props, 'door_lounge')).toEqual([
      'spr_shed_door',
      240,
      64,
      0.25,
      SHED_ROOM.bounds.y,
    ]);
  });

  it('draws the doors in the side walls side-on on the cap, the E walls mirroring the W, sorted at their top edge', () => {
    expect([SHEETS.doorSideW, SHEETS.doorSideE]).toEqual([
      { key: 'spr_door_side_w', frameWidth: 32, frameHeight: 160, frames: 1, art: 'inked' },
      { key: 'spr_door_side_e', frameWidth: 32, frameHeight: 160, frames: 1, art: 'inked' },
    ]);
    const at = (room: Room, key: string) => {
      const p = propByKey(room.props, key);
      const s = propSprite(p);
      if (!s) throw new Error(key);
      // An 8 x 40 frame, the cap's width, standing on the door's rect's bottom edge.
      expect([s.sheet.frameWidth * s.scale, s.sheet.frameHeight * s.scale]).toEqual([WALL_CAP, 40]);
      expect([s.originY, s.y]).toEqual([1, p.y + p.h / 2]);
      // Its frame lies exactly over the side cap baked beside the door's rect.
      const left = s.x - WALL_CAP / 2;
      const cap = [...wallRuns(room), ...furnitureRuns(room)].find(
        (r) =>
          r.sheet.key.endsWith('_cap_v') &&
          r.x === left &&
          r.w === WALL_CAP &&
          r.y <= p.y &&
          r.y + r.h >= p.y,
      );
      expect(cap, key).toBeDefined();
      return [p.wall, s.sheet.key, s.x, s.y, s.scale, s.depth];
    };
    // The lounge's in the hallway block's west face, on the block's cap at x 336..344.
    expect(at(LOUNGE_ROOM, 'door_hallway')).toEqual(['E', 'spr_door_side_e', 340, 104, 0.25, 88]);
    // The hallway's on its side caps at x 184..192 and 288..296, the study's at x 152..160.
    expect(at(HALLWAY_ROOM, 'door_lounge')).toEqual(['W', 'spr_door_side_w', 188, 184, 0.25, 168]);
    expect(at(HALLWAY_ROOM, 'door_study')).toEqual(['E', 'spr_door_side_e', 292, 184, 0.25, 168]);
    expect(at(STUDY_ROOM, 'door_hallway')).toEqual(['W', 'spr_door_side_w', 156, 104, 0.25, 88]);
  });

  it("stands the study's glazed double door across its 48x16 opening and the glazed leaves on their rects' bottom edges, a south wall's sorted at its drawn top", () => {
    expect(SHEETS.doorGlass).toEqual({
      key: 'spr_door_glass',
      frameWidth: 192,
      frameHeight: 160,
      frames: 1,
      art: 'inked',
    });
    expect(SHEETS.doorGlazed).toEqual({
      key: 'spr_door_glazed',
      frameWidth: 96,
      frameHeight: 160,
      frames: 1,
      art: 'inked',
    });
    const at = (props: readonly Prop[], key: string) => {
      const s = propSprite(propByKey(props, key));
      return s && [s.sheet.key, s.x, s.y, s.originY, s.scale, s.depth];
    };
    // The study's doors: two leaves, 48 x 40, as wide as the 1.5 m opening, x 208..256, standing
    // on the south band's bottom edge (y 224) and sorted at their drawn top, y 184, so the player
    // landing north of them draws in front.
    const glass = propByKey(STUDY_ROOM.props, 'door_garden');
    expect([glass.w, glass.h]).toEqual([48, 16]);
    expect(SHEETS.doorGlass.frameWidth / 4).toBe(glass.w);
    expect(at(STUDY_ROOM.props, 'door_garden')).toEqual(['spr_door_glass', 232, 224, 1, 0.25, 184]);
    // The garden's sides of both and the greenhouse's back are one Inked glazed leaf, 24 x 40.
    expect(at(GARDEN_ROOM.props, 'door_study')).toEqual([
      'spr_door_glazed',
      344,
      144,
      1,
      0.25,
      128,
    ]);
    expect(at(GARDEN_ROOM.props, 'door_greenhouse')).toEqual([
      'spr_door_glazed',
      336,
      416,
      1,
      0.25,
      400,
    ]);
    expect(at(GREENHOUSE_ROOM.props, 'door_garden')).toEqual([
      'spr_door_glazed',
      240,
      208,
      1,
      0.25,
      168,
    ]);
    expect(GREENHOUSE_ROOM.playerStart.y + PLAYER_FEET).toBeGreaterThan(168);
    // Every other door keeps the prototype's spr_door.
    const doors = Object.values(ROOMS).flatMap((r) =>
      r.props.filter((p) => p.target).map((p) => `${r.key}.${p.key}`),
    );
    const ownSheet = Object.values(ROOMS).flatMap((r) =>
      r.props
        .filter((p) => p.target && propSprite(p)?.sheet !== SHEETS.door)
        .map((p) => `${r.key}.${p.key}`),
    );
    expect(doors).toHaveLength(16);
    // Besides the glazed doors: the shed's two Inked doors and the garden's side of its garden
    // door, the front garden's front door (spr_front_door), the side gate's two sides, board gates
    // (spr_gate), and the house's four side-on doors between rooms.
    expect(ownSheet).toEqual([
      'shed.door',
      'shed.door_lounge',
      'garden.door',
      'garden.door_study',
      'garden.door_greenhouse',
      'garden.gate',
      'frontGarden.door_house',
      'frontGarden.gate',
      'lounge.door_hallway',
      'hallway.door_lounge',
      'hallway.door_study',
      'study.door_hallway',
      'study.door_garden',
      'greenhouse.door_garden',
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
      x: 80,
      y: 472 + 10,
      w: 18,
      h: 2,
      alpha: 0.25,
    });
    expect(propShadow(propByKey(SHED_ROOM.props, 'workbench'))).toBeUndefined();
    expect(playerShadow(240, 135)).toEqual({ x: 240, y: 147, w: 16, h: 4.5, alpha: 0.25 });
    expect(treeShadow(100, 100, 1)).toEqual({ x: 100, y: 118.5, w: 32, h: 5, alpha: 0.25 });
  });

  it("draws the shed's floor clutter as sprites sorted at their bottom edge, the player behind above it and in front below", () => {
    // Inked: each stands bottom-centre on its prototype foot point at 0.25.
    expect(
      furnitureSprites(SHED_ROOM).map((s) => [
        s.sheet.key,
        s.frame,
        s.x,
        s.y,
        s.originY,
        s.scale,
        s.depth,
      ]),
    ).toEqual([
      ['spr_tools', 0, 106, 176, 1, 0.25, 176],
      ['spr_watering_can', 0, 353, 128, 1, 0.25, 128],
      ['spr_pot_stack', 0, 353, 194, 1, 0.25, 194],
      ['spr_sack', 0, 150, 192, 1, 0.25, 192],
    ]);
    // The garden sorts no furniture; its runs are all of it.
    expect(furnitureSprites(GARDEN_ROOM)).toEqual([]);
    // drawPlayer: the player's depth is at its feet, y + PLAYER_FEET.
    const playerDepth = (y: number) => y + PLAYER_FEET;
    expect(playerDepth(0)).toBe(12);
    const sack = furnitureSprites(SHED_ROOM).find((s) => s.sheet === SHEETS.sack);
    expect(sack && playerDepth(175) < sack.depth).toBe(true);
    expect(sack && playerDepth(185) > sack.depth).toBe(true);
  });

  it("stands the house rooms' furniture on its footprints' bottom edges, sorted there, each display spot's tree on its piece's top face", () => {
    const sprites = (room: Room) =>
      furnitureSprites(room).map((s) => [s.sheet.key, s.x, s.y, s.originY, s.scale, s.depth]);
    expect(sprites(LOUNGE_ROOM)).toEqual([
      ['spr_fireplace', 240, 88, 1, 0.25, 88],
      ['spr_side_table', 168, 80, 1, 0.25, 80],
      ['spr_counter', 384, 208, 1, 0.25, 208],
      ['spr_counter_v', 422, 188, 1, 0.25, 188],
    ]);
    expect(sprites(HALLWAY_ROOM)).toEqual([['spr_hall_table', 274, 208, 1, 0.25, 208]]);
    expect(sprites(STUDY_ROOM)).toEqual([
      ['spr_desk', 176, 80, 1, 0.25, 80],
      ['spr_bookshelf', 280, 80, 1, 0.25, 80],
    ]);
    // A piece's sprite is its front face over its footprint's depth, so its top face runs from the
    // sprite's top for the footprint's depth; each spot's top edge, where its tree stands, lies on it.
    for (const room of [LOUNGE_ROOM, STUDY_ROOM]) {
      for (const p of room.props.filter((q) => q.pedestalKey !== undefined)) {
        const piece = room.furniture.find(
          (f) => f.sorted && p.x >= f.x && p.x <= f.x + f.w && p.y + p.h / 2 === f.y + f.h,
        );
        if (!piece) throw new Error(p.key);
        const top = piece.y + piece.h - piece.sheet.frameHeight / sheetPxPerLogical(piece.sheet);
        const spot = p.y - p.h / 2;
        expect(spot, `${room.key} ${p.key}`).toBeGreaterThan(top);
        expect(spot, `${room.key} ${p.key}`).toBeLessThan(top + piece.h);
      }
    }
  });
});

/** A polygon's points rounded to 1e-6 and sorted, so two polygons compare whatever point they start from. */
const points = (polygon: readonly { x: number; y: number }[]): number[][] =>
  polygon
    .map(({ x, y }) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])
    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0));

/** True if every point of the polygon lies in the rect. */
const within = (polygon: readonly { x: number; y: number }[], r: Rect): boolean =>
  polygon.every(
    (p) =>
      p.x >= r.x - 1e-9 && p.x <= r.x + r.w + 1e-9 && p.y >= r.y - 1e-9 && p.y <= r.y + r.h + 1e-9,
  );

describe('cast shadows', () => {
  it('washes every cast shadow in the shadow wash at the style’s shadowAlpha', () => {
    expect(CAST_SHADOW_WASH).toEqual({ colour: PALETTE.shadow, alpha: 0.45 });
    expect(PALETTE.shadow).toBe(0x6e5e50);
  });

  it("sweeps the workbench's footprint down and right, as far as half its 20 px height", () => {
    // The 48 x 40 workbench stands 20 px on its 48 x 20 footprint (101..149, 80..100); its top
    // falls 8 px right and 6 down, so its shadow is the hexagon round both.
    const workbench = propCaster(propByKey(SHED_ROOM.props, 'workbench'));
    expect(workbench).toEqual({ footprint: { x: 101, y: 80, w: 48, h: 20 }, height: 20 });
    if (!workbench) throw new Error('workbench');
    const [shadow, ...rest] = castShadow(SHED_ROOM, workbench);
    expect(rest).toEqual([]);
    expect(points(shadow ?? [])).toEqual([
      [101, 80],
      [101, 100],
      [109, 106],
      [149, 80],
      [157, 86],
      [157, 106],
    ]);
    // The planting table and the kiosk cast too; a door, a source plant and a display spot do not.
    expect(propCaster(propByKey(SHED_ROOM.props, 'shop_kiosk'))?.height).toBe(32);
    expect(propCaster(propByKey(SHED_ROOM.props, 'door'))).toBeUndefined();
    expect(propCaster(propByKey(GARDEN_ROOM.props, 'source_juniper'))).toBeUndefined();
    for (const p of LOUNGE_ROOM.props.filter((q) => q.pedestalKey !== undefined)) {
      expect(propCaster(p)).toBeUndefined();
    }
  });

  it('clips a shadow to the floor: a piece against the back wall loses what lies above the floor line, one against the west wall what lies past its edge', () => {
    // The shed's floor is x 96..384, y 64..208.
    expect(insideWalls(SHED_ROOM)).toEqual({ x: 96, y: 64, w: 288, h: 144 });
    const north = castShadow(SHED_ROOM, { footprint: { x: 200, y: 56, w: 20, h: 16 }, height: 20 });
    expect(north.map(points)).toEqual([
      [
        [200, 64],
        [200, 72],
        [208, 78],
        [228, 64],
        [228, 78],
      ],
    ]);
    const west = castShadow(SHED_ROOM, { footprint: { x: 90, y: 100, w: 20, h: 10 }, height: 20 });
    expect(west.map(points)).toEqual([
      [
        [96, 100],
        [96, 114.5],
        [98, 116],
        [110, 100],
        [118, 106],
        [118, 116],
      ],
    ]);
    // Wholly off the floor, or no height: no shadow.
    expect(castShadow(SHED_ROOM, { footprint: { x: 0, y: 0, w: 10, h: 10 }, height: 20 })).toEqual(
      [],
    );
    expect(
      castShadow(SHED_ROOM, { footprint: { x: 200, y: 100, w: 10, h: 10 }, height: 0 }),
    ).toEqual([]);
  });

  it("casts the back wall's band 14.4 px deep and the west wall's 19.2 px wide, and nothing from the walls whose shadows fall outside", () => {
    const [north, west, ...rest] = castShadows(SHED_ROOM);
    // The 48 px back wall's band across the floor's top, its west end slanting with the light.
    expect(points(north ?? [])).toEqual([
      [96, 64],
      [96, 76],
      [99.2, 78.4],
      [384, 64],
      [384, 78.4],
    ]);
    expect(points(west ?? [])).toEqual([
      [96, 64],
      [96, 208],
      [115.2, 64],
      [115.2, 208],
    ]);
    // Then the props (workbench, planting table, kiosk) and the decor, the shelf first: the south
    // and east walls cast nothing on the floor.
    expect(rest).toHaveLength(3 + 5);
    expect(ROOM_STYLES.shed.wallHeight).toEqual({ row: 48, column: 48 });
    expect(ROOM_STYLES.garden.wallHeight).toEqual({ row: 16, column: 16 });
    expect(ROOM_STYLES.frontGarden.wallHeight).toEqual({ row: 11, column: 16 });
  });

  it('casts from every wall and standing piece of every room a shadow lying on its floor, the north and west walls always', () => {
    const flats: Sheet[] = [
      SHEETS.floorKitchen,
      SHEETS.runner,
      SHEETS.road,
      SHEETS.drive,
      SHEETS.path,
      SHEETS.bed,
    ];
    for (const room of Object.values(ROOMS)) {
      const floor = insideWalls(room);
      const shadows = castShadows(room);
      for (const s of shadows) {
        expect(s.length, room.key).toBeGreaterThanOrEqual(3);
        expect(within(s, floor), room.key).toBe(true);
      }
      // The north and west walls' bands come first, along the floor's top and left edges.
      const [north, west] = shadows;
      expect(Math.min(...(north ?? []).map((p) => p.y)), room.key).toBe(floor.y);
      expect(Math.min(...(west ?? []).map((p) => p.x)), room.key).toBe(floor.x);
      // Every piece of furniture stands and casts, lies flat, or is drawn on one that casts (a
      // wall's cap, a window, a face): none both.
      for (const f of room.furniture) {
        expect(f.flat && f.stands, `${room.key} ${f.sheet.key}`).toBeFalsy();
        if (f.flat) expect(flats).toContain(f.sheet);
      }
      // Indoors every standing piece's shadow shows.
      if (isIndoor(room)) {
        for (const f of room.furniture.filter((g) => g.stands)) {
          expect(pieceShadows(room, [f]), `${room.key} ${f.sheet.key}`).toHaveLength(1);
        }
      }
    }
    // The garden's buildings cast from their roofs, which stand for their footprints.
    expect(
      GARDEN_ROOM.furniture.filter((f) => f.stands).map((f) => [f.sheet.key, f.stands?.height]),
    ).toEqual([
      ['spr_house_roof', 48],
      ['spr_shed_roof', 48],
      ['spr_greenhouse_roof', 48],
    ]);
    expect(pieceShadows(GARDEN_ROOM, GARDEN_ROOM.furniture)).toHaveLength(3);
  });

  it("stands a piece on its rect's bottom foot, the whole rect unless given", () => {
    const shelf = SHED_ROOM.furniture[0];
    if (!shelf) throw new Error('shelf');
    expect(furnitureCaster(shelf)).toEqual({
      footprint: { x: 208, y: 79, w: 24, h: 8 },
      height: 12,
    });
    expect(furnitureCaster(HALLWAY_BLOCK)).toEqual({
      footprint: { x: 336, y: 64, w: 96, h: 64 },
      height: 48,
    });
    expect(furnitureCaster(HALLWAY_BLOCK_CAPS[0] ?? HALLWAY_BLOCK)).toBeUndefined();
    // A placed pedestal stands 12 px on its 16 px footprint, drawn live: one shadow on the floor.
    const pedestal = {
      sheet: SHEETS.pedestal,
      x: 200,
      y: 120,
      w: 16,
      h: 16,
      solid: false,
      sorted: true,
      stands: { height: 12 },
    };
    expect(pieceShadows(GREENHOUSE_ROOM, [pedestal])).toHaveLength(1);
  });
});

/** True if the point lies strictly inside the convex polygon, whichever way round it runs. */
const contains = (polygon: readonly { x: number; y: number }[], x: number, y: number): boolean => {
  const sides = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length] ?? a;
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
  });
  return sides.every((s) => s > 1e-9) || sides.every((s) => s < -1e-9);
};

describe('washing the shadows once', () => {
  it("cuts every room's shadows into pieces that cover each shadowed point once, and the placed pieces' less the room's", () => {
    for (const room of Object.values(ROOMS)) {
      const shadows = castShadows(room);
      const pieces = washPieces(shadows);
      const floor = insideWalls(room);
      // Sample the floor on a grid off the px lattice, so no sample sits on an edge.
      for (let y = floor.y + 0.37; y < floor.y + floor.h; y += 3.1) {
        for (let x = floor.x + 0.23; x < floor.x + floor.w; x += 3.1) {
          const covering = pieces.filter((p) => contains(p, x, y)).length;
          const shadowed = shadows.some((p) => contains(p, x, y));
          expect(covering, `${room.key} ${String(x)} ${String(y)}`).toBe(shadowed ? 1 : 0);
        }
      }
    }
    // A pedestal placed against the greenhouse's back wall washes only what the wall leaves.
    // Its floor starts at y 80, the back wall's band 14.4 deep below it; the pedestal's shadow
    // reaches 3.6 px below its 16 px footprint and 4.8 right of it.
    const pedestal = {
      sheet: SHEETS.pedestal,
      ...{ x: 200, y: 80, w: 16, h: 16 },
      solid: false,
      stands: { height: 12 },
    };
    expect(insideWalls(GREENHOUSE_ROOM).y).toBe(80);
    const wall = castShadows(GREENHOUSE_ROOM);
    const live = washPieces(pieceShadows(GREENHOUSE_ROOM, [pedestal]), wall);
    for (const [x, y] of [
      [205.3, 85.1],
      [214.9, 93.7],
    ] as const) {
      expect(wall.some((p) => contains(p, x, y))).toBe(true);
      expect(live.some((p) => contains(p, x, y))).toBe(false);
    }
    expect(live.some((p) => contains(p, 218.1, 98.3))).toBe(true);
  });

  it('subtracts one convex polygon from another, and gives nothing for one wholly inside', () => {
    const square = (x: number, y: number, s: number) => [
      { x, y },
      { x: x + s, y },
      { x: x + s, y: y + s },
      { x, y: y + s },
    ];
    const rest = subtractConvex(square(0, 0, 4), square(2, 2, 4));
    const total = rest.reduce((sum, p) => {
      const twice = p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length] ?? a;
        return s + a.x * b.y - b.x * a.y;
      }, 0);
      return sum + Math.abs(twice) / 2;
    }, 0);
    expect(total).toBeCloseTo(16 - 4, 12);
    expect(subtractConvex(square(1, 1, 1), square(0, 0, 4))).toEqual([]);
    expect(subtractConvex(square(0, 0, 1), square(5, 5, 1)).map(points)).toEqual([
      points(square(0, 0, 1)),
    ]);
  });
});

describe('the shadow helpers', () => {
  it('hulls points without the inside or collinear ones', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(points(hull)).toEqual([
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ]);
  });

  it('clips a polygon to a rect, and to nothing when it lies outside', () => {
    const square = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];
    expect(points(clipToRect(square, { x: 0, y: 0, w: 4, h: 4 }))).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    expect(clipToRect(square, { x: 5, y: 5, w: 1, h: 1 })).toEqual([]);
  });
});

describe('season wash', () => {
  it('washes the garden per season in Inked palette entries, summer left as it is', () => {
    expect(SEASONS.map((season) => seasonWash(GARDEN_ROOM, season))).toEqual([
      { colour: 0xc8e296, alpha: 0.15 },
      undefined,
      { colour: 0xc88c50, alpha: 0.35 },
      { colour: 0xecf0f4, alpha: 0.45 },
    ]);
    expect(SEASONS.map((season) => seasonWash(GARDEN_ROOM, season)?.colour)).toEqual([
      PALETTE.lawnSpring,
      undefined,
      PALETTE.lawnAutumn,
      PALETTE.frost,
    ]);
  });

  it('never washes an indoor room', () => {
    for (const room of Object.values(ROOMS).filter((r) => isIndoor(r))) {
      for (const season of SEASONS) expect(seasonWash(room, season)).toBeUndefined();
    }
  });

  it('washes the front garden as the back garden, season for season', () => {
    for (const season of SEASONS) {
      expect(seasonWash(FRONT_GARDEN_ROOM, season)).toBe(seasonWash(GARDEN_ROOM, season));
    }
  });

  it('is the same wash through a season, so only a season turn rebakes the garden', () => {
    expect(seasonWash(GARDEN_ROOM, 'winter')).toBe(seasonWash(GARDEN_ROOM, 'winter'));
  });
});
