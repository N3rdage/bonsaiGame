import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DESKTOP_UI, PHONE_UI } from '../world/uiScale';
import { FONT_FAMILY, FONT_KEY, bodyStyle, labelStyle } from './textStyle';

/** The browser `monospace` default (DejaVu Sans Mono, Liberation Mono, Courier New, Menlo): 0.6 em an advance. */
const MONOSPACE_ADVANCE_EM = 0.6;
/** Its line box, ascent plus descent, is about 1.13-1.17 em; the panel tests' line bounds assume 1.2. */
const MONOSPACE_LINE_EM = 1.2;

/**
 * The face's metrics from its WOFF 1.0 tables (zlib, unlike WOFF2's
 * transformed ones). The package ships the same face as the WOFF2 the game
 * loads, so their metrics are the same.
 */
function fontMetrics(file: string): { advancesEm: number[]; lineEm: number } {
  const bytes = readFileSync(
    createRequire(import.meta.url).resolve(`@fontsource/vt323/files/${file}`),
  );
  const tables = new Map<string, Buffer>();
  const numTables = bytes.readUInt16BE(12);
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + i * 20;
    const offset = bytes.readUInt32BE(entry + 4);
    const compLength = bytes.readUInt32BE(entry + 8);
    const origLength = bytes.readUInt32BE(entry + 12);
    const data = bytes.subarray(offset, offset + compLength);
    tables.set(
      bytes.toString('latin1', entry, entry + 4),
      compLength < origLength ? inflateSync(data) : data,
    );
  }
  const table = (tag: string): Buffer => {
    const t = tables.get(tag);
    if (!t) throw new Error(`no ${tag} table`);
    return t;
  };
  const unitsPerEm = table('head').readUInt16BE(18);
  const hhea = table('hhea');
  const hmtx = table('hmtx');
  const advances = new Set<number>();
  for (let i = 0; i < hhea.readUInt16BE(34); i++) advances.add(hmtx.readUInt16BE(i * 4));
  return {
    advancesEm: [...advances].map((a) => a / unitsPerEm),
    lineEm: (hhea.readInt16BE(4) - hhea.readInt16BE(6) + hhea.readInt16BE(8)) / unitsPerEm,
  };
}

describe('the pixel font', () => {
  const metrics = fontMetrics('vt323-latin-400-normal.woff');

  it('is VT323 with the browser monospace behind it', () => {
    expect(FONT_KEY).toBe('VT323');
    expect(FONT_FAMILY).toBe('VT323, monospace');
  });

  it('sizes labels and copy from the UI metrics: 8 and 10 px on desktop, 10 and 10 on the phone', () => {
    const style = (px: string) => ({ fontFamily: FONT_FAMILY, fontSize: px, color: '#d8e6c8' });
    expect(labelStyle(DESKTOP_UI)).toEqual(style('8px'));
    expect(bodyStyle(DESKTOP_UI)).toEqual(style('10px'));
    expect(labelStyle(PHONE_UI)).toEqual(style('10px'));
    expect(bodyStyle(PHONE_UI)).toEqual(style('10px'));
    expect(labelStyle({ hit: 44, label: 14, body: 14 }).fontSize).toBe('14px');
  });

  it('is monospace at 0.4 em an advance (zero-width marks aside), narrower than monospace', () => {
    const advances = metrics.advancesEm.filter((a) => a > 0);
    expect(advances).toEqual([0.4]);
    // 3.2 px a glyph at 8 px (monospace 4.8) and 4 px at 10 px (monospace 6), so
    // every width counted in characters at monospace's advance still fits.
    expect([8, 10].map((px) => Math.max(...advances) * px)).toEqual([3.2, 4]);
    expect(Math.max(...advances)).toBeLessThan(MONOSPACE_ADVANCE_EM);
  });

  it('has a 1 em line box, no taller than monospace', () => {
    expect(metrics.lineEm).toBe(1);
    expect(metrics.lineEm).toBeLessThan(MONOSPACE_LINE_EM);
  });
});
