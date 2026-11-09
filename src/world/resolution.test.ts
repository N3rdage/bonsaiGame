import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH, cameraZoom, canvasSize, deviceScale } from './resolution';

/** The canvas backing and camera zoom for a window, as main.ts and the scenes derive them. */
function fit(cssWidth: number, cssHeight: number, dpr: number) {
  const scale = deviceScale(cssWidth, cssHeight, dpr);
  const canvas = canvasSize(scale);
  return { scale, canvas, zoom: cameraZoom(canvas.width, canvas.height) };
}

describe('resolution', () => {
  it('keeps the logical canvas at 480x270', () => {
    expect([GAME_WIDTH, GAME_HEIGHT]).toEqual([480, 270]);
  });

  it('fits a 1920x1080 desktop at 4 device px per logical px', () => {
    const { scale, canvas, zoom } = fit(1920, 1080, 1);
    expect(scale).toBe(4);
    expect(canvas).toEqual({ width: 1920, height: 1080 });
    expect(zoom).toEqual({ x: 4, y: 4 });
  });

  it('fits a 1280x720 desktop at 8/3', () => {
    const { scale, canvas } = fit(1280, 720, 1);
    expect(scale).toBeCloseTo(8 / 3, 10);
    expect(canvas).toEqual({ width: 1280, height: 720 });
  });

  it('fits the S22 Ultra in landscape at 4, height-bound', () => {
    const { scale, canvas } = fit(824, 384, 2.8125);
    expect(scale).toBe(4);
    expect(canvas).toEqual({ width: 1920, height: 1080 });
  });

  it('fits the S22 Ultra in portrait at 2.25, width-bound', () => {
    const { scale, canvas } = fit(384, 824, 2.8125);
    expect(scale).toBe(2.25);
    expect(canvas).toEqual({ width: 1080, height: 608 });
  });

  it('fits a Pixel 7 in portrait and zooms each axis to the rounded backing', () => {
    const { scale, canvas, zoom } = fit(412, 915, 2.625);
    expect(scale).toBeCloseTo(2.253125, 10);
    expect(canvas).toEqual({ width: 1082, height: 608 });
    expect(zoom.x).toBeCloseTo(1082 / 480, 10);
    expect(zoom.y).toBeCloseTo(608 / 270, 10);
    expect(zoom.x).not.toBe(zoom.y);
  });

  it('never drops below the logical size in a tiny window', () => {
    const { scale, canvas, zoom } = fit(100, 50, 1);
    expect(scale).toBe(1);
    expect(canvas).toEqual({ width: 480, height: 270 });
    expect(zoom).toEqual({ x: 1, y: 1 });
  });
});
