import { describe, expect, it } from 'vitest';
import { INTERACT_RANGE, nearestInteractable, promptFor } from './interactables';
import { SHED_ROOM, type Prop } from './shedRoom';

function prop(key: string): Prop {
  const p = SHED_ROOM.props.find((q) => q.key === key);
  if (!p) throw new Error(key);
  return p;
}

describe('interactables', () => {
  it('ports interact_range 40 prototype px as 20 logical px', () => {
    expect(INTERACT_RANGE).toBe(20);
  });

  it('finds a prop at the range and not beyond it', () => {
    const bench = prop('workbench');
    expect(nearestInteractable({ x: bench.x, y: bench.y + 20 }, SHED_ROOM.props)?.key).toBe(
      'workbench',
    );
    expect(nearestInteractable({ x: bench.x, y: bench.y + 20.5 }, SHED_ROOM.props)).toBeUndefined();
  });

  it('finds nothing at the player start', () => {
    expect(nearestInteractable(SHED_ROOM.playerStart, SHED_ROOM.props)).toBeUndefined();
  });

  it('picks the nearest when two props are in range', () => {
    // Workbench (125, 90) and planting table (165, 90) are 40 apart: both in range at x 145.
    const y = prop('workbench').y;
    expect(nearestInteractable({ x: 144, y }, SHED_ROOM.props)?.key).toBe('workbench');
    expect(nearestInteractable({ x: 146, y }, SHED_ROOM.props)?.key).toBe('planting_table');
  });

  it("prompts with the prototype objects' prompt strings", () => {
    expect(SHED_ROOM.props.map((p) => [p.key, promptFor(p)])).toEqual([
      ['workbench', 'E: Make Pot'],
      ['planting_table', 'E: Plant Cutting'],
      ['shop_kiosk', 'E: Shop'],
      ['pedestal_1', 'E: Use Pedestal'],
      ['pedestal_2', 'E: Use Pedestal'],
      ['door', 'E: Enter'],
    ]);
  });
});
