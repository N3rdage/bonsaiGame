import type { Page } from '@playwright/test';
import {
  holdUntilAtLeast,
  holdUntilAtMost,
  holdUntilNear,
  hook,
  interact,
  walkTo,
  walkToColumn,
  walkToRow,
} from './drive';

// Walks between the shed and the house rooms (src/world/*Room.ts, pinned in
// world.test.ts), plan B3's shapes. Shed lounge door (240, 56), in the top
// wall, to the lounge at (240, 190); lounge door (240, 216) back to the shed
// at (240, 82). The lounge-kitchen's floor is x 160..432, y 64..208, with the
// hallway's block solid in its north-east corner (x 336..432, y 64..128) and
// the kitchen open below it; its display spots are on its furniture against
// the top wall, pedestal_1 lounge_mantel (240, 77) on the fireplace
// (x 224..256, y 64..88) straight above the shed door's landing, and
// pedestal_2 lounge_side_table (168, 74) on the side table (x 160..176,
// y 64..80) in the top-left corner; both pieces stop the player. The
// lounge's door_hallway (344, 96), in the block's west face, leads to the
// hallway at (210, 176). The hallway's floor is x 192..288, y 144..208: its
// door_lounge (184, 176) leads back to the lounge at (318, 96), west of the
// block; its door_study (296, 176) to the study at (178, 96); its front door
// (240, 136), in its top wall, to the front garden at (336, 190). The study's
// floor is x 160..304, y 64..208: its door_hallway (152, 96) leads back to
// the hallway at (270, 176); its glass doors, door_garden (232, 216), 48x16 in
// its bottom wall, to the garden at (344, 162); its spots are study_desk
// (176, 70) on the desk (x 160..192, y 64..80) straight above the hallway
// door's landing, and study_bookshelf (296, 72.5) on the bookcase's right-hand
// bay (x 288..304, y 64..80). The greenhouse's door_garden (240, 200), in the
// centre of its bottom wall, leads to the garden at (336, 434); the garden's
// door_greenhouse lands in the greenhouse at (240, 174).
//
// The garden is plan B2's back garden (gardenRoom.ts), 464x512: the house
// (x 0..416, y 0..144) and the shed (x 0..160, y 144..256) are solid, the
// greenhouse stands in the lawn (x 256..416, y 304..416), and every garden
// door is in a building's face above the player (wall N), its landing 26 px
// below it. The shed door (80, 248) lands at (80, 274); the study door
// (344, 136) at (344, 162), the greenhouse door (336, 408) at (336, 434). The
// source plants stand along the south fence at y 472, x 80, 112 and 144. The
// side gate (432, 8), in the passage's north fence, leads to the front garden;
// the front garden's gate lands at (432, 34). The passage, x 416..448 between
// the house's east face and the east fence, runs down from the gate to the
// notch, x 160..448 and y 144..256, below the house's back face.
//
// The front garden's door to the hallway (336, 216) lands in the hallway at
// (240, 162), below its front door. The front garden is plan
// B3's (frontGardenRoom.ts), a 576x272 canvas: the road above y 96, bounds
// (0, 96) 576x128, its floor x 16..560, y 112..208, and every door in its south
// band facing up, its landing 26 px above it: door_house (336, 216) at
// (336, 190), the gate (544, 216) at (544, 190).
//
// Every walk ends against a wall or a solid piece of furniture, which stops
// the player in reach however late the key is released (backlog #81), or is
// a walkTo leg, which releases in the frame it arrives: from each garden
// landing, straight up into the face, 8.5 px below its door; from the
// greenhouse's landing straight down into its bottom wall (y 191.5), 8.5 px
// from its door; in the hallway, along to the front door's column as a walk
// leg and up into its top wall (y 144.75), below the front door, and from any
// of its landings along into a side wall (x 192.5 or 287.5), the side door in
// reach; from each side door's landing straight into the wall or the block
// its door is in, 8.5 px short of the door; from the shed door's landing in
// the lounge straight up into the fireplace, or left into the left wall and
// up into the side table; from the hallway door's landing in the study
// straight up into the desk, or right into the right wall and up into the
// bookcase; from the garden's landing in the study straight down into the
// bottom wall (y 207.5), 8.5 px above the glass doors; along the front
// garden's landing row and down into its south band (y 207.5), 8.5 px above
// its door or gate; from the passage's landing up into its north fence
// (y 16.5), 8.5 px below the gate. As walkTo legs: in the lounge up to the
// hallway door's row y 96 and east to the block's face; in the study up to the
// row y 96 and west to the left wall, and down to the row y 200 and along to
// the glass doors; from the lounge's hallway landing down to the row y 200
// and along the bottom wall to the shed door; from the passage's landing down
// the passage and along the notch under the house's face to the study door.

/** The hook read just before a door was used and just after the room it leads to showed. */
export interface Crossing {
  readonly from: BonsaiTestHook;
  readonly to: BonsaiTestHook;
}

/**
 * How long a walk's last step in the 3D world is given to carry the player
 * through the door it stopped at the doorway of, before Interact is pressed.
 */
const WALK_THROUGH_MS = 500;

/** Uses the door in reach (the 3D world's, unless the walk took it) and waits for `room`; returns the hook on either side of the door. */
export async function throughDoor(page: Page, room: string): Promise<Crossing> {
  const from = await hook(page);
  const walked =
    from.room === room ||
    (from.world3d?.on === true &&
      (await page
        .waitForFunction((r) => window.__bonsai?.room === r, room, { timeout: WALK_THROUGH_MS })
        .then(
          () => true,
          () => false,
        )));
  if (!walked) await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
  return { from, to: await hook(page) };
}

/**
 * From the shed floor: up into the top wall, then along it to the lounge door
 * and back (the return pass covers a release that carried past the door; it
 * does nothing while the door is in reach), and through it.
 */
export async function shedToLounge(page: Page): Promise<Crossing> {
  await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
  // From the shed's start the walk up is in line with the door, and the 3D world takes it.
  if ((await hook(page)).room === 'lounge') return throughDoor(page, 'lounge');
  const fromLeft = (await hook(page)).player.x < 240;
  await holdUntilNear(page, fromLeft ? 'ArrowRight' : 'ArrowLeft', 'door_lounge');
  await holdUntilNear(page, fromLeft ? 'ArrowLeft' : 'ArrowRight', 'door_lounge');
  return throughDoor(page, 'lounge');
}

/**
 * From a lounge landing, the shed door's (240, 190) or the hallway door's
 * (318, 96): a walkTo leg up to the hallway door's row y 96 (the fireplace
 * stops it at y 88.75 at the latest), then east until the door (344, 96) is in
 * reach, the block's west face stopping the leg at x 335 however late, and
 * through it.
 */
export async function loungeToHallway(page: Page): Promise<Crossing> {
  await walkTo(page, 96, 'right', 'door_hallway');
  return throughDoor(page, 'hallway');
}

/**
 * From a hallway landing, the lounge door's (210, 176) or the front door's
 * (240, 162): east into its right wall at x 287.5, its study door (296, 176) in
 * reach, and into the study.
 */
export async function hallwayToStudy(page: Page): Promise<Crossing> {
  await holdUntilNear(page, 'ArrowRight', 'door_study');
  return throughDoor(page, 'study');
}

/** The row of the study's hallway door (152, 96) and of its landing. */
const STUDY_DOOR_ROW = 96;

/**
 * From a study landing, the hallway door's (178, 96) or the glass doors'
 * (232, 190): a walkTo leg up to STUDY_DOOR_ROW if below it, then west until
 * the door is in reach, the left wall stopping the leg at x 160.75 however
 * late, and into the hallway.
 */
export async function studyToHallway(page: Page): Promise<Crossing> {
  await walkTo(page, STUDY_DOOR_ROW, 'left', 'door_hallway');
  return throughDoor(page, 'hallway');
}

/**
 * From a hallway landing, the study door's (270, 176) or the front door's
 * (240, 162): west into its left wall at x 192.5 (the front door never in
 * reach on the way), its lounge door (184, 176) in reach, and into the lounge.
 */
export async function hallwayToLounge(page: Page): Promise<Crossing> {
  await holdUntilNear(page, 'ArrowLeft', 'door_lounge');
  return throughDoor(page, 'lounge');
}

/**
 * From the lounge's hallway landing (318, 96): a walkTo leg down to the row
 * y 200 (stopped by the bottom wall at y 207.5 at the latest), then west
 * along it until the shed door (240, 216) is in reach, and into the shed.
 */
export async function loungeToShed(page: Page): Promise<Crossing> {
  await walkTo(page, 200, 'left', 'door');
  return throughDoor(page, 'shed');
}

/** The glass doors' centre column in the study. */
const GLASS_DOORS_X = 232;

/**
 * From a study landing, the hallway door's (178, 96) or the glass doors'
 * (232, 190): a walkTo leg down to the row y 200 (the bottom wall stops it at
 * y 207.5 at the latest), in reach of the doors (232, 216) if above them, else
 * along it until they are, and out into the garden.
 */
export async function studyToGarden(page: Page): Promise<Crossing> {
  const { x } = (await hook(page)).player;
  await walkTo(page, 200, x < GLASS_DOORS_X ? 'right' : 'left', 'door_garden');
  return throughDoor(page, 'garden');
}

/** From the garden's study-door landing (344, 162): straight up into the house's back face, and into the study. */
export async function gardenToStudy(page: Page): Promise<Crossing> {
  await holdUntilNear(page, 'ArrowUp', 'door_study');
  return throughDoor(page, 'study');
}

/**
 * The row a walk along the notch to the study door takes: 2 px below the
 * house's back face (y 144), so the row leg, stopping at most 6.25 px past
 * it, leaves the door (344, 136) at most 16.25 px above the player, and the
 * door comes in reach at least 11 px either side of it.
 */
const NOTCH_ROW = 146;

/**
 * From the back garden's gate landing (432, 34): a walkTo leg straight down
 * the passage into the notch to NOTCH_ROW, then left along the house's back
 * face until the study door is in reach, and into the study.
 */
export async function passageToStudy(page: Page): Promise<Crossing> {
  await walkTo(page, NOTCH_ROW, 'left', 'door_study');
  return throughDoor(page, 'study');
}

/**
 * The row a walk along to the shed door takes: 15 px below the door, so the
 * shed's face (y 256) is never in the way and the door, 8 px above the face's
 * edge, comes in reach 13 px either side of it wherever the row leg stopped.
 */
const SHED_DOOR_ROW = 263;

/** The greenhouse's west face: a walk up from the lawn must start left of it. */
const GREENHOUSE_WEST = 256;

/**
 * From the study door's landing, or anywhere in the lawn: below the
 * greenhouse (from its door's landing), first left along the lawn until clear
 * of its west face (a late release ends at the west fence, still clear); to
 * the shed door landing's row y 274 if above it; then up to SHED_DOOR_ROW (a
 * leg up stops on or above the row, never past the face), along to the shed
 * door, and through it.
 */
export async function gardenToShed(page: Page): Promise<Crossing> {
  const start = (await hook(page)).player;
  if (start.y > SHED_DOOR_ROW && start.x >= GREENHOUSE_WEST) {
    await holdUntilAtMost(page, 'ArrowLeft', 'x', GREENHOUSE_WEST - 24);
  }
  if ((await hook(page)).player.y < SHED_DOOR_ROW) await walkToRow(page, 274);
  const { x } = (await hook(page)).player;
  await walkTo(page, SHED_DOOR_ROW, x < 80 ? 'right' : 'left', 'door');
  return throughDoor(page, 'shed');
}

/** From the shed's start: down to the row y 200, in reach of the garden door in the bottom wall, and through it. */
export async function shedToGarden(page: Page): Promise<Crossing> {
  await walkTo(page, 200, 'left', 'door');
  return throughDoor(page, 'garden');
}

/** As SHED_DOOR_ROW for the greenhouse door (336, 408): 16 px below it, the glass box's south face at y 416. */
const GREENHOUSE_DOOR_ROW = 424;

/**
 * From the shed door's landing, or anywhere in the lawn beside the
 * greenhouse rather than above it: to the greenhouse door landing's row
 * y 434 if above it, then up to GREENHOUSE_DOOR_ROW, along under the glass
 * box to its door, and in.
 */
export async function gardenToGreenhouse(page: Page): Promise<Crossing> {
  if ((await hook(page)).player.y < GREENHOUSE_DOOR_ROW) await walkToRow(page, 434);
  const { x } = (await hook(page)).player;
  await walkTo(page, GREENHOUSE_DOOR_ROW, x < 336 ? 'right' : 'left', 'door_greenhouse');
  return throughDoor(page, 'greenhouse');
}

/** From the greenhouse's landing (240, 174): down into the bottom wall, its door in reach, and out to the garden. */
export async function greenhouseToGarden(page: Page): Promise<Crossing> {
  await holdUntilNear(page, 'ArrowDown', 'door_garden');
  return throughDoor(page, 'garden');
}

/**
 * From a hallway side door's landing, (210, 176) or (270, 176): a walk leg
 * along the row to the front door's x 240 (stopped at most 6.25 px past it;
 * the door, 40 px above the row, never comes in reach on it), then straight
 * up into the top wall at y 144.75, the front door (240, 136) in reach, and
 * out into the front garden.
 */
export async function hallwayToFront(page: Page): Promise<Crossing> {
  await walkToColumn(page, 240);
  await holdUntilNear(page, 'ArrowUp', 'door_front');
  return throughDoor(page, 'frontGarden');
}

/**
 * From the front garden's door landing (336, 190): right along the lawn to
 * the gate's x 544 (at most 6.25 px past it), then straight down into the
 * south band, the gate in reach, and through it to the back garden's passage.
 */
export async function frontToGate(page: Page): Promise<Crossing> {
  await holdUntilAtLeast(page, 'ArrowRight', 'x', 544);
  await holdUntilNear(page, 'ArrowDown', 'gate');
  return throughDoor(page, 'garden');
}

/** From the back garden's gate landing (432, 34): straight up into the passage's north fence, and through the gate. */
export async function gardenGateToFront(page: Page): Promise<Crossing> {
  await holdUntilNear(page, 'ArrowUp', 'gate');
  return throughDoor(page, 'frontGarden');
}

/**
 * From the front garden's gate landing (544, 190): left along the lawn to the
 * front door's x 336 (at most 6.25 px past it), then straight down into the
 * house's front face, the door in reach, and into the hallway.
 */
export async function frontToHallway(page: Page): Promise<Crossing> {
  await holdUntilAtMost(page, 'ArrowLeft', 'x', 336);
  await holdUntilNear(page, 'ArrowDown', 'door_house');
  return throughDoor(page, 'hallway');
}

/** The side table's east edge in the lounge: a walk up into it must start west of it. */
const SIDE_TABLE_EAST = 176;

/**
 * From the lounge's shed-door landing (240, 190): to the mantel straight up
 * into the fireplace; to the side table west until under it (a late release
 * ends at the left wall, x 160, still under it), then up into the table.
 */
export async function toLoungePedestal(page: Page, pedestal: 1 | 2): Promise<void> {
  if (pedestal === 2) await holdUntilAtMost(page, 'ArrowLeft', 'x', SIDE_TABLE_EAST - 6);
  await holdUntilNear(page, 'ArrowUp', `pedestal_${String(pedestal)}`);
}
