import { describe, expect, it } from 'vitest';
import type { AheadBuild, RoomChange } from './roomCache';
import { roomTimeLines, SHOWN_BUILDS, SHOWN_CHANGES } from './roomTimes';

describe('roomTimeLines', () => {
  it('says none yet for empty lists and ends with the user agent', () => {
    expect(roomTimeLines([], [], 'UA')).toEqual([
      'Room changes',
      'none yet',
      'Built ahead',
      'none yet',
      'UA',
    ]);
  });

  it('lists changes newest first, rounded, first or kept, with dressed only when present', () => {
    const changes: RoomChange[] = [
      { room: 'shed', first: true, ms: 411.6, dressedMs: 530.2 },
      { room: 'hallway', first: false, ms: 18.4 },
    ];
    const aheads: AheadBuild[] = [
      { room: 'garden', ms: 96.4 },
      { room: 'lounge', ms: 40.6 },
    ];
    expect(roomTimeLines(changes, aheads, 'UA')).toEqual([
      'Room changes',
      'hallway  kept  18 ms',
      'shed  first  412 ms  dressed 530 ms',
      'Built ahead',
      'lounge  41 ms',
      'garden  96 ms',
      'UA',
    ]);
  });

  it('caps the changes and the builds at the newest', () => {
    const changes = Array.from({ length: 20 }, (_, n): RoomChange => ({
      room: 'shed',
      first: false,
      ms: n,
    }));
    const aheads = Array.from({ length: 20 }, (_, n): AheadBuild => ({ room: 'garden', ms: n }));
    const lines = roomTimeLines(changes, aheads, 'UA');
    expect(lines).toHaveLength(SHOWN_CHANGES + SHOWN_BUILDS + 3);
    expect(lines[1]).toBe('shed  kept  19 ms');
    expect(lines[SHOWN_CHANGES]).toBe(`shed  kept  ${String(20 - SHOWN_CHANGES)} ms`);
    expect(lines[SHOWN_CHANGES + 2]).toBe('garden  19 ms');
  });
});
