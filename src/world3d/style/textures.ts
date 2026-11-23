/**
 * Backlog #446 (style frames, throwaway): the take's surfaces painted in code
 * on canvases, which the dresser hands Babylon as textures. Each painter
 * works in one of three hands: 'paper' (flat washes on a fibrous paper with
 * blooms at their edges and a wobbling ink line), 'paint' (built up from
 * hundreds of short, jittered brush dabs on a canvas weave) and 'felt'
 * (soft fuzzy fills, stitched seams instead of ink). Seeded, so a surface
 * is the same every load.
 */

import type { Hand, Look } from './looks';

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `hex` with each channel times `f`, clamped. */
export function shade(hex: number, f: number): number {
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((hex >> 16) & 255) << 16) | (ch((hex >> 8) & 255) << 8) | ch(hex & 255);
}

/** `hex` moved toward `to` by `t`. */
export function mix(hex: number, to: number, t: number): number {
  const ch = (s: number): number => {
    const a = (hex >> s) & 255;
    const b = (to >> s) & 255;
    return Math.round(a + (b - a) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function css(hex: number, alpha = 1): string {
  return `rgba(${String((hex >> 16) & 255)},${String((hex >> 8) & 255)},${String(hex & 255)},${String(alpha)})`;
}

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return [c, ctx];
}

/** Fills a rectangle in the hand: a wash with blooms, brush dabs along `dir`, or fuzz. */
function fill(
  ctx: Ctx,
  hand: Hand,
  r: Rand,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: number,
  dir: 'h' | 'v' = 'h',
): void {
  ctx.fillStyle = css(colour);
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const area = w * h;
  if (hand === 'paper') {
    for (let i = 0; i < area / 2500; i++) {
      const cx = x + r() * w;
      const cy = y + r() * h;
      const rad = 8 + r() * 40;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, css(shade(colour, 0.9 + r() * 0.16), 0.35));
      g.addColorStop(1, css(colour, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // The wash pools darker at its edge as watercolour does.
    ctx.strokeStyle = css(shade(colour, 0.86), 0.35);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  } else if (hand === 'paint') {
    ctx.lineCap = 'round';
    for (let i = 0; i < area / 110; i++) {
      const cx = x + r() * w;
      const cy = y + r() * h;
      const len = 14 + r() * 34;
      const a = (dir === 'h' ? 0 : Math.PI / 2) + (r() - 0.5) * 0.5;
      const tone = mix(
        shade(colour, 0.84 + r() * 0.3),
        r() < 0.5 ? 0xffd8a0 : 0x6070a0,
        r() * 0.14,
      );
      ctx.strokeStyle = css(tone, 0.35 + r() * 0.3);
      ctx.lineWidth = 4 + r() * 9;
      ctx.beginPath();
      ctx.moveTo(cx - (Math.cos(a) * len) / 2, cy - (Math.sin(a) * len) / 2);
      ctx.quadraticCurveTo(
        cx + (r() - 0.5) * 4,
        cy + (r() - 0.5) * 4,
        cx + (Math.cos(a) * len) / 2,
        cy + (Math.sin(a) * len) / 2,
      );
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < area / 6; i++) {
      ctx.fillStyle = css(shade(colour, 0.92 + r() * 0.16), 0.5);
      ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  }
  ctx.restore();
}

/** A line in the hand: a wobbling ink line, a darker brush stroke, or a stitched seam. */
function line(
  ctx: Ctx,
  hand: Hand,
  r: Rand,
  ink: number,
  under: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width = 2,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  if (hand === 'paper') {
    ctx.strokeStyle = css(ink, 0.8);
    ctx.lineWidth = width;
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x0 + (x1 - x0) * t + (r() - 0.5) * 1.2;
      const py = y0 + (y1 - y0) * t + (r() - 0.5) * 1.2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (hand === 'paint') {
    ctx.strokeStyle = css(shade(under, 0.62), 0.5);
    ctx.lineWidth = width * 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  } else {
    ctx.strokeStyle = css(shade(under, 0.78), 0.7);
    ctx.lineWidth = width * 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = css(shade(under, 1.18), 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x0 + 3, y0 + 3);
    ctx.lineTo(x1 + 3, y1 + 3);
    ctx.stroke();
  }
  ctx.restore();
}

/** The hand's surface over the whole canvas: paper fibres, a canvas weave or felt fuzz. */
function grain(ctx: Ctx, hand: Hand, r: Rand, w: number, h: number, strength = 1): void {
  ctx.save();
  if (hand === 'paper') {
    for (let i = 0; i < (w * h) / 180; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI;
      const len = 2 + r() * 7;
      ctx.strokeStyle =
        r() < 0.5
          ? `rgba(255,250,240,${String(0.12 * strength)})`
          : `rgba(60,40,30,${String(0.07 * strength)})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  } else if (hand === 'paint') {
    ctx.fillStyle = `rgba(255,255,255,${String(0.05 * strength)})`;
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = `rgba(0,0,0,${String(0.04 * strength)})`;
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
  } else {
    for (let i = 0; i < (w * h) / 4; i++) {
      ctx.fillStyle =
        r() < 0.5
          ? `rgba(255,255,255,${String(0.1 * strength)})`
          : `rgba(0,0,0,${String(0.06 * strength)})`;
      ctx.fillRect(r() * w, r() * h, 1, 1);
    }
  }
  ctx.restore();
}

/** Metres a wall texture spans across (it repeats) and up (it does not). */
export const WALL_TILE = { u: 2, v: 2.4 };

/**
 * The lounge's wall, floor to ceiling: a skirting board, a painted
 * tongue-and-groove wainscot to a dado rail, wallpaper with the take's motif,
 * a cornice; and the wear of a lived-in room (scuffed skirting, chipped
 * boards, the pale ghost of a picture that hung there, a damp bloom).
 */
export function wallCanvas(look: Look): HTMLCanvasElement {
  const W = 1024;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  const r = rng(446);
  const hand = look.hand;
  const { paper, motif, wainscot, rail, skirting } = look.walls;
  const y = (z: number): number => H - (z / WALL_TILE.v) * H;
  const px = W / WALL_TILE.u;
  // Wallpaper.
  fill(ctx, hand, r, 0, y(2.4), W, y(0.95) - y(2.4), paper, 'v');
  ctx.save();
  if (hand === 'paper') {
    for (let gx = 0; gx < W; gx += 128) {
      ctx.fillStyle = css(shade(paper, 0.96), 0.7);
      ctx.fillRect(gx + 60, y(2.32), 8, y(0.97) - y(2.32));
      for (let gy = y(2.3); gy < y(1.0); gy += 110) {
        const ox = gx + (((gy / 110) | 0) % 2 === 0 ? 30 : 94);
        ctx.strokeStyle = css(shade(motif, 0.8), 0.8);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ox, gy + 26);
        ctx.quadraticCurveTo(ox + 4, gy + 10, ox - 2, gy - 4);
        ctx.stroke();
        for (const [dx, dy, a] of [
          [-7, 12, -0.7],
          [7, 6, 0.7],
          [-5, 0, -0.5],
        ] as const) {
          ctx.fillStyle = css(motif, 0.85);
          ctx.beginPath();
          ctx.ellipse(ox + dx, gy + dy, 7, 3.4, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = css(0xe0a060, 0.8);
        ctx.beginPath();
        ctx.arc(ox + 1, gy - 6, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (hand === 'paint') {
    for (let gx = 0; gx < W; gx += 128) {
      fill(ctx, hand, r, gx + 48, y(2.32), 32, y(0.97) - y(2.32), mix(paper, motif, 0.55), 'v');
      for (let gy = y(2.25); gy < y(1.05); gy += 96) {
        const ox = gx + (((gy / 96) | 0) % 2 === 0 ? 0 : 64);
        ctx.fillStyle = css(mix(motif, 0xe8d090, 0.35), 0.5);
        for (let k = 0; k < 14; k++) {
          ctx.beginPath();
          ctx.ellipse(
            ox + (r() - 0.5) * 18,
            gy + (r() - 0.5) * 22,
            3 + r() * 4,
            2 + r() * 3,
            r() * 3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
  } else {
    for (let gx = 0; gx < W; gx += 64) {
      for (let gy = y(2.3); gy < y(1.0); gy += 64) {
        const ox = gx + (((gy / 64) | 0) % 2 === 0 ? 16 : 48);
        ctx.fillStyle = css(motif, 0.9);
        ctx.beginPath();
        ctx.arc(ox, gy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = css(shade(motif, 1.12), 0.9);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ox, gy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  ctx.restore();
  // The pale ghost of a picture that hung here, and a damp bloom by the cornice.
  ctx.fillStyle = css(shade(paper, 1.08), 0.35);
  ctx.fillRect(700, y(1.9), 150, 120);
  const g = ctx.createRadialGradient(260, y(2.25), 4, 260, y(2.25), 90);
  g.addColorStop(0, css(shade(paper, 0.82), 0));
  g.addColorStop(0.8, css(shade(paper, 0.8), 0.18));
  g.addColorStop(1, css(shade(paper, 0.8), 0));
  ctx.fillStyle = g;
  ctx.fillRect(160, y(2.4), 200, 190);
  // Wainscot boards.
  const board = px * 0.125;
  for (let bx = 0; bx < W; bx += board) {
    fill(
      ctx,
      hand,
      r,
      bx,
      y(0.92),
      board,
      y(0.13) - y(0.92),
      shade(wainscot, 0.95 + r() * 0.1),
      'v',
    );
    line(ctx, hand, r, look.ink, wainscot, bx, y(0.92), bx, y(0.13), 1.6);
  }
  // Chipped paint on the boards: the wood beneath.
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = css(mix(rail, 0xffffff, 0.2), 0.75);
    const cx = r() * W;
    const cy = y(0.15 + r() * 0.7);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rad = 2 + r() * 5;
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.7);
    }
    ctx.fill();
  }
  // Dado rail, skirting and cornice.
  fill(ctx, hand, r, 0, y(0.97), W, y(0.92) - y(0.97), rail);
  ctx.fillStyle = css(shade(rail, 1.25), 0.6);
  ctx.fillRect(0, y(0.97), W, 3);
  line(ctx, hand, r, look.ink, rail, 0, y(0.92), W, y(0.92), 2);
  line(ctx, hand, r, look.ink, rail, 0, y(0.97), W, y(0.97), 1.5);
  fill(ctx, hand, r, 0, y(0.13), W, y(0) - y(0.13), skirting);
  ctx.fillStyle = css(shade(skirting, 1.3), 0.6);
  ctx.fillRect(0, y(0.13), W, 3);
  line(ctx, hand, r, look.ink, skirting, 0, y(0.13), W, y(0.13), 2);
  // Scuffs along the skirting, where feet and the hoover meet it.
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = css(0x30241c, 0.12 + r() * 0.12);
    ctx.lineWidth = 1 + r() * 2;
    const sx = r() * W;
    const sy = y(0.02 + r() * 0.2);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 6 + r() * 16, sy + (r() - 0.5) * 3);
    ctx.stroke();
  }
  fill(ctx, hand, r, 0, y(2.4), W, y(2.32) - y(2.4), mix(paper, 0xffffff, 0.6));
  line(ctx, hand, r, look.ink, paper, 0, y(2.32), W, y(2.32), 2);
  grain(ctx, hand, r, W, H);
  // The wall's cut top, the dollhouse section: a dark warm band the top faces sample.
  ctx.fillStyle = css(mix(skirting, look.ink, 0.55));
  ctx.fillRect(0, 0, W, 10);
  return c;
}

/** Metres the floor texture spans each way. */
export const FLOOR_TILE = 4;

/** Oak boards in staggered lengths, each its own tone, grain and knots, with scratches and scuffs of wear. */
export function floorCanvas(look: Look): HTMLCanvasElement {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const r = rng(7);
  const hand = look.hand;
  const { plank, gap, worn } = look.floor;
  const rows = 24;
  const rowH = S / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 300;
    const y0 = row * rowH;
    while (x < S) {
      const len = 256 + r() * 300;
      const tone = mix(shade(plank, 0.84 + r() * 0.26), worn, r() * 0.25);
      fill(ctx, hand, r, x, y0, len, rowH, tone, 'h');
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y0, len, rowH);
      ctx.clip();
      for (let k = 0; k < 5; k++) {
        const gy = y0 + 4 + r() * (rowH - 8);
        ctx.strokeStyle = css(shade(tone, 0.78), hand === 'paint' ? 0.25 : 0.35);
        ctx.lineWidth = hand === 'paper' ? 0.9 : 1.6;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        for (let t = 0; t <= len; t += 24) {
          ctx.lineTo(x + t, gy + Math.sin((t + k * 40) / 60) * 2.5 * r());
        }
        ctx.stroke();
      }
      if (r() < 0.35) {
        const kx = x + 40 + r() * (len - 80);
        const ky = y0 + rowH / 2 + (r() - 0.5) * 10;
        ctx.strokeStyle = css(shade(tone, 0.65), 0.6);
        ctx.lineWidth = 1.2;
        for (const rad of [3, 6, 9]) {
          ctx.beginPath();
          ctx.ellipse(kx, ky, rad * 1.8, rad * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
      line(ctx, hand, r, gap, tone, x, y0, x, y0 + rowH, 2);
      x += len;
    }
    line(ctx, hand, r, gap, plank, 0, y0, S, y0, 2);
  }
  // Wear: pale scuffs and fine scratches.
  for (let i = 0; i < 26; i++) {
    const cx = r() * S;
    const cy = r() * S;
    const rad = 30 + r() * 80;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, css(worn, 0.18));
    g.addColorStop(1, css(worn, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = css(0xfff4e0, 0.18);
    ctx.lineWidth = 0.8;
    const sx = r() * S;
    const sy = r() * S;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (r() - 0.5) * 40, sy + (r() - 0.5) * 12);
    ctx.stroke();
  }
  grain(ctx, hand, r, S, S, 0.8);
  return c;
}

/** Metres the kitchen tiles' texture spans. */
export const TILES_TILE = 2;

export function tilesCanvas(look: Look): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const r = rng(99);
  const { tile, grout } = look.tiles;
  ctx.fillStyle = css(grout);
  ctx.fillRect(0, 0, S, S);
  const n = 8;
  const t = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const checker = look.hand === 'paint' && (i + j) % 2 === 1;
      const tone = shade(checker ? mix(tile, 0x2e4a5a, 0.75) : tile, 0.9 + r() * 0.16);
      fill(ctx, look.hand, r, i * t + 2, j * t + 2, t - 4, t - 4, tone);
      if (r() < 0.2) {
        ctx.fillStyle = css(grout, 0.9);
        ctx.beginPath();
        ctx.arc(
          i * t + 2 + (r() < 0.5 ? 0 : t - 4),
          j * t + 2 + (r() < 0.5 ? 0 : t - 4),
          3 + r() * 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  if (look.hand === 'paper') {
    for (let i = 0; i <= n; i++) {
      line(ctx, 'paper', r, look.ink, grout, i * t, 0, i * t, S, 1.2);
      line(ctx, 'paper', r, look.ink, grout, 0, i * t, S, i * t, 1.2);
    }
  }
  grain(ctx, look.hand, r, S, S);
  return c;
}

/** A wool rug: a border, a guard stripe, a field with a lattice and a medallion, fringed ends and a worn middle. */
export function rugCanvas(look: Look): HTMLCanvasElement {
  const W = 576;
  const H = 400;
  const [c, ctx] = canvas(W, H);
  const r = rng(12);
  const hand = look.hand;
  const [field, light, border, accent] = look.rug;
  fill(ctx, hand, r, 0, 0, W, H, light);
  // Fringes at the short ends.
  ctx.strokeStyle = css(shade(light, 0.85), 0.9);
  ctx.lineWidth = 2;
  for (let y = 4; y < H; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(16, y + (r() - 0.5) * 2);
    ctx.moveTo(W, y);
    ctx.lineTo(W - 16, y + (r() - 0.5) * 2);
    ctx.stroke();
  }
  fill(ctx, hand, r, 18, 8, W - 36, H - 16, border);
  fill(ctx, hand, r, 42, 32, W - 84, H - 64, light);
  fill(ctx, hand, r, 52, 42, W - 104, H - 84, field);
  // A row of little diamonds round the border.
  ctx.fillStyle = css(accent, 0.9);
  for (let x = 30; x < W - 24; x += 22) {
    for (const y of [20, H - 20]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.fill();
    }
  }
  for (let y = 44; y < H - 30; y += 22) {
    for (const x of [30, W - 30]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.fill();
    }
  }
  // Lattice over the field.
  ctx.save();
  ctx.beginPath();
  ctx.rect(52, 42, W - 104, H - 84);
  ctx.clip();
  ctx.strokeStyle = css(mix(field, light, 0.45), 0.7);
  ctx.lineWidth = 2.5;
  for (let k = -H; k < W; k += 48) {
    ctx.beginPath();
    ctx.moveTo(k, 42);
    ctx.lineTo(k + H, 42 + H);
    ctx.moveTo(k + H, 42);
    ctx.lineTo(k, 42 + H);
    ctx.stroke();
  }
  // Medallion.
  const cx = W / 2;
  const cy = H / 2;
  for (const [rx, ry, col] of [
    [150, 100, border],
    [130, 84, light],
    [104, 64, accent],
    [70, 40, field],
    [30, 18, light],
  ] as const) {
    ctx.fillStyle = css(col);
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy);
    ctx.lineTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Worn in the middle where it is walked on.
  const g = ctx.createRadialGradient(cx, cy + 40, 10, cx, cy + 40, 220);
  g.addColorStop(0, css(0xfff0d8, 0.2));
  g.addColorStop(1, css(0xfff0d8, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (hand === 'paper') {
    line(ctx, hand, r, look.ink, border, 18, 8, W - 18, 8, 1.6);
    line(ctx, hand, r, look.ink, border, 18, H - 8, W - 18, H - 8, 1.6);
  }
  // Wool: short tufts everywhere.
  for (let i = 0; i < (W * H) / 30; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(r() * W, r() * H, 1.5, 2.5);
  }
  return c;
}

/** The three paintings on the walls: a mountain sunset with a pine, a botanical print, a still life of flowers. */
export function paintingCanvas(look: Look, which: 1 | 2 | 3): HTMLCanvasElement {
  const W = which === 3 ? 192 : 288;
  const H = which === 3 ? 268 : 200;
  const [c, ctx] = canvas(W, H);
  const r = rng(which * 31);
  const hand = look.hand;
  if (which === 1) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, css(0x7a9ad0));
    sky.addColorStop(0.55, css(0xf0b890));
    sky.addColorStop(1, css(0xf8dcb0));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(0xfff0c0);
    ctx.beginPath();
    ctx.arc(W * 0.66, H * 0.48, 22, 0, Math.PI * 2);
    ctx.fill();
    const hills: [number, number][] = [
      [0.55, 0x8a7aa8],
      [0.68, 0x6a7a9a],
      [0.8, 0x4a6a6a],
    ];
    for (const [base, col] of hills) {
      ctx.fillStyle = css(col);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 12)
        ctx.lineTo(x, H * base - Math.sin(x / 30 + base * 9) * 14 - r() * 6);
      ctx.lineTo(W, H);
      ctx.fill();
    }
    // A windswept pine on the near ridge.
    ctx.strokeStyle = css(0x3a2a24);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(60, H * 0.86);
    ctx.quadraticCurveTo(70, H * 0.6, 100, H * 0.5);
    ctx.stroke();
    ctx.fillStyle = css(0x2e5a3e);
    for (const [x, y, rx] of [
      [100, H * 0.48, 34],
      [74, H * 0.6, 24],
      [120, H * 0.56, 20],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.4, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (which === 2) {
    ctx.fillStyle = css(0xf4ecd8);
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css(0x5a4a3a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, H - 30);
    ctx.quadraticCurveTo(W / 2, H / 2, W - 50, 30);
    ctx.stroke();
    for (let k = 0; k < 9; k++) {
      const t = (k + 1) / 10;
      const x = 40 + (W - 90) * t;
      const y = H - 30 - (H - 60) * t + Math.sin(t * 3) * 10;
      ctx.fillStyle = css(mix(0x5a8a4a, 0x9ab86a, r()));
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * 12, y - 8, 16, 6, side * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = css(0x5a4a3a, 0.8);
    ctx.font = 'italic 14px serif';
    ctx.fillText('Juniperus', 24, 26);
  } else {
    ctx.fillStyle = css(0x3a3a4a);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(0x6a5a4a);
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.fillStyle = css(0x4a7aa0);
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.7, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(W / 2 - 16, H * 0.5, 32, 30);
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = css([0xf0c050, 0xe86a5a, 0xf4ecdc, 0xe890a0][k % 4] ?? 0xffffff);
      ctx.beginPath();
      ctx.arc(W / 2 + (r() - 0.5) * 100, H * 0.38 - r() * 80, 12 + r() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Every picture in the take's hand: brushwork, paper and an ink border, or felt.
  if (hand === 'paint') {
    const copy = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < (W * H) / 18; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      const k = (y * W + x) * 4;
      const col =
        ((copy.data[k] ?? 0) << 16) | ((copy.data[k + 1] ?? 0) << 8) | (copy.data[k + 2] ?? 0);
      ctx.strokeStyle = css(shade(col, 0.92 + r() * 0.16), 0.7);
      ctx.lineWidth = 2 + r() * 3;
      ctx.lineCap = 'round';
      const a = r() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.stroke();
    }
  }
  grain(ctx, hand, r, W, H, 1.4);
  return c;
}

/** Metres a furniture surface's grain spans. */
export const DETAIL_TILE = { wood: 0.6, fabric: 0.35, plain: 0.5, brick: 1.1 };

/** Near-white surfaces the vertex colours tint: wood grain, a fabric weave, plain paper, and coloured brick. */
export function detailCanvas(
  look: Look,
  kind: 'wood' | 'fabric' | 'plain' | 'brick',
): HTMLCanvasElement {
  const S = kind === 'brick' ? 512 : 256;
  const [c, ctx] = canvas(S, S);
  const r = rng(kind.length * 17);
  const hand = look.hand;
  const base = 0xf6f2ec;
  if (kind === 'wood') {
    fill(ctx, hand, r, 0, 0, S, S, base);
    for (let k = 0; k < 22; k++) {
      const gy = r() * S;
      ctx.strokeStyle = css(shade(base, 0.72 + r() * 0.12), 0.5);
      ctx.lineWidth = 0.8 + r() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= S; x += 16) ctx.lineTo(x, gy + Math.sin((x + k * 30) / 40) * 3);
      ctx.stroke();
    }
  } else if (kind === 'fabric') {
    fill(ctx, hand, r, 0, 0, S, S, base);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < S; x += 4) ctx.fillRect(x, 0, 2, S);
    for (let i = 0; i < 60; i++) {
      const cx = r() * S;
      const cy = r() * S;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 30, cy - 30, 60, 60);
    }
  } else if (kind === 'plain') {
    fill(ctx, hand, r, 0, 0, S, S, base);
  } else {
    const mortar = 0xd8ccb8;
    ctx.fillStyle = css(mortar);
    ctx.fillRect(0, 0, S, S);
    const bw = S / 4.6;
    const bh = S / 15;
    for (let row = 0; row < 15; row++) {
      const off = row % 2 === 0 ? 0 : -bw / 2;
      for (let x = off; x < S; x += bw) {
        const tone = mix(shade(0xb45a40, 0.8 + r() * 0.3), 0x7a6a60, r() * 0.25);
        fill(ctx, hand, r, x + 2, row * bh + 2, bw - 4, bh - 4, tone);
      }
    }
    if (hand === 'paper') {
      for (let row = 0; row <= 15; row++)
        line(ctx, hand, r, look.ink, mortar, 0, row * bh, S, row * bh, 0.9);
    }
  }
  grain(ctx, hand, r, S, S, 1.2);
  return c;
}

/** The sunlit patch a window throws on the floor: two panes either side of the mullion, soft at the edges. */
export function patchCanvas(): HTMLCanvasElement {
  const W = 128;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = '#fff';
  ctx.fillRect(8, 8, W / 2 - 13, H - 16);
  ctx.fillRect(W / 2 + 5, 8, W / 2 - 13, H - 16);
  ctx.filter = 'none';
  return c;
}
