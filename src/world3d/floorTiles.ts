/**
 * The 3D floor's Inked tiles: `floorTiles` (src/world/roomArt.ts) is the
 * layout, the same frame per tile the 2D floor draws, and this turns it into
 * quads in plan metres with each frame's rect of the sheet's image, then into
 * one mesh's vertex arrays. Pure data; the renderer loads the texture.
 */

import { TILE, floorTiles } from '../world/roomArt';
import type { Room } from '../world/shedRoom';
import { toBabylon } from './meshes';
import { metres } from './plan';

/** How far the tiles lie above the floor's top (z 0), under the 0.01 m rugs. */
export const FLOOR_LIFT = 0.003;

/** One tile: its corners in plan metres (x east, y south), its frame, and that frame's UV rect (v up, as Babylon reads an image). */
export interface FloorQuad {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly frame: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/** The room's floor sheet key and its tiles. */
export interface FloorLayout {
  readonly sheet: string;
  readonly quads: readonly FloorQuad[];
}

/**
 * The quads of `room`'s floor for a sheet image of `imageWidth` x `imageHeight`
 * px, whose frames run left to right then down as Phaser slices a spritesheet.
 * A tile cut short by the area's edge keeps the matching part of its frame;
 * every rect is inset half a texel so a nearest sample never reads the
 * neighbouring frame.
 */
export function floorLayout(room: Room, imageWidth: number, imageHeight: number): FloorLayout {
  const { sheet, area, frames } = floorTiles(room);
  const columns = Math.max(1, Math.floor(imageWidth / sheet.frameWidth));
  const insetU = 0.5 / imageWidth;
  const insetV = 0.5 / imageHeight;
  const quads = frames.flatMap((row, r) =>
    row.map((frame, c): FloorQuad => {
      const x = c * TILE;
      const y = r * TILE;
      const w = Math.min(TILE, area.w - x);
      const h = Math.min(TILE, area.h - y);
      const left = (frame % columns) * sheet.frameWidth;
      const top = Math.floor(frame / columns) * sheet.frameHeight;
      return {
        x0: metres(area.x + x),
        y0: metres(area.y + y),
        x1: metres(area.x + x + w),
        y1: metres(area.y + y + h),
        frame,
        u0: left / imageWidth + insetU,
        v0: 1 - (top + (h / TILE) * sheet.frameHeight) / imageHeight + insetV,
        u1: (left + (w / TILE) * sheet.frameWidth) / imageWidth - insetU,
        v1: 1 - top / imageHeight - insetV,
      };
    }),
  );
  return { sheet: sheet.key, quads };
}

/** The arrays of one mesh of the quads, in Babylon's frame, normals up, each quad's corners NW, NE, SE, SW. */
export interface FloorMeshData {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

/** The vertex arrays of one mesh holding every quad, lifted `FLOOR_LIFT` above the floor. */
export function floorMeshData(quads: readonly FloorQuad[]): FloorMeshData {
  const data: FloorMeshData = { positions: [], normals: [], uvs: [], indices: [] };
  quads.forEach((q, n) => {
    const corners = [
      { x: q.x0, y: q.y0, u: q.u0, v: q.v1 },
      { x: q.x1, y: q.y0, u: q.u1, v: q.v1 },
      { x: q.x1, y: q.y1, u: q.u1, v: q.v0 },
      { x: q.x0, y: q.y1, u: q.u0, v: q.v0 },
    ];
    for (const corner of corners) {
      const at = toBabylon({ x: corner.x, y: corner.y, z: FLOOR_LIFT });
      data.positions.push(at.x, at.y, at.z);
      data.normals.push(0, 1, 0);
      data.uvs.push(corner.u, corner.v);
    }
    const first = n * 4;
    data.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  });
  return data;
}
