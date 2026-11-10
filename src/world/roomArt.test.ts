import { describe, expect, it } from 'vitest';
import { SHEETS } from './assets';
import { DOORWAY, GARDEN_ROOM } from './gardenRoom';
import {
  PEDESTAL_LABEL_DY,
  SHED_RUG,
  TILE,
  fenceCorners,
  floorTiles,
  playerShadow,
  propShadow,
  propSprite,
  treeShadow,
  wallRuns,
} from './roomArt';
import { SHED_ROOM, type Prop } from './shedRoom';

const propByKey = (props: readonly Prop[], key: string): Prop => {
  const p = props.find((q) => q.key === key);
  if (!p) throw new Error(key);
  return p;
};

describe('floor', () => {
  it('tiles the room in 16 px tiles with the hashed frame of each', () => {
    const shed = floorTiles(SHED_ROOM);
    expect(TILE).toBe(16);
    expect(shed.sheet).toBe(SHEETS.floorShed);
    expect(shed.frames).toHaveLength(17);
    expect(shed.frames[0]).toHaveLength(30);
    expect(shed.frames[0]?.slice(0, 4)).toEqual([0, 1, 2, 0]);
    expect(shed.frames[1]?.slice(0, 4)).toEqual([1, 2, 0, 1]);
    expect(floorTiles(GARDEN_ROOM).sheet).toBe(SHEETS.floorGarden);
  });

  it('has the shed rug at the prototype (360, 220)..(600, 360), halved', () => {
    expect([SHED_RUG.x, SHED_RUG.y, SHED_RUG.w, SHED_RUG.h, SHED_RUG.inset]).toEqual([
      180, 110, 120, 70, 3.5,
    ]);
  });
});

describe('walls', () => {
  it('rings the shed with spr_wall, corners included', () => {
    expect(wallRuns(SHED_ROOM).map((r) => [r.sheet.key, r.x, r.y, r.w, r.h])).toEqual([
      ['spr_wall', 0, 0, 480, 16],
      ['spr_wall', 0, 254, 480, 16],
      ['spr_wall', 0, 16, 16, 240],
      ['spr_wall', 464, 16, 16, 240],
    ]);
  });

  it('fences the garden, rows spr_fence and columns spr_fence_v, without corners or the doorway', () => {
    expect(wallRuns(GARDEN_ROOM).map((r) => [r.sheet.key, r.x, r.y, r.w, r.h])).toEqual([
      ['spr_fence', 16, 0, 448, 16],
      ['spr_fence', 16, 254, 448, 16],
      ['spr_fence_v', 0, 16, 16, DOORWAY.top - 16],
      ['spr_fence_v', 0, DOORWAY.bottom, 16, 16],
      ['spr_fence_v', 464, 16, 16, 240],
    ]);
  });

  it('mitres the garden corners with two rails each, three bands a leg, inside the corner tiles', () => {
    const rects = fenceCorners(GARDEN_ROOM);
    expect(fenceCorners(SHED_ROOM)).toEqual([]);
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
  it('draws the shed props from their sprites, centred, the pedestal at 1.5x', () => {
    const at = (key: string) => {
      const s = propSprite(propByKey(SHED_ROOM.props, key));
      return s && [s.sheet.key, s.frame, s.x, s.y, s.scale];
    };
    expect(at('workbench')).toEqual(['spr_workbench', 0, 125, 90, 0.5]);
    expect(at('planting_table')).toEqual(['spr_planting_table', 0, 165, 90, 0.5]);
    expect(at('shop_kiosk')).toEqual(['spr_shop_kiosk', 0, 125, 145, 0.5]);
    expect(at('pedestal_1')).toEqual(['spr_pedestal', 0, 310, 85, 0.75]);
    expect(at('door')).toEqual(['spr_door', 0, 232, 208, 0.5]);
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

  it('puts the pedestal label 30 prototype px below its centre', () => {
    expect(PEDESTAL_LABEL_DY).toBe(15);
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
    expect(propShadow(propByKey(SHED_ROOM.props, 'pedestal_1'))).toEqual({
      x: 310,
      y: 85 + 11.25,
      w: 18,
      h: 2.5,
      alpha: 0.3,
    });
    expect(propShadow(propByKey(SHED_ROOM.props, 'workbench'))).toBeUndefined();
    expect(playerShadow(240, 135)).toEqual({ x: 240, y: 141.75, w: 16, h: 4.5, alpha: 0.25 });
    expect(treeShadow(100, 100, 1)).toEqual({ x: 100, y: 118.5, w: 32, h: 5, alpha: 0.25 });
  });
});
