import Phaser from 'phaser';
import { trackFor } from '../platform/audio';
import { closeKeyState } from '../platform/fullscreen';
import { currentInputMode } from '../platform/inputMode';
import { registerSaveBeforeReload } from '../platform/swUpdate';
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
import type { BonsaiTree, GameState, PlaceableKind } from '../sim/types';
import { TreeViewer } from '../viewer/TreeViewer';
import { closeKeyName, escapeReachesPage } from '../world/closeKey';
import { keyLabel } from '../world/keyHints';
import { hudText } from '../world/hud';
import { nearestInteractable, promptFor } from '../world/interactables';
import {
  CARRY_TEXT,
  HUD_BADGE,
  INTERACT_BUTTON,
  MENU_BUTTON,
  NOTEBOOK_BUTTON,
  TOAST_X,
  VIEW_BUTTON,
  menuItems,
  menuPanel,
} from '../world/menu';
import {
  PANEL,
  panelCloseLabel,
  PANEL_INSET,
  PANEL_TITLE_H,
  fitRows,
  loadSlotsPanel,
  panelClose,
  panelTitleY,
  pedestalPanel,
  type PanelModel,
} from '../world/panels';
import { makePot, plantCutting, plantSeed } from '../sim/planting';
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
  INSPECTOR_CLOSE,
  inspectorCloseLabel,
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
import {
  createPlayer,
  footstepDue,
  stepPlayer,
  type MoveInput,
  type PlayerState,
} from '../world/player';
import { occupiedSlots, readSlotRows } from '../world/saveSlots';
import {
  createSourcePlant,
  sourcePlantAction,
  sourcePlantPrompt,
  takeCutting,
  takeSeeds,
  type SourcePlantState,
} from '../sim/sourcePlant';
import type { SpeciesKey } from '../sim/types';
import { BASE_TIME_SCALE, tickClock } from '../world/clock';
import { SLEEP_WEEK_DAYS, sleep } from '../world/sleep';
import { ROOMS } from '../world/gardenRoom';
import { landing, wallDoor } from '../world/doors';
import {
  PICK_UP_PROMPT,
  PLACEABLES,
  PLACEABLE_ROOMS,
  ghostFootprint,
  pickUpItem,
  placeItem,
  placedFurniture,
  placedProps,
  placedSpots,
  placementCheck,
  type PlacementRefusal,
} from '../world/placement';
import {
  PROTOTYPE_SCALE,
  SHED_ROOM,
  type DoorTarget,
  type Prop,
  type Rect,
  type Room,
} from '../world/shedRoom';
import {
  displayLabels,
  treeSprites,
  treeTargets,
  treeLabel,
  type TreeTarget,
} from '../world/treeSprites';
import {
  renameCounter,
  renameInput,
  renamePanel,
  repotPanel,
  sellPanel,
  stylePanel,
} from '../world/treePanels';
import { SHOP_KIOSK_KEY, shopItemFor, shopPanel } from '../world/shopPanel';
import { INVENTORY_KEY, inventoryPanel, inventorySections } from '../world/inventoryPanel';
import {
  NOTEBOOK_KEY,
  notebookHeader,
  notebookOpeningPage,
  notebookPanel,
} from '../world/notebook';
import {
  seasonTipParts,
  skipConfirmPanel,
  tutorialPanel,
  type TutorialPanelModel,
} from '../world/tutorialPanel';
import { tutorialSkip, tutorialStepLabel } from '../sim/tutorial';
import { seasonTipFor } from '../sim/seasonTip';
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
import {
  PLAYER_FEET,
  PLAYER_SCALE,
  SHEETS,
  playerFrame,
  sheetPxPerLogical,
  type Sheet,
} from '../world/assets';
import {
  CAST_SHADOW_WASH,
  ROOM_STYLES,
  bakeScale,
  castShadows,
  floorTiles,
  furnitureRuns,
  furnitureSprites,
  paperTiles,
  pieceShadows,
  playerShadow,
  propShadow,
  propSprite,
  seasonWash,
  wallRuns,
  washPieces,
  type Shadow,
  type ShadowPolygon,
  type Wash,
  type WallRun,
} from '../world/roomArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../world/resolution';
import { treeArt, type TreeArt } from '../world/treeArt';
import { viewSize, worldView, worldZoom, type WorldView } from '../world/worldCamera';
import type { UiMetrics } from '../world/uiScale';
import {
  crispText,
  fitCamera,
  hitArea,
  sceneUi,
  sceneZoom,
  setHitArea,
  textZoom,
  type DeviceZoom,
} from './crisp';
import { fullscreenState, onFullscreenChange, toggleSetting } from './settings';
import { CameraGesture, WHEEL_ZOOM_PER_UNIT, cameraRig, pressRoute } from '../world3d/camera';
import { World3d, setSurround } from '../world3d/world3d';
import { MusicPlayer, SoundPlayer } from './audio';
import type { TitleSceneData, WorldSceneData } from './sceneData';
import { PlateEdges, drawPanel, underline } from './inkPanel';
import {
  FONT_FAMILY,
  PANEL_STYLE,
  bodyStyle,
  cssColour,
  fontLoaded,
  hudStyle,
  labelStyle,
  worldLabelStyle,
} from './textStyle';

const TOAST_MS = 2000;
/** The player sprite's drawn height, logical px: a 128 px frame at 0.25, 32. */
const PLAYER_H = SHEETS.player.frameHeight * PLAYER_SCALE;
/** The sprite's origin: its x centre, and `PLAYER_FEET` above its bottom edge, so the feet land at y + PLAYER_FEET. */
const PLAYER_ORIGIN_Y = (PLAYER_H - PLAYER_FEET) / PLAYER_H;
/** The baked room (floor, rug, walls) under everything, then the drop shadows; props and the player sort by y above 0. */
const FLOOR_DEPTH = -2;
const SHADOW_DEPTH = -1;
/**
 * The baked room's quad: one texture sample per fragment, with the baked
 * texture's own filter (nearest at prototype px as the game's pixelArt
 * textures are, linear for a bake at Inked px; bakeRoom). An Image would go through Phaser's batched sprite
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
const HUD_DEPTH = 10_000;
/** Modal panels and their dimmer sit above the HUD, so a press on the HUD under them hits the dimmer. */
const MODAL_DEPTH = 10_001;
/** Weather falls past the room, props, trees and player (depth = bottom y, at most 270) and the display labels (DISPLAY_LABEL_DEPTH), under the HUD. */
const WEATHER_DEPTH = 9_000;
/** The placement ghost lies on the floor, under the drop shadows, sorted furniture and the player. */
const GHOST_DEPTH = FLOOR_DEPTH + 0.5;
/** The ghost's colour where its kind can go down, and where it is refused. */
const GHOST_OK = 0x5ad26a;
const GHOST_REFUSED = 0xd25a5a;

/** A placement refusal as the prompt and toast say it: `In the way`. */
function refusalText(reason: PlacementRefusal | 'none left'): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** Fills each piece of cast shadow into `g` in the shadow wash (washPieces: pieces that do not overlap). */
function fillShadows(g: Phaser.GameObjects.Graphics, polygons: readonly ShadowPolygon[]): void {
  g.fillStyle(CAST_SHADOW_WASH.colour, CAST_SHADOW_WASH.alpha);
  for (const points of polygons) {
    g.fillPoints(
      points.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
  }
}

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

/** ui_bar's height in logical px. */
const BAR_H = 6;

/**
 * The rooms drawn from the prototype's sprites (src/world/roomArt.ts): floor
 * tiles, walls or fence, the props, their shadows, and the player's animated
 * sprite depth-sorted at its feet against the props' bottom edges; trees are drawn in code as
 * obj_tree_sprite did (src/world/treeArt.ts). A new or
 * loaded game starts in the shed; a door redraws the scene as its target room
 * (`ROOMS` in src/world/gardenRoom.ts) with the player at its target spot. Room data,
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
 * View tree do nothing; Escape, Q or Close closes it (Q is a letter in the rename box). F9 on an empty or
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
 * is closed; `?timeScale=` speeds it up. Sleep (Z) and Sleep a week, from the
 * menu, advance it a day or seven at once (src/world/sleep.ts).
 *
 * While the tutorial runs, its corner panel (src/world/tutorialPanel.ts) sits
 * in the HUD under the badge, redrawn on any publish after the step or the
 * modal state changed it; its Skip opens a confirmation. J or `Notebook (J)`
 * opens Granny's notebook (src/world/notebook.ts), whose Prev and Next reopen
 * it on the new page. I or the menu's `Inventory (I)` opens the read-only
 * Inventory panel (src/world/inventoryPanel.ts).
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
  /** The key of the door in `room` the player was set down beside on entering it, '' in the room the world started in. */
  private arrivedBeside = '';
  /** The camera that draws the room; `cameras.main` is the HUD's, on top of it. */
  private worldCamera!: Phaser.Cameras.Scene2D.Camera;
  /** What the world camera shows, in room units: the hook's `camera`. */
  private view: WorldView = { zoom: 1, scrollX: 0, scrollY: 0 };
  /** The Babylon room under the game's canvas while the 3D world setting is on (src/world3d/world3d.ts). */
  private world3d!: World3d;
  /** The pointers turning and zooming the 3D world's camera; empty while the 2D world draws. */
  private readonly cameraGesture = new CameraGesture(cameraRig);
  private roomParts: Phaser.GameObjects.GameObject[] = [];
  /** The room's static art, baked on entry (bakeRoom); destroyed on leaving the room or the scene. */
  private roomTexture: Phaser.Textures.DynamicTexture | undefined;
  /** The season's wash the room was baked with (seasonWash), so a season that changes it rebakes the room. */
  private roomWash: Wash | undefined;
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
  /** The tutorial corner panel's parts, the model they show (JSON, '' for none) and its button (Skip or Got it) while enabled. */
  private tutorialParts: HudPart[] = [];
  private tutorialDrawn = '';
  private tutorialButton: { id: string; text: Phaser.GameObjects.Text } | undefined;
  /** The compact corner panel's More / Less button while drawn, and the step (or tip) whose full text it has opened out; scene state, so a new step starts compact. */
  private tutorialToggle: { id: string; text: Phaser.GameObjects.Text } | undefined;
  private tutorialExpandedFor: string | undefined;
  /** The first-dormancy tip while the corner panel holds it; scene state, cleared by Got it or the notebook. */
  private seasonTip: string | undefined;
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
  /** Placement mode (P): the kind being put down; scene state, never saved. */
  private placing: { kind: PlaceableKind } | undefined;
  /** While placing: the ghost drawn on the floor, the footprint it shows and its placement check. */
  private ghost:
    | { gfx: Phaser.GameObjects.Graphics; rect: Rect; check: ReturnType<typeof placementCheck> }
    | undefined;
  /**
   * The UI metrics of the HUD and panels (src/world/uiScale.ts), read at
   * create; a resize updates only `hit`, so text sizes stay until a restart.
   */
  private ui!: UiMetrics;
  /** The metrics at the world camera's zoom, for the texts it draws (the prompt and tree labels). */
  private worldUi!: UiMetrics;
  private accumulatorMs = 0;
  private frames = 0;
  private joystick: { id: number; x: number; y: number; input: MoveInput } | undefined;
  /** Every sound effect the world plays, behind the Sound switch (src/scenes/audio.ts). */
  private sfx!: SoundPlayer;
  /** The place's ambient loop, behind the Music switch (src/scenes/audio.ts). */
  private music!: MusicPlayer;
  /** The ink rules round the plated texts (the HUD rows and the world labels). */
  private plates!: PlateEdges;

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.ctx = data;
    // Reads the settings live, so the Settings panel's Sound switch acts at once.
    this.sfx = new SoundPlayer(this.sound, () => this.ctx.settings);
    this.music = new MusicPlayer(this.sound, () => this.ctx.settings);
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
    this.cameraGesture.clear();
    this.panel = undefined;
    this.placing = undefined;
    this.ghost = undefined;
    this.clockS = 0;
    this.room = SHED_ROOM;
    this.arrivedBeside = '';
    this.roomParts = [];
    this.roomTexture = undefined;
    this.plants.clear();
    this.tutorialParts = [];
    this.tutorialDrawn = '';
    this.tutorialButton = undefined;
    this.tutorialToggle = undefined;
    this.tutorialExpandedFor = undefined;
    this.seasonTip = undefined;
    this.player = createPlayer(SHED_ROOM);
    // The scene's own camera becomes the world camera; the HUD's, added after it, draws on top.
    this.worldCamera = this.cameras.main;
    this.world3d = new World3d(this.game.canvas);
    this.cameras.add(0, 0, undefined, undefined, true, 'hud');
    const toHud = (o: Phaser.GameObjects.GameObject): void => {
      this.worldCamera.ignore(o);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, toHud);
    this.plates = new PlateEdges(this);
    this.ui = sceneUi(this);
    this.worldUi = sceneUi(this, worldZoom(window.innerWidth, window.innerHeight));
    fitCamera(this, this.onResize, this.fitWorld);

    this.shadowGfx = this.inWorld(this.add.graphics().setDepth(SHADOW_DEPTH));
    this.drawRoom();
    this.weatherGfx = this.inWorld(this.add.graphics().setDepth(WEATHER_DEPTH));
    this.buildWeather();
    const shadow = playerShadow(0, 0);
    this.playerShadow = this.inWorld(
      this.add.ellipse(0, 0, shadow.w, shadow.h, 0x000000, shadow.alpha).setDepth(SHADOW_DEPTH),
    );
    // The feet stand PLAYER_FEET below (x, y), where the prototype's centred sprite put them; the head rises above.
    this.playerSprite = this.inWorld(
      this.add
        .sprite(0, 0, SHEETS.player.key, 0)
        .setScale(PLAYER_SCALE)
        .setOrigin(0.5, PLAYER_ORIGIN_Y),
    );
    this.promptText = this.inWorld(
      this.text(0, 0, '', worldLabelStyle(this.worldUi)).setOrigin(0.5, 1).setDepth(HUD_DEPTH),
    );

    const hud = hudStyle(this.ui);
    this.hud = this.text(HUD_BADGE.right, HUD_BADGE.top, hudText(data.state), hud)
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.carryText = this.text(CARRY_TEXT.right, CARRY_TEXT.top, '', hud)
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.treeParts = [];
    this.drawTrees();
    this.drawPlayer();
    this.viewButton = this.hudButton(
      VIEW_BUTTON.left,
      VIEW_BUTTON.bottom,
      'View tree (V)',
      () => {
        this.openViewer();
      },
      0,
      1,
      hud,
    );
    this.notebookButton = this.hudButton(
      NOTEBOOK_BUTTON.left,
      NOTEBOOK_BUTTON.bottom,
      'Notebook (J)',
      () => {
        this.toggleNotebook();
      },
      0,
      1,
      hud,
    );
    this.menuButton = this.hudButton(
      MENU_BUTTON.left,
      MENU_BUTTON.top,
      'Menu',
      () => {
        if (this.panel?.modal) return;
        if (this.panel) this.closePanel();
        else this.openMenu();
      },
      0,
      0,
      hud,
    );
    this.interactButton = this.hudButton(
      INTERACT_BUTTON.right,
      INTERACT_BUTTON.bottom,
      'Interact (E)',
      () => {
        this.interact();
      },
      1,
      1,
      hud,
    );
    this.toast = this.text(TOAST_X, 2, '', hud).setDepth(HUD_DEPTH);

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
    onKeyDown(keyboard, 'E', (event) => {
      // With nothing in reach E has no other use, so in the 3D world it turns the camera,
      // unless the press is the one that closed the viewer.
      if (this.cameraKeysLive() && !this.near) {
        if (event.timeStamp > this.viewerClosedAt) cameraRig.step(1);
      } else this.interact();
    });
    onKeyDown(keyboard, 'J', () => {
      this.toggleNotebook();
    });
    onKeyDown(keyboard, 'I', () => {
      this.toggleInventory();
    });
    onKeyDown(keyboard, 'Z', () => {
      this.goToSleep(1);
    });
    onKeyDown(keyboard, 'P', () => {
      this.togglePlacing();
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
    const closeOrLeave = (event: KeyboardEvent, leaveRoom: boolean): void => {
      if (this.viewer.isOpen || event.timeStamp <= this.viewerClosedAt) return;
      if (this.panel) this.closePanel();
      else if (this.placing) this.stopPlacing();
      else if (leaveRoom) this.toTitle();
    };
    onKeyDown(keyboard, 'ESC', (event) => {
      closeOrLeave(event, true);
    });
    // Q closes what Esc closes but never leaves the room, and is a letter in the rename box.
    onKeyDown(keyboard, 'Q', (event) => {
      if (document.activeElement instanceof HTMLInputElement) return;
      if (this.cameraKeysLive()) {
        // The press that closed the viewer is spent: it does not also turn the camera.
        if (event.timeStamp > this.viewerClosedAt) cameraRig.step(-1);
      } else closeOrLeave(event, false);
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
        if (over.length > 0) return;
        // In the 3D world a press on bare ground is the stick's only as the first touch on the left half
        // of the screen; any other press (the mouse, a touch on the right half, a second finger) turns
        // and zooms the camera, so a drag is never both.
        const route = pressRoute({
          world3d: this.world3d.active,
          touch: pointer.wasTouch,
          left: pointer.x < this.scale.width / 2,
          stickHeld: this.joystick !== undefined,
        });
        if (route === 'stick') {
          if (this.joystick) return;
          const { x, y } = this.screenPoint(pointer);
          this.joystick = { id: pointer.id, x, y, input: { x: 0, y: 0 } };
        } else {
          this.cameraGesture.down(pointer.id, pointer.x, pointer.y);
        }
      },
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.cameraGesture.move(pointer.id, pointer.x, pointer.y);
      if (pointer.id !== this.joystick?.id) return;
      const { x, y } = this.screenPoint(pointer);
      this.joystick.input = joystickInput(x - this.joystick.x, y - this.joystick.y);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      this.cameraGesture.up(pointer.id);
      if (pointer.id === this.joystick?.id) this.joystick = undefined;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        if (this.world3d.active && this.roomKeysLive() && !this.panel) {
          cameraRig.zoom(Math.exp(dy * WHEEL_ZOOM_PER_UNIT));
        }
      },
    );

    this.viewer = new TreeViewer(document.body);
    this.viewer.onRender = this.publishHook;
    this.viewer.onSound = (key) => {
      this.sfx.play(key);
    };
    this.viewer.onClose = () => {
      this.viewerClosedAt = performance.now();
      this.music.play(trackFor(this.room.key));
      this.publishHook();
    };
    onFullscreenChange(this, () => {
      if (this.panel?.key === SETTINGS_KEY) this.openSettings();
    });
    // Phaser's sound manager pauses on blur but not on game.pause() (the rotate prompt, src/main.ts).
    // Both publish, as the paused game publishes nothing else. RESUME also comes
    // from the page being shown again, which leaves game.isPaused set, so the
    // rotate prompt's pause holds until game.resume() clears it.
    const pauseMusic = (): void => {
      this.music.pause();
      this.publishHook();
    };
    const resumeMusic = (): void => {
      if (this.game.isPaused) return;
      this.music.resume();
      this.publishHook();
    };
    this.game.events.on(Phaser.Core.Events.PAUSE, pauseMusic);
    this.game.events.on(Phaser.Core.Events.RESUME, resumeMusic);
    const unregisterSave = registerSaveBeforeReload(() => {
      this.save();
    });
    this.events.once('shutdown', () => {
      unregisterSave();
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, toHud);
      this.game.events.off(Phaser.Core.Events.PAUSE, pauseMusic);
      this.game.events.off(Phaser.Core.Events.RESUME, resumeMusic);
      this.panel?.dispose?.();
      this.viewer.destroy();
      this.world3d.dispose();
      setSurround(this.game, false);
      this.music.stop();
      this.roomTexture?.destroy();
      keyboard.removeCapture([K.F5, K.F9]);
    });
    this.music.play(trackFor(this.room.key));
    this.publishHook();
  }

  private text(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const t = crispText(this, x, y, text, style);
    // A text on the plate (hudStyle, worldLabelStyle) gets the plate's ink rule.
    if (style.backgroundColor) this.plates.add(t);
    return t;
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

  /**
   * A text button in `style` (the body style; the HUD's own buttons over the
   * room pass `hudStyle`), anchored at (`x`, `y`) by its origin, tappable over
   * `hitRect` of its bounds (setHitArea) at least `ui.hit` square. A tap
   * clicks unless its action played its own sound (SoundPlayer.tap).
   */
  private hudButton(
    x: number,
    y: number,
    label: string,
    onTap: () => void,
    originX = 0,
    originY = originX,
    style: Phaser.Types.GameObjects.Text.TextStyle = bodyStyle(this.ui),
  ): Phaser.GameObjects.Text {
    const button = this.text(x, y, keyLabel(label, currentInputMode()), style)
      .setOrigin(originX, originY)
      .setDepth(HUD_DEPTH);
    setHitArea(button, this.ui.hit).on('pointerup', () => {
      this.sfx.tap(onTap);
    });
    return button;
  }

  /** On a resize, after the cameras are refitted: the new tap target size on the HUD's buttons, then a publish. */
  private readonly onResize = (): void => {
    this.ui = { ...this.ui, hit: sceneUi(this).hit };
    const buttons = [this.viewButton, this.notebookButton, this.menuButton, this.interactButton];
    for (const button of [...buttons, this.tutorialButton?.text, this.tutorialToggle?.text]) {
      if (button) setHitArea(button, this.ui.hit);
    }
    this.publishHook();
  };

  /** No viewer and no modal panel: the room's own keys and buttons act. */
  private roomKeysLive(): boolean {
    return !this.viewer.isOpen && !this.panel?.modal;
  }

  /** Whether Q and E turn the 3D world's camera: the room has the keys and nothing (a panel, a ghost being placed) has a use for them. */
  private cameraKeysLive(): boolean {
    return this.world3d.active && this.roomKeysLive() && !this.panel && !this.placing;
  }

  /** A panel's paper and frame (drawPanel), its title band `titleH` px tall; the paper is interactive, so a press on it reaches nothing beneath. */
  private panelBox(box: { x: number; y: number; w: number; h: number }, depth: number, titleH = 0) {
    const parts = drawPanel(this, box, titleH);
    for (const part of parts) part.setDepth(depth);
    return parts;
  }

  /** The modal dimmer over the room; interactive, so it takes the presses outside the panel. */
  private dimmer(): Phaser.GameObjects.Rectangle {
    const { colour, alpha } = PANEL_STYLE.dim;
    return this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, colour, alpha)
      .setOrigin(0)
      .setDepth(MODAL_DEPTH)
      .setInteractive();
  }

  private openMenu(): void {
    const placing = this.placing?.kind;
    const next = placing === undefined ? undefined : this.nextStockedKind(placing);
    const options = {
      carrying: carriedTree(this.ctx.state) !== undefined,
      placeable: this.placeable(),
      placing: placing !== undefined,
      escapeReaches: escapeReachesPage(closeKeyState()),
      nextKind: next !== undefined && next !== placing ? PLACEABLES[next].label : undefined,
    };
    const bg = this.panelBox(menuPanel(options, this.ui), HUD_DEPTH);
    const parts: Phaser.GameObjects.GameObject[] = [...bg];
    const actions = {
      inventory: () => {
        this.toggleInventory();
      },
      sleep: () => {
        this.goToSleep(1);
      },
      'sleep-week': () => {
        this.goToSleep(SLEEP_WEEK_DAYS);
      },
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
      place: () => {
        this.closePanel();
        if (this.placing) this.stopPlacing();
        else this.togglePlacing();
      },
      'place-next': () => {
        this.closePanel();
        this.togglePlacing();
      },
    };
    const buttons = menuItems(options, this.ui).map((item) => {
      const text = this.hudButton(item.x, item.y, item.label, actions[item.id], 0, 0.5);
      parts.push(underline(this, text));
      return { id: `menu-${item.id}`, text };
    });
    this.panel = { key: 'menu', modal: false, parts, buttons };
    this.publishHook();
  }

  /**
   * A modal panel over the dimmed room (obj_ui_panel): title, rows and Close,
   * laid out by `fitRows` for the screen's tap targets. A row with an id is a
   * button and `onRow` gets its index.
   */
  private openPanel(
    unfitted: PanelModel,
    onRow: (index: number) => void = () => undefined,
  ): Phaser.GameObjects.Text[] {
    this.closePanel();
    this.joystick = undefined;
    const model = fitRows(unfitted, this.ui);
    const box = model.box ?? PANEL;
    const left = box.x + PANEL_INSET;
    const style = bodyStyle(this.ui);
    const text = (y: number, label: string, color: string, x = left) =>
      this.text(x, y, label, { ...style, color })
        .setOrigin(0, 0.5)
        .setDepth(MODAL_DEPTH);
    const parts: Phaser.GameObjects.GameObject[] = [
      this.dimmer(),
      ...this.panelBox(box, MODAL_DEPTH, PANEL_TITLE_H),
      text(panelTitleY(box), model.title, PANEL_STYLE.text),
    ];
    const buttons: OpenPanel['buttons'] = [];
    // A greyed row is plain text, not a control.
    const texts = model.rows.map((row, i) => {
      if (!row.id || row.enabled === false) {
        const color = row.enabled === false ? PANEL_STYLE.disabled : PANEL_STYLE.text;
        const t = text(row.y, row.text, row.color ?? color, row.x);
        if (row.align === 'right') t.setOrigin(1, 0.5);
        parts.push(t);
        return t;
      }
      const button = this.hudButton(
        row.x ?? left,
        row.y,
        row.text,
        () => {
          onRow(i);
        },
        0,
        0.5,
      );
      buttons.push({ id: row.id, text: button.setColor(row.color ?? PANEL_STYLE.text) });
      return button;
    });
    const at = panelClose(box);
    const close = this.hudButton(
      at.x,
      at.y,
      panelCloseLabel(closeKeyName(closeKeyState(), model.textEntry)),
      () => {
        this.closePanel();
      },
      0.5,
    );
    buttons.push({ id: 'panel-close', text: close });
    for (const b of buttons) parts.push(underline(this, b.text.setDepth(MODAL_DEPTH)));
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
      if (id === 'panel-music') this.music.refresh();
      this.openSettings();
    });
  }

  /** obj_ui_tree_repot_confirm; the soil toggle reopens it with the flag flipped. */
  private openRepot(tree: BonsaiTree, premiumSoil = false): void {
    const { state } = this.ctx;
    const model = repotPanel(tree, state, premiumSoil, this.ui);
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
        this.sfx.play('coin');
        this.showToast(`Sold ${treeLabel(tree)} for ${String(price)} coins`);
      }
    });
  }

  /** obj_ui_shop: a Buy buys one, then the HUD and the reopened shop show the new money and count. */
  private openShop(): void {
    const { state } = this.ctx;
    const model = shopPanel(state, this.ui);
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

  /** obj_game_controller Step_0's I: closes the inventory if open, else opens it unless another modal is up. */
  private toggleInventory(): void {
    if (this.panel?.key === INVENTORY_KEY) this.closePanel();
    else if (this.roomKeysLive()) this.openPanel(inventoryPanel(this.ctx.state.inventory));
  }

  /**
   * obj_ui_notebook on `page`, the active step's by default; Prev and Next
   * reopen it on their page. Opening it puts a held season tip away.
   */
  private openNotebook(page = notebookOpeningPage(this.ctx.state.tutorialStep)): void {
    this.seasonTip = undefined;
    const model = notebookPanel(this.ctx.state, page, currentInputMode());
    this.notebookPage = page;
    this.openPanel(model, (i) => {
      this.openNotebook(model.rows[i]?.id === 'panel-prev' ? page - 1 : page + 1);
    });
  }

  /** obj_ui_tutorial_skip_confirm: Skip ends the tutorial, Cancel keeps it; both close. */
  private openSkipConfirm(): void {
    const model = skipConfirmPanel(currentInputMode());
    this.openPanel(model, (i) => {
      if (model.rows[i]?.id === 'panel-skip') tutorialSkip(this.ctx.state);
      this.closePanel();
    });
  }

  /**
   * The corner panel for the held season tip, else the current step, and the
   * modal state, redrawn only when its model changed (gone once the tutorial
   * is done and no tip is held); hidden under the viewer.
   */
  private drawTutorial(): void {
    const model = tutorialPanel(
      this.ctx.state.tutorialStep,
      this.panel?.modal === true,
      this.ui,
      this.seasonTip,
      {
        mode: currentInputMode(),
        expanded: this.tutorialExpandedFor === this.tutorialKey(),
        menuOpen: this.panel?.key === 'menu',
      },
    );
    const drawn = model ? JSON.stringify(model) : '';
    if (drawn !== this.tutorialDrawn) {
      for (const part of this.tutorialParts) part.destroy();
      this.tutorialButton = undefined;
      this.tutorialToggle = undefined;
      this.tutorialParts = model ? this.tutorialPartsFor(model) : [];
      this.tutorialDrawn = drawn;
    }
    for (const part of this.tutorialParts) part.setVisible(!this.viewer.isOpen);
  }

  /** What the corner panel shows now: the held season tip, else the step. */
  private tutorialKey(): string {
    return this.seasonTip ?? String(this.ctx.state.tutorialStep);
  }

  /** More / Less: opens the compact corner panel out to the step's full text, or folds it back. */
  private toggleTutorialExpanded(): void {
    const key = this.tutorialKey();
    this.tutorialExpandedFor = this.tutorialExpandedFor === key ? undefined : key;
    this.publishHook();
  }

  /**
   * The box (interactive, so a press on it starts no joystick), the texts and
   * the button, greyed while disabled: Skip asks to confirm, Got it puts the
   * season tip away.
   */
  private tutorialPartsFor(m: TutorialPanelModel): HudPart[] {
    const bg = drawPanel(this, m.box);
    const texts = m.texts.map((t) =>
      this.text(t.x, t.y, t.text, { ...labelStyle(this.ui), color: t.color }),
    );
    const { x: bx, y: by, label, id, enabled } = m.button;
    const button = enabled
      ? this.hudButton(
          bx,
          by,
          label,
          () => {
            if (id === 'tip-dismiss') this.dismissSeasonTip();
            else this.openSkipConfirm();
          },
          1,
          0,
        )
      : this.text(bx, by, label, {
          ...bodyStyle(this.ui),
          color: PANEL_STYLE.disabled,
        }).setOrigin(1, 0);
    if (enabled) this.tutorialButton = { id, text: button };
    const parts = [...bg, ...texts, button];
    const more = m.toggle
      ? this.hudButton(
          m.toggle.x,
          m.toggle.y,
          m.toggle.label,
          () => {
            this.toggleTutorialExpanded();
          },
          0,
          0,
        )
      : undefined;
    if (more && m.toggle) {
      this.tutorialToggle = { id: m.toggle.id, text: more };
      parts.push(more);
    }
    for (const part of parts) part.setDepth(HUD_DEPTH);
    // After the depth, which the underline takes from its button.
    if (enabled) parts.push(underline(this, button));
    if (more) parts.push(underline(this, more));
    return parts;
  }

  /** Got it: the corner panel goes back to the tutorial step, or away once the tutorial is done. */
  private dismissSeasonTip(): void {
    this.seasonTip = undefined;
    this.publishHook();
  }

  /** obj_ui_tree_style_picker, one tap per pick. */
  private openStyle(tree: BonsaiTree): void {
    const model = stylePanel(tree, this.ui);
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
    input.style.background = cssColour(PANEL_STYLE.paper);
    input.style.color = PANEL_STYLE.text;
    input.style.border = `1px solid ${cssColour(PANEL_STYLE.ink)}`;
    input.style.fontFamily = FONT_FAMILY;
    const model = renamePanel(tree, input.value, escapeReachesPage(closeKeyState()));
    // Where openPanel draws the New name row: the model as fitted to the screen's tap targets.
    const box = renameInput(fitRows(model, this.ui));
    const place = (): void => {
      const r = this.game.canvas.getBoundingClientRect();
      const sx = r.width / GAME_WIDTH;
      const sy = r.height / GAME_HEIGHT;
      input.style.left = `${String(r.left + box.x * sx)}px`;
      input.style.top = `${String(r.top + (box.y - box.h / 2) * sy)}px`;
      input.style.width = `${String(box.w * sx)}px`;
      input.style.height = `${String(box.h * sy)}px`;
      input.style.fontSize = `${String(this.ui.body * sy)}px`;
    };
    const save = (): void => {
      const name = renameTree(tree, input.value);
      this.closePanel();
      this.relocated();
      this.showToast(`Renamed to ${name}`);
    };
    const texts = this.openPanel(model, save);
    input.addEventListener('input', () => {
      texts[2]?.setText(renameCounter(input.value, escapeReachesPage(closeKeyState())));
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
    const m = inspectorPanel(tree, state, this.ui);
    const box = INSPECTOR_PANEL;
    const line = (l: InspectorText, color: string = PANEL_STYLE.text) =>
      this.text(l.x, l.y, l.text, { ...labelStyle(this.ui), color }).setOrigin(0, 0.5);
    const big = bodyStyle(this.ui);
    const track = PANEL_STYLE.barTrack;
    const parts: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [
      this.dimmer(),
      ...this.panelBox(box, MODAL_DEPTH, INSPECTOR_TITLE_H),
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
        this.add
          .rectangle(b.trackX, b.y, b.trackW, BAR_H, track.colour, track.alpha)
          .setOrigin(0, 0.5),
        this.add
          .rectangle(b.trackX, b.y, b.trackW * clamp(b.value / b.max, 0, 1), BAR_H, b.color)
          .setOrigin(0, 0.5),
        this.add
          .rectangle(b.trackX, b.y, b.trackW, BAR_H)
          .setOrigin(0, 0.5)
          .setStrokeStyle(PANEL_STYLE.rule, PANEL_STYLE.ink),
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
        const text = this.hudButton(b.x, b.y, b.label, actions[b.id], 0, 0.5);
        buttons.push({ id: `panel-${b.id}`, text });
        parts.push(underline(this, text));
      } else {
        parts.push(
          this.text(b.x, b.y, b.label, { ...big, color: DISABLED_COLOR }).setOrigin(0, 0.5),
        );
      }
    }
    const close = this.hudButton(
      INSPECTOR_CLOSE.x,
      INSPECTOR_CLOSE.y,
      inspectorCloseLabel(closeKeyName(closeKeyState())),
      () => {
        this.closePanel();
      },
      1,
      0.5,
    );
    buttons.push({ id: 'panel-close', text: close.setColor(PANEL_STYLE.soft) });
    parts.push(underline(this, close));
    for (const part of parts) part.setDepth(MODAL_DEPTH);
    for (const b of buttons) b.text.setDepth(MODAL_DEPTH);
    this.destroyPanel();
    this.joystick = undefined;
    this.panel = { key: m.key, modal: true, parts, buttons, tree };
    this.publishHook();
  }

  /**
   * An inspector care button: the pure dispatch (and `water` when the watering
   * happened), then the tree sprite and the inspector redrawn.
   */
  private care(tree: BonsaiTree, id: 'water' | 'fertilise' | 'skip'): void {
    if (inspectorAction(this.ctx.state, tree, id) && id === 'water') this.sfx.play('water');
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
   * E or the Interact button: while placing, the ghost's kind goes down.
   * Otherwise a floor tree or an occupied pedestal opens the tree's
   * inspector, an empty pedestal the Display Pedestal panel, a door
   * leads to its room, a source plant gives a cutting, the kiosk opens the
   * shop, the workbench makes a pot and the planting table opens Plant.
   */
  private interact(): void {
    if (!this.roomKeysLive()) return;
    if (this.placing) {
      this.placeHere(this.placing.kind);
      return;
    }
    const near = this.near;
    if (!near) return;
    const { state } = this.ctx;
    if ('tree' in near) {
      this.openInspector(near.tree);
      return;
    }
    const { pedestalKey, target, speciesKey, placedId } = near;
    if (placedId !== undefined && near.prompt === PICK_UP_PROMPT) {
      this.pickUpPlaced(placedId, near.label);
      return;
    }
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
      this.takeFromPlant(near.key, speciesKey);
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
   * selection; Plant plants the cutting or the seed through
   * src/sim/planting.ts and closes it.
   */
  private openPlant(selection: PlantSelection): void {
    const { state } = this.ctx;
    const sel = plantSelection(state, selection);
    const model = plantPanel(state, sel, this.ui);
    this.openPanel(model, (i) => {
      const id = model.rows[i]?.id;
      const choice = (['cutting', 'seed'] as const)
        .flatMap((kind) => SPECIES_KEYS.map((species) => ({ kind, species })))
        .find((c) => selectId(c.species, c.kind) === id);
      if (choice) this.openPlant({ ...sel, ...choice });
      else if (id === 'panel-fancy') this.openPlant({ ...sel, useFancyPot: !sel.useFancyPot });
      else if (id === 'panel-soil') this.openPlant({ ...sel, usePremiumSoil: !sel.usePremiumSoil });
      else if (id === 'panel-plant' && sel.species) {
        const seed = sel.kind === 'seed';
        const plant = seed ? plantSeed : plantCutting;
        const tree = plant(state, sel.species, sel.useFancyPot, sel.usePremiumSoil);
        this.closePanel();
        this.hud.setText(hudText(state));
        this.relocated();
        if (tree) {
          const name = getSpecies(tree.speciesKey).displayName;
          this.showToast(seed ? `Planted a ${name} seed.` : `Planted a ${name}.`);
        }
      }
    });
  }

  /**
   * obj_door: the player lands beside the far door in the target room, facing
   * into it (doors.ts `landing`), and the room's floor, walls, props and trees
   * are drawn afresh. The source plants start a new visit, as the prototype's
   * room instances were recreated on entry.
   */
  private enterRoom(target: DoorTarget): void {
    this.stopPlacing();
    this.sfx.play('door');
    this.room = ROOMS[target.room];
    this.arrivedBeside = target.door;
    const { x, y, facing } = landing(this.room, wallDoor(this.room, target.door));
    this.music.play(trackFor(this.room.key));
    this.plants.clear();
    this.joystick = undefined;
    this.drawRoom();
    this.buildWeather();
    this.player = { ...this.player, x, y, facing };
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

  /** obj_source_plant: the season's cutting or seed rule in src/sim/sourcePlant.ts, its message as a toast. */
  private takeFromPlant(plantKey: string, speciesKey: SpeciesKey): void {
    const { state } = this.ctx;
    const plant = this.plants.get(plantKey) ?? createSourcePlant();
    this.plants.set(plantKey, plant);
    const take = sourcePlantAction(state.day) === 'seed' ? takeSeeds : takeCutting;
    this.showToast(take(state, plant, speciesKey));
  }

  /** The near target's prompt; a source plant's follows the season (Take Seeds in autumn). */
  private nearPrompt(near: Prop | TreeTarget): string {
    const seasonal = !('tree' in near) && near.speciesKey !== undefined;
    return promptFor(seasonal ? { ...near, prompt: sourcePlantPrompt(this.ctx.state.day) } : near);
  }

  /**
   * The room from its sprite sheets (src/world/roomArt.ts), replacing the last
   * room's: its static art baked into one texture (bakeRoom) shown as one
   * full-room quad, and each prop's and sorted piece of furniture's sprite at
   * its depth (propSprite, furnitureSprites). Every
   * prototype px is half a logical px.
   */
  private drawRoom(): void {
    for (const part of this.roomParts) part.destroy();
    this.roomTexture?.destroy();
    const room = this.room;
    const key = `room-${room.key}`;
    this.roomWash = seasonWash(room, seasonForDay(this.ctx.state.day));
    this.roomTexture = this.bakeRoom(key, room, this.roomWash);
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
            .setOrigin(0.5, art.originY)
            .setScale(art.scale)
            .setDepth(art.depth),
        ];
      }),
      ...furnitureSprites(this.liveRoom()).map((art) =>
        this.add
          .sprite(art.x, art.y, art.sheet.key, art.frame)
          .setOrigin(0.5, art.originY)
          .setScale(art.scale)
          .setDepth(art.depth),
      ),
    ].map((part) => this.inWorld(part));
  }

  /**
   * The room's static art baked once into a texture at the room's bake scale
   * (bakeScale: prototype px for pixel sheets, Inked px once any sheet it
   * draws is Inked), so each tile keeps its pixels and a frame draws it as one
   * quad: the room's colour (the prototype's background layer), the paper
   * when its style lays it, the floor tiles, the room style's rug (the
   * shed's), the wall, face or fence runs with the windows, the furniture
   * lying flat, the shadows the walls, furniture and props cast (one wash
   * over all of them), the standing furniture, and last the season's wash
   * over all of it (the gardens'). A sheet coarser than the bake
   * scale is scaled up to it; a bake finer than prototype px is
   * linear-filtered, as its Inked sheets are.
   */
  private bakeRoom(
    key: string,
    room: Room,
    wash: Wash | undefined,
  ): Phaser.Textures.DynamicTexture | undefined {
    const s = bakeScale(room);
    const texture = this.textures.addDynamicTexture(key, room.width * s, room.height * s);
    if (!texture) return undefined;
    if (s !== PROTOTYPE_SCALE) texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    texture.fill(room.floor);
    /** Stamps a sheet's frame with its top-left at logical (x, y), scaled from its own px to the bake's. */
    const stampAt = (sheet: Sheet, frame: number, x: number, y: number): void => {
      const f = s / sheetPxPerLogical(sheet);
      texture.stamp(sheet.key, frame, x * s, y * s, {
        originX: 0,
        originY: 0,
        scaleX: f,
        scaleY: f,
      });
    };
    for (const t of paperTiles(room)) stampAt(t.sheet, 0, t.x, t.y);
    const floor = floorTiles(room);
    const tileW = floor.sheet.frameWidth / sheetPxPerLogical(floor.sheet);
    const tileH = floor.sheet.frameHeight / sheetPxPerLogical(floor.sheet);
    const { area } = floor;
    floor.frames.forEach((row, y) => {
      row.forEach((frame, x) => {
        stampAt(floor.sheet, frame, area.x + x * tileW, area.y + y * tileH);
      });
    });
    const { rug } = ROOM_STYLES[room.key];
    if (rug) stampAt(rug.sheet, 0, rug.x, rug.y);
    // A run repeats its sheet's frame over its rect; a TileSprite `scale` of f draws each sheet px
    // as f bake px, so the repeated area is the rect's bake px over f and the last tile still crops.
    const repeat = (runs: readonly WallRun[]): void => {
      for (const w of runs) {
        const f = s / sheetPxPerLogical(w.sheet);
        texture.repeat(w.sheet.key, w.frame ?? 0, w.x * s, w.y * s, (w.w * s) / f, (w.h * s) / f, {
          scale: f,
        });
      }
    };
    repeat(wallRuns(room));
    repeat(furnitureRuns(room, 'flat'));
    // roomArt's polygons are in logical px; the Graphics scales them up to the texture's px. The
    // shadows are washed in pieces that do not overlap, so where two meet the floor is washed once.
    const shadows = this.make.graphics({}, false).setScale(s);
    fillShadows(shadows, washPieces(castShadows(room)));
    texture.draw(shadows);
    repeat(furnitureRuns(room, 'standing'));
    const over = this.make.graphics({}, false).setScale(s);
    if (wash) over.fillStyle(wash.colour, wash.alpha).fillRect(0, 0, room.width, room.height);
    texture.draw(over).render();
    shadows.destroy();
    over.destroy();
    return texture;
  }

  /**
   * The live shadows: the shadows the pieces the player has placed cast (the
   * room's own are baked), and the drop shadows of the room's props and the
   * trees on its floor (the pedestal trees' are drawn with them).
   */
  private drawShadows(trees: readonly TreeArt[]): void {
    const g = this.shadowGfx.clear();
    const placed = pieceShadows(this.room, placedFurniture(this.ctx.state, this.room));
    fillShadows(g, washPieces(placed, castShadows(this.room)));
    const fill = (s: Shadow): void => {
      g.fillStyle(0x000000, s.alpha).fillEllipse(s.x, s.y, s.w, s.h);
    };
    for (const p of this.liveRoom().props) {
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

  /**
   * The room shown with the furniture placed in it: its display spots as props
   * (`Pick up` at an empty one while nothing is carried) and its pieces as
   * sorted furniture. Read wherever the props and sorted pieces are drawn or
   * targeted, so it follows the state on every redraw.
   */
  private liveRoom(): Room {
    const { state } = this.ctx;
    const carrying = carriedTree(state) !== undefined;
    return {
      ...this.room,
      props: [...this.room.props, ...placedProps(state, this.room, carrying)],
      furniture: [...this.room.furniture, ...placedFurniture(state, this.room)],
    };
  }

  /** Interact on an empty placed spot, empty-handed: the item back into the inventory, or refused while a tree is on it. */
  private pickUpPlaced(id: number, label: string): void {
    const result = pickUpItem(this.ctx.state, id);
    if (result === 'ok') {
      this.drawRoom();
      this.relocated();
      this.showToast(`Picked up ${label}`);
    } else if (result === 'a tree is on it') {
      this.showToast('A tree is on it');
    }
  }

  /** The placeable kinds in stock, in PLACEABLES order. */
  private stockedKinds(): PlaceableKind[] {
    const kinds = Object.keys(PLACEABLES) as PlaceableKind[];
    return kinds.filter((k) => inventoryHas(this.ctx.state.inventory, k));
  }

  /** The stocked kind after `kind`, wrapping (`kind` itself when it is the only one); undefined with none. */
  private nextStockedKind(kind: PlaceableKind): PlaceableKind | undefined {
    const order = Object.keys(PLACEABLES);
    const stocked = this.stockedKinds();
    return stocked.find((k) => order.indexOf(k) > order.indexOf(kind)) ?? stocked[0];
  }

  /** The room takes furniture and some is in stock: placement mode can start. */
  private placeable(): boolean {
    return PLACEABLE_ROOMS.includes(this.room.key) && this.stockedKinds().length > 0;
  }

  /** P, and the menu's Place item and Next: start placing the first stocked kind, or switch to the next. */
  private togglePlacing(): void {
    if (!this.roomKeysLive()) return;
    if (this.placing) {
      const next = this.nextStockedKind(this.placing.kind);
      if (next) this.placing = { kind: next };
    } else if (this.placeable()) {
      const [first] = this.stockedKinds();
      if (first) this.placing = { kind: first };
    }
    this.drawPlayer();
    this.publishHook();
  }

  /** Leaves placement mode, the ghost with it; the props and trees answer E again. */
  private stopPlacing(): void {
    if (!this.placing) return;
    this.placing = undefined;
    this.ghost?.gfx.destroy();
    this.ghost = undefined;
    this.drawPlayer();
    this.publishHook();
  }

  /** E while placing: `kind` down at the ghost, then the next stocked kind once it runs out; or the refusal as a toast. */
  private placeHere(kind: PlaceableKind): void {
    const { x, y } = ghostFootprint(kind, this.player);
    const result = placeItem(this.ctx.state, this.room, kind, x, y, this.player);
    if (typeof result === 'string') {
      this.showToast(refusalText(result));
      return;
    }
    if (!inventoryHas(this.ctx.state.inventory, kind)) {
      const next = this.nextStockedKind(kind);
      if (next) this.placing = { kind: next };
      else this.stopPlacing();
    }
    this.drawRoom();
    this.relocated();
    this.showToast(`Placed ${PLACEABLES[kind].label}`);
  }

  /**
   * While placing, the ghost on the tile the player faces, green where its
   * kind can go down and red where it is refused; nothing otherwise.
   */
  private drawGhost(): void {
    if (!this.placing) return;
    const { kind } = this.placing;
    const rect = ghostFootprint(kind, this.player);
    const check = placementCheck(this.room, this.ctx.state, kind, rect.x, rect.y, this.player);
    const gfx = this.ghost?.gfx ?? this.inWorld(this.add.graphics().setDepth(GHOST_DEPTH));
    const colour = check === 'ok' ? GHOST_OK : GHOST_REFUSED;
    gfx
      .clear()
      .fillStyle(colour, 0.35)
      .fillRect(rect.x, rect.y, rect.w, rect.h)
      .lineStyle(1, colour)
      .strokeRect(rect.x, rect.y, rect.w, rect.h);
    this.ghost = { gfx, rect, check };
  }

  /** The prompt over the player: the placement's (Place <label>, or why not) while placing, else the near target's. */
  private prompt(): string {
    if (this.placing && this.ghost) {
      const { kind } = this.placing;
      const { rect, check } = this.ghost;
      return check === 'ok'
        ? promptFor({ ...rect, key: kind, prompt: `Place ${PLACEABLES[kind].label}` })
        : refusalText(check);
    }
    return this.near ? this.nearPrompt(this.near) : '';
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
   * labelled above; each piece of display furniture has one label under it
   * (displayLabels), its trees' names or `(empty)`, as obj_pedestal did.
   */
  private drawTrees(): void {
    for (const part of this.treeParts) part.destroy();
    const { state } = this.ctx;
    const season = seasonForDay(state.day);
    const room = this.liveRoom();
    const sprites = treeSprites(state, room);
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
        this.text(s.x, art.labelY, s.label, worldLabelStyle(this.worldUi))
          .setOrigin(0.5, 1)
          .setDepth(s.depth),
      ];
    });
    for (const l of displayLabels(state, room)) {
      // An empty piece's `(empty)` in the softer ink.
      const label = this.text(l.x, l.y, l.text, {
        ...worldLabelStyle(this.worldUi),
        color: l.empty ? PANEL_STYLE.soft : PANEL_STYLE.text,
      });
      this.treeParts.push(label.setOrigin(0.5, 0).setDepth(l.depth));
    }
    for (const part of this.treeParts) this.inWorld(part);
    this.drawShadows(floorArt);
    this.targets = [...room.props, ...treeTargets(sprites)];
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
    this.stopPlacing();
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
    this.stopPlacing();
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
    this.music.update(delta);
    const viewerOpen = this.viewer.isOpen;
    const modal = this.panel?.modal === true;
    const showInteract =
      (this.near !== undefined || this.placing !== undefined) && !viewerOpen && !modal;
    this.hud.setVisible(!viewerOpen);
    // An empty line would still draw its plate.
    this.carryText.setVisible(!viewerOpen && this.carryText.text !== '');
    this.toast.setVisible(this.toast.text !== '');
    this.menuButton.setVisible(!viewerOpen && !modal);
    this.notebookButton.setVisible(!viewerOpen && !modal);
    this.promptText.setVisible(showInteract);
    this.interactButton.setVisible(showInteract);
    this.ghost?.gfx.setVisible(!modal && !viewerOpen);
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
      if (!modal) {
        const prev = this.player.walkAnim;
        this.player = stepPlayer(this.player, input, this.room);
        if (footstepDue(prev, this.player.walkAnim)) this.sfx.play('footstep');
      }
      // The weather keeps moving under panels, as the prototype's did.
      if (this.weather) stepParticles(this.weather.parts, this.weather.profile, this.weather.area);
      this.frames += 1;
    }
    this.drawWeather();
    this.drawPlayer();
    this.hud.setText(hudText(this.ctx.state));
    this.draw3d();
    this.publishHook();
  }

  /**
   * The 3D world setting (src/world3d/world3d.ts): while Babylon draws the
   * room under the canvas, the world camera and the canvas's clear colour step
   * aside so it shows through, and the HUD and panels draw over it as ever.
   */
  private draw3d(): void {
    this.world3d.sync(this.ctx.settings.world3d, this.room, this.player);
    const on = this.world3d.active;
    if (this.worldCamera.visible === !on) return;
    this.worldCamera.visible = !on;
    setSurround(this.game, on);
  }

  /**
   * The day clock (obj_game_controller Step_0), run while the viewer is closed,
   * modal panels or not; a passing day toasts the display revenue it paid.
   */
  private runClock(deltaMs: number): void {
    const { state, overrides } = this.ctx;
    const timeScale = overrides.timeScale ?? BASE_TIME_SCALE;
    const tick = tickClock(state, this.clockS, deltaMs / 1000, timeScale);
    this.clockS = tick.accumulatorS;
    this.daysPassed(tick.days, tick.revenue, false);
  }

  /** Sleep and Sleep a week (src/world/sleep.ts), from the room only: the world advances `days` and toasts the new day. */
  private goToSleep(days: number): void {
    if (!this.roomKeysLive()) return;
    this.closePanel();
    const slept = sleep(this.ctx.state, days);
    this.daysPassed(slept.days, slept.revenue, true);
  }

  /**
   * After the clock or a sleep moved the world `days` days: the season tip,
   * the sprites regrown, the weather and wash on a new season, an open
   * inspector and the HUD refreshed, and a toast of the revenue paid (led by
   * the new day after a sleep).
   */
  private daysPassed(days: number, revenue: number, slept: boolean): void {
    const { state } = this.ctx;
    if (days === 0) return;
    const tip = seasonTipFor(state, state.day - days);
    if (tip !== undefined) {
      state.seasonTipShown = true;
      this.seasonTip = tip;
    }
    this.drawTrees();
    this.drawPlayer();
    // obj_weather's season recheck: the season only changes with the day.
    if (this.weather && this.weather.season !== seasonForDay(state.day)) this.buildWeather();
    // The garden's scenery turns with the season too; an indoor room's wash never changes.
    if (this.roomWash !== seasonWash(this.room, seasonForDay(state.day))) this.drawRoom();
    if (this.panel?.tree) this.openInspector(this.panel.tree);
    this.hud.setText(hudText(state));
    const paid = revenue > 0 ? `Display revenue: +$${String(revenue)}` : '';
    if (revenue > 0) this.sfx.play('coin');
    const toast = slept ? [`Day ${String(state.day)}`, paid].filter(Boolean).join('  |  ') : paid;
    if (toast) this.showToast(toast);
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
    // Sorted at the feet (y + PLAYER_FEET, the sprite's bottom edge), as the props are at their bottom edges.
    this.playerSprite
      .setPosition(x, y)
      .setFrame(playerFrame(facing, walkAnim))
      .setDepth(y + PLAYER_FEET);
    const shadow = playerShadow(x, y);
    this.playerShadow.setPosition(shadow.x, shadow.y);
    // Placing suppresses the props and trees: E puts the ghost's kind down instead.
    this.near = this.placing ? undefined : nearestInteractable(this.player, this.targets);
    this.drawGhost();
    // Just above the head, the sprite's top edge.
    this.promptText.setText(this.prompt()).setPosition(x, y + PLAYER_FEET - PLAYER_H - 2);
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
    this.stopPlacing();
    this.viewer.open(viewTree, overrides.season ?? seasonForDay(state.day), state);
    this.music.play(trackFor('viewer'));
    this.hud.setVisible(false);
    this.carryText.setVisible(false);
    this.menuButton.setVisible(false);
    this.notebookButton.setVisible(false);
    this.promptText.setVisible(false);
    this.interactButton.setVisible(false);
    this.weatherGfx.setVisible(false);
    this.publishHook();
  }

  /** Centres and tap targets of the tappable controls on screen, for the test hook; none under the viewer, only the panel's under a modal. */
  private controls(): BonsaiTestHook['controls'] {
    if (this.viewer.isOpen) return [];
    const at = (id: string, text: Phaser.GameObjects.Text) => {
      const c = text.getCenter();
      return { id, x: c.x, y: c.y, hit: hitArea(text) };
    };
    const rows = this.panel?.buttons.map((b) => at(b.id, b.text)) ?? [];
    if (this.panel?.modal) return rows;
    const interact = this.near || this.placing ? [at('interact', this.interactButton)] : [];
    const tutorial = this.tutorialButton
      ? [at(this.tutorialButton.id, this.tutorialButton.text)]
      : [];
    const toggle = this.tutorialToggle
      ? [at(this.tutorialToggle.id, this.tutorialToggle.text)]
      : [];
    return [
      at('view', this.viewButton),
      at('notebook', this.notebookButton),
      at('menu', this.menuButton),
      ...interact,
      ...tutorial,
      ...toggle,
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
          ? this.seasonTip !== undefined
            ? seasonTipParts(this.seasonTip).label
            : tutorialStepLabel(state.tutorialStep)
          : '',
      seasonTip: this.seasonTip ?? '',
      notebook:
        this.panel?.key === NOTEBOOK_KEY ? notebookHeader(state, this.notebookPage) : undefined,
      inventorySections:
        this.panel?.key === INVENTORY_KEY ? inventorySections(state.inventory) : undefined,
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
      closeLabel: this.panel?.buttons.find((b) => b.id === 'panel-close')?.text.text ?? '',
      settings: { ...this.ctx.settings },
      lastSound: this.sfx.lastSound,
      track: this.music.track,
      musicPaused: this.music.paused,
      near: this.near?.key ?? '',
      prompt: this.prompt(),
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
      world3d: this.world3d.snapshot(),
      roomBounds: { ...this.room.bounds },
      doors: this.room.props.flatMap(({ key, x, y, wall }) =>
        wall === undefined ? [] : [{ key, x, y, wall }],
      ),
      arrivedBeside: this.arrivedBeside,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      sortedDecor: furnitureSprites(this.room).map((f) => ({ sheet: f.sheet.key, depth: f.depth })),
      placed: state.placed
        .filter((p) => p.room === this.room.key)
        .map((p) => ({
          id: p.id,
          kind: p.kind,
          x: p.x,
          y: p.y,
          w: PLACEABLES[p.kind].w,
          h: PLACEABLES[p.kind].h,
          spots: placedSpots(p).map((s) => s.key),
        })),
      placing:
        this.placing && this.ghost
          ? { kind: this.placing.kind, ...this.ghost.rect, check: this.ghost.check }
          : undefined,
      placingVisible: this.ghost !== undefined && !this.viewer.isOpen && this.panel?.modal !== true,
      hud: hudText(state),
      frames: this.frames,
    };
  };
}
