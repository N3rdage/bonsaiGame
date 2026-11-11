import { describe, expect, it } from 'vitest';
import { isDormant, nextActiveSeason, seasonTipFor } from './seasonTip';
import { DAYS_PER_SEASON, SEASONS } from './seasons';
import { SPECIES } from './species';
import { createNewGameState } from './state';
import { spawnTree } from './tree';
import type { GameState, SpeciesKey } from './types';

/** The first day of winter in year one, and the autumn day before it. */
const WINTER = 3 * DAYS_PER_SEASON + 1;
const LAST_AUTUMN = WINTER - 1;

/** A game on `day` owning one tree of each of `species` (Granny's juniper removed). */
function owning(day: number, ...species: SpeciesKey[]): GameState {
  const state = createNewGameState();
  state.trees = [];
  for (const key of species) {
    const tree = spawnTree(state, key, 'seed');
    tree.location = 'shed';
    state.trees.push(tree);
  }
  state.day = day;
  return state;
}

describe('dormancy from the species data', () => {
  it('rests a species in exactly the seasons missing from seasonsActive', () => {
    for (const species of Object.values(SPECIES)) {
      for (const season of SEASONS) {
        expect(isDormant(species, season)).toBe(!species.seasonsActive.includes(season));
      }
    }
  });

  it('wakes the maple in spring after winter', () => {
    expect(nextActiveSeason(SPECIES.maple, 'winter')).toBe('spring');
  });
});

describe('seasonTipFor', () => {
  it('fires on the day the season turns to one where an owned tree is dormant', () => {
    expect(seasonTipFor(owning(WINTER, 'pine', 'maple'), LAST_AUTUMN)).toBe(
      'Winter: Japanese Maple is dormant. Growth and fertilising pause until spring. Watch the badge top-left.',
    );
  });

  it('fires across a clock tick of several days that crosses the turn', () => {
    expect(seasonTipFor(owning(WINTER + 2, 'maple'), LAST_AUTUMN - 1)).toBeDefined();
  });

  it('does not fire on a day inside the season', () => {
    expect(seasonTipFor(owning(WINTER + 1, 'maple'), WINTER)).toBeUndefined();
    expect(seasonTipFor(owning(LAST_AUTUMN, 'maple'), LAST_AUTUMN - 1)).toBeUndefined();
  });

  it('does not fire on a turn to a season no owned tree rests in', () => {
    expect(seasonTipFor(owning(WINTER, 'pine'), LAST_AUTUMN)).toBeUndefined();
    expect(seasonTipFor(owning(DAYS_PER_SEASON + 1, 'maple'), DAYS_PER_SEASON)).toBeUndefined();
  });

  it('ignores sold trees', () => {
    const state = owning(WINTER, 'maple', 'pine');
    for (const tree of state.trees) if (tree.speciesKey === 'maple') tree.location = 'sold';
    expect(seasonTipFor(state, LAST_AUTUMN)).toBeUndefined();
  });

  it('fires only once a game', () => {
    const state = owning(WINTER, 'maple');
    state.seasonTipShown = true;
    expect(seasonTipFor(state, LAST_AUTUMN)).toBeUndefined();
  });

  it("fires for a new game's juniper too: the species data rests it in winter", () => {
    const state = createNewGameState();
    state.day = WINTER;
    expect(seasonTipFor(state, LAST_AUTUMN)).toMatch(/^Winter: Juniper is dormant\. /);
  });
});
