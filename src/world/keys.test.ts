import { describe, expect, it } from 'vitest';
import { onKeyDown, type KeyEmitter } from './keys';

type Listener = (event: KeyboardEvent) => void;

/** A stand-in for Phaser's keyboard plugin: records listeners and emits to them. */
function fakeKeyboard(): KeyEmitter & { emit(name: string, event: KeyboardEvent): void } {
  const listeners = new Map<string, Listener[]>();
  return {
    on(name: string, fn: Listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    },
    emit(name: string, event: KeyboardEvent) {
      for (const fn of listeners.get(name) ?? []) fn(event);
    },
  };
}

const keyEvent = (): KeyboardEvent => ({}) as KeyboardEvent;

describe('onKeyDown', () => {
  it('runs the handler once when Phaser replays the same event object', () => {
    const keyboard = fakeKeyboard();
    const seen: KeyboardEvent[] = [];
    onKeyDown(keyboard, 'ESC', (e) => seen.push(e));
    const event = keyEvent();
    keyboard.emit('keydown-ESC', event);
    keyboard.emit('keydown-ESC', event);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(event);
  });

  it('runs the handler for each distinct event', () => {
    const keyboard = fakeKeyboard();
    let calls = 0;
    onKeyDown(keyboard, 'E', () => calls++);
    keyboard.emit('keydown-E', keyEvent());
    keyboard.emit('keydown-E', keyEvent());
    expect(calls).toBe(2);
  });

  it('listens only to its own key', () => {
    const keyboard = fakeKeyboard();
    let calls = 0;
    onKeyDown(keyboard, 'V', () => calls++);
    keyboard.emit('keydown-E', keyEvent());
    expect(calls).toBe(0);
  });
});
