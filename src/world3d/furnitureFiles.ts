// The pack furniture's files as Vite assets (like bodyFiles.ts): each URL carries the app's base
// path and a content hash in the built game, so the files are cached for good and precached by
// the service worker. Only the models a room draws are here, so only those ship.
import tableSmall from './furniture/table_small.glb?url';
import tableMediumLong from './furniture/table_medium_long.glb?url';
import cabinetMedium from './furniture/cabinet_medium.glb?url';
import couch from './furniture/couch.glb?url';
import armchair from './furniture/armchair.glb?url';
import tableLow from './furniture/table_low.glb?url';
import lampStanding from './furniture/lamp_standing.glb?url';
import furnitureTexture from './furniture/furniturebits_texture.png?url';
import counterA from './restaurant/kitchencounter_straight_A.glb?url';
import counterB from './restaurant/kitchencounter_straight_B.glb?url';
import counterCorner from './restaurant/kitchencounter_outercorner.glb?url';
import counterSink from './restaurant/kitchencounter_sink.glb?url';
import stoveHob from './restaurant/stove_single_countertop.glb?url';
import restaurantTexture from './restaurant/restaurantbits_texture.png?url';
import type { PackAtlas } from './packModels';

/** Each model's file's URL by its file name (a `PackPart`'s `file`), and each pack's atlas. */
export const FURNITURE_FILES = {
  models: {
    'table_small.glb': tableSmall,
    'table_medium_long.glb': tableMediumLong,
    'cabinet_medium.glb': cabinetMedium,
    'couch.glb': couch,
    'armchair.glb': armchair,
    'table_low.glb': tableLow,
    'lamp_standing.glb': lampStanding,
    'kitchencounter_straight_A.glb': counterA,
    'kitchencounter_straight_B.glb': counterB,
    'kitchencounter_outercorner.glb': counterCorner,
    'kitchencounter_sink.glb': counterSink,
    'stove_single_countertop.glb': stoveHob,
  } as Readonly<Record<string, string>>,
  textures: {
    furniture: furnitureTexture,
    restaurant: restaurantTexture,
  } as Readonly<Record<PackAtlas, string>>,
} as const;
