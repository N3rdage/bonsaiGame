import { describe, expect, it } from 'vitest';
import { PHONE_MAX_SHORT_SIDE, isPhone, isPhonePortrait } from './orientation';

const S22_PORTRAIT = { width: 384, height: 824, touch: true };
const S22_LANDSCAPE = { width: 824, height: 384, touch: true };

describe('orientation', () => {
  it('a phone is a touch screen with a short side under 500 CSS px', () => {
    expect(PHONE_MAX_SHORT_SIDE).toBe(500);
    expect(isPhone(S22_PORTRAIT)).toBe(true);
    expect(isPhone(S22_LANDSCAPE)).toBe(true);
    expect(isPhone({ width: 412, height: 839, touch: true })).toBe(true);
    expect(isPhone({ width: 499, height: 900, touch: true })).toBe(true);
    expect(isPhone({ width: 500, height: 900, touch: true })).toBe(false);
  });

  it('prompts to rotate only on a phone held in portrait', () => {
    expect(isPhonePortrait(S22_PORTRAIT)).toBe(true);
    expect(isPhonePortrait(S22_LANDSCAPE)).toBe(false);
    expect(isPhonePortrait({ width: 400, height: 400, touch: true })).toBe(false);
  });

  it('leaves tablets and desktop windows alone in any shape', () => {
    expect(isPhonePortrait({ width: 768, height: 1024, touch: true })).toBe(false);
    expect(isPhonePortrait({ width: 384, height: 824, touch: false })).toBe(false);
    expect(isPhone({ width: 1920, height: 1080, touch: false })).toBe(false);
    expect(isPhone({ width: 1280, height: 720, touch: true })).toBe(false);
  });
});
