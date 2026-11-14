import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The Content-Security-Policy lives twice: as a header Azure Static Web Apps
// sends, and as a meta tag in index.html so `vite dev`, `vite preview` and the
// browser suite run under it. Browsers ignore `frame-ancestors` in a meta tag,
// so the header carries it alone; otherwise the two must stay equal.

const root = path.join(import.meta.dirname, '../..');

type Policy = Map<string, string[]>;

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
  const config = JSON.parse(
    readFileSync(path.join(root, 'public/staticwebapp.config.json'), 'utf8'),
  ) as { globalHeaders: Record<string, string> };
  const policy = config.globalHeaders['Content-Security-Policy'];
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
