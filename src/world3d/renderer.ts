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
import { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/outlineRenderer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import type { Season } from '../sim/seasons';
import { PALETTE } from '../world/palette';
import { sheetUrl, type Sheet } from '../world/assets';
import { floorTiles } from '../world/roomArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../world/resolution';
import type { Room } from '../world/shedRoom';
import { RADIUS_DEFAULT, cameraRig, cutNames, cutSpan, cuttable, ease } from './camera';
import { countDetails, roomDetails, type Detail } from './details';
import { floorLayout, floorMeshData, type QuadMeshData } from './floorTiles';
import { furniturePieces, type FurniturePiece } from './furniture';
import { FURNITURE_MODELS, type FurnitureKind, type ModelPart } from './furnitureModels';
import { lightDirectionBabylon, shadowDarkness } from './light';
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
  toBabylon,
} from './meshes';
import { inFront, nearestSpot, type Picked, type ScreenSpot } from './tap';
import { roomPlan3d, type RoomPlan3d, type WashKey } from './plan';
import { inkUnit, outlineWidthMetres } from './toon';
import { toonLit } from './toonPlugin';
import { treeMeshData, type WorldMeshData } from './treeMeshes';
import type { TreeStand } from './trees';
import { wallLayout, wallMeshData, wallPieces, wallSheets } from './wallTiles';
import { weatherKind, weatherSprites, type WeatherField } from './weather';

/** The page's surround colour (SURROUND in src/scenes/textStyle.ts), behind the room. */
const SURROUND = Color3.FromHexString('#3e3632');

/** The plan's origin, where a model's parts and a room's standing details are placed. */
const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/** What the scene reports to the test hook. */
export interface RendererSnapshot {
  readonly room: Room['key'];
  readonly meshes: number;
  /** The trees standing in the room, each a pot, a trunk and, in season, foliage. */
  readonly trees: number;
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
  /** True while the lit meshes are lit through the toon ramp and inked. */
  readonly toon: boolean;
  /** The key of the sheet the floor's tiles are cut from, null until its texture has loaded. */
  readonly floorSheet: string | null;
  /** The keys of the sheets the walls' art is cut from that have loaded, sorted. */
  readonly wallSheets: readonly string[];
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

/** Seconds over which the measured speed of the player's feet settles, so the fixed steps' jitter does not flicker the blend. */
const SPEED_SMOOTHING = 0.1;
/** The longest frame the animation follows, seconds: a returning tab does not skip a clip's cycles, and a slow frame, in which the game moves the player by no more than its own step cap, is not read as a crawl. */
const MAX_FRAME_SECONDS = 0.1;

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

/** The Babylon colour of a palette wash. */
function washColour(wash: WashKey): Color3 {
  return washHex(PALETTE[wash]);
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
  private plan: RoomPlan3d | undefined;
  private pieces = new Map<string, Piece>();
  private floorArt: FloorArt | undefined;
  /** The walls' textured meshes and material, by sheet key. */
  private readonly wallArt = new Map<string, WallArt>();
  /** Counts the rooms built, so a texture that loads for an earlier one is dropped. */
  private epoch = 0;
  /** The invisible boxes taps pick props by, each under its prop's key. */
  private hotspots = new Map<AbstractMesh, string>();
  /** The prop keys the hotspots were made for, so a placed item's spots add or drop theirs. */
  private hotspotKey = '';
  /** The furniture models in use, by kind. */
  private readonly instanced = new Map<FurnitureKind, Instanced>();
  private cut: string[] = [];
  /** The room's modelled details: one merged mesh per wall piece they hang from, one for those standing on the floor. */
  private detailMeshes: Mesh[] = [];
  private detailCounts: Readonly<Record<string, number>> = {};
  /** The weather's one plane, its particles' matrices and colours, and the particle array they were sized for. */
  private weatherMesh: Mesh | undefined;
  private weatherMatrices = new Float32Array(0);
  private weatherColours = new Float32Array(0);
  private weatherParts: readonly unknown[] | undefined;
  private weatherKind: string | null = null;
  /** The trees standing in the room, by tree id. */
  private readonly trees = new Map<number, Planted>();
  /** The one material of every tree part and furniture model: white, so the vertex colours the builders give are what shows. */
  private readonly colourMaterial: StandardMaterial;
  /** Toward the sun in Babylon's frame, the direction the ramp reads N.L against. */
  private readonly toLight: Vec3;
  /** The ink outline's width in metres: OUTLINE_WIDTH_PX at the default camera radius on the canvas as it is sized. */
  private outlineWidth = 0;
  /** What the camera looks at, eased toward the player's middle. */
  private readonly focus = Vector3.Zero();
  private materials = new Map<WashKey, StandardMaterial>();
  private size = '';
  /** When the last frame was drawn, ms; the scene is rendered by hand, so the engine keeps no delta of its own. */
  private lastFrame = performance.now();

  /** Lays a canvas for the engine under `host`, the game's own, which it then rides above; outside `#game`, whose canvas the tests find. */
  constructor(private readonly host: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'fixed', zIndex: '0', pointerEvents: 'none' });
    document.body.prepend(this.canvas);
    Object.assign(host.style, { position: 'relative', zIndex: '1' });

    this.engine = new Engine(this.canvas, true, { adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromColor3(SURROUND, 1);
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
    toonLit(this.colourMaterial, this.toLight);
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

  /** The room shown and every mesh in the scene, the player's included. */
  snapshot(): RendererSnapshot | undefined {
    if (this.room === undefined) return undefined;
    const { alpha, beta, radius } = this.camera;
    return {
      room: this.room,
      meshes: this.scene.meshes.length,
      trees: this.trees.size,
      instances: Object.fromEntries([...this.instanced].map(([kind, { count }]) => [kind, count])),
      camera: { alpha, beta, radius },
      cut: this.cut,
      facing: this.facing,
      model: 'character',
      clips: this.clips,
      shadows: (this.shadows.getShadowMap()?.renderList?.length ?? 0) > 0,
      shadowMap: this.shadowMapState(),
      artDepthOffset: this.floorArt?.material.zOffset ?? 0,
      toon: true,
      floorSheet: this.floorArt?.sheet ?? null,
      wallSheets: [...this.wallArt.keys()].sort(),
      details: this.detailCounts,
      weather: this.weatherKind,
      hotspots: this.hotspotPoints()
        .filter(inFront)
        .map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
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
    const floor = this.pieces.get('floor')?.mesh;
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
   * standing, rebuilding the room's meshes if it changed and a tree's only
   * when its key did.
   */
  frame(
    room: Room,
    px: { readonly x: number; readonly y: number },
    trees: readonly TreeStand[],
    season: Season,
    weather: WeatherField | undefined,
  ): void {
    const fresh = this.room !== room.key;
    if (fresh) this.build(room);
    this.furnish(room);
    this.plant(trees, season);
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
    this.animate(moved, fresh ? 0 : elapsed / 1000);
    // The body faces its local +z, which a turn of theta about y points along (sin, cos) in x and z.
    this.player.rotation.y = this.facing + Math.PI / 2;
    const feet = toBabylon(plan);
    this.player.position.set(feet.x, feet.y, feet.z);
    this.follow({ x: feet.x, y: feet.y + PLAYER_HEIGHT / 2, z: feet.z }, fresh, elapsed);
    this.cutAway(plan);
    this.fit();
    this.scene.render();
  }

  /**
   * Moves the player's pose on by `seconds`: its speed over the ground (the
   * metres its feet moved this frame, smoothed) sets the clip weights and the
   * walk clip's rate, and the bones take the blended pose.
   */
  private animate(moved: number, seconds: number): void {
    // The game's own clock never advances a frame by more than this, so a slow frame is read as this long.
    const dt = Math.min(seconds, MAX_FRAME_SECONDS);
    if (dt > 0) {
      this.speed += (moved / dt - this.speed) * Math.min(1, dt / SPEED_SMOOTHING);
    } else {
      this.speed = 0;
    }
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
    this.camera.alpha = ease(this.camera.alpha, cameraRig.alpha, dt);
    this.camera.beta = ease(this.camera.beta, cameraRig.beta, dt);
    this.camera.radius = ease(this.camera.radius, cameraRig.radius, dt);
  }

  /** Lowers the pieces the camera's heading puts in the way (cutNames) to the skirting, and stands the rest, when the set changed. */
  private cutAway(player: { x: number; y: number; z: number }): void {
    if (!this.plan) return;
    const { alpha, beta, radius } = this.camera;
    const names = cutNames(this.plan, { alpha, beta, radius }, player)
      .filter((name) => this.pieces.has(name))
      .sort();
    if (names.join() === this.cut.join()) return;
    this.cut = names;
    const cut = new Set(names);
    for (const [name, piece] of this.pieces) {
      const span = cut.has(name) ? cutSpan(piece.z0, piece.z1) : piece;
      piece.mesh.setEnabled(span !== undefined);
      if (!span) continue;
      piece.mesh.scaling.y = (span.z1 - span.z0) / (piece.z1 - piece.z0);
      piece.mesh.position.y = (span.z0 + span.z1) / 2;
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

  /** Removes the canvas and everything on the GPU, and gives the game's canvas back its style. */
  dispose(): void {
    this.clearFloor();
    this.clearWalls();
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
    toonLit(material, this.toLight);
    this.materials.set(wash, material);
    return material;
  }

  /** Disposes the last room's meshes and builds `room`'s. */
  private build(room: Room): void {
    this.epoch += 1;
    this.clearWalls();
    for (const mesh of this.detailMeshes) this.discard(mesh);
    this.detailMeshes = [];
    for (const { mesh } of this.pieces.values()) mesh.dispose();
    this.pieces.clear();
    this.clearFloor();
    for (const { mesh } of this.instanced.values()) this.discard(mesh);
    this.instanced.clear();
    for (const planted of this.trees.values()) this.discardTree(planted);
    this.trees.clear();
    this.cut = [];
    const plan = roomPlan3d(room);
    this.plan = plan;
    this.fitShadows(plan);
    for (const spec of meshSpecs(plan)) {
      const mesh = CreateBox(
        spec.name,
        { width: spec.width, height: spec.height, depth: spec.depth },
        this.scene,
      );
      mesh.position.set(spec.center.x, spec.center.y, spec.center.z);
      mesh.material = this.material(spec.wash);
      mesh.receiveShadows = spec.name === 'floor';
      if (spec.name.startsWith('furniture.')) this.ink(mesh);
      this.pieces.set(spec.name, {
        mesh,
        z0: spec.center.y - spec.height / 2,
        z1: spec.center.y + spec.height / 2,
      });
    }
    this.furnishDetails(roomDetails(room, plan), plan);
    this.setHotspots(room, plan);
    this.room = room.key;
    this.tile(room);
    this.clothe(room, plan);
  }

  /** Disposes the floor's tile mesh, its material and the texture only they use. */
  private clearFloor(): void {
    this.floorArt?.mesh.dispose();
    this.floorArt?.material.dispose(false, true);
    this.floorArt = undefined;
  }

  /**
   * Lays `room`'s Inked floor tiles just over the floor box's top once the
   * sheet's PNG (the one Phaser loads) has loaded: one merged quad mesh,
   * mipmapped, toon lit and shadowed like the floor
   * under it. A texture that arrives after the room changed is dropped.
   */
  private tile(room: Room): void {
    const sheet = floorTiles(room).sheet;
    this.loadSheet(sheet, (texture) => {
      const { width, height } = texture.getSize();
      const material = this.sheetMaterial('floor.tiles', texture, false);
      const mesh = this.texturedMesh(
        'floor.tiles',
        floorMeshData(floorLayout(room, width, height).quads),
        material,
      );
      mesh.receiveShadows = true;
      this.floorArt = { mesh, material, sheet: sheet.key };
    });
  }

  /** Disposes every wall mesh, material and the textures only they use. */
  private clearWalls(): void {
    for (const { meshes, material } of this.wallArt.values()) {
      for (const mesh of meshes) mesh.dispose();
      material.dispose(false, true);
    }
    this.wallArt.clear();
  }

  /**
   * Dresses `plan`'s walls in the Inked art of the 2D room's runs, once each
   * sheet's PNG has loaded. A piece the camera can cut away (`cuttable`) gets
   * one mesh per sheet parented to its box, so the cut, which scales and
   * lowers the box, takes its art with it (one mesh over several pieces could
   * not follow their separate cuts); the pieces that stand for good, a
   * garden's fences, share one merged mesh per sheet. A sheet's meshes share
   * one material, mipmapped, toon lit, with no outline and
   * no shadows, as the boxes are.
   */
  private clothe(room: Room, plan: RoomPlan3d): void {
    const pieces = wallPieces(plan.walls).filter((piece) => this.pieces.has(piece.name));
    const movable = new Set(pieces.filter((p) => cuttable(plan, p)).map((p) => p.name));
    for (const sheet of wallSheets(room)) {
      this.loadSheet(sheet, (texture) => {
        const { width, height } = texture.getSize();
        const material = this.sheetMaterial(`wall.${sheet.key}`, texture, true);
        const layout = wallLayout(room, pieces, sheet, width, height);
        const meshes = layout
          .filter(({ piece }) => movable.has(piece))
          .flatMap(({ piece, quads }) => {
            const box = pieces.find((p) => p.name === piece);
            const parent = this.pieces.get(piece)?.mesh;
            if (!box || !parent) return [];
            const origin = {
              x: (box.x0 + box.x1) / 2,
              y: (box.y0 + box.y1) / 2,
              z: (box.z0 + box.z1) / 2,
            };
            const mesh = this.texturedMesh(
              `${piece}.${sheet.key}`,
              wallMeshData(quads, origin),
              material,
            );
            mesh.parent = parent;
            return [mesh];
          });
        const fixed = layout.filter(({ piece }) => !movable.has(piece));
        if (fixed.length > 0) {
          const data = wallMeshData(
            fixed.flatMap(({ quads }) => quads),
            { x: 0, y: 0, z: 0 },
          );
          meshes.push(this.texturedMesh(`walls.${sheet.key}`, data, material));
        }
        if (meshes.length === 0) material.dispose(false, true);
        else this.wallArt.set(sheet.key, { meshes, material });
      });
    }
  }

  /**
   * Loads `sheet`'s PNG (the one Phaser loads) as a mipmapped, anisotropic,
   * clamped texture and hands it to `ready`, unless the room changed
   * meanwhile, which drops it, or the load failed, which disposes it. A
   * texture sampled nearest with no mipmaps shows a different texel of the
   * art in each pixel it is shrunk to, which crawls as the camera moves; the
   * mipmaps average them. A pixel-art sheet still magnifies nearest, crisp.
   */
  private loadSheet(sheet: Sheet, ready: (texture: Texture) => void): void {
    const epoch = this.epoch;
    const texture = new Texture(sheetUrl(import.meta.env.BASE_URL, sheet), this.scene, {
      samplingMode:
        sheet.art === 'pixel' ? Texture.NEAREST_LINEAR_MIPLINEAR : Texture.TRILINEAR_SAMPLINGMODE,
      onLoad: () => {
        if (this.epoch === epoch) ready(texture);
        else texture.dispose();
      },
      onError: () => {
        texture.dispose();
      },
    });
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = ANISOTROPY;
  }

  /** A toon-lit material showing `texture`; with `oneSided`, only on the side its quads' normals face. */
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
    toonLit(material, this.toLight);
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
   * instances reset, a kind with none left is disposed, and the hotspots are
   * made again when the props changed. The room's boxes are not touched.
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
      this.discard(known.mesh);
      this.instanced.delete(kind);
    }
    for (const [kind, pieces] of byKind) {
      const key = pieces.map((piece) => piece.key).join(';');
      const known = this.instanced.get(kind) ?? { mesh: this.modelMesh(kind), key: '', count: 0 };
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

  /** The one source mesh of `kind`: its parts' boxes, vertex-coloured by their washes, merged into one at the origin. */
  private modelMesh(kind: FurnitureKind): Mesh {
    const mesh = this.partsMesh(`model.${kind}`, FURNITURE_MODELS[kind].parts, ORIGIN);
    this.shadows.addShadowCaster(mesh);
    this.ink(mesh);
    return mesh;
  }

  /**
   * Stands the room's modelled doors, windows, hedges and plantings. Those
   * hung from a wall piece (a door, a window) are one merged mesh parented to
   * that piece's box (a wall, or the building face a window or the roller door is set in), so the camera's cut takes them away with it, lit like
   * the walls and not outlined; the rest (a hedge, a planting) are one merged
   * mesh on the floor, which casts a shadow and is inked as furniture is.
   */
  private furnishDetails(details: readonly Detail[], plan: RoomPlan3d): void {
    this.detailCounts = countDetails(details);
    const hung = (host: string | undefined): host is string =>
      host !== undefined && this.pieces.has(host);
    const hosts = new Set(details.map((d) => d.host).filter(hung));
    for (const host of hosts) {
      const box = [...plan.walls, ...plan.furniture].find((w) => w.name === host);
      const parent = this.pieces.get(host)?.mesh;
      if (!box || !parent) continue;
      const origin = {
        x: (box.x0 + box.x1) / 2,
        y: (box.y0 + box.y1) / 2,
        z: (box.z0 + box.z1) / 2,
      };
      const parts = details.filter((d) => d.host === host).flatMap((d) => d.parts);
      const mesh = this.partsMesh(`details.${host}`, parts, origin);
      mesh.parent = parent;
      this.detailMeshes.push(mesh);
    }
    const standing = details.filter((d) => !hung(d.host)).flatMap((d) => d.parts);
    if (standing.length === 0) return;
    const mesh = this.partsMesh('details.standing', standing, ORIGIN);
    this.shadows.addShadowCaster(mesh);
    this.ink(mesh);
    this.detailMeshes.push(mesh);
  }

  /**
   * One mesh of `parts` (boxes in plan metres), each vertex-coloured by its
   * wash and positioned relative to `origin` so it can ride a box centred
   * there, on the shared colour material.
   */
  private partsMesh(name: string, parts: readonly ModelPart[], origin: Vec3): Mesh {
    const boxes = parts.map((part, n) => {
      const box = CreateBox(
        `${name}.${String(n)}`,
        { width: part.x1 - part.x0, height: part.z1 - part.z0, depth: part.y1 - part.y0 },
        this.scene,
      );
      const centre = toBabylon({
        x: (part.x0 + part.x1) / 2 - origin.x,
        y: (part.y0 + part.y1) / 2 - origin.y,
        z: (part.z0 + part.z1) / 2 - origin.z,
      });
      box.position.set(centre.x, centre.y, centre.z);
      box.bakeCurrentTransformIntoVertices();
      const { r, g, b } = washColour(part.wash);
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
    mesh.material = this.colourMaterial;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  /** Draws `mesh` with the ink outline (`INK_RGB`) in the width the canvas's size gives; Babylon outlines thin instances in the same one draw. */
  private ink(mesh: AbstractMesh): void {
    const { r, g, b } = inkUnit();
    mesh.renderOutline = true;
    mesh.outlineColor = new Color3(r, g, b);
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
