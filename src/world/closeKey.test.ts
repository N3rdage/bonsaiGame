import { describe, expect, it } from 'vitest';
import { closeKeyName, escapeReachesPage, isCloseKey, withCloseKey } from './closeKey';

const windowed = { fullscreen: false, escapeLocked: false };
const full = { fullscreen: true, escapeLocked: false };
const locked = { fullscreen: true, escapeLocked: true };

describe('closeKeyName', () => {
  it('names Esc outside fullscreen', () => {
    expect(closeKeyName(windowed)).toBe('Esc');
  });

  it('names Q in fullscreen, where the browser takes the first Escape', () => {
    expect(closeKeyName(full)).toBe('Q');
  });

  it('names Esc in fullscreen only while the lock is held', () => {
    expect(closeKeyName(locked)).toBe('Esc');
  });

  it('names no key while typing in fullscreen, as Q is text there', () => {
    expect(closeKeyName(full, true)).toBeUndefined();
    expect(closeKeyName(locked, true)).toBe('Esc');
    expect(closeKeyName(windowed, true)).toBe('Esc');
  });
});

describe('escapeReachesPage', () => {
  it('is false only in fullscreen without the lock', () => {
    expect(escapeReachesPage(windowed)).toBe(true);
    expect(escapeReachesPage(full)).toBe(false);
    expect(escapeReachesPage(locked)).toBe(true);
  });
});

describe('withCloseKey', () => {
  it('brackets the key and drops the brackets with none', () => {
    expect(withCloseKey('Close', 'Q')).toBe('Close (Q)');
    expect(withCloseKey('Title', 'Esc')).toBe('Title (Esc)');
    expect(withCloseKey('Close', undefined)).toBe('Close');
  });
});

describe('isCloseKey', () => {
  it('matches q in either case and nothing else', () => {
    expect(isCloseKey('q')).toBe(true);
    expect(isCloseKey('Q')).toBe(true);
    expect(isCloseKey('Escape')).toBe(false);
    expect(isCloseKey('w')).toBe(false);
  });
});
