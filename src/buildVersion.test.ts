import { describe, expect, it } from 'vitest';
import { commitUrl, formatBuildVersion, shortCommit, UNKNOWN_COMMIT } from './buildVersion';

describe('formatBuildVersion', () => {
  it('is the commit date and the CI run number', () => {
    expect(formatBuildVersion('2026-11-10T09:15:00Z', 142)).toBe('2026.11.10.142');
    expect(formatBuildVersion(new Date(Date.UTC(2026, 10, 10, 9, 15)), '142')).toBe(
      '2026.11.10.142',
    );
  });

  it('falls back to build 0 locally', () => {
    expect(formatBuildVersion('2026-11-10T09:15:00Z', undefined)).toBe('2026.11.10.0');
    expect(formatBuildVersion('2026-11-10T09:15:00Z', '')).toBe('2026.11.10.0');
    expect(formatBuildVersion('2026-11-10T09:15:00Z', 'abc')).toBe('2026.11.10.0');
  });

  it('dates the commit in UTC', () => {
    // 23:30 at UTC-5 is 04:30 the next day in UTC.
    expect(formatBuildVersion('2026-11-10T23:30:00-05:00', 7)).toBe('2026.11.11.7');
    expect(formatBuildVersion('2026-12-31T23:30:00-05:00', 7)).toBe('2027.01.01.7');
  });

  it('pads single-digit months and days', () => {
    expect(formatBuildVersion('2027-03-04T12:00:00Z', 9)).toBe('2027.03.04.9');
  });

  it('falls back to a zero date when there is no commit date', () => {
    expect(formatBuildVersion('', undefined)).toBe('0000.00.00.0');
  });
});

describe('commit helpers', () => {
  const sha = '6d2152e0a1b2c3d4e5f60718293a4b5c6d7e8f90';

  it('shortens a SHA to seven characters and keeps unknown whole', () => {
    expect(shortCommit(sha)).toBe('6d2152e');
    expect(shortCommit(UNKNOWN_COMMIT)).toBe('unknown');
  });

  it('links the commit on GitHub', () => {
    expect(commitUrl(sha)).toBe(`https://github.com/N3rdage/bonsaiGame/commit/${sha}`);
  });
});
