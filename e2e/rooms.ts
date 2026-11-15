import type { Page } from '@playwright/test';
import {
  holdUntilAtLeast,
  holdUntilAtMost,
  holdUntilNear,
  hook,
  interact,
  walkTo,
  walkToRow,
} from './drive';

// Walks between the shed and the house rooms (src/world/*Room.ts, pinned in
// world.test.ts). Shed lounge door (240, 56), in the top wall, to the lounge at
// (240, 190); lounge door (240, 216) back to the shed at (240, 82). The
// lounge's floor is x 64..416, y 112..208; its display spots are on its
// furniture, pedestal_1 lounge_mantel (240, 125) on the fireplace (x 224..256,
// y 112..136) straight above the landing, and pedestal_2 lounge_side_table
// (408, 122) on the side table (x 400..416, y 112..128) in the top-right
// corner; both pieces stop the player. Every side-wall door past the shed sits on the row y 190: the lounge's door_hallway (424, 190) to the hallway at (114, 190); the
// hallway's door_lounge (88, 190) back to the lounge at (398, 190) and
// door_study (392, 190) to the study at (162, 190); the study's door_hallway
// (136, 190) back to the hallway at (366, 190). The study's glass doors,
// door_garden (320, 216), 32x16 in its bottom wall, lead to the garden at
// (344, 162); the greenhouse's door_garden (240, 232), in the centre of its
// bottom wall, leads to the greenhouse at (240, 206). The greenhouse's floor
// is x 64..416, y 64..224.
//
// The garden is plan B2's back garden (gardenRoom.ts), 464x512: the house
// (x 0..416, y 0..144) and the shed (x 0..160, y 144..256) are solid, the
// greenhouse stands in the lawn (x 256..416, y 304..416), and every garden
// door is in a building's face above the player (wall N), its landing 26 px
// below it. The shed door (80, 248) lands at (80, 274); the study door
// (344, 136) at (344, 162), the greenhouse door (336, 408) at (336, 434). The
// source plants stand along the south fence at y 472, x 80, 112 and 144. The
// side gate (432, 8), in the passage's north fence, leads to the front garden;
// the front garden's gate lands at (432, 34).
//
// The hallway's front door (240, 168), in its top wall at the corridor's
// centre, leads to the front garden at (336, 190); the front garden's door
// back (336, 216) lands in the hallway at (240, 194). The front garden is plan
// B3's (frontGardenRoom.ts), a 576x272 canvas: the road above y 96, bounds
// (0, 96) 576x128, its floor x 16..560, y 112..208, and every door in its south
// band facing up, its landing 26 px above it: door_house (336, 216) at
// (336, 190), the gate (544, 216) at (544, 190).
//
// Every walk ends against a wall or a solid piece of furniture, which stops
// the player in reach however late the key is released (backlog #81), or is
// a walkTo leg, which releases in the frame it arrives: from the study's
// hallway landing, right into the right wall (x 335.75) and down into the
// bottom wall (y 207.5), 17.9 px from the glass doors; from each garden
// landing, straight up into the face, 8.5 px below its door; from the
// greenhouse's landing straight down into its bottom wall (y 223.5), 8.5 px
// from its door; from the hallway's row up into its top wall (y 176.5), 8.5 px
// below the front door; along the front garden's landing row and down into
// its south band (y 207.5), 8.5 px above its door or gate; from the passage's
// landing up into its north fence (y 16.5), 8.5 px below the gate.

/** Uses the door in reach and waits for `room`. */
export async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

/**
 * From the shed floor: up into the top wall, then along it to the lounge door
 * and back (the return pass covers a release that carried past the door; it
 * does nothing while the door is in reach), and through it.
 */
export async function shedToLounge(page: Page): Promise<void> {
  await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
  const fromLeft = (await hook(page)).player.x < 240;
  await holdUntilNear(page, fromLeft ? 'ArrowRight' : 'ArrowLeft', 'door_lounge');
  await holdUntilNear(page, fromLeft ? 'ArrowLeft' : 'ArrowRight', 'door_lounge');
  await throughDoor(page, 'lounge');
}

/** From a lounge landing on the row y 190: right along the row into the right wall, and through its door. */
export async function loungeToHallway(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_hallway');
  await throughDoor(page, 'hallway');
}

/** From the hallway's lounge-door landing: right along the corridor into its right wall, and into the study. */
export async function hallwayToStudy(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_study');
  await throughDoor(page, 'study');
}

/**
 * From a study landing on the row y 190: right into the right wall unless
 * already above the glass doors (from the hallway's landing), then down into
 * the bottom wall, the doors in reach, and out into the garden.
 */
export async function studyToGarden(page: Page): Promise<void> {
  if ((await hook(page)).player.x < 300) await holdUntilAtLeast(page, 'ArrowRight', 'x', 330);
  await holdUntilNear(page, 'ArrowDown', 'door_garden');
  await throughDoor(page, 'garden');
}

/** From the garden's study-door landing (344, 162): straight up into the house's back face, and into the study. */
export async function gardenToStudy(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowUp', 'door_study');
  await throughDoor(page, 'study');
}

/**
 * The row a walk along to the shed door takes: 15 px below the door, so the
 * shed's face (y 256) is never in the way and the door, 8 px above the face's
 * edge, comes in reach 13 px either side of it wherever the row leg stopped.
 */
const SHED_DOOR_ROW = 263;

/**
 * From the study door's landing, or anywhere in the lawn not above or below
 * the greenhouse: to the shed door landing's row y 274 if above it, then up
 * to SHED_DOOR_ROW (a leg up stops on or above the row, never past the face),
 * along to the shed door, and through it.
 */
export async function gardenToShed(page: Page): Promise<void> {
  if ((await hook(page)).player.y < SHED_DOOR_ROW) await walkToRow(page, 274);
  const { x } = (await hook(page)).player;
  await walkTo(page, SHED_DOOR_ROW, x < 80 ? 'right' : 'left', 'door');
  await throughDoor(page, 'shed');
}

/** From the shed's start: down to the row y 200, in reach of the garden door in the bottom wall, and through it. */
export async function shedToGarden(page: Page): Promise<void> {
  await walkTo(page, 200, 'left', 'door');
  await throughDoor(page, 'garden');
}

/** As SHED_DOOR_ROW for the greenhouse door (336, 408): 16 px below it, the glass box's south face at y 416. */
const GREENHOUSE_DOOR_ROW = 424;

/**
 * From the shed door's landing, or anywhere in the lawn beside the
 * greenhouse rather than above it: to the greenhouse door landing's row
 * y 434 if above it, then up to GREENHOUSE_DOOR_ROW, along under the glass
 * box to its door, and in.
 */
export async function gardenToGreenhouse(page: Page): Promise<void> {
  if ((await hook(page)).player.y < GREENHOUSE_DOOR_ROW) await walkToRow(page, 434);
  const { x } = (await hook(page)).player;
  await walkTo(page, GREENHOUSE_DOOR_ROW, x < 336 ? 'right' : 'left', 'door_greenhouse');
  await throughDoor(page, 'greenhouse');
}

/** From the greenhouse's landing (240, 206): down into the bottom wall, its door in reach, and out to the garden. */
export async function greenhouseToGarden(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowDown', 'door_garden');
  await throughDoor(page, 'garden');
}

/**
 * From the hallway's lounge-door landing (114, 190): right along the row to
 * the front door's x 240 (stopped at most 6.25 px past it; the door, 22 px
 * above the row, never comes in reach on it), then straight up into the top
 * wall, the front door in reach, and out into the front garden.
 */
export async function hallwayToFront(page: Page): Promise<void> {
  await holdUntilAtLeast(page, 'ArrowRight', 'x', 240);
  await holdUntilNear(page, 'ArrowUp', 'door_front');
  await throughDoor(page, 'frontGarden');
}

/**
 * From the front garden's door landing (336, 190): right along the lawn to
 * the gate's x 544 (at most 6.25 px past it), then straight down into the
 * south band, the gate in reach, and through it to the back garden's passage.
 */
export async function frontToGate(page: Page): Promise<void> {
  await holdUntilAtLeast(page, 'ArrowRight', 'x', 544);
  await holdUntilNear(page, 'ArrowDown', 'gate');
  await throughDoor(page, 'garden');
}

/** From the back garden's gate landing (432, 34): straight up into the passage's north fence, and through the gate. */
export async function gardenGateToFront(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowUp', 'gate');
  await throughDoor(page, 'frontGarden');
}

/**
 * From the front garden's gate landing (544, 190): left along the lawn to the
 * front door's x 336 (at most 6.25 px past it), then straight down into the
 * house's front face, the door in reach, and into the hallway.
 */
export async function frontToHallway(page: Page): Promise<void> {
  await holdUntilAtMost(page, 'ArrowLeft', 'x', 336);
  await holdUntilNear(page, 'ArrowDown', 'door_house');
  await throughDoor(page, 'hallway');
}

/**
 * From the lounge's shed-door landing (240, 190): to the mantel straight up
 * into the fireplace; to the side table right into the right wall (by its
 * door), then up into the table.
 */
export async function toLoungePedestal(page: Page, pedestal: 1 | 2): Promise<void> {
  if (pedestal === 2) await holdUntilNear(page, 'ArrowRight', 'door_hallway');
  await holdUntilNear(page, 'ArrowUp', `pedestal_${String(pedestal)}`);
}
