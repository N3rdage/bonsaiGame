/**
 * The engine pages' shared DOM overlay (backlog #378), engine-neutral: the
 * live numbers (fps, frame time median and worst over the last 3 s, draw
 * calls, the GPU), the benchmark button and its result, the link to the
 * other engine's page, the help line, and the touch stick bottom-left. Laid
 * out for a phone held landscape first (an S22 Ultra is 824 x 384 CSS px).
 */

import './overlay.css';
import type { FrameStats } from './bench';
import { stickInput, type MoveInput } from './movement';

/** The engine pages, in the order the overlay links them. */
export const ENGINE_PAGES = [
  { engine: 'three', label: 'Three.js', href: 'engine-three.html' },
  { engine: 'babylon', label: 'Babylon.js', href: 'engine-babylon.html' },
] as const;

/** The GPU's name where the browser tells it (WEBGL_debug_renderer_info), else the masked RENDERER string. */
export function webglRendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return typeof name === 'string' ? name : 'unknown';
}

/** The live line's text. */
export function statsText(
  engine: string,
  s: FrameStats,
  drawCalls: number,
  renderer: string,
): string {
  return [
    `${engine}  ${s.fps.toFixed(0)} fps`,
    `frame median ${s.medianMs.toFixed(1)} ms, worst ${s.worstMs.toFixed(1)} ms (3 s)`,
    `draw calls ${String(drawCalls)}`,
    renderer,
  ].join('\n');
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  id: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.id = id;
  parent.append(node);
  return node;
};

export class Overlay {
  /** Called when the benchmark button is pressed. */
  onBench?: () => void;
  /** Called when the stress button is pressed. */
  onStress?: () => void;
  /** The stick's analog vector, x right and y down, length 0..1. */
  stick: MoveInput = { x: 0, y: 0 };

  private readonly stats: HTMLPreElement;
  private readonly benchButton: HTMLButtonElement;
  private readonly stressButton: HTMLButtonElement;
  private readonly result: HTMLDivElement;
  private readonly resultText: HTMLPreElement;
  private readonly knob: HTMLDivElement;

  constructor(engine: string, benchSeconds: number) {
    const root = el('div', 'spike-overlay', document.body);
    this.stats = el('pre', 'spike-stats', root);

    const controls = el('div', 'spike-controls', root);
    for (const page of ENGINE_PAGES) {
      if (page.engine === engine) continue;
      const link = el('a', `spike-link-${page.engine}`, controls);
      link.href = page.href;
      link.textContent = `${page.label} page`;
    }
    this.benchButton = el('button', 'spike-bench', controls);
    this.benchButton.type = 'button';
    this.benchButton.textContent = `Benchmark ${String(benchSeconds)} s`;
    this.benchButton.addEventListener('click', () => {
      this.onBench?.();
    });
    this.stressButton = el('button', 'spike-stress', controls);
    this.stressButton.type = 'button';
    this.stressButton.textContent = 'Stress';
    this.stressButton.addEventListener('click', () => {
      this.onStress?.();
    });

    const help = el('div', 'spike-help', root);
    help.textContent = 'WASD/arrows or stick: walk · drag: turn · pinch/wheel: zoom · Q/E: turn';

    this.result = el('div', 'spike-result', root);
    this.result.hidden = true;
    this.resultText = el('pre', 'spike-result-text', this.result);
    const close = el('button', 'spike-result-close', this.result);
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => {
      this.result.hidden = true;
    });

    const stick = el('div', 'spike-stick', root);
    this.knob = el('div', 'spike-knob', stick);
    this.attachStick(stick);
  }

  showStats(text: string): void {
    if (this.stats.textContent !== text) this.stats.textContent = text;
  }

  /** While a run is under way the button counts it down and does nothing. */
  setBenchRunning(secondsLeft: number | undefined): void {
    this.stressButton.disabled = secondsLeft !== undefined;
    this.benchButton.disabled = secondsLeft !== undefined;
    this.benchButton.textContent =
      secondsLeft === undefined
        ? this.benchButton.textContent.startsWith('Running')
          ? 'Benchmark again'
          : this.benchButton.textContent
        : `Running… ${secondsLeft.toFixed(0)} s`;
  }

  /** While a stress run is under way the buttons do nothing and the stress button names the step. */
  setStressRunning(label: string | undefined): void {
    this.stressButton.disabled = label !== undefined;
    this.benchButton.disabled = label !== undefined;
    this.stressButton.textContent = label ?? 'Stress again';
  }

  showResult(text: string): void {
    this.resultText.textContent = text;
    this.result.hidden = false;
  }

  private attachStick(stick: HTMLDivElement): void {
    let origin: { id: number; x: number; y: number } | undefined;
    const move = (dx: number, dy: number): void => {
      this.stick = stickInput(dx, dy);
      const len = Math.hypot(dx, dy);
      const k = len > 40 ? 40 / len : 1;
      this.knob.style.transform = `translate(${String(dx * k)}px, ${String(dy * k)}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stick.setPointerCapture(e.pointerId);
      const box = stick.getBoundingClientRect();
      origin = { id: e.pointerId, x: box.left + box.width / 2, y: box.top + box.height / 2 };
      move(e.clientX - origin.x, e.clientY - origin.y);
    });
    stick.addEventListener('pointermove', (e) => {
      if (origin?.id === e.pointerId) move(e.clientX - origin.x, e.clientY - origin.y);
    });
    const end = (e: PointerEvent): void => {
      if (origin?.id !== e.pointerId) return;
      origin = undefined;
      move(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }
}
