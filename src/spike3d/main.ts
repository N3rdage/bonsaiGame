/**
 * The front garden 3D spike (backlog #359), a dev-only page (spike3d.html):
 * plan B3's front garden, the house's front and the garage as toon-lit,
 * ink-outlined blocks under a fixed orthographic camera, with the player
 * walking it on today's keys and today's collision (frontGardenRoom.ts,
 * player.ts). C cycles the camera angle; `?angle=` picks the first.
 */

import {
  BackSide,
  BasicShadowMap,
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  EdgesGeometry,
  Euler,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  INK_RGB,
  OUTLINE_DEPTH,
  OUTLINE_WIDTH_PX,
  SURROUND_RGB,
  TOON_RAMP,
  toonRampBytes,
} from '../viewer/toon';
import type { Rgb } from '../viewer/potPalette';
import { PLAYER_FEET, SHEETS, playerFrame, sheetUrl } from '../world/assets';
import { FRONT_GARDEN_ROOM } from '../world/frontGardenRoom';
import { fixedSteps, keyboardInput, type HeldKeys } from '../world/input';
import { nearestInteractable, promptFor } from '../world/interactables';
import { createPlayer, stepPlayer, type PlayerState } from '../world/player';
import {
  angleNamed,
  eyeDirection,
  followX,
  lightDirection,
  nextAngle,
  roomInput,
  screenFacing,
  viewWidthMetres,
  type Angle,
} from './camera';
import './hook';
import {
  HULL_VERTEX,
  INK_FRAGMENT,
  SPRITE_FRAGMENT,
  SPRITE_VERTEX,
  WASH_RGB,
  cornerNormals,
  onPaper,
  spriteSize,
} from './ink';
import { SITE, cutaway, roomToSite, siteBlocks, type Block, type Wash } from './site';

/** Palette bytes reach the screen untouched, as in the viewer (outputColorSpace below). */
const raw = ({ r, g, b }: Rgb): Color =>
  new Color().setRGB(r / 255, g / 255, b / 255, LinearSRGBColorSpace);

const NEAR = 0.1;
const FAR = 100;
const EYE_DISTANCE = 40;
/** The player's sprite is drawn this far nearer the camera than its feet, so the ground under them never covers them. */
const SPRITE_LIFT_METRES = 0.3;
/** How much a cast shadow darkens the ground, near the rooms' shadow wash (0.45 of WASHES.shadow over the floor). */
const SHADOW_STRENGTH = 0.3;

const canvas = document.getElementById('spike');
const promptEl = document.getElementById('prompt');
if (!(canvas instanceof HTMLCanvasElement) || !promptEl) {
  throw new Error('spike3d.html is missing #spike or #prompt');
}
const prompt = promptEl;

const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.outputColorSpace = LinearSRGBColorSpace;
renderer.setClearColor(raw(SURROUND_RGB));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = BasicShadowMap;

const scene = new Scene();
const camera = new OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);

const gradient = new DataTexture(toonRampBytes(), TOON_RAMP.length, 1, RedFormat);
gradient.magFilter = NearestFilter;
gradient.minFilter = NearestFilter;
gradient.needsUpdate = true;

const materials = new Map<Wash, MeshToonMaterial>();
function material(wash: Wash): MeshToonMaterial {
  let m = materials.get(wash);
  if (!m) {
    // Pushed back a little so the crease lines on its edges draw over it.
    m = new MeshToonMaterial({
      color: raw(onPaper(WASH_RGB[wash])),
      gradientMap: gradient,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    materials.set(wash, m);
  }
  return m;
}

const outlineWidth = new Vector2();
const ink = raw(INK_RGB);
const hullMaterial = new ShaderMaterial({
  uniforms: {
    uWidth: { value: outlineWidth },
    uDepth: { value: OUTLINE_DEPTH },
    uInk: { value: ink },
  },
  vertexShader: HULL_VERTEX,
  fragmentShader: INK_FRAGMENT,
  side: BackSide,
});
const creaseMaterial = new LineBasicMaterial({ color: ink });

/** A block lying flat on the ground, which takes cast shadows and casts none. */
const isGround = (b: Block): boolean => b.z1 <= 0.1;

/**
 * The blocks as a few merged meshes: one toon mesh per wash (ground and
 * standing apart), one ink hull and one set of crease lines, so the scene is
 * a handful of draw calls however many blocks it has. Site y is three's z,
 * height three's y.
 */
function blockGroup(blocks: readonly Block[]): Group {
  const fills = new Map<string, { wash: Wash; ground: boolean; parts: BufferGeometry[] }>();
  const hulls: BufferGeometry[] = [];
  const creases: BufferGeometry[] = [];
  for (const b of blocks) {
    const box = new BoxGeometry(b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0);
    // A positive tilt rises toward the south (+z): a rotation about x by -tilt lifts +z.
    const place = new Matrix4().compose(
      new Vector3((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.y0 + b.y1) / 2),
      new Quaternion().setFromEuler(new Euler(-(b.tilt ?? 0), 0, 0)),
      new Vector3(1, 1, 1),
    );
    const hull = box.clone();
    hull.setAttribute(
      'normal',
      new BufferAttribute(cornerNormals(box.getAttribute('position').array), 3),
    );
    hulls.push(hull.applyMatrix4(place));
    creases.push(new EdgesGeometry(box).applyMatrix4(place));
    const ground = isGround(b);
    const key = `${b.wash}:${String(ground)}`;
    const fill = fills.get(key) ?? { wash: b.wash, ground, parts: [] };
    fill.parts.push(box.applyMatrix4(place));
    fills.set(key, fill);
  }
  const group = new Group();
  for (const { wash, ground, parts } of fills.values()) {
    const mesh = new Mesh(mergeGeometries(parts), material(wash));
    // Only the ground takes cast shadows: a wall turned from the light keeps the toon ramp's shadow band.
    mesh.receiveShadow = ground;
    mesh.castShadow = !ground;
    group.add(mesh);
  }
  group.add(new Mesh(mergeGeometries(hulls), hullMaterial));
  group.add(new LineSegments(mergeGeometries(creases), creaseMaterial));
  return group;
}

const blocks = siteBlocks();
const full = blockGroup(blocks);
const cut = blockGroup(cutaway(blocks));
scene.add(full, cut);

// Intensity pi cancels the toon BRDF's 1/pi, so the lit band is the palette colour, as in the viewer.
const sun = new DirectionalLight(0xffffff, Math.PI);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.intensity = SHADOW_STRENGTH;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.target.position.set((SITE.garden.x0 + SITE.garden.x1) / 2, 0, 0);
scene.add(sun, sun.target);

// The player: the 2D game's Inked sheet on a camera-facing quad standing on its feet.
const frameUniform = { value: 0 };
const spriteMap: { value: Texture | null } = { value: null };
const spriteGeometry = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
const sprite = new Mesh(
  spriteGeometry,
  new ShaderMaterial({
    uniforms: {
      uMap: spriteMap,
      uFrame: frameUniform,
      uFrames: { value: SHEETS.player.frames },
      uLift: { value: (2 * SPRITE_LIFT_METRES) / (FAR - NEAR) },
    },
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
  }),
);
sprite.visible = false;
scene.add(sprite);
new TextureLoader().load(sheetUrl(import.meta.env.BASE_URL, SHEETS.player), (texture) => {
  texture.magFilter = NearestFilter;
  spriteMap.value = texture;
  sprite.visible = true;
});

const room = FRONT_GARDEN_ROOM;
// The front door's landing, facing up the path, as the 2D front garden's screenshot.
let player: PlayerState = { ...createPlayer(room), facing: 'up' };
let angle = angleNamed(new URLSearchParams(location.search).get('angle'));
let accumulator = 0;
const held = { left: false, right: false, up: false, down: false };
const KEYS: Record<string, keyof HeldKeys> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};
function onKey(event: KeyboardEvent, down: boolean): void {
  const dir = KEYS[event.code];
  if (dir) held[dir] = down;
  else if (down && event.code === 'KeyC') setAngle(nextAngle(angle));
}
window.addEventListener('keydown', (e) => {
  onKey(e, true);
});
window.addEventListener('keyup', (e) => {
  onKey(e, false);
});

function setAngle(next: Angle): void {
  angle = next;
  full.visible = !angle.cutaway;
  cut.visible = angle.cutaway;
  const l = lightDirection(angle.yaw);
  sun.position.copy(sun.target.position).add(new Vector3(l.x, l.y, l.z).multiplyScalar(30));
  const { w, h } = spriteSize(angle.pitch);
  sprite.scale.set(w, h, 1);
  resize();
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  const half = viewWidthMetres(width, height) / 2;
  Object.assign(camera, {
    left: -half,
    right: half,
    top: (half * height) / width,
    bottom: (-half * height) / width,
  });
  camera.updateProjectionMatrix();
  // The ink hull's width in clip units: 2 per viewport, so OUTLINE_WIDTH_PX CSS px, as the viewer's.
  outlineWidth.set((2 * OUTLINE_WIDTH_PX) / width, (2 * OUTLINE_WIDTH_PX) / height);
}
window.addEventListener('resize', resize);

const deltas: number[] = [];
let frames = 0;
let last = performance.now();

function frame(now: number): void {
  const delta = now - last;
  last = now;
  deltas.push(delta);
  if (deltas.length > 120) deltas.shift();

  const step = fixedSteps(accumulator, delta);
  accumulator = step.accumulatorMs;
  for (let i = 0; i < step.steps; i++) {
    player = stepPlayer(player, roomInput(keyboardInput(held), angle.yaw), room);
  }

  const feet = roomToSite({ x: player.x, y: player.y + PLAYER_FEET });
  sprite.position.set(feet.x, 0, feet.y);
  frameUniform.value = playerFrame(screenFacing(player.facing, angle.yaw), player.walkAnim);

  const focus = new Vector3(
    followX(feet.x, camera.right - camera.left, SITE.garden.x0, SITE.garden.x1),
    0,
    angle.focusY,
  );
  const eye = eyeDirection(angle);
  camera.position.copy(focus).add(new Vector3(eye.x, eye.y, eye.z).multiplyScalar(EYE_DISTANCE));
  camera.lookAt(focus);
  sprite.quaternion.copy(camera.quaternion);

  const near = nearestInteractable(player, room.props);
  prompt.textContent = near ? promptFor(near) : '';

  renderer.render(scene, camera);
  frames++;
  window.__spike3d = {
    ready: spriteMap.value !== null,
    angle: angle.key,
    player: { x: player.x, y: player.y, facing: player.facing },
    near: near?.key ?? '',
    frames,
    frameMs: deltas.length === 120 ? deltas.reduce((a, b) => a + b, 0) / 120 : 0,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
  requestAnimationFrame(frame);
}

setAngle(angle);
requestAnimationFrame(frame);
