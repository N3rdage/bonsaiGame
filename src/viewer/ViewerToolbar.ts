import type { ViewerMode } from './hotspots';
import {
  CAMERA_BUTTONS,
  EXIT_LABEL,
  px,
  subRowSeparator,
  toolbarCssVars,
  type CameraAction,
  type SubRowGroup,
  type ToolbarModel,
  type ToolbarToggle,
} from './toolbar';

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function div(className: string, ...children: (Node | string)[]): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.append(...children);
  return el;
}

/**
 * The viewer's DOM chrome: the top toolbar (`#viewer-toolbar`) with the wire
 * sub-row, the bottom help lines (`#viewer-help`), and the camera column
 * (`#viewer-camera`: zoom in, zoom out, reset) at the right edge. Draws a
 * `ToolbarModel` and reports clicks through callbacks; it holds no state of its
 * own beyond the last model drawn, so an unchanged model leaves the DOM (and
 * hover) alone. The camera column does not depend on the model: it is built once.
 */
export class ViewerToolbar {
  onMode?: (mode: ViewerMode) => void;
  onToggle?: (toggle: ToolbarToggle) => void;
  onExit?: () => void;
  onCamera?: (action: CameraAction) => void;

  private readonly bar: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private readonly camera: HTMLDivElement;
  private drawn = '';

  constructor(parent: HTMLElement) {
    this.bar = document.createElement('div');
    this.bar.id = 'viewer-toolbar';
    this.help = document.createElement('div');
    this.help.id = 'viewer-help';
    const cameraButtons = CAMERA_BUTTONS.map(([action, label, name]) => {
      const el = button('ui-button', label, () => this.onCamera?.(action));
      el.dataset.camera = action;
      el.setAttribute('aria-label', name);
      return el;
    });
    this.camera = div('', ...cameraButtons);
    this.camera.id = 'viewer-camera';
    for (const [name, value] of Object.entries(toolbarCssVars())) {
      for (const el of [this.bar, this.help, this.camera]) el.style.setProperty(name, value);
    }
    parent.append(this.bar, this.help, this.camera);
  }

  /** Draws `model` for a viewport `viewportWidth` CSS px wide. */
  render(model: ToolbarModel, viewportWidth: number): void {
    this.bar.classList.add('open');
    this.help.classList.add('open');
    this.camera.classList.add('open');
    this.bar.style.setProperty('--tb-subrow-separator', px(subRowSeparator(viewportWidth)));
    const key = JSON.stringify(model);
    if (key === this.drawn) return;
    this.drawn = key;
    this.bar.style.setProperty('--tb-height', `${String(model.height)}px`);

    const modes = model.modes.map(({ mode, label, selected }) => {
      const el = button('ui-button mode', label, () => this.onMode?.(mode));
      el.dataset.mode = mode;
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-pressed', String(selected));
      return el;
    });
    const exit = button('ui-button exit', EXIT_LABEL, () => this.onExit?.());
    exit.dataset.exit = '';
    const [name, stats] = model.info;
    const top = div(
      'toolbar-row',
      div('info', div('', name), div('', stats)),
      div('modes', ...modes, exit),
    );
    const rows: HTMLDivElement[] = [top];
    if (model.subRow.length > 0) {
      rows.push(div('sub-row', ...model.subRow.map((group) => this.group(group))));
    }
    this.bar.replaceChildren(...rows);
    this.help.replaceChildren(...model.help.map((line) => div('help-line', line)));
  }

  /** While a modal is open the toolbar and camera column take no clicks, focus or keys. */
  setInert(inert: boolean): void {
    this.bar.inert = inert;
    this.camera.inert = inert;
  }

  hide(): void {
    this.bar.classList.remove('open');
    this.help.classList.remove('open');
    this.camera.classList.remove('open');
  }

  destroy(): void {
    this.bar.remove();
    this.help.remove();
    this.camera.remove();
  }

  private group({ label, toggleWidth, toggles }: SubRowGroup): HTMLDivElement {
    const buttons = toggles.map((toggle) => {
      const el = button('ui-toggle', toggle.label, () => this.onToggle?.(toggle));
      el.dataset[toggle.kind] = toggle.value;
      el.classList.toggle('selected', toggle.selected);
      el.setAttribute('aria-pressed', String(toggle.selected));
      el.style.width = `${String(toggleWidth)}px`;
      return el;
    });
    return div('group', div('label', label), ...buttons);
  }
}
