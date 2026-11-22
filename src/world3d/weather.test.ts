import { describe, expect, it } from 'vitest';
import type { Season } from '../sim/seasons';
import { GARDEN_ROOM } from '../world/gardenRoom';
import { createParticles, stepParticles, weatherArea, weatherProfile } from '../world/weather';
import { WEATHER_CEILING, weatherKind, weatherSprites, type WeatherField } from './weather';

function seeded(): () => number {
  let s = 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function fieldOf(season: Season): WeatherField {
  const area = weatherArea(GARDEN_ROOM);
  const profile = weatherProfile(season, false);
  return { profile, area, parts: createParticles(profile, area, seeded()) };
}

describe('the 3D weather', () => {
  it('names the profile kind of the season, and none without a field', () => {
    expect(weatherKind(fieldOf('spring'))).toBe('petals');
    expect(weatherKind(fieldOf('summer'))).toBe('fireflies');
    expect(weatherKind(fieldOf('autumn'))).toBe('leaves');
    expect(weatherKind(fieldOf('winter'))).toBe('snow');
    expect(weatherKind(undefined)).toBeNull();
  });

  it('draws one sprite per particle, in metres over the area and below the ceiling', () => {
    const field = fieldOf('autumn');
    const sprites = weatherSprites(field);
    expect(sprites).toHaveLength(field.profile.count);
    for (const s of sprites) {
      expect(s.y).toBeGreaterThanOrEqual(field.area.y0 / 32);
      expect(s.y).toBeLessThanOrEqual(field.area.y1 / 32);
      expect(s.z).toBeLessThanOrEqual(WEATHER_CEILING + 1);
      expect(s.size).toBeGreaterThan(0);
    }
  });

  it('follows the 2D stepping: falling lowers a sprite', () => {
    const field = fieldOf('winter');
    const before = weatherSprites(field).map((s) => s.z);
    for (let i = 0; i < 10; i += 1) stepParticles([...field.parts], field.profile, field.area);
    const after = weatherSprites(field).map((s) => s.z);
    expect(after.some((z, n) => z < (before[n] ?? 0))).toBe(true);
  });
});
