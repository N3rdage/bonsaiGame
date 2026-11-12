import { describe, expect, it } from 'vitest';
import { MUSIC_FADE_MS, MUSIC_VOLUME } from '../platform/audio';
import { DEFAULT_SETTINGS, type Settings } from '../platform/settings';
import { MusicPlayer, SoundPlayer, type MusicSound } from './audio';

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

/** A fake loop that records its state and volume. */
interface FakeLoop extends MusicSound {
  readonly key: string;
  volume: number;
  state: 'new' | 'playing' | 'paused' | 'stopped';
  destroyed: boolean;
}

/** A fake music manager that keeps every loop it added. */
function musicStub(): { loops: FakeLoop[]; add: (key: string) => FakeLoop } {
  const loops: FakeLoop[] = [];
  return {
    loops,
    add: (key) => {
      const loop: FakeLoop = {
        key,
        volume: 0,
        state: 'new',
        destroyed: false,
        play: () => set('playing'),
        stop: () => set('stopped'),
        pause: () => set('paused'),
        resume: () => set('playing'),
        setVolume: (v) => {
          loop.volume = v;
        },
        destroy: () => {
          loop.destroyed = true;
        },
      };
      const set = (state: FakeLoop['state']): boolean => {
        loop.state = state;
        return true;
      };
      loops.push(loop);
      return loop;
    },
  };
}

/** The loops still sounding, as key@volume. */
function sounding(loops: FakeLoop[]): string[] {
  return loops.filter((l) => l.state !== 'stopped').map((l) => `${l.key}@${l.volume.toFixed(2)}`);
}

describe('MusicPlayer', () => {
  it('fades the first loop in from silence over the fade time', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => DEFAULT_SETTINGS);
    music.play('shed');
    expect(music.track).toBe('shed');
    expect(sounding(manager.loops)).toEqual(['shed@0.00']);
    music.update(MUSIC_FADE_MS / 2);
    expect(sounding(manager.loops)).toEqual([`shed@${(MUSIC_VOLUME / 2).toFixed(2)}`]);
    music.update(MUSIC_FADE_MS);
    expect(sounding(manager.loops)).toEqual([`shed@${MUSIC_VOLUME.toFixed(2)}`]);
  });

  it('cross-fades to a new loop and stops the old one when it reaches silence', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => DEFAULT_SETTINGS);
    music.play('shed');
    music.update(MUSIC_FADE_MS);
    music.play('garden');
    expect(music.track).toBe('garden');
    music.update(MUSIC_FADE_MS / 4);
    expect(sounding(manager.loops)).toEqual(['shed@0.30', 'garden@0.10']);
    music.update(MUSIC_FADE_MS / 2);
    expect(sounding(manager.loops)).toEqual(['shed@0.10', 'garden@0.30']);
    music.update(MUSIC_FADE_MS / 4);
    expect(sounding(manager.loops)).toEqual(['garden@0.40']);
    expect(manager.loops[0]?.destroyed).toBe(true);
  });

  it('does nothing when the loop asked for already plays', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => DEFAULT_SETTINGS);
    music.play('house');
    music.play('house');
    expect(manager.loops).toHaveLength(1);
  });

  it('with Music off plays nothing, and switching it on starts the place loop', () => {
    const manager = musicStub();
    const settings: Settings = { ...DEFAULT_SETTINGS, music: false };
    const music = new MusicPlayer(manager, () => settings);
    music.play('shed');
    music.play('garden');
    expect(music.track).toBe('');
    expect(manager.loops).toEqual([]);
    settings.music = true;
    music.refresh();
    expect(music.track).toBe('garden');
    expect(sounding(manager.loops)).toEqual(['garden@0.00']);
  });

  it('switching Music off stops every loop at once, mid-fade too', () => {
    const manager = musicStub();
    const settings: Settings = { ...DEFAULT_SETTINGS };
    const music = new MusicPlayer(manager, () => settings);
    music.play('shed');
    music.update(MUSIC_FADE_MS);
    music.play('viewer');
    settings.music = false;
    music.refresh();
    expect(music.track).toBe('');
    expect(sounding(manager.loops)).toEqual([]);
    expect(manager.loops.every((l) => l.destroyed)).toBe(true);
  });

  it('pauses and resumes every loop sounding, and the fade waits for update', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => DEFAULT_SETTINGS);
    music.play('shed');
    music.update(MUSIC_FADE_MS);
    music.play('garden');
    music.pause();
    expect(music.paused).toBe(true);
    expect(manager.loops.map((l) => l.state)).toEqual(['paused', 'paused']);
    music.resume();
    expect(music.paused).toBe(false);
    expect(manager.loops.map((l) => l.state)).toEqual(['playing', 'playing']);
    expect(sounding(manager.loops)).toEqual(['shed@0.40', 'garden@0.00']);
  });

  it('pause sets paused and resume clears it, harmless with no loops', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => ({ ...DEFAULT_SETTINGS, music: false }));
    expect(music.paused).toBe(false);
    music.pause();
    expect(music.paused).toBe(true);
    music.resume();
    expect(music.paused).toBe(false);
    expect(manager.loops).toEqual([]);
  });

  it('stop silences everything and forgets the place', () => {
    const manager = musicStub();
    const music = new MusicPlayer(manager, () => DEFAULT_SETTINGS);
    music.play('shed');
    music.stop();
    music.refresh();
    expect(music.track).toBe('');
    expect(sounding(manager.loops)).toEqual([]);
  });

  it('swallows a manager that throws', () => {
    const music = new MusicPlayer(
      {
        add: () => {
          throw new Error('audio refused');
        },
      },
      () => DEFAULT_SETTINGS,
    );
    expect(() => {
      music.play('garden');
      music.update(16);
      music.pause();
      music.resume();
      music.stop();
    }).not.toThrow();
  });
});
