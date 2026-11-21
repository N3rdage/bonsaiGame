/**
 * The Babylon side of the 3D world: an engine on its own canvas laid under the
 * game's, a scene of boxes from `meshSpecs` and a capsule for the player. The
 * only module that imports Babylon, and only world3d.ts reaches it, through a
 * dynamic import, so a player with the setting off downloads none of it. The
 * game stays the 2D game's Phaser scene: this draws what it is told.
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { PALETTE } from '../world/palette';
import type { Room } from '../world/shedRoom';
import { cameraRig, cutNames, cutSpan, ease } from './camera';
import { facingOf } from './move';
import { PLAYER_HEIGHT, PLAYER_RADIUS, meshSpecs, playerFeet, toBabylon } from './meshes';
import { roomPlan3d, type RoomPlan3d, type WashKey } from './plan';

/** The page's surround colour (SURROUND in src/scenes/textStyle.ts), behind the room. */
const SURROUND = Color3.FromHexString('#3e3632');

/** What the scene reports to the test hook. */
export interface RendererSnapshot {
  readonly room: Room['key'];
  readonly meshes: number;
  /** Where the camera is now, eased toward the rig. */
  readonly camera: { readonly alpha: number; readonly beta: number; readonly radius: number };
  /** The names of the pieces cut away to the skirting, sorted. */
  readonly cut: readonly string[];
  /** The way the capsule faces: its last step's heading in the plan, radians (0 east, pi/2 south). */
  readonly facing: number;
}

/** The edge of the box on the capsule's front that shows which way it faces, metres. */
const NOSE = 0.2;

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
  private readonly player: Mesh;
  /** The plan heading the capsule faces; a new session faces away from the default camera, north. */
  private facing = -Math.PI / 2;
  /** Where the capsule stood last frame, plan metres. */
  private lastFeet: { x: number; y: number } | undefined;
  private room: Room['key'] | undefined;
  private plan: RoomPlan3d | undefined;
  private pieces = new Map<string, Piece>();
  private cut: string[] = [];
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
    new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene).intensity = 0.7;
    const sun = new DirectionalLight('sun', new Vector3(1, -2, -1), this.scene);
    sun.intensity = 0.6;
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
    const nose = CreateBox('player.nose', { size: NOSE }, this.scene);
    nose.material = this.material('leafOrange');
    nose.parent = this.player;
    nose.position.set(0, PLAYER_HEIGHT / 4, PLAYER_RADIUS);
  }

  /** The room shown and every mesh in the scene, the player's included. */
  snapshot(): RendererSnapshot | undefined {
    if (this.room === undefined) return undefined;
    const { alpha, beta, radius } = this.camera;
    return {
      room: this.room,
      meshes: this.scene.meshes.length,
      camera: { alpha, beta, radius },
      cut: this.cut,
      facing: this.facing,
    };
  }

  /** Where the capsule stands, in plan metres. */
  playerAt(): { x: number; y: number; z: number } {
    const { x, y, z } = this.player.position;
    return { x, y: -z, z: y - PLAYER_HEIGHT / 2 };
  }

  /** Draws one frame of `room` with the player at `px` (room px), rebuilding the room's meshes if it changed. */
  frame(room: Room, px: { readonly x: number; readonly y: number }): void {
    const fresh = this.room !== room.key;
    if (fresh) this.build(room);
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

  /** Removes the canvas and everything on the GPU, and gives the game's canvas back its style. */
  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
    Object.assign(this.host.style, { position: '', zIndex: '' });
  }

  private material(wash: WashKey): StandardMaterial {
    const known = this.materials.get(wash);
    if (known) return known;
    const material = new StandardMaterial(`wash.${wash}`, this.scene);
    material.diffuseColor = Color3.FromHexString(`#${PALETTE[wash].toString(16).padStart(6, '0')}`);
    material.specularColor = Color3.Black();
    this.materials.set(wash, material);
    return material;
  }

  /** Disposes the last room's meshes and builds `room`'s. */
  private build(room: Room): void {
    for (const { mesh } of this.pieces.values()) mesh.dispose();
    this.pieces.clear();
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
      this.pieces.set(spec.name, {
        mesh,
        z0: spec.center.y - spec.height / 2,
        z1: spec.center.y + spec.height / 2,
      });
    }
    this.room = room.key;
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
  }
}
