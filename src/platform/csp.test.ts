import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The Content-Security-Policy lives twice: as a header Azure Static Web Apps
// sends, and as a meta tag in index.html so `vite dev`, `vite preview` and the
// browser suite run under it. Browsers ignore `frame-ancestors` in a meta tag,
// so the header carries it alone; otherwise the two must stay equal. The
// Strict-Transport-Security header is pinned here too: a year, subdomains
// included, and no `preload`, which is the domain owner's call. So is the
// per-route cache policy: hashed chunks under /assets/ are immutable, but the
// fixed-name sprite sheets and sounds beside them must revalidate.

const root = path.join(import.meta.dirname, '../..');

type Policy = Map<string, string[]>;

interface Route {
  route: string;
  headers?: Record<string, string>;
}

interface SwaConfig {
  globalHeaders: Record<string, string>;
  routes: Route[];
}

function swaConfig(): SwaConfig {
  return JSON.parse(
    readFileSync(path.join(root, 'public/staticwebapp.config.json'), 'utf8'),
  ) as SwaConfig;
}

function globalHeaders(): Record<string, string> {
  return swaConfig().globalHeaders;
}

function parse(policy: string): Policy {
  const directives: Policy = new Map();
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (!name) continue;
    expect(directives.has(name), `directive ${name} repeated`).toBe(false);
    directives.set(name, sources);
  }
  return directives;
}

function headerPolicy(): string {
  const policy = globalHeaders()['Content-Security-Policy'];
  if (!policy) throw new Error('no Content-Security-Policy in globalHeaders');
  return policy;
}

function metaPolicy(): string {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html);
  if (!match?.[1]) throw new Error('no Content-Security-Policy meta in index.html');
  return match[1];
}

describe('Content-Security-Policy', () => {
  const header = parse(headerPolicy());
  const meta = parse(metaPolicy());

  it('is the same in the SWA header and the index.html meta, plus frame-ancestors in the header', () => {
    const expected = new Map(meta);
    expected.set('frame-ancestors', ["'none'"]);
    expect(Object.fromEntries(header)).toEqual(Object.fromEntries(expected));
    expect(meta.has('frame-ancestors')).toBe(false);
  });

  it.each([
    ['header', header],
    ['meta', meta],
  ])('the %s policy allows no eval, no plugins and no foreign base', (_, policy) => {
    for (const sources of policy.values()) expect(sources).not.toContain("'unsafe-eval'");
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
  });
});

describe('Strict-Transport-Security', () => {
  it('is a year with subdomains and no preload', () => {
    expect(globalHeaders()['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

// The test's model of the documented SWA rule: routes are evaluated in array
// order, evaluation stops at the first match, and a wildcard matches any
// characters (a trailing `/calendar*` matches `/calendar/january/1`, so `/` too).
// This is not SWA's implementation; it pins what the config relies on.
function firstMatch(routes: Route[], urlPath: string): Route | undefined {
  return routes.find(({ route }) => {
    const pattern = route
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${pattern}$`).test(urlPath);
  });
}

describe('Cache-Control routes', () => {
  const NO_CACHE = 'no-cache';
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  const { routes } = swaConfig();
  const indexOf = (route: string): number => routes.findIndex((r) => r.route === route);
  const cacheControl = (urlPath: string): string | undefined =>
    firstMatch(routes, urlPath)?.headers?.['Cache-Control'];

  it('revalidates fixed-name sprite sheets and sounds, ahead of the immutable /assets/* route', () => {
    const assets = indexOf('/assets/*');
    expect(assets).toBeGreaterThanOrEqual(0);
    for (const route of ['/assets/spr_*', '/assets/audio/*']) {
      const index = indexOf(route);
      expect(index, route).toBeGreaterThanOrEqual(0);
      expect(index, `${route} before /assets/*`).toBeLessThan(assets);
      expect(routes[index]?.headers?.['Cache-Control'], route).toBe(NO_CACHE);
    }
  });

  it('keeps hashed chunks immutable for a year and the service worker no-cache', () => {
    expect(routes[indexOf('/assets/*')]?.headers?.['Cache-Control']).toBe(IMMUTABLE);
    expect(routes[indexOf('/sw.js')]?.headers?.['Cache-Control']).toBe(NO_CACHE);
  });

  it.each([
    ['/assets/spr_player.png', NO_CACHE],
    ['/assets/audio/click.wav', NO_CACHE],
    ['/assets/index-abc123.js', IMMUTABLE],
    ['/assets/phaser-abc123.js', IMMUTABLE],
    ['/sw.js', NO_CACHE],
  ])('first match for %s is %s', (urlPath, expected) => {
    expect(cacheControl(urlPath)).toBe(expected);
  });

  it.each([
    ['public/assets', '/assets/', '.png'],
    ['public/assets/audio', '/assets/audio/', '.wav'],
  ])('every %s file served in place resolves to no-cache', (dir, urlPrefix, extension) => {
    const files = readdirSync(path.join(root, dir)).filter((name) => name.endsWith(extension));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) expect(cacheControl(`${urlPrefix}${name}`), name).toBe(NO_CACHE);
  });

  it('serves no player body file from public/, so each is a hashed asset the immutable route covers', () => {
    for (const name of ['rogue.glb', 'rogue_texture.png', 'animations.glb']) {
      expect(existsSync(path.join(root, 'src/world3d/player', name)), name).toBe(true);
    }
    for (const name of ['rogue.glb', 'rogue_texture.png', 'animations.glb']) {
      expect(existsSync(path.join(root, 'public/assets/player', name)), name).toBe(false);
    }
    expect(cacheControl('/assets/rogue-abc123.glb')).toBe(IMMUTABLE);
    expect(cacheControl('/assets/rogue_texture-abc123.png')).toBe(IMMUTABLE);
  });
});
