/**
 * The benchmark's result on screen: a DOM panel over the game, big enough to
 * read and photograph on a phone, with a Close button at least 44 CSS px tall.
 * Styled through `element.style`, which the page's CSP allows.
 */

import type { BenchResult } from './bench';

/** The smallest tap target, CSS px. */
const TAP = 44;

/** The lines the panel shows. */
export function benchLines(result: BenchResult): string[] {
  return [
    `Benchmark  ${result.room}`,
    `fps ${String(result.fps)}  (${String(result.frames)} frames)`,
    `median ${String(result.medianMs)} ms  p95 ${String(result.p95Ms)} ms`,
    `worst ${String(result.worstMs)} ms`,
    `draw calls ${String(result.drawCalls)} (max ${String(result.drawCallsMax)})`,
    `render ${String(result.width)}x${String(result.height)} @${String(result.dpr)}x`,
    result.userAgent,
  ];
}

/** Shows `result` over the game; Close removes the panel. Returns the panel. */
export function showBench(result: BenchResult): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'bench-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '8px',
    top: '8px',
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
    zIndex: '10',
    padding: '10px 12px',
    background: 'rgba(20,14,18,0.9)',
    color: '#f4ecd8',
    font: '14px/1.4 monospace',
    borderRadius: '6px',
    pointerEvents: 'auto',
  });
  const text = document.createElement('pre');
  text.id = 'bench-text';
  Object.assign(text.style, {
    margin: '0 0 8px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  });
  text.textContent = benchLines(result).join('\n');
  const close = document.createElement('button');
  close.id = 'bench-close';
  close.type = 'button';
  close.textContent = 'Close';
  Object.assign(close.style, {
    minWidth: `${String(TAP)}px`,
    minHeight: `${String(TAP)}px`,
    padding: '0 16px',
    font: 'inherit',
    color: '#20140f',
    background: '#f4ecd8',
    border: '0',
    borderRadius: '6px',
  });
  close.addEventListener('click', () => {
    panel.remove();
  });
  panel.append(text, close);
  document.body.appendChild(panel);
  return panel;
}
