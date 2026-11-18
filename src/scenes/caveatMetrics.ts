/**
 * Test support, Node only (the game never imports it): Caveat's metrics read
 * from its WOFF 1.0 file in `@fontsource/caveat` (zlib tables, unlike WOFF2's
 * transformed ones). The package ships the same face as the WOFF2 BootScene
 * loads, so their metrics are the same. textStyle.test.ts pins them; the
 * layout tests measure their strings with `textWidthEm`.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';

/** A glyph's horizontal metrics and ink box, in em. */
export interface GlyphMetrics {
  readonly advance: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface FaceMetrics {
  /** Each printable ASCII character's glyph (space has no ink: its box is zero). */
  readonly glyphs: ReadonlyMap<string, GlyphMetrics>;
  /** The hhea line box, ascent minus descent plus line gap. */
  readonly lineEm: number;
  /** The OS/2 x-height and cap height. */
  readonly xHeightEm: number;
  readonly capHeightEm: number;
}

function tables(file: string): Map<string, Buffer> {
  const bytes = readFileSync(
    createRequire(import.meta.url).resolve(`@fontsource/caveat/files/${file}`),
  );
  const out = new Map<string, Buffer>();
  for (let i = 0; i < bytes.readUInt16BE(12); i++) {
    const entry = 44 + i * 20;
    const offset = bytes.readUInt32BE(entry + 4);
    const compLength = bytes.readUInt32BE(entry + 8);
    const origLength = bytes.readUInt32BE(entry + 12);
    const data = bytes.subarray(offset, offset + compLength);
    out.set(
      bytes.toString('latin1', entry, entry + 4),
      compLength < origLength ? inflateSync(data) : data,
    );
  }
  return out;
}

/** The glyph index of `code` in a format 4 cmap subtable at `sub`, 0 when unmapped. */
function glyphIndex(cmap: Buffer, sub: number, code: number): number {
  const segX2 = cmap.readUInt16BE(sub + 6);
  for (let s = 0; s < segX2 / 2; s++) {
    if (code > cmap.readUInt16BE(sub + 14 + s * 2)) continue;
    const start = cmap.readUInt16BE(sub + 16 + segX2 + s * 2);
    if (code < start) return 0;
    const delta = cmap.readInt16BE(sub + 16 + segX2 * 2 + s * 2);
    const rangeAt = sub + 16 + segX2 * 3 + s * 2;
    const range = cmap.readUInt16BE(rangeAt);
    if (range === 0) return (code + delta) & 0xffff;
    const g = cmap.readUInt16BE(rangeAt + range + (code - start) * 2);
    return g === 0 ? 0 : (g + delta) & 0xffff;
  }
  return 0;
}

/** The metrics of `file` under `@fontsource/caveat/files/`. */
export function caveatMetrics(file = 'caveat-latin-400-normal.woff'): FaceMetrics {
  const t = tables(file);
  const table = (tag: string): Buffer => {
    const b = t.get(tag);
    if (!b) throw new Error(`no ${tag} table`);
    return b;
  };
  const head = table('head');
  const hhea = table('hhea');
  const hmtx = table('hmtx');
  const loca = table('loca');
  const glyf = table('glyf');
  const cmap = table('cmap');
  const os2 = table('OS/2');
  const upm = head.readUInt16BE(18);
  const longLoca = head.readInt16BE(50) === 1;
  const hMetrics = hhea.readUInt16BE(34);
  const locaAt = (g: number): number =>
    longLoca ? loca.readUInt32BE(g * 4) : loca.readUInt16BE(g * 2) * 2;
  let sub = -1;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const at = cmap.readUInt32BE(8 + i * 8);
    const windowsUnicode = cmap.readUInt16BE(4 + i * 8) === 3 && cmap.readUInt16BE(6 + i * 8) === 1;
    if (windowsUnicode && cmap.readUInt16BE(at) === 4) sub = at;
  }
  if (sub < 0) throw new Error('no Unicode BMP cmap');
  const glyphs = new Map<string, GlyphMetrics>();
  for (let code = 32; code < 127; code++) {
    const g = glyphIndex(cmap, sub, code);
    const advance = hmtx.readUInt16BE(Math.min(g, hMetrics - 1) * 4) / upm;
    const at = locaAt(g);
    const inked = locaAt(g + 1) > at;
    const box = (o: number): number => (inked ? glyf.readInt16BE(at + o) / upm : 0);
    glyphs.set(String.fromCharCode(code), {
      advance,
      xMin: box(2),
      yMin: box(4),
      xMax: box(6),
      yMax: box(8),
    });
  }
  return {
    glyphs,
    lineEm: (hhea.readInt16BE(4) - hhea.readInt16BE(6) + hhea.readInt16BE(8)) / upm,
    xHeightEm: os2.readInt16BE(86) / upm,
    capHeightEm: os2.readInt16BE(88) / upm,
  };
}

const regular = caveatMetrics();

/** `text`'s width in em in Caveat 400: the sum of its advances (a character outside ASCII counts as `M`). */
export function textWidthEm(text: string): number {
  let w = 0;
  for (const c of text) w += (regular.glyphs.get(c) ?? regular.glyphs.get('M'))?.advance ?? 0;
  return w;
}
