/**
 * Aesthetic scoring for a BonsaiTree. Returns a 0..100 total plus a
 * per-criterion breakdown so the inspector can show what helped and hurt.
 * Scoring is derived from morphology and never persisted: recompute on demand.
 *
 * Ported from archive/gamemaker/scripts/scr_scoring/scr_scoring.gml.
 * The prototype skipped the style criterion for styles without a `score`
 * function; every ported style has one, so only an unset target is skipped.
 */

import { findStyle } from './styles';
import type { BonsaiTree, ScoreCriterion, TreeScore } from './types';
import { degToRad } from './vec3';

/** Gaussian falloff: 1.0 at target, decays with distance. */
export function scoreGauss(value: number, target: number, sigma: number): number {
  const d = value - target;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

/** Band score: 1.0 inside [lo, hi], linear falloff to 0 over `falloff` units. */
export function scoreBand(value: number, lo: number, hi: number, falloff: number): number {
  if (value >= lo && value <= hi) return 1.0;
  if (value < lo) return Math.max(0, 1 - (lo - value) / falloff);
  return Math.max(0, 1 - (value - hi) / falloff);
}

interface RawCriterion {
  label: string;
  value: number;
  weight: number;
}

export function scoreTree(tree: BonsaiTree): TreeScore {
  const crits: RawCriterion[] = [];
  const branches = tree.branches;
  const n = branches.length;

  // 1. Trunk taper: classical bonsai taper sits around 0.6.
  crits.push({ label: 'Trunk taper', value: scoreGauss(tree.trunk.taper, 0.6, 0.2), weight: 1.0 });

  // 2. Trunk proportion: height (cm) * 10 / girth (mm) should be 6-10.
  const ratio = tree.trunk.girthMm > 0 ? (tree.trunk.heightCm * 10) / tree.trunk.girthMm : 999;
  crits.push({ label: 'Trunk proportion', value: scoreBand(ratio, 6, 10, 5), weight: 1.0 });

  // 3. Branch count: sweet spot 3-7.
  crits.push({ label: 'Branch count', value: scoreBand(n, 3, 7, 4), weight: 1.0 });

  // 4. Angular spread: 1 - mean resultant length of the angle unit vectors.
  let vAng = 0;
  if (n > 0) {
    let sx = 0;
    let sy = 0;
    for (const b of branches) {
      const a = degToRad(b.angle);
      sx += Math.cos(a);
      sy += Math.sin(a);
    }
    vAng = 1 - Math.sqrt(sx * sx + sy * sy) / n;
  }
  crits.push({ label: 'Angular spread', value: vAng, weight: 1.0 });

  // 5. Vertical spread: std dev of originY / trunk height, sweet spot ~0.3.
  let vVert = 0;
  if (n >= 2 && tree.trunk.heightCm > 0) {
    const h = tree.trunk.heightCm;
    let mean = 0;
    for (const b of branches) mean += b.originY / h;
    mean /= n;
    let variance = 0;
    for (const b of branches) {
      const d = b.originY / h - mean;
      variance += d * d;
    }
    vVert = scoreGauss(Math.sqrt(variance / n), 0.3, 0.15);
  } else if (n === 1) {
    vVert = 0.3;
  }
  crits.push({ label: 'Vertical spread', value: vVert, weight: 1.0 });

  // 6. Foliage band: healthy density 0.3-0.7.
  crits.push({
    label: 'Foliage',
    value: scoreBand(tree.foliageDensity, 0.3, 0.7, 0.3),
    weight: 1.0,
  });

  // 7. Style conformance, only when a target style is set. The label drops the
  //    parenthetical Japanese name so it fits the breakdown column.
  //    An unknown key (stale save) is skipped, as the prototype skipped a style
  //    without a scorer, rather than crashing the whole score.
  const style = tree.targetStyle === '' ? undefined : findStyle(tree.targetStyle);
  if (style !== undefined) {
    const paren = style.displayName.indexOf(' (');
    const short = paren >= 0 ? style.displayName.slice(0, paren) : style.displayName;
    crits.push({ label: `Style: ${short}`, value: style.score(tree), weight: 1.5 });
  }

  let sum = 0;
  let wsum = 0;
  for (const c of crits) {
    sum += c.value * c.weight;
    wsum += c.weight;
  }
  const base = wsum > 0 ? sum / wsum : 0;

  // Vitality multiplier: a sickly tree caps the score.
  const vitMult = tree.vitality / 100;
  const total = base * vitMult * 100;

  const breakdown: ScoreCriterion[] = crits.map((c) => ({
    label: c.label,
    value: c.value,
    weight: c.weight,
    points: ((c.value * c.weight) / wsum) * 100 * vitMult,
    isMultiplier: false,
  }));
  breakdown.push({ label: 'Vitality', value: vitMult, weight: 0, points: 0, isMultiplier: true });

  return { total: Math.floor(total), breakdown };
}
