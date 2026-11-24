/**
 * The Inked palette entries the world draws with at runtime, as 0xRRGGBB:
 * each mirrors the `WASHES` entry of the same name in art/inked/style.mjs,
 * where the art's colours live. The gardens' season washes (roomArt's
 * `seasonWash`), the cast shadows' wash and the weather's particles
 * (weather.ts) read them here.
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
  /** The cast shadows on every room's floor (roomArt's `castShadows`): WASHES.shadow. */
  shadow: 0x6e5e50,
  /** The surfaces of the 3D plan (world3d/plan.ts): WASHES.wall, floor, wood, stone, soil. */
  wall: 0xeee2c8,
  floor: 0xba8c62,
  wood: 0x966440,
  stone: 0xc4c2bc,
  soil: 0x78604e,
  /** The gardens' lawn and the buildings seen from them: WASHES.outside, render, tile, paint, asphalt. */
  outside: 0x96b876,
  render: 0xd6c6b0,
  tile: 0xb8745c,
  paint: 0xccd0c8,
  asphalt: 0x6c6c6e,
  /** The house rooms' floors, wall coverings and runner: WASHES.carpet, wallpaper, runner, studyPaper, parquet. */
  carpet: 0xa8806e,
  wallpaper: 0xc4ceb2,
  runner: 0x4c805c,
  studyPaper: 0xb8c4d0,
  parquet: 0xb27456,
  /** The garden's source plants' foliage: WASHES.foliage (the juniper's summer), mapleSummer, pineSummer. */
  foliage: 0x589654,
  mapleSummer: 0x467e46,
  pineSummer: 0x508068,
} as const;
