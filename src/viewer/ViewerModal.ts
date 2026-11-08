import {
  MODAL_CANCEL_LABEL,
  MODAL_REMOVE_LABEL,
  modalCssVars,
  type WireRemovalModel,
} from './modal';
import { toolbarCssVars } from './toolbar';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

/**
 * The wire-removal confirmation (`#viewer-modal`): a full-viewport dim that
 * takes every pointer event, with the box and its Cancel and Remove buttons.
 * Draws a `WireRemovalModel` (or hides for none) and reports the buttons
 * through callbacks; the caller does the removal.
 */
export class ViewerModal {
  onCancel?: () => void;
  onRemove?: (branchId: number) => void;

  private readonly root: HTMLDivElement;
  private drawn = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', '');
    this.root.id = 'viewer-modal';
    for (const [name, value] of Object.entries({ ...toolbarCssVars(), ...modalCssVars() })) {
      this.root.style.setProperty(name, value);
    }
    parent.append(this.root);
  }

  render(model: WireRemovalModel | undefined): void {
    this.root.classList.toggle('open', model !== undefined);
    const key = JSON.stringify(model ?? null);
    if (key === this.drawn) return;
    this.drawn = key;
    if (!model) {
      this.root.replaceChildren();
      return;
    }
    const cancel = el('button', 'ui-button', MODAL_CANCEL_LABEL);
    cancel.type = 'button';
    cancel.dataset.modal = 'cancel';
    cancel.addEventListener('click', () => this.onCancel?.());
    const remove = el('button', 'ui-button', MODAL_REMOVE_LABEL);
    remove.type = 'button';
    remove.dataset.modal = 'remove';
    remove.addEventListener('click', () => this.onRemove?.(model.branchId));
    const [line1, line2] = model.detail;
    this.root.replaceChildren(
      el(
        'div',
        'box',
        el('div', 'title', model.title),
        el('div', 'detail', el('div', '', line1), el('div', '', line2)),
        el('div', 'buttons', cancel, remove),
      ),
    );
  }

  destroy(): void {
    this.root.remove();
  }
}
