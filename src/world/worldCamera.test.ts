import { describe, expect, it } from 'vitest';
import { PHONE_MAX_SHORT_SIDE } from '../platform/orientation';
import { FRONT_GARDEN_ROOM } from './frontGardenRoom';
import { GARDEN_ROOM } from './gardenRoom';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { SHED_ROOM } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import { PHONE_WORLD_ZOOM, viewSize, worldView, worldZoom } from './worldCamera';

const SHED = SHED_ROOM.bounds;
const GARDEN = GARDEN_ROOM.bounds;
const PHONE = PHONE_WORLD_ZOOM;

describe('worldZoom', () => {
  it('zooms the world 1.25x on the S22 Ultra in landscape and portrait', () => {
    expect(PHONE_WORLD_ZOOM).toBe(1.25);
    expect(worldZoom(824, 384)).toBe(1.25);
    expect(worldZoom(384, 824)).toBe(1.25);
  });

  it('leaves desktops at 1x', () => {
    expect(worldZoom(1280, 720)).toBe(1);
    expect(worldZoom(1920, 1080)).toBe(1);
  });

  it('switches at the orientation rule threshold', () => {
    expect(PHONE_MAX_SHORT_SIDE).toBe(500);
    expect(worldZoom(1000, 499)).toBe(1.25);
    expect(worldZoom(1000, 500)).toBe(1);
    expect(worldZoom(499, 1000)).toBe(1.25);
  });
});

describe('viewSize', () => {
  it('is the logical canvas divided by the zoom, in room units', () => {
    expect(viewSize(1)).toEqual({ w: 480, h: 270 });
    // 12 x 6.75 m at 32 px per metre.
    expect(viewSize(PHONE)).toEqual({ w: 384, h: 216 });
  });
});

describe('worldView', () => {
  it('pins the drawn extents it clamps to', () => {
    expect(SHED).toEqual({ x: 80, y: 48, w: 320, h: 176 });
    expect(GARDEN).toEqual({ x: 0, y: 0, w: 464, h: 512 });
  });

  it('centres the view on the player away from the edges', () => {
    expect(worldView({ x: 240, y: 150 }, GARDEN, PHONE)).toEqual({
      zoom: PHONE,
      scrollX: 48,
      scrollY: 42,
    });
  });

  it('holds the shed still on a phone, its 320x176 ring inside the 384x216 view, centred', () => {
    // x 80 + (320 - 384) / 2 = 48, y 48 + (176 - 216) / 2 = 28, both inside the canvas.
    for (const at of [
      { x: 96, y: 60 },
      { x: 240, y: 135 },
      { x: 384, y: 210 },
    ]) {
      expect(worldView(at, SHED, PHONE)).toEqual({ zoom: PHONE, scrollX: 48, scrollY: 28 });
    }
  });

  it('keeps the garden view inside the room at each edge', () => {
    // Clamp range at 1.25x: x 0..80 (464 - 384), y 0..296 (512 - 216).
    expect(worldView({ x: 20, y: 135 }, GARDEN, PHONE).scrollX).toBe(0);
    expect(worldView({ x: 440, y: 135 }, GARDEN, PHONE).scrollX).toBe(80);
    expect(worldView({ x: 440, y: 20 }, GARDEN, PHONE).scrollY).toBe(0);
    expect(worldView({ x: 240, y: 490 }, GARDEN, PHONE).scrollY).toBe(296);
    // The shed door's landing (80, 274) is against the left edge, the view centred on its row.
    expect(worldView({ x: 80, y: 274 }, GARDEN, PHONE)).toEqual({
      zoom: PHONE,
      scrollX: 0,
      scrollY: 166,
    });
  });

  it('shows the whole shed at 1x wherever the player is, as the unzoomed world did', () => {
    for (const at of [
      { x: 96, y: 60 },
      { x: 240, y: 135 },
      { x: 384, y: 210 },
    ]) {
      expect(worldView(at, SHED, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 0 });
    }
  });

  it('follows the garden up and down at 1x, taller than the 270 px view, with its 464 px width held still', () => {
    // Clamp range at 1x: x stays 0 (the garden is narrower than the 480 px canvas), y 0..242 (512 - 270).
    expect(worldView({ x: 440, y: 20 }, GARDEN, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 0 });
    expect(worldView({ x: 80, y: 274 }, GARDEN, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 139 });
    expect(worldView({ x: 240, y: 490 }, GARDEN, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 242 });
  });

  it('shows each house room and the greenhouse whole on a phone, the view still wherever the player is', () => {
    // Lounge (48, 96) 384x128: exactly the view's width, so x is held at 48; y centred, 96 + (128 - 216) / 2.
    // Study (128, 96) 224x128 and greenhouse (144, 64) 192x144: centred both ways.
    // Hallway (80, 160) 320x64: centred across; centred down it would start at y 84, past the
    // canvas's last start 270 - 216 = 54, so it stops there.
    for (const [bounds, scrollX, scrollY, spots] of [
      [
        LOUNGE_ROOM.bounds,
        48,
        52,
        [
          { x: 64, y: 112.5 },
          { x: 420, y: 207.5 },
        ],
      ],
      [
        STUDY_ROOM.bounds,
        48,
        52,
        [
          { x: 144.5, y: 112.5 },
          { x: 320, y: 190 },
        ],
      ],
      [
        HALLWAY_ROOM.bounds,
        48,
        54,
        [
          { x: 114, y: 176.25 },
          { x: 366, y: 207.5 },
        ],
      ],
      [
        GREENHOUSE_ROOM.bounds,
        48,
        28,
        [
          { x: 170, y: 90 },
          { x: 310, y: 190 },
        ],
      ],
    ] as const) {
      for (const at of spots) {
        const view = worldView(at, bounds, PHONE);
        expect(view).toEqual({ zoom: PHONE, scrollX, scrollY });
        expect(view.scrollX).toBeLessThanOrEqual(bounds.x);
        expect(view.scrollY).toBeLessThanOrEqual(bounds.y);
        expect(view.scrollX + 384).toBeGreaterThanOrEqual(bounds.x + bounds.w);
        expect(view.scrollY + 216).toBeGreaterThanOrEqual(bounds.y + bounds.h);
      }
    }
    expect(worldView({ x: 114, y: 190 }, HALLWAY_ROOM.bounds, 1)).toEqual({
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
    });
  });

  it('follows the front garden across on a phone, its 128 px depth held centred', () => {
    // Bounds (0, 96) 576x128: x 0..192 (576 - 384), y 96 + (128 - 216) / 2 = 52.
    const bounds = FRONT_GARDEN_ROOM.bounds;
    expect(bounds).toEqual({ x: 0, y: 96, w: 576, h: 128 });
    expect(worldView({ x: 20, y: 190 }, bounds, PHONE)).toEqual({
      zoom: PHONE,
      scrollX: 0,
      scrollY: 52,
    });
    expect(worldView({ x: 336, y: 190 }, bounds, PHONE).scrollX).toBe(144);
    expect(worldView({ x: 544, y: 120 }, bounds, PHONE)).toEqual({
      zoom: PHONE,
      scrollX: 192,
      scrollY: 52,
    });
  });

  it('centres an extent smaller than the view, inside the canvas', () => {
    const small = { x: 200, y: 100, w: 100, h: 50 };
    const view = worldView({ x: 210, y: 110 }, small, PHONE);
    expect(view.scrollX + 192).toBe(250);
    expect(view.scrollY + 108).toBe(125);
    // Centring it would leave the canvas, so the view stops at the canvas edge.
    expect(worldView({ x: 10, y: 10 }, { x: 0, y: 0, w: 100, h: 50 }, PHONE)).toEqual({
      zoom: PHONE,
      scrollX: 0,
      scrollY: 0,
    });
  });
});
