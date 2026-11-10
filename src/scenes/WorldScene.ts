import Phaser from 'phaser';
import { loadGame, saveGame } from '../sim/save';
import { seasonForDay, type Season } from '../sim/seasons';
import { scoreTree } from '../sim/scoring';
import { repotTree } from '../sim/growth';
import { inventoryHas } from '../sim/inventory';
import { sellTree, shopBuy } from '../sim/shop';
import { STYLE_KEYS, getStyle } from '../sim/styles';
import { SPECIES_KEYS, getSpecies } from '../sim/species';
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
  NOTEBOOK_BUTTON,
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
  type PanelModel,
} from '../world/panels';
import { makePot, plantCutting } from '../sim/planting';
import {
  NO_SELECTION,
  PLANTING_TABLE_KEY,
  WORKBENCH_KEY,
  plantPanel,
  plantSelection,
  selectId,
  type PlantSelection,
} from '../world/plantPanel';
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
import {
  PROTOTYPE_SCALE,
  SHED_ROOM,
  type DoorTarget,
  type Prop,
  type Room,
} from '../world/shedRoom';
import { treeSprites, treeTargets, treeLabel, type TreeTarget } from '../world/treeSprites';
import {
  RENAME_INPUT,
  renameCounter,
  renamePanel,
  repotPanel,
  sellPanel,
  stylePanel,
} from '../world/treePanels';
import { SHOP_KIOSK_KEY, shopItemFor, shopPanel } from '../world/shopPanel';
import {
  NOTEBOOK_KEY,
  notebookHeader,
  notebookOpeningPage,
  notebookPanel,
} from '../world/notebook';
import {
  TUTORIAL_HEADING_COLOR,
  skipConfirmPanel,
  tutorialPanel,
  type TutorialPanelModel,
} from '../world/tutorialPanel';
import { tutorialSkip, tutorialStepLabel } from '../sim/tutorial';
import { SETTINGS_KEY, settingsPanel } from '../world/settingsPanel';
import {
  createParticles,
  isIndoor,
  particleDraw,
  stepParticles,
  weatherArea,
  weatherProfile,
  type Particle,
  type WeatherArea,
  type WeatherProfile,
} from '../world/weather';
import { PLAYER_SCALE, SHEETS, SPRITE_SCALE, playerFrame } from '../world/assets';
import {
  PEDESTAL_EMPTY_COLOUR,
  PEDESTAL_EMPTY_LABEL,
  PEDESTAL_LABEL_DY,
  SHED_FLOOR_DIM,
  SHED_RUG,
  fenceCorners,
  floorTiles,
  playerShadow,
  propShadow,
  propSprite,
  wallRuns,
  type Shadow,
} from '../world/roomArt';
import { treeArt, type TreeArt } from '../world/treeArt';
import { viewSize, worldView, worldZoom, type WorldView } from '../world/worldCamera';
import { crispText, fitCamera, sceneZoom, textZoom, type DeviceZoom } from './crisp';
import { fullscreenState, onFullscreenChange, toggleSetting } from './settings';
import type { TitleSceneData, WorldSceneData } from './sceneData';
import { FONT_FAMILY, LABEL_STYLE, fontLoaded } from './textStyle';

const TOAST_MS = 2000;
/** The player sprite's drawn height, round its centre: spr_player's 32 px at 1.5x, halved. */
const PLAYER_H = SHEETS.player.frameHeight * PLAYER_SCALE;
/** The baked room (floor, dim, rug, walls) under everything, then the drop shadows; props and the player sort by y above 0. */
const FLOOR_DEPTH = -2;
const SHADOW_DEPTH = -1;
/**
 * The baked room's quad: one texture sample per fragment, nearest as the game's
 * pixelArt textures are. An Image would go through Phaser's batched sprite
 * shader, whose per-fragment work over the whole canvas costs a third of the
 * frame rate on software GL (headless Chromium, CI). A Shader draws only under
 * WebGL, which src/main.ts asks Phaser for explicitly (the 3D viewer needs it anyway).
 */
const ROOM_QUAD = {
  name: 'roomQuad',
  fragmentSource: `precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;
void main () { gl_FragColor = texture2D(uMainSampler, outTexCoord); }`,
  setupUniforms: (setUniform: (name: string, value: number) => void): void => {
    setUniform('uMainSampler', 0);
  },
};
/** The rug's corner radius: draw_roundrect takes none, so this approximates GameMaker's own. */
const RUG_RADIUS = 3;
const HUD_DEPTH = 10_000;
/** Modal panels and their dimmer sit above the HUD, so a press on the HUD under them hits the dimmer. */
const MODAL_DEPTH = 10_001;
/** Weather falls past the room, props, trees and player (depth = bottom y, at most 270), under the HUD. */
const WEATHER_DEPTH = 9_000;

/** The particle field of the room shown, built for one season (obj_weather's instance). */
interface WeatherField {
  readonly season: Season;
  readonly profile: WeatherProfile;
  readonly area: WeatherArea;
  readonly parts: Particle[];
}

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

type HudPart = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

/** Text colours of the inspector's lines and enabled buttons. */
const INSPECTOR_TEXT = '#ffffff';
const INSPECTOR_HINT = '#b4b4b4';
/** obj_ui_panel's title bar band, rgb(60, 80, 55). */
const TITLE_BAR = 0x3c5037;
/** ui_bar's dark track and its height in logical px. */
const BAR_TRACK = 0x282828;
const BAR_H = 6;

/**
 * The rooms drawn from the prototype's sprites (src/world/roomArt.ts): floor
 * tiles, walls or fence, the props, their shadows, and the player's animated
 * sprite depth-sorted at its feet against the props' bottom edges; trees are drawn in code as
 * obj_tree_sprite did (src/world/treeArt.ts). A new or
 * loaded game starts in the shed; a door redraws the scene as its target room
 * (src/world/gardenRoom.ts) with the player at its target spot. Room data,
 * movement and the HUD text come from the pure modules in src/world/; this
 * scene only reads input, draws and publishes the test hook.
 *
 * The 3D viewer is a DOM canvas over this one. While it is open the world
 * ignores its own keys and pointers and does not step.
 *
 * The Menu button (top-left) opens a panel with Save, Load, Settings and
 * Title; F5, F9 and Escape are the shortcuts of Save, Load and Title: save to
 * the active slot, reload it, go back to the title without saving (all through
 * src/sim/save.ts and the storage from boot). Settings opens the Settings
 * panel (src/world/settingsPanel.ts) as a modal.
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
 *
 * While the tutorial runs, its corner panel (src/world/tutorialPanel.ts) sits
 * in the HUD under the badge, redrawn on any publish after the step or the
 * modal state changed it; its Skip opens a confirmation. J or `Notebook (J)`
 * opens Granny's notebook (src/world/notebook.ts), whose Prev and Next reopen
 * it on the new page.
 *
 * Ambient weather (src/world/weather.ts) falls over the room: the season's in
 * the garden, dust motes in the shed. It steps with the player, rebuilds on
 * room entry and when a day changes the season, and is off with the setting.
 *
 * Two cameras (src/world/worldCamera.ts): the world camera draws the room,
 * props, shadows, trees, the player, its prompt and the weather, zoomed by
 * the world zoom and following the player inside the room's drawn extent; the
 * main camera, added on top, draws everything else (HUD, menu, toast,
 * panels, dimmers, the tutorial box) on the unzoomed logical canvas. An
 * object is the main camera's unless `inWorld` hands it to the world camera.
 */
export class WorldScene extends Phaser.Scene {
  private ctx!: WorldSceneData;
  private viewTree: BonsaiTree | undefined;
  /** Hook fields read once from the state the world was started with (new or loaded). */
  private base!: Pick<
    BonsaiTestHook,
    'version' | 'fontLoaded' | 'trees' | 'starterScore' | 'starterHeightCm'
  >;
  /** The room shown, and what its floor, walls and props were drawn as. */
  private room: Room = SHED_ROOM;
  /** The camera that draws the room; `cameras.main` is the HUD's, on top of it. */
  private worldCamera!: Phaser.Cameras.Scene2D.Camera;
  /** What the world camera shows, in room units: the hook's `camera`. */
  private view: WorldView = { zoom: 1, scrollX: 0, scrollY: 0 };
  private roomParts: Phaser.GameObjects.GameObject[] = [];
  /** The room's static art, baked on entry (bakeRoom); destroyed on leaving the room or the scene. */
  private roomTexture: Phaser.Textures.DynamicTexture | undefined;
  /** The props', floor trees' and the player's drop shadows, at floor depth. */
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  /** obj_source_plant's counters, per plant key for this visit to the room. */
  private readonly plants = new Map<string, SourcePlantState>();
  /** The weather of the room shown, undefined while the setting is off; drawn into `weatherGfx`. */
  private weather: WeatherField | undefined;
  private weatherGfx!: Phaser.GameObjects.Graphics;
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
  private playerSprite!: Phaser.GameObjects.Sprite;
  private hud!: Phaser.GameObjects.Text;
  private viewButton!: Phaser.GameObjects.Text;
  private notebookButton!: Phaser.GameObjects.Text;
  /** The tutorial corner panel's parts, the model they show (JSON, '' for none) and its Skip while enabled. */
  private tutorialParts: HudPart[] = [];
  private tutorialDrawn = '';
  private tutorialSkipButton: Phaser.GameObjects.Text | undefined;
  /** The notebook page shown while it is open; scene state, never saved. */
  private notebookPage = 0;
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
      fontLoaded: fontLoaded(),
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
    this.roomTexture = undefined;
    this.plants.clear();
    this.tutorialParts = [];
    this.tutorialDrawn = '';
    this.tutorialSkipButton = undefined;
    this.player = createPlayer(SHED_ROOM);
    // The scene's own camera becomes the world camera; the HUD's, added after it, draws on top.
    this.worldCamera = this.cameras.main;
    this.cameras.add(0, 0, undefined, undefined, true, 'hud');
    const toHud = (o: Phaser.GameObjects.GameObject): void => {
      this.worldCamera.ignore(o);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, toHud);
    fitCamera(this, this.publishHook, this.fitWorld);

    this.shadowGfx = this.inWorld(this.add.graphics().setDepth(SHADOW_DEPTH));
    this.drawRoom();
    this.weatherGfx = this.inWorld(this.add.graphics().setDepth(WEATHER_DEPTH));
    this.buildWeather();
    const shadow = playerShadow(0, 0);
    this.playerShadow = this.inWorld(
      this.add.ellipse(0, 0, shadow.w, shadow.h, 0x000000, shadow.alpha).setDepth(SHADOW_DEPTH),
    );
    // obj_player_2d draws spr_player round its centre origin at (x, y), as here.
    this.playerSprite = this.inWorld(
      this.add.sprite(0, 0, SHEETS.player.key, 0).setScale(PLAYER_SCALE),
    );
    this.promptText = this.inWorld(
      this.text(0, 0, '', { ...LABEL_STYLE, color: '#ffffff' })
        .setOrigin(0.5, 1)
        .setDepth(HUD_DEPTH),
    );

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
    this.notebookButton = this.hudButton(
      NOTEBOOK_BUTTON.left,
      NOTEBOOK_BUTTON.bottom,
      'Notebook (J)',
      () => {
        this.toggleNotebook();
      },
    ).setOrigin(0, 1);
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
    onKeyDown(keyboard, 'J', () => {
      this.toggleNotebook();
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
        const { x, y } = this.screenPoint(pointer);
        this.joystick = { id: pointer.id, x, y, input: { x: 0, y: 0 } };
      },
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystick?.id) return;
      const { x, y } = this.screenPoint(pointer);
      this.joystick.input = joystickInput(x - this.joystick.x, y - this.joystick.y);
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
    onFullscreenChange(this, () => {
      if (this.panel?.key === SETTINGS_KEY) this.openSettings();
    });
    this.events.once('shutdown', () => {
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, toHud);
      this.panel?.dispose?.();
      this.viewer.destroy();
      this.roomTexture?.destroy();
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

  /** Hands `o` to the world camera alone (a text at its zoom, so it stays crisp); everything else is the HUD camera's. */
  private inWorld<T extends Phaser.GameObjects.GameObject>(o: T): T {
    // A camera skips an object whose cameraFilter has its id bit: here, only the HUD camera's.
    o.cameraFilter = this.cameras.main.id;
    if (o instanceof Phaser.GameObjects.Text) o.setResolution(textZoom(this, o));
    return o;
  }

  /** A pointer in logical screen px through the HUD camera, so the joystick's dead zone and radius ignore the world zoom. */
  private screenPoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  /** On create and each resize, after the HUD camera is fitted: the world camera's zoom for this viewport, then its view. */
  private readonly fitWorld = (zoom: DeviceZoom): void => {
    const factor = worldZoom(window.innerWidth, window.innerHeight);
    this.worldCamera.setZoom(zoom.x * factor, zoom.y * factor);
    this.view = { ...this.view, zoom: factor };
    this.follow();
  };

  /** Points the world camera at the player, clamped to the room's drawn extent (src/world/worldCamera.ts). */
  private follow(): void {
    this.view = worldView(this.player, this.room.bounds, this.view.zoom);
    const { w, h } = viewSize(this.view.zoom);
    this.worldCamera.centerOn(this.view.scrollX + w / 2, this.view.scrollY + h / 2);
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
      settings: () => {
        this.openSettings();
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
    const text = (y: number, label: string, color: string, x = left) =>
      this.text(x, y, label, { ...style, color })
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
        const t = text(row.y, row.text, row.color ?? color, row.x);
        parts.push(t);
        return t;
      }
      const button = this.hudButton(row.x ?? left, row.y, row.text, () => {
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

  /** obj_ui_settings from the HUD menu; a toggle applies and saves, then reopens it in place. */
  private openSettings(): void {
    const model = settingsPanel(this.ctx.settings, fullscreenState(this));
    this.openPanel(model, (i) => {
      const id = model.rows[i]?.id ?? '';
      toggleSetting(this, this.ctx, id);
      if (id === 'panel-weather') this.buildWeather();
      this.openSettings();
    });
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

  /** obj_ui_shop: a Buy buys one, then the HUD and the reopened shop show the new money and count. */
  private openShop(): void {
    const { state } = this.ctx;
    const model = shopPanel(state);
    this.openPanel(model, (i) => {
      const item = shopItemFor(model.rows[i]?.id ?? '');
      if (item) shopBuy(state, item.key, 1, item.price);
      this.hud.setText(hudText(state));
      this.openShop();
    });
  }

  /** obj_game_controller Step_0's J: closes the notebook if open, else opens it unless another modal is up. */
  private toggleNotebook(): void {
    if (this.panel?.key === NOTEBOOK_KEY) this.closePanel();
    else if (this.roomKeysLive()) this.openNotebook();
  }

  /** obj_ui_notebook on `page`, the active step's by default; Prev and Next reopen it on their page. */
  private openNotebook(page = notebookOpeningPage(this.ctx.state.tutorialStep)): void {
    const model = notebookPanel(this.ctx.state, page);
    this.notebookPage = page;
    this.openPanel(model, (i) => {
      this.openNotebook(model.rows[i]?.id === 'panel-prev' ? page - 1 : page + 1);
    });
  }

  /** obj_ui_tutorial_skip_confirm: Skip ends the tutorial, Cancel keeps it; both close. */
  private openSkipConfirm(): void {
    const model = skipConfirmPanel();
    this.openPanel(model, (i) => {
      if (model.rows[i]?.id === 'panel-skip') tutorialSkip(this.ctx.state);
      this.closePanel();
    });
  }

  /**
   * The corner panel for the current step and modal state, redrawn only when
   * its model changed (gone once the tutorial is done); hidden under the viewer.
   */
  private drawTutorial(): void {
    const model = tutorialPanel(this.ctx.state.tutorialStep, this.panel?.modal === true);
    const drawn = model ? JSON.stringify(model) : '';
    if (drawn !== this.tutorialDrawn) {
      for (const part of this.tutorialParts) part.destroy();
      this.tutorialSkipButton = undefined;
      this.tutorialParts = model ? this.tutorialPartsFor(model) : [];
      this.tutorialDrawn = drawn;
    }
    for (const part of this.tutorialParts) part.setVisible(!this.viewer.isOpen);
  }

  /** The box (interactive, so a press on it starts no joystick), the texts and Skip, greyed while disabled. */
  private tutorialPartsFor(m: TutorialPanelModel): HudPart[] {
    const { x, y, w, h } = m.box;
    const bg = this.add
      .rectangle(x, y, w, h, 0x1c221a, 0.85)
      .setOrigin(0)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(TUTORIAL_HEADING_COLOR).color)
      .setInteractive();
    const texts = m.texts.map((t) =>
      this.text(t.x, t.y, t.text, { ...LABEL_STYLE, color: t.color }),
    );
    const skip = m.skip.enabled
      ? this.hudButton(m.skip.x, m.skip.y, 'Skip', () => {
          this.openSkipConfirm();
        })
      : this.text(m.skip.x, m.skip.y, 'Skip', {
          ...LABEL_STYLE,
          fontSize: '10px',
          color: PANEL_DISABLED_COLOR,
        });
    if (m.skip.enabled) this.tutorialSkipButton = skip;
    const parts = [bg, ...texts, skip.setOrigin(1, 0)];
    for (const part of parts) part.setDepth(HUD_DEPTH);
    return parts;
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
    input.style.fontFamily = FONT_FAMILY;
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
   * leads to its room, a source plant gives a cutting, the kiosk opens the
   * shop, the workbench makes a pot and the planting table opens Plant a Cutting.
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
    } else if (near.key === SHOP_KIOSK_KEY) {
      this.openShop();
    } else if (near.key === WORKBENCH_KEY) {
      this.showToast(makePot(state));
    } else if (near.key === PLANTING_TABLE_KEY) {
      this.openPlant(NO_SELECTION);
    }
  }

  /**
   * obj_ui_plant_cutting: Select and the toggles reopen it with the new
   * selection; Plant plants through src/sim/planting.ts and closes it.
   */
  private openPlant(selection: PlantSelection): void {
    const { state } = this.ctx;
    const sel = plantSelection(state, selection);
    const model = plantPanel(state, sel);
    this.openPanel(model, (i) => {
      const id = model.rows[i]?.id;
      const species = SPECIES_KEYS.find((k) => selectId(k) === id);
      if (species) this.openPlant({ ...sel, species });
      else if (id === 'panel-fancy') this.openPlant({ ...sel, useFancyPot: !sel.useFancyPot });
      else if (id === 'panel-soil') this.openPlant({ ...sel, usePremiumSoil: !sel.usePremiumSoil });
      else if (id === 'panel-plant' && sel.species) {
        const tree = plantCutting(state, sel.species, sel.useFancyPot, sel.usePremiumSoil);
        this.closePanel();
        this.hud.setText(hudText(state));
        this.relocated();
        if (tree) this.showToast(`Planted a ${getSpecies(tree.speciesKey).displayName}.`);
      }
    });
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
    this.buildWeather();
    this.player = { ...this.player, x: target.x, y: target.y };
    this.relocated();
  }

  /**
   * obj_weather's Create: a fresh field for the room shown and the season of
   * the day, or none (and nothing drawn) while the weather setting is off.
   */
  private buildWeather(): void {
    if (!this.ctx.settings.weather) {
      this.weather = undefined;
      this.weatherGfx.clear();
      return;
    }
    const season = seasonForDay(this.ctx.state.day);
    const profile = weatherProfile(season, isIndoor(this.room));
    const area = weatherArea(this.room);
    this.weather = { season, profile, area, parts: createParticles(profile, area) };
    this.drawWeather();
  }

  /** obj_weather's Draw: circles, and rotated quads for petals and leaves, each in its colour and alpha. */
  private drawWeather(): void {
    const g = this.weatherGfx.clear();
    const field = this.weather;
    if (!field) return;
    for (const part of field.parts) {
      const d = particleDraw(part, field.profile);
      for (const shape of d.shapes) {
        g.fillStyle(d.colour, shape.alpha);
        if (shape.kind === 'circle') {
          g.fillCircle(d.x, d.y, shape.r);
        } else {
          const [p0, p1, p2, p3] = shape.points;
          g.fillTriangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
          g.fillTriangle(p0.x, p0.y, p2.x, p2.y, p3.x, p3.y);
        }
      }
    }
  }

  /** obj_source_plant: the cutting rule in src/sim/sourcePlant.ts, its message as a toast. */
  private takeCutting(plantKey: string, speciesKey: SpeciesKey): void {
    const plant = this.plants.get(plantKey) ?? createSourcePlant();
    this.plants.set(plantKey, plant);
    this.showToast(takeCutting(this.ctx.state, plant, speciesKey));
  }

  /**
   * The room from its sprite sheets (src/world/roomArt.ts), replacing the last
   * room's: its static art baked into one texture (bakeRoom) shown as one
   * full-room quad, and each prop's sprite at its depth (propSprite). Every
   * prototype px is half a logical px.
   */
  private drawRoom(): void {
    for (const part of this.roomParts) part.destroy();
    this.roomTexture?.destroy();
    const room = this.room;
    const key = `room-${room.key}`;
    this.roomTexture = this.bakeRoom(key, room);
    this.roomParts = [
      this.add
        .shader(ROOM_QUAD, 0, 0, room.width, room.height, [key])
        .setOrigin(0)
        .setDepth(FLOOR_DEPTH),
      ...room.props.flatMap((p) => {
        const art = propSprite(p);
        if (!art) return [];
        return [
          this.add
            .sprite(art.x, art.y, art.sheet.key, art.frame)
            .setScale(art.scale)
            .setDepth(art.depth),
        ];
      }),
    ].map((part) => this.inWorld(part));
  }

  /**
   * The room's static art baked once into a texture at prototype px, so each
   * 32 px tile keeps its pixels and a frame draws it as one quad: the room's
   * colour (the prototype's background layer), the floor tiles, the shed's dim
   * and rug, the wall or fence runs, then the garden's mitred corners.
   */
  private bakeRoom(key: string, room: Room): Phaser.Textures.DynamicTexture | undefined {
    const texture = this.textures.addDynamicTexture(
      key,
      room.width * PROTOTYPE_SCALE,
      room.height * PROTOTYPE_SCALE,
    );
    if (!texture) return undefined;
    texture.fill(room.floor);
    const floor = floorTiles(room);
    const { frameWidth, frameHeight } = floor.sheet;
    const topLeft = { originX: 0, originY: 0 };
    const { area } = floor;
    floor.frames.forEach((row, y) => {
      row.forEach((frame, x) => {
        const tx = area.x * PROTOTYPE_SCALE + x * frameWidth;
        const ty = area.y * PROTOTYPE_SCALE + y * frameHeight;
        texture.stamp(floor.sheet.key, frame, tx, ty, topLeft);
      });
    });
    // roomArt's rects are in logical px; the Graphics scales them up to the texture's prototype px.
    const rug = this.make.graphics({}, false).setScale(PROTOTYPE_SCALE);
    if (room.key === 'shed') {
      const r = SHED_RUG;
      const line = SPRITE_SCALE;
      rug.fillStyle(0x000000, SHED_FLOOR_DIM).fillRect(area.x, area.y, area.w, area.h);
      rug.fillStyle(r.fill).fillRoundedRect(r.x, r.y, r.w, r.h, RUG_RADIUS);
      rug.lineStyle(line, r.outline).strokeRoundedRect(r.x, r.y, r.w, r.h, RUG_RADIUS);
      rug
        .lineStyle(line, r.border)
        .strokeRoundedRect(r.x + r.inset, r.y + r.inset, r.w - 2 * r.inset, r.h - 2 * r.inset, 1);
    }
    texture.draw(rug);
    const s = PROTOTYPE_SCALE;
    for (const w of wallRuns(room))
      texture.repeat(w.sheet.key, 0, w.x * s, w.y * s, w.w * s, w.h * s);
    const corners = this.make.graphics({}, false).setScale(PROTOTYPE_SCALE);
    for (const c of fenceCorners(room)) corners.fillStyle(c.colour).fillRect(c.x, c.y, c.w, c.h);
    texture.draw(corners).render();
    rug.destroy();
    corners.destroy();
    return texture;
  }

  /** The drop shadows of the room's props and of the trees on its floor (the pedestal trees' are drawn with them). */
  private drawShadows(trees: readonly TreeArt[]): void {
    const g = this.shadowGfx.clear();
    const fill = (s: Shadow): void => {
      g.fillStyle(0x000000, s.alpha).fillEllipse(s.x, s.y, s.w, s.h);
    };
    for (const p of this.room.props) {
      const s = propShadow(p);
      if (s) fill(s);
    }
    for (const t of trees) fill(t.shadow);
  }

  /** obj_tree_sprite's Draw event into `g`: feet, the shaded body, sheen, outline, rim, trunk and the leaf circles. */
  private paintTree(g: Phaser.GameObjects.Graphics, art: TreeArt): void {
    const line = art.scale;
    g.fillStyle(art.feetColour);
    for (const f of art.feet) g.fillRect(f.x, f.y, f.w, f.h);
    for (const row of art.body) {
      const [a, b, c, d] = row.points;
      g.fillStyle(row.colour);
      g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y).fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
    }
    if (art.sheen) {
      const r = art.sheen.rect;
      g.fillStyle(art.sheen.colour).fillRect(r.x, r.y, r.w, r.h);
    }
    g.lineStyle(line, art.outline.colour).beginPath();
    art.outline.points.forEach((p, i) => {
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.closePath().strokePath();
    const rim = art.rim.rect;
    g.fillStyle(art.rim.fill).fillRect(rim.x, rim.y, rim.w, rim.h);
    g.lineStyle(line, art.rim.line).strokeRect(rim.x, rim.y, rim.w, rim.h);
    const trunk = art.trunk.rect;
    g.fillStyle(art.trunk.colour).fillRect(trunk.x, trunk.y, trunk.w, trunk.h);
    if (!art.canopy) return;
    g.fillStyle(art.canopy.fill);
    for (const c of art.canopy.circles) g.fillCircle(c.x, c.y, c.r);
    g.lineStyle(line, art.canopy.line);
    for (const c of art.canopy.circles) g.strokeCircle(c.x, c.y, c.r);
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

  /**
   * obj_tree_sprite for every tree in the room (src/world/treeArt.ts), sized
   * from its trunk height, in the season's leaf colour. A floor tree is
   * labelled above, a displayed one under its pedestal as obj_pedestal did,
   * which shows `(empty)` with no tree.
   */
  private drawTrees(): void {
    for (const part of this.treeParts) part.destroy();
    const { state } = this.ctx;
    const season = seasonForDay(state.day);
    const sprites = treeSprites(state, this.room);
    const floorArt: TreeArt[] = [];
    this.treeParts = sprites.flatMap((s) => {
      const art = treeArt(s.tree, season, s.x, s.y, s.size);
      const g = this.add.graphics().setDepth(s.depth);
      if (s.pedestalKey === undefined) {
        floorArt.push(art);
      } else {
        g.fillStyle(0x000000, art.shadow.alpha);
        g.fillEllipse(art.shadow.x, art.shadow.y, art.shadow.w, art.shadow.h);
      }
      this.paintTree(g, art);
      if (s.pedestalKey !== undefined) return [g];
      return [
        g,
        this.text(s.x, art.labelY, s.label, LABEL_STYLE).setOrigin(0.5, 1).setDepth(s.depth),
      ];
    });
    for (const p of this.room.props) {
      if (p.pedestalKey === undefined) continue;
      const tree = treeOnPedestal(state, p.pedestalKey);
      const label = tree
        ? this.text(p.x, p.y + PEDESTAL_LABEL_DY, treeLabel(tree), {
            ...LABEL_STYLE,
            color: '#ffffff',
          })
        : this.text(p.x, p.y + PEDESTAL_LABEL_DY, PEDESTAL_EMPTY_LABEL, {
            ...LABEL_STYLE,
            color: PEDESTAL_EMPTY_COLOUR,
          });
      this.treeParts.push(label.setOrigin(0.5, 0).setDepth(p.y + p.h / 2));
    }
    for (const part of this.treeParts) this.inWorld(part);
    this.drawShadows(floorArt);
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
    const { storage, overrides, settings, settingsStorage } = this.ctx;
    const data: TitleSceneData = { storage, overrides, settings, settingsStorage };
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
    this.notebookButton.setVisible(!viewerOpen && !modal);
    this.promptText.setVisible(showInteract);
    this.interactButton.setVisible(showInteract);
    this.weatherGfx.setVisible(!viewerOpen);
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
      // The weather keeps moving under panels, as the prototype's did.
      if (this.weather) stepParticles(this.weather.parts, this.weather.profile, this.weather.area);
      this.frames += 1;
    }
    this.drawWeather();
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
    // obj_weather's season recheck: the season only changes with the day.
    if (this.weather && this.weather.season !== seasonForDay(state.day)) this.buildWeather();
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
    const { x, y, facing, walkAnim } = this.player;
    // Sorted at the feet (the sprite is centred on y), as the props are at their bottom edges.
    this.playerSprite
      .setPosition(x, y)
      .setFrame(playerFrame(facing, walkAnim))
      .setDepth(y + PLAYER_H / 2);
    const shadow = playerShadow(x, y);
    this.playerShadow.setPosition(shadow.x, shadow.y);
    this.near = nearestInteractable(this.player, this.targets);
    this.promptText
      .setText(this.near ? promptFor(this.near) : '')
      .setPosition(x, y - PLAYER_H / 2 - 2);
    this.follow();
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
    this.notebookButton.setVisible(false);
    this.promptText.setVisible(false);
    this.interactButton.setVisible(false);
    this.weatherGfx.setVisible(false);
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
    const skip = this.tutorialSkipButton ? [at('tutorial-skip', this.tutorialSkipButton)] : [];
    return [
      at('view', this.viewButton),
      at('notebook', this.notebookButton),
      at('menu', this.menuButton),
      ...interact,
      ...skip,
      ...rows,
    ];
  }

  private readonly publishHook = (): void => {
    const { state, slot } = this.ctx;
    const carried = carriedTree(state);
    const inspected = this.panel?.tree;
    this.drawTutorial();
    window.__bonsai = {
      ...this.base,
      season: seasonForDay(state.day),
      day: state.day,
      inventory: { ...state.inventory },
      tutorialStep: state.tutorialStep,
      tutorialLabel:
        this.tutorialParts.length > 0 && !this.viewer.isOpen
          ? tutorialStepLabel(state.tutorialStep)
          : '',
      notebook:
        this.panel?.key === NOTEBOOK_KEY ? notebookHeader(state, this.notebookPage) : undefined,
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
      weather:
        this.weather && !this.viewer.isOpen
          ? { kind: this.weather.profile.kind, count: this.weather.profile.count }
          : undefined,
      activeSlot: slot,
      slots: this.slots,
      toast: this.toast.text,
      picker: '',
      panel: this.panel?.key ?? '',
      settings: { ...this.ctx.settings },
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
      camera: { ...this.view },
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
