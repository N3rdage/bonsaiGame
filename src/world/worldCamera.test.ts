import { describe, expect, it } from 'vitest';
import { PHONE_MAX_SHORT_SIDE } from '../platform/orientation';
import { GARDEN_ROOM } from './gardenRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { SHED_ROOM } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import { PHONE_WORLD_ZOOM, viewSize, worldView, worldZoom } from './worldCamera';

const SHED = SHED_ROOM.bounds;
const GARDEN = GARDEN_ROOM.bounds;

describe('worldZoom', () => {
  it('zooms the world 2x on the S22 Ultra in landscape and portrait', () => {
    expect(PHONE_WORLD_ZOOM).toBe(2);
    expect(worldZoom(824, 384)).toBe(2);
    expect(worldZoom(384, 824)).toBe(2);
  });

  it('leaves desktops at 1x', () => {
    expect(worldZoom(1280, 720)).toBe(1);
    expect(worldZoom(1920, 1080)).toBe(1);
  });

  it('switches at the orientation rule threshold', () => {
    expect(PHONE_MAX_SHORT_SIDE).toBe(500);
    expect(worldZoom(1000, 499)).toBe(2);
    expect(worldZoom(1000, 500)).toBe(1);
    expect(worldZoom(499, 1000)).toBe(2);
  });
});

describe('viewSize', () => {
  it('is the logical canvas divided by the zoom, in room units', () => {
    expect(viewSize(1)).toEqual({ w: 480, h: 270 });
    expect(viewSize(2)).toEqual({ w: 240, h: 135 });
  });
});

describe('worldView', () => {
  it('pins the drawn extents it clamps to', () => {
    expect(SHED).toEqual({ x: 80, y: 48, w: 320, h: 176 });
    expect(GARDEN).toEqual({ x: 0, y: 0, w: 480, h: 270 });
  });

  it('centres the view on the player away from the edges', () => {
    expect(worldView({ x: 240, y: 135 }, SHED, 2)).toEqual({
      zoom: 2,
      scrollX: 120,
      scrollY: 67.5,
    });
    expect(worldView({ x: 300, y: 150 }, GARDEN, 2)).toEqual({
      zoom: 2,
      scrollX: 180,
      scrollY: 82.5,
    });
  });

  it('keeps the shed view inside its ring at each edge', () => {
    // Clamp range: x 80..160 (80 + 320 - 240), y 48..89 (48 + 176 - 135).
    expect(worldView({ x: 96, y: 135 }, SHED, 2).scrollX).toBe(80);
    expect(worldView({ x: 384, y: 135 }, SHED, 2).scrollX).toBe(160);
    expect(worldView({ x: 240, y: 60 }, SHED, 2).scrollY).toBe(48);
    expect(worldView({ x: 240, y: 210 }, SHED, 2).scrollY).toBe(89);
  });

  it('keeps the garden view inside the room at each edge', () => {
    expect(worldView({ x: 20, y: 135 }, GARDEN, 2).scrollX).toBe(0);
    expect(worldView({ x: 460, y: 135 }, GARDEN, 2).scrollX).toBe(240);
    expect(worldView({ x: 240, y: 20 }, GARDEN, 2).scrollY).toBe(0);
    expect(worldView({ x: 240, y: 250 }, GARDEN, 2).scrollY).toBe(135);
    // The garden door's landing spot is in the bottom-left corner.
    expect(worldView({ x: 50, y: 225 }, GARDEN, 2)).toEqual({ zoom: 2, scrollX: 0, scrollY: 135 });
  });

  it('shows the whole canvas at 1x wherever the player is, as the unzoomed world did', () => {
    for (const at of [
      { x: 96, y: 60 },
      { x: 240, y: 135 },
      { x: 384, y: 210 },
    ]) {
      expect(worldView(at, SHED, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 0 });
      expect(worldView(at, GARDEN, 1)).toEqual({ zoom: 1, scrollX: 0, scrollY: 0 });
    }
  });

  it("follows along the house rooms' own extents and centres those shorter than the view", () => {
    // Lounge (48, 96) 384x128: x follows in 48..192, y centred on its middle, 160, wherever the player is.
    for (const y of [112.5, 190, 207.5]) {
      expect(worldView({ x: 64, y }, LOUNGE_ROOM.bounds, 2)).toEqual({
        zoom: 2,
        scrollX: 48,
        scrollY: 160 - 67.5,
      });
    }
    expect(worldView({ x: 420, y: 112.5 }, LOUNGE_ROOM.bounds, 2).scrollX).toBe(192);
    // Study (128, 96) 224x128: smaller than the view both ways, so centred on (240, 160).
    expect(worldView({ x: 144.5, y: 112.5 }, STUDY_ROOM.bounds, 2)).toEqual({
      zoom: 2,
      scrollX: 120,
      scrollY: 92.5,
    });
    // Hallway (80, 160) 320x64: x follows in 80..160, y stays on the corridor's centre line, 192.
    for (const y of [176.25, 190, 207.5]) {
      expect(worldView({ x: 114, y }, HALLWAY_ROOM.bounds, 2)).toEqual({
        zoom: 2,
        scrollX: 80,
        scrollY: 192 - 67.5,
      });
    }
    expect(worldView({ x: 366, y: 190 }, HALLWAY_ROOM.bounds, 2).scrollX).toBe(160);
    expect(worldView({ x: 114, y: 190 }, HALLWAY_ROOM.bounds, 1)).toEqual({
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
    });
  });

  it('centres an extent smaller than the view, inside the canvas', () => {
    const small = { x: 200, y: 100, w: 100, h: 50 };
    const view = worldView({ x: 210, y: 110 }, small, 2);
    expect(view.scrollX + 120).toBe(250);
    expect(view.scrollY + 67.5).toBe(125);
    // Centring it would leave the canvas, so the view stops at the canvas edge.
    expect(worldView({ x: 10, y: 10 }, { x: 0, y: 0, w: 100, h: 50 }, 2)).toEqual({
      zoom: 2,
      scrollX: 0,
      scrollY: 0,
    });
  });
});
