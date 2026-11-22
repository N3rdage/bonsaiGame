/**
 * The season's weather in the 3D world, as pure data. The 2D world's field
 * (src/world/weather.ts: profile, area, particles, stepped by the scene) is
 * the only model; `weatherSprites` lays its particles in the plan in metres
 * for a renderer to draw as small quads. Nothing here imports Babylon.
 */

import {
  particleDraw,
  type Particle,
  type Quad,
  type WeatherArea,
  type WeatherKind,
  type WeatherProfile,
} from '../world/weather';
import { metres } from './plan';

/** The field the 2D world steps and the 3D world draws. */
export interface WeatherField {
  readonly profile: WeatherProfile;
  readonly area: WeatherArea;
  readonly parts: readonly Particle[];
}

/** How high the top of the weather area lies above the floor, metres; the 2D field's fall (y) is height here. */
export const WEATHER_CEILING = 4;

/** One particle in the plan (metres; x east, y south, z up): a square of side `size` turned by `roll` about the line of sight. */
export interface WeatherSprite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly roll: number;
  readonly alpha: number;
  /** 0xRRGGBB. */
  readonly colour: number;
}

/** The drawn kind, or null where there is none (indoors the 3D world draws none, whatever the 2D motes do). */
export function weatherKind(field: WeatherField | undefined): WeatherKind | null {
  return field?.profile.kind ?? null;
}

/**
 * Where each particle stands. The 2D field falls down the screen, so its y
 * is the height (the area's top edge is `WEATHER_CEILING`, its bottom the
 * floor) and its x is the plan's east; the plan's south, which the 2D field
 * has no counterpart for, is spread over the area's depth by golden-ratio
 * steps of the particle's index, so it is stable and even. Sizes are the 2D
 * px at 32 to the metre; the shape drawn is the particle's last (a firefly's
 * core, not its halo), a quad's roll the angle of its first edge.
 */
export function weatherSprites(field: WeatherField): WeatherSprite[] {
  const { profile, area, parts } = field;
  const high = area.y1 - area.y0;
  const depth = metres(high);
  return parts.map((part, n) => {
    const draw = particleDraw(part, profile);
    const shape = draw.shapes[draw.shapes.length - 1];
    if (!shape) throw new Error('a particle draws nothing');
    const [p0, p1] = shape.kind === 'quad' ? shape.points : [];
    const size = shape.kind === 'circle' ? shape.r * 2 : quadSize(shape.points);
    return {
      x: metres(draw.x),
      y: metres(area.y0) + ((n * 0.618033988749895) % 1) * depth,
      z: (1 - (draw.y - area.y0) / high) * WEATHER_CEILING,
      size: metres(size),
      roll: p0 && p1 ? Math.atan2(p1.y - p0.y, p1.x - p0.x) : 0,
      alpha: shape.alpha,
      colour: draw.colour,
    };
  });
}

/** A quad's longer side, from its first three corners. */
function quadSize([a, b, c]: Quad): number {
  return Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - b.x, c.y - b.y));
}
