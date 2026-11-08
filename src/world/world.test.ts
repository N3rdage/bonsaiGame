import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { hudText } from './hud';
import {
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_RADIUS,
  MAX_STEPS_PER_FRAME,
  STEP_MS,
  fixedSteps,
  joystickInput,
  keyboardInput,
} from './input';
import {
  MOVE_SPEED,
  WALK_ANIM_STEP,
  createPlayer,
  stepPlayer,
  type MoveInput,
  type PlayerState,
} from './player';
import { SHED_ROOM, WALL_THICKNESS, fromPrototype, hitsWall, type Room } from './shedRoom';

describe('shed room', () => {
  it('halves every prototype coordinate onto the 480x270 canvas', () => {
    expect(fromPrototype(960)).toBe(480);
    expect(SHED_ROOM.width).toBe(480);
    expect(SHED_ROOM.height).toBe(270);
    expect(SHED_ROOM.playerStart).toEqual({ x: 240, y: 135 });
    expect(SHED_ROOM.edgeMargin).toBe(4);
    expect(SHED_ROOM.props.map((p) => [p.key, p.x, p.y])).toEqual([
      ['workbench', 125, 90],
      ['planting_table', 165, 90],
      ['shop_kiosk', 125, 145],
      ['pedestal_1', 310, 85],
      ['pedestal_2', 350, 85],
      ['door', 232, 208],
    ]);
  });

  it('walls the edges with strips thinner than the clamp margin', () => {
    expect(WALL_THICKNESS).toBe(2);
    expect(WALL_THICKNESS).toBeLessThan(SHED_ROOM.edgeMargin);
    expect(hitsWall(SHED_ROOM, 1, 135)).toBe(true);
    expect(hitsWall(SHED_ROOM, 479, 135)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 1)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 269)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 135)).toBe(false);
  });
});

describe('player movement', () => {
  const still: MoveInput = { x: 0, y: 0 };
  const start = (): PlayerState => createPlayer(SHED_ROOM);

  it('starts at the room start, facing down, standing still', () => {
    expect(start()).toEqual({ x: 240, y: 135, facing: 'down', walkAnim: 0 });
  });

  it('moves 2.5 prototype px (1.25 logical px) per step', () => {
    expect(MOVE_SPEED).toBe(1.25);
    expect(stepPlayer(start(), { x: 1, y: 0 }, SHED_ROOM)).toMatchObject({ x: 241.25, y: 135 });
    expect(stepPlayer(start(), { x: 0, y: -1 }, SHED_ROOM)).toMatchObject({ x: 240, y: 133.75 });
  });

  it('normalises diagonals to the same speed', () => {
    const p = stepPlayer(start(), { x: 1, y: 1 }, SHED_ROOM);
    expect(Math.hypot(p.x - 240, p.y - 135)).toBeCloseTo(1.25);
    expect(p.x - 240).toBeCloseTo(1.25 / Math.SQRT2);
  });

  it('clamps out-of-range input', () => {
    expect(stepPlayer(start(), { x: 3, y: 0 }, SHED_ROOM).x).toBe(241.25);
  });

  it('clamps the player 4 px inside the room', () => {
    let p = start();
    for (let i = 0; i < 400; i += 1) p = stepPlayer(p, { x: -1, y: -1 }, SHED_ROOM);
    expect(p).toMatchObject({ x: 4, y: 4 });
    for (let i = 0; i < 600; i += 1) p = stepPlayer(p, { x: 1, y: 1 }, SHED_ROOM);
    expect(p).toMatchObject({ x: 476, y: 266 });
  });

  it('stops at a wall per axis and slides along it', () => {
    const room: Room = { ...SHED_ROOM, walls: [{ x: 242, y: 0, w: 10, h: 270 }] };
    const p = stepPlayer({ ...start(), x: 241.5 }, { x: 1, y: 1 }, room);
    expect(p.x).toBe(241.5);
    expect(p.y).toBeCloseTo(135 + 1.25 / Math.SQRT2);
  });

  it('faces the input direction with 0.5 thresholds, horizontal first', () => {
    const face = (input: MoveInput): string => stepPlayer(start(), input, SHED_ROOM).facing;
    expect(face({ x: 1, y: 0 })).toBe('right');
    expect(face({ x: -1, y: 0 })).toBe('left');
    expect(face({ x: 0, y: 1 })).toBe('down');
    expect(face({ x: 0, y: -1 })).toBe('up');
    // Diagonals normalise to 0.707 on each axis, so horizontal wins.
    expect(face({ x: -1, y: -1 })).toBe('left');
    // Below the threshold the facing is kept.
    expect(stepPlayer({ ...start(), facing: 'up' }, { x: 0.4, y: 0 }, SHED_ROOM).facing).toBe('up');
    expect(stepPlayer({ ...start(), facing: 'left' }, still, SHED_ROOM).facing).toBe('left');
  });

  it('advances the walk cycle 0.14 per moving step, wraps at 4, resets when still', () => {
    expect(WALK_ANIM_STEP).toBe(0.14);
    let p = start();
    p = stepPlayer(p, { x: 1, y: 0 }, SHED_ROOM);
    expect(p.walkAnim).toBeCloseTo(0.14);
    p = stepPlayer({ ...p, walkAnim: 3.9 }, { x: 1, y: 0 }, SHED_ROOM);
    expect(p.walkAnim).toBeCloseTo(0.04);
    expect(stepPlayer(p, still, SHED_ROOM).walkAnim).toBe(0);
  });
});

describe('input', () => {
  it('reads keys as right minus left and down minus up', () => {
    const none = { left: false, right: false, up: false, down: false };
    expect(keyboardInput({ ...none, right: true })).toEqual({ x: 1, y: 0 });
    expect(keyboardInput({ ...none, left: true, up: true })).toEqual({ x: -1, y: -1 });
    expect(keyboardInput({ ...none, left: true, right: true })).toEqual({ x: 0, y: 0 });
  });

  it('reads the joystick with a dead zone, saturating at its radius', () => {
    expect(JOYSTICK_DEAD_ZONE).toBe(4);
    expect(JOYSTICK_RADIUS).toBe(24);
    expect(joystickInput(3, 0)).toEqual({ x: 0, y: 0 });
    expect(joystickInput(12, 0)).toEqual({ x: 0.5, y: 0 });
    expect(joystickInput(0, -48)).toEqual({ x: 0, y: -1 });
  });

  it('runs fixed 60 Hz steps whatever the frame time', () => {
    expect(STEP_MS).toBeCloseTo(16.667, 3);
    // 120 Hz display: a step every other frame.
    const a = fixedSteps(0, 1000 / 120);
    expect(a.steps).toBe(0);
    expect(fixedSteps(a.accumulatorMs, 1000 / 120).steps).toBe(1);
    // 30 Hz display: two steps a frame.
    expect(fixedSteps(0, 1000 / 30 + 0.001).steps).toBe(2);
    // One second at any frame rate is 60 steps.
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < 144; i += 1) {
      const r = fixedSteps(acc, 1000 / 144);
      acc = r.accumulatorMs;
      steps += r.steps;
    }
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });

  it('caps the steps after a stall and drops the backlog', () => {
    expect(fixedSteps(0, 2000)).toEqual({ steps: MAX_STEPS_PER_FRAME, accumulatorMs: 0 });
  });
});

describe('HUD badge', () => {
  it('reads Spring 1/28, Day 0, $100 for a new game', () => {
    expect(hudText(createNewGameState())).toBe('Spring 1/28  |  Day 0  |  $100');
  });

  it('shows the raw day with the day of season', () => {
    expect(hudText({ day: 29, money: 250 })).toBe('Summer 1/28  |  Day 29  |  $250');
    expect(hudText({ day: 112, money: 0 })).toBe('Winter 28/28  |  Day 112  |  $0');
  });
});
