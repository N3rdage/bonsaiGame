/**
 * The engine comparison's Babylon.js page (backlog #378, engine-babylon.html):
 * the same shared scene as the Three.js page (../scene.ts, ../meshData.ts,
 * ../bonsai.ts), drawn with toon-lit, ink-outlined meshes under one sun
 * casting cascaded shadows over the whole garden, the player and a crowd as
 * one skinned glTF (../character.ts) read by the glTF loader plugin and
 * cross-faded between its idle and walk animation groups, trees and hedges as
 * thin instances, and the occluders in front of the player faded. Input,
 * walking, the camera, the fades, the overlay, the benchmark, the stress run
 * and the test hook are the shared session's (../session.ts); this file only
 * draws.
 *
 * Babylon has no toon material in core, so the fills are StandardMaterials
 * with a material plugin that swaps their diffuse term for the viewer's
 * stepped ramp (Babylon's CUSTOMUSERLIGHTING hook), keeping Babylon's own
 * shadow sampling. The ink hull is the Three page's shader, ported to a
 * Babylon ShaderMaterial (Babylon's built-in renderOutline pushes out in
 * world units, not screen pixels, so it would not match the viewer's ink).
 */

import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
// Importing the generator also registers its scene component, which draws the shadow maps.
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
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
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
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
import { bonsaiMeshes, type TreeMesh } from '../bonsai';
import { buildCharacterGlb } from '../character';
import { hedgeBody, treeCanopy, treeTrunk } from '../curved';
import { HULL_VERTEX, HULL_VERTEX_INSTANCED, INK_FRAGMENT, WASH_RGB, onPaper } from '../ink';
import { sceneBatches, type MeshArrays } from '../meshData';
import { FADED_OPACITY } from '../occlusion';
import { webglRendererName } from '../overlay';
import { propMatrices } from '../props';
import { buildScene, toRender, type MaterialKey, type OccluderKey } from '../scene';
import { SpikeSession, type EngineDetails } from '../session';
import { MAX_CROWD } from '../stress';
import { tileCanvas } from '../tiles';

/** Palette bytes reach the screen untouched: Babylon's StandardMaterial does no colour space conversion. */
const raw = ({ r, g, b }: Rgb): Color3 => new Color3(r / 255, g / 255, b / 255);

/** How much a cast shadow darkens what it falls on, as the Three page's. */
const SHADOW_STRENGTH = 0.3;
const SHADOW_MAP = 2048;
const SHADOW_CASCADES = 3;
/** How far from the camera the cascades reach, metres: the whole garden from the camera's furthest orbit. */
const SHADOW_REACH = 45;
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
  details: (): EngineDetails => ({
    character: character && {
      clips: character.animationGroups.map((g) => g.name),
      joints: character.skeletons[0]?.bones.length ?? 0,
    },
    shadows: {
      enabled: scene.shadowsEnabled && sun.shadowEnabled && shadows.getShadowMap() !== null,
      kind: 'CascadedShadowGenerator, PCF',
      mapSize: shadows.getShadowMap()?.getSize().width ?? 0,
      cascades: shadows.numCascades,
    },
  }),
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

// The sun: the rooms' one light, fixed in the world. Its cascades are fitted to the camera's
// frustum each frame by the generator, so they cover the whole garden with no extents set here.
const sun = new DirectionalLight(
  'sun',
  new Vector3(-toSun.x, -toSun.y, -toSun.z).normalize(),
  scene,
);
sun.specular = Color3.Black();
const shadows = new CascadedShadowGenerator(SHADOW_MAP, sun);
shadows.numCascades = SHADOW_CASCADES;
shadows.shadowMaxZ = SHADOW_REACH;
shadows.stabilizeCascades = true;
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.setDarkness(1 - SHADOW_STRENGTH);
shadows.bias = 0.002;
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
  mesh.receiveShadows = true;
  if (!batch.ground) shadows.addShadowCaster(mesh);
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
  mesh.receiveShadows = true;
  shadows.addShadowCaster(mesh);
  if (inked) {
    const hull = mesh.clone(`${name}-hull`);
    hull.material = treeHull;
  }
}

// Trees and hedges: curved meshes, each part one mesh with thin instances and the ink hull
// instanced from the same matrices. Culling is off so every instance in the count is drawn.
// The instanced hull reads the instance's world matrix from Babylon's world0..3 attributes.
const BABYLON_INSTANCED_HULL_VERTEX = `precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
uniform mat4 view;
uniform mat4 projection;
#define projectionMatrix projection
#define INSTANCE_MODEL_VIEW (view * mat4(world0, world1, world2, world3))
${HULL_VERTEX_INSTANCED}`;
function instancedHullMaterial(): ShaderMaterial {
  const m = new ShaderMaterial(
    'instancedHull',
    scene,
    { vertexSource: BABYLON_INSTANCED_HULL_VERTEX, fragmentSource: BABYLON_INK_FRAGMENT },
    {
      attributes: ['position', 'normal'],
      uniforms: ['view', 'projection', 'uWidth', 'uDepth', 'uInk'],
    },
  );
  m.setFloat('uDepth', OUTLINE_DEPTH);
  m.setColor3('uInk', raw(INK_RGB));
  m.setVector2('uWidth', outlineWidth);
  m.cullBackFaces = false;
  hullMaterials.push(m);
  return m;
}
const instancedHull = instancedHullMaterial();
const washMaterial = (name: string, wash: keyof typeof WASH_RGB): StandardMaterial =>
  toonMaterial(name, raw(onPaper(WASH_RGB[wash])));
function propParts(
  parts: readonly (readonly [string, MeshArrays, StandardMaterial])[],
  matrices: Float32Array,
): Mesh[] {
  return parts.flatMap(([name, arrays, material]) => {
    const fill = buildMesh(name, arrays);
    fill.material = material;
    fill.receiveShadows = true;
    shadows.addShadowCaster(fill);
    const ink = buildMesh(`${name}-hull`, arrays);
    ink.material = instancedHull;
    return [fill, ink].map((mesh) => {
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
      mesh.alwaysSelectAsActiveMesh = true;
      return mesh;
    });
  });
}
const treeMeshes = propParts(
  [
    ['trunk', treeTrunk(), washMaterial('trunk', 'wood')],
    ['canopy', treeCanopy(), washMaterial('canopy', 'foliage')],
  ],
  propMatrices('tree'),
);
const hedgeMeshes = propParts(
  [['hedge', hedgeBody(), washMaterial('hedge', 'foliage')]],
  propMatrices('hedge'),
);

// The character: ../character.ts's glTF read by the glTF loader plugin into an asset container;
// the player and every crowd member is an instantiation of it with its own skeleton and its own
// idle and walk animation groups, both playing, blended by weight.
const characterMaterial = toonMaterial('gardener', Color3.White());
interface Gardener {
  readonly holder: TransformNode;
  readonly idle: AnimationGroup;
  readonly walk: AnimationGroup;
  /** Whether its animation groups are playing; a hidden crowd member's are stopped. */
  active: boolean;
}
let character: AssetContainer | undefined;
const gardeners: Gardener[] = [];

function addGardener(source: AssetContainer): Gardener {
  const entries = source.instantiateModelsToScene((name) => name, false, {
    doNotInstantiate: true,
  });
  const holder = new TransformNode('gardener', scene);
  holder.setEnabled(false);
  for (const node of entries.rootNodes) node.parent = holder;
  for (const mesh of holder.getChildMeshes()) {
    mesh.material = characterMaterial;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
    // The bind pose's bounds do not follow the bones.
    mesh.alwaysSelectAsActiveMesh = true;
  }
  const idle = entries.animationGroups.find((g) => g.name === 'idle');
  const walk = entries.animationGroups.find((g) => g.name === 'walk');
  if (!idle || !walk) throw new Error('the character glTF has no idle and walk clips');
  idle.stop();
  walk.stop();
  const gardener = { holder, idle, walk, active: false };
  gardeners.push(gardener);
  return gardener;
}

function place(g: Gardener, site: { x: number; y: number; heading: number }): void {
  const feet = toRender({ x: site.x, y: site.y, z: 0 });
  g.holder.position.set(feet.x, feet.y, feet.z);
  g.holder.rotation.y = Math.PI / 2 - site.heading;
}

function blend(g: Gardener, weight: number, rate: number): void {
  if (!g.active) {
    g.active = true;
    g.holder.setEnabled(true);
    g.idle.start(true);
    g.walk.start(true);
  }
  g.idle.setWeightForAllAnimatables(1 - weight);
  g.walk.setWeightForAllAnimatables(weight);
  g.walk.speedRatio = rate;
}

function hide(g: Gardener): void {
  if (!g.active) return;
  g.active = false;
  g.holder.setEnabled(false);
  g.idle.stop();
  g.walk.stop();
}

/** Reads the glTF and makes the player's gardener and, hidden, the whole crowd's. */
async function loadCharacter(): Promise<void> {
  const container = await LoadAssetContainerAsync(new Uint8Array(buildCharacterGlb()), scene, {
    pluginExtension: '.glb',
  });
  for (let i = 0; i <= MAX_CROWD; i++) hide(addGardener(container));
  character = container;
}

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

  for (const m of treeMeshes) m.thinInstanceCount = view.load.trees;
  for (const m of hedgeMeshes) m.thinInstanceCount = view.load.hedges;
  if (character) {
    const [player, ...crowd] = gardeners;
    if (player) {
      place(player, view.player);
      blend(player, view.walk.weight, view.walk.rate);
    }
    // The crowd walks at full weight; members past the load are hidden, not removed.
    crowd.forEach((g, i) => {
      const pose = view.crowd[i];
      if (!pose) {
        hide(g);
        return;
      }
      place(g, pose);
      blend(g, 1, 1);
    });
  }

  setFaded(view.faded);
  scene.render();
  session.rendered();
  requestAnimationFrame(frame);
}

// Ready once every tile, the bark, the leaves and the character are in and every shader compiled.
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
  loadCharacter(),
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
