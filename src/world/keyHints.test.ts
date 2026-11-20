import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_PLANT,
  TUTORIAL_TAKE_CUTTING,
  TUTORIAL_WATER,
  tutorialStepBody,
} from '../sim/tutorial';
import { inputModeFor, keyLabel, keyProse, notebookHint } from './keyHints';

describe('input mode', () => {
  it('is touch on a touch screen and keyboard otherwise', () => {
    expect(inputModeFor(true)).toBe('touch');
    expect(inputModeFor(false)).toBe('keyboard');
  });
});

describe('keyLabel', () => {
  const labels = [
    ['View tree (V)', 'View tree'],
    ['Notebook (J)', 'Notebook'],
    ['Interact (E)', 'Interact'],
    ['Inventory (I)', 'Inventory'],
    ['Sleep (Z)', 'Sleep'],
    ['Save (F5)', 'Save'],
    ['Load (F9)', 'Load'],
    ['Title (Esc)', 'Title'],
    ['New Game (Enter)', 'New Game'],
    ['Sleep a week', 'Sleep a week'],
    ['Menu', 'Menu'],
  ] as const;

  it('keeps the bracketed key with a keyboard', () => {
    for (const [label] of labels) expect(keyLabel(label, 'keyboard')).toBe(label);
  });

  it('drops the bracketed key by touch', () => {
    for (const [label, bare] of labels) expect(keyLabel(label, 'touch')).toBe(bare);
  });
});

describe('keyProse', () => {
  it('leaves the text as written with a keyboard', () => {
    for (const step of [TUTORIAL_WATER, TUTORIAL_TAKE_CUTTING, TUTORIAL_PLANT]) {
      expect(keyProse(tutorialStepBody(step), 'keyboard')).toBe(tutorialStepBody(step));
    }
  });

  it('names what to tap, and no key, by touch', () => {
    expect(keyProse(tutorialStepBody(TUTORIAL_WATER), 'touch')).toBe(
      "Walk to Granny's juniper and tap Interact to inspect it, then tap Water.",
    );
    expect(keyProse(tutorialStepBody(TUTORIAL_TAKE_CUTTING), 'touch')).toBe(
      'Head out to the back garden, walk to the source plant and tap Interact.',
    );
    expect(keyProse(tutorialStepBody(TUTORIAL_PLANT), 'touch')).toBe(
      'Walk to the workbench and tap Interact, select your cutting, and tap Plant.',
    );
    expect(
      keyProse('You can still figure things out by walking up to objects and pressing E.', 'touch'),
    ).toBe('You can still figure things out by walking up to objects and tapping Interact.');
  });
});

describe('keyProse and the notebook button', () => {
  it('names the Notebook button, not J, by touch', () => {
    const text = 'flip back here any time with J.';
    expect(keyProse(text, 'keyboard')).toBe(text);
    expect(keyProse(text, 'touch')).toBe('flip back here any time with the Notebook button.');
  });
});

describe('notebookHint', () => {
  it('names J with a keyboard and the button by touch', () => {
    expect(notebookHint('keyboard')).toBe('Press J for notebook');
    expect(notebookHint('touch')).toBe('Tap Notebook for notes');
  });
});
