import { describe, expect, it } from 'vitest';
import { MemorySaveStorage, saveGame } from '../sim/save';
import { createNewGameState } from '../sim/state';
import {
  canPickSlot,
  corruptSlotsMessage,
  occupiedSlots,
  readSlotRows,
  slotRowText,
} from './saveSlots';

describe('save slot rows', () => {
  it('reads every slot as empty, occupied or corrupt', () => {
    const storage = new MemorySaveStorage();
    const state = createNewGameState();
    state.day = 3;
    state.money = 120;
    saveGame(storage, state, 2, new Date(2026, 10, 8, 9, 5));
    storage.write(3, 'not json');
    const rows = readSlotRows(storage);
    expect(rows.map((r) => r.status)).toEqual(['empty', 'occupied', 'corrupt']);
    expect(rows.map(slotRowText)).toEqual([
      'Slot 1  (empty)',
      'Slot 2  Day 3   $120   saved 2026-11-08 09:05',
      'Slot 3  (unreadable)',
    ]);
    expect(occupiedSlots(rows)).toEqual([
      { slot: 2, day: 3, money: 120, savedAt: '2026-11-08 09:05' },
    ]);
    expect(corruptSlotsMessage(rows)).toBe('Save slot 3 is unreadable');
  });

  it('lets load pick only saved slots and new pick any slot', () => {
    const storage = new MemorySaveStorage();
    storage.write(1, 'not json');
    const [corrupt, empty] = readSlotRows(storage);
    if (!corrupt || !empty) throw new Error('rows missing');
    expect(canPickSlot('load', empty)).toBe(false);
    expect(canPickSlot('load', corrupt)).toBe(true);
    expect(canPickSlot('new', empty)).toBe(true);
    expect(corruptSlotsMessage(readSlotRows(new MemorySaveStorage()))).toBe('');
  });
});
