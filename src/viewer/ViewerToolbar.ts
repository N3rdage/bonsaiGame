import type { ViewerMode } from './hotspots';
import {
  EXIT_LABEL,
  toolbarCssVars,
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
 * sub-row, and the bottom help lines (`#viewer-help`). Draws a `ToolbarModel`
 * and reports clicks through callbacks; it holds no state of its own beyond
 * the last model drawn, so an unchanged model leaves the DOM (and hover) alone.
 */
export class ViewerToolbar {
  onMode?: (mode: ViewerMode) => void;
  onToggle?: (toggle: ToolbarToggle) => void;
  onExit?: () => void;

  private readonly bar: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private drawn = '';

  constructor(parent: HTMLElement) {
    this.bar = document.createElement('div');
    this.bar.id = 'viewer-toolbar';
    this.help = document.createElement('div');
    this.help.id = 'viewer-help';
    for (const [name, value] of Object.entries(toolbarCssVars())) {
      this.bar.style.setProperty(name, value);
      this.help.style.setProperty(name, value);
    }
    parent.append(this.bar, this.help);
  }

  render(model: ToolbarModel): void {
    this.bar.classList.add('open');
    this.help.classList.add('open');
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
      div('modes', ...modes),
      exit,
    );
    const rows: HTMLDivElement[] = [top];
    if (model.subRow.length > 0) {
      rows.push(div('sub-row', ...model.subRow.map((group) => this.group(group))));
    }
    this.bar.replaceChildren(...rows);
    this.help.replaceChildren(...model.help.map((line) => div('help-line', line)));
  }

  /** While a modal is open the toolbar takes no clicks, focus or keyboard activation. */
  setInert(inert: boolean): void {
    this.bar.inert = inert;
  }

  hide(): void {
    this.bar.classList.remove('open');
    this.help.classList.remove('open');
  }

  destroy(): void {
    this.bar.remove();
    this.help.remove();
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
