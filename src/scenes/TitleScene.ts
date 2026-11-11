import Phaser from 'phaser';
import { shortCommit } from '../buildVersion';
import { currentViewport, isPhone } from '../platform/orientation';
import { loadGame, mostRecentSaveSlot } from '../sim/save';
import { createNewGameState } from '../sim/state';
import type { GameState } from '../sim/types';
import { onKeyDown } from '../world/keys';
import {
  canPickSlot,
  corruptSlotsMessage,
  occupiedSlots,
  readSlotRows,
  slotRowText,
  type PickerMode,
  type SlotRow,
} from '../world/saveSlots';
import {
  PANEL,
  PANEL_CLOSE_LABEL,
  PANEL_INSET,
  fitRows,
  panelClose,
  panelTitleY,
} from '../world/panels';
import { SETTINGS_KEY, settingsPanel } from '../world/settingsPanel';
import type { UiMetrics } from '../world/uiScale';
import { SoundPlayer } from './audio';
import { crispText, fitCamera, hitArea, sceneUi, sceneZoom, setHitArea } from './crisp';
import { fullscreenState, onFullscreenChange, toggleSetting } from './settings';
import { IDLE_HOOK, type TitleSceneData, type WorldSceneData } from './sceneData';
import { TEXT_COLOR, bodyStyle, fontLoaded } from './textStyle';

const DISABLED = '#5f6b58';
const CENTER_X = 240;
/** The title's size, and the menu buttons' (never under the copy's). */
const TITLE_PX = 20;
const TITLE_BUTTON_PX = 12;
/** The menu buttons: the first's centre and the pitch, widened to the tap target where that is taller. */
const MENU_TOP = 110;
const MENU_PITCH = 26;
/** The slot picker's rows: the first's centre and the pitch (likewise widened), and Cancel's lowest centre. */
const PICKER_TOP = 112;
const PICKER_PITCH = 24;
const PICKER_CANCEL_Y = 200;
/** The short SHA the version line shows. */
const COMMIT = shortCommit(__APP_COMMIT__);

/** Whether a title tap has already asked for fullscreen this page load (see TitleScene.phoneFullscreen). */
let phoneFullscreenAsked = false;

/** Which panel is up: the menu, the slot picker, the overwrite confirmation for a slot, or Settings. */
type View =
  | { kind: 'menu' }
  | { kind: 'picker'; mode: PickerMode }
  | { kind: 'confirm'; slot: number }
  | { kind: 'settings' };

/**
 * Title (obj_title): New Game, Continue and Load Game over src/sim/save.ts,
 * with the slot picker of obj_ui_save_slots, and Settings
 * (src/world/settingsPanel.ts). Placeholder-styled like the world; the
 * prototype's 3D hero tree is not ported yet and its Quit is not ported (a web
 * page has no quit). Every button also has a key (Enter, C, L, S; 1-3 in the
 * picker; Y/N to confirm; Escape to back out) so tests drive it without canvas
 * coordinates. The version line in the corner opens the commit the build came
 * from (src/buildVersion.ts).
 */
export class TitleScene extends Phaser.Scene {
  private ctx!: TitleSceneData;
  private rows: SlotRow[] = [];
  private view: View = { kind: 'menu' };
  private message = '';
  private layer!: Phaser.GameObjects.Container;
  /** The enabled buttons of the current view, by id, for the test hook. */
  private buttons: { id: string; text: Phaser.GameObjects.Text }[] = [];
  /** The version line, a link to the commit the build came from. */
  private versionLink!: Phaser.GameObjects.Text;
  /** The UI metrics (src/world/uiScale.ts), read at create; a resize updates only `hit`. */
  private ui!: UiMetrics;
  /** The buttons' `click` (src/scenes/audio.ts), behind the Sound switch. */
  private sfx!: SoundPlayer;
  /** Set once a button has started the world, so the title no longer publishes the hook. */
  private leaving = false;

  constructor() {
    super('title');
  }

  create(data: TitleSceneData): void {
    this.ctx = data;
    this.rows = readSlotRows(data.storage);
    this.message = corruptSlotsMessage(this.rows);
    this.view = { kind: 'menu' };
    this.sfx = new SoundPlayer(this.sound, () => this.ctx.settings);
    this.leaving = false;
    this.layer = this.add.container(0, 0);
    this.ui = sceneUi(this);
    // A resize gives the buttons the new tap target size; the layout and text sizes stay until the next view or restart.
    fitCamera(this, () => {
      this.ui = { ...this.ui, hit: sceneUi(this).hit };
      for (const { text } of this.buttons) setHitArea(text, this.ui.hit);
      setHitArea(this.versionLink, this.ui.hit);
      this.publishHook();
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('TitleScene needs the keyboard plugin');
    // Through onKeyDown, which ignores Phaser's replays of an already handled event.
    onKeyDown(keyboard, 'ENTER', () => {
      if (this.view.kind === 'menu') this.newGame();
    });
    onKeyDown(keyboard, 'C', () => {
      if (this.view.kind === 'menu') this.continueGame();
    });
    onKeyDown(keyboard, 'L', () => {
      if (this.view.kind === 'menu') this.openPicker('load');
    });
    onKeyDown(keyboard, 'S', () => {
      if (this.view.kind === 'menu') this.show({ kind: 'settings' });
    });
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => {
      onKeyDown(keyboard, name, () => {
        if (this.view.kind === 'picker') this.pickSlot(this.view.mode, i + 1);
      });
    });
    onKeyDown(keyboard, 'Y', () => {
      if (this.view.kind === 'confirm') this.startGame(this.view.slot, createNewGameState());
    });
    onKeyDown(keyboard, 'N', () => {
      if (this.view.kind === 'confirm') this.show({ kind: 'picker', mode: 'new' });
    });
    onKeyDown(keyboard, 'ESC', () => {
      if (this.view.kind === 'picker' || this.view.kind === 'settings') this.show({ kind: 'menu' });
      else if (this.view.kind === 'confirm') this.show({ kind: 'picker', mode: 'new' });
    });
    onFullscreenChange(this, () => {
      if (this.view.kind === 'settings') this.draw();
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
    this.leaving = true;
    this.scene.start('world', data);
  }

  /**
   * On a phone, the first tap on New Game, Continue or Load asks for
   * fullscreen (main.ts then locks landscape), inside the tap as browsers
   * require. Once per page; a refusal or no fullscreen (iOS Safari) plays on.
   */
  private phoneFullscreen(): void {
    if (phoneFullscreenAsked || !isPhone(currentViewport())) return;
    phoneFullscreenAsked = true;
    this.scale.startFullscreen();
  }

  private show(view: View): void {
    this.view = view;
    this.draw();
  }

  /**
   * A button of `size` px anchored by its origin, tappable over `hitRect` of
   * its bounds while enabled, else grey and not a control.
   */
  private button(
    id: string,
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
    { size = this.buttonPx(), originX = 0.5 }: { size?: number; originX?: number } = {},
  ): Phaser.GameObjects.Text {
    const text = this.text(x, y, label, {
      ...this.style(),
      fontSize: `${String(size)}px`,
      color: enabled ? '#ffffff' : DISABLED,
    }).setOrigin(originX, 0.5);
    if (enabled) {
      setHitArea(text, this.ui.hit).on('pointerup', () => {
        this.sfx.tap(onClick);
        if (!this.leaving) this.publishHook();
      });
      this.buttons.push({ id, text });
    }
    this.layer.add(text);
    return text;
  }

  /** The title's copy style, from the UI metrics. */
  private style() {
    return bodyStyle(this.ui);
  }

  /** The title menu's buttons are a step larger than the copy. */
  private buttonPx(): number {
    return Math.max(TITLE_BUTTON_PX, this.ui.body);
  }

  private text(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return crispText(this, x, y, text, style);
  }

  private label(x: number, y: number, text: string, color = TEXT_COLOR): void {
    this.layer.add(this.text(x, y, text, { ...this.style(), color }).setOrigin(0.5));
  }

  private draw(): void {
    this.layer.removeAll(true);
    this.buttons = [];
    this.layer.add(
      this.text(CENTER_X, 34, 'Bonsai Greenhouse', {
        ...this.style(),
        fontSize: `${String(TITLE_PX)}px`,
        color: '#ffffff',
      }).setOrigin(0.5),
    );
    this.label(CENTER_X, 56, 'A cozy bonsai-growing sim', '#a0b496');
    this.versionLink = this.text(474, 264, `v${__APP_VERSION__} (${COMMIT})`, {
      ...this.style(),
      color: DISABLED,
    }).setOrigin(1, 1);
    setHitArea(this.versionLink, this.ui.hit).on('pointerup', () => {
      window.open(__APP_COMMIT_URL__, '_blank', 'noopener');
    });
    this.layer.add(this.versionLink);

    const view = this.view;
    // Rows one tap target apart where that is more than the layout's own pitch.
    const pitch = (base: number): number => Math.max(base, this.ui.hit);
    if (view.kind === 'menu') {
      const anySave = this.rows.some((r) => r.status !== 'empty');
      const y = (i: number): number => MENU_TOP + i * pitch(MENU_PITCH);
      this.button('new', CENTER_X, y(0), 'New Game (Enter)', true, () => {
        this.phoneFullscreen();
        this.newGame();
      });
      this.button('continue', CENTER_X, y(1), 'Continue (C)', this.continueSlot > 0, () => {
        this.phoneFullscreen();
        this.continueGame();
      });
      this.button('load', CENTER_X, y(2), 'Load Game (L)', anySave, () => {
        this.phoneFullscreen();
        this.openPicker('load');
      });
      this.button('settings', CENTER_X, y(3), 'Settings (S)', true, () => {
        this.show({ kind: 'settings' });
      });
    } else if (view.kind === 'settings') {
      this.drawSettings();
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
      const y = (i: number): number => PICKER_TOP + i * pitch(PICKER_PITCH);
      this.rows.forEach((row, i) => {
        const action =
          view.mode === 'new' ? (row.status === 'empty' ? 'Use' : 'Overwrite') : 'Load';
        this.button(
          `slot-${String(row.slot)}`,
          CENTER_X,
          y(i),
          `${String(row.slot)}: ${slotRowText(row)}  [${action}]`,
          canPickSlot(view.mode, row),
          () => {
            this.pickSlot(view.mode, row.slot);
          },
          { size: this.ui.body },
        );
      });
      const cancelY = Math.max(PICKER_CANCEL_Y, y(this.rows.length));
      this.button('cancel', CENTER_X, cancelY, 'Cancel (Esc)', true, () => {
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
      this.button('confirm-no', CENTER_X - 60, 190, 'Cancel (N)', true, () => {
        this.show({ kind: 'picker', mode: 'new' });
      });
      this.button('confirm-yes', CENTER_X + 60, 190, 'Overwrite (Y)', true, () => {
        this.startGame(view.slot, createNewGameState());
      });
    }
    if (this.message) this.label(CENTER_X, 240, this.message, '#dca0a0');
    this.publishHook();
  }

  /** The Settings panel model in its box, fitted as the world fits it; a toggle applies, saves and redraws it. */
  private drawSettings(): void {
    const model = fitRows(settingsPanel(this.ctx.settings, fullscreenState(this)), this.ui);
    const box = model.box ?? PANEL;
    this.layer.add(
      this.add
        .rectangle(box.x, box.y, box.w, box.h, 0x28322a)
        .setOrigin(0)
        .setStrokeStyle(1, 0x8ca078),
    );
    const left = box.x + PANEL_INSET;
    this.layer.add(
      this.text(left, panelTitleY(box), model.title, {
        ...this.style(),
        color: '#ffffff',
      }).setOrigin(0, 0.5),
    );
    const size = this.ui.body;
    for (const row of model.rows) {
      this.button(
        row.id,
        left,
        row.y,
        row.text,
        row.enabled !== false,
        () => {
          toggleSetting(this, this.ctx, row.id);
          this.draw();
        },
        { size, originX: 0 },
      );
    }
    const close = panelClose(box);
    this.button(
      'panel-close',
      close.x,
      close.y,
      PANEL_CLOSE_LABEL,
      true,
      () => {
        this.show({ kind: 'menu' });
      },
      { size },
    );
  }

  private publishHook(): void {
    const link = this.versionLink.getCenter();
    window.__bonsai = {
      ...IDLE_HOOK,
      version: __APP_VERSION__,
      commit: COMMIT,
      versionLink: { text: this.versionLink.text, x: link.x, y: link.y },
      fontLoaded: fontLoaded(),
      ready: true,
      scene: this.scene.key,
      zoom: sceneZoom(this),
      activeSlot: 0,
      slots: occupiedSlots(this.rows),
      toast: this.message,
      controls: this.buttons.map(({ id, text }) => {
        const c = text.getCenter();
        return { id, x: c.x, y: c.y, hit: hitArea(text) };
      }),
      picker: this.pickerHook(),
      panel: this.view.kind === 'settings' ? SETTINGS_KEY : '',
      settings: { ...this.ctx.settings },
      lastSound: this.sfx.lastSound,
    };
  }

  private pickerHook(): string {
    switch (this.view.kind) {
      case 'picker':
        return this.view.mode;
      case 'confirm':
        return 'confirm';
      default:
        return '';
    }
  }
}
