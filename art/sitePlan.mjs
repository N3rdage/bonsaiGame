// Draws the site-plan diagrams for docs/site-plan/ (backlog #129): three
// candidate layouts of the whole property seen from above, north up, at
// 40 px per metre on a 1 m grid, and one diagram of how today's doors
// contradict each other.
//
// Plans: rooms are flat-tinted rectangles in real metres (house cream, shed
// wood, greenhouse glass, lawn green, outside paper), walls 0.3 m thick,
// garden fences dashed. Every door is a 0.8 m gap (1.6 m double gap, tinted
// blue, when glazed) with a two-headed arrow through it, and each side of a
// door carries the index of its row in that layout's door table in
// docs/site-plan/README.md, drawn inside the room the row belongs to.
//
// Today: the six rooms as separate boxes, each door on the wall it is in
// today, and a curve per door pair that leaves one door the way the player
// walks out and enters the other the way the player walks in. Pairs whose
// walls face each other draw straight and blue; pairs that contradict loop
// and draw red.
//
// Labels use the 5x7 font in sitePlanFont.mjs. No randomness, so a rerun
// reproduces the committed bytes. Run with `npm run art:site-plan`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
import { GLYPH_HEIGHT, rasterize, textWidth } from './sitePlanFont.mjs';

const { PNG } = pngjs;

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'site-plan');

const MARGIN = 40;
const HEADER = 50;
const FOOTER = 70;
const WALL = 0.3;
const DOOR = 0.8;
const GLAZED_DOOR = 1.6;

const PAPER = [246, 242, 232];
const INK = [40, 34, 30];
const WALL_INK = [62, 52, 44];
const FENCE = [92, 76, 56];
const THRESHOLD = [250, 248, 242];
const GLASS_DOOR = [176, 214, 240];
const PLANT = [52, 104, 56];
const LABEL_BACK = [255, 255, 255];
const AGREE = [52, 84, 140];
const CONTRADICT = [196, 44, 36];
const FILLS = {
  house: [240, 226, 196],
  shed: [200, 156, 108],
  greenhouse: [206, 232, 216],
  garden: [156, 200, 124],
};

/** The outward unit normal of each wall, in metres with x east and y south. */
const OUTWARD = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// ---------------------------------------------------------------- canvas

function canvas(width, height) {
  const png = new PNG({ width, height });
  const c = {
    png,
    set(x, y, [r, g, b]) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    },
    darken(x, y, f) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      for (let k = 0; k < 3; k += 1) png.data[i + k] = Math.round(png.data[i + k] * f);
    },
    rect(x0, y0, x1, y1, colour) {
      for (let y = Math.round(y0); y < Math.round(y1); y += 1) {
        for (let x = Math.round(x0); x < Math.round(x1); x += 1) c.set(x, y, colour);
      }
    },
    disc(cx, cy, r, colour) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) c.set(x, y, colour);
        }
      }
    },
    line(x0, y0, x1, y1, r, colour) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let s = 0; s <= steps; s += 1) {
        c.disc(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, r, colour);
      }
    },
    triangle(points, colour) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const side = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
          const [a, b, d] = points;
          const s1 = side(a, b, x + 0.5, y + 0.5);
          const s2 = side(b, d, x + 0.5, y + 0.5);
          const s3 = side(d, a, x + 0.5, y + 0.5);
          if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) c.set(x, y, colour);
        }
      }
    },
    /** An arrowhead whose tip is at (x, y), pointing along the unit vector (dx, dy). */
    head(x, y, dx, dy, length, halfWidth, colour) {
      const bx = x - dx * length;
      const by = y - dy * length;
      c.triangle(
        [
          [x, y],
          [bx - dy * halfWidth, by + dx * halfWidth],
          [bx + dy * halfWidth, by - dx * halfWidth],
        ],
        colour,
      );
    },
    text(str, x, y, scale, colour) {
      rasterize(str, Math.round(x), Math.round(y), scale, (px, py) => c.set(px, py, colour));
    },
    /** Draws `str` centred on (cx, cy). */
    centred(str, cx, cy, scale, colour) {
      c.text(str, cx - textWidth(str, scale) / 2, cy - (GLYPH_HEIGHT * scale) / 2, scale, colour);
    },
    save(name) {
      writeFileSync(join(OUT, name), PNG.sync.write(png));
      console.log(`${name}  ${String(width)}x${String(height)}`);
    },
  };
  c.rect(0, 0, width, height, PAPER);
  return c;
}

/** Maps metres to pixels for a drawing whose origin sits at (ox, oy) on the canvas. */
function projection(ox, oy, scale) {
  return { x: (m) => ox + Math.round(m * scale), y: (m) => oy + Math.round(m * scale), scale };
}

// ---------------------------------------------------------------- shared pieces

function drawRoomFill(c, p, [x0, y0, x1, y1], colour) {
  c.rect(p.x(x0), p.y(y0), p.x(x1), p.y(y1), colour);
}

function drawWalls(c, p, [x0, y0, x1, y1]) {
  const t = (WALL * p.scale) / 2;
  const [l, r, top, bottom] = [p.x(x0), p.x(x1), p.y(y0), p.y(y1)];
  c.rect(l - t, top - t, r + t, top + t, WALL_INK);
  c.rect(l - t, bottom - t, r + t, bottom + t, WALL_INK);
  c.rect(l - t, top - t, l + t, bottom + t, WALL_INK);
  c.rect(r - t, top - t, r + t, bottom + t, WALL_INK);
}

/** A dashed fence from (x0, y0) to (x1, y1) in metres; the run is horizontal or vertical. */
function drawFence(c, p, [x0, y0], [x1, y1]) {
  const ax = p.x(x0);
  const ay = p.y(y0);
  const length = Math.abs(p.x(x1) - ax) + Math.abs(p.y(y1) - ay);
  const dx = Math.sign(p.x(x1) - ax);
  const dy = Math.sign(p.y(y1) - ay);
  for (let s = 0; s <= length; s += 1) {
    if (s % 16 >= 10) continue;
    c.rect(ax + dx * s - 2, ay + dy * s - 2, ax + dx * s + 2, ay + dy * s + 2, FENCE);
  }
}

/** The gap of a door centred at `at` in a wall of the given side, ink cleared and tinted. */
function drawDoorGap(c, p, { at: [mx, my], wall, glazed }) {
  const horizontal = wall === 'N' || wall === 'S';
  const half = ((glazed ? GLAZED_DOOR : DOOR) * p.scale) / 2;
  const depth = (WALL * p.scale) / 2 + 1;
  const cx = p.x(mx);
  const cy = p.y(my);
  const tint = glazed ? GLASS_DOOR : THRESHOLD;
  if (horizontal) {
    c.rect(cx - half, cy - depth, cx + half, cy + depth, tint);
    if (glazed) c.rect(cx - 1, cy - depth, cx + 1, cy + depth, WALL_INK);
  } else {
    c.rect(cx - depth, cy - half, cx + depth, cy + half, tint);
    if (glazed) c.rect(cx - depth, cy - 1, cx + depth, cy + 1, WALL_INK);
  }
}

/** Fits `lines` inside a width of `room` pixels: 3x if every line fits, else 2x. */
function labelScale(lines, room) {
  return lines.every((l) => textWidth(l, 3) <= room - 8) ? 3 : 2;
}

function drawRoomLabel(c, cx, cy, lines, roomWidth) {
  const scale = labelScale(lines, roomWidth);
  const step = GLYPH_HEIGHT * scale + 6;
  lines.forEach((line, i) => {
    c.centred(line, cx, cy + (i - (lines.length - 1) / 2) * step, scale, INK);
  });
}

function drawCompass(c, cx, cy) {
  for (let a = 0; a < 360; a += 1) {
    const r = (a * Math.PI) / 180;
    c.disc(cx + Math.cos(r) * 18, cy + Math.sin(r) * 18, 1.2, INK);
  }
  c.triangle(
    [
      [cx, cy - 15],
      [cx - 7, cy + 10],
      [cx, cy + 5],
    ],
    INK,
  );
  c.triangle(
    [
      [cx, cy - 15],
      [cx + 7, cy + 10],
      [cx, cy + 5],
    ],
    WALL_INK,
  );
  c.centred('N', cx, cy - 30, 2, INK);
}

function drawScaleBar(c, x, y, pxPerMetre) {
  for (let m = 0; m < 5; m += 1) {
    const x0 = x + m * pxPerMetre;
    c.rect(x0, y, x0 + pxPerMetre, y + 10, INK);
    if (m % 2 === 1) c.rect(x0 + 1, y + 2, x0 + pxPerMetre - 1, y + 8, PAPER);
  }
  c.text('0', x - 4, y + 16, 2, INK);
  c.text('5 M', x + 5 * pxPerMetre - textWidth('5 M', 2) / 2, y + 16, 2, INK);
  c.text('GRID 1 M', x + 5 * pxPerMetre + 40, y - 2, 2, INK);
}

// ---------------------------------------------------------------- plans

const PX_PER_METRE = 40;

const HOUSE = [
  { lines: ['LOUNGE', '6.0 X 4.5'], kind: 'house', rect: [0, 0, 6, 4.5], label: [3, 1.3] },
  { lines: ['HALLWAY', '2.5 X', '4.5'], kind: 'house', rect: [6, 0, 8.5, 4.5], label: [7.25, 1.0] },
  { lines: ['STUDY', '4.5 X 4.5'], kind: 'house', rect: [8.5, 0, 13, 4.5], label: [10.75, 1.3] },
];

const PLANS = [
  {
    file: 'plan-a-the-l.png',
    title: 'PLAN A  THE L',
    extent: [13, 17.5],
    rooms: [
      ...HOUSE,
      { lines: ['SHED', '5.0 X 3.5'], kind: 'shed', rect: [0, 4.5, 5, 8], label: [2.2, 6.25] },
      { lines: ['GREENHOUSE', '8.0 X 5.0'], kind: 'greenhouse', rect: [5, 12.5, 13, 17.5] },
    ],
    garden: { rects: [[5, 4.5, 13, 12.5]], label: [9, 8.5], lines: ['GARDEN', '8.0 X 8.0'] },
    fences: [
      [
        [5, 8],
        [5, 12.5],
      ],
      [
        [13, 4.5],
        [13, 12.5],
      ],
    ],
    plantsLabel: [10.05, 7.5],
    plants: [
      [12.35, 6.5],
      [12.35, 7.5],
      [12.35, 8.5],
    ],
    doors: [
      { at: [2.5, 4.5], wall: 'S', rows: [3, 1] },
      { at: [5, 6.25], wall: 'E', rows: [2, 9] },
      { at: [6, 2.25], wall: 'E', rows: [4, 5] },
      { at: [8.5, 2.25], wall: 'E', rows: [6, 7] },
      { at: [10.75, 4.5], wall: 'S', rows: [8, 10], glazed: true },
      { at: [9, 12.5], wall: 'S', rows: [11, 12] },
    ],
  },
  {
    file: 'plan-b-lean-to.png',
    title: 'PLAN B  LEAN-TO',
    extent: [18, 16],
    rooms: [
      ...HOUSE,
      { lines: ['SHED', '5.0 X 3.5'], kind: 'shed', rect: [0, 4.5, 5, 8], label: [2.5, 6.25] },
      { lines: ['GREENHOUSE', '5.0 X 8.0'], kind: 'greenhouse', rect: [13, 8, 18, 16], label: [15.5, 10] },
    ],
    garden: {
      rects: [
        [5, 4.5, 13, 8],
        [0, 8, 13, 16],
      ],
      label: [6.5, 12],
      lines: ['GARDEN', '13.0 X 8.0', '+ 8.0 X 3.5'],
    },
    fences: [
      [
        [13, 4.5],
        [13, 8],
      ],
      [
        [0, 8],
        [0, 16],
      ],
      [
        [0, 16],
        [13, 16],
      ],
    ],
    plantsLabel: [3.5, 14.6],
    plants: [
      [2.5, 15.35],
      [3.5, 15.35],
      [4.5, 15.35],
    ],
    doors: [
      { at: [2.5, 4.5], wall: 'S', rows: [3, 1] },
      { at: [2.5, 8], wall: 'S', rows: [2, 9] },
      { at: [6, 2.25], wall: 'E', rows: [4, 5] },
      { at: [8.5, 2.25], wall: 'E', rows: [6, 7] },
      { at: [10.75, 4.5], wall: 'S', rows: [8, 10], glazed: true },
      { at: [13, 12], wall: 'E', rows: [11, 12] },
    ],
  },
  {
    file: 'plan-c-across-the-lawn.png',
    title: 'PLAN C  ACROSS THE LAWN',
    extent: [13, 17.5],
    rooms: [
      ...HOUSE,
      { lines: ['SHED', '5.0 X 3.5'], kind: 'shed', rect: [0, 12.5, 5, 16] },
      { lines: ['GREENHOUSE', '8.0 X 5.0'], kind: 'greenhouse', rect: [5, 12.5, 13, 17.5] },
    ],
    garden: { rects: [[0, 4.5, 13, 12.5]], label: [5.5, 8.5], lines: ['GARDEN', '13.0 X 8.0'] },
    fences: [
      [
        [0, 4.5],
        [0, 12.5],
      ],
      [
        [13, 4.5],
        [13, 12.5],
      ],
    ],
    plantsLabel: [10.05, 8.5],
    plants: [
      [12.35, 7.5],
      [12.35, 8.5],
      [12.35, 9.5],
    ],
    doors: [
      { at: [3, 4.5], wall: 'S', rows: [2, 8] },
      { at: [6, 2.25], wall: 'E', rows: [3, 4] },
      { at: [8.5, 2.25], wall: 'E', rows: [5, 6] },
      { at: [10.75, 4.5], wall: 'S', rows: [7, 9], glazed: true },
      { at: [2.5, 12.5], wall: 'S', rows: [10, 1] },
      { at: [9, 12.5], wall: 'S', rows: [11, 12] },
    ],
  },
];

/**
 * Draws a door's two-headed arrow and its two row indices. `wall` is the
 * door's wall as seen from the north or west room, whose row comes first in
 * `rows`; the second row belongs to the room south or east of the wall.
 */
function drawDoorMarks(c, p, { at: [mx, my], wall, rows, glazed }) {
  const [nx, ny] = OUTWARD[wall];
  const cx = p.x(mx);
  const cy = p.y(my);
  const reach = 26;
  c.line(cx - nx * (reach - 6), cy - ny * (reach - 6), cx + nx * (reach - 6), cy + ny * (reach - 6), 1.5, INK);
  c.head(cx + nx * reach, cy + ny * reach, nx, ny, 9, 6, INK);
  c.head(cx - nx * reach, cy - ny * reach, -nx, -ny, 9, 6, INK);
  const along = (((glazed ? GLAZED_DOOR : DOOR) / 2) * p.scale) + 14;
  const [ax, ay] = [Math.abs(ny), Math.abs(nx)];
  rows.forEach((row, i) => {
    const side = i === 0 ? -1 : 1;
    const lx = cx + ax * along + nx * side * 18;
    const ly = cy + ay * along + ny * side * 18;
    const label = String(row);
    const w = textWidth(label, 2);
    c.rect(lx - w / 2 - 3, ly - 10, lx + w / 2 + 3, ly + 10, LABEL_BACK);
    c.centred(label, lx, ly, 2, INK);
  });
}

function drawPlan(plan) {
  const [ew, eh] = plan.extent;
  const width = ew * PX_PER_METRE + 2 * MARGIN;
  const height = eh * PX_PER_METRE + MARGIN + HEADER + FOOTER;
  const c = canvas(width, height);
  const p = projection(MARGIN, MARGIN + HEADER, PX_PER_METRE);

  for (const r of plan.garden.rects) drawRoomFill(c, p, r, FILLS.garden);
  for (const room of plan.rooms) drawRoomFill(c, p, room.rect, FILLS[room.kind]);

  for (let m = 0; m <= ew; m += 1) {
    for (let y = p.y(0); y <= p.y(eh); y += 1) c.darken(p.x(m), y, 0.9);
  }
  for (let m = 0; m <= eh; m += 1) {
    for (let x = p.x(0); x <= p.x(ew); x += 1) c.darken(x, p.y(m), 0.9);
  }

  for (const room of plan.rooms) drawWalls(c, p, room.rect);
  for (const [a, b] of plan.fences) drawFence(c, p, a, b);
  for (const door of plan.doors) drawDoorGap(c, p, door);

  for (const [px, py] of plan.plants) {
    c.disc(p.x(px), p.y(py), 9, INK);
    c.disc(p.x(px), p.y(py), 7, PLANT);
  }

  for (const room of plan.rooms) {
    const [x0, y0, x1, y1] = room.rect;
    const [lx, ly] = room.label ?? [(x0 + x1) / 2, (y0 + y1) / 2];
    drawRoomLabel(c, p.x(lx), p.y(ly), room.lines, (x1 - x0) * PX_PER_METRE);
  }
  const [gx, gy] = plan.garden.label;
  drawRoomLabel(c, p.x(gx), p.y(gy), plan.garden.lines, 1000);
  const [plx, ply] = plan.plantsLabel;
  c.centred('SOURCE PLANTS', p.x(plx), p.y(ply), 2, INK);

  for (const door of plan.doors) drawDoorMarks(c, p, door);

  c.text(plan.title, MARGIN, 24, 3, INK);
  drawCompass(c, width - MARGIN - 20, 54);
  drawScaleBar(c, MARGIN, p.y(eh) + 24, PX_PER_METRE);
  c.save(plan.file);
}

// ---------------------------------------------------------------- today

const TODAY_SCALE = 32;

const TODAY_ROOMS = [
  { name: 'LOUNGE', kind: 'house', rect: [3, 0, 9, 4.5], labelY: 1.2 },
  { name: 'HALLWAY', kind: 'house', rect: [10.5, 0, 13.5, 4.5], labelY: 1.2 },
  { name: 'STUDY', kind: 'house', rect: [15, 0, 19.5, 4.5], labelY: 1.2 },
  { name: 'SHED', kind: 'shed', rect: [3, 6.5, 8, 10] },
  { name: 'GREENHOUSE', kind: 'greenhouse', rect: [10, 6.5, 16, 10.5] },
];

const TODAY_GARDEN = [3, 12.5, 19.5, 18.5];

/** Each pair: the two doors as { at, wall } in the walls they are in today. */
const TODAY_PAIRS = [
  [
    { at: [5.5, 6.5], wall: 'N' },
    { at: [5.5, 4.5], wall: 'S' },
  ],
  [
    { at: [5.5, 10], wall: 'S' },
    { at: [3, 15.5], wall: 'W' },
  ],
  [
    { at: [9, 2.25], wall: 'E' },
    { at: [10.5, 2.25], wall: 'W' },
  ],
  [
    { at: [13.5, 2.25], wall: 'E' },
    { at: [15, 2.25], wall: 'W' },
  ],
  [
    { at: [17.25, 4.5], wall: 'S', glazed: true },
    { at: [19.5, 15.5], wall: 'E' },
  ],
  [
    { at: [13, 12.5], wall: 'N' },
    { at: [13, 10.5], wall: 'S' },
  ],
];

/**
 * A curve from just inside door `a` to just inside door `b`: it leaves `a`
 * along a's outward normal and enters `b` against b's outward normal, the
 * way the player walks. Heads at both ends point into the rooms.
 */
function drawPairCurve(c, p, a, b) {
  const [ex, ey] = OUTWARD[a.wall];
  const [ix, iy] = OUTWARD[b.wall].map((v) => -v);
  const agree = ex === ix && ey === iy;
  const colour = agree ? AGREE : CONTRADICT;
  const start = [a.at[0] - ex * 0.5, a.at[1] - ey * 0.5];
  const end = [b.at[0] + ix * 0.5, b.at[1] + iy * 0.5];
  const k = Math.min(3.5, 0.45 * Math.hypot(end[0] - start[0], end[1] - start[1]));
  const c1 = [a.at[0] + ex * k, a.at[1] + ey * k];
  const c2 = [b.at[0] - ix * k, b.at[1] - iy * k];
  const point = (t) => {
    const u = 1 - t;
    return [0, 1].map(
      (d) => u * u * u * start[d] + 3 * u * u * t * c1[d] + 3 * u * t * t * c2[d] + t * t * t * end[d],
    );
  };
  const points = [];
  for (let s = 0; s <= 240; s += 1) points.push(point(s / 240));
  for (const [r, ink] of [
    [4, PAPER],
    [2, colour],
  ]) {
    for (let s = 6; s < points.length - 6; s += 1) {
      const [x0, y0] = points[s - 1];
      const [x1, y1] = points[s];
      c.line(p.x(x0), p.y(y0), p.x(x1), p.y(y1), r, ink);
    }
  }
  c.head(p.x(end[0]), p.y(end[1]), ix, iy, 14, 8, colour);
  c.head(p.x(start[0]), p.y(start[1]), -ex, -ey, 14, 8, colour);
}

function drawToday() {
  const width = 23.5 * TODAY_SCALE + 2 * MARGIN;
  const height = 18.5 * TODAY_SCALE + 2 * MARGIN + HEADER + 20;
  const c = canvas(width, height);
  const p = projection(MARGIN, MARGIN + HEADER, TODAY_SCALE);

  drawRoomFill(c, p, TODAY_GARDEN, FILLS.garden);
  for (const room of TODAY_ROOMS) drawRoomFill(c, p, room.rect, FILLS[room.kind]);
  for (const room of TODAY_ROOMS) drawWalls(c, p, room.rect);
  const [gx0, gy0, gx1, gy1] = TODAY_GARDEN;
  drawFence(c, p, [gx0, gy0], [gx1, gy0]);
  drawFence(c, p, [gx0, gy1], [gx1, gy1]);
  drawFence(c, p, [gx0, gy0], [gx0, gy1]);
  drawFence(c, p, [gx1, gy0], [gx1, gy1]);
  for (const pair of TODAY_PAIRS) for (const door of pair) drawDoorGap(c, p, door);

  for (const room of TODAY_ROOMS) {
    const [x0, y0, x1, y1] = room.rect;
    drawRoomLabel(c, p.x((x0 + x1) / 2), p.y(room.labelY ?? (y0 + y1) / 2), [room.name], (x1 - x0) * TODAY_SCALE);
  }
  drawRoomLabel(c, p.x(11.25), p.y(17.2), ['GARDEN'], 1000);

  for (const [a, b] of TODAY_PAIRS) drawPairCurve(c, p, a, b);

  c.text('TODAY  WHERE EACH DOOR LANDS', MARGIN, 24, 3, INK);
  const ly = p.y(18.5) + 26;
  c.line(MARGIN, ly, MARGIN + 40, ly, 2, AGREE);
  c.text('WALLS FACE EACH OTHER', MARGIN + 52, ly - 7, 2, INK);
  c.line(MARGIN + 380, ly, MARGIN + 420, ly, 2, CONTRADICT);
  c.text('WALLS CONTRADICT', MARGIN + 432, ly - 7, 2, INK);
  c.save('plan-today.png');
}

mkdirSync(OUT, { recursive: true });
for (const plan of PLANS) drawPlan(plan);
drawToday();
