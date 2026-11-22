import {
  DEFAULT_INTENSITY,
  type GesturePoint,
  type Interaction,
  type InteractionHost,
  type InteractionOptions,
} from '../core/interaction';
import { CURSOR_ATTRIBUTE } from '../core/dom';

/**
 * The interaction chunk (ADR-060): cursor kit, pre-crack, hold to charge,
 * drag to tear, haptics. Styles are set through the CSSOM (no `<style>`
 * element, so a strict `style-src` CSP does not block it); the cursor is
 * `aria-hidden` and `data-shatter-ignore`, so it is never frozen into a
 * capture; its frame loop only runs while the cursor moves or charges.
 */

const SVG = 'http://www.w3.org/2000/svg';
/** Ms of holding before the charge starts, and to reach full charge. */
const CHARGE_DELAY_MS = 120;
const CHARGE_FULL_MS = 800;
/** Px between recorded tear points; at most this many points. */
const TEAR_STEP = 12;
const TEAR_POINTS = 8;
/** Px of movement before a press counts as a tear. */
const TEAR_START = 24;
/** Charge arc radius, px. */
const ARC_R = 19;
const ARC = 2 * Math.PI * ARC_R;

/** The kits' glyphs, drawn around (0, 0) in a 48 px box. */
const GLYPHS: Readonly<Record<string, string>> = {
  ring: '<circle r="12" fill="none" stroke-width="1.5"/>',
  reticle:
    '<circle r="9" fill="none" stroke-width="1.2"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6" stroke-width="1.2"/>',
  hammer:
    '<path d="M-4-14h14v7H-4z M2-7v20" fill="none" stroke-width="1.6" stroke-linejoin="round"/>',
  'glass-cutter':
    '<path d="M-12 12L6-6" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="-8" r="3.5" fill="none" stroke-width="1.4"/>',
};

/** Six short hairlines from the centre: the pre-crack. */
const STAR = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.3 * (i % 2);
  const r = 9 + 5 * (i % 3);
  return `M0 0L${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
}).join('');

interface Press {
  readonly anchor: HTMLAnchorElement;
  readonly pointerType: string;
  readonly start: number;
  readonly path: GesturePoint[];
  tearing: boolean;
  ticks: number;
}

class InteractionKit implements Interaction {
  private readonly win: Window;
  private readonly doc: Document;
  private readonly root: HTMLElement | null = null;
  private readonly star: SVGPathElement | null = null;
  private readonly arc: SVGCircleElement | null = null;
  private readonly cleanups: (() => void)[] = [];
  private press: Press | null = null;
  private frame = 0;
  private x = -100;
  private y = -100;
  private shownX = -100;
  private shownY = -100;
  private armedSince = -1;
  private visible = false;
  private running = false;

  constructor(
    private readonly host: InteractionHost,
    private readonly options: InteractionOptions,
  ) {
    this.win = host.window;
    this.doc = this.win.document;
    const kit = options.cursor ?? 'ring';
    if (kit !== 'none' && this.win.matchMedia('(pointer: fine)').matches) {
      const root = this.doc.createElement('div');
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('data-shatter-ignore', '');
      root.setAttribute(CURSOR_ATTRIBUTE, kit);
      Object.assign(root.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '0',
        height: '0',
        pointerEvents: 'none',
        zIndex: '2147483646',
        mixBlendMode: 'difference',
        opacity: '0',
        transition: 'opacity 120ms',
      });
      const svg = this.doc.createElementNS(SVG, 'svg');
      svg.setAttribute('width', '48');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '-24 -24 48 48');
      svg.setAttribute('stroke', '#fff');
      svg.style.transform = 'translate(-24px, -24px)';
      svg.style.overflow = 'visible';
      svg.innerHTML = `${GLYPHS[kit] ?? GLYPHS.ring ?? ''}<path d="${STAR}" stroke-width="0.9" fill="none"/><circle r="${String(ARC_R)}" fill="none" stroke-width="2" transform="rotate(-90)"/>`;
      root.append(svg);
      this.doc.body.append(root);
      this.root = root;
      this.star = svg.querySelector<SVGPathElement>('path:nth-last-of-type(1)');
      this.arc = svg.querySelector<SVGCircleElement>('circle:last-of-type');
      this.star?.setAttribute('stroke-dasharray', '20');
      this.star?.setAttribute('stroke-dashoffset', '20');
      this.arc?.setAttribute('stroke-dasharray', String(ARC));
      this.arc?.setAttribute('stroke-dashoffset', String(ARC));
    }
    this.listen('pointermove', (event) => {
      this.onMove(event as PointerEvent);
    });
    this.listen('pointerdown', (event) => {
      this.onDown(event as PointerEvent);
    });
    this.listen('pointerup', (event) => {
      this.onUp(event as PointerEvent);
    });
    this.listen('pointercancel', () => {
      this.press = null;
      this.wake();
    });
    this.listen('dragstart', (event) => {
      // A tear must not turn into dragging the link's URL.
      if (this.press && (this.options.tear ?? true)) event.preventDefault();
    });
    this.listen('contextmenu', (event) => {
      // A long press on touch charges instead of opening the link menu.
      if (this.press?.pointerType === 'touch') event.preventDefault();
    });
    // The glass covers the page in the top layer: the cursor steps aside
    // while a transition runs (it is never part of the capture either).
    this.cleanups.push(
      host.watch((running) => {
        this.running = running;
        if (this.root) this.root.style.opacity = !running && this.visible ? '1' : '0';
      }),
    );
    const leave = (): void => {
      this.setVisible(false);
    };
    this.doc.documentElement.addEventListener('pointerleave', leave);
    this.cleanups.push(() => {
      this.doc.documentElement.removeEventListener('pointerleave', leave);
    });
  }

  destroy(): void {
    this.win.cancelAnimationFrame(this.frame);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.root?.remove();
    this.press = null;
  }

  private listen(type: string, handler: (event: Event) => void): void {
    const options = { capture: true, passive: type !== 'dragstart' && type !== 'contextmenu' };
    this.doc.addEventListener(type, handler, options);
    this.cleanups.push(() => {
      this.doc.removeEventListener(type, handler, options);
    });
  }

  private onMove(event: PointerEvent): void {
    this.x = event.clientX;
    this.y = event.clientY;
    this.setVisible(event.pointerType !== 'touch');
    const armed = this.host.shatterLink(event) !== null && !this.host.busy();
    if (armed && this.armedSince < 0) this.armedSince = event.timeStamp;
    if (!armed) this.armedSince = -1;
    const press = this.press;
    if (press && (this.options.tear ?? true) && press.pointerType !== 'touch') {
      const last = press.path[press.path.length - 1];
      if (last && Math.hypot(this.x - last.x, this.y - last.y) >= TEAR_STEP) {
        if (press.path.length < TEAR_POINTS) press.path.push({ x: this.x, y: this.y });
        else press.path[TEAR_POINTS - 1] = { x: this.x, y: this.y };
        const first = press.path[0];
        if (first && Math.hypot(this.x - first.x, this.y - first.y) >= TEAR_START) {
          press.tearing = true;
        }
      }
    }
    this.wake();
  }

  private onDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.host.busy()) return;
    const anchor = this.host.shatterLink(event);
    if (!anchor) return;
    this.x = event.clientX;
    this.y = event.clientY;
    this.press = {
      anchor,
      pointerType: event.pointerType,
      start: event.timeStamp,
      path: [{ x: event.clientX, y: event.clientY }],
      tearing: false,
      ticks: 0,
    };
    this.wake();
  }

  private onUp(event: PointerEvent): void {
    const press = this.press;
    this.press = null;
    if (!press || !event.isPrimary) return;
    const charge = this.charge(press, event.timeStamp);
    const intensity = DEFAULT_INTENSITY + (1 - DEFAULT_INTENSITY) * charge;
    const end = { x: event.clientX, y: event.clientY };
    if (press.tearing && press.path.length >= 2) {
      this.host.gesture({ origin: press.path[0] ?? end, intensity, path: press.path.slice() });
      this.buzz(25);
      // Released off the link: no click will follow, so follow the link here.
      const target = event.target instanceof Node ? event.target : null;
      if (!target || !press.anchor.contains(target)) press.anchor.click();
    } else if (charge > 0) {
      this.host.gesture({ origin: end, intensity });
      this.buzz(25);
    }
    this.wake();
  }

  /** 0 for a click, 1 after a full hold (when charging is on). */
  private charge(press: Press, now: number): number {
    if (!(this.options.charge ?? true) || press.tearing) return 0;
    return Math.min(1, Math.max(0, (now - press.start - CHARGE_DELAY_MS) / CHARGE_FULL_MS));
  }

  private buzz(ms: number): void {
    if (!(this.options.haptics ?? true)) return;
    const nav = this.win.navigator as Navigator & { vibrate?: (pattern: number) => boolean };
    if (typeof nav.vibrate === 'function' && this.press === null) nav.vibrate(ms);
  }

  private setVisible(visible: boolean): void {
    if (!this.root || visible === this.visible) return;
    this.visible = visible;
    this.root.style.opacity = visible && !this.running ? '1' : '0';
  }

  /** Runs the frame loop until the cursor has caught up and nothing charges. */
  private wake(): void {
    if (this.frame) return;
    this.frame = this.win.requestAnimationFrame((now) => {
      this.frame = 0;
      this.tick(now);
    });
  }

  private tick(now: number): void {
    // The cursor trails the pointer a little (lerp), and snaps when close.
    this.shownX += (this.x - this.shownX) * 0.35;
    this.shownY += (this.y - this.shownY) * 0.35;
    if (Math.abs(this.x - this.shownX) < 0.2) this.shownX = this.x;
    if (Math.abs(this.y - this.shownY) < 0.2) this.shownY = this.y;
    const press = this.press;
    const charge = press ? this.charge(press, now) : 0;
    if (press?.pointerType === 'touch') {
      const ticks = Math.floor(charge * 4);
      if (ticks > press.ticks && (this.options.haptics ?? true)) {
        press.ticks = ticks;
        const nav = this.win.navigator as Navigator & { vibrate?: (pattern: number) => boolean };
        if (typeof nav.vibrate === 'function') nav.vibrate(8);
      }
    }
    if (this.root) {
      this.root.style.transform = `translate(${this.shownX.toFixed(1)}px, ${this.shownY.toFixed(1)}px) scale(${(1 + 0.35 * charge).toFixed(3)})`;
      const growing = (this.options.preCrack ?? true) && this.armedSince >= 0;
      const crack = growing ? Math.min(1, (now - this.armedSince) / 700) : 0;
      this.star?.setAttribute('stroke-dashoffset', String(20 * (1 - crack)));
      this.arc?.setAttribute('stroke-dashoffset', String(ARC * (1 - charge)));
      const moving = this.shownX !== this.x || this.shownY !== this.y;
      if (moving || press || (growing && crack < 1)) this.wake();
    } else if (press) {
      this.wake();
    }
  }
}

/** Entry for the lazy chunk. */
export function createInteraction(host: InteractionHost, options: InteractionOptions): Interaction {
  return new InteractionKit(host, options);
}
