/**
 * The Babylon side of the 3D world: an engine on its own canvas laid under the
 * game's, a scene of boxes from `meshSpecs` and a capsule for the player. The
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
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import type { Season } from '../sim/seasons';
import { PALETTE } from '../world/palette';
import { sheetUrl } from '../world/assets';
import { floorTiles } from '../world/roomArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../world/resolution';
import type { Room } from '../world/shedRoom';
import { RADIUS_DEFAULT, cameraRig, cutNames, cutSpan, ease } from './camera';
import { floorLayout, floorMeshData } from './floorTiles';
import { furniturePieces, type FurniturePiece } from './furniture';
import { FURNITURE_MODELS, type FurnitureKind } from './furnitureModels';
import { lightDirectionBabylon, shadowDarkness } from './light';
import { facingOf } from './move';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  type Vec3,
  hotspotSpecs,
  meshSpecs,
  playerFeet,
  roomPx,
  toBabylon,
} from './meshes';
import type { Picked } from './tap';
import { roomPlan3d, type RoomPlan3d, type WashKey } from './plan';
import { inkUnit, outlineWidthMetres } from './toon';
import { toonLit } from './toonPlugin';
import { treeMeshData, type WorldMeshData } from './treeMeshes';
import type { TreeStand } from './trees';
import { weatherKind, weatherSprites, type WeatherField } from './weather';

/** The page's surround colour (SURROUND in src/scenes/textStyle.ts), behind the room. */
const SURROUND = Color3.FromHexString('#3e3632');

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
  /** The way the capsule faces: its last step's heading in the plan, radians (0 east, pi/2 south). */
  readonly facing: number;
  /** True while something casts a shadow onto the floor. */
  readonly shadows: boolean;
  /** True while the lit meshes are lit through the toon ramp and inked. */
  readonly toon: boolean;
  /** The key of the sheet the floor's tiles are cut from, null until its texture has loaded. */
  readonly floorSheet: string | null;
  /** The kind of weather drawn (petals, fireflies, leaves, snow), null where none is. */
  readonly weather: string | null;
  /** Each prop's hotspot id and the screen point of its middle in game px (480 x 270), where a tap picks it. */
  readonly hotspots: readonly { readonly id: string; readonly x: number; readonly y: number }[];
}

/** The edge of the box on the capsule's front that shows which way it faces, metres. */
const NOSE = 0.2;

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
  private readonly player: Mesh;
  /** The plan heading the capsule faces; a new session faces away from the default camera, north. */
  private facing = -Math.PI / 2;
  /** Where the capsule stood last frame, plan metres. */
  private lastFeet: { x: number; y: number } | undefined;
  private room: Room['key'] | undefined;
  private plan: RoomPlan3d | undefined;
  private pieces = new Map<string, Piece>();
  private floorArt: FloorArt | undefined;
  /** The invisible boxes taps pick props by, each under its prop's key. */
  private hotspots = new Map<AbstractMesh, string>();
  /** The prop keys the hotspots were made for, so a placed item's spots add or drop theirs. */
  private hotspotKey = '';
  /** The furniture models in use, by kind. */
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
    // One room at a time is a few metres across and the camera always sees all of it, so a single
    // shadow map covers it at a fine texel size; cascades would only split that map for no gain.
    this.shadows = new ShadowGenerator(2048, sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.darkness = shadowDarkness();
    this.camera = new ArcRotateCamera(
      'camera',
      cameraRig.alpha,
      cameraRig.beta,
      cameraRig.radius,
      Vector3.Zero(),
      this.scene,
    );
    this.player = CreateCapsule(
      'player',
      { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS },
      this.scene,
    );
    this.player.material = this.material('wood');
    this.shadows.addShadowCaster(this.player);
    this.ink(this.player);
    const nose = CreateBox('player.nose', { size: NOSE }, this.scene);
    nose.material = this.material('leafOrange');
    nose.parent = this.player;
    this.ink(nose);
    nose.position.set(0, PLAYER_HEIGHT / 4, PLAYER_RADIUS);
    this.colourMaterial = new StandardMaterial('colours', this.scene);
    this.colourMaterial.specularColor = Color3.Black();
    toonLit(this.colourMaterial, this.toLight);
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
      shadows: (this.shadows.getShadowMap()?.renderList?.length ?? 0) > 0,
      toon: true,
      floorSheet: this.floorArt?.sheet ?? null,
      weather: this.weatherKind,
      hotspots: this.hotspotPoints(),
    };
  }

  /** The screen point of each hotspot's middle, in game px. */
  private hotspotPoints(): RendererSnapshot['hotspots'] {
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const view = this.camera.viewport.toGlobal(width, height);
    const transform = this.scene.getTransformMatrix();
    return [...this.hotspots].map(([mesh, id]) => {
      const at = Vector3.Project(mesh.position, Matrix.IdentityReadOnly, transform, view);
      return { id, x: (at.x / width) * GAME_WIDTH, y: (at.y / height) * GAME_HEIGHT };
    });
  }

  /**
   * What a tap at (`u`, `v`), fractions of the game canvas, lands on: a prop's
   * hotspot box first, else the floor. `scene.pick` takes CSS px of the canvas,
   * which lies exactly over the game's.
   */
  pick(u: number, v: number): Picked | undefined {
    const x = u * this.canvas.clientWidth;
    const y = v * this.canvas.clientHeight;
    const prop = this.scene.pick(x, y, (mesh) => this.hotspots.has(mesh));
    const hotspot = prop.pickedMesh ? this.hotspots.get(prop.pickedMesh) : undefined;
    if (hotspot !== undefined) return { hotspot };
    const floor = this.pieces.get('floor')?.mesh;
    const ground = this.scene.pick(x, y, (mesh) => mesh === floor);
    return ground.pickedPoint ? { floor: roomPx(ground.pickedPoint) } : undefined;
  }

  /** Where the capsule stands, in plan metres. */
  playerAt(): { x: number; y: number; z: number } {
    const { x, y, z } = this.player.position;
    return { x, y: -z, z: y - PLAYER_HEIGHT / 2 };
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
    if (this.lastFeet && !fresh) {
      this.facing = facingOf(plan.x - this.lastFeet.x, plan.y - this.lastFeet.y, this.facing);
    }
    this.lastFeet = { x: plan.x, y: plan.y };
    // The nose sits on the capsule's local +z, which a turn of theta about y points along (sin, cos) in x and z.
    this.player.rotation.y = this.facing + Math.PI / 2;
    const feet = toBabylon(plan);
    const middle = feet.y + PLAYER_HEIGHT / 2;
    this.player.position.set(feet.x, middle, feet.z);
    this.follow({ x: feet.x, y: middle, z: feet.z }, fresh);
    this.cutAway(plan);
    this.fit();
    this.scene.render();
  }

  /** Eases the camera toward the player and the session's rig; a new room snaps the look-at point to the player. */
  private follow(goal: { x: number; y: number; z: number }, snap: boolean): void {
    const now = performance.now();
    const dt = snap ? Infinity : now - this.lastFrame;
    this.lastFrame = now;
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
    this.setHotspots(room, plan);
    this.room = room.key;
    this.tile(room);
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
   * nearest filtered with no mipmaps, toon lit and shadowed like the floor
   * under it. A texture that arrives after the room changed is dropped.
   */
  private tile(room: Room): void {
    const sheet = floorTiles(room).sheet;
    const texture = new Texture(sheetUrl(import.meta.env.BASE_URL, sheet), this.scene, {
      noMipmap: true,
      samplingMode: Texture.NEAREST_SAMPLINGMODE,
      onLoad: () => {
        if (this.room !== room.key || this.floorArt) {
          texture.dispose();
          return;
        }
        const { width, height } = texture.getSize();
        const data = floorMeshData(floorLayout(room, width, height).quads);
        const mesh = new Mesh('floor.tiles', this.scene);
        const vertices = new VertexData();
        vertices.positions = data.positions;
        vertices.normals = data.normals;
        vertices.uvs = data.uvs;
        vertices.indices = data.indices;
        vertices.applyToMesh(mesh);
        const material = new StandardMaterial('floor.tiles', this.scene);
        material.diffuseTexture = texture;
        material.specularColor = Color3.Black();
        material.backFaceCulling = false;
        toonLit(material, this.toLight);
        mesh.material = material;
        mesh.receiveShadows = true;
        mesh.isPickable = false;
        this.floorArt = { mesh, material, sheet: sheet.key };
      },
    });
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
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
    const boxes = FURNITURE_MODELS[kind].parts.map((part, n) => {
      const box = CreateBox(
        `model.${kind}.${String(n)}`,
        { width: part.x1 - part.x0, height: part.z1 - part.z0, depth: part.y1 - part.y0 },
        this.scene,
      );
      const centre = toBabylon({
        x: (part.x0 + part.x1) / 2,
        y: (part.y0 + part.y1) / 2,
        z: (part.z0 + part.z1) / 2,
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
    if (!mesh) throw new Error(`model ${kind} has no parts`);
    mesh.name = `model.${kind}`;
    mesh.material = this.colourMaterial;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    this.shadows.addShadowCaster(mesh);
    this.ink(mesh);
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
