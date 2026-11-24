/** The lines of the room-time readout: the latest room changes and the builds made ahead of them. */

import type { AheadBuild, RoomChange } from './roomCache';

/** How many of the latest changes and builds the readout shows, so it fits a phone held landscape. */
export const SHOWN_CHANGES = 8;
export const SHOWN_BUILDS = 6;

const whole = (ms: number): string => String(Math.round(ms));

/** `changes` and `aheads` (oldest first) as lines, newest first, ending with `userAgent`. */
export function roomTimeLines(
  changes: readonly RoomChange[],
  aheads: readonly AheadBuild[],
  userAgent: string,
): string[] {
  const changeLines = changes
    .slice(-SHOWN_CHANGES)
    .reverse()
    .map((c) => {
      const dressed = c.dressedMs === undefined ? '' : `  dressed ${whole(c.dressedMs)} ms`;
      return `${c.room}  ${c.first ? 'first' : 'kept'}  ${whole(c.ms)} ms${dressed}`;
    });
  const buildLines = aheads
    .slice(-SHOWN_BUILDS)
    .reverse()
    .map((b) => `${b.room}  ${whole(b.ms)} ms`);
  return [
    'Room changes',
    ...(changeLines.length > 0 ? changeLines : ['none yet']),
    'Built ahead',
    ...(buildLines.length > 0 ? buildLines : ['none yet']),
    userAgent,
  ];
}
