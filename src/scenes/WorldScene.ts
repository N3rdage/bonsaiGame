import Phaser from 'phaser';
import { loadGame, saveGame } from '../sim/save';
import { seasonForDay } from '../sim/seasons';
import { scoreTree } from '../sim/scoring';
import { carriedTree, pickUpTree, placeTree, putDownTree, treeOnPedestal } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import { TreeViewer } from '../viewer/TreeViewer';
import { hudText } from '../world/hud';
import { nearestInteractable, promptFor } from '../world/interactables';
import {
  CARRY_TEXT,
  HUD_BADGE,
  INTERACT_BUTTON,
  MENU_BUTTON,
  MENU_PANEL,
  TOAST_X,
  VIEW_BUTTON,
  menuItems,
} from '../world/menu';
import {
  PANEL,
  PANEL_CLOSE,
  PANEL_CLOSE_LABEL,
  PANEL_INSET,
  PANEL_TITLE_Y,
  loadSlotsPanel,
  pedestalPanel,
  placeholderPanel,
  treePanel,
  type PanelModel,
} from '../world/panels';
import { fixedSteps, joystickInput, keyboardInput } from '../world/input';
import { createPlayer, stepPlayer, type MoveInput, type PlayerState } from '../world/player';
import { occupiedSlots, readSlotRows } from '../world/saveSlots';
import { SHED_ROOM, type Prop } from '../world/shedRoom';
import { treeSprites, treeTargets, treeLabel, type TreeTarget } from '../world/treeSprites';
import type { TitleSceneData, WorldSceneData } from './sceneData';

const TOAST_MS = 2000;
const PLAYER_W = 16;
const PLAYER_H = 24;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#d8e6c8' };
const HUD_DEPTH = 10_000;
/** Modal panels and their dimmer sit above the HUD, so a press on the HUD under them hits the dimmer. */
const MODAL_DEPTH = 10_001;

type MoveKeys = Record<
  'left' | 'right' | 'up' | 'down' | 'a' | 'd' | 'w' | 's',
  Phaser.Input.Keyboard.Key
>;

/** The open panel: the HUD menu, or a modal one; `key` is the hook's `panel`. */
interface OpenPanel {
  readonly key: string;
  readonly modal: boolean;
  readonly parts: Phaser.GameObjects.GameObject[];
  readonly buttons: { id: string; text: Phaser.GameObjects.Text }[];
}

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
 *
 * Within range of a prop the player shows its prompt and an Interact button
 * (E); interacting opens a modal panel (obj_ui_panel) over the dimmed room.
 * While a modal is open the player does not move and the room's keys, Menu and
 * View tree do nothing; Escape or Close (Esc) closes it. F9 on an empty or
 * unreadable slot opens the Load Game slot picker as such a panel.
 *
 * Trees are drawn from their `location` (src/world/treeSprites.ts): on the
 * floor grid, where they are interactables, or on a pedestal. Their panels
 * pick one up, place the carried one and the menu puts it down, all through
 * the location helpers in src/sim/tree.ts.
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
  private interactButton!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private carryText!: Phaser.GameObjects.Text;
  /** The tree sprites drawn now, redrawn whenever a location changes. */
  private treeParts: Phaser.GameObjects.GameObject[] = [];
  /** Props and floor trees, what E can reach. */
  private targets: readonly (Prop | TreeTarget)[] = [];
  /** The prop or floor tree in interact range of the player, if any. */
  private near: Prop | TreeTarget | undefined;
  private panel: OpenPanel | undefined;
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
    this.promptText = this.add
      .text(0, 0, '', { ...LABEL_STYLE, color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH);

    this.hud = this.add
      .text(HUD_BADGE.right, HUD_BADGE.top, hudText(data.state), {
        ...LABEL_STYLE,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.carryText = this.add
      .text(CARRY_TEXT.right, CARRY_TEXT.top, '', { ...LABEL_STYLE, fontSize: '10px' })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.treeParts = [];
    this.drawTrees();
    this.drawPlayer();
    this.viewButton = this.hudButton(VIEW_BUTTON.left, VIEW_BUTTON.bottom, 'View tree (V)', () => {
      this.openViewer();
    }).setOrigin(0, 1);
    this.menuButton = this.hudButton(MENU_BUTTON.left, MENU_BUTTON.top, 'Menu', () => {
      if (this.panel?.modal) return;
      if (this.panel) this.closePanel();
      else this.openMenu();
    });
    this.interactButton = this.hudButton(
      INTERACT_BUTTON.right,
      INTERACT_BUTTON.bottom,
      'Interact (E)',
      () => {
        this.interact();
      },
    ).setOrigin(1, 1);
    this.toast = this.add
      .text(TOAST_X, 2, '', { ...LABEL_STYLE, fontSize: '10px', color: '#ffffff' })
      .setDepth(HUD_DEPTH);

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
    // Keydown events, not polled keys: a quick tap can go down and up within
    // one frame. While the viewer is open V is its View mode, so it is ignored here.
    keyboard.on('keydown-V', () => {
      this.openViewer();
    });
    keyboard.on('keydown-E', () => {
      this.interact();
    });
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => {
      keyboard.on(`keydown-${name}`, () => {
        if (this.panel?.buttons.some((b) => b.id === `panel-slot-${String(i + 1)}`)) {
          this.pickPanelSlot(i + 1);
        }
      });
    });
    // Captured so the browser's own F5 (reload) never fires in the room.
    keyboard.addCapture([K.F5, K.F9]);
    keyboard.on('keydown-F5', () => {
      if (this.roomKeysLive()) this.save();
    });
    keyboard.on('keydown-F9', () => {
      if (this.roomKeysLive()) this.reload();
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
        // A modal panel ignores presses outside it (its dimmer takes them).
        if (this.viewer.isOpen || this.panel?.modal) return;
        if (this.panel) {
          // A press outside the menu and its button closes it and starts no joystick.
          const inside: Phaser.GameObjects.GameObject[] = [
            this.menuButton,
            ...this.panel.parts,
            ...this.panel.buttons.map((b) => b.text),
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
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    button.on('pointerup', onTap);
    return button;
  }

  /** No viewer and no modal panel: the room's own keys and buttons act. */
  private roomKeysLive(): boolean {
    return !this.viewer.isOpen && !this.panel?.modal;
  }

  /** A panel background; interactive, so a press on it reaches nothing beneath. */
  private panelBox(box: { x: number; y: number; w: number; h: number }, depth: number) {
    return this.add
      .rectangle(box.x, box.y, box.w, box.h, 0x28322a)
      .setOrigin(0)
      .setStrokeStyle(1, 0x8ca078)
      .setDepth(depth)
      .setInteractive();
  }

  private openMenu(): void {
    const bg = this.panelBox(MENU_PANEL, HUD_DEPTH);
    const actions = {
      save: () => {
        this.save();
        this.closePanel();
      },
      load: () => {
        this.closePanel();
        this.reload();
      },
      title: () => {
        this.toTitle();
      },
      putdown: () => {
        const tree = carriedTree(this.ctx.state);
        if (tree) putDownTree(tree, SHED_ROOM.key);
        this.closePanel();
        this.relocated();
      },
    };
    const buttons = menuItems(carriedTree(this.ctx.state) !== undefined).map((item) => ({
      id: `menu-${item.id}`,
      text: this.hudButton(item.x, item.y, item.label, actions[item.id]).setOrigin(0, 0.5),
    }));
    this.panel = { key: 'menu', modal: false, parts: [bg], buttons };
    this.publishHook();
  }

  /**
   * A modal panel over the dimmed room (obj_ui_panel): title, rows and Close.
   * A row with an id is a button and `onRow` gets its index.
   */
  private openPanel(model: PanelModel, onRow: (index: number) => void = () => undefined): void {
    this.closePanel();
    this.joystick = undefined;
    const dim = this.add
      .rectangle(0, 0, SHED_ROOM.width, SHED_ROOM.height, 0x000000, 0.5)
      .setOrigin(0)
      .setDepth(MODAL_DEPTH)
      .setInteractive();
    const left = PANEL.x + PANEL_INSET;
    const style = { ...LABEL_STYLE, fontSize: '10px', color: '#ffffff' };
    const text = (y: number, label: string, color: string) =>
      this.add
        .text(left, y, label, { ...style, color })
        .setOrigin(0, 0.5)
        .setDepth(MODAL_DEPTH);
    const parts: Phaser.GameObjects.GameObject[] = [
      dim,
      this.panelBox(PANEL, MODAL_DEPTH),
      text(PANEL_TITLE_Y, model.title, '#ffffff'),
    ];
    const buttons: OpenPanel['buttons'] = [];
    model.rows.forEach((row, i) => {
      if (!row.id) {
        parts.push(text(row.y, row.text, '#a0b496'));
        return;
      }
      const button = this.hudButton(left, row.y, row.text, () => {
        onRow(i);
      });
      buttons.push({ id: row.id, text: button.setOrigin(0, 0.5).setColor('#ffffff') });
    });
    const close = this.hudButton(PANEL_CLOSE.x, PANEL_CLOSE.y, PANEL_CLOSE_LABEL, () => {
      this.closePanel();
    });
    buttons.push({ id: 'panel-close', text: close.setOrigin(0.5) });
    for (const b of buttons) b.text.setDepth(MODAL_DEPTH);
    this.panel = { key: model.key, modal: true, parts, buttons };
    this.publishHook();
  }

  private closePanel(): void {
    if (!this.panel) return;
    for (const part of this.panel.parts) part.destroy();
    for (const button of this.panel.buttons) button.text.destroy();
    this.panel = undefined;
    this.publishHook();
  }

  /**
   * E or the Interact button: a floor tree or an occupied pedestal opens the
   * tree's panel, an empty pedestal the Display Pedestal panel, any other prop
   * its placeholder.
   */
  private interact(): void {
    const near = this.near;
    if (!this.roomKeysLive() || !near) return;
    const { state } = this.ctx;
    const pedestalKey = 'pedestalKey' in near ? near.pedestalKey : undefined;
    const tree =
      'tree' in near
        ? near.tree
        : pedestalKey === undefined
          ? undefined
          : treeOnPedestal(state, pedestalKey);
    if (tree) {
      this.openPanel(treePanel(tree), () => {
        this.pickUp(tree);
      });
    } else if (pedestalKey !== undefined) {
      const carried = carriedTree(state);
      this.openPanel(pedestalPanel(pedestalKey, carried), () => {
        if (carried) placeTree(state, carried, pedestalKey);
        this.closePanel();
        this.relocated();
      });
    } else if ('label' in near) {
      this.openPanel(placeholderPanel(near));
    }
  }

  /** The panel's Pick up: refused with a toast while another tree is carried. */
  private pickUp(tree: BonsaiTree): void {
    const carried = carriedTree(this.ctx.state);
    this.closePanel();
    if (pickUpTree(this.ctx.state, tree)) this.relocated();
    else if (carried) this.showToast(`Already carrying ${treeLabel(carried)}`);
  }

  /** After a location change: redraw the trees and the carry line, publish. */
  private relocated(): void {
    this.drawTrees();
    this.drawPlayer();
    this.publishHook();
  }

  /** Placeholder obj_tree_sprite: a pot, a canopy circle scaled from trunk height, the label. */
  private drawTrees(): void {
    for (const part of this.treeParts) part.destroy();
    const sprites = treeSprites(this.ctx.state, SHED_ROOM);
    this.treeParts = sprites.flatMap((s) => {
      const pot = s.size * 0.3;
      const r = s.size * 0.35;
      return [
        this.add.rectangle(s.x, s.y, s.size * 0.5, pot, 0xb06a3c).setOrigin(0.5, 1),
        this.add.circle(s.x, s.y - s.size + r, r, 0x5f8a4a).setStrokeStyle(1, 0x3c5a2e),
        this.add.text(s.x, s.y - s.size - 1, s.label, LABEL_STYLE).setOrigin(0.5, 1),
      ].map((part) => part.setDepth(s.depth));
    });
    this.targets = [...SHED_ROOM.props, ...treeTargets(sprites)];
    const carried = carriedTree(this.ctx.state);
    this.carryText.setText(carried ? `Carrying: ${treeLabel(carried)}` : '');
  }

  /** obj_ui_save_slots in load mode over the room; Close keeps the unsaved game. */
  private openLoadPicker(): void {
    this.openPanel(loadSlotsPanel(readSlotRows(this.ctx.storage)), (i) => {
      this.pickPanelSlot(i + 1);
    });
  }

  /** Loads a slot picked in the panel and makes it the active slot. */
  private pickPanelSlot(slot: number): void {
    let state: GameState | undefined;
    try {
      state = loadGame(this.ctx.storage, slot);
    } catch {
      state = undefined;
    }
    if (state) {
      this.scene.restart({ ...this.ctx, state, slot });
    } else {
      this.closePanel();
      this.showToast(`Could not load slot ${String(slot)}`);
    }
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
   * F9: the active slot as last saved. On an empty or unreadable slot the Load
   * Game picker opens over the room instead, as the prototype's controller did
   * (obj_game_controller/Step_0.gml lines 31-41), and Close keeps the unsaved game.
   */
  private reload(): void {
    const { storage, slot } = this.ctx;
    let state: GameState | undefined;
    try {
      state = loadGame(storage, slot);
    } catch {
      state = undefined;
    }
    if (state) this.scene.restart({ ...this.ctx, state });
    else this.openLoadPicker();
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
    const modal = this.panel?.modal === true;
    const showInteract = this.near !== undefined && !viewerOpen && !modal;
    this.hud.setVisible(!viewerOpen);
    this.carryText.setVisible(!viewerOpen);
    this.menuButton.setVisible(!viewerOpen && !modal);
    this.promptText.setVisible(showInteract);
    this.interactButton.setVisible(showInteract);
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
      // obj_player_2d/Step_0: no movement while a UI panel is open.
      if (!modal) this.player = stepPlayer(this.player, input, SHED_ROOM);
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
    const { x, y } = this.player;
    this.playerRect.setPosition(x, y).setDepth(y);
    this.near = nearestInteractable(this.player, this.targets);
    this.promptText.setText(this.near ? promptFor(this.near) : '').setPosition(x, y - PLAYER_H - 2);
  }

  private openViewer(): void {
    const { overrides, state } = this.ctx;
    const viewTree = this.viewTree;
    if (!viewTree || !this.roomKeysLive()) return;
    this.joystick = undefined;
    this.closePanel();
    this.viewer.open(viewTree, overrides.season ?? seasonForDay(state.day), state);
    this.hud.setVisible(false);
    this.carryText.setVisible(false);
    this.menuButton.setVisible(false);
    this.promptText.setVisible(false);
    this.interactButton.setVisible(false);
    this.publishHook();
  }

  /** Centres of the tappable controls on screen, for the test hook; none under the viewer, only the panel's under a modal. */
  private controls(): BonsaiTestHook['controls'] {
    if (this.viewer.isOpen) return [];
    const at = (id: string, text: Phaser.GameObjects.Text) => {
      const c = text.getCenter();
      return { id, x: c.x, y: c.y };
    };
    const rows = this.panel?.buttons.map((b) => at(b.id, b.text)) ?? [];
    if (this.panel?.modal) return rows;
    const interact = this.near ? [at('interact', this.interactButton)] : [];
    return [at('view', this.viewButton), at('menu', this.menuButton), ...interact, ...rows];
  }

  private readonly publishHook = (): void => {
    const { state, slot } = this.ctx;
    const carried = carriedTree(state);
    window.__bonsai = {
      ...this.base,
      activeSlot: slot,
      slots: this.slots,
      toast: this.toast.text,
      picker: '',
      panel: this.panel?.key ?? '',
      near: this.near?.key ?? '',
      carrying: carried ? treeLabel(carried) : '',
      treeLocations: state.trees.map((t) => ({
        id: t.id,
        name: treeLabel(t),
        location: t.location,
      })),
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
