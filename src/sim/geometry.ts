/**
 * Trunk and branch curve geometry, in display units (sim cm scaled by
 * DISPLAY_SCALE). This is the single source of truth for tree shape: the
 * renderer, the trunk hotspot UI and the trunk-shape style scorers all read
 * from here, so what the player sees is what they are scored on. Don't write a
 * parallel curve derivation; call these.
 *
 * Ported from archive/gamemaker/scripts/scr_bonsai_mesh/scr_bonsai_mesh.gml:
 * the macros at the top plus trunk_frames, trunk_frame_at, branch_point and
 * branch_frame_at. The vertex-buffer mesh builder itself is not ported here.
 */

import type { BonsaiTree, Branch, Frame, TrunkMovement, Vec3 } from './types';
import { clamp, dcos, dsin, vec3, vec3Normalize, vec3Rotate } from './vec3';

/** 1 sim cm renders as 4 viewer units. */
export const DISPLAY_SCALE = 4;
/** Degrees of tangent deflection per trunk-wire click. */
export const TRUNK_BEND_PER_EVENT = 20;
/** Degrees of bend added per branch-wire click. */
export const BRANCH_BEND_PER_CLICK = 15;

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/**
 * Sample N+1 parallel-transported frames along the trunk's curve. Frame i has
 * { pos, tangent, normal, binormal }, an orthonormal right-handed basis where
 * tangent is the trunk's local "up" direction. The starting tangent is world
 * +z; each `trunk.movement` event below the current sample height deflects the
 * tangent (and the whole frame, via Rodrigues) by TRUNK_BEND_PER_EVENT degrees
 * toward (cos angleDeg, sin angleDeg, 0). Position integrates from tangent
 * step-by-step, so trunk.heightCm reads as arc length: a curved trunk is
 * shorter vertically than its arc length, which matches how wire-bent real
 * trunks behave.
 */
/**
 * Frames are memoised per tree on a cheap signature of what feeds them
 * (revision, height, bend events), because scoring and the mesh builder ask
 * for them once per branch sample. Mutating the trunk without `markDirty`
 * still invalidates, since the signature reads the trunk itself.
 */
const frameCache = new WeakMap<BonsaiTree, { signature: string; frames: Frame[] }>();

function trunkSignature(tree: BonsaiTree): string {
  const ev = tree.trunk.movement.map((m) => `${String(m.y)}:${String(m.angleDeg)}`).join(',');
  return `${String(tree.revision)}|${String(tree.trunk.heightCm)}|${ev}`;
}

export function trunkFrames(tree: BonsaiTree): Frame[] {
  const signature = trunkSignature(tree);
  const hit = frameCache.get(tree);
  if (hit?.signature === signature) return hit.frames;
  const frames = computeTrunkFrames(tree);
  frameCache.set(tree, { signature, frames });
  return frames;
}

function computeTrunkFrames(tree: BonsaiTree): Frame[] {
  const trunk = tree.trunk;
  const arcWorld = (trunk.heightCm / 100) * DISPLAY_SCALE;
  const segments = Math.max(8, Math.floor(arcWorld * 20));

  // Sort movement events by height. Rotations don't commute, so the trunk
  // bends event-by-event from the base upward; an event at y=5 rotates
  // everything above y=5, including subsequent events' deflection axes.
  const events: TrunkMovement[] = [...trunk.movement].sort((a, b) => a.y - b.y);

  const frames: Frame[] = [];
  let pos = vec3(0, 0, 0);
  let T = vec3(0, 0, 1);
  let N = vec3(1, 0, 0);
  let B = vec3(0, 1, 0);
  const ds = segments > 0 ? arcWorld / segments : 0;
  let nextEvent = 0;

  for (let i = 0; i <= segments; i++) {
    const t = segments > 0 ? i / segments : 0;
    const arcNow = t * arcWorld;

    // Apply any events whose height we've reached or passed.
    // Axis is world_up x d, NOT current_T x d: using current_T flips sign
    // when the trunk passes horizontal (cascade case), so further bends
    // would un-bend the trunk instead of continuing the cascade. With a
    // world-frame axis, cumulative bends compose consistently no matter
    // how much the trunk has already curved.
    for (let ev = events[nextEvent]; ev !== undefined; ev = events[nextEvent]) {
      const evArc = (ev.y / 100) * DISPLAY_SCALE;
      if (evArc > arcNow) break;

      // up x d, with up = (0,0,1), d = (cos, sin, 0), simplifies to
      // (-sin, cos, 0), already unit-length.
      const ax = vec3(-dsin(ev.angleDeg), dcos(ev.angleDeg), 0);
      T = vec3Rotate(T, ax, TRUNK_BEND_PER_EVENT);
      N = vec3Rotate(N, ax, TRUNK_BEND_PER_EVENT);
      B = vec3Rotate(B, ax, TRUNK_BEND_PER_EVENT);
      nextEvent++;
    }

    frames.push({ pos, tangent: T, normal: N, binormal: B });

    if (i < segments) {
      pos = vec3(pos.x + T.x * ds, pos.y + T.y * ds, pos.z + T.z * ds);
    }
  }

  return frames;
}

function lerpVec3(a: Vec3, b: Vec3, f: number): Vec3 {
  return vec3(lerp(a.x, b.x, f), lerp(a.y, b.y, f), lerp(a.z, b.z, f));
}

/**
 * Frame at fractional height `t` in [0..1] along the trunk arc. Linearly
 * interpolates between sampled frames and renormalises: adjacent frames
 * differ only by small angles, so lerp+renormalise is a cheap stand-in for
 * slerp. Used by branchPoint and the wire anchor for any-height lookups.
 */
export function trunkFrameAt(tree: BonsaiTree, t: number): Frame {
  const frames = trunkFrames(tree);
  const n = frames.length;
  const first = frames[0];
  if (first === undefined) {
    return {
      pos: vec3(0, 0, 0),
      tangent: vec3(0, 0, 1),
      normal: vec3(1, 0, 0),
      binormal: vec3(0, 1, 0),
    };
  }
  if (n === 1) return first;

  const idxF = clamp(t, 0, 1) * (n - 1);
  const i0 = Math.floor(idxF);
  const i1 = Math.min(i0 + 1, n - 1);
  const f = idxF - i0;
  const a = frames[i0] ?? first;
  const b = frames[i1] ?? first;

  return {
    pos: lerpVec3(a.pos, b.pos, f),
    tangent: vec3Normalize(lerpVec3(a.tangent, b.tangent, f)),
    normal: vec3Normalize(lerpVec3(a.normal, b.normal, f)),
    binormal: vec3Normalize(lerpVec3(a.binormal, b.binormal, f)),
  };
}

/**
 * Point at fractional length `tAlong` along a branch. With bendV = 0 this is
 * the closed-form circular-arc integral plus a linear 0.25 z lift; otherwise a
 * 12-step numerical integration of the V-then-H rotated tangent.
 */
export function branchPoint(tree: BonsaiTree, branch: Branch, tAlong: number): Vec3 {
  const trunk = tree.trunk;
  const ot = clamp(branch.originY / trunk.heightCm, 0, 1);

  const tf = trunkFrameAt(tree, ot);
  const baseR = (trunk.girthMm / 1000 / 2) * DISPLAY_SCALE;
  const trunkR = lerp(baseR, baseR * (1 - trunk.taper), ot);

  // Branch attaches to the trunk surface in a direction expressed in the
  // trunk's LOCAL basis: cos(angle) along normal, sin(angle) along binormal.
  const ca0 = dcos(branch.angle);
  const sa0 = dsin(branch.angle);
  const ox = tf.pos.x + (ca0 * tf.normal.x + sa0 * tf.binormal.x) * trunkR;
  const oy = tf.pos.y + (ca0 * tf.normal.y + sa0 * tf.binormal.y) * trunkR;
  const oz = tf.pos.z + (ca0 * tf.normal.z + sa0 * tf.binormal.z) * trunkR;

  const lengthM = (branch.length / 100) * DISPLAY_SCALE;
  const bendV = branch.bendV;

  let hx = 0;
  let hy = 0;
  let hz = 0;
  if (Math.abs(bendV) < 0.001) {
    // Pure horizontal: closed-form arc integral + linear z lift.
    if (Math.abs(branch.bend) < 0.001) {
      hx = lengthM * tAlong * ca0;
      hy = lengthM * tAlong * sa0;
    } else {
      // integral of cos(a0 + k s) ds = (1/k) * (sin(a0 + k s) - sin(a0))
      // Convert k from rad to deg via the (180/pi) factor.
      const angleT = branch.angle + branch.bend * tAlong;
      const scale = (lengthM / branch.bend) * (180 / Math.PI);
      hx = scale * (dsin(angleT) - dsin(branch.angle));
      hy = scale * (-dcos(angleT) + dcos(branch.angle));
    }
    hz = lengthM * tAlong * 0.25;
  } else {
    // Mixed bend: numerical integration. T0 stays unnormalised (mag
    // sqrt(1.0625)) so its z component matches the legacy 0.25 lift.
    const vAxis = vec3(sa0, -ca0, 0);
    const zAxis = vec3(0, 0, 1);
    const T0 = vec3(ca0, sa0, 0.25);
    const steps = 12;
    const ds = (lengthM * tAlong) / steps;
    for (let i = 0; i < steps; i++) {
      const u = ((i + 0.5) / steps) * tAlong;
      const Tv = vec3Rotate(T0, vAxis, bendV * u);
      const T = vec3Rotate(Tv, zAxis, branch.bend * u);
      hx += T.x * ds;
      hy += T.y * ds;
      hz += T.z * ds;
    }
  }

  return vec3(ox + hx, oy + hy, oz + hz);
}

/**
 * Frame at fractional length `t` along the branch. With bendV = 0 the frame is
 * closed-form (cos/sin direct). With bendV != 0, rotate the initial unit frame
 * by R_v then R_h: same composition order as the position integral above, so
 * the tangent here matches the integrand exactly.
 */
export function branchFrameAt(tree: BonsaiTree, branch: Branch, t: number): Frame {
  const pos = branchPoint(tree, branch, t);

  const bendV = branch.bendV;
  const ca0 = dcos(branch.angle);
  const sa0 = dsin(branch.angle);
  const inv = 1 / Math.sqrt(1.0625);

  if (Math.abs(bendV) < 0.001) {
    // Pure horizontal: closed-form rotation of the initial frame.
    const angleT = branch.angle + branch.bend * t;
    const ca = dcos(angleT);
    const sa = dsin(angleT);
    return {
      pos,
      tangent: vec3(ca * inv, sa * inv, 0.25 * inv),
      normal: vec3(-sa, ca, 0),
      binormal: vec3(-0.25 * ca * inv, -0.25 * sa * inv, inv),
    };
  }

  // Mixed: rotate initial T0/N0/B0 by R_v(bendV*t) then R_h(bend*t).
  const vAxis = vec3(sa0, -ca0, 0);
  const zAxis = vec3(0, 0, 1);
  const T0 = vec3(ca0 * inv, sa0 * inv, 0.25 * inv);
  const N0 = vec3(-sa0, ca0, 0);
  const B0 = vec3(-0.25 * ca0 * inv, -0.25 * sa0 * inv, inv);

  const av = bendV * t;
  const ah = branch.bend * t;

  const Tv = vec3Rotate(T0, vAxis, av);
  const Nv = vec3Rotate(N0, vAxis, av);
  const Bv = vec3Rotate(B0, vAxis, av);

  return {
    pos,
    tangent: vec3Rotate(Tv, zAxis, ah),
    normal: vec3Rotate(Nv, zAxis, ah),
    binormal: vec3Rotate(Bv, zAxis, ah),
  };
}
