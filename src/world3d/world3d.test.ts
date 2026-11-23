import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '../world/shedRoom';
import type Phaser from 'phaser';
import { setSurround, type World3d } from './world3d';

const hoisted = vi.hoisted(() => ({
  built: [] as unknown[],
  gate: { current: undefined as Promise<void> | undefined },
  fail: { current: false },
}));

vi.mock('./renderer', async () => {
  await hoisted.gate.current;
  return {
    Renderer: class {
      constructor() {
        if (hoisted.fail.current) throw new Error('renderer failed');
        hoisted.built.push(this);
      }
      frame = vi.fn();
      dispose = vi.fn();
      snapshot = vi.fn();
      playerAt = vi.fn();
    },
  };
});

const room = {} as Room;
const player = { x: 0, y: 0 };
const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

async function fresh(): Promise<World3d> {
  const { World3d } = await import('./world3d');
  return new World3d({} as HTMLCanvasElement);
}

function gated(): () => void {
  let release = (): void => undefined;
  hoisted.gate.current = new Promise<void>((r) => {
    release = r;
  });
  return () => {
    release();
  };
}

describe('World3d loading', () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.built.length = 0;
    hoisted.gate.current = undefined;
    hoisted.fail.current = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the renderer once the chunk has loaded', async () => {
    const w = await fresh();
    w.sync(true, room, player, [], 'spring', undefined);
    await flush();
    expect(hoisted.built).toHaveLength(1);
    expect(w.active).toBe(true);
  });

  it('does not build the renderer when dispose ran while the chunk loaded', async () => {
    const release = gated();
    const w = await fresh();
    w.sync(true, room, player, [], 'spring', undefined);
    w.dispose();
    release();
    await flush();
    expect(hoisted.built).toHaveLength(0);
    expect(w.active).toBe(false);
  });

  it('can start loading again after a dispose that cancelled a load', async () => {
    const release = gated();
    const w = await fresh();
    w.sync(true, room, player, [], 'spring', undefined);
    w.dispose();
    w.sync(true, room, player, [], 'spring', undefined);
    release();
    await flush();
    expect(hoisted.built).toHaveLength(1);
    expect(w.active).toBe(true);
  });

  it('warns once on a failed load, does not retry per frame, and retries after dispose', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    hoisted.fail.current = true;
    const w = await fresh();
    for (let i = 0; i < 5; i += 1) {
      w.sync(true, room, player, [], 'spring', undefined);
      await flush();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(w.active).toBe(false);

    hoisted.fail.current = false;
    w.sync(true, room, player, [], 'spring', undefined);
    await flush();
    expect(w.active).toBe(false);

    w.sync(false, room, player, [], 'spring', undefined);
    w.sync(true, room, player, [], 'spring', undefined);
    await flush();
    expect(w.active).toBe(true);
  });
});

describe('setSurround', () => {
  const colour = (clear: boolean): number[] => {
    const c = { r: -1, g: -1, b: -1, a: -1 };
    const game = {
      config: {
        backgroundColor: {
          setTo: (r: number, g: number, b: number, a: number) => Object.assign(c, { r, g, b, a }),
        },
      },
    } as unknown as Phaser.Game;
    setSurround(game, clear);
    return [c.r, c.g, c.b, c.a];
  };

  it('clears to transparent black with the 3D world on, so nothing is added over it', () => {
    expect(colour(true)).toEqual([0, 0, 0, 0]);
  });

  it('clears to the opaque surround with the 3D world off', () => {
    expect(colour(false)).toEqual([0x3e, 0x36, 0x32, 255]);
  });
});
