import Phaser from 'phaser';
import { loadGame, mostRecentSaveSlot } from '../sim/save';
import { createNewGameState } from '../sim/state';
import type { GameState } from '../sim/types';
import {
  canPickSlot,
  corruptSlotsMessage,
  occupiedSlots,
  readSlotRows,
  slotRowText,
  type PickerMode,
  type SlotRow,
} from '../world/saveSlots';
import { IDLE_HOOK, type TitleSceneData, type WorldSceneData } from './sceneData';

const TEXT = { fontFamily: 'monospace', fontSize: '10px', color: '#d8e6c8' };
const DISABLED = '#5f6b58';
const CENTER_X = 240;

/** Which panel is up: the menu, the slot picker, or the overwrite confirmation for a slot. */
type View =
  { kind: 'menu' } | { kind: 'picker'; mode: PickerMode } | { kind: 'confirm'; slot: number };

/**
 * Title (obj_title): New Game, Continue and Load Game over src/sim/save.ts,
 * with the slot picker of obj_ui_save_slots. Placeholder-styled like the
 * world; the prototype's 3D hero tree, Settings and Quit are not ported yet.
 * Every button also has a key (Enter, C, L; 1-3 in the picker; Y/N to
 * confirm; Escape to back out) so tests drive it without canvas coordinates.
 */
export class TitleScene extends Phaser.Scene {
  private ctx!: TitleSceneData;
  private rows: SlotRow[] = [];
  private view: View = { kind: 'menu' };
  private message = '';
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('title');
  }

  create(data: TitleSceneData): void {
    this.ctx = data;
    this.rows = readSlotRows(data.storage);
    this.message = data.message ?? corruptSlotsMessage(this.rows);
    this.view = data.openLoadPicker ? { kind: 'picker', mode: 'load' } : { kind: 'menu' };
    this.layer = this.add.container(0, 0);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('TitleScene needs the keyboard plugin');
    keyboard.on('keydown-ENTER', () => {
      if (this.view.kind === 'menu') this.newGame();
    });
    keyboard.on('keydown-C', () => {
      if (this.view.kind === 'menu') this.continueGame();
    });
    keyboard.on('keydown-L', () => {
      if (this.view.kind === 'menu') this.openPicker('load');
    });
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => {
      keyboard.on(`keydown-${name}`, () => {
        if (this.view.kind === 'picker') this.pickSlot(this.view.mode, i + 1);
      });
    });
    keyboard.on('keydown-Y', () => {
      if (this.view.kind === 'confirm') this.startGame(this.view.slot, createNewGameState());
    });
    keyboard.on('keydown-N', () => {
      if (this.view.kind === 'confirm') this.show({ kind: 'picker', mode: 'new' });
    });
    keyboard.on('keydown-ESC', () => {
      if (this.view.kind === 'picker') this.show({ kind: 'menu' });
      else if (this.view.kind === 'confirm') this.show({ kind: 'picker', mode: 'new' });
    });

    this.draw();
  }

  private get continueSlot(): number {
    return mostRecentSaveSlot(this.ctx.storage);
  }

  private newGame(): void {
    if (this.rows.every((r) => r.status === 'empty')) {
      this.startGame(1, createNewGameState());
    } else {
      this.openPicker('new');
    }
  }

  private continueGame(): void {
    const slot = this.continueSlot;
    if (slot > 0) this.loadSlot(slot);
  }

  private openPicker(mode: PickerMode): void {
    if (mode === 'load' && this.rows.every((r) => r.status === 'empty')) return;
    this.show({ kind: 'picker', mode });
  }

  private pickSlot(mode: PickerMode, slot: number): void {
    const row = this.rows[slot - 1];
    if (!row || !canPickSlot(mode, row)) return;
    if (mode === 'load') this.loadSlot(slot);
    else if (row.status === 'empty') this.startGame(slot, createNewGameState());
    else this.show({ kind: 'confirm', slot });
  }

  private loadSlot(slot: number): void {
    let state: GameState | undefined;
    try {
      state = loadGame(this.ctx.storage, slot);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.message = `Could not load slot ${String(slot)}: ${reason}`;
      this.show({ kind: 'menu' });
      return;
    }
    if (state) this.startGame(slot, state);
  }

  private startGame(slot: number, state: GameState): void {
    const data: WorldSceneData = { ...this.ctx, state, slot };
    this.scene.start('world', data);
  }

  private show(view: View): void {
    this.view = view;
    this.draw();
  }

  private button(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, label, { ...TEXT, fontSize: '12px', color: enabled ? '#ffffff' : DISABLED })
      .setOrigin(0.5);
    if (enabled) {
      text.setInteractive({ useHandCursor: true });
      text.on('pointerup', onClick);
    }
    this.layer.add(text);
    return text;
  }

  private label(x: number, y: number, text: string, color = TEXT.color): void {
    this.layer.add(this.add.text(x, y, text, { ...TEXT, color }).setOrigin(0.5));
  }

  private draw(): void {
    this.layer.removeAll(true);
    this.layer.add(
      this.add
        .text(CENTER_X, 34, 'Bonsai Greenhouse', { ...TEXT, fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5),
    );
    this.label(CENTER_X, 56, 'A cozy bonsai-growing sim', '#a0b496');
    this.layer.add(
      this.add.text(474, 264, `v${__APP_VERSION__}`, { ...TEXT, color: DISABLED }).setOrigin(1, 1),
    );

    const view = this.view;
    if (view.kind === 'menu') {
      const anySave = this.rows.some((r) => r.status !== 'empty');
      this.button(CENTER_X, 110, 'New Game (Enter)', true, () => {
        this.newGame();
      });
      this.button(CENTER_X, 136, 'Continue (C)', this.continueSlot > 0, () => {
        this.continueGame();
      });
      this.button(CENTER_X, 162, 'Load Game (L)', anySave, () => {
        this.openPicker('load');
      });
    } else if (view.kind === 'picker') {
      this.layer.add(
        this.add.rectangle(CENTER_X, 150, 400, 150, 0x28322a).setStrokeStyle(1, 0x8ca078),
      );
      this.label(
        CENTER_X,
        88,
        view.mode === 'new' ? 'New Game - Pick a Slot' : 'Load Game',
        '#ffffff',
      );
      this.rows.forEach((row, i) => {
        const action =
          view.mode === 'new' ? (row.status === 'empty' ? 'Use' : 'Overwrite') : 'Load';
        this.button(
          CENTER_X,
          112 + i * 24,
          `${String(row.slot)}: ${slotRowText(row)}  [${action}]`,
          canPickSlot(view.mode, row),
          () => {
            this.pickSlot(view.mode, row.slot);
          },
        ).setFontSize(10);
      });
      this.button(CENTER_X, 200, 'Cancel (Esc)', true, () => {
        this.show({ kind: 'menu' });
      });
    } else {
      const row = this.rows[view.slot - 1];
      this.layer.add(
        this.add.rectangle(CENTER_X, 150, 400, 150, 0x28322a).setStrokeStyle(1, 0x8ca078),
      );
      this.label(CENTER_X, 96, `Slot ${String(view.slot)} already has a save:`, '#ffffff');
      if (row) this.label(CENTER_X, 116, slotRowText(row), '#dcc878');
      this.label(CENTER_X, 140, 'Overwriting starts a new game and erases this save.', '#dca0a0');
      this.button(CENTER_X - 60, 190, 'Cancel (N)', true, () => {
        this.show({ kind: 'picker', mode: 'new' });
      });
      this.button(CENTER_X + 60, 190, 'Overwrite (Y)', true, () => {
        this.startGame(view.slot, createNewGameState());
      });
    }
    if (this.message) this.label(CENTER_X, 240, this.message, '#dca0a0');
    this.publishHook();
  }

  private publishHook(): void {
    window.__bonsai = {
      ...IDLE_HOOK,
      version: __APP_VERSION__,
      ready: true,
      scene: this.scene.key,
      activeSlot: 0,
      slots: occupiedSlots(this.rows),
      toast: this.message,
      picker:
        this.view.kind === 'menu' ? '' : this.view.kind === 'confirm' ? 'confirm' : this.view.mode,
    };
  }
}
