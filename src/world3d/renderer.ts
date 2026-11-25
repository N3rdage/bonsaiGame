/**
 * The Babylon side of the 3D world: an engine on its own canvas laid under the
 * game's, a scene of boxes from `meshSpecs` and a skinned character for the player. The
 * only module that imports Babylon, and only world3d.ts reaches it, through a
 * dynamic import, so a player with the setting off downloads none of it. The
 * game stays the 2D game's Phaser scene: this draws what it is told.
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import '@babylonjs/core/Culling/ray';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/outlineRenderer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { Scene } from '@babylonjs/core/scene';
import { Bench, type BenchResult } from './bench';
import type { Season } from '../sim/seasons';
import { PALETTE } from '../world/palette';
import { sheetUrl, type Sheet } from '../world/assets';
import { ROOMS } from '../world/gardenRoom';
import { floorTiles } from '../world/roomArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../world/resolution';
import type { Room, RoomKey } from '../world/shedRoom';
import { RADIUS_DEFAULT, cameraRig, cutNames, cutSpan, cuttable, ease } from './camera';
import { countDetails, roomDetails, type Detail } from './details';
import { floorLayout, floorMeshData, type QuadMeshData } from './floorTiles';
import { furniturePieces, type FurniturePiece } from './furniture';
import {
  FURNITURE_MODELS,
  type FurnitureKind,
  type FurniturePart,
  type ModelPart,
} from './furnitureModels';
import { PaintCache } from './paint/cache';
import {
  RASTER_V_UP,
  SURFACE_SPECS,
  inkedWallSheets,
  paintedFloor,
  paintedFloorQuad,
  paintedWalls,
  type Surface,
} from './paintedSurfaces';
import { roundedBox } from './shapes';
import { lightDirectionBabylon, shadowDarkness } from './light';
import {
  logChange,
  neighbourKeys,
  roomSignature,
  type AheadBuild,
  type RoomChange,
} from './roomCache';
import { shadowFrustum } from './shadowFrustum';
import {
  JOINT_NAMES,
  type ClipName,
  type ClipWeights,
  type JointName,
  characterMesh,
  clipDuration,
  fadeWeights,
  parentOf,
  poseOf,
  restOffset,
  smoothSpeed,
  walkRate,
} from './character';
import { facingOf } from './move';
import {
  PLAYER_HEIGHT,
  type Vec3,
  hotspotSpecs,
  meshSpecs,
  playerFeet,
  roomPx,
  surfaceOwners,
  toBabylon,
} from './meshes';
import { inFront, nearestSpot, type Picked, type ScreenSpot } from './tap';
import { roomPlan3d, type Roof, type RoomPlan3d, type WashKey } from './plan';
import { roofMesh } from './roofMeshes';
import { LOOK, OBJECTS, outlineWidthMetres, unitRgb } from './look';
import { lookLit } from './lookPlugin';
import { treeMeshData, type WorldMeshData } from './treeMeshes';
import type { SpotMat, TreeStand } from './trees';
import {
  massLayout,
  paintedFaces,
  paintedMassFaces,
  onRing,
  paperedMasses,
  wallLayout,
  wallMeshData,
  wallPieces,
  type PieceQuads,
  type WallQuad,
} from './wallTiles';
import { weatherKind, weatherSprites, type WeatherField } from './weather';

/** The page's surround colour (SURROUND in src/scenes/textStyle.ts), behind the room. */
const SURROUND = Color3.FromHexString('#3e3632');

/** The plan's origin, where a model's parts and a room's standing details are placed. */
const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * The mat on an empty display spot: a low stone stand, `MAT_DIAMETER` m across
 * and `MAT_HEIGHT` m tall, on the furniture's top, drawn in `MAT_TESSELLATION`
 * sides and inked. The furniture under it is inked too, and its outline shell
 * (a few cm deep) is drawn over whatever stands inside it, so the stand rises
 * clear of it.
 */
const MAT_DIAMETER = 0.3;
const MAT_HEIGHT = 0.08;
const MAT_TESSELLATION = 16;

/** What the scene reports to the test hook. */
export interface RendererSnapshot {
  readonly room: Room['key'];
  readonly meshes: number;
  /** The trees standing in the room, each a pot, a trunk and, in season, foliage. */
  readonly trees: number;
  /** The mats marking the room's empty display spots. */
  readonly spotMats: number;
  /** The furniture standing in the room, as instances of each kind's one model. */
  readonly instances: Readonly<Record<string, number>>;
  /** Where the camera is now, eased toward the rig. */
  readonly camera: { readonly alpha: number; readonly beta: number; readonly radius: number };
  /** The names of the pieces cut away to the skirting, sorted. */
  readonly cut: readonly string[];
  /** The way the player faces: its last step's heading in the plan, radians (0 east, pi/2 south). */
  readonly facing: number;
  /** The kind of model standing for the player. */
  readonly model: 'character';
  /** How much of each clip the player's pose is made of now, summing to 1. */
  readonly clips: ClipWeights;
  /** True while something casts a shadow onto the floor. */
  readonly shadows: boolean;
  /** The sun's shadow map: its bias settings and its fixed window, the room's. */
  readonly shadowMap: ShadowMapState;
  /** The polygon offset the Inked art's materials draw with over the boxes they lie on. */
  readonly artDepthOffset: number;
  /** True while the lit meshes take the look light and ink. */
  readonly inked: boolean;
  /** The key of the sheet the floor's tiles are cut from, or of the painted surface it wears (`paint.wood`), null until it has loaded. */
  readonly floorSheet: string | null;
  /** The keys of the sheets the walls' art is cut from that have loaded, and `paint.wallpaper` where they are papered, sorted. */
  readonly wallSheets: readonly string[];
  /** How many surfaces the paint cache has painted since the renderer started. */
  readonly painted: number;
  /** How long painting them took at start-up, ms. */
  readonly paintMs: number;
  /** How many modelled details the room has of each kind ('door', 'window', 'hedge', 'planting'). */
  readonly details: Readonly<Record<string, number>>;
  /** The kind of weather drawn (petals, fireflies, leaves, snow), null where none is. */
  readonly weather: string | null;
  /** Each prop's hotspot id, the screen point of its middle and the size of the rectangle its box covers, in game px (480 x 270), where a tap picks it. */
  readonly hotspots: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
  /** The keys of the room sets kept, shown and hidden, sorted. */
  readonly built: readonly string[];
  /** The latest changes of room, oldest first, with the time each took to draw. */
  readonly roomChanges: readonly RoomChange[];
  /** The latest rooms built ahead, hidden, oldest first, with the time each build took. */
  readonly aheadBuilds: readonly AheadBuild[];
  /** How many rooms behind the shown room's doors are still queued to be built ahead. */
  readonly aheadPending: number;
  /** The benchmark run: on now, and its result once in. */
  readonly bench: { readonly running: boolean; readonly result: BenchResult | null };
}

/** What the test hook reads of the shadow map. */
export interface ShadowMapState {
  /** True while the frustum is the one fitted to the room, not refitted to the casters each frame. */
  readonly fixed: boolean;
  readonly size: number;
  readonly bias: number;
  readonly normalBias: number;
  /** The orthographic window and depth range now in use: left, right, bottom, top, minZ, maxZ, metres. */
  readonly window: readonly [number, number, number, number, number, number];
}

const SHADOW_MAP_SIZE = 2048;
/** Babylon's depth bias and the metres a receiver's lookup moves along its normal: enough that a lit floor is not its own shadow, too little to lift a shadow off its caster's foot. */
const SHADOW_BIAS = 0.0005;
const SHADOW_NORMAL_BIAS = 0.02;
/** The frustum always reaches this high, metres, so a tree taller than the room's walls still casts. */
const SHADOW_CEILING = 4;
/** Anisotropic samples for the art on walls and floor, which the camera sees at a grazing angle. */
const ANISOTROPY = 4;
/** Polygon offset of the Inked art's materials, negative toward the camera. */
const ART_DEPTH_OFFSET = -2;

/** How long the player's feet must have stayed put before a room is built ahead, ms: a walk's frames are not all steps, so one frame at rest does not say the player stopped. */
const STILL_BEFORE_AHEAD_MS = 200;

/** A standing tree: the node at its feet, the meshes parented to it and the key they were built for (`treeKey`). */
interface Planted {
  readonly root: TransformNode;
  parts: Mesh[];
  key: string;
}

/** The adapter from the viewer's mesh arrays to Babylon: a mesh of `data` under `parent`. */
function meshOf(
  name: string,
  data: WorldMeshData,
  parent: TransformNode,
  material: StandardMaterial,
): Mesh {
  const mesh = new Mesh(name, parent.getScene());
  const vertices = new VertexData();
  vertices.positions = data.positions;
  vertices.normals = data.normals;
  vertices.colors = data.colors;
  vertices.indices = data.indices;
  vertices.applyToMesh(mesh);
  mesh.material = material;
  mesh.parent = parent;
  mesh.isPickable = false;
  return mesh;
}

/** The floor's tile mesh with the texture and material only it uses, disposed together. */
interface FloorArt {
  readonly mesh: Mesh;
  readonly material: StandardMaterial;
  readonly sheet: string;
}

/** One sheet's wall meshes, one per wall piece, and the material and texture they share. */
interface WallArt {
  readonly meshes: readonly Mesh[];
  readonly material: StandardMaterial;
}

/** A room's set waiting on a sheet's texture: what to do when it has loaded, and when it has failed. */
interface Waiter {
  readonly laid: (texture: Texture) => void;
  readonly failed: () => void;
}

/** A sheet's texture, shared by every room that wears it, and the sets waiting for it to load. */
interface SheetTexture {
  readonly texture: Texture;
  loaded: boolean;
  readonly waiting: Waiter[];
}

/**
 * One room's built meshes, parented to `root` so hiding the root hides them
 * all: the boxes of its plan, its details, floor tiles and wall art (which
 * lie in once their sheets have loaded), and the materials only they use.
 */
interface RoomSet {
  /** What the room was built from (`roomSignature`); a room that no longer matches is built again. */
  readonly signature: string;
  readonly root: TransformNode;
  readonly plan: RoomPlan3d;
  readonly pieces: Map<string, Piece>;
  /** The meshes that cast a shadow, which come off the shadow map's list with the set: the details standing on the floor. */
  readonly casters: Mesh[];
  detailCounts: Readonly<Record<string, number>>;
  floorArt: FloorArt | undefined;
  /** The walls' textured meshes and material, by sheet key. */
  readonly wallArt: Map<string, WallArt>;
  /** True once the set was disposed, so a texture that loads after it is not laid on it. */
  disposed: boolean;
  /** Sheets whose art is yet to be laid (or to fail); the set is dressed at 0. */
  pending: number;
  /** When the frame that built the set began, ms, and the change that frame logged. */
  readonly started: number;
  change: RoomChange | undefined;
  laidAt: number | undefined;
}

/** A furniture kind's model, one mesh drawn once per piece standing: the pieces' keys it was last set for, and how many. */
interface Instanced {
  readonly mesh: Mesh;
  key: string;
  count: number;
}

/** The Babylon colour of a 0xRRGGBB number. */
function washHex(hex: number): Color3 {
  return Color3.FromHexString(`#${hex.toString(16).padStart(6, '0')}`);
}

/** A pane of glass: its light blue-green tint and how opaque it is. */
const GLASS_TINT = 0xbcdcd8;
const GLASS_ALPHA = 0.4;

/** The Babylon colour of a palette wash. */
function washColour(wash: WashKey): Color3 {
  return washHex(PALETTE[wash]);
}

/** The Babylon colour of a model part: an object-palette colour for furniture, a wash for details. */
function partColour(part: ModelPart | FurniturePart): Color3 {
  return 'object' in part ? washHex(OBJECTS[part.object]) : washColour(part.wash);
}

/**
 * The matrix that stands a piece's model on its footprint: the model's nominal
 * size scaled to the piece's (Babylon's x, y and z are the plan's east-west,
 * up and north-south), turned about the vertical, its feet at the floor.
 */
function instanceMatrix(piece: FurniturePiece): Matrix {
  const { size } = FURNITURE_MODELS[piece.kind];
  const feet = toBabylon({ x: piece.x, y: piece.y, z: 0 });
  return Matrix.Compose(
    new Vector3(piece.w / size.w, piece.h / size.h, piece.d / size.d),
    Quaternion.RotationAxis(Vector3.Up(), piece.rotation),
    new Vector3(feet.x, feet.y, feet.z),
  );
}

/** A room piece's mesh and the heights its full box spans, in Babylon's y. */
interface Piece {
  readonly mesh: Mesh;
  readonly z0: number;
  readonly z1: number;
}

/** The middle of a piece's full box in the plan's frame: what art and details hung from it are positioned against, whether or not the camera's cut has lowered it. */
function centreOf(piece: Piece): Vec3 {
  const { x, z } = piece.mesh.position;
  return { x, y: -z, z: (piece.z0 + piece.z1) / 2 };
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly shadows: ShadowGenerator;
  private readonly sun: DirectionalLight;
  /** The player's skinned body, its origin at the feet. */
  private readonly player: Mesh;
  private readonly bones: Readonly<Record<JointName, Bone>>;
  /** The plan heading the player faces; a new session faces away from the default camera, north. */
  private facing = -Math.PI / 2;
  /** Where the player stood last frame, plan metres. */
  private lastFeet: { x: number; y: number } | undefined;
  /** The player's speed over the ground, metres a second, smoothed. */
  private speed = 0;
  /** How much of each clip shows, and where each clip's clock is, seconds. */
  private clips: ClipWeights = { idle: 1, walk: 0 };
  private readonly clocks: Record<ClipName, number> = { idle: 0, walk: 0 };
  /** True when the browser asks for reduced motion: the idle clip then holds its first pose, so a player at rest is still. */
  private readonly stillIdle = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly boneMatrix = new Matrix();
  private room: Room['key'] | undefined;
  private roomChanges: RoomChange[] = [];
  private aheadBuilds: AheadBuild[] = [];
  /** Each room's built set, kept for the renderer's life; only `shown`'s is enabled. */
  private readonly sets = new Map<Room['key'], RoomSet>();
  private shown: RoomSet | undefined;
  /** The rooms behind the shown room's doors still to be built ahead, in the order of its props; one is built a frame once the shown room is dressed and the player has stood still a moment. */
  private ahead: RoomKey[] = [];
  /** Every sheet's texture, by URL: loaded once and shared by the rooms that use it. */
  private readonly sheets = new Map<string, SheetTexture>();
  /** The session's one cache of painted rasters, and the texture each became (once, by paint key). */
  private readonly paints = new PaintCache();
  private readonly painting = new Map<string, RawTexture>();
  private paintMs = 0;
  /** The invisible boxes taps pick props by, each under its prop's key. */
  private hotspots = new Map<AbstractMesh, string>();
  /** The prop keys the hotspots were made for, so a placed item's spots add or drop theirs. */
  private hotspotKey = '';
  /** Each furniture kind's one source mesh, made when a room first needs it and kept; hidden while the room shown has none. */
  private readonly models = new Map<FurnitureKind, Mesh>();
  /** The furniture models in use in the room shown, by kind. */
  private readonly instanced = new Map<FurnitureKind, Instanced>();
  private cut: string[] = [];
  /** The weather's one plane, its particles' matrices and colours, and the particle array they were sized for. */
  private weatherMesh: Mesh | undefined;
  private weatherMatrices = new Float32Array(0);
  private weatherColours = new Float32Array(0);
  private weatherParts: readonly unknown[] | undefined;
  private weatherKind: string | null = null;
  /** The trees standing in the room, by tree id. */
  private readonly trees = new Map<number, Planted>();
  /** The mats on the room's empty display spots, by spot key. */
  private readonly mats = new Map<string, Mesh>();
  /** The one material of every tree part and furniture model: white, so the vertex colours the builders give are what shows. */
  private readonly colourMaterial: StandardMaterial;
  /** The material of every pane of glass: a light blue-green, translucent. */
  private readonly glassMaterial: StandardMaterial;
  /** Toward the sun in Babylon's frame, the direction the ramp reads N.L against. */
  private readonly toLight: Vec3;
  /** The ink outline's width in metres: the look's outline width in px at the default camera radius on the canvas as it is sized. */
  private outlineWidth = 0;
  /** What the camera looks at, eased toward the player's middle. */
  private readonly focus = Vector3.Zero();
  private materials = new Map<WashKey, StandardMaterial>();
  private size = '';
  /** When the last frame was drawn, ms; the scene is rendered by hand, so the engine keeps no delta of its own. */
  private lastFrame = performance.now();
  /** When the player's feet last moved, or the room last changed, ms. */
  private movedAt = performance.now();
  /** The benchmark run in progress or last finished, and the draw-call counter it reads while it runs. */
  private bench: Bench | undefined;
  private instrumentation: SceneInstrumentation | undefined;

  /** Lays a canvas for the engine under `host`, the game's own, which it then rides above; outside `#game`, whose canvas the tests find. */
  constructor(private readonly host: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'fixed', zIndex: '0', pointerEvents: 'none' });
    document.body.prepend(this.canvas);
    Object.assign(host.style, { position: 'relative', zIndex: '1' });

    this.engine = new Engine(this.canvas, true, { adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromColor3(SURROUND, 1);
    const processing = this.scene.imageProcessingConfiguration;
    processing.isEnabled = true;
    processing.exposure = LOOK.exposure;
    processing.contrast = LOOK.contrast;
    const light = lightDirectionBabylon();
    this.toLight = { x: -light.x, y: -light.y, z: -light.z };
    const sun = new DirectionalLight('sun', new Vector3(light.x, light.y, light.z), this.scene);
    this.sun = sun;
    // One room at a time is a few metres across and the camera always sees all of it, so a single
    // shadow map covers it at a fine texel size; cascades would only split that map for no gain.
    // The frustum is fitted to the room once (`fitShadows`), not to the casters each frame, so the
    // map's texels never slide as the player moves; the biases keep a lit floor from shadowing itself.
    sun.autoUpdateExtends = false;
    sun.shadowOrthoScale = 0;
    this.shadows = new ShadowGenerator(SHADOW_MAP_SIZE, sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.bias = SHADOW_BIAS;
    this.shadows.normalBias = SHADOW_NORMAL_BIAS;
    this.shadows.darkness = shadowDarkness();
    this.camera = new ArcRotateCamera(
      'camera',
      cameraRig.alpha,
      cameraRig.beta,
      cameraRig.radius,
      Vector3.Zero(),
      this.scene,
    );
    this.colourMaterial = new StandardMaterial('colours', this.scene);
    this.colourMaterial.specularColor = Color3.Black();
    lookLit(this.colourMaterial, this.toLight);
    this.glassMaterial = new StandardMaterial('glass', this.scene);
    this.glassMaterial.diffuseColor = washHex(GLASS_TINT);
    this.glassMaterial.specularColor = Color3.Black();
    this.glassMaterial.alpha = GLASS_ALPHA;
    lookLit(this.glassMaterial, this.toLight);
    const skeleton = new Skeleton('player', 'player', this.scene);
    const bones: Partial<Record<JointName, Bone>> = {};
    for (const joint of JOINT_NAMES) {
      const [x, y, z] = restOffset(joint);
      const parent = parentOf(joint);
      bones[joint] = new Bone(
        joint,
        skeleton,
        parent ? (bones[parent] ?? null) : null,
        Matrix.Translation(x, y, z),
      );
    }
    this.bones = bones as Record<JointName, Bone>;
    this.player = this.skinned(skeleton);
    this.shadows.addShadowCaster(this.player);
    this.ink(this.player);
    for (const room of Object.values(ROOMS)) {
      const floor = paintedFloor(room);
      if (floor) this.surfaceTexture(floor);
      else this.sheetTexture(floorTiles(room).sheet);
      if (paintedWalls(room)) this.surfaceTexture('wallpaper');
      for (const sheet of inkedWallSheets(room)) this.sheetTexture(sheet);
    }
  }

  /** The character's body as one mesh skinned to `skeleton`, whose bones are in `JOINT_NAMES` order. */
  private skinned(skeleton: Skeleton): Mesh {
    const body = characterMesh();
    const mesh = new Mesh('player', this.scene);
    const vertices = new VertexData();
    vertices.positions = body.positions;
    vertices.normals = body.normals;
    vertices.colors = body.colors;
    vertices.matricesIndices = body.joints;
    vertices.matricesWeights = body.weights;
    vertices.indices = body.indices;
    vertices.applyToMesh(mesh);
    mesh.skeleton = skeleton;
    mesh.material = this.colourMaterial;
    mesh.isPickable = false;
    // The bounds are the bind pose's; a swinging limb must not be culled with them.
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  /** Starts a benchmark run in the room shown (src/world3d/bench.ts), dropping any earlier one. */
  startBench(): void {
    this.instrumentation?.dispose();
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.bench = new Bench();
  }

  /** The benchmark's state for the test hook: running now, and its result once in. */
  benchState(): { running: boolean; result: BenchResult | null } {
    return { running: this.bench?.running ?? false, result: this.bench?.result ?? null };
  }

  /** The room shown and every enabled mesh in the scene: the room's own, the player's and the standing furniture's, not those of the rooms kept hidden. */
  snapshot(): RendererSnapshot | undefined {
    if (this.room === undefined) return undefined;
    const { alpha, beta, radius } = this.camera;
    return {
      room: this.room,
      meshes: this.scene.meshes.filter((mesh) => mesh.isEnabled()).length,
      trees: this.trees.size,
      spotMats: this.mats.size,
      instances: Object.fromEntries([...this.instanced].map(([kind, { count }]) => [kind, count])),
      camera: { alpha, beta, radius },
      cut: this.cut,
      facing: this.facing,
      model: 'character',
      clips: this.clips,
      shadows: (this.shadows.getShadowMap()?.renderList?.length ?? 0) > 0,
      shadowMap: this.shadowMapState(),
      artDepthOffset: this.shown?.floorArt?.material.zOffset ?? 0,
      inked: true,
      floorSheet: this.shown?.floorArt?.sheet ?? null,
      wallSheets: [...(this.shown?.wallArt.keys() ?? [])].sort(),
      painted: this.paints.painted,
      paintMs: this.paintMs,
      details: this.shown?.detailCounts ?? {},
      weather: this.weatherKind,
      hotspots: this.hotspotPoints()
        .filter(inFront)
        .map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
      built: [...this.sets.keys()].sort(),
      roomChanges: this.roomChanges,
      aheadBuilds: this.aheadBuilds,
      aheadPending: this.ahead.length,
      bench: this.benchState(),
    };
  }

  private shadowMapState(): ShadowMapState {
    const { sun } = this;
    return {
      fixed: !sun.autoUpdateExtends,
      size: SHADOW_MAP_SIZE,
      bias: this.shadows.bias,
      normalBias: this.shadows.normalBias,
      window: [
        sun.orthoLeft,
        sun.orthoRight,
        sun.orthoBottom,
        sun.orthoTop,
        sun.shadowMinZ,
        sun.shadowMaxZ,
      ],
    };
  }

  /** Fits the sun's frustum to `plan`'s boxes, and to a tree's height, once, as the room is built. */
  private fitShadows(plan: RoomPlan3d): void {
    const boxes = [...plan.floor, ...plan.walls, ...plan.furniture];
    const frustum = shadowFrustum(
      {
        min: {
          x: Math.min(...boxes.map((b) => b.x0)),
          y: Math.min(...boxes.map((b) => b.z0)),
          z: -Math.max(...boxes.map((b) => b.y1)),
        },
        max: {
          x: Math.max(...boxes.map((b) => b.x1)),
          y: Math.max(SHADOW_CEILING, ...boxes.map((b) => b.z1)),
          z: -Math.min(...boxes.map((b) => b.y0)),
        },
      },
      lightDirectionBabylon(),
    );
    const { sun } = this;
    sun.position.set(frustum.position.x, frustum.position.y, frustum.position.z);
    sun.orthoLeft = frustum.left;
    sun.orthoRight = frustum.right;
    sun.orthoBottom = frustum.bottom;
    sun.orthoTop = frustum.top;
    sun.shadowMinZ = frustum.minZ;
    sun.shadowMaxZ = frustum.maxZ;
    sun.forceProjectionMatrixCompute();
  }

  /** The screen point of each hotspot's middle and the size of the rectangle its box covers, in game px. */
  private hotspotPoints(): (ScreenSpot & { readonly w: number; readonly h: number })[] {
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const view = this.camera.viewport.toGlobal(width, height);
    const transform = this.scene.getTransformMatrix();
    return [...this.hotspots].map(([mesh, id]) => {
      const to = (point: Vector3): Vector3 =>
        Vector3.Project(point, Matrix.IdentityReadOnly, transform, view);
      const at = to(mesh.position);
      const corners = mesh.getBoundingInfo().boundingBox.vectorsWorld.map(to);
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      return {
        id,
        x: (at.x / width) * GAME_WIDTH,
        y: (at.y / height) * GAME_HEIGHT,
        z: at.z,
        w: ((Math.max(...xs) - Math.min(...xs)) / width) * GAME_WIDTH,
        h: ((Math.max(...ys) - Math.min(...ys)) / height) * GAME_HEIGHT,
      };
    });
  }

  /**
   * What a tap at (`u`, `v`), fractions of the game canvas, lands on: a prop
   * (the one whose hotspot box the tap hits, or the nearest whose middle is
   * within `radius` game px of it), else the floor. `scene.pick` takes CSS px
   * of the canvas, which lies exactly over the game's.
   */
  pick(u: number, v: number, radius = 0): Picked | undefined {
    const x = u * this.canvas.clientWidth;
    const y = v * this.canvas.clientHeight;
    const prop = this.scene.pick(x, y, (mesh) => this.hotspots.has(mesh));
    const direct = prop.pickedMesh ? this.hotspots.get(prop.pickedMesh) : undefined;
    const hotspot = nearestSpot(
      { x: u * GAME_WIDTH, y: v * GAME_HEIGHT },
      this.hotspotPoints(),
      radius,
      direct,
    );
    if (hotspot !== undefined) return { hotspot };
    const floor = this.shown?.pieces.get('floor')?.mesh;
    const ground = this.scene.pick(x, y, (mesh) => mesh === floor);
    return ground.pickedPoint ? { floor: roomPx(ground.pickedPoint) } : undefined;
  }

  /** Where the player's feet are, in plan metres. */
  playerAt(): { x: number; y: number; z: number } {
    const { x, y, z } = this.player.position;
    return { x, y: -z, z: y };
  }

  /**
   * Draws one frame of `room` with the player at `px` (room px) and `trees`
   * standing, showing the room's kept meshes (built the first time, or when
   * the room's data changed) if the room changed and rebuilding a tree's only
   * when its key did. A change of room is logged with the time it took, and
   * queues the rooms behind its doors, which later frames build hidden, one a
   * frame, from `roomOf`'s live data, only once the player's feet have stood
   * still for `STILL_BEFORE_AHEAD_MS` and the room shown is dressed, so a
   * build never hitches a walk.
   */
  frame(
    room: Room,
    px: { readonly x: number; readonly y: number },
    trees: readonly TreeStand[],
    mats: readonly SpotMat[],
    season: Season,
    weather: WeatherField | undefined,
    roomOf: (key: RoomKey) => Room,
    gameSeconds = 0,
  ): void {
    const started = performance.now();
    const fresh = this.room !== room.key;
    const built = fresh && this.enter(room, started);
    this.furnish(room);
    this.plant(trees, season);
    this.lay(mats);
    this.sky(weather);
    const plan = playerFeet(px);
    const now = performance.now();
    const elapsed = now - this.lastFrame;
    this.lastFrame = now;
    let moved = 0;
    if (this.lastFeet && !fresh) {
      const dx = plan.x - this.lastFeet.x;
      const dy = plan.y - this.lastFeet.y;
      this.facing = facingOf(dx, dy, this.facing);
      moved = Math.hypot(dx, dy);
    }
    this.lastFeet = { x: plan.x, y: plan.y };
    if (fresh || moved > 0) this.movedAt = now;
    this.animate(moved, fresh ? 0 : gameSeconds);
    // The body faces its local +z, which a turn of theta about y points along (sin, cos) in x and z.
    this.player.rotation.y = this.facing + Math.PI / 2;
    const feet = toBabylon(plan);
    this.player.position.set(feet.x, feet.y, feet.z);
    this.follow({ x: feet.x, y: feet.y + PLAYER_HEIGHT / 2, z: feet.z }, fresh, elapsed);
    this.cutAway(plan);
    this.fit();
    this.scene.render();
    this.recordBench(now, elapsed, room.key);
    if (fresh) {
      const change: RoomChange = { room: room.key, first: built, ms: performance.now() - started };
      this.roomChanges = logChange(this.roomChanges, change);
      const set = this.shown;
      if (built && set) {
        set.change = change;
        if (set.laidAt !== undefined) change.dressedMs = set.laidAt - started;
      }
      this.ahead = neighbourKeys(room);
    } else if (
      moved === 0 &&
      now - this.movedAt >= STILL_BEFORE_AHEAD_MS &&
      this.shown?.laidAt !== undefined
    ) {
      this.buildAhead(roomOf);
    }
  }

  /**
   * Builds the next queued room hidden, one a frame, and logs the time the
   * build took (the caller asks only once the player has stood
   * still, since a build is one blocking step): a room whose kept set
   * still matches its live data is passed over without spending the frame, and
   * a stale one is released and built again. Nothing of the room shown is
   * touched: not its shadow fit, hotspots or log.
   */
  private buildAhead(roomOf: (key: RoomKey) => Room): void {
    for (let key = this.ahead.shift(); key !== undefined; key = this.ahead.shift()) {
      const room = roomOf(key);
      const signature = roomSignature(room);
      const kept = this.sets.get(key);
      if (kept?.signature === signature) continue;
      if (kept) this.release(kept);
      const started = performance.now();
      const set = this.build(room, signature, started);
      set.root.setEnabled(false);
      this.aheadBuilds = logChange(this.aheadBuilds, {
        room: key,
        ms: performance.now() - started,
      });
      this.sets.set(key, set);
      return;
    }
  }

  /** Counts the frame just drawn into the benchmark run, if one is on, and lets go of the counter when it ends. */
  private recordBench(now: number, ms: number, room: Room['key']): void {
    const calls = this.instrumentation?.drawCallsCounter.current ?? 0;
    const finished = this.bench?.record(now, ms, calls, {
      width: this.engine.getRenderWidth(),
      height: this.engine.getRenderHeight(),
      dpr: window.devicePixelRatio,
      userAgent: navigator.userAgent,
      room,
    });
    if (!finished) return;
    this.instrumentation?.dispose();
    this.instrumentation = undefined;
  }

  /**
   * Moves the player's pose on by `dt` seconds of game time, the time the frame's
   * fixed steps covered (a slow frame on the wall clock does not stretch it):
   * its speed over the ground (the metres its feet moved in that time,
   * smoothed) sets the clip weights and the walk clip's rate, and the bones
   * take the blended pose.
   */
  private animate(moved: number, dt: number): void {
    this.speed = smoothSpeed(this.speed, moved, dt);
    this.clips = fadeWeights(this.clips, this.speed, dt);
    if (!this.stillIdle) this.clocks.idle = (this.clocks.idle + dt) % clipDuration('idle');
    this.clocks.walk = (this.clocks.walk + dt * walkRate(this.speed)) % clipDuration('walk');
    const pose = poseOf(this.clips, this.clocks);
    for (const joint of JOINT_NAMES) {
      const { rotation, translation } = pose[joint];
      Matrix.ComposeToRef(
        Vector3.OneReadOnly,
        new Quaternion(...rotation),
        new Vector3(...translation),
        this.boneMatrix,
      );
      this.bones[joint].updateMatrix(this.boneMatrix, false);
    }
  }

  /** Eases the camera toward the player and the session's rig; a new room snaps the look-at point to the player. */
  private follow(goal: { x: number; y: number; z: number }, snap: boolean, elapsed: number): void {
    const dt = snap ? Infinity : elapsed;
    this.focus.set(
      ease(this.focus.x, goal.x, dt),
      ease(this.focus.y, goal.y, dt),
      ease(this.focus.z, goal.z, dt),
    );
    this.camera.setTarget(this.focus, false, false, true);
    const path = this.bench?.camera(performance.now());
    if (path) {
      this.camera.alpha = path.alpha;
      this.camera.beta = path.beta;
      this.camera.radius = path.radius;
      return;
    }
    this.camera.alpha = ease(this.camera.alpha, cameraRig.alpha, dt);
    this.camera.beta = ease(this.camera.beta, cameraRig.beta, dt);
    this.camera.radius = ease(this.camera.radius, cameraRig.radius, dt);
  }

  /** Lowers the pieces the camera's heading puts in the way (cutNames) to the skirting, and stands the rest, when the set changed. */
  private cutAway(player: { x: number; y: number; z: number }): void {
    if (!this.shown) return;
    const { plan, pieces } = this.shown;
    const { alpha, beta, radius } = this.camera;
    const names = cutNames(plan, { alpha, beta, radius }, player)
      .filter((name) => pieces.has(name))
      .sort();
    if (names.join() === this.cut.join()) return;
    this.cut = names;
    const cut = new Set(names);
    for (const [name, piece] of pieces) {
      const span = cut.has(name) ? cutSpan(piece.z0, piece.z1) : piece;
      piece.mesh.setEnabled(span !== undefined);
      if (!span) continue;
      piece.mesh.scaling.y = (span.z1 - span.z0) / (piece.z1 - piece.z0);
      piece.mesh.position.y = (span.z0 + span.z1) / 2;
    }
    // A lowered piece squashes the details hung from it into a sliver (a face's window is a
    // frame outline over the skirting), so they go with the height they stood at.
    for (const [name, piece] of pieces) {
      for (const child of piece.mesh.getChildMeshes(true)) {
        if (child.name.startsWith('details.')) child.setEnabled(!cut.has(name));
      }
    }
  }

  /** Stands `stands`' trees: one whose key changed gets new meshes, one that left is disposed, a new one is built. */
  private plant(stands: readonly TreeStand[], season: Season): void {
    const ids = new Set(stands.map((stand) => stand.tree.id));
    for (const [id, planted] of this.trees) {
      if (ids.has(id)) continue;
      this.discardTree(planted);
      this.trees.delete(id);
    }
    for (const { tree, key, x, y, z } of stands) {
      let planted = this.trees.get(tree.id);
      if (!planted) {
        const root = new TransformNode(`tree.${String(tree.id)}`, this.scene);
        planted = { root, parts: [], key: '' };
        this.trees.set(tree.id, planted);
      }
      const feet = toBabylon({ x, y, z });
      planted.root.position.set(feet.x, feet.y, feet.z);
      if (planted.key === key) continue;
      for (const part of planted.parts) this.discard(part);
      const root = planted.root;
      planted.parts = treeMeshData(tree, season).map(({ part, data }) => {
        const mesh = meshOf(`tree.${String(tree.id)}.${part}`, data, root, this.colourMaterial);
        this.shadows.addShadowCaster(mesh);
        this.ink(mesh);
        return mesh;
      });
      planted.key = key;
    }
  }

  /** Lays `mats`: a new spot gets a mat, one that left has its mat disposed, and each stays on its spot. */
  private lay(mats: readonly SpotMat[]): void {
    const keys = new Set(mats.map((mat) => mat.key));
    for (const [key, mesh] of this.mats) {
      if (keys.has(key)) continue;
      this.discard(mesh);
      this.mats.delete(key);
    }
    for (const { key, x, y, z } of mats) {
      let mesh = this.mats.get(key);
      if (!mesh) {
        mesh = CreateCylinder(
          `mat.${key}`,
          { diameter: MAT_DIAMETER, height: MAT_HEIGHT, tessellation: MAT_TESSELLATION },
          this.scene,
        );
        mesh.material = this.material('stone');
        mesh.isPickable = false;
        this.ink(mesh);
        this.mats.set(key, mesh);
      }
      const at = toBabylon({ x, y, z: z + MAT_HEIGHT / 2 });
      mesh.position.set(at.x, at.y, at.z);
    }
  }

  /** Removes the canvas and everything on the GPU, and gives the game's canvas back its style. */
  dispose(): void {
    for (const set of this.sets.values()) this.release(set);
    this.sets.clear();
    this.shown = undefined;
    for (const { texture } of this.sheets.values()) texture.dispose();
    this.sheets.clear();
    for (const texture of this.painting.values()) texture.dispose();
    this.painting.clear();
    this.paints.clear();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
    Object.assign(this.host.style, { position: '', zIndex: '' });
  }

  private material(wash: WashKey): StandardMaterial {
    const known = this.materials.get(wash);
    if (known) return known;
    const material = new StandardMaterial(`wash.${wash}`, this.scene);
    material.diffuseColor = washColour(wash);
    material.specularColor = Color3.Black();
    lookLit(material, this.toLight);
    this.materials.set(wash, material);
    return material;
  }

  /**
   * Shows `room`: hides the set of the room shown, then shows `room`'s kept
   * set (every piece standing at full height again, the shadow frustum
   * refitted) or, if it has none or it was built from other data, builds it.
   * Returns true when it built. The furniture models and trees of the room
   * left are let go; the models stay for the next room that has them.
   */
  private enter(room: Room, started: number): boolean {
    this.shown?.root.setEnabled(false);
    for (const { mesh } of this.instanced.values()) mesh.setEnabled(false);
    this.instanced.clear();
    for (const planted of this.trees.values()) this.discardTree(planted);
    this.trees.clear();
    for (const mesh of this.mats.values()) this.discard(mesh);
    this.mats.clear();
    this.cut = [];
    const signature = roomSignature(room);
    let set = this.sets.get(room.key);
    if (set && set.signature !== signature) {
      this.release(set);
      set = undefined;
    }
    const built = set === undefined;
    if (!set) {
      set = this.build(room, signature, started);
      this.sets.set(room.key, set);
    } else {
      for (const piece of set.pieces.values()) {
        piece.mesh.setEnabled(true);
        piece.mesh.scaling.y = 1;
        piece.mesh.position.y = (piece.z0 + piece.z1) / 2;
        for (const child of piece.mesh.getChildMeshes(true)) {
          if (child.name.startsWith('details.')) child.setEnabled(true);
        }
      }
      set.root.setEnabled(true);
    }
    this.shown = set;
    this.room = room.key;
    this.fitShadows(set.plan);
    this.setHotspots(room, set.plan);
    return built;
  }

  /** Builds `room`'s set: its boxes, details and, once their sheets have loaded, its floor and wall art. */
  private build(room: Room, signature: string, started: number): RoomSet {
    const plan = roomPlan3d(room);
    const set: RoomSet = {
      signature,
      root: new TransformNode(`room.${room.key}`, this.scene),
      plan,
      pieces: new Map(),
      casters: [],
      detailCounts: {},
      floorArt: undefined,
      wallArt: new Map(),
      disposed: false,
      pending: (paintedFloor(room) ? 0 : 1) + inkedWallSheets(room).length,
      started,
      change: undefined,
      laidAt: undefined,
    };
    // A building's wall box is inked as the furniture is: it stands where an inked face once did.
    const buildings = new Set(plan.walls.filter((w) => !onRing(room, w)).map((w) => w.name));
    for (const spec of meshSpecs(plan)) {
      const mesh = CreateBox(
        spec.name,
        { width: spec.width, height: spec.height, depth: spec.depth },
        this.scene,
      );
      mesh.parent = set.root;
      mesh.position.set(spec.center.x, spec.center.y, spec.center.z);
      mesh.material = this.material(spec.wash);
      mesh.receiveShadows = spec.name === 'floor';
      if (spec.name.startsWith('furniture.') || buildings.has(spec.name)) this.ink(mesh);
      set.pieces.set(spec.name, {
        mesh,
        z0: spec.center.y - spec.height / 2,
        z1: spec.center.y + spec.height / 2,
      });
    }
    for (const roof of plan.roofs) this.roof(set, roof);
    this.furnishDetails(set, roomDetails(room, plan));
    this.tile(set, room);
    this.clothe(set, room);
    return set;
  }

  /** Stands `roof` over its building: one inked prism, cut away with the other pieces. */
  private roof(set: RoomSet, roof: Roof): void {
    const { center, positions, normals, indices } = roofMesh(roof);
    const mesh = new Mesh(roof.name, this.scene);
    const vertices = new VertexData();
    vertices.positions = positions;
    vertices.normals = normals;
    vertices.indices = indices;
    vertices.applyToMesh(mesh);
    mesh.parent = set.root;
    mesh.position.set(center.x, center.y, center.z);
    mesh.material = this.material(roof.wash);
    mesh.isPickable = false;
    this.ink(mesh);
    set.pieces.set(roof.name, { mesh, z0: roof.low, z1: roof.high });
  }

  /** Disposes a set's meshes, taking its casters off the shadow map's list, and the materials only it uses; the shared textures stay. */
  private release(set: RoomSet): void {
    set.disposed = true;
    for (const mesh of set.casters) this.shadows.removeShadowCaster(mesh);
    set.root.dispose();
    set.floorArt?.material.dispose(false, false);
    for (const { material } of set.wallArt.values()) material.dispose(false, false);
  }

  /** Notes that one of `set`'s sheets has been laid, or failed; when the last has, the set is dressed. */
  private settle(set: RoomSet): void {
    set.pending -= 1;
    if (set.pending > 0) return;
    set.laidAt = performance.now();
    if (set.change) set.change.dressedMs = set.laidAt - set.started;
  }

  /**
   * Lays `room`'s floor just over the floor box's top: its painted surface
   * (one quad, laid at once, the texture being made at start) or, where the
   * floor keeps its Inked tiles, those once the sheet's PNG (the one Phaser
   * loads) has loaded as one merged quad mesh. Mipmapped, look lit and
   * shadowed like the floor under it.
   */
  private tile(set: RoomSet, room: Room): void {
    const surface = paintedFloor(room);
    if (surface) {
      const material = this.sheetMaterial(`floor.${surface}`, this.surfaceTexture(surface), false);
      const data = floorMeshData([paintedFloorQuad(surface, room)]);
      const mesh = this.texturedMesh(`floor.${surface}`, data, material);
      mesh.parent = set.root;
      mesh.receiveShadows = true;
      set.floorArt = { mesh, material, sheet: `paint.${surface}` };
      return;
    }
    const sheet = floorTiles(room).sheet;
    this.loadSheet(set, sheet, (texture) => {
      const { width, height } = texture.getSize();
      const material = this.sheetMaterial('floor.tiles', texture, false);
      const mesh = this.texturedMesh(
        'floor.tiles',
        floorMeshData(floorLayout(room, width, height).quads),
        material,
      );
      mesh.parent = set.root;
      mesh.receiveShadows = true;
      set.floorArt = { mesh, material, sheet: sheet.key };
    });
  }

  /**
   * Dresses `plan`'s walls: with wallpaper (`paintedWalls`) on the faces that
   * look into the room, laid at once from the texture made at start, and in
   * the Inked art of the 2D room's runs (the caps, and all of an outdoor
   * room's), once each sheet's PNG has loaded. A piece the camera can cut away
   * (`cuttable`) gets one mesh per surface parented to its box, so the cut,
   * which scales and lowers the box, takes its art with it (one mesh over
   * several pieces could not follow their separate cuts); the pieces that
   * stand for good, a garden's fences and a room's papered masses, share one
   * merged mesh per surface. A surface's meshes share one material,
   * mipmapped, look lit, with no outline and no shadows, as the boxes are.
   */
  private clothe(set: RoomSet, room: Room): void {
    const { plan } = set;
    const pieces = wallPieces(plan.walls).filter((piece) => set.pieces.has(piece.name));
    const movable = new Set(pieces.filter((p) => cuttable(plan, p)).map((p) => p.name));
    if (paintedWalls(room)) {
      const { metres } = SURFACE_SPECS.wallpaper;
      const material = this.sheetMaterial('wall.paper', this.surfaceTexture('wallpaper'), true);
      this.layWalls(
        set,
        'paint.wallpaper',
        material,
        paintedFaces(pieces, metres),
        paperedMasses(room).flatMap((mass) => paintedMassFaces(mass, metres)),
        movable,
      );
    }
    for (const sheet of inkedWallSheets(room)) {
      this.loadSheet(set, sheet, (texture) => {
        const { width, height } = texture.getSize();
        const material = this.sheetMaterial(`wall.${sheet.key}`, texture, true);
        this.layWalls(
          set,
          sheet.key,
          material,
          wallLayout(room, pieces, sheet, width, height),
          paperedMasses(room).flatMap((mass) => massLayout(room, mass, sheet, width, height)),
          movable,
        );
      });
    }
  }

  /**
   * Lays `layout`'s quads on the wall pieces as one mesh per movable piece,
   * parented to the piece's box, and `masses` with the pieces that stand for
   * good as one mesh on the set's root; `key` names them in `set.wallArt`.
   */
  private layWalls(
    set: RoomSet,
    key: string,
    material: StandardMaterial,
    layout: readonly PieceQuads[],
    masses: readonly WallQuad[],
    movable: ReadonlySet<string>,
  ): void {
    const meshes = layout
      .filter(({ piece }) => movable.has(piece))
      .flatMap(({ piece, quads }) => {
        const hung = set.pieces.get(piece);
        if (!hung) return [];
        const mesh = this.texturedMesh(
          `${piece}.${key}`,
          wallMeshData(quads, centreOf(hung)),
          material,
        );
        mesh.parent = hung.mesh;
        return [mesh];
      });
    const fixed = [
      ...layout.filter(({ piece }) => !movable.has(piece)).flatMap(({ quads }) => quads),
      ...masses,
    ];
    if (fixed.length > 0) {
      const whole = this.texturedMesh(
        `walls.${key}`,
        wallMeshData(fixed, { x: 0, y: 0, z: 0 }),
        material,
      );
      whole.parent = set.root;
      meshes.push(whole);
    }
    if (meshes.length === 0) material.dispose(false, false);
    else set.wallArt.set(key, { meshes, material });
  }

  /** The texture of a painted surface: its raster painted once by the cache, then made a texture once, repeating, mipmapped and trilinear. */
  private surfaceTexture(surface: Surface): RawTexture {
    const { key, paint } = SURFACE_SPECS[surface];
    const known = this.painting.get(key);
    if (known) return known;
    const started = performance.now();
    const { width, height, data } = this.paints.get(key, paint);
    const texture = new RawTexture(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width,
      height,
      Constants.TEXTUREFORMAT_RGBA,
      this.scene,
      true,
      RASTER_V_UP,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = ANISOTROPY;
    this.painting.set(key, texture);
    this.paintMs += performance.now() - started;
    return texture;
  }

  /**
   * Hands `sheet`'s texture to `ready` once it has loaded, for `set`: the
   * texture, the PNG Phaser loads, is made once as a mipmapped, anisotropic,
   * clamped texture and shared by every room that wears the sheet, so a room
   * seen again loads nothing. A texture sampled nearest with no mipmaps shows
   * a different texel of the art in each pixel it is shrunk to, which crawls
   * as the camera moves; the mipmaps average them. A pixel-art sheet still
   * magnifies nearest, crisp. A texture that arrives after `set` was disposed
   * is not laid on it, and one that fails to load is disposed and tried again
   * by the next room that wants it.
   */
  private loadSheet(set: RoomSet, sheet: Sheet, ready: (texture: Texture) => void): void {
    this.sheetTexture(sheet, {
      laid: (texture) => {
        if (!set.disposed) ready(texture);
        this.settle(set);
      },
      failed: () => {
        this.settle(set);
      },
    });
  }

  /** Starts `sheet`'s texture loading if no room has yet, so a room built later finds it; `waiter`, if given, is told when it has loaded or failed. */
  private sheetTexture(sheet: Sheet, waiter?: Waiter): void {
    const url = sheetUrl(import.meta.env.BASE_URL, sheet);
    const known = this.sheets.get(url);
    if (known?.loaded) {
      waiter?.laid(known.texture);
      return;
    }
    if (known) {
      if (waiter) known.waiting.push(waiter);
      return;
    }
    const texture = new Texture(url, this.scene, {
      samplingMode:
        sheet.art === 'pixel' ? Texture.NEAREST_LINEAR_MIPLINEAR : Texture.TRILINEAR_SAMPLINGMODE,
      onLoad: () => {
        entry.loaded = true;
        for (const { laid } of entry.waiting.splice(0)) laid(texture);
      },
      onError: () => {
        texture.dispose();
        this.sheets.delete(url);
        for (const { failed } of entry.waiting.splice(0)) failed();
      },
    });
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = ANISOTROPY;
    const entry: SheetTexture = { texture, loaded: false, waiting: waiter ? [waiter] : [] };
    this.sheets.set(url, entry);
  }

  /** A look-lit material showing `texture`; with `oneSided`, only on the side its quads' normals face. */
  private sheetMaterial(name: string, texture: Texture, oneSided: boolean): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseTexture = texture;
    material.specularColor = Color3.Black();
    material.backFaceCulling = oneSided;
    // The art lies a few millimetres off the box face it dresses, which a phone's 16-bit depth
    // buffer cannot always tell from the face; a polygon offset pulls it toward the camera at any
    // depth precision and any angle.
    material.zOffset = ART_DEPTH_OFFSET;
    material.zOffsetUnits = ART_DEPTH_OFFSET;
    lookLit(material, this.toLight);
    return material;
  }

  /** An unpickable mesh of `data` (positions, normals, UVs, indices) with `material`. */
  private texturedMesh(name: string, data: QuadMeshData, material: StandardMaterial): Mesh {
    const mesh = new Mesh(name, this.scene);
    const vertices = new VertexData();
    vertices.positions = data.positions;
    vertices.normals = data.normals;
    vertices.uvs = data.uvs;
    vertices.indices = data.indices;
    vertices.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }

  /** Makes the invisible box of each prop of `room`, in place of the last set. */
  private setHotspots(room: Room, plan: RoomPlan3d): void {
    for (const mesh of this.hotspots.keys()) mesh.dispose();
    this.hotspots.clear();
    this.hotspotKey = room.props.map((prop) => prop.key).join();
    for (const spec of hotspotSpecs(plan)) {
      const mesh = CreateBox(
        `hotspot.${spec.key}`,
        { width: spec.width, height: spec.height, depth: spec.depth },
        this.scene,
      );
      mesh.position.set(spec.center.x, spec.center.y, spec.center.z);
      mesh.isVisible = false;
      this.hotspots.set(mesh, spec.key);
    }
  }

  /**
   * Stands `room`'s modelled furniture, which the live room changes as items
   * are placed and picked up: a kind whose pieces' keys changed gets its
   * instances reset, a kind with none left is hidden (its source mesh is kept
   * for the next room that has it), and the hotspots are made again when the
   * props changed. The room's boxes are not touched.
   */
  private furnish(room: Room): void {
    if (room.props.map((prop) => prop.key).join() !== this.hotspotKey) {
      this.setHotspots(room, roomPlan3d(room));
    }
    const byKind = new Map<FurnitureKind, FurniturePiece[]>();
    for (const piece of furniturePieces(room)) {
      byKind.set(piece.kind, [...(byKind.get(piece.kind) ?? []), piece]);
    }
    for (const [kind, known] of this.instanced) {
      if (byKind.has(kind)) continue;
      known.mesh.setEnabled(false);
      this.instanced.delete(kind);
    }
    for (const [kind, pieces] of byKind) {
      const key = pieces.map((piece) => piece.key).join(';');
      const known = this.instanced.get(kind) ?? { mesh: this.modelMesh(kind), key: '', count: 0 };
      known.mesh.setEnabled(true);
      this.instanced.set(kind, known);
      if (known.key === key) continue;
      known.key = key;
      known.count = pieces.length;
      const matrices = new Float32Array(pieces.length * 16);
      pieces.forEach((piece, n) => {
        instanceMatrix(piece).copyToArray(matrices, n * 16);
      });
      known.mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
    }
  }

  /** The one source mesh of `kind`, made the first time a room needs it: its parts' boxes, vertex-coloured from the object palette, merged into one at the origin. */
  private modelMesh(kind: FurnitureKind): Mesh {
    const known = this.models.get(kind);
    if (known) return known;
    const mesh = this.partsMesh(`model.${kind}`, FURNITURE_MODELS[kind].parts, ORIGIN);
    this.shadows.addShadowCaster(mesh);
    this.ink(mesh);
    this.models.set(kind, mesh);
    return mesh;
  }

  /**
   * Stands the room's modelled doors, windows, hedges and plantings. Those
   * hung from a wall piece (a door, a window) are one merged mesh parented to
   * that piece's box (a wall, or the building face a window or the roller door is set in), so the camera's cut takes them away with it, lit like
   * the walls and not outlined (a face detail is inked, as its face is); the rest (a hedge, a planting) are one merged
   * mesh on the floor, which casts a shadow and is inked as furniture is.
   */
  private furnishDetails(set: RoomSet, details: readonly Detail[]): void {
    const { plan } = set;
    set.detailCounts = countDetails(details);
    // A detail hung on a box that is not drawn (a face inside its building's wall) hangs from the box that is.
    const owners = surfaceOwners(plan);
    const hostOf = (detail: Detail): string | undefined =>
      detail.host === undefined ? undefined : (owners.get(detail.host) ?? detail.host);
    const hung = (host: string | undefined): host is string =>
      host !== undefined && set.pieces.has(host);
    const hosts = new Set(details.map(hostOf).filter(hung));
    for (const host of hosts) {
      const piece = set.pieces.get(host);
      if (!piece) continue;
      const parent = piece.mesh;
      const parts = details.filter((d) => hostOf(d) === host).flatMap((d) => d.parts);
      const mesh = this.partsMesh(`details.${host}`, parts, centreOf(piece));
      mesh.parent = parent;
      // A building face is inked, and its outline shell is drawn over any pixel that is not
      // the face's own or an inked mesh's, so a detail standing on it must be inked as well.
      if (parent.renderOutline) this.ink(mesh);
    }
    const standing = details.filter((d) => !hung(hostOf(d))).flatMap((d) => d.parts);
    if (standing.length === 0) return;
    const mesh = this.partsMesh('details.standing', standing, ORIGIN);
    mesh.parent = set.root;
    this.shadows.addShadowCaster(mesh);
    this.ink(mesh);
    set.casters.push(mesh);
  }

  /**
   * One mesh of `parts` (boxes in plan metres), each vertex-coloured by its
   * wash and positioned relative to `origin` so it can ride a box centred
   * there. Solid parts go on the shared colour material; glass parts
   * (`ModelPart.glass`) go into a child mesh on the translucent glass material.
   */
  private partsMesh(
    name: string,
    parts: readonly (ModelPart | FurniturePart)[],
    origin: Vec3,
  ): Mesh {
    const solid = this.mergedParts(
      name,
      parts.filter((part) => part.glass !== true),
      origin,
    );
    solid.material = this.colourMaterial;
    const panes = parts.filter((part) => part.glass === true);
    if (panes.length > 0) {
      const glass = this.mergedParts(`${name}.glass`, panes, origin);
      glass.material = this.glassMaterial;
      glass.parent = solid;
    }
    return solid;
  }

  /** The box of `part` at the origin: sharp from `CreateBox`, or rounded from `roundedBox` when it has a radius. */
  private partBox(name: string, part: ModelPart | FurniturePart): Mesh {
    const width = part.x1 - part.x0;
    const height = part.z1 - part.z0;
    const depth = part.y1 - part.y0;
    if (part.radius === undefined) return CreateBox(name, { width, height, depth }, this.scene);
    const shape = roundedBox(width, height, depth, part.radius);
    const vertices = new VertexData();
    vertices.positions = shape.positions;
    vertices.normals = shape.normals;
    vertices.uvs = shape.uvs;
    vertices.indices = shape.indices;
    const mesh = new Mesh(name, this.scene);
    vertices.applyToMesh(mesh);
    return mesh;
  }

  /** One mesh of `parts`, vertex-coloured by wash (details) or object colour (furniture) and positioned relative to `origin`; the caller gives it a material. */
  private mergedParts(
    name: string,
    parts: readonly (ModelPart | FurniturePart)[],
    origin: Vec3,
  ): Mesh {
    const boxes = parts.map((part, n) => {
      const box = this.partBox(`${name}.${String(n)}`, part);
      const centre = toBabylon({
        x: (part.x0 + part.x1) / 2 - origin.x,
        y: (part.y0 + part.y1) / 2 - origin.y,
        z: (part.z0 + part.z1) / 2 - origin.z,
      });
      box.position.set(centre.x, centre.y, centre.z);
      box.bakeCurrentTransformIntoVertices();
      const { r, g, b } = partColour(part);
      const rgba = [r, g, b, 1];
      box.setVerticesData(
        VertexBuffer.ColorKind,
        Float32Array.from({ length: box.getTotalVertices() * 4 }, (_, i) => rgba[i % 4] ?? 1),
      );
      return box;
    });
    const mesh = Mesh.MergeMeshes(boxes, true);
    if (!mesh) throw new Error(`${name} has no parts`);
    mesh.name = name;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  /** Draws `mesh` with the ink outline (`LOOK.ink`) in the width the canvas's size gives; Babylon outlines thin instances in the same one draw. */
  private ink(mesh: AbstractMesh): void {
    mesh.renderOutline = true;
    mesh.outlineColor = new Color3(...unitRgb(LOOK.ink));
    mesh.outlineWidth = this.outlineWidth;
  }

  /** Disposes a mesh that may cast a shadow, taking it off the shadow map's list first. */
  private discard(mesh: Mesh): void {
    this.shadows.removeShadowCaster(mesh);
    mesh.dispose();
  }

  /** Disposes a standing tree and its parts. */
  private discardTree(planted: Planted): void {
    for (const part of planted.parts) this.shadows.removeShadowCaster(part);
    planted.root.dispose();
  }

  /**
   * Draws the weather field the 2D world steps, or none: one small unlit quad
   * per particle, thin-instanced from one plane, turned to face the camera's
   * heading and tinted (alpha included) by the instance colour. The field is
   * the only model; this reads its particles each frame and keeps no physics.
   */
  private sky(field: WeatherField | undefined): void {
    this.weatherKind = weatherKind(field);
    if (!field) {
      this.weatherMesh?.dispose(false, true);
      this.weatherMesh = undefined;
      this.weatherParts = undefined;
      return;
    }
    const sprites = weatherSprites(field);
    this.weatherMesh ??= this.weatherQuad();
    const mesh = this.weatherMesh;
    if (this.weatherParts !== field.parts) {
      this.weatherParts = field.parts;
      this.weatherMatrices = new Float32Array(sprites.length * 16);
      this.weatherColours = new Float32Array(sprites.length * 4);
      mesh.thinInstanceSetBuffer('matrix', this.weatherMatrices, 16, false);
      mesh.thinInstanceSetBuffer('color', this.weatherColours, 4, false);
    }
    // A plane faces -z; turning it about the vertical by this puts that face toward the camera.
    const yaw = Math.atan2(-Math.cos(this.camera.alpha), -Math.sin(this.camera.alpha));
    sprites.forEach((sprite, n) => {
      const at = toBabylon(sprite);
      Matrix.Compose(
        new Vector3(sprite.size, sprite.size, 1),
        Quaternion.RotationYawPitchRoll(yaw, 0, sprite.roll),
        new Vector3(at.x, at.y, at.z),
      ).copyToArray(this.weatherMatrices, n * 16);
      const { r, g, b } = washHex(sprite.colour);
      this.weatherColours.set([r, g, b, sprite.alpha], n * 4);
    });
    mesh.thinInstanceBufferUpdated('matrix');
    mesh.thinInstanceBufferUpdated('color');
  }

  /** The unit plane the weather's particles are instances of: unlit, white, blended by the instance colour's alpha, never a shadow caster. */
  private weatherQuad(): Mesh {
    const mesh = CreatePlane('weather', { size: 1 }, this.scene);
    const material = new StandardMaterial('weather', this.scene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.hasVertexAlpha = true;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  /** Lays the canvas over the game's and resizes the backing when the game's canvas moved or changed size. */
  private fit(): void {
    const rect = this.host.getBoundingClientRect();
    const size = `${String(rect.left)} ${String(rect.top)} ${String(rect.width)} ${String(rect.height)}`;
    if (size === this.size) return;
    this.size = size;
    Object.assign(this.canvas.style, {
      left: `${String(rect.left)}px`,
      top: `${String(rect.top)}px`,
      width: `${String(rect.width)}px`,
      height: `${String(rect.height)}px`,
    });
    this.engine.resize();
    this.outlineWidth = outlineWidthMetres(RADIUS_DEFAULT, this.camera.fov, rect.height);
    for (const mesh of this.scene.meshes) {
      if (mesh.renderOutline) mesh.outlineWidth = this.outlineWidth;
    }
  }
}
