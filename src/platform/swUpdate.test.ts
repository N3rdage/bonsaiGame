import { afterEach, describe, expect, it } from 'vitest';
import { handleNeedReload, planReload, registerSaveBeforeReload } from './swUpdate';

const unregisters: (() => void)[] = [];

function register(save: () => void): () => void {
  const unregister = registerSaveBeforeReload(save);
  unregisters.push(unregister);
  return unregister;
}

afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister();
});

describe('planReload', () => {
  it('saves first with a world running, reloads at once without', () => {
    expect(planReload(true)).toBe('save-then-reload');
    expect(planReload(false)).toBe('reload');
  });
});

describe('handleNeedReload', () => {
  it('runs the registered save before the reload', () => {
    const calls: string[] = [];
    register(() => calls.push('save'));
    handleNeedReload(() => calls.push('reload'));
    expect(calls).toEqual(['save', 'reload']);
  });

  it('reloads at once with no save registered', () => {
    const calls: string[] = [];
    handleNeedReload(() => calls.push('reload'));
    expect(calls).toEqual(['reload']);
  });

  it('still reloads when the save throws', () => {
    const calls: string[] = [];
    register(() => {
      calls.push('save');
      throw new Error('storage full');
    });
    handleNeedReload(() => calls.push('reload'));
    expect(calls).toEqual(['save', 'reload']);
  });

  it('does not call a save that was unregistered', () => {
    const calls: string[] = [];
    const unregister = register(() => calls.push('save'));
    unregister();
    handleNeedReload(() => calls.push('reload'));
    expect(calls).toEqual(['reload']);
  });

  it('a later registration replaces the earlier, whose unregister then does nothing', () => {
    const calls: string[] = [];
    const unregisterFirst = register(() => calls.push('first'));
    register(() => calls.push('second'));
    unregisterFirst();
    handleNeedReload(() => calls.push('reload'));
    expect(calls).toEqual(['second', 'reload']);
  });
});
