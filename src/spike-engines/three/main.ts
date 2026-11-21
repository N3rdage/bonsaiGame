/**
 * The engine comparison's Three.js page (backlog #378, engine-three.html):
 * the shared scene (../scene.ts, ../meshData.ts, ../bonsai.ts) drawn with
 * toon-lit, ink-outlined meshes under one shadow-casting sun whose shadow
 * map covers the whole garden, the player and a crowd as one skinned glTF
 * (../character.ts) cross-faded between its idle and walk clips by an
 * AnimationMixer each, trees and hedges as InstancedMeshes, and the
 * occluders in front of the player faded. Input, walking, the camera, the
 * fades, the overlay, the benchmark, the stress run and the test hook are
 * the shared session's (../session.ts); this file only draws.
 */

import {
  AnimationMixer,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DirectionalLight,
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshToonMaterial,
  MirroredRepeatWrapping,
  NearestFilter,
  NoColorSpace,
  PCFShadowMap,
  PerspectiveCamera,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SkinnedMesh,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import barkUrl from '../../viewer/bark.png';
import foliageUrl from '../../viewer/foliage.png';
import type { Rgb } from '../../viewer/potPalette';
import {
  INK_RGB,
  OUTLINE_DEPTH,
  OUTLINE_WIDTH_PX,
  SURROUND_RGB,
  TOON_RAMP,
  toonRampBytes,
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

/** Palette bytes reach the screen untouched, as in the viewer (outputColorSpace below). */
const raw = ({ r, g, b }: Rgb): Color =>
  new Color().setRGB(r / 255, g / 255, b / 255, LinearSRGBColorSpace);

/** How much a cast shadow darkens what it falls on, as the front garden spike's. */
const SHADOW_STRENGTH = 0.3;
/** Half the side of the square the sun's shadow map covers, metres: the whole garden, about 18 x 23 m, around its centre. */
const SHADOW_HALF = 22;
const SHADOW_MAP = 2048;
const FOV = 50;

const canvasEl = document.getElementById('spike-canvas');
if (!(canvasEl instanceof HTMLCanvasElement))
  throw new Error('engine-three.html is missing #spike-canvas');
const canvas = canvasEl;

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = LinearSRGBColorSpace;
renderer.setClearColor(raw(SURROUND_RGB));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

const scene = new Scene();
const camera = new PerspectiveCamera(FOV, 1, 0.1, 200);
const data = buildScene();
const session = new SpikeSession(data, {
  engine: 'three',
  canvas,
  drawCalls: () => renderer.info.render.calls,
  rendererName: () => webglRendererName(renderer.getContext()),
  details: (): EngineDetails => ({
    character: character && {
      clips: character.clips.map((clip) => clip.name),
      joints: character.joints,
    },
    shadows: {
      enabled: renderer.shadowMap.enabled && sun.castShadow,
      kind: 'PCF directional map',
      mapSize: sun.shadow.mapSize.x,
      cascades: 1,
    },
  }),
});

const gradient = new DataTexture(toonRampBytes(), TOON_RAMP.length, 1, RedFormat);
gradient.magFilter = NearestFilter;
gradient.minFilter = NearestFilter;
gradient.needsUpdate = true;

function geometry(m: MeshArrays | TreeMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(m.uvs, 2));
  if ('colors' in m) g.setAttribute('color', new Float32BufferAttribute(m.colors, 3));
  g.setIndex(new BufferAttribute(m.indices, 1));
  return g;
}

/** Inked art's bytes pass through untouched and scale smoothly, as the viewer's textures do. */
function inkedTexture(
  t: Texture,
  wrap: typeof RepeatWrapping | typeof MirroredRepeatWrapping,
): Texture {
  t.colorSpace = NoColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.wrapS = wrap;
  t.wrapT = wrap;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  return t;
}

// The ink: the front garden spike's hull shader, its width set in clip units on every resize.
const outlineWidth = new Vector2();
const hullMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uWidth: { value: outlineWidth },
      uDepth: { value: OUTLINE_DEPTH },
      uInk: { value: raw(INK_RGB) },
    },
    vertexShader: HULL_VERTEX,
    fragmentShader: INK_FRAGMENT,
    side: BackSide,
  });
// The same hull for InstancedMesh: three declares `instanceMatrix` for it.
const instancedHullMaterial = new ShaderMaterial({
  uniforms: {
    uWidth: { value: outlineWidth },
    uDepth: { value: OUTLINE_DEPTH },
    uInk: { value: raw(INK_RGB) },
  },
  vertexShader: `#define INSTANCE_MODEL_VIEW (modelViewMatrix * instanceMatrix)\n${HULL_VERTEX_INSTANCED}`,
  fragmentShader: INK_FRAGMENT,
  side: BackSide,
});

/** Each occluder's meshes and materials, so it fades as one: fills turn see-through, ink hides. */
const occluderParts = new Map<OccluderKey, { fills: Material[]; inks: (Mesh | LineSegments)[] }>();
function partsOf(key: OccluderKey): { fills: Material[]; inks: (Mesh | LineSegments)[] } {
  let parts = occluderParts.get(key);
  if (!parts) {
    parts = { fills: [], inks: [] };
    occluderParts.set(key, parts);
  }
  return parts;
}

const batches = sceneBatches(data);
const fillMaterials: { material: MeshToonMaterial; key: MaterialKey }[] = [];
for (const batch of batches.fills) {
  const spec = data.materials[batch.material];
  // Textured faces are the sheet's own colours; untextured ones their wash on paper.
  const material = new MeshToonMaterial({
    color: spec.sheet ? new Color(1, 1, 1) : raw(onPaper(WASH_RGB[spec.wash])),
    gradientMap: gradient,
    // Pushed back a little so the crease lines on its edges draw over it.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  fillMaterials.push({ material, key: batch.material });
  const mesh = new Mesh(geometry(batch.mesh), material);
  mesh.receiveShadow = true;
  mesh.castShadow = !batch.ground;
  scene.add(mesh);
  if (batch.occluder) partsOf(batch.occluder).fills.push(material);
}
for (const batch of batches.inks) {
  const hull = new Mesh(geometry(batch.hull), hullMaterial());
  const edges = new BufferGeometry();
  edges.setAttribute('position', new Float32BufferAttribute(batch.edges, 3));
  const lines = new LineSegments(edges, new LineBasicMaterial({ color: raw(INK_RGB) }));
  scene.add(hull, lines);
  if (batch.occluder) partsOf(batch.occluder).inks.push(hull, lines);
}

// The sun: the rooms' one light, fixed in the world, its shadow map one square over the whole garden.
// Intensity pi cancels the toon BRDF's 1/pi, so the lit band is the palette colour, as in the viewer.
const sun = new DirectionalLight(0xffffff, Math.PI);
const gardenCentre = toRender({ x: 5.5, y: 4.5, z: 0 });
const toSun = toRender(data.light);
sun.position.set(
  gardenCentre.x + toSun.x * 60,
  gardenCentre.y + toSun.y * 60,
  gardenCentre.z + toSun.z * 60,
);
sun.target.position.set(gardenCentre.x, gardenCentre.y, gardenCentre.z);
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
sun.shadow.intensity = SHADOW_STRENGTH;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, {
  left: -SHADOW_HALF,
  right: SHADOW_HALF,
  top: SHADOW_HALF,
  bottom: -SHADOW_HALF,
  near: 1,
  far: 140,
});
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);

// The bonsai: the viewer's meshes and materials, recreated here (TreeViewer keeps its own private).
const bonsai = bonsaiMeshes(data);
const potMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
const barkMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
const foliageMaterial = new MeshToonMaterial({
  vertexColors: true,
  gradientMap: gradient,
  alphaTest: 0.5,
});
const treeHull = hullMaterial();
for (const [mesh, material, inked] of [
  [bonsai.pot, potMaterial, true],
  [bonsai.bark, barkMaterial, true],
  [bonsai.foliage, foliageMaterial, false],
] as const) {
  const g = geometry(mesh);
  const m = new Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  if (inked) scene.add(new Mesh(g, treeHull));
}

// Trees and hedges: curved meshes, each part one InstancedMesh with the ink hull instanced from
// the same matrices. Frustum culling is off so every instance in the count is always drawn.
const washMaterial = (wash: keyof typeof WASH_RGB): MeshToonMaterial =>
  new MeshToonMaterial({ color: raw(onPaper(WASH_RGB[wash])), gradientMap: gradient });
const propParts = (
  parts: readonly (readonly [MeshArrays, MeshToonMaterial])[],
  matrices: Float32Array,
): InstancedMesh[] =>
  parts.flatMap(([arrays, material]) => {
    const g = geometry(arrays);
    const fill = new InstancedMesh(g, material, matrices.length / 16);
    fill.instanceMatrix.array.set(matrices);
    fill.castShadow = true;
    fill.receiveShadow = true;
    fill.frustumCulled = false;
    const ink = new InstancedMesh(g, instancedHullMaterial, matrices.length / 16);
    ink.instanceMatrix = fill.instanceMatrix;
    ink.frustumCulled = false;
    scene.add(fill, ink);
    return [fill, ink];
  });
const treeMeshes = propParts(
  [
    [treeTrunk(), washMaterial('wood')],
    [treeCanopy(), washMaterial('foliage')],
  ],
  propMatrices('tree'),
);
const hedgeMeshes = propParts([[hedgeBody(), washMaterial('foliage')]], propMatrices('hedge'));

// The character: ../character.ts's glTF read by GLTFLoader; the player and every crowd member
// is a SkeletonUtils clone with its own AnimationMixer, idle and walk both playing, blended by weight.
const characterMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
interface Gardener {
  readonly root: Object3D;
  readonly mixer: AnimationMixer;
  readonly idle: AnimationAction;
  readonly walk: AnimationAction;
}
/** The glTF as loaded: its scene to clone, its clips and its skinned mesh. */
let character: { scene: Object3D; clips: AnimationClip[]; joints: number } | undefined;
const gardeners: Gardener[] = [];

function addGardener(source: { scene: Object3D; clips: AnimationClip[] }): Gardener {
  const root = cloneSkinned(source.scene);
  root.traverse((o) => {
    if (o instanceof SkinnedMesh) {
      o.material = characterMaterial;
      o.castShadow = true;
      o.receiveShadow = true;
      // The bind pose's bounds do not follow the bones.
      o.frustumCulled = false;
    }
  });
  const mixer = new AnimationMixer(root);
  const idleClip = source.clips.find((c) => c.name === 'idle');
  const walkClip = source.clips.find((c) => c.name === 'walk');
  if (!idleClip || !walkClip) throw new Error('the character glTF has no idle and walk clips');
  const idle = mixer.clipAction(idleClip).play();
  const walk = mixer.clipAction(walkClip).play();
  scene.add(root);
  const gardener = { root, mixer, idle, walk };
  gardeners.push(gardener);
  return gardener;
}

function place(g: Gardener, site: { x: number; y: number; heading: number }): void {
  const feet = toRender({ x: site.x, y: site.y, z: 0 });
  g.root.position.set(feet.x, feet.y, feet.z);
  g.root.rotation.y = Math.PI / 2 - site.heading;
}

function blend(g: Gardener, weight: number, rate: number, delta: number): void {
  g.idle.setEffectiveWeight(1 - weight);
  g.walk.setEffectiveWeight(weight);
  g.walk.setEffectiveTimeScale(rate);
  g.mixer.update(delta);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  outlineWidth.set((2 * OUTLINE_WIDTH_PX) / width, (2 * OUTLINE_WIDTH_PX) / height);
}
window.addEventListener('resize', resize);
resize();

let faded = new Set<OccluderKey>();
function setFaded(next: ReadonlySet<OccluderKey>): void {
  for (const [key, parts] of occluderParts) {
    const fade = next.has(key);
    if (fade === faded.has(key)) continue;
    for (const m of parts.fills) {
      m.transparent = fade;
      m.opacity = fade ? FADED_OPACITY : 1;
      m.depthWrite = !fade;
      m.needsUpdate = true;
    }
    for (const ink of parts.inks) ink.visible = !fade;
  }
  faded = new Set(next);
}

function frame(now: number): void {
  const view = session.update(now);
  const target = toRender(view.target);
  const eye = toRender(view.eye);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z);

  for (const m of treeMeshes) m.count = view.load.trees;
  for (const m of hedgeMeshes) m.count = view.load.hedges;
  if (character) {
    const [player, ...crowd] = gardeners;
    if (player) {
      place(player, view.player);
      blend(player, view.walk.weight, view.walk.rate, view.delta);
    }
    // The crowd walks at full weight; members past the load are hidden, not removed.
    crowd.forEach((g, i) => {
      const pose = view.crowd[i];
      g.root.visible = pose !== undefined;
      if (!pose) return;
      place(g, pose);
      blend(g, 1, 1, view.delta);
    });
  }

  setFaded(view.faded);
  renderer.render(scene, camera);
  session.rendered();
  requestAnimationFrame(frame);
}

/** Reads the glTF and makes the player's gardener and, hidden, the whole crowd's. */
async function loadCharacter(): Promise<void> {
  const gltf = await new GLTFLoader().parseAsync(buildCharacterGlb(), '');
  const skinned = gltf.scene.getObjectByProperty('type', 'SkinnedMesh');
  if (!(skinned instanceof SkinnedMesh)) throw new Error('the character glTF has no skinned mesh');
  const source = { scene: gltf.scene, clips: gltf.animations };
  for (let i = 0; i <= MAX_CROWD; i++) addGardener(source);
  character = { ...source, joints: skinned.skeleton.bones.length };
}

// Ready once every tile, the bark, the leaves and the character are in.
const loader = new TextureLoader();
const base = import.meta.env.BASE_URL;
const tiles = new Map<MaterialKey, Promise<Texture>>();
function tileTexture(key: MaterialKey): Promise<Texture> | undefined {
  const sheet = data.materials[key].sheet;
  if (!sheet) return undefined;
  let texture = tiles.get(key);
  if (!texture) {
    texture = tileCanvas(base, sheet).then((c) =>
      inkedTexture(new CanvasTexture(c), RepeatWrapping),
    );
    tiles.set(key, texture);
  }
  return texture;
}
Promise.all([
  ...fillMaterials.map(async ({ material, key }) => {
    const texture = tileTexture(key);
    if (!texture) return;
    material.map = await texture;
    material.needsUpdate = true;
  }),
  loader.loadAsync(barkUrl).then((t) => {
    barkMaterial.map = inkedTexture(t, MirroredRepeatWrapping);
    barkMaterial.needsUpdate = true;
  }),
  loader.loadAsync(foliageUrl).then((t) => {
    foliageMaterial.map = inkedTexture(t, RepeatWrapping);
    foliageMaterial.needsUpdate = true;
  }),
  loadCharacter(),
]).then(
  () => {
    session.setReady();
  },
  (err: unknown) => {
    console.error('engine-three: could not load the textures', err);
  },
);

requestAnimationFrame(frame);
