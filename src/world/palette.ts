/**
 * The Inked palette entries the world draws with at runtime, as 0xRRGGBB:
 * each mirrors the `WASHES` entry of the same name in art/inked/style.mjs,
 * where the art's colours live. The gardens' season washes (roomArt's
 * `seasonWash`) and the weather's particles (weather.ts) read them here.
 */
export const PALETTE = {
  /** The gardens' season washes: WASHES.lawnSpring, lawnAutumn, frost. */
  lawnSpring: 0xc8e296,
  lawnAutumn: 0xc88c50,
  frost: 0xecf0f4,
  /** Spring's petals: WASHES.petal, petalDeep, petalPale. */
  petal: 0xffd6e0,
  petalDeep: 0xffbed4,
  petalPale: 0xfae2e9,
  /** Summer's fireflies: WASHES.firefly, fireflyPale. */
  firefly: 0xd6f08c,
  fireflyPale: 0xe8f6a5,
  /** Autumn's leaves: WASHES.leafRed, leafOrange, leafRust, leafOchre. */
  leafRed: 0xd25a28,
  leafOrange: 0xe68c28,
  leafRust: 0xb2441e,
  leafOchre: 0xa0702a,
  /** Winter's snow: WASHES.snow, snowShade. */
  snow: 0xffffff,
  snowShade: 0xe2ecf6,
  /** The indoor rooms' dust motes: WASHES.mote. */
  mote: 0xe8e2c8,
} as const;
