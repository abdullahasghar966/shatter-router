import { OVERLAY_ATTRIBUTE } from '../core/dom';

const HOST_STYLE = [
  'position:fixed',
  'inset:0',
  'width:auto',
  'height:auto',
  'max-width:none',
  'max-height:none',
  'margin:0',
  'padding:0',
  'border:0',
  'overflow:hidden',
  'background:transparent',
  'pointer-events:auto',
  'touch-action:none',
  'user-select:none',
  'z-index:2147483647',
].join(';');

const CANVAS_STYLE = [
  'display:block',
  'position:absolute',
  'left:0',
  'top:0',
  'margin:0',
  'padding:0',
  'border:0',
  'max-width:none',
  'max-height:none',
  'background:transparent',
].join(';');

/**
 * The element that carries the WebGL canvas above the page. It uses the
 * browser top layer (`popover="manual"`) so it sits above dialogs and other
 * popovers, and falls back to a max-z-index fixed box where the Popover API
 * is missing. It stays in the DOM, hidden, between transitions so showing it
 * does not mutate the document.
 */
export class Overlay {
  readonly host: HTMLDivElement;
  private readonly usesPopover: boolean;
  private shown = false;

  constructor(
    private readonly doc: Document,
    private readonly canvas: HTMLCanvasElement,
  ) {
    const host = doc.createElement('div');
    host.setAttribute(OVERLAY_ATTRIBUTE, '');
    host.setAttribute('aria-hidden', 'true');
    // CSSOM writes (not style attributes in markup) are allowed under a strict style-src CSP.
    host.style.cssText = HOST_STYLE;
    canvas.style.cssText = CANVAS_STYLE;
    this.usesPopover = typeof host.showPopover === 'function';
    if (this.usesPopover) host.setAttribute('popover', 'manual');
    else host.style.display = 'none';
    host.append(canvas);
    this.host = host;
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Sets the CSS size of the canvas, in CSS pixels. */
  setSize(width: number, height: number): void {
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  show(): void {
    if (this.shown) return;
    if (!this.host.isConnected) this.doc.body.append(this.host);
    if (this.usesPopover) this.host.showPopover();
    else this.host.style.display = 'block';
    this.shown = true;
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    if (this.usesPopover) {
      // Already closed if the element was disconnected by the app; hidePopover would throw.
      if (this.host.isConnected && this.host.matches(':popover-open')) this.host.hidePopover();
    } else {
      this.host.style.display = 'none';
    }
  }

  destroy(): void {
    this.hide();
    this.host.remove();
  }
}
