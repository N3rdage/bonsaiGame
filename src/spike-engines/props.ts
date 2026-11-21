/**
 * The trees and hedges of the heavy engine spike (backlog #391) as plain
 * data: a fixed few standing in the garden, then as many more as the stress
 * test asks for, spiralling out across the meadow beyond the fences. Each is
 * a site position, a yaw and a scale; the engine pages draw every tree from
 * one instanced mesh and every hedge from another, `propMatrices` being the
 * instance transforms. Pure and deterministic.
 */

export type PropKind = 'tree' | 'hedge';

export interface PropSite {
  readonly kind: PropKind;
  /** Site metres: x east, y south. */
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  readonly scale: number;
}

/** The trees and hedges that are always in the garden, kept off the benchmark's route. */
const GARDEN: readonly PropSite[] = [
  { kind: 'tree', x: 2.5, y: -2, yaw: 0.4, scale: 1.1 },
  { kind: 'tree', x: 11, y: -2.4, yaw: 2.1, scale: 0.9 },
  { kind: 'tree', x: 10.5, y: 11.5, yaw: 1.2, scale: 1.2 },
  { kind: 'tree', x: 4, y: 13.5, yaw: 3.3, scale: 1 },
  { kind: 'tree', x: 12.6, y: 14.2, yaw: 5.1, scale: 0.8 },
  { kind: 'hedge', x: 4.6, y: -1, yaw: 0, scale: 1 },
  { kind: 'hedge', x: 9.6, y: -1.1, yaw: 0, scale: 1 },
  { kind: 'hedge', x: 7.2, y: 15.2, yaw: 0, scale: 1.3 },
  { kind: 'hedge', x: 13.8, y: 11.5, yaw: Math.PI / 2, scale: 1 },
];

/** How many trees and hedges the garden itself holds. */
export const GARDEN_PROPS = GARDEN.length;

/** The most props any run draws: the garden's and every stress step's. */
export const MAX_PROPS = 300;

/** The garden and its fences, with a margin: the spiral keeps outside it. */
const KEEP_OUT = { x0: -6, x1: 17, y0: -9, y1: 18.5 } as const;
const CENTRE = { x: 5.5, y: 4.5 } as const;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SPACING = 2.7;

/** A repeatable number in 0..1 for `i`. */
function unit(i: number, salt: number): number {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function buildProps(): readonly PropSite[] {
  const out: PropSite[] = [...GARDEN];
  for (let k = 0; out.length < MAX_PROPS; k++) {
    const angle = k * GOLDEN_ANGLE;
    const radius = SPACING * Math.sqrt(k + 20);
    const x = CENTRE.x + radius * Math.cos(angle);
    const y = CENTRE.y + radius * Math.sin(angle);
    if (x > KEEP_OUT.x0 && x < KEEP_OUT.x1 && y > KEEP_OUT.y0 && y < KEEP_OUT.y1) continue;
    const j = out.length - GARDEN.length;
    out.push({
      kind: j % 5 < 3 ? 'tree' : 'hedge',
      x,
      y,
      yaw: unit(j, 1) * Math.PI * 2,
      scale: 0.8 + unit(j, 2) * 0.5,
    });
  }
  return out;
}

/** Every prop a run can show; the first `n` are the ones shown at load `n`. */
export const PROPS: readonly PropSite[] = buildProps();

/** How many of the first `n` props are trees and how many hedges. */
export function splitProps(n: number): { trees: number; hedges: number } {
  const shown = PROPS.slice(0, Math.min(n, PROPS.length));
  const trees = shown.filter((p) => p.kind === 'tree').length;
  return { trees, hedges: shown.length - trees };
}

/**
 * The instance transforms of every prop of one kind, in order, as 4 x 4
 * column-major matrices in the render frame (scene.ts `toRender`): scaled,
 * turned about the vertical and moved to the prop's site. Three's
 * InstancedMesh and Babylon's thin instances both take this layout.
 */
export function propMatrices(kind: PropKind): Float32Array {
  const sites = PROPS.filter((p) => p.kind === kind);
  const out = new Float32Array(sites.length * 16);
  sites.forEach((p, i) => {
    const c = Math.cos(p.yaw) * p.scale;
    const s = Math.sin(p.yaw) * p.scale;
    out.set([c, 0, -s, 0, 0, p.scale, 0, 0, s, 0, c, 0, p.x, 0, p.y, 1], i * 16);
  });
  return out;
}
