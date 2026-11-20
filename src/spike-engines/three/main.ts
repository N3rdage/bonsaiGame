/**
 * The engine comparison's Three.js page (backlog #378, engine-three.html):
 * the shared scene (../scene.ts, ../meshData.ts, ../bonsai.ts) drawn with
 * toon-lit, ink-outlined meshes under one shadow-casting sun, the player as
 * the 2D game's Inked sprite on an upright quad turned to the camera, and
 * the occluders in front of the player faded. Input, walking, the camera,
 * the fades, the overlay, the benchmark and the test hook are the shared
 * session's (../session.ts); this file only draws.
 */

import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DirectionalLight,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  MirroredRepeatWrapping,
  NearestFilter,
  NoColorSpace,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three';
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
import { SHEETS, playerFrame, sheetUrl } from '../../world/assets';
import { bonsaiMeshes, type TreeMesh } from '../bonsai';
import { HULL_VERTEX, INK_FRAGMENT, WASH_RGB, onPaper } from '../ink';
import { sceneBatches, type MeshArrays } from '../meshData';
import { FADED_OPACITY } from '../occlusion';
import { webglRendererName } from '../overlay';
import { PLAYER_HEIGHT, buildScene, toRender, type MaterialKey, type OccluderKey } from '../scene';
import { SpikeSession } from '../session';
import { tileCanvas } from '../tiles';

/** Palette bytes reach the screen untouched, as in the viewer (outputColorSpace below). */
const raw = ({ r, g, b }: Rgb): Color =>
  new Color().setRGB(r / 255, g / 255, b / 255, LinearSRGBColorSpace);

/** How much a cast shadow darkens what it falls on, as the front garden spike's. */
const SHADOW_STRENGTH = 0.3;
/** Half the side of the square the sun's shadow map covers round the player, metres. */
const SHADOW_HALF = 14;
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
  mesh.receiveShadow = batch.ground;
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

// The sun: the rooms' one light, fixed in the world; its shadow map follows the player.
// Intensity pi cancels the toon BRDF's 1/pi, so the lit band is the palette colour, as in the viewer.
const sun = new DirectionalLight(0xffffff, Math.PI);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.intensity = SHADOW_STRENGTH;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, {
  left: -SHADOW_HALF,
  right: SHADOW_HALF,
  top: SHADOW_HALF,
  bottom: -SHADOW_HALF,
  near: 1,
  far: 80,
});
scene.add(sun, sun.target);
const toSun = toRender(data.light);

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
  scene.add(m);
  if (inked) scene.add(new Mesh(g, treeHull));
}

// The player: frame `playerFrame` of the Inked sheet (16 x 32 logical px, its feet on the
// frame's bottom) on a 1 x 2 m quad standing on its feet, turned to face the camera.
const playerMaterial = new MeshBasicMaterial({ alphaTest: 0.5 });
const player = new Mesh(
  new PlaneGeometry(PLAYER_HEIGHT / 2, PLAYER_HEIGHT).translate(0, PLAYER_HEIGHT / 2, 0),
  playerMaterial,
);
player.castShadow = true;
player.visible = false;
scene.add(player);

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

  sun.target.position.set(target.x, 0, target.z);
  sun.position.set(target.x + toSun.x * 40, toSun.y * 40, target.z + toSun.z * 40);

  const feet = toRender({ x: view.player.x, y: view.player.y, z: 0 });
  player.position.set(feet.x, feet.y, feet.z);
  player.rotation.y = (view.orbit.yaw * Math.PI) / 180;
  if (playerMaterial.map) {
    playerMaterial.map.offset.x =
      playerFrame(view.facing, view.player.walkAnim) / SHEETS.player.frames;
  }

  setFaded(view.faded);
  renderer.render(scene, camera);
  session.rendered();
  requestAnimationFrame(frame);
}

// Ready once every tile, the bark, the leaves and the player's sheet are bound.
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
  loader.loadAsync(sheetUrl(base, SHEETS.player)).then((t) => {
    t.colorSpace = NoColorSpace;
    t.magFilter = LinearFilter;
    t.repeat.set(1 / SHEETS.player.frames, 1);
    playerMaterial.map = t;
    playerMaterial.needsUpdate = true;
    player.visible = true;
  }),
]).then(
  () => {
    session.setReady();
  },
  (err: unknown) => {
    console.error('engine-three: could not load the textures', err);
  },
);

requestAnimationFrame(frame);
