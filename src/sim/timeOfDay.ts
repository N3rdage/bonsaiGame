/**
 * Time of day: how far the current game day has run, in game seconds, and the
 * phase of the day that puts it in. `GameState.timeOfDayS` holds the seconds;
 * the day clock (src/world/clock.ts) moves them and turns the day at
 * SECONDS_PER_DAY. 0 is morning, the moment the player wakes, so a day still
 * advances the world exactly once. Time of day is visual and informational:
 * growth, watering, revenue and the season depend on the day alone.
 */

/**
 * Game seconds in a day. The prototype's Step_0 used `_seconds_per_day = 300`;
 * this game uses 900 (15 real minutes at the base time scale) by the owner's decision.
 */
export const SECONDS_PER_DAY = 900;

export const DAY_PHASES = ['dawn', 'day', 'dusk', 'night'] as const;
export type DayPhase = (typeof DAY_PHASES)[number];

/**
 * Where each phase starts, in seconds into the day: dawn the first minute,
 * day until 10 minutes in, dusk for a minute and a half, then night for the
 * last three and a half minutes until the next morning.
 */
export const DAY_PHASE_STARTS: Readonly<Record<DayPhase, number>> = {
  dawn: 0,
  day: 60,
  dusk: 600,
  night: 690,
};

export interface TimeOfDay {
  /** How far through the day, in [0, 1); 0 is morning. */
  readonly fraction: number;
  readonly phase: DayPhase;
}

/** The time of day `seconds` into a day; seconds outside [0, SECONDS_PER_DAY) wrap into it. */
export function timeOfDay(seconds: number): TimeOfDay {
  const s = ((seconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  let phase: DayPhase = 'dawn';
  for (const p of DAY_PHASES) if (s >= DAY_PHASE_STARTS[p]) phase = p;
  return { fraction: s / SECONDS_PER_DAY, phase };
}

/** The time-speed choices: the day clock runs this many times faster than real time. */
export const TIME_SPEEDS = [1, 2, 4] as const;
export type TimeSpeed = (typeof TIME_SPEEDS)[number];

/** The speed after `speed` in TIME_SPEEDS, wrapping from the last back to 1x. */
export function nextTimeSpeed(speed: TimeSpeed): TimeSpeed {
  return TIME_SPEEDS[(TIME_SPEEDS.indexOf(speed) + 1) % TIME_SPEEDS.length] ?? 1;
}

/** `value` as a TimeSpeed, or undefined when it is not one of TIME_SPEEDS. */
export function parseTimeSpeed(value: unknown): TimeSpeed | undefined {
  return TIME_SPEEDS.find((s) => s === value);
}

/** Real seconds one day takes at `speed` (900 s at 1x). */
export function realSecondsPerDay(speed: TimeSpeed): number {
  return SECONDS_PER_DAY / speed;
}
