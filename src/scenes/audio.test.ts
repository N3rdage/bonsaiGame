import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../platform/settings';
import { SoundPlayer } from './audio';

/** A stub sound manager that records the keys it was asked to play. */
function stub(): { played: string[]; play: (key: string) => boolean } {
  const played: string[] = [];
  return {
    played,
    play: (key) => {
      played.push(key);
      return true;
    },
  };
}

describe('SoundPlayer', () => {
  it('plays nothing and keeps lastSound while the Sound switch is off', () => {
    const manager = stub();
    const settings: Settings = { ...DEFAULT_SETTINGS };
    const player = new SoundPlayer(manager, () => settings);
    player.play('door');
    settings.sound = false;
    player.play('water');
    expect(manager.played).toEqual(['door']);
    expect(player.lastSound).toBe('door');
    expect(player.plays).toBe(1);
  });

  it('plays and records the key while the switch is on, read live on every call', () => {
    const manager = stub();
    const settings: Settings = { ...DEFAULT_SETTINGS, sound: false };
    const player = new SoundPlayer(manager, () => settings);
    expect(player.lastSound).toBe('');
    settings.sound = true;
    player.play('water');
    expect(manager.played).toEqual(['water']);
    expect(player.lastSound).toBe('water');
  });

  it('ignores the Music switch', () => {
    const manager = stub();
    const player = new SoundPlayer(manager, () => ({ ...DEFAULT_SETTINGS, music: false }));
    player.play('coin');
    expect(manager.played).toEqual(['coin']);
  });

  it('swallows a manager that throws', () => {
    const player = new SoundPlayer(
      {
        play: () => {
          throw new Error('audio refused');
        },
      },
      () => DEFAULT_SETTINGS,
    );
    expect(() => {
      player.play('snip');
    }).not.toThrow();
    expect(player.lastSound).toBe('snip');
  });

  it('clicks after a tap whose action made no sound, and not after one that did', () => {
    const manager = stub();
    const player = new SoundPlayer(manager, () => DEFAULT_SETTINGS);
    player.tap(() => undefined);
    player.tap(() => {
      player.play('water');
    });
    expect(manager.played).toEqual(['click', 'water']);
  });

  it('reads the switch after the tap, so turning Sound off is silent and turning it on clicks', () => {
    const manager = stub();
    const settings: Settings = { ...DEFAULT_SETTINGS };
    const player = new SoundPlayer(manager, () => settings);
    player.tap(() => {
      settings.sound = false;
    });
    expect(manager.played).toEqual([]);
    player.tap(() => {
      settings.sound = true;
    });
    expect(manager.played).toEqual(['click']);
  });
});
