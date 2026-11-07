/**
 * Traditional bonsai styles. The player picks a target style per tree
 * (BonsaiTree.targetStyle), and the scorer feeds the tree into the style's
 * `score(tree)` function as one weighted criterion.
 *
 * Each style's `score(tree)` returns a 0..1 conformance value. Trunk-shape
 * styles (informal_upright, slanting, cascade) read the trunk's curve via
 * trunkFrames(tree), the same parallel-transported frame walk that drives the
 * renderer, so what the player sees IS what they're scored on.
 *
 * Ported from archive/gamemaker/scripts/scr_styles_data/scr_styles_data.gml.
 */

import type { BonsaiTree, Style, StyleKey } from './types';
import { DISPLAY_SCALE, trunkFrames } from './geometry';
import { clamp, darccos, dcos, degToRad } from './vec3';

/** Lean from vertical, in degrees, of a tangent's z component. */
function leanDeg(tangentZ: number): number {
  return darccos(clamp(tangentZ, -1, 1));
}

export const STYLE_KEYS: readonly StyleKey[] = [
  'formal_upright',
  'informal_upright',
  'slanting',
  'cascade',
  'broom',
  'windswept',
];

export const STYLES: Record<StyleKey, Style> = {
  formal_upright: {
    key: 'formal_upright',
    displayName: 'Formal Upright (Chokkan)',
    description: 'Straight vertical trunk; branches alternating evenly.',
    score(tree: BonsaiTree): number {
      // Reward consecutive branches (sorted by height) that point in
      // opposite directions.
      const n = tree.branches.length;
      if (n < 2) return 0.5;

      const sorted = [...tree.branches].sort((a, b) => a.originY - b.originY);

      let sum = 0;
      for (let i = 0; i < n - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a === undefined || b === undefined) continue;
        let diff = Math.abs(a.angle - b.angle);
        diff = Math.min(diff, 360 - diff); // shortest arc, [0..180]
        sum += diff / 180; // 1.0 when opposite, 0 when same dir
      }
      return sum / (n - 1);
    },
  },
  informal_upright: {
    key: 'informal_upright',
    displayName: 'Informal Upright (Moyogi)',
    description: 'Gently curved trunk; the most natural form.',
    score(tree: BonsaiTree): number {
      // Reward visible curve along the trunk that returns to vertical at the
      // apex: the S-curve silhouette of a Moyogi. Two factors multiplied:
      //  - max lean along the trunk peaks at ~25 degrees (gentle curve)
      //  - apex lean stays near vertical
      const frames = trunkFrames(tree);
      const apex = frames[frames.length - 1];
      if (frames.length < 2 || apex === undefined) return 0;
      let maxLean = 0;
      for (const frame of frames) {
        const l = leanDeg(frame.tangent.z);
        if (l > maxLean) maxLean = l;
      }
      const apexLean = leanDeg(apex.tangent.z);
      const curveScore = Math.max(0, 1 - Math.abs(maxLean - 25) / 25);
      const uprightScore = Math.max(0, 1 - apexLean / 30);
      return curveScore * uprightScore;
    },
  },
  slanting: {
    key: 'slanting',
    displayName: 'Slanting (Shakan)',
    description: 'Trunk leans noticeably to one side.',
    score(tree: BonsaiTree): number {
      // Reward an apex that leans in the 25..45 degree band, with bend
      // events all pointing the same direction (no S-curve).
      const frames = trunkFrames(tree);
      const apex = frames[frames.length - 1];
      if (frames.length < 2 || apex === undefined) return 0;
      const apexLean = leanDeg(apex.tangent.z);

      // Plateau 25..45 degrees, falls off outside.
      const leanScore = Math.max(0, 1 - Math.max(Math.abs(apexLean - 35) - 10, 0) / 30);

      // Direction consistency: cosine-mean of bend-event angles relative to
      // the first event. 1 = perfectly aligned, 0 or negative = scattered or
      // reversing.
      const movement = tree.trunk.movement;
      const firstEvent = movement[0];
      if (firstEvent === undefined) return 0;
      const ref = firstEvent.angleDeg;
      let consistent = 0;
      for (const ev of movement) {
        consistent += dcos(ev.angleDeg - ref);
      }
      const consistency = Math.max(0, consistent / movement.length);

      return leanScore * consistency;
    },
  },
  cascade: {
    key: 'cascade',
    displayName: 'Cascade (Kengai)',
    description: "Main growth descends below the pot's rim.",
    score(tree: BonsaiTree): number {
      // Reward the trunk tip dropping below the base. Full marks at a drop
      // equal to ~half the trunk's arc length below the base (a textbook
      // Kengai descent). Linear scale below that.
      const frames = trunkFrames(tree);
      const base = frames[0];
      const apex = frames[frames.length - 1];
      if (frames.length < 2 || base === undefined || apex === undefined) return 0;
      const drop = base.pos.z - apex.pos.z;
      if (drop <= 0) return 0;
      const arc = (tree.trunk.heightCm / 100) * DISPLAY_SCALE;
      if (arc <= 0) return 0;
      return clamp(drop / (arc * 0.5), 0, 1);
    },
  },
  broom: {
    key: 'broom',
    displayName: 'Broom (Hokidachi)',
    description: 'Straight trunk fans into a dome of branches.',
    score(tree: BonsaiTree): number {
      const n = tree.branches.length;
      if (n === 0 || tree.trunk.heightCm <= 0) return 0;

      // Two factors, multiplied: branches in the upper third of the trunk,
      // and a wide radial spread of angles.
      let upper = 0;
      let sx = 0;
      let sy = 0;
      for (const branch of tree.branches) {
        const t = branch.originY / tree.trunk.heightCm;
        if (t >= 0.66) upper += 1;
        const a = degToRad(branch.angle);
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
      const upperFrac = upper / n;
      const r = Math.sqrt(sx * sx + sy * sy) / n;
      const spread = 1 - r; // 1 = wide, 0 = bunched
      return upperFrac * spread;
    },
  },
  windswept: {
    key: 'windswept',
    displayName: 'Windswept (Fukinagashi)',
    description: 'All growth swept in one direction.',
    score(tree: BonsaiTree): number {
      const n = tree.branches.length;
      if (n < 2) return 0.5;

      let sx = 0;
      let sy = 0;
      for (const branch of tree.branches) {
        const a = degToRad(branch.angle);
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
      // Mean resultant length: 1 = perfectly aligned, 0 = scattered.
      return Math.sqrt(sx * sx + sy * sy) / n;
    },
  },
};

export function getStyle(key: StyleKey): Style {
  return STYLES[key];
}

/** Lookup by an untrusted string (e.g. a save's targetStyle); undefined when unknown. */
export function findStyle(key: string): Style | undefined {
  return STYLE_KEYS.includes(key as StyleKey) ? STYLES[key as StyleKey] : undefined;
}
