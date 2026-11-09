import Phaser from 'phaser';
import { loadGame, saveGame } from '../sim/save';
import { seasonForDay } from '../sim/seasons';
import { scoreTree } from '../sim/scoring';
import { repotTree } from '../sim/growth';
import { inventoryHas } from '../sim/inventory';
import { sellTree } from '../sim/shop';
import { STYLE_KEYS, getStyle } from '../sim/styles';
import {
  MAX_TREE_NAME_LENGTH,
  carriedTree,
  pickUpTree,
  placeTree,
  putDownTree,
  renameTree,
  setTargetStyle,
  treeOnPedestal,
} from '../sim/tree';
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
  PANEL_CLOSE_LABEL,
  PANEL_DISABLED_COLOR,
  PANEL_INSET,
  PANEL_TEXT_COLOR,
  loadSlotsPanel,
  panelClose,
  panelTitleY,
  pedestalPanel,
  placeholderPanel,
  type PanelModel,
} from '../world/panels';
import { clamp } from '../sim/vec3';
import {
  DISABLED_COLOR,
  FOOTER_COLOR,
  INSPECTOR_CLOSE_LABEL,
  INSPECTOR_INSET,
  INSPECTOR_PANEL,
  INSPECTOR_TITLE_H,
  NOTE_COLOR,
  inspectorAction,
  inspectorPanel,
  type InspectorButtonId,
  type InspectorText,
} from '../world/inspector';
import { fixedSteps, joystickInput, keyboardInput } from '../world/input';
import { onKeyDown } from '../world/keys';
import { createPlayer, stepPlayer, type MoveInput, type PlayerState } from '../world/player';
import { occupiedSlots, readSlotRows } from '../world/saveSlots';
import { createSourcePlant, takeCutting, type SourcePlantState } from '../sim/sourcePlant';
import type { SpeciesKey } from '../sim/types';
import { BASE_TIME_SCALE, tickClock } from '../world/clock';
import { ROOMS } from '../world/gardenRoom';
import { SHED_ROOM, type DoorTarget, type Prop, type Room } from '../world/shedRoom';
import { treeSprites, treeTargets, treeLabel, type TreeTarget } from '../world/treeSprites';
import {
  RENAME_INPUT,
  renameCounter,
  renamePanel,
  repotPanel,
  sellPanel,
  stylePanel,
} from '../world/treePanels';
import { crispText, fitCamera, sceneZoom } from './crisp';
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
  /** The tree an open inspector shows. */
  readonly tree?: BonsaiTree;
  /** Removes what the panel put outside Phaser (the rename input). */
  readonly dispose?: () => void;
}

/** Text colours of the inspector's lines and enabled buttons. */
const INSPECTOR_TEXT = '#ffffff';
const INSPECTOR_HINT = '#b4b4b4';
/** obj_ui_panel's title bar band, rgb(60, 80, 55). */
const TITLE_BAR = 0x3c5037;
/** ui_bar's dark track and its height in logical px. */
const BAR_TRACK = 0x282828;
const BAR_H = 6;

/**
 * The rooms with placeholder art: floor, walls and labelled prop rectangles,
 * and the player as a rectangle depth-sorted by y against the props. A new or
 * loaded game starts in the shed; a door redraws the scene as its target room
 * (src/world/gardenRoom.ts) with the player at its target spot. Room data,
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
 * floor grid, where they are interactables, or on a pedestal. A tree opens the
 * inspector (src/world/inspector.ts): Water, Fertilise and Skip go through its
 * pure dispatch and redraw it in place, Pick up and View in 3D are this
 * scene's, and Rename, Set Style, Sell and Repot open their sub-panels
 * (src/world/treePanels.ts), which act through src/sim/. Pedestal panels place the carried tree and the menu puts it down,
 * all through the location helpers in src/sim/tree.ts.
 *
 * The day clock (src/world/clock.ts) runs from the frame loop while the viewer
 * is closed; `?timeScale=` speeds it up.
 */
export class WorldScene extends Phaser.Scene {
  private ctx!: WorldSceneData;
  private viewTree: BonsaiTree | undefined;
  /** Hook fields read once from the state the world was started with (new or loaded). */
  private base!: Pick<BonsaiTestHook, 'version' | 'trees' | 'starterScore' | 'starterHeightCm'>;
  /** The room shown, and what its floor, walls and props were drawn as. */
  private room: Room = SHED_ROOM;
  private roomParts: Phaser.GameObjects.GameObject[] = [];
  /** obj_source_plant's counters, per plant key for this visit to the room. */
  private readonly plants = new Map<string, SourcePlantState>();
  /** The day clock's accumulator in seconds (src/world/clock.ts); transient. */
  private clockS = 0;
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
    this.clockS = 0;
    this.room = SHED_ROOM;
    this.roomParts = [];
    this.plants.clear();
    fitCamera(this, this.publishHook);

    this.drawRoom();
    this.player = createPlayer(SHED_ROOM);
    this.playerRect = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, 0xc9d8a8).setOrigin(0.5, 1);
    this.promptText = this.text(0, 0, '', { ...LABEL_STYLE, color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH);

    this.hud = this.text(HUD_BADGE.right, HUD_BADGE.top, hudText(data.state), {
      ...LABEL_STYLE,
      fontSize: '10px',
      color: '#ffffff',
    })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.carryText = this.text(CARRY_TEXT.right, CARRY_TEXT.top, '', {
      ...LABEL_STYLE,
      fontSize: '10px',
    })
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
    this.toast = this.text(TOAST_X, 2, '', {
      ...LABEL_STYLE,
      fontSize: '10px',
      color: '#ffffff',
    }).setDepth(HUD_DEPTH);

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
    // Through onKeyDown, which ignores Phaser's replays of an already handled event.
    onKeyDown(keyboard, 'V', () => {
      this.openViewer();
    });
    onKeyDown(keyboard, 'E', () => {
      this.interact();
    });
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => {
      onKeyDown(keyboard, name, () => {
        if (this.panel?.buttons.some((b) => b.id === `panel-slot-${String(i + 1)}`)) {
          this.pickPanelSlot(i + 1);
        }
      });
    });
    // Captured so the browser's own F5 (reload) never fires in the room.
    keyboard.addCapture([K.F5, K.F9]);
    onKeyDown(keyboard, 'F5', () => {
      if (this.roomKeysLive()) this.save();
    });
    onKeyDown(keyboard, 'F9', () => {
      if (this.roomKeysLive()) this.reload();
    });
    // Keyboard events reach Phaser after the viewer's own window listener, so
    // the Escape that closed the viewer is seen here with the viewer already
    // closed; its timestamp tells them apart.
    onKeyDown(keyboard, 'ESC', (event) => {
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
        // World px, not canvas px: the joystick's dead zone and radius are logical.
        const { worldX: x, worldY: y } = pointer;
        this.joystick = { id: pointer.id, x, y, input: { x: 0, y: 0 } };
      },
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystick?.id) return;
      const { worldX, worldY } = pointer;
      this.joystick.input = joystickInput(worldX - this.joystick.x, worldY - this.joystick.y);
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
      this.panel?.dispose?.();
      this.viewer.destroy();
      keyboard.removeCapture([K.F5, K.F9]);
    });
    this.publishHook();
  }

  private text(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return crispText(this, x, y, text, style);
  }

  private hudButton(
    x: number,
    y: number,
    label: string,
    onTap: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.text(x, y, label, { ...LABEL_STYLE, fontSize: '10px' })
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
        if (tree) putDownTree(tree, this.room.key);
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
  private openPanel(
    model: PanelModel,
    onRow: (index: number) => void = () => undefined,
  ): Phaser.GameObjects.Text[] {
    this.closePanel();
    this.joystick = undefined;
    const box = model.box ?? PANEL;
    const dim = this.add
      .rectangle(0, 0, this.room.width, this.room.height, 0x000000, 0.5)
      .setOrigin(0)
      .setDepth(MODAL_DEPTH)
      .setInteractive();
    const left = box.x + PANEL_INSET;
    const style = { ...LABEL_STYLE, fontSize: '10px', color: '#ffffff' };
    const text = (y: number, label: string, color: string) =>
      this.text(left, y, label, { ...style, color })
        .setOrigin(0, 0.5)
        .setDepth(MODAL_DEPTH);
    const parts: Phaser.GameObjects.GameObject[] = [
      dim,
      this.panelBox(box, MODAL_DEPTH),
      text(panelTitleY(box), model.title, '#ffffff'),
    ];
    const buttons: OpenPanel['buttons'] = [];
    // A greyed row is plain text, not a control.
    const texts = model.rows.map((row, i) => {
      if (!row.id || row.enabled === false) {
        const color = row.enabled === false ? PANEL_DISABLED_COLOR : PANEL_TEXT_COLOR;
        const t = text(row.y, row.text, row.color ?? color);
        parts.push(t);
        return t;
      }
      const button = this.hudButton(left, row.y, row.text, () => {
        onRow(i);
      });
      buttons.push({ id: row.id, text: button.setOrigin(0, 0.5).setColor(row.color ?? '#ffffff') });
      return button;
    });
    const at = panelClose(box);
    const close = this.hudButton(at.x, at.y, PANEL_CLOSE_LABEL, () => {
      this.closePanel();
    });
    buttons.push({ id: 'panel-close', text: close.setOrigin(0.5) });
    for (const b of buttons) b.text.setDepth(MODAL_DEPTH);
    this.panel = { key: model.key, modal: true, parts, buttons };
    this.publishHook();
    return texts;
  }

  /** obj_ui_tree_repot_confirm; the soil toggle reopens it with the flag flipped. */
  private openRepot(tree: BonsaiTree, premiumSoil = false): void {
    const { state } = this.ctx;
    const model = repotPanel(tree, state, premiumSoil);
    this.openPanel(model, (i) => {
      const id = model.rows[i]?.id;
      if (id === 'panel-soil') {
        this.openRepot(tree, !premiumSoil);
        return;
      }
      const tier = id === 'panel-repot-fancy' ? 1 : 0;
      const soil = premiumSoil && inventoryHas(state.inventory, 'soil_premium', 1) ? 1 : 0;
      const done = repotTree(tree, state, tier, soil);
      this.closePanel();
      this.relocated();
      this.showToast(
        done ? `Repotted into a ${tier === 1 ? 'fancy' : 'standard'} pot` : 'Could not repot',
      );
    });
  }

  /** obj_ui_tree_sell_confirm: the tree leaves the room for good. */
  private openSell(tree: BonsaiTree): void {
    this.openPanel(sellPanel(tree), () => {
      const price = sellTree(this.ctx.state, tree);
      this.closePanel();
      this.relocated();
      if (price !== undefined) {
        this.showToast(`Sold ${treeLabel(tree)} for ${String(price)} coins`);
      }
    });
  }

  /** obj_ui_tree_style_picker, one tap per pick. */
  private openStyle(tree: BonsaiTree): void {
    const model = stylePanel(tree);
    this.openPanel(model, (i) => {
      const key = model.rows[i]?.id.replace('panel-style-', '') ?? '';
      const style = STYLE_KEYS.find((k) => k === key);
      setTargetStyle(tree, style ?? '');
      this.closePanel();
      this.showToast(style ? `Style: ${getStyle(style).displayName}` : 'Style cleared');
    });
  }

  /**
   * obj_ui_tree_rename with a DOM input over the canvas where the panel's
   * input box is. Enter in it saves; Escape reaches the scene's handler,
   * which closes the panel (and the input with it). The room's keys are dead
   * under the modal, so typing reaches nothing else.
   */
  private openRename(tree: BonsaiTree): void {
    const input = document.createElement('input');
    input.id = 'rename-input';
    input.maxLength = MAX_TREE_NAME_LENGTH;
    input.value = tree.name;
    input.style.position = 'fixed';
    input.style.boxSizing = 'border-box';
    input.style.background = '#141914';
    input.style.color = '#ffffff';
    input.style.border = '1px solid #8ca078';
    input.style.fontFamily = 'monospace';
    const place = (): void => {
      const r = this.game.canvas.getBoundingClientRect();
      const sx = r.width / this.room.width;
      const sy = r.height / this.room.height;
      const box = RENAME_INPUT;
      input.style.left = `${String(r.left + box.x * sx)}px`;
      input.style.top = `${String(r.top + (box.y - box.h / 2) * sy)}px`;
      input.style.width = `${String(box.w * sx)}px`;
      input.style.height = `${String(box.h * sy)}px`;
      input.style.fontSize = `${String(10 * sy)}px`;
    };
    const save = (): void => {
      const name = renameTree(tree, input.value);
      this.closePanel();
      this.relocated();
      this.showToast(`Renamed to ${name}`);
    };
    const texts = this.openPanel(renamePanel(tree, input.value), save);
    input.addEventListener('input', () => {
      texts[2]?.setText(renameCounter(input.value));
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
    place();
    this.scale.on('resize', place);
    document.body.appendChild(input);
    input.focus();
    if (this.panel) {
      this.panel = {
        ...this.panel,
        dispose: () => {
          this.scale.off('resize', place);
          input.remove();
        },
      };
    }
  }

  /**
   * obj_ui_tree_inspector over the dimmed room. Water, Fertilise and Skip
   * rebuild it in place: the new parts are drawn before the old ones go, so
   * the hook's `panel` stays `tree:<id>` throughout. Greyed buttons are plain
   * text, not controls.
   */
  private openInspector(tree: BonsaiTree): void {
    const { state } = this.ctx;
    const m = inspectorPanel(tree, state);
    const box = INSPECTOR_PANEL;
    const line = (l: InspectorText, color = INSPECTOR_TEXT) =>
      this.text(l.x, l.y, l.text, { ...LABEL_STYLE, color }).setOrigin(0, 0.5);
    const big = { ...LABEL_STYLE, fontSize: '10px', color: INSPECTOR_TEXT };
    const parts: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [
      this.add
        .rectangle(0, 0, this.room.width, this.room.height, 0x000000, 0.5)
        .setOrigin(0)
        .setInteractive(),
      this.panelBox(box, MODAL_DEPTH),
      this.add.rectangle(box.x, box.y, box.w, INSPECTOR_TITLE_H, TITLE_BAR).setOrigin(0),
      this.text(box.x + INSPECTOR_INSET, box.y + INSPECTOR_TITLE_H / 2, m.title, big).setOrigin(
        0,
        0.5,
      ),
      ...m.stats.map((l) => line(l)),
      ...m.notes.map((l) => line(l, NOTE_COLOR)),
      line(m.score),
      ...m.breakdown.flatMap((c) => [line(c.label), line(c.value)]),
      ...m.bars.flatMap((b) => [
        line({ text: b.label, x: b.x, y: b.y }),
        this.add.rectangle(b.trackX, b.y, b.trackW, BAR_H, BAR_TRACK).setOrigin(0, 0.5),
        this.add
          .rectangle(b.trackX, b.y, b.trackW * clamp(b.value / b.max, 0, 1), BAR_H, b.color)
          .setOrigin(0, 0.5),
        this.add
          .rectangle(b.trackX, b.y, b.trackW, BAR_H)
          .setOrigin(0, 0.5)
          .setStrokeStyle(1, 0xffffff),
        line({ text: b.text, x: b.textX, y: b.y }),
      ]),
      line(m.footer, FOOTER_COLOR),
    ];
    const actions: Record<InspectorButtonId, () => void> = {
      water: () => {
        this.care(tree, 'water');
      },
      fertilise: () => {
        this.care(tree, 'fertilise');
      },
      skip: () => {
        this.care(tree, 'skip');
      },
      pickup: () => {
        this.pickUp(tree);
      },
      view: () => {
        this.closePanel();
        this.openViewer(tree);
      },
      rename: () => {
        this.openRename(tree);
      },
      style: () => {
        this.openStyle(tree);
      },
      sell: () => {
        this.openSell(tree);
      },
      repot: () => {
        this.openRepot(tree);
      },
    };
    const buttons: OpenPanel['buttons'] = [];
    for (const b of m.buttons) {
      if (b.enabled) {
        const text = this.hudButton(b.x, b.y, b.label, actions[b.id]).setColor(INSPECTOR_TEXT);
        buttons.push({ id: `panel-${b.id}`, text: text.setOrigin(0, 0.5) });
      } else {
        parts.push(
          this.text(b.x, b.y, b.label, { ...big, color: DISABLED_COLOR }).setOrigin(0, 0.5),
        );
      }
    }
    const close = this.hudButton(
      box.x + box.w - INSPECTOR_INSET,
      box.y + INSPECTOR_TITLE_H / 2,
      INSPECTOR_CLOSE_LABEL,
      () => {
        this.closePanel();
      },
    );
    buttons.push({ id: 'panel-close', text: close.setOrigin(1, 0.5).setColor(INSPECTOR_HINT) });
    for (const part of parts) part.setDepth(MODAL_DEPTH);
    for (const b of buttons) b.text.setDepth(MODAL_DEPTH);
    this.destroyPanel();
    this.joystick = undefined;
    this.panel = { key: m.key, modal: true, parts, buttons, tree };
    this.publishHook();
  }

  /** An inspector care button: the pure dispatch, then the tree sprite and the inspector redrawn. */
  private care(tree: BonsaiTree, id: 'water' | 'fertilise' | 'skip'): void {
    inspectorAction(this.ctx.state, tree, id);
    this.drawTrees();
    this.drawPlayer();
    this.openInspector(tree);
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.destroyPanel();
    this.publishHook();
  }

  private destroyPanel(): void {
    this.panel?.dispose?.();
    for (const part of this.panel?.parts ?? []) part.destroy();
    for (const button of this.panel?.buttons ?? []) button.text.destroy();
    this.panel = undefined;
  }

  /**
   * E or the Interact button: a floor tree or an occupied pedestal opens the
   * tree's inspector, an empty pedestal the Display Pedestal panel, a door
   * leads to its room, a source plant gives a cutting, any other prop opens
   * its placeholder.
   */
  private interact(): void {
    const near = this.near;
    if (!this.roomKeysLive() || !near) return;
    const { state } = this.ctx;
    if ('tree' in near) {
      this.openInspector(near.tree);
      return;
    }
    const { pedestalKey, target, speciesKey } = near;
    const tree = pedestalKey === undefined ? undefined : treeOnPedestal(state, pedestalKey);
    if (tree) {
      this.openInspector(tree);
    } else if (pedestalKey !== undefined) {
      const carried = carriedTree(state);
      this.openPanel(pedestalPanel(pedestalKey, carried), () => {
        if (carried) placeTree(state, carried, pedestalKey);
        this.closePanel();
        this.relocated();
      });
    } else if (target) {
      this.enterRoom(target);
    } else if (speciesKey) {
      this.takeCutting(near.key, speciesKey);
    } else {
      this.openPanel(placeholderPanel(near));
    }
  }

  /**
   * obj_door: the player stands at the target spot of the target room, whose
   * floor, walls, props and trees are drawn afresh. The source plants start a
   * new visit, as the prototype's room instances were recreated on entry.
   */
  private enterRoom(target: DoorTarget): void {
    this.room = ROOMS[target.room];
    this.plants.clear();
    this.joystick = undefined;
    this.drawRoom();
    this.player = { ...this.player, x: target.x, y: target.y };
    this.relocated();
  }

  /** obj_source_plant: the cutting rule in src/sim/sourcePlant.ts, its message as a toast. */
  private takeCutting(plantKey: string, speciesKey: SpeciesKey): void {
    const plant = this.plants.get(plantKey) ?? createSourcePlant();
    this.plants.set(plantKey, plant);
    this.showToast(takeCutting(this.ctx.state, plant, speciesKey));
  }

  /** The room's floor, walls and labelled prop rectangles (source plants green), replacing the last room's. */
  private drawRoom(): void {
    for (const part of this.roomParts) part.destroy();
    const room = this.room;
    this.roomParts = [
      this.add.rectangle(0, 0, room.width, room.height, room.floor).setOrigin(0).setDepth(-1),
      ...room.walls.map((w) =>
        this.add.rectangle(w.x, w.y, w.w, w.h, 0x5b4a36).setOrigin(0).setDepth(-1),
      ),
      ...room.props.flatMap((p) => {
        const bottom = p.y + p.h / 2;
        const [fill, stroke] = p.speciesKey ? [0x4f7a3c, 0x8fbf6a] : [0x7a6248, 0xb39a74];
        return [
          this.add.rectangle(p.x, p.y, p.w, p.h, fill).setStrokeStyle(1, stroke).setDepth(bottom),
          this.text(p.x, p.y, p.label, LABEL_STYLE).setOrigin(0.5).setDepth(bottom),
        ];
      }),
    ];
  }

  /** The inspector's Pick up: refused with a toast while another tree is carried. */
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
    const sprites = treeSprites(this.ctx.state, this.room);
    this.treeParts = sprites.flatMap((s) => {
      const pot = s.size * 0.3;
      const r = s.size * 0.35;
      return [
        this.add.rectangle(s.x, s.y, s.size * 0.5, pot, 0xb06a3c).setOrigin(0.5, 1),
        this.add.circle(s.x, s.y - s.size + r, r, 0x5f8a4a).setStrokeStyle(1, 0x3c5a2e),
        this.text(s.x, s.y - s.size - 1, s.label, LABEL_STYLE).setOrigin(0.5, 1),
      ].map((part) => part.setDepth(s.depth));
    });
    this.targets = [...this.room.props, ...treeTargets(sprites)];
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

    this.runClock(delta);
    const { steps, accumulatorMs } = fixedSteps(this.accumulatorMs, delta);
    this.accumulatorMs = accumulatorMs;
    if (steps === 0) return;
    const input = this.joystick?.input ?? this.keyboardMove();
    for (let i = 0; i < steps; i += 1) {
      // obj_player_2d/Step_0: no movement while a UI panel is open.
      if (!modal) this.player = stepPlayer(this.player, input, this.room);
      this.frames += 1;
    }
    this.drawPlayer();
    this.hud.setText(hudText(this.ctx.state));
    this.publishHook();
  }

  /**
   * The day clock (obj_game_controller Step_0), run while the viewer is closed,
   * modal panels or not. A passing day regrows the sprites, refreshes an open
   * inspector and the HUD, and toasts the display revenue it paid.
   */
  private runClock(deltaMs: number): void {
    const { state, overrides } = this.ctx;
    const timeScale = overrides.timeScale ?? BASE_TIME_SCALE;
    const tick = tickClock(state, this.clockS, deltaMs / 1000, timeScale);
    this.clockS = tick.accumulatorS;
    if (tick.days === 0) return;
    this.drawTrees();
    this.drawPlayer();
    if (this.panel?.tree) this.openInspector(this.panel.tree);
    this.hud.setText(hudText(state));
    if (tick.revenue > 0) this.showToast(`Display revenue: +$${String(tick.revenue)}`);
    else this.publishHook();
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

  /**
   * The 3D viewer on `viewTree`: the inspector's View in 3D passes its tree;
   * View tree (V) and the V key show the first tree, or the `?tree=` fixture.
   */
  private openViewer(viewTree = this.viewTree): void {
    const { overrides, state } = this.ctx;
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
    const inspected = this.panel?.tree;
    window.__bonsai = {
      ...this.base,
      season: seasonForDay(state.day),
      day: state.day,
      inventory: { ...state.inventory },
      tutorialStep: state.tutorialStep,
      inspected: inspected && {
        id: inspected.id,
        waterLevel: inspected.waterLevel,
        fertilizedUntilDay: inspected.fertilizedUntilDay,
        ageDays: inspected.ageDays,
        vitality: inspected.vitality,
        vigor: inspected.vigor,
        heightCm: inspected.trunk.heightCm,
        revision: inspected.revision,
        name: inspected.name,
        targetStyle: inspected.targetStyle,
        potTier: inspected.potTier,
        soilTier: inspected.soilTier,
        score: scoreTree(inspected).total,
      },
      money: state.money,
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
      zoom: sceneZoom(this),
      // The game state's own flag, not the viewer's, so a test sees what the
      // simulation would see after the viewer has let go.
      paused: state.paused,
      viewer: this.viewer.snapshot(),
      room: this.room.key,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      hud: hudText(state),
      frames: this.frames,
    };
  };
}
