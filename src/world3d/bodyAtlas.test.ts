import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dressAtlas } from './bodyAtlas';
import { accessorFloats, readGlb, type GltfJson } from './glb';
import { BODY_ATLAS, BODY_PALETTE } from './look';

const CELL_WIDTH = 2;
const CELL_HEIGHT = 4;
const WIDTH = BODY_ATLAS.columns * CELL_WIDTH;
const HEIGHT = BODY_ATLAS.rows * CELL_HEIGHT;

/** A tiny atlas: every cell a grey gradient from 240 at its top row to 40 at its bottom, alpha 255. */
function greyAtlas(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    const grey = 240 - (200 * (y % CELL_HEIGHT)) / (CELL_HEIGHT - 1);
    for (let x = 0; x < WIDTH; x++) rgba.set([grey, grey, grey, 255], (y * WIDTH + x) * 4);
  }
  return rgba;
}

function pixel(rgba: Uint8ClampedArray, col: number, row: number, y: number): number {
  const i = ((row * CELL_HEIGHT + y) * WIDTH + col * CELL_WIDTH) * 4;
  return ((rgba[i] ?? 0) << 16) | ((rgba[i + 1] ?? 0) << 8) | (rgba[i + 2] ?? 0);
}

describe('dressAtlas', () => {
  const dressed = greyAtlas();
  dressAtlas(dressed, WIDTH, HEIGHT);
  const plain = greyAtlas();

  it('puts each palette cell lightest-end first on its light colour and darkest-end last on its dark one', () => {
    for (const { cell, light, dark } of Object.values(BODY_PALETTE)) {
      expect(pixel(dressed, cell[0], cell[1], 0)).toBe(light);
      expect(pixel(dressed, cell[0], cell[1], CELL_HEIGHT - 1)).toBe(dark);
    }
  });

  it('keeps the gradient running the same way, light to dark, through the middle rows', () => {
    const { cell, light, dark } = BODY_PALETTE.tunic;
    const rows = [0, 1, 2, 3].map((y) => pixel(dressed, cell[0], cell[1], y));
    const red = rows.map((p) => p >> 16);
    expect(red[0]).toBeGreaterThan(red[1] ?? 0);
    expect(red[1]).toBeGreaterThan(red[2] ?? 0);
    expect(red[2]).toBeGreaterThan(red[3] ?? 0);
    expect(rows[0]).toBe(light);
    expect(rows[3]).toBe(dark);
  });

  it('leaves every cell outside the palette, and every alpha, as it was', () => {
    const dressedCells = new Set(
      Object.values(BODY_PALETTE).map(({ cell }) => `${String(cell[0])},${String(cell[1])}`),
    );
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const key = `${String(Math.floor(x / CELL_WIDTH))},${String(Math.floor(y / CELL_HEIGHT))}`;
        const i = (y * WIDTH + x) * 4;
        expect(dressed[i + 3]).toBe(255);
        if (!dressedCells.has(key)) expect(dressed.slice(i, i + 4)).toEqual(plain.slice(i, i + 4));
      }
    }
  });

  it('takes a flat cell to its light colour rather than dividing by nothing', () => {
    const flat = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(100);
    dressAtlas(flat, WIDTH, HEIGHT);
    const { cell, light } = BODY_PALETTE.boots;
    expect(pixel(flat, cell[0], cell[1], 1)).toBe(light);
  });
});

describe('BODY_PALETTE', () => {
  it('pins the gardener palette: terracotta tunic, cream scarf and apron, dark trousers, brown boots', () => {
    const cells = Object.fromEntries(
      Object.entries(BODY_PALETTE).map(([name, p]) => [name, p.cell]),
    );
    expect(cells).toEqual({
      tunic: [0, 1],
      scarf: [1, 1],
      apron: [5, 0],
      sleeves: [7, 2],
      belt: [3, 0],
      pouches: [6, 0],
      trousers: [7, 1],
      boots: [3, 2],
    });
    expect(BODY_PALETTE.tunic).toMatchObject({ light: 0xcf7a52, dark: 0x8f4a30 });
    expect(BODY_PALETTE.scarf).toMatchObject({ light: 0xf4ead2, dark: 0xc9b68f });
    expect(BODY_PALETTE.apron).toMatchObject({ light: 0xeedfbd, dark: 0xbfa57a });
    expect(BODY_PALETTE.trousers).toMatchObject({ light: 0x4a4038, dark: 0x2a2420 });
    expect(BODY_PALETTE.boots).toMatchObject({ light: 0x7a4e30, dark: 0x3e2616 });
  });

  it('has no two parts on one cell, and leaves the skin, hair and eyes cells alone', () => {
    const keys = Object.values(BODY_PALETTE).map(
      ({ cell }) => `${String(cell[0])},${String(cell[1])}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const left of ['0,0', '1,0', '2,0']) expect(keys).not.toContain(left);
  });

  it('only recolours cells the Rogue body samples, and a light end that is lighter than its dark end', () => {
    const bytes = readFileSync(new URL('./player/rogue.glb', import.meta.url));
    const glb = readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const json = glb.json as GltfJson & {
      meshes: { primitives: { attributes: Record<string, number> }[] }[];
    };
    const uv = accessorFloats(glb, json.meshes[0]?.primitives[0]?.attributes.TEXCOORD_0 ?? -1);
    const sampled = new Set<string>();
    for (let i = 0; i < uv.length; i += 2) {
      const col = Math.floor((uv[i] ?? 0) * BODY_ATLAS.columns);
      const row = Math.floor((uv[i + 1] ?? 0) * BODY_ATLAS.rows);
      sampled.add(`${String(col)},${String(row)}`);
    }
    for (const { cell, light, dark } of Object.values(BODY_PALETTE)) {
      expect(sampled).toContain(`${String(cell[0])},${String(cell[1])}`);
      const lum = (hex: number) =>
        0.2126 * (hex >> 16) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255);
      expect(lum(light)).toBeGreaterThan(lum(dark));
    }
  });
});
