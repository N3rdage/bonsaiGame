import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_SHEETS,
  INKED_PER_LOGICAL,
  PLAYER_FEET,
  PLAYER_SCALE,
  SHEETS,
  SPRITE_SCALE,
  floorFrame,
  playerFrame,
  sheetFilter,
  sheetPxPerLogical,
  sheetUrl,
  sourcePlantFrame,
} from './assets';

/** Width and height from a PNG's IHDR chunk. */
function pngSize(key: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(`../../public/assets/${key}.png`, import.meta.url));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('sprite sheets', () => {
  it('lists the prototype sprites the rooms draw, with their frame sizes and counts', () => {
    expect(ALL_SHEETS.map((s) => [s.key, s.frameWidth, s.frameHeight, s.frames])).toEqual([
      ['spr_player', 64, 128, 16],
      ['spr_floor_shed', 64, 64, 3],
      ['spr_floor_garden', 64, 64, 3],
      ['spr_fence', 64, 64, 3],
      ['spr_fence_v', 64, 64, 3],
      ['spr_fence_corner', 64, 64, 4],
      ['spr_gate', 64, 64, 1],
      ['spr_source_plant', 96, 128, 3],
      ['spr_shed_face', 64, 192, 3],
      ['spr_shed_roof', 64, 64, 3],
      ['spr_house_face', 64, 192, 3],
      ['spr_house_roof', 64, 64, 3],
      ['spr_house_cap_v', 32, 64, 3],
      ['spr_house_window', 160, 96, 1],
      ['spr_greenhouse_roof', 64, 64, 3],
      ['spr_greenhouse_face', 64, 192, 3],
      ['spr_greenhouse_cap', 64, 32, 3],
      ['spr_greenhouse_cap_v', 32, 64, 3],
      ['spr_door_glazed', 96, 160, 1],
      ['spr_door', 32, 32, 1],
      ['spr_shed_wall', 64, 192, 3],
      ['spr_shed_cap', 64, 32, 3],
      ['spr_shed_cap_v', 32, 64, 3],
      ['spr_shed_window', 128, 96, 1],
      ['spr_shed_door', 96, 160, 1],
      ['spr_shed_door_s', 96, 64, 1],
      ['spr_workbench', 192, 160, 1],
      ['spr_planting_table', 128, 160, 1],
      ['spr_shop_kiosk', 96, 224, 1],
      ['spr_shed_rug', 480, 280, 1],
      ['spr_floor_lounge', 32, 32, 3],
      ['spr_wall_lounge', 32, 32, 1],
      ['spr_floor_hallway', 32, 32, 3],
      ['spr_wall_hallway', 32, 32, 1],
      ['spr_floor_study', 32, 32, 3],
      ['spr_wall_study', 32, 32, 1],
      ['spr_floor_greenhouse', 32, 32, 3],
      ['spr_wall_glass', 32, 32, 1],
      ['spr_window', 32, 32, 1],
      ['spr_door_glass', 64, 32, 1],
      ['spr_door_glass_single', 32, 32, 1],
      ['spr_door_side_w', 32, 32, 1],
      ['spr_door_side_e', 32, 32, 1],
      ['spr_fireplace', 64, 48, 1],
      ['spr_side_table', 32, 32, 1],
      ['spr_desk', 64, 32, 1],
      ['spr_bookshelf', 32, 32, 1],
      ['spr_runner', 416, 48, 1],
      ['spr_hall_table', 32, 24, 1],
      ['spr_shelf', 96, 80, 1],
      ['spr_tools', 48, 128, 1],
      ['spr_watering_can', 64, 48, 1],
      ['spr_pot_stack', 48, 80, 1],
      ['spr_sack', 64, 80, 1],
      ['spr_roof', 32, 32, 1],
      ['spr_road', 64, 192, 1],
      ['spr_fence_low', 32, 32, 1],
      ['spr_drive', 32, 32, 1],
      ['spr_bed', 32, 32, 1],
      ['spr_roller_door', 154, 32, 1],
      ['spr_pedestal', 32, 32, 1],
      ['spr_floor_shelf', 64, 32, 1],
      ['spr_paper', 256, 256, 1],
    ]);
  });

  it('gives every sheet a kind, the player, the paper, the shed and the back garden the Inked sheets', () => {
    for (const s of ALL_SHEETS) expect(['pixel', 'inked']).toContain(s.art);
    expect(ALL_SHEETS.filter((s) => s.art === 'inked')).toEqual([
      SHEETS.player,
      SHEETS.floorShed,
      SHEETS.floorGarden,
      SHEETS.fence,
      SHEETS.fenceV,
      SHEETS.fenceCorner,
      SHEETS.gate,
      SHEETS.sourcePlant,
      SHEETS.shedFace,
      SHEETS.shedRoof,
      SHEETS.houseFace,
      SHEETS.houseRoof,
      SHEETS.houseCapV,
      SHEETS.houseWindow,
      SHEETS.greenhouseRoof,
      SHEETS.greenhouseFace,
      SHEETS.greenhouseCap,
      SHEETS.greenhouseCapV,
      SHEETS.doorGlazed,
      SHEETS.shedWall,
      SHEETS.shedCap,
      SHEETS.shedCapV,
      SHEETS.shedWindow,
      SHEETS.shedDoor,
      SHEETS.shedDoorS,
      SHEETS.workbench,
      SHEETS.plantingTable,
      SHEETS.shopKiosk,
      SHEETS.shedRug,
      SHEETS.shelf,
      SHEETS.tools,
      SHEETS.wateringCan,
      SHEETS.potStack,
      SHEETS.sack,
      SHEETS.paper,
    ]);
  });

  it('draws a pixel sheet at 2 px per logical px nearest, an Inked one at 4 linear', () => {
    expect(INKED_PER_LOGICAL).toBe(4);
    expect(SHEETS.door.art).toBe('pixel');
    expect(sheetPxPerLogical(SHEETS.door)).toBe(2);
    expect(sheetFilter(SHEETS.door)).toBe('nearest');
    expect(sheetPxPerLogical(SHEETS.paper)).toBe(4);
    expect(sheetFilter(SHEETS.paper)).toBe('linear');
  });

  it('lays the paper as one 64 logical px tile, 256 sheet px square: one grain period', () => {
    expect(SHEETS.paper).toEqual({
      key: 'spr_paper',
      frameWidth: 256,
      frameHeight: 256,
      frames: 1,
      art: 'inked',
    });
    expect(SHEETS.paper.frameWidth / sheetPxPerLogical(SHEETS.paper)).toBe(64);
  });

  it("loads the placed furniture's sprites, each its footprint at half scale", () => {
    expect(ALL_SHEETS).toContain(SHEETS.pedestal);
    expect(ALL_SHEETS).toContain(SHEETS.floorShelf);
    expect([
      SHEETS.pedestal.frameWidth * SPRITE_SCALE,
      SHEETS.pedestal.frameHeight * SPRITE_SCALE,
    ]).toEqual([16, 16]);
    expect([
      SHEETS.floorShelf.frameWidth * SPRITE_SCALE,
      SHEETS.floorShelf.frameHeight * SPRITE_SCALE,
    ]).toEqual([32, 16]);
  });

  it("draws the shed in Inked at the scale rule's logical sizes", () => {
    const logical = (s: (typeof ALL_SHEETS)[number]) => [
      s.frameWidth / sheetPxPerLogical(s),
      s.frameHeight / sheetPxPerLogical(s),
    ];
    expect(
      [
        SHEETS.floorShed,
        SHEETS.shedWall,
        SHEETS.shedCap,
        SHEETS.shedCapV,
        SHEETS.shedWindow,
        SHEETS.shedDoor,
        SHEETS.shedDoorS,
        SHEETS.workbench,
        SHEETS.plantingTable,
        SHEETS.shopKiosk,
        SHEETS.shedRug,
        SHEETS.shelf,
        SHEETS.tools,
        SHEETS.wateringCan,
        SHEETS.potStack,
        SHEETS.sack,
      ].map(logical),
    ).toEqual([
      // The floorboard tile; the back wall's 2.4 m face; the 8 px caps, south and side.
      [16, 16],
      [16, 48],
      [16, 8],
      [8, 16],
      // The window; the 0.8 x 2.0 m door front-on; the garden door's opening in the south cap.
      [32, 24],
      [24, 40],
      [24, 16],
      // The 1.5 x 0.6 x 0.9 m workbench, the planting table, the kiosk, the rug.
      [48, 40],
      [32, 40],
      [24, 56],
      [120, 70],
      // The decor.
      [24, 20],
      [12, 32],
      [16, 12],
      [12, 20],
      [16, 20],
    ]);
  });

  it("draws the back garden in Inked at the scale rule's logical sizes", () => {
    const logical = (s: (typeof ALL_SHEETS)[number]) => [
      s.frameWidth / sheetPxPerLogical(s),
      s.frameHeight / sheetPxPerLogical(s),
    ];
    expect(
      [
        SHEETS.floorGarden,
        SHEETS.fence,
        SHEETS.fenceV,
        SHEETS.fenceCorner,
        SHEETS.gate,
        SHEETS.sourcePlant,
        SHEETS.shedFace,
        SHEETS.houseFace,
        SHEETS.greenhouseFace,
        SHEETS.shedRoof,
        SHEETS.houseRoof,
        SHEETS.greenhouseRoof,
        SHEETS.houseCapV,
        SHEETS.greenhouseCapV,
        SHEETS.greenhouseCap,
        SHEETS.houseWindow,
        SHEETS.doorGlazed,
      ].map(logical),
    ).toEqual([
      // The lawn, the 0.75 m fence's face, the fence seen down the band, its corners, the gate.
      [16, 16],
      [16, 16],
      [16, 16],
      [16, 16],
      [16, 16],
      // A source plant standing on its foot.
      [24, 32],
      // The faces, 2.4 m; the roofs' tiles; the 8 px caps; the kitchen window; a 0.8 x 2.0 m glazed leaf.
      [16, 48],
      [16, 48],
      [16, 48],
      [16, 16],
      [16, 16],
      [16, 16],
      [8, 16],
      [8, 16],
      [16, 8],
      [40, 24],
      [24, 40],
    ]);
    // Every repeated tile has at least three variants; the corners one per corner.
    for (const s of [
      SHEETS.floorGarden,
      SHEETS.fence,
      SHEETS.fenceV,
      SHEETS.shedFace,
      SHEETS.houseFace,
      SHEETS.greenhouseFace,
      SHEETS.shedRoof,
      SHEETS.houseRoof,
      SHEETS.greenhouseRoof,
      SHEETS.houseCapV,
      SHEETS.greenhouseCapV,
      SHEETS.greenhouseCap,
    ]) {
      expect(s.frames, s.key).toBeGreaterThanOrEqual(3);
    }
    expect(SHEETS.fenceCorner.frames).toBe(4);
    expect(SHEETS.sourcePlant.frames).toBe(3);
  });

  it("loads the house rooms' and the greenhouse's generated tiles and furniture and the buildings' roof with the rest", () => {
    for (const s of [
      SHEETS.floorLounge,
      SHEETS.wallLounge,
      SHEETS.floorHallway,
      SHEETS.wallHallway,
      SHEETS.floorStudy,
      SHEETS.wallStudy,
      SHEETS.floorGreenhouse,
      SHEETS.wallGlass,
      SHEETS.window,
      SHEETS.fireplace,
      SHEETS.sideTable,
      SHEETS.desk,
      SHEETS.bookshelf,
      SHEETS.runner,
      SHEETS.hallTable,
      SHEETS.roof,
    ]) {
      expect(ALL_SHEETS).toContain(s);
    }
  });

  it('has a committed strip for every sheet, its frames side by side', () => {
    for (const s of ALL_SHEETS) {
      expect(pngSize(s.key)).toEqual({
        width: s.frameWidth * s.frames,
        height: s.frameHeight,
      });
    }
  });

  it('builds the URL under the base path', () => {
    expect(sheetUrl('/', SHEETS.player)).toBe('/assets/spr_player.png');
    expect(sheetUrl('/game/', SHEETS.door)).toBe('/game/assets/spr_door.png');
  });

  it('halves prototype px', () => {
    expect(SPRITE_SCALE).toBe(0.5);
  });

  it('draws the Inked player at 16 x 32 logical px, its feet 12 below its position', () => {
    expect(SHEETS.player).toEqual({
      key: 'spr_player',
      frameWidth: 64,
      frameHeight: 128,
      frames: 16,
      art: 'inked',
    });
    expect(sheetFilter(SHEETS.player)).toBe('linear');
    expect(PLAYER_SCALE).toBe(0.25);
    expect([
      SHEETS.player.frameWidth * PLAYER_SCALE,
      SHEETS.player.frameHeight * PLAYER_SCALE,
    ]).toEqual([16, 32]);
    expect(PLAYER_FEET).toBe(12);
  });
});

describe('frames', () => {
  it('picks the player frame from the facing row and the walk counter', () => {
    expect(playerFrame('down', 0)).toBe(0);
    expect(playerFrame('up', 0)).toBe(4);
    expect(playerFrame('left', 0)).toBe(8);
    expect(playerFrame('right', 0)).toBe(12);
    expect(playerFrame('down', 0.14)).toBe(0);
    expect(playerFrame('left', 1.4)).toBe(9);
    expect(playerFrame('right', 3.99)).toBe(15);
  });

  it('picks the source plant frame by species', () => {
    expect([
      sourcePlantFrame('juniper'),
      sourcePlantFrame('maple'),
      sourcePlantFrame('pine'),
    ]).toEqual([0, 1, 2]);
  });

  it('hashes a floor tile to a stable frame, (column * 7 + row * 13) mod frames', () => {
    expect(floorFrame(0, 0, 3)).toBe(0);
    expect(floorFrame(1, 0, 3)).toBe(1);
    expect(floorFrame(2, 0, 3)).toBe(2);
    expect(floorFrame(0, 1, 3)).toBe(1);
    expect(floorFrame(5, 3, 3)).toBe((35 + 39) % 3);
    expect(floorFrame(5, 3, 1)).toBe(0);
  });
});
