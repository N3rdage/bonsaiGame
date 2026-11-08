import { SAVE_SLOT_COUNT, saveSlotMetadata, type SaveStorage } from '../sim/save';

/**
 * The title's slot picker as plain data (obj_ui_save_slots): one row per slot,
 * its text, and whether a row can be picked in each mode. A slot whose header
 * cannot be read is `corrupt`: it counts as occupied, so New Game asks before
 * overwriting it and Load Game lets the player try it and see why it fails.
 */
export type SlotStatus = 'empty' | 'occupied' | 'corrupt';
export type PickerMode = 'new' | 'load';

export interface SlotRow {
  readonly slot: number;
  readonly status: SlotStatus;
  readonly day: number;
  readonly money: number;
  readonly savedAt: string;
}

export function readSlotRows(storage: SaveStorage): SlotRow[] {
  const rows: SlotRow[] = [];
  for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot++) {
    let row: SlotRow = { slot, status: 'corrupt', day: 0, money: 0, savedAt: '' };
    try {
      const meta = saveSlotMetadata(storage, slot);
      row = meta
        ? { slot, status: 'occupied', day: meta.day, money: meta.money, savedAt: meta.savedAt }
        : { ...row, status: 'empty' };
    } catch {
      // Stays corrupt.
    }
    rows.push(row);
  }
  return rows;
}

/** The hook's `slots`: readable saves only. */
export function occupiedSlots(
  rows: readonly SlotRow[],
): { slot: number; day: number; money: number; savedAt: string }[] {
  return rows
    .filter((r) => r.status === 'occupied')
    .map(({ slot, day, money, savedAt }) => ({ slot, day, money, savedAt }));
}

/** The prototype's row text: "Slot 1  Day 3   $120   saved ..." or "(empty)". */
export function slotRowText(row: SlotRow): string {
  const head = `Slot ${String(row.slot)}  `;
  if (row.status === 'empty') return `${head}(empty)`;
  if (row.status === 'corrupt') return `${head}(unreadable)`;
  return `${head}Day ${String(row.day)}   $${String(row.money)}   saved ${row.savedAt}`;
}

/** "load" mode: only slots with a save; "new" mode: every slot (occupied ones confirm). */
export function canPickSlot(mode: PickerMode, row: SlotRow): boolean {
  return mode === 'new' || row.status !== 'empty';
}

/** The message the title shows for unreadable slots, or '' when every slot is fine. */
export function corruptSlotsMessage(rows: readonly SlotRow[]): string {
  const bad = rows.filter((r) => r.status === 'corrupt').map((r) => String(r.slot));
  if (bad.length === 0) return '';
  return `Save slot ${bad.join(', ')} is unreadable`;
}
