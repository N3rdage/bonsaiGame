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
import {
  CAMERA_ALPHA,
  CAMERA_BETA,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  cameraFraming,
  meshSpecs,
  playerFeet,
  toBabylon,
} from './meshes';
import { roomPlan3d, type WashKey } from './plan';

/** The page's surround colour (SURROUND in src/scenes/textStyle.ts), behind the room. */
const SURROUND = Color3.FromHexString('#3e3632');

/** What the scene reports to the test hook. */
export interface RendererSnapshot {
  readonly room: Room['key'];
  readonly meshes: number;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly player: Mesh;
  private room: Room['key'] | undefined;
  private roomMeshes: Mesh[] = [];
  private materials = new Map<WashKey, StandardMaterial>();
  private size = '';

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
      CAMERA_ALPHA,
      CAMERA_BETA,
      10,
      Vector3.Zero(),
      this.scene,
    );
    this.player = CreateCapsule(
      'player',
      { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS },
      this.scene,
    );
    this.player.material = this.material('wood');
  }

  /** The room shown and every mesh in the scene, the player's included. */
  snapshot(): RendererSnapshot | undefined {
    return this.room === undefined
      ? undefined
      : { room: this.room, meshes: this.scene.meshes.length };
  }

  /** Where the capsule stands, in plan metres. */
  playerAt(): { x: number; y: number; z: number } {
    const { x, y, z } = this.player.position;
    return { x, y: -z, z: y - PLAYER_HEIGHT / 2 };
  }

  /** Draws one frame of `room` with the player at `px` (room px), rebuilding the room's meshes if it changed. */
  frame(room: Room, px: { readonly x: number; readonly y: number }): void {
    if (this.room !== room.key) this.build(room);
    const feet = toBabylon(playerFeet(px));
    this.player.position.set(feet.x, feet.y + PLAYER_HEIGHT / 2, feet.z);
    this.fit();
    this.scene.render();
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

  /** Disposes the last room's meshes and builds `room`'s, and points the camera at it. */
  private build(room: Room): void {
    for (const mesh of this.roomMeshes) mesh.dispose();
    this.roomMeshes = [];
    const plan = roomPlan3d(room);
    for (const spec of meshSpecs(plan)) {
      const mesh = CreateBox(
        spec.name,
        { width: spec.width, height: spec.height, depth: spec.depth },
        this.scene,
      );
      mesh.position.set(spec.center.x, spec.center.y, spec.center.z);
      mesh.material = this.material(spec.wash);
      this.roomMeshes.push(mesh);
    }
    const { target, radius } = cameraFraming(plan);
    this.camera.setTarget(new Vector3(target.x, target.y, target.z));
    this.camera.alpha = CAMERA_ALPHA;
    this.camera.beta = CAMERA_BETA;
    this.camera.radius = radius;
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
