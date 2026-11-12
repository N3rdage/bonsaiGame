import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_SHEETS,
  PLAYER_SCALE,
  SHEETS,
  SPRITE_SCALE,
  floorFrame,
  playerFrame,
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
      ['spr_window', 32, 32, 1],
      ['spr_fireplace', 64, 48, 1],
      ['spr_side_table', 32, 32, 1],
      ['spr_desk', 64, 32, 1],
      ['spr_bookshelf', 32, 32, 1],
      ['spr_runner', 416, 48, 1],
      ['spr_hall_table', 32, 24, 1],
    ]);
  });

  it("loads the house rooms' generated tiles and furniture with the rest", () => {
    for (const s of [
      SHEETS.floorLounge,
      SHEETS.wallLounge,
      SHEETS.floorHallway,
      SHEETS.wallHallway,
      SHEETS.floorStudy,
      SHEETS.wallStudy,
      SHEETS.window,
      SHEETS.fireplace,
      SHEETS.sideTable,
      SHEETS.desk,
      SHEETS.bookshelf,
      SHEETS.runner,
      SHEETS.hallTable,
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
