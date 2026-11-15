import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_SHEETS,
  INKED_PER_LOGICAL,
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
      ['spr_player', 32, 32, 16],
      ['spr_floor_shed', 32, 32, 3],
      ['spr_floor_garden', 32, 32, 3],
      ['spr_source_plant', 48, 48, 3],
      ['spr_wall', 32, 32, 1],
      ['spr_fence', 32, 32, 1],
      ['spr_fence_v', 32, 32, 1],
      ['spr_door', 32, 32, 1],
      ['spr_workbench', 32, 32, 1],
      ['spr_planting_table', 32, 32, 1],
      ['spr_shop_kiosk', 32, 32, 1],
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
      ['spr_shelf', 56, 44, 1],
      ['spr_tools', 36, 52, 1],
      ['spr_watering_can', 32, 30, 1],
      ['spr_pot_stack', 40, 40, 1],
      ['spr_sack', 32, 34, 1],
      ['spr_roof', 32, 32, 1],
      ['spr_road', 64, 192, 1],
      ['spr_fence_low', 32, 32, 1],
      ['spr_drive', 32, 32, 1],
      ['spr_bed', 32, 32, 1],
      ['spr_roller_door', 154, 32, 1],
      ['spr_gate', 32, 32, 1],
      ['spr_pedestal', 32, 32, 1],
      ['spr_floor_shelf', 64, 32, 1],
      ['spr_paper', 256, 256, 1],
    ]);
  });

  it('gives every sheet a kind, the paper the one Inked sheet', () => {
    for (const s of ALL_SHEETS) expect(['pixel', 'inked']).toContain(s.art);
    expect(ALL_SHEETS.filter((s) => s.art === 'inked')).toEqual([SHEETS.paper]);
  });

  it('draws a pixel sheet at 2 px per logical px nearest, an Inked one at 4 linear', () => {
    expect(INKED_PER_LOGICAL).toBe(4);
    expect(SHEETS.floorShed.art).toBe('pixel');
    expect(sheetPxPerLogical(SHEETS.floorShed)).toBe(2);
    expect(sheetFilter(SHEETS.floorShed)).toBe('nearest');
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

  it("loads the shed's decor, packed from the prototype at its sprites' sizes", () => {
    for (const s of [
      SHEETS.shelf,
      SHEETS.tools,
      SHEETS.wateringCan,
      SHEETS.potStack,
      SHEETS.sack,
    ]) {
      expect(ALL_SHEETS).toContain(s);
    }
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

  it('halves prototype px, and draws the player at the prototype 1.5x', () => {
    expect(SPRITE_SCALE).toBe(0.5);
    expect(PLAYER_SCALE).toBe(0.75);
    expect(SHEETS.player.frameHeight * PLAYER_SCALE).toBe(24);
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
