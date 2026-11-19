import { readFileSync } from 'node:fs';

/**
 * art/inked/style.mjs's WASHES entries as 0xRRGGBB by name, read from its
 * source for the unit tests that pin a runtime colour to its wash: the
 * generator's module is untyped JavaScript the tests cannot import, so this
 * reads each `name: [r, g, b],` line of the table.
 */
export function inkedWashes(): Record<string, number> {
  const source = readFileSync(new URL('../../art/inked/style.mjs', import.meta.url), 'utf8');
  const table = /export const WASHES = \{([^}]*)\};/.exec(source)?.[1] ?? '';
  const washes: Record<string, number> = {};
  for (const [, name = '', r, g, b] of table.matchAll(/^\s*(\w+): \[(\d+), (\d+), (\d+)\],/gm)) {
    washes[name] = (Number(r) << 16) | (Number(g) << 8) | Number(b);
  }
  return washes;
}
