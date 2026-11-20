/**
 * The engine comparison's Babylon.js page (backlog #378, engine-babylon.html):
 * the same shared scene as the Three.js page (../scene.ts, ../meshData.ts,
 * ../bonsai.ts), drawn with toon-lit, ink-outlined meshes under one
 * shadow-casting sun, the player as the 2D game's Inked sprite on an upright
 * quad turned to the camera, and the occluders in front of the player faded.
 * Input, walking, the camera, the fades, the overlay, the benchmark and the
 * test hook are the shared session's (../session.ts); this file only draws.
 *
 * Babylon has no toon material in core, so the fills are StandardMaterials
 * with a material plugin that swaps their diffuse term for the viewer's
 * stepped ramp (Babylon's CUSTOMUSERLIGHTING hook), keeping Babylon's own
 * shadow sampling. The ink hull is the Three page's shader, ported to a
 * Babylon ShaderMaterial (Babylon's built-in renderOutline pushes out in
 * world units, not screen pixels, so it would not match the viewer's ink).
 */

import { Camera } from '@babylonjs/core/Cameras/camera';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
// Importing the generator also registers its scene component, which draws the shadow maps.
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Material } from '@babylonjs/core/Materials/material';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Scene } from '@babylonjs/core/scene';
import barkUrl from '../../viewer/bark.png';
import foliageUrl from '../../viewer/foliage.png';
import type { Rgb } from '../../viewer/potPalette';
import {
  INK_RGB,
  OUTLINE_DEPTH,
  OUTLINE_WIDTH_PX,
  SURROUND_RGB,
  TOON_RAMP,
} from '../../viewer/toon';
import { SHEETS, playerFrame, sheetUrl } from '../../world/assets';
import { bonsaiMeshes, type TreeMesh } from '../bonsai';
import { HULL_VERTEX, INK_FRAGMENT, WASH_RGB, onPaper } from '../ink';
import { sceneBatches, type MeshArrays } from '../meshData';
import { FADED_OPACITY } from '../occlusion';
import { webglRendererName } from '../overlay';
import { PLAYER_HEIGHT, buildScene, toRender, type MaterialKey, type OccluderKey } from '../scene';
import { SpikeSession } from '../session';
import { tileCanvas } from '../tiles';

/** Palette bytes reach the screen untouched: Babylon's StandardMaterial does no colour space conversion. */
const raw = ({ r, g, b }: Rgb): Color3 => new Color3(r / 255, g / 255, b / 255);

/** How much a cast shadow darkens what it falls on, as the Three page's. */
const SHADOW_STRENGTH = 0.3;
/** Half the side of the square the sun's shadow map covers round the player, metres. */
const SHADOW_HALF = 14;
const FOV = 50;

const canvasEl = document.getElementById('spike-canvas');
if (!(canvasEl instanceof HTMLCanvasElement))
  throw new Error('engine-babylon.html is missing #spike-canvas');
const canvas = canvasEl;

// Antialiased, at the device's pixel ratio, as the Three page's renderer.
const engine = new Engine(canvas, true, { stencil: false }, true);
const scene = new Scene(engine);
// The shared meshes are in a right-handed, y-up frame (scene.ts `toRender`).
scene.useRightHandedSystem = true;
scene.clearColor = Color4.FromColor3(raw(SURROUND_RGB));
scene.imageProcessingConfiguration.isEnabled = false;
scene.skipPointerMovePicking = true;

const camera = new TargetCamera('camera', Vector3.Zero(), scene);
camera.fov = (FOV * Math.PI) / 180;
camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
camera.minZ = 0.1;
camera.maxZ = 200;

const instrumentation = new SceneInstrumentation(scene);
const data = buildScene();
const session = new SpikeSession(data, {
  engine: 'babylon',
  canvas,
  drawCalls: () => instrumentation.drawCallsCounter.current,
  rendererName: () => webglRendererName(engine._gl),
});

const toSun = toRender(data.light);
const toSunLength = Math.hypot(toSun.x, toSun.y, toSun.z);

/**
 * The toon ramp: the light's N.L from -1 to 1 cut into TOON_RAMP's bands, as
 * MeshToonMaterial samples its gradient map, times Babylon's own shadow term.
 * The light is fixed in the world, so its direction is a constant.
 */
const rampGlsl = TOON_RAMP.map((level) => (level / 255).toFixed(4));
const TOON_GLSL = /* glsl */ `
const vec3 toonLight = vec3(${[toSun.x, toSun.y, toSun.z].map((c) => (c / toSunLength).toFixed(6)).join(', ')});
float toonLevel(vec3 n) {
  float band = clamp(floor((dot(n, toonLight) * 0.5 + 0.5) * ${TOON_RAMP.length.toFixed(1)}), 0.0, ${(TOON_RAMP.length - 1).toFixed(1)});
  ${rampGlsl
    .slice(0, -1)
    .map((level, i) => `if (band < ${(i + 1).toFixed(1)}) return ${level};`)
    .join('\n  ')}
  return ${rampGlsl[rampGlsl.length - 1] ?? '1.0'};
}
#define computeCustomDiffuseLighting(info, base, sh) vec3(toonLevel(normalW) * (sh))
#define computeCustomSpecularLighting(info, base, sh) vec3(0.0)
`;

class ToonPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'Toon', 200, { CUSTOMUSERLIGHTING: false }, true, true);
  }
  override prepareDefines(defines: MaterialDefines): void {
    defines.CUSTOMUSERLIGHTING = true;
  }
  override getClassName(): string {
    return 'ToonPlugin';
  }
  override getCustomCode(shaderType: string): Record<string, string> | null {
    return shaderType === 'fragment' ? { CUSTOM_FRAGMENT_DEFINITIONS: TOON_GLSL } : null;
  }
}

function toonMaterial(name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = Color3.Black();
  m.ambientColor = Color3.Black();
  new ToonPlugin(m);
  return m;
}

function buildMesh(name: string, m: MeshArrays | TreeMesh): Mesh {
  const mesh = new Mesh(name, scene);
  // The shared triangles wind counter-clockwise seen from outside (meshData.ts FACES); a
  // right-handed Babylon scene's meshes default to clockwise.
  mesh.sideOrientation = Material.CounterClockWiseSideOrientation;
  const vd = new VertexData();
  vd.positions = m.positions;
  vd.normals = m.normals;
  vd.uvs = m.uvs;
  vd.indices = m.indices;
  if ('colors' in m) {
    // Babylon's colour attribute is RGBA.
    const rgba = new Float32Array((m.colors.length / 3) * 4);
    for (let v = 0; v < m.colors.length / 3; v++) {
      rgba.set(m.colors.subarray(v * 3, v * 3 + 3), v * 4);
      rgba[v * 4 + 3] = 1;
    }
    vd.colors = rgba;
  }
  vd.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}

/** Inked art's bytes pass through untouched and scale smoothly, as the viewer's textures do. */
function inkedTexture<T extends Texture>(t: T, wrap: number): T {
  t.wrapU = wrap;
  t.wrapV = wrap;
  t.anisotropicFilteringLevel = engine.getCaps().maxAnisotropy;
  return t;
}

function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const t: Texture = new Texture(url, scene, {
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
      onLoad: () => {
        resolve(t);
      },
      onError: (message) => {
        reject(new Error(`could not load ${url}: ${message ?? ''}`));
      },
    });
  });
}

// The ink: the Three page's hull shader with Babylon's matrix names, its width set in clip units on every resize.
const outlineWidth = new Vector2();
const BABYLON_HULL_VERTEX = `precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldView;
uniform mat4 projection;
#define modelViewMatrix worldView
#define projectionMatrix projection
#define normalMatrix mat3(worldView)
${HULL_VERTEX}`;
const BABYLON_INK_FRAGMENT = `precision highp float;
${INK_FRAGMENT}`;
const hullMaterials: ShaderMaterial[] = [];
function hullMaterial(): ShaderMaterial {
  const m = new ShaderMaterial(
    'hull',
    scene,
    { vertexSource: BABYLON_HULL_VERTEX, fragmentSource: BABYLON_INK_FRAGMENT },
    {
      attributes: ['position', 'normal'],
      uniforms: ['worldView', 'projection', 'uWidth', 'uDepth', 'uInk'],
    },
  );
  m.setFloat('uDepth', OUTLINE_DEPTH);
  m.setColor3('uInk', raw(INK_RGB));
  m.setVector2('uWidth', outlineWidth);
  // Back faces only, as the Three page's BackSide.
  m.cullBackFaces = false;
  hullMaterials.push(m);
  return m;
}

/** Each occluder's materials and ink meshes, so it fades as one: fills turn see-through, ink hides. */
const occluderParts = new Map<
  OccluderKey,
  { fills: StandardMaterial[]; inks: (Mesh | LinesMesh)[] }
>();
function partsOf(key: OccluderKey): { fills: StandardMaterial[]; inks: (Mesh | LinesMesh)[] } {
  let parts = occluderParts.get(key);
  if (!parts) {
    parts = { fills: [], inks: [] };
    occluderParts.set(key, parts);
  }
  return parts;
}

// The sun: the rooms' one light, fixed in the world; its shadow map follows the player.
const sun = new DirectionalLight(
  'sun',
  new Vector3(-toSun.x, -toSun.y, -toSun.z).normalize(),
  scene,
);
sun.specular = Color3.Black();
sun.autoUpdateExtends = false;
sun.autoCalcShadowZBounds = false;
sun.shadowOrthoScale = 0;
sun.orthoLeft = -SHADOW_HALF;
sun.orthoRight = SHADOW_HALF;
sun.orthoTop = SHADOW_HALF;
sun.orthoBottom = -SHADOW_HALF;
sun.shadowMinZ = 1;
sun.shadowMaxZ = 80;
const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.setDarkness(1 - SHADOW_STRENGTH);
shadows.bias = 0.0005;
shadows.normalBias = 0.02;
// A faded occluder still casts, as on the Three page (Babylon skips see-through casters by default).
shadows.transparencyShadow = true;

const batches = sceneBatches(data);
const fillMaterials: { material: StandardMaterial; key: MaterialKey }[] = [];
for (const batch of batches.fills) {
  const spec = data.materials[batch.material];
  // Textured faces are the sheet's own colours; untextured ones their wash on paper.
  const material = toonMaterial(
    batch.material,
    spec.sheet ? Color3.White() : raw(onPaper(WASH_RGB[spec.wash])),
  );
  // Pushed back a little so the crease lines on its edges draw over it.
  material.zOffset = 1;
  material.zOffsetUnits = 1;
  fillMaterials.push({ material, key: batch.material });
  const mesh = buildMesh(batch.material, batch.mesh);
  mesh.material = material;
  if (batch.ground) mesh.receiveShadows = true;
  else shadows.addShadowCaster(mesh);
  if (batch.occluder) partsOf(batch.occluder).fills.push(material);
}
for (const batch of batches.inks) {
  const hull = buildMesh('hull', batch.hull);
  hull.material = hullMaterial();
  const segments: Vector3[][] = [];
  for (let i = 0; i + 5 < batch.edges.length; i += 6) {
    const e = batch.edges;
    segments.push([
      new Vector3(e[i], e[i + 1], e[i + 2]),
      new Vector3(e[i + 3], e[i + 4], e[i + 5]),
    ]);
  }
  const lines = CreateLineSystem('creases', { lines: segments }, scene);
  lines.color = raw(INK_RGB);
  lines.isPickable = false;
  if (batch.occluder) partsOf(batch.occluder).inks.push(hull, lines);
}

// The bonsai: the viewer's meshes, with materials recreated as the Three page does.
const bonsai = bonsaiMeshes(data);
const potMaterial = toonMaterial('pot', Color3.White());
const barkMaterial = toonMaterial('bark', Color3.White());
const foliageMaterial = toonMaterial('foliage', Color3.White());
foliageMaterial.transparencyMode = Material.MATERIAL_ALPHATEST;
foliageMaterial.alphaCutOff = 0.5;
// Babylon tests the material's alpha, which takes the texture's only when asked to.
foliageMaterial.useAlphaFromDiffuseTexture = true;
const treeHull = hullMaterial();
for (const [name, arrays, material, inked] of [
  ['pot', bonsai.pot, potMaterial, true],
  ['bark', bonsai.bark, barkMaterial, true],
  ['foliage', bonsai.foliage, foliageMaterial, false],
] as const) {
  const mesh = buildMesh(name, arrays);
  mesh.material = material;
  shadows.addShadowCaster(mesh);
  if (inked) {
    const hull = mesh.clone(`${name}-hull`);
    hull.material = treeHull;
  }
}

// The player: frame `playerFrame` of the Inked sheet (16 x 32 logical px, its feet on the
// frame's bottom) on a 1 x 2 m quad standing on its feet, turned to face the camera.
const playerMaterial = new StandardMaterial('player', scene);
// Unlit, as MeshBasicMaterial: Babylon's unlit material is lit only by its emissive colour.
playerMaterial.disableLighting = true;
playerMaterial.emissiveColor = Color3.White();
playerMaterial.backFaceCulling = false;
playerMaterial.transparencyMode = Material.MATERIAL_ALPHATEST;
playerMaterial.alphaCutOff = 0.5;
playerMaterial.useAlphaFromDiffuseTexture = true;
// The quad Three's PlaneGeometry would make, facing +z, its corners from their uvs.
const corners = [0, 0, 1, 0, 1, 1, 0, 1];
const player = buildMesh('player', {
  positions: new Float32Array(
    [0, 1, 2, 3].flatMap((i) => [
      ((corners[i * 2] ?? 0) - 0.5) * (PLAYER_HEIGHT / 2),
      (corners[i * 2 + 1] ?? 0) * PLAYER_HEIGHT,
      0,
    ]),
  ),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array(corners),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
player.material = playerMaterial;
player.isVisible = false;
shadows.addShadowCaster(player);

function resize(): void {
  engine.resize();
  outlineWidth.set(
    (2 * OUTLINE_WIDTH_PX) / window.innerWidth,
    (2 * OUTLINE_WIDTH_PX) / window.innerHeight,
  );
  for (const m of hullMaterials) m.setVector2('uWidth', outlineWidth);
}
window.addEventListener('resize', resize);
resize();

let faded = new Set<OccluderKey>();
function setFaded(next: ReadonlySet<OccluderKey>): void {
  for (const [key, parts] of occluderParts) {
    const fade = next.has(key);
    if (fade === faded.has(key)) continue;
    for (const m of parts.fills) {
      m.alpha = fade ? FADED_OPACITY : 1;
      m.disableDepthWrite = fade;
    }
    for (const ink of parts.inks) ink.isVisible = !fade;
  }
  faded = new Set(next);
}

const targetV = new Vector3();
function frame(now: number): void {
  const view = session.update(now);
  const target = toRender(view.target);
  const eye = toRender(view.eye);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.setTarget(targetV.set(target.x, target.y, target.z));

  sun.position.set(target.x + toSun.x * 40, toSun.y * 40, target.z + toSun.z * 40);

  const feet = toRender({ x: view.player.x, y: view.player.y, z: 0 });
  player.position.set(feet.x, feet.y, feet.z);
  player.rotation.y = (view.orbit.yaw * Math.PI) / 180;
  const sheet = playerMaterial.diffuseTexture;
  if (sheet instanceof Texture) {
    sheet.uOffset = playerFrame(view.facing, view.player.walkAnim) / SHEETS.player.frames;
  }

  setFaded(view.faded);
  scene.render();
  session.rendered();
  requestAnimationFrame(frame);
}

// Ready once every tile, the bark, the leaves and the player's sheet are bound and every shader compiled.
const base = import.meta.env.BASE_URL;
const tiles = new Map<MaterialKey, Promise<DynamicTexture>>();
function tileTexture(key: MaterialKey): Promise<DynamicTexture> | undefined {
  const sheet = data.materials[key].sheet;
  if (!sheet) return undefined;
  let texture = tiles.get(key);
  if (!texture) {
    texture = tileCanvas(base, sheet).then((c) => {
      const t = new DynamicTexture(key, c, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
      t.update();
      return inkedTexture(t, Texture.WRAP_ADDRESSMODE);
    });
    tiles.set(key, texture);
  }
  return texture;
}
Promise.all([
  ...fillMaterials.map(async ({ material, key }) => {
    const texture = tileTexture(key);
    if (!texture) return;
    material.diffuseTexture = await texture;
  }),
  loadTexture(barkUrl).then((t) => {
    barkMaterial.diffuseTexture = inkedTexture(t, Texture.MIRROR_ADDRESSMODE);
  }),
  loadTexture(foliageUrl).then((t) => {
    t.hasAlpha = true;
    foliageMaterial.diffuseTexture = inkedTexture(t, Texture.WRAP_ADDRESSMODE);
  }),
  loadTexture(sheetUrl(base, SHEETS.player)).then((t) => {
    t.hasAlpha = true;
    t.uScale = 1 / SHEETS.player.frames;
    t.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    playerMaterial.diffuseTexture = t;
    player.isVisible = true;
  }),
])
  .then(() => scene.whenReadyAsync())
  .then(
    () => {
      session.setReady();
    },
    (err: unknown) => {
      console.error('engine-babylon: could not load the textures', err);
    },
  );

requestAnimationFrame(frame);
