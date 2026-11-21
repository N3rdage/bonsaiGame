/**
 * The player walking the scene (backlog #378): input relative to the
 * camera's yaw and a circle sliding along the colliders' boxes. Pure and
 * engine-neutral, site frame (scene.ts).
 */

import { PLAYER_RADIUS, WALK_SPEED, type Rect2 } from './scene';

/** Screen-relative intent: x right, y down the screen (toward the camera), each -1..1. */
export interface MoveInput {
  readonly x: number;
  readonly y: number;
}

export interface HeldKeys {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

/** Arrows and WASD, by `KeyboardEvent.code`. */
export const MOVE_KEYS: Readonly<Record<string, keyof HeldKeys>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

/** The keys and the touch stick together, the stick's analog vector added to the keys', clamped to length 1. */
export function combineInput(keys: HeldKeys, stick: MoveInput): MoveInput {
  const x = Number(keys.right) - Number(keys.left) + stick.x;
  const y = Number(keys.down) - Number(keys.up) + stick.y;
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/** Stick drag (CSS px) as input: nothing inside `deadZone`, full at `radius`. */
export function stickInput(dx: number, dy: number, radius = 40, deadZone = 6): MoveInput {
  const len = Math.hypot(dx, dy);
  if (len < deadZone) return { x: 0, y: 0 };
  const scale = 1 / Math.max(len, radius);
  return { x: dx * scale, y: dy * scale };
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Screen input as a ground direction (site x east, y south) for a camera at
 * `yawDeg` (orbit.ts: 0 stands south of the player looking north): right is
 * the screen's right, up the screen is away from the camera.
 */
export function groundDirection(input: MoveInput, yawDeg: number): { x: number; y: number } {
  const c = Math.cos(rad(yawDeg));
  const s = Math.sin(rad(yawDeg));
  // Screen right on the ground is (c, -s); screen down (toward the camera) is (s, c).
  const x = input.x * c + input.y * s;
  const y = -input.x * s + input.y * c;
  return { x: Math.abs(x) < 1e-12 ? 0 : x, y: Math.abs(y) < 1e-12 ? 0 : y };
}

/**
 * A circle at `p` pushed out of every box it overlaps, a few passes so a
 * corner between two boxes settles: what is left of a move into a wall is the
 * part along it, so the player slides.
 */
export function collide(
  p: { x: number; y: number },
  colliders: readonly Rect2[],
  radius = PLAYER_RADIUS,
): { x: number; y: number } {
  let { x, y } = p;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const r of colliders) {
      const cx = Math.min(r.x1, Math.max(r.x0, x));
      const cy = Math.min(r.y1, Math.max(r.y0, y));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      moved = true;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        y = cy + (dy / d) * radius;
      } else {
        // The centre is inside the box: out by the shortest way.
        const exits = [
          { d: x - r.x0, x: r.x0 - radius, y },
          { d: r.x1 - x, x: r.x1 + radius, y },
          { d: y - r.y0, x, y: r.y0 - radius },
          { d: r.y1 - y, x, y: r.y1 + radius },
        ].sort((a, b) => a.d - b.d);
        const best = exits[0];
        if (best) ({ x, y } = best);
      }
    }
    if (!moved) break;
  }
  return { x, y };
}

export interface Walker {
  readonly x: number;
  readonly y: number;
  /** Ground heading, radians from east toward south (atan2(y, x)), kept while standing. */
  readonly heading: number;
}

/** One step of `dt` seconds: the move, then collision, and the heading it ends on. */
export function stepWalker(
  w: Walker,
  input: MoveInput,
  yawDeg: number,
  dt: number,
  colliders: readonly Rect2[],
): Walker {
  const dir = groundDirection(input, yawDeg);
  const moving = dir.x !== 0 || dir.y !== 0;
  if (!moving) return w;
  const next = collide(
    { x: w.x + dir.x * WALK_SPEED * dt, y: w.y + dir.y * WALK_SPEED * dt },
    colliders,
  );
  return { x: next.x, y: next.y, heading: Math.atan2(dir.y, dir.x) };
}
