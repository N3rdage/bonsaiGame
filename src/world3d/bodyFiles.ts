// The player's body files as Vite assets: each URL carries the app's base path and a content hash
// in the built game, so the files are cached for good and precached by the service worker.
import body from './player/rogue.glb?url';
import clips from './player/animations.glb?url';
import texture from './player/rogue_texture.png?url';

/** The body's file, its texture atlas and its clips' file, as URLs. */
export const BODY_FILES = { body, texture, clips } as const;
