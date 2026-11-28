/* eslint-disable no-console -- an entry script (`npm run art:furniture`) that reports what it wrote. */
// Packs the KayKit models the 3D rooms use (src/world3d/packModels.ts) into the pack's folder
// under src/world3d/: each model's .gltf + .bin become one .glb holding only its geometry
// (positions, texture coordinates, normals, indices), the shared texture atlas and the
// pack's licence are copied verbatim. The pack's material, image and sampler are left out:
// the renderer dresses every piece in the one atlas with the look's lit shading.
//
// Run with `npm run art:furniture -- <furniture|restaurant> <the pack's Assets directory>`
// (the one that holds `gltf/`, `texture/` and `LICENSE.txt`); the output is committed. It is
// deterministic: the same pack gives the same bytes.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Each pack: its folder under src/world3d/, its atlas and licence names and the models the rooms draw (one mesh of one primitive each, so a part is one draw call). */
const PACKS = {
  furniture: {
    folder: 'furniture',
    texture: 'furniturebits_texture.png',
    licence: 'LICENSE-KayKit-Furniture.txt',
    models: [
      'table_small',
      'table_medium_long',
      'cabinet_medium',
      'couch',
      'armchair',
      'table_low',
      'lamp_standing',
      'rug_rectangle_A',
    ],
  },
  restaurant: {
    folder: 'restaurant',
    texture: 'restaurantbits_texture.png',
    licence: 'LICENSE-KayKit-Restaurant.txt',
    models: [
      'kitchencounter_straight_A',
      'kitchencounter_straight_B',
      'kitchencounter_outercorner',
      'kitchencounter_sink',
      'stove_single_countertop',
    ],
  },
};

const pack = PACKS[process.argv[2] ?? ''];
const source = process.argv[3];
if (pack === undefined || source === undefined) {
  console.error(
    'usage: node art/furnitureGlb.mjs <furniture|restaurant> <the pack Assets directory>',
  );
  process.exit(1);
}
const OUT = join(ROOT, 'src', 'world3d', pack.folder);

/** Pads `bytes` to a multiple of four with `fill`, as a GLB chunk must be. */
function padded(bytes, fill) {
  const out = Buffer.alloc(Math.ceil(bytes.length / 4) * 4, fill);
  bytes.copy(out);
  return out;
}

/** One chunk: its length, its type and its padded bytes. */
function chunk(type, bytes) {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(bytes.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, bytes]);
}

/** The GLB of the glTF `name` in the pack: geometry only, its one buffer inline. */
function glbOf(name) {
  const gltf = JSON.parse(readFileSync(join(source, 'gltf', `${name}.gltf`), 'utf8'));
  const bin = readFileSync(join(source, 'gltf', `${name}.bin`));
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
  if (gltf.nodes.length !== 1 || gltf.meshes.length !== 1 || primitives.length !== 1) {
    throw new Error(`${name}: expected one node with one mesh of one primitive`);
  }
  const node = gltf.nodes[0];
  if (node.matrix || node.translation || node.rotation || node.scale) {
    throw new Error(`${name}: the node carries a transform, which this script does not bake`);
  }
  const primitive = { attributes: primitives[0].attributes, indices: primitives[0].indices };
  const json = {
    asset: gltf.asset,
    scene: 0,
    scenes: gltf.scenes,
    nodes: [{ name: node.name, mesh: 0 }],
    meshes: [{ name: gltf.meshes[0].name, primitives: [primitive] }],
    accessors: gltf.accessors,
    bufferViews: gltf.bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  const jsonChunk = chunk(0x4e4f534a, padded(Buffer.from(JSON.stringify(json)), 0x20));
  const binChunk = chunk(0x004e4942, padded(bin, 0));
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + jsonChunk.length + binChunk.length, 8);
  return Buffer.concat([header, jsonChunk, binChunk]);
}

mkdirSync(OUT, { recursive: true });
for (const name of pack.models) {
  const glb = glbOf(name);
  writeFileSync(join(OUT, `${name}.glb`), glb);
  console.log(`${name}.glb  ${String(glb.length)} bytes`);
}
copyFileSync(join(source, 'gltf', pack.texture), join(OUT, pack.texture));
copyFileSync(join(source, 'LICENSE.txt'), join(OUT, pack.licence));
console.log(`${pack.texture} and ${pack.licence} copied`);
