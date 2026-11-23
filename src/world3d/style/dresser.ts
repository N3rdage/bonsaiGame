/**
 * Backlog #446 (style frames, throwaway): the Babylon side of a take. It
 * owns the take's materials (every one lit through stylePlugin.ts), paints
 * its textures (textures.ts) and dresses the lounge: walls, the hallway
 * block and the floor take world-mapped painted textures, the kitchen its
 * tiles, the 2D room's boxy fireplace, side table and counter are hidden
 * under their remodelled versions, and the set dressing (lounge.ts) is built
 * from rounded shapes, merged into one mesh per material so the room costs a
 * handful of draw calls.
 */

import { Constants } from '@babylonjs/core/Engines/constants';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import { lightDirection } from '../light';
import { toBabylon, type Vec3 } from '../meshes';
import {
  KITCHEN_TILES,
  LOUNGE_DRESSING,
  LOUNGE_GLOWS,
  REMODELLED_SHEETS,
  type Mat,
  type Shape,
} from './lounge';
import { rigOf, type LightRig, type Look } from './looks';
import type { TimeOfDay } from './params';
import { roundedBox } from './roundedBox';
import { styleLit, type StyleLight } from './stylePlugin';
import {
  DETAIL_TILE,
  FLOOR_TILE,
  TILES_TILE,
  WALL_TILE,
  detailCanvas,
  floorCanvas,
  paintingCanvas,
  patchCanvas,
  rugCanvas,
  tilesCanvas,
  wallCanvas,
} from './textures';

type V3 = [number, number, number];

/** `&lite=1`: the bench's cost probe, walls and models not receiving shadows and coarser shapes. */
const LITE = new URLSearchParams(window.location.search).get('lite') === '1';

function unit(hex: number): V3 {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
const times = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const babylon = (p: readonly [number, number, number]): V3 => {
  const b = toBabylon({ x: p[0], y: p[1], z: p[2] });
  return [b.x, b.y, b.z];
};

/** A piece of the room the dresser can retexture or hide. */
export interface RoomPiece {
  readonly mesh: Mesh;
}

export class Dresser {
  readonly light: StyleLight;
  readonly rig: LightRig;
  private readonly materials = new Map<string, StandardMaterial>();
  private meshes: Mesh[] = [];
  private textures: Texture[] = [];

  constructor(
    private readonly scene: Scene,
    readonly look: Look,
    readonly time: TimeOfDay,
    private readonly shadows: ShadowGenerator,
    toLight: Vec3,
  ) {
    this.rig = rigOf(look, time);
    const rig = this.rig;
    this.light = {
      toLight: [toLight.x, toLight.y, toLight.z],
      sun: times(unit(rig.sun), rig.sunPower),
      sky: times(unit(rig.skyFill), 0.5),
      ground: times(unit(rig.groundFill), 0.5),
      glows: [
        { at: [...babylon(LOUNGE_GLOWS.fire), 3.6], colour: times(unit(rig.fire), rig.firePower) },
        { at: [...babylon(LOUNGE_GLOWS.lamp), 3.2], colour: times(unit(rig.lamp), rig.lampPower) },
        {
          at: [...babylon(LOUNGE_GLOWS.candles), 1.2],
          colour: times(unit(rig.fire), rig.lampPower * 0.5),
        },
      ],
    };
    scene.clearColor = Color4.FromColor3(Color3.FromHexString(hex(rig.clear)), 1);
    const ip = scene.imageProcessingConfiguration;
    ip.isEnabled = true;
    ip.exposure = rig.exposure;
    ip.contrast = rig.contrast;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = rig.vignette;
    ip.vignetteStretch = 0.4;
    ip.vignetteColor = Color4.FromHexString(`${hex(this.time === 'dusk' ? 0x140c1c : 0x2a1a14)}ff`);
    ip.vignetteCameraFov = 0.8;
  }

  /** The ramp and banding every lit material of the take shares. */
  private lit(material: StandardMaterial, emit = 0, litK = 1): StandardMaterial {
    material.specularColor = Color3.Black();
    styleLit(material, this.light, {
      ramp: this.look.ramp,
      soft: this.look.soft,
      banded: this.look.hand === 'paper',
      lit: litK,
      emit,
    });
    return material;
  }

  /** A plain lit material of colour `hex` (a wash), shared by name. */
  wash(name: string, colour: Color3): StandardMaterial {
    const known = this.materials.get(`wash.${name}`);
    if (known) return known;
    const m = new StandardMaterial(`style.wash.${name}`, this.scene);
    m.diffuseColor = colour;
    this.materials.set(`wash.${name}`, this.lit(m));
    return m;
  }

  /** The take's material for vertex-coloured models: the player, trees, details. */
  colours(): StandardMaterial {
    return this.wash('colours', Color3.White());
  }

  private textured(
    key: string,
    source: HTMLCanvasElement,
    tileMetres: number,
    emit = 0,
    litK = 1,
  ): StandardMaterial {
    const known = this.materials.get(key);
    if (known) return known;
    const texture = new DynamicTexture(
      `style.${key}`,
      source,
      this.scene,
      true,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.update();
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.uScale = 1 / tileMetres;
    texture.vScale = 1 / tileMetres;
    texture.anisotropicFilteringLevel = 4;
    const m = new StandardMaterial(`style.${key}`, this.scene);
    m.diffuseTexture = texture;
    this.textures.push(texture);
    this.materials.set(key, this.lit(m, emit, litK));
    return m;
  }

  private matFor(mat: Mat): StandardMaterial {
    const look = this.look;
    switch (mat) {
      case 'wood':
      case 'fabric':
      case 'plain':
      case 'brick':
        return this.textured(mat, detailCanvas(look, mat), DETAIL_TILE[mat]);
      case 'shade':
        return this.textured(
          'shade',
          detailCanvas(look, 'fabric'),
          DETAIL_TILE.fabric,
          this.time === 'dusk' ? 0.95 : 0.15,
        );
      case 'glow':
        return this.textured(
          'glow',
          detailCanvas(look, 'plain'),
          4,
          this.time === 'dusk' ? 1 : 1.05,
          0,
        );
      case 'rug':
        return this.textured('rug', rugCanvas(look), 1);
      case 'painting':
        return this.textured('painting', paintingCanvas(look, 1), 1);
      case 'painting2':
        return this.textured('painting2', paintingCanvas(look, 2), 1);
      case 'painting3':
        return this.textured('painting3', paintingCanvas(look, 3), 1);
    }
  }

  /**
   * Dresses the lounge: retextures `pieces`' walls, block and floor, hides
   * the boxes the dressing remodels, lays the kitchen tiles and the sunlit
   * patches, and stands the set dressing.
   */
  dress(pieces: ReadonlyMap<string, RoomPiece>): void {
    this.clear();
    const wall = this.textured('wall', wallCanvas(this.look), 1);
    const wallTex = wall.diffuseTexture as Texture;
    wallTex.uScale = 1;
    wallTex.vScale = 1;
    wallTex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const floor = this.textured('floor', floorCanvas(this.look), FLOOR_TILE);
    for (const [name, { mesh }] of pieces) {
      if (name === 'floor') {
        worldUvs(mesh, 'floor');
        mesh.material = floor;
        mesh.receiveShadows = true;
      } else if (name.startsWith('wall') || name.includes('spr_paper')) {
        worldUvs(mesh, 'wall');
        mesh.material = wall;
        mesh.receiveShadows = !LITE;
        mesh.renderOutline = false;
      } else if (REMODELLED_SHEETS.some((sheet) => name.endsWith(sheet))) {
        mesh.isVisible = false;
        mesh.renderOutline = false;
        this.shadows.removeShadowCaster(mesh);
      }
    }
    // Kitchen tiles.
    const { x0, x1, y0, y1 } = KITCHEN_TILES;
    const tiles = this.quad(
      'style.kitchen',
      [x0, y0, 0.004],
      [x1, y0, 0.004],
      [x1, y1, 0.004],
      [x0, y1, 0.004],
      true,
    );
    tiles.material = this.textured('tiles', tilesCanvas(this.look), TILES_TILE);
    tiles.receiveShadows = true;
    this.meshes.push(tiles);
    this.patches();
    this.stand(LOUNGE_DRESSING);
  }

  /** The sunlit patch each window throws on the floor, by the shared light. */
  private patches(): void {
    if (this.rig.patch <= 0) return;
    const d = lightDirection();
    const onFloor = (x: number, z: number): [number, number, number] => {
      const t = z / -d.z;
      return [x + d.x * t, 2 + d.y * t, 0.018];
    };
    const tex = new DynamicTexture('style.patch', patchCanvas(), this.scene, true);
    tex.update();
    this.textures.push(tex);
    const m = new StandardMaterial('style.patch', this.scene);
    m.disableLighting = true;
    m.emissiveTexture = tex;
    m.emissiveColor = Color3.FromHexString(hex(this.rig.sun));
    m.alpha = this.rig.patch;
    m.alphaMode = Constants.ALPHA_ADD;
    m.disableDepthWrite = true;
    this.materials.set('patch', m);
    for (const [a, b] of [
      [5.58, 6.42],
      [9.08, 9.92],
    ] as const) {
      const q = this.quad(
        'style.patch',
        onFloor(a, 0.98),
        onFloor(b, 0.98),
        onFloor(b, 1.92),
        onFloor(a, 1.92),
        false,
      );
      q.material = m;
      this.meshes.push(q);
    }
  }

  /** A quad over four plan points, its UVs in metres (`world`) or 0..1 over it. */
  private quad(name: string, a: V3, b: V3, c: V3, e: V3, world: boolean): Mesh {
    const pts = [a, b, c, e].map(babylon);
    const mesh = new Mesh(name, this.scene);
    const v = new VertexData();
    v.positions = pts.flat();
    v.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    v.uvs = world ? pts.flatMap((p) => [p[0], p[2]]) : [0, 0, 1, 0, 1, 1, 0, 1];
    v.indices = [0, 2, 1, 0, 3, 2];
    v.applyToMesh(mesh);
    mesh.isPickable = false;
    return mesh;
  }

  /** Builds `shapes`, merged into one mesh per material and per flat or solid. */
  private stand(shapes: readonly Shape[]): void {
    const groups = new Map<string, Mesh[]>();
    shapes.forEach((shape, n) => {
      const mesh = this.shapeMesh(shape, n);
      const key = `${shape.mat}|${shape.flat ? 'flat' : 'solid'}`;
      groups.set(key, [...(groups.get(key) ?? []), mesh]);
    });
    for (const [key, list] of groups) {
      const [mat, kind] = key.split('|') as [Mat, string];
      const merged = Mesh.MergeMeshes(list, true, true);
      if (!merged) continue;
      merged.name = `style.${key}`;
      merged.material = this.matFor(mat);
      merged.isPickable = false;
      merged.receiveShadows = mat !== 'glow' && (!LITE || mat === 'rug');
      if (kind === 'solid') {
        this.shadows.addShadowCaster(merged);
        if (this.look.inkPx > 0) {
          merged.renderOutline = true;
          merged.outlineColor = Color3.FromHexString(hex(this.look.ink));
        }
      }
      this.meshes.push(merged);
    }
  }

  private shapeMesh(shape: Shape, n: number): Mesh {
    const [w, d, h] = shape.size;
    const name = `style.shape.${String(n)}`;
    let mesh: Mesh;
    if (shape.kind === 'box') {
      const data = roundedBox(w, h, d, shape.r ?? 0.02, LITE ? 1 : 3);
      mesh = new Mesh(name, this.scene);
      const v = new VertexData();
      v.positions = data.positions;
      v.normals = data.normals;
      v.indices = data.indices;
      v.applyToMesh(mesh, true);
    } else if (shape.kind === 'ball') {
      mesh = CreateSphere(
        name,
        { segments: LITE ? 6 : 10, diameterX: w, diameterY: h, diameterZ: d },
        this.scene,
      );
    } else {
      const lie = shape.lie;
      const length = lie === 'x' ? w : lie === 'y' ? d : h;
      const across = lie === 'x' ? h : w;
      const top = shape.kind === 'cone' ? (shape.top ?? 0.5) : 1;
      mesh = CreateCylinder(
        name,
        {
          height: length,
          diameterBottom: across,
          diameterTop: across * top,
          tessellation: LITE ? 10 : 18,
        },
        this.scene,
      );
      if (lie === 'x') mesh.rotation.z = Math.PI / 2;
      else if (lie === 'y') mesh.rotation.x = Math.PI / 2;
      else if (Math.abs(d - w) > 1e-6) mesh.scaling.z = d / w;
      mesh.bakeCurrentTransformIntoVertices();
    }
    const [x, y, z] = shape.at;
    const centre = babylon([x, y, z + h / 2]);
    mesh.position.set(...centre);
    mesh.rotation.set(shape.tilt?.[0] ?? 0, shape.turn ?? 0, shape.tilt?.[1] ?? 0);
    mesh.bakeCurrentTransformIntoVertices();
    const colour = unit(
      shape.colour === 'sky' ? this.rig.sky : (this.look.colours[shape.colour] ?? 0xff00ff),
    );
    const count = mesh.getTotalVertices();
    const rgba = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) rgba.set([...colour, 1], i * 4);
    mesh.setVerticesData(VertexBuffer.ColorKind, rgba);
    if (shape.mat === 'rug' || shape.mat.startsWith('painting')) planarUvs(mesh);
    else worldUvs(mesh, 'detail');
    return mesh;
  }

  /** Disposes the dressing's meshes (the materials and textures stay for the next visit). */
  clear(): void {
    for (const mesh of this.meshes) {
      this.shadows.removeShadowCaster(mesh);
      mesh.dispose();
    }
    this.meshes = [];
  }

  dispose(): void {
    this.clear();
    for (const m of this.materials.values()) m.dispose(false, true);
    for (const t of this.textures) t.dispose();
    this.materials.clear();
    this.textures = [];
  }
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/**
 * Box-projected UVs from the mesh's world positions, in metres: a wall's
 * horizontal run and its height over the wall texture's span (its top face
 * on the texture's top row, the dark cut of the wall), the floor's plan
 * position, a model's two axes across its face.
 */
function worldUvs(mesh: Mesh, mode: 'wall' | 'floor' | 'detail'): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const nor = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!pos || !nor) return;
  const o = mesh.position;
  const uvs = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const x = (pos[i * 3] ?? 0) * mesh.scaling.x + o.x;
    const y = (pos[i * 3 + 1] ?? 0) * mesh.scaling.y + o.y;
    const z = (pos[i * 3 + 2] ?? 0) * mesh.scaling.z + o.z;
    const nx = Math.abs(nor[i * 3] ?? 0);
    const ny = Math.abs(nor[i * 3 + 1] ?? 0);
    const nz = Math.abs(nor[i * 3 + 2] ?? 0);
    let u: number;
    let v: number;
    if (mode === 'wall') {
      if (ny > 0.5) {
        u = x / WALL_TILE.u;
        v = 0.999;
      } else {
        u = (nx > nz ? z : x) / WALL_TILE.u;
        v = Math.min(y / WALL_TILE.v, 0.99);
      }
    } else if (mode === 'floor') {
      u = x;
      v = z;
    } else if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

/** UVs 0..1 across the mesh's two widest axes: a rug's top, a painting's face. */
function planarUvs(mesh: Mesh): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!pos) return;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) {
    const a = i % 3;
    min[a] = Math.min(min[a] ?? 0, pos[i] ?? 0);
    max[a] = Math.max(max[a] ?? 0, pos[i] ?? 0);
  }
  const ext = [0, 1, 2].map((a) => (max[a] ?? 0) - (min[a] ?? 0));
  const thin = ext.indexOf(Math.min(...ext));
  const [ua, va] = thin === 0 ? [2, 1] : thin === 1 ? [0, 2] : [0, 1];
  const uvs = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    uvs[i * 2] = ((pos[i * 3 + ua] ?? 0) - (min[ua] ?? 0)) / Math.max(ext[ua] ?? 0, 1e-6);
    uvs[i * 2 + 1] = ((pos[i * 3 + va] ?? 0) - (min[va] ?? 0)) / Math.max(ext[va] ?? 0, 1e-6);
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}
