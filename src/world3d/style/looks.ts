/**
 * Backlog #446 (style frames, throwaway): each take's palette, light and
 * avatar, as pure data. A take is a palette (the lounge's colour keys and
 * the surfaces'), a texture hand ('paper' for the Inked papercraft, 'paint'
 * for brushwork, 'felt' for the stitched miniature), a light ramp, an ink
 * weight, and a day and a dusk light rig.
 */

import { part, type Part } from '../character';
import type { Take, TimeOfDay } from './params';

export type Hand = 'paper' | 'paint' | 'felt';

export interface LightRig {
  /** The sun's colour and strength through the ramp. */
  readonly sun: number;
  readonly sunPower: number;
  /** The fill from above and below (a hemisphere), so shadows take a hue rather than grey. */
  readonly skyFill: number;
  readonly groundFill: number;
  /** The fire, the lamp and the candles: colour and strength (0 off). */
  readonly fire: number;
  readonly firePower: number;
  readonly lamp: number;
  readonly lampPower: number;
  /** The window's sky colour, and the sunlit patch it throws on the floor (0 none). */
  readonly sky: number;
  readonly patch: number;
  /** The lampshade lit from inside. */
  readonly shade: number;
  readonly clear: number;
  readonly exposure: number;
  readonly contrast: number;
  readonly vignette: number;
}

export interface Look {
  readonly take: Take;
  readonly name: string;
  readonly hand: Hand;
  /** Ramp levels, darkest first, across N.L from -1 to 1; `soft` blends between them. */
  readonly ramp: readonly number[];
  readonly soft: number;
  readonly inkPx: number;
  readonly ink: number;
  readonly colours: Readonly<Record<string, number>>;
  readonly walls: {
    readonly paper: number;
    readonly motif: number;
    readonly wainscot: number;
    readonly rail: number;
    readonly skirting: number;
  };
  readonly floor: { readonly plank: number; readonly gap: number; readonly worn: number };
  readonly tiles: { readonly tile: number; readonly grout: number };
  readonly rug: readonly [number, number, number, number];
  readonly day: LightRig;
  readonly dusk: LightRig;
  readonly avatar: readonly Part[];
}

/** Shared by every take: the things whose colour is their nature (fire, fruit, books). */
const COMMON: Readonly<Record<string, number>> = {
  white: 0xffffff,
  flame: 0xff9a3c,
  flameCore: 0xffe9a0,
  soot: 0x2e2622,
  log: 0x8a5a3a,
  bark: 0x6e4a34,
  soil: 0x4a3426,
  brass: 0xc8a050,
  copper: 0xc87850,
  ink: 0x3a2c28,
  bread: 0xd8a060,
  fruit1: 0xe05a3a,
  fruit2: 0xf0c040,
  fruit3: 0xf0d860,
  cat: 0xe0904a,
  catDark: 0xb86a34,
  cream: 0xf6ecd6,
};

type Rgb = readonly [number, number, number];
const rgb = (hex: number): Rgb => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

/**
 * The gardener: a big round head under a straw sun hat, a fringe of hair,
 * dot eyes and rosy cheeks, a neckerchief, rolled sleeves, a canvas apron
 * with a pocket and a trowel in it, and boots. The skeleton is the game's
 * (character.ts); only the shapes and colours are the take's.
 */
function gardener(c: {
  skin: number;
  hair: number;
  hat: number;
  band: number;
  shirt: number;
  apron: number;
  trousers: number;
  boots: number;
  scarf: number;
  cheek: number;
  eye: number;
}): Part[] {
  const S = rgb(c.skin);
  const H = rgb(c.hair);
  return [
    // Legs and boots, a touch short and sturdy.
    part('hips', [0, 0.92, 0], [0.19, 0.14, 0.15], rgb(c.trousers)),
    part('legL', [-0.1, 0.5, 0], [0.085, 0.09, 0.085], rgb(c.trousers), 0.24),
    part('legR', [0.1, 0.5, 0], [0.085, 0.09, 0.085], rgb(c.trousers), 0.24),
    part('legL', [-0.1, 0.12, 0.01], [0.095, 0.1, 0.1], rgb(c.boots)),
    part('legR', [0.1, 0.12, 0.01], [0.095, 0.1, 0.1], rgb(c.boots)),
    part('legL', [-0.1, 0.05, 0.05], [0.1, 0.055, 0.15], rgb(c.boots)),
    part('legR', [0.1, 0.05, 0.05], [0.1, 0.055, 0.15], rgb(c.boots)),
    // A round body, the apron over its front and the pocket's trowel.
    part('spine', [0, 1.18, 0], [0.22, 0.2, 0.16], rgb(c.shirt), 0.05),
    part('spine', [0, 1.12, 0.085], [0.19, 0.22, 0.09], rgb(c.apron), 0.04),
    part('hips', [0, 0.86, 0.1], [0.18, 0.12, 0.07], rgb(c.apron)),
    part('hips', [0.07, 0.86, 0.16], [0.07, 0.05, 0.02], rgb(c.apron)),
    part('hips', [0.09, 0.95, 0.16], [0.015, 0.06, 0.015], rgb(COMMON.log ?? 0)),
    part('spine', [0, 1.38, 0.04], [0.14, 0.05, 0.12], rgb(c.scarf)),
    part('spine', [0.04, 1.31, 0.13], [0.04, 0.06, 0.02], rgb(c.scarf)),
    // Arms: sleeves rolled to the elbow, bare forearms, round hands.
    part('armL', [-0.27, 1.25, 0], [0.075, 0.08, 0.075], rgb(c.shirt), 0.05),
    part('armR', [0.27, 1.25, 0], [0.075, 0.08, 0.075], rgb(c.shirt), 0.05),
    part('armL', [-0.28, 1.0, 0], [0.05, 0.05, 0.05], S, 0.1),
    part('armR', [0.28, 1.0, 0], [0.05, 0.05, 0.05], S, 0.1),
    part('armL', [-0.285, 0.85, 0.01], [0.06, 0.065, 0.06], S),
    part('armR', [0.285, 0.85, 0.01], [0.06, 0.065, 0.06], S),
    // The head: big and round, so the face reads at phone size.
    part('head', [0, 1.68, 0], [0.2, 0.2, 0.19], S),
    part('head', [-0.2, 1.67, 0], [0.04, 0.05, 0.035], S),
    part('head', [0.2, 1.67, 0], [0.04, 0.05, 0.035], S),
    part('head', [0, 1.665, 0.19], [0.03, 0.025, 0.03], S),
    part('head', [-0.078, 1.69, 0.17], [0.034, 0.046, 0.024], rgb(c.eye)),
    part('head', [0.078, 1.69, 0.17], [0.034, 0.046, 0.024], rgb(c.eye)),
    part('head', [-0.12, 1.635, 0.155], [0.04, 0.025, 0.02], rgb(c.cheek)),
    part('head', [0.12, 1.635, 0.155], [0.04, 0.025, 0.02], rgb(c.cheek)),
    // Hair: a cap over the back, a fringe and a little tail.
    part('head', [0, 1.73, -0.03], [0.205, 0.17, 0.19], H),
    part('head', [0, 1.765, 0.13], [0.17, 0.05, 0.07], H),
    part('head', [0, 1.6, -0.19], [0.07, 0.09, 0.06], H),
    // A knotted headscarf over the crown, its tails at the back, a sprig tucked in it, and a bun.
    part('head', [0, 1.8, -0.02], [0.215, 0.1, 0.205], rgb(c.band)),
    part('head', [0, 1.77, -0.215], [0.06, 0.045, 0.05], rgb(c.band)),
    part('head', [0.04, 1.7, -0.25], [0.035, 0.07, 0.025], rgb(c.band)),
    part('head', [-0.04, 1.7, -0.25], [0.035, 0.07, 0.025], rgb(c.band)),
    part('head', [0.15, 1.87, 0.06], [0.03, 0.05, 0.02], rgb(c.hat)),
    part('head', [0.17, 1.9, 0.05], [0.025, 0.04, 0.02], rgb(0x7ab85a)),
    part('head', [0, 1.92, -0.08], [0.09, 0.07, 0.09], H),
  ];
}

const DAY_A: LightRig = {
  sun: 0xfff0d2,
  sunPower: 0.62,
  skyFill: 0xb8c4e0,
  groundFill: 0x9a7890,
  fire: 0xff9a4a,
  firePower: 0.55,
  lamp: 0xffc070,
  lampPower: 0,
  sky: 0xcfe6f2,
  patch: 0.32,
  shade: 0xf2dcae,
  clear: 0x2e2420,
  exposure: 1.05,
  contrast: 1.08,
  vignette: 1.4,
};

const DUSK_A: LightRig = {
  sun: 0xff9a78,
  sunPower: 0.16,
  skyFill: 0x5a5c94,
  groundFill: 0x4a3050,
  fire: 0xff8a3a,
  firePower: 1.5,
  lamp: 0xffb45a,
  lampPower: 1.25,
  sky: 0x48508c,
  patch: 0,
  shade: 0xffd690,
  clear: 0x1a1420,
  exposure: 1.0,
  contrast: 1.12,
  vignette: 2.6,
};

export const LOOKS: Readonly<Record<Take, Look>> = {
  a: {
    take: 'a',
    name: 'Inked papercraft',
    hand: 'paper',
    ramp: [0.58, 0.78, 1.0],
    soft: 0.04,
    inkPx: 2.2,
    ink: 0x2f2226,
    colours: {
      ...COMMON,
      wood: 0xc08a5c,
      woodDark: 0x8e5c3c,
      woodLight: 0xdcb07c,
      sofa: 0x5f8f86,
      sofaLight: 0x76a69a,
      cushionA: 0xe8b24c,
      cushionB: 0xd2694a,
      throw: 0xe8d6b0,
      chair: 0xc96a4a,
      chairLight: 0xdc8460,
      shade: 0xf2dcae,
      ceramic: 0xf2ead8,
      ceramicB: 0x6a8cb4,
      glaze: 0x3c6e8c,
      terracotta: 0xc8704a,
      leaf: 0x5a9a4a,
      leafLight: 0x84b856,
      leafDark: 0x3e7a44,
      stone: 0xb8aea0,
      frame: 0xc89c48,
      frameDark: 0x5a3c2c,
      curtain: 0xe4c27a,
      curtainDark: 0xcca460,
      sill: 0xf4ecdc,
      sky: 0xcfe6f2,
      flower: 0xf07a8a,
      book1: 0xb84a3a,
      book2: 0x3a6a8a,
      book3: 0xe0b450,
      book4: 0x5a8a5a,
      book5: 0x8a5a8a,
      wicker: 0xc8a06a,
      cabinet: 0x8cae9a,
      cabinetLight: 0x9cbea8,
      towel: 0xe86a5a,
      jar: 0xf0e6cc,
      jarB: 0xd8885a,
      door: 0xe8dcc4,
      doorDark: 0xd8c8a8,
      coat: 0x4a6a8a,
    },
    walls: {
      paper: 0xf2e4c8,
      motif: 0x9cb48c,
      wainscot: 0x7fa08a,
      rail: 0xa87a52,
      skirting: 0x7a5236,
    },
    floor: { plank: 0xc8945e, gap: 0x5a3a28, worn: 0xdcb07c },
    tiles: { tile: 0xc4704a, grout: 0xe8d8c0 },
    rug: [0xb8473a, 0xf0dcb0, 0x2e4a6a, 0xe0a040],
    day: DAY_A,
    dusk: DUSK_A,
    avatar: gardener({
      skin: 0xf0c09a,
      hair: 0x6a3a26,
      hat: 0xf0cc78,
      band: 0xd2563c,
      shirt: 0xf4ead4,
      apron: 0x4a7a68,
      trousers: 0x5a5470,
      boots: 0x6a4030,
      scarf: 0xe0a83c,
      cheek: 0xf09080,
      eye: 0x2a1e1e,
    }),
  },
  b: {
    take: 'b',
    name: 'Painterly',
    hand: 'paint',
    ramp: [0.5, 0.74, 1.0],
    soft: 0.45,
    inkPx: 1.4,
    ink: 0x2a2030,
    colours: {
      ...COMMON,
      wood: 0xb07a4a,
      woodDark: 0x7a4a30,
      woodLight: 0xd4a46a,
      sofa: 0xb85a48,
      sofaLight: 0xcc7058,
      cushionA: 0xe8c060,
      cushionB: 0x4a7a8a,
      throw: 0xf0e0c0,
      chair: 0x5a8a6a,
      chairLight: 0x6e9e7a,
      shade: 0xf6e0b0,
      ceramic: 0xf4ecdc,
      ceramicB: 0x4a7a9a,
      glaze: 0x2e6a7a,
      terracotta: 0xc4643e,
      leaf: 0x4a8a3e,
      leafLight: 0x7aae4a,
      leafDark: 0x2e6a3a,
      stone: 0xb4a898,
      frame: 0xc8a050,
      frameDark: 0x4a3020,
      curtain: 0xf0dcb0,
      curtainDark: 0xd8c098,
      sill: 0xf0e6d0,
      sky: 0xd8eef8,
      flower: 0xf06a7a,
      book1: 0xa83a30,
      book2: 0x2e5a7a,
      book3: 0xe0a840,
      book4: 0x4a7a4a,
      book5: 0x7a4a7a,
      wicker: 0xc49a60,
      cabinet: 0xe8dcc0,
      cabinetLight: 0xf2e8d0,
      towel: 0x4a7aa0,
      jar: 0xf2e8d0,
      jarB: 0xc87048,
      door: 0xe0d2b4,
      doorDark: 0xccbc98,
      coat: 0xa84a3a,
    },
    walls: {
      paper: 0x4f7a64,
      motif: 0x6a9478,
      wainscot: 0xe6d8b8,
      rail: 0x9a6a44,
      skirting: 0x6a4630,
    },
    floor: { plank: 0xb4804e, gap: 0x4a2e20, worn: 0xd0a070 },
    tiles: { tile: 0xd8cbb0, grout: 0x9a8a74 },
    rug: [0x2e4a6a, 0xf0dcb0, 0xb8473a, 0xe0a040],
    day: {
      ...DAY_A,
      sun: 0xffe6b4,
      sunPower: 0.7,
      skyFill: 0x8aa4d4,
      groundFill: 0x7a5a74,
      sky: 0xd8eef8,
      patch: 0.4,
      contrast: 1.1,
      vignette: 1.8,
    },
    dusk: {
      ...DUSK_A,
      skyFill: 0x4a5490,
      groundFill: 0x3a2448,
      firePower: 1.7,
      lampPower: 1.4,
      vignette: 3,
    },
    avatar: gardener({
      skin: 0xeab48c,
      hair: 0x2e2a2e,
      hat: 0xe8c470,
      band: 0x3a6a8a,
      shirt: 0xd2604a,
      apron: 0xe8d8b4,
      trousers: 0x3a4a6a,
      boots: 0x5a3828,
      scarf: 0xf0d080,
      cheek: 0xf08070,
      eye: 0x1e1a1e,
    }),
  },
  c: {
    take: 'c',
    name: 'Felt miniature',
    hand: 'felt',
    ramp: [0.55, 0.8, 1.0],
    soft: 0.8,
    inkPx: 0,
    ink: 0x3a2c30,
    colours: {
      ...COMMON,
      wood: 0xd4a070,
      woodDark: 0xa8724c,
      woodLight: 0xe8c08c,
      sofa: 0xe8a0a0,
      sofaLight: 0xf2b4ae,
      cushionA: 0xf4d27a,
      cushionB: 0x8cc4c0,
      throw: 0xfaf0dc,
      chair: 0x8cb8d8,
      chairLight: 0xa4cce4,
      shade: 0xfae8c0,
      ceramic: 0xfaf4e8,
      ceramicB: 0x88b4d8,
      glaze: 0x5a9ab4,
      terracotta: 0xe48c64,
      leaf: 0x78b866,
      leafLight: 0xa0d27c,
      leafDark: 0x5a9a5a,
      stone: 0xd8d0c4,
      frame: 0xf0c870,
      frameDark: 0x8a6450,
      curtain: 0xfae0a0,
      curtainDark: 0xf0cc88,
      sill: 0xfaf4e8,
      sky: 0xd4ecf8,
      flower: 0xf88aa0,
      book1: 0xe87a6a,
      book2: 0x6aa4c8,
      book3: 0xf4cc6a,
      book4: 0x88c088,
      book5: 0xb48ac8,
      wicker: 0xe0bc88,
      cabinet: 0xa8d0c0,
      cabinetLight: 0xbcdccc,
      towel: 0xf09a8a,
      jar: 0xfaf0dc,
      jarB: 0xf0a07a,
      door: 0xf4ead4,
      doorDark: 0xe8dcc0,
      coat: 0x7a9ac8,
    },
    walls: {
      paper: 0xf8e8d0,
      motif: 0xf0c8b8,
      wainscot: 0xa8d0c0,
      rail: 0xe0b48c,
      skirting: 0xc89870,
    },
    floor: { plank: 0xe0b080, gap: 0xa0704c, worn: 0xecc898 },
    tiles: { tile: 0xf0e4d0, grout: 0xd0c0a8 },
    rug: [0xf09a8a, 0xfaf0dc, 0x8cb8d8, 0xf4cc6a],
    day: {
      ...DAY_A,
      sun: 0xfff4e0,
      sunPower: 0.5,
      skyFill: 0xd8dcf0,
      groundFill: 0xc8a8b4,
      sky: 0xd4ecf8,
      patch: 0.28,
      clear: 0x3a3038,
      contrast: 1.0,
      vignette: 2.2,
    },
    dusk: {
      ...DUSK_A,
      skyFill: 0x7074b0,
      groundFill: 0x604868,
      firePower: 1.3,
      lampPower: 1.1,
      clear: 0x201a28,
      vignette: 3,
    },
    avatar: gardener({
      skin: 0xf8cca8,
      hair: 0xa0583a,
      hat: 0xf8dc90,
      band: 0xf08a8a,
      shirt: 0xfaf0dc,
      apron: 0x88c0b0,
      trousers: 0x8890c0,
      boots: 0xa8684c,
      scarf: 0xf4c46a,
      cheek: 0xf8a090,
      eye: 0x3a2a2a,
    }),
  },
};

export function rigOf(look: Look, time: TimeOfDay): LightRig {
  return time === 'dusk' ? look.dusk : look.day;
}
