import { describe, expect, it } from 'vitest';
import { inkedWashes } from '../testing/inkedWashes';
import { PALETTE } from './palette';

describe('palette', () => {
  it("mirrors art/inked/style.mjs's WASHES entry of the same name, each one", () => {
    const washes = inkedWashes();
    // The table is read: its first material and the lawn's, which the world does not mirror, are there.
    expect(washes.wall).toBe(0xeee2c8);
    expect(washes.outside).toBe(0x96b876);
    for (const [name, colour] of Object.entries(PALETTE)) expect(washes[name], name).toBe(colour);
  });

  it('pins the season washes and keeps the particles at the prototype colours', () => {
    expect([PALETTE.lawnSpring, PALETTE.lawnAutumn, PALETTE.frost]).toEqual([
      0xc8e296, 0xc88c50, 0xecf0f4,
    ]);
    expect([PALETTE.petal, PALETTE.petalDeep, PALETTE.petalPale]).toEqual([
      0xffd6e0, 0xffbed4, 0xfae2e9,
    ]);
    expect([PALETTE.firefly, PALETTE.fireflyPale]).toEqual([0xd6f08c, 0xe8f6a5]);
    expect([PALETTE.leafRed, PALETTE.leafOrange, PALETTE.leafRust, PALETTE.leafOchre]).toEqual([
      0xd25a28, 0xe68c28, 0xb2441e, 0xa0702a,
    ]);
    expect([PALETTE.snow, PALETTE.snowShade]).toEqual([0xffffff, 0xe2ecf6]);
    expect(PALETTE.mote).toBe(0xe8e2c8);
  });
});
