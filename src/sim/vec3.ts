/**
 * Vector helpers and degree-based trig. Plain `{ x, y, z }` values, never
 * mutated: every helper returns a fresh vector.
 *
 * Ported from archive/gamemaker/scripts/scr_math_3d/scr_math_3d.gml
 * (init_vertex_format and project_3d_to_screen are rendering and are not
 * ported). The degree helpers mirror GML's built-in dcos / dsin / darccos.
 */

import type { Vec3 } from './types';

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Cosine of an angle in degrees (GML `dcos`). */
export function dcos(deg: number): number {
  return Math.cos(degToRad(deg));
}

/** Sine of an angle in degrees (GML `dsin`). */
export function dsin(deg: number): number {
  return Math.sin(degToRad(deg));
}

/** Arc-cosine in degrees (GML `darccos`). Input is clamped to [-1, 1]. */
export function darccos(x: number): number {
  return radToDeg(Math.acos(Math.min(1, Math.max(-1, x))));
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return vec3(v.x * s, v.y * s, v.z * s);
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Unit vector in the direction of `v`; the zero vector maps to the zero vector. */
export function vec3Normalize(v: Vec3): Vec3 {
  const l = vec3Length(v);
  if (l === 0) return vec3(0, 0, 0);
  return vec3(v.x / l, v.y / l, v.z / l);
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/**
 * Rodrigues' rotation formula: rotate `v` around `unitAxis` by `angleDeg`.
 * Caller must pass a unit axis. Used for parallel-transporting trunk frames as
 * the trunk's tangent rotates through bend events.
 */
export function vec3Rotate(v: Vec3, unitAxis: Vec3, angleDeg: number): Vec3 {
  const ca = dcos(angleDeg);
  const sa = dsin(angleDeg);
  const dot = unitAxis.x * v.x + unitAxis.y * v.y + unitAxis.z * v.z;
  const cx = unitAxis.y * v.z - unitAxis.z * v.y;
  const cy = unitAxis.z * v.x - unitAxis.x * v.z;
  const cz = unitAxis.x * v.y - unitAxis.y * v.x;
  const k = (1 - ca) * dot;
  return vec3(
    v.x * ca + cx * sa + unitAxis.x * k,
    v.y * ca + cy * sa + unitAxis.y * k,
    v.z * ca + cz * sa + unitAxis.z * k,
  );
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
