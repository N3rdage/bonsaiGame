import Phaser from 'phaser';
import { loadGame, saveGame } from '../sim/save';
import { seasonForDay } from '../sim/seasons';
import { scoreTree } from '../sim/scoring';
import type { BonsaiTree, GameState } from '../sim/types';
import { TreeViewer } from '../viewer/TreeViewer';
import { hudText } from '../world/hud';
import { HUD_BADGE, MENU_BUTTON, MENU_PANEL, TOAST_X, VIEW_BUTTON, menuItems } from '../world/menu';
import { fixedSteps, joystickInput, keyboardInput } from '../world/input';
import { createPlayer, stepPlayer, type MoveInput, type PlayerState } from '../world/player';
import { occupiedSlots, readSlotRows } from '../world/saveSlots';
import { SHED_ROOM } from '../world/shedRoom';
import type { TitleSceneData, WorldSceneData } from './sceneData';

const TOAST_MS = 2000;
const PLAYER_W = 16;
const PLAYER_H = 24;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#d8e6c8' };

type MoveKeys = Record<
  'left' | 'right' | 'up' | 'down' | 'a' | 'd' | 'w' | 's',
  Phaser.Input.Keyboard.Key
>;

/**
 * The shed with placeholder art: floor, walls and labelled prop rectangles,
 * and the player as a rectangle depth-sorted by y against the props. Room data,
 * movement and the HUD text come from the pure modules in src/world/; this
 * scene only reads input, draws and publishes the test hook.
 *
 * The 3D viewer is a DOM canvas over this one. While it is open the world
 * ignores its own keys and pointers and does not step.
 *
 * The Menu button (top-left) opens a panel with Save, Load and Title; F5, F9
 * and Escape are their shortcuts: save to the active slot, reload it, go back
 * to the title without saving (all through src/sim/save.ts and the storage
 * from boot).
 */
export class WorldScene extends Phaser.Scene {
  private ctx!: WorldSceneData;
  private viewTree: BonsaiTree | undefined;
  /** Hook fields read once from the state the world was started with (new or loaded). */
  private base!: Pick<
    BonsaiTestHook,
    'version' | 'season' | 'day' | 'trees' | 'starterScore' | 'starterHeightCm'
  >;
  private viewer!: TreeViewer;
  private slots: BonsaiTestHook['slots'] = [];
  private toast!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | undefined;
  /** performance.now() of the last viewer close, so the Escape that closed it never leaves the room. */
  private viewerClosedAt = -1;
  private keys!: MoveKeys;
  private player!: PlayerState;
  private playerRect!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private viewButton!: Phaser.GameObjects.Text;
  private menuButton!: Phaser.GameObjects.Text;
  /** The open menu panel's background and rows; undefined while closed. */
  private panel:
    | {
        bg: Phaser.GameObjects.Rectangle;
        rows: { id: string; text: Phaser.GameObjects.Text }[];
      }
    | undefined;
  private accumulatorMs = 0;
  private frames = 0;
  private joystick: { id: number; x: number; y: number; input: MoveInput } | undefined;

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.ctx = data;
    this.viewTree = data.overrides.tree?.() ?? data.state.trees[0];
    const first = data.state.trees[0];
    this.base = {
      version: __APP_VERSION__,
      season: seasonForDay(data.state.day),
      day: data.state.day,
      trees: data.state.trees.length,
      starterScore: first ? scoreTree(first).total : -1,
      starterHeightCm: first ? first.trunk.heightCm : -1,
    };
    this.slots = occupiedSlots(readSlotRows(data.storage));
    this.toastTimer = undefined;
    this.viewerClosedAt = -1;
    this.accumulatorMs = 0;
    this.frames = 0;
    this.joystick = undefined;
    this.panel = undefined;
    const room = SHED_ROOM;

    this.add.rectangle(0, 0, room.width, room.height, room.floor).setOrigin(0).setDepth(-1);
    for (const w of room.walls) {
      this.add.rectangle(w.x, w.y, w.w, w.h, 0x5b4a36).setOrigin(0).setDepth(-1);
    }
    for (const p of room.props) {
      const bottom = p.y + p.h / 2;
      this.add.rectangle(p.x, p.y, p.w, p.h, 0x7a6248).setStrokeStyle(1, 0xb39a74).setDepth(bottom);
      this.add.text(p.x, p.y, p.label, LABEL_STYLE).setOrigin(0.5).setDepth(bottom);
    }

    this.player = createPlayer(room);
    this.playerRect = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, 0xc9d8a8).setOrigin(0.5, 1);
    this.drawPlayer();

    this.hud = this.add
      .text(HUD_BADGE.right, HUD_BADGE.top, hudText(data.state), {
        ...LABEL_STYLE,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(1, 0)
      .setDepth(10_000);
    this.viewButton = this.hudButton(VIEW_BUTTON.left, VIEW_BUTTON.bottom, 'View tree (V)', () => {
      this.openViewer();
    }).setOrigin(0, 1);
    this.menuButton = this.hudButton(MENU_BUTTON.left, MENU_BUTTON.top, 'Menu', () => {
      if (this.panel) this.closePanel();
      else this.openPanel();
    });
    this.toast = this.add
      .text(TOAST_X, 2, '', { ...LABEL_STYLE, fontSize: '10px', color: '#ffffff' })
      .setDepth(10_000);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('WorldScene needs the keyboard plugin');
    const K = Phaser.Input.Keyboard.KeyCodes;
    // No capture: the viewer listens to the same keys on window while open.
    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code, false);
    this.keys = {
      left: key(K.LEFT),
      right: key(K.RIGHT),
      up: key(K.UP),
      down: key(K.DOWN),
      a: key(K.A),
      d: key(K.D),
      w: key(K.W),
      s: key(K.S),
    };
    // A keydown event, not a polled key: a quick tap can go down and up within
    // one frame. While the viewer is open V is its View mode, so it is ignored here.
    keyboard.on('keydown-V', () => {
      this.openViewer();
    });
    // Captured so the browser's own F5 (reload) never fires in the room.
    keyboard.addCapture([K.F5, K.F9]);
    keyboard.on('keydown-F5', () => {
      if (!this.viewer.isOpen) this.save();
    });
    keyboard.on('keydown-F9', () => {
      if (!this.viewer.isOpen) this.reload();
    });
    // Keyboard events reach Phaser after the viewer's own window listener, so
    // the Escape that closed the viewer is seen here with the viewer already
    // closed; its timestamp tells them apart.
    keyboard.on('keydown-ESC', (event: KeyboardEvent) => {
      if (this.viewer.isOpen || event.timeStamp <= this.viewerClosedAt) return;
      if (this.panel) this.closePanel();
      else this.toTitle();
    });

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.viewer.isOpen) return;
        if (this.panel) {
          // A press outside the panel and its button closes it and starts no joystick.
          const inside: Phaser.GameObjects.GameObject[] = [
            this.menuButton,
            this.panel.bg,
            ...this.panel.rows.map((r) => r.text),
          ];
          if (!over.some((o) => inside.includes(o))) this.closePanel();
          return;
        }
        if (over.length > 0 || this.joystick) return;
        this.joystick = { id: pointer.id, x: pointer.x, y: pointer.y, input: { x: 0, y: 0 } };
      },
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystick?.id) return;
      this.joystick.input = joystickInput(pointer.x - this.joystick.x, pointer.y - this.joystick.y);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.joystick?.id) this.joystick = undefined;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.viewer = new TreeViewer(document.body);
    this.viewer.onRender = this.publishHook;
    this.viewer.onClose = () => {
      this.viewerClosedAt = performance.now();
      this.publishHook();
    };
    this.events.once('shutdown', () => {
      this.viewer.destroy();
      keyboard.removeCapture([K.F5, K.F9]);
    });
    this.publishHook();
  }

  private hudButton(
    x: number,
    y: number,
    label: string,
    onTap: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, { ...LABEL_STYLE, fontSize: '10px' })
      .setDepth(10_000)
      .setInteractive({ useHandCursor: true });
    button.on('pointerup', onTap);
    return button;
  }

  private openPanel(): void {
    const { x, y, w, h } = MENU_PANEL;
    const bg = this.add
      .rectangle(x, y, w, h, 0x28322a)
      .setOrigin(0)
      .setStrokeStyle(1, 0x8ca078)
      .setDepth(10_000)
      .setInteractive();
    const actions = {
      save: () => {
        this.save();
        this.closePanel();
      },
      load: () => {
        this.reload();
        this.closePanel();
      },
      title: () => {
        this.toTitle();
      },
    };
    const rows = menuItems().map((item) => ({
      id: `menu-${item.id}`,
      text: this.hudButton(item.x, item.y, item.label, actions[item.id]).setOrigin(0, 0.5),
    }));
    this.panel = { bg, rows };
    this.publishHook();
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.panel.bg.destroy();
    for (const row of this.panel.rows) row.text.destroy();
    this.panel = undefined;
    this.publishHook();
  }

  private toTitle(): void {
    const data: TitleSceneData = { storage: this.ctx.storage, overrides: this.ctx.overrides };
    this.scene.start('title', data);
  }

  private save(): void {
    const { storage, state, slot } = this.ctx;
    try {
      saveGame(storage, state, slot);
      this.slots = occupiedSlots(readSlotRows(storage));
      this.showToast(`Saved to slot ${String(slot)}`);
    } catch {
      this.showToast(`Could not save to slot ${String(slot)}`);
    }
  }

  /**
   * F9: the active slot as last saved. The prototype opened the load picker
   * over the running room for an empty slot; here the world stays put with a
   * toast, so the unsaved game is kept. The in-room picker comes with the
   * world UI panels (R4b).
   */
  private reload(): void {
    const { storage, slot } = this.ctx;
    let state: GameState | undefined;
    try {
      state = loadGame(storage, slot);
    } catch {
      this.showToast(`Could not load slot ${String(slot)}`);
      return;
    }
    if (state) {
      this.scene.restart({ ...this.ctx, state });
    } else {
      this.showToast(`Slot ${String(slot)} is empty`);
    }
  }

  private showToast(text: string): void {
    this.toast.setText(text);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(TOAST_MS, () => {
      this.toast.setText('');
      this.publishHook();
    });
    this.publishHook();
  }

  override update(_time: number, delta: number): void {
    const viewerOpen = this.viewer.isOpen;
    this.hud.setVisible(!viewerOpen);
    this.menuButton.setVisible(!viewerOpen);
    if (viewerOpen) {
      this.joystick = undefined;
      this.accumulatorMs = 0;
      return;
    }

    const { steps, accumulatorMs } = fixedSteps(this.accumulatorMs, delta);
    this.accumulatorMs = accumulatorMs;
    if (steps === 0) return;
    const input = this.joystick?.input ?? this.keyboardMove();
    for (let i = 0; i < steps; i += 1) {
      this.player = stepPlayer(this.player, input, SHED_ROOM);
      this.frames += 1;
    }
    this.drawPlayer();
    this.hud.setText(hudText(this.ctx.state));
    this.publishHook();
  }

  private keyboardMove(): MoveInput {
    const k = this.keys;
    return keyboardInput({
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      up: k.up.isDown || k.w.isDown,
      down: k.down.isDown || k.s.isDown,
    });
  }

  private drawPlayer(): void {
    this.playerRect.setPosition(this.player.x, this.player.y).setDepth(this.player.y);
  }

  private openViewer(): void {
    const { overrides, state } = this.ctx;
    const viewTree = this.viewTree;
    if (!viewTree || this.viewer.isOpen) return;
    this.joystick = undefined;
    this.closePanel();
    this.viewer.open(viewTree, overrides.season ?? seasonForDay(state.day), state);
    this.hud.setVisible(false);
    this.menuButton.setVisible(false);
    this.publishHook();
  }

  /** Centres of the tappable controls on screen, for the test hook; none under the viewer. */
  private controls(): BonsaiTestHook['controls'] {
    if (this.viewer.isOpen) return [];
    const at = (id: string, text: Phaser.GameObjects.Text) => {
      const c = text.getCenter();
      return { id, x: c.x, y: c.y };
    };
    const rows = this.panel?.rows.map((r) => at(r.id, r.text)) ?? [];
    return [at('view', this.viewButton), at('menu', this.menuButton), ...rows];
  }

  private readonly publishHook = (): void => {
    const { state, slot } = this.ctx;
    window.__bonsai = {
      ...this.base,
      activeSlot: slot,
      slots: this.slots,
      toast: this.toast.text,
      picker: '',
      panel: this.panel ? 'menu' : '',
      controls: this.controls(),
      ready: true,
      scene: this.scene.key,
      // The game state's own flag, not the viewer's, so a test sees what the
      // simulation would see after the viewer has let go.
      paused: state.paused,
      viewer: this.viewer.snapshot(),
      room: SHED_ROOM.key,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      hud: hudText(state),
      frames: this.frames,
    };
  };
}
