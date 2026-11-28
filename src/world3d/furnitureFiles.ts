// The pack furniture's files as Vite assets (like bodyFiles.ts): each URL carries the app's base
// path and a content hash in the built game, so the files are cached for good and precached by
// the service worker. Only the models a room draws are here, so only those ship.
import tableSmall from './furniture/table_small.glb?url';
import tableMediumLong from './furniture/table_medium_long.glb?url';
import cabinetMedium from './furniture/cabinet_medium.glb?url';
import texture from './furniture/furniturebits_texture.png?url';

/** Each model's file's URL by its file name (`PACK_MODELS`' `file`), and the atlas they share. */
export const FURNITURE_FILES = {
  models: {
    'table_small.glb': tableSmall,
    'table_medium_long.glb': tableMediumLong,
    'cabinet_medium.glb': cabinetMedium,
  } as Readonly<Record<string, string>>,
  texture,
} as const;
