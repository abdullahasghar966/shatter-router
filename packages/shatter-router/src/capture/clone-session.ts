import { OVERLAY_ATTRIBUTE } from '../core/dom';

/** 1x1 transparent GIF used for images that are outside the viewport. */
const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** How far outside the viewport (CSS px) content still counts as visible (shadows, blur). */
const VISIBILITY_MARGIN = 128;

const BACKGROUND_PROPERTIES = [
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat',
  'background-attachment',
  'background-origin',
  'background-clip',
  'background-blend-mode',
] as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface StickyFix {
  readonly cloned: HTMLElement;
  readonly rect: DOMRect;
  readonly origin: Point;
}

export interface CloneGeometry {
  /** Viewport size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Bounding box of the live root element, in viewport coordinates. */
  readonly rootRect: DOMRect;
  /**
   * Factor the copy is laid out at: 1 to lay out in CSS pixels and let the
   * engine scale while rasterising, or the device scale to lay out in device pixels.
   */
  readonly layoutScale: number;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function isStyled(node: Node): node is HTMLElement | SVGElement {
  return isElement(node) && 'style' in node;
}

function isTransparent(color: string): boolean {
  return (
    color === 'transparent' ||
    /^rgba\(.*,\s*0\)$/.test(color) ||
    /\/\s*0(?:\.0+)?%?\s*\)$/.test(color)
  );
}

function hasBackground(style: CSSStyleDeclaration): boolean {
  return style.backgroundImage !== 'none' || !isTransparent(style.backgroundColor);
}

/** Parent across shadow boundaries. */
function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const rootNode = element.getRootNode();
  return rootNode instanceof ShadowRoot ? rootNode.host : null;
}

/**
 * True when an element with this computed style is the containing block for
 * its `position: fixed` descendants (CSS Transforms, Filter Effects, Containment).
 */
function containsFixed(style: CSSStyleDeclaration): boolean {
  const none = (value: string | undefined): boolean =>
    value === undefined || value === '' || value === 'none';
  if (!none(style.transform) || !none(style.perspective) || !none(style.filter)) return true;
  if (!none(style.translate) || !none(style.rotate) || !none(style.scale)) return true;
  if (!none(style.backdropFilter)) return true;
  if (/\b(?:paint|layout|strict|content)\b/.test(style.contain)) return true;
  if (/\b(?:transform|perspective|filter|translate|rotate|scale)\b/.test(style.willChange)) {
    return true;
  }
  const containerType = style.containerType;
  if (containerType !== '' && containerType !== 'normal') return true;
  return style.contentVisibility === 'auto';
}

const VIEWPORT_ORIGIN: Point = { x: 0, y: 0 };

/**
 * View-transition names make an element a separate layer. They mean nothing in
 * a static copy, and WebKit draws layered HTML inside an SVG image in the wrong place.
 */
function stripLayerNames(style: CSSStyleDeclaration): void {
  if (style.getPropertyValue('view-transition-name')) style.removeProperty('view-transition-name');
}

function prependTranslate(style: CSSStyleDeclaration, x: number, y: number): void {
  if (x === 0 && y === 0) return;
  const existing = style.transform;
  const translate = `translate(${x}px, ${y}px)`;
  style.transform = existing && existing !== 'none' ? `${translate} ${existing}` : translate;
}

/**
 * Tracks one clone pass of the capture library and repairs what a static,
 * unscrolled copy of the DOM gets wrong: fixed and sticky elements, scrolled
 * containers, the page background, and work on content that is not visible.
 *
 * The library only hands hooks the cloned node, so originals are recovered by
 * mirroring its traversal: `filter` runs for a child right before it is
 * cloned and `onCloneEachNode` runs once the child's subtree is done, which
 * makes the pair behave like a stack push and pop.
 */
export class CloneSession {
  private readonly stack: Node[] = [];
  private readonly iframeDocumentSeen = new WeakSet<Node>();
  private readonly stickyFixes: StickyFix[] = [];
  private readonly win: Window & typeof globalThis;
  private readonly root: HTMLElement;
  private readonly scroller: Element | null;
  private bodyClone: HTMLElement | null = null;
  private rootDone = false;
  private mappingBroken = false;
  private lastCloned: Node | null = null;

  /** Colour to paint under the rasterised page, or null when the clone paints its own. */
  fillColor: string | null = null;

  constructor(
    private readonly doc: Document,
    private readonly geometry: CloneGeometry,
  ) {
    const win = doc.defaultView;
    if (!win) throw new Error('Document has no window');
    this.win = win;
    this.root = doc.documentElement;
    this.scroller = doc.scrollingElement;
  }

  /** True when the clone/original pairing went out of step; the capture cannot be trusted. */
  get broken(): boolean {
    return this.mappingBroken || this.stack.length > 0 || !this.rootDone;
  }

  readonly filter = (node: Node): boolean => {
    if (node.nodeType === 3) return true;
    if (isElement(node)) {
      if (node.hasAttribute(OVERLAY_ATTRIBUTE)) return false;
      if (node.id.startsWith('__SANDBOX__')) return false;
    }
    this.stack.push(node);
    return true;
  };

  readonly onCloneEachNode = (cloned: Node): void => {
    if (this.rootDone) {
      this.mappingBroken = true;
      return;
    }
    const top = this.stack[this.stack.length - 1];
    // A same-origin iframe is replaced by a clone of its document. The library
    // reports that clone twice: once as the inner document's root (no filter
    // call came before it) and once as the iframe itself. Skip the first.
    if (
      top !== undefined &&
      top instanceof this.win.HTMLIFrameElement &&
      cloned !== this.lastCloned &&
      cloned.nodeName.toUpperCase() !== 'IFRAME' &&
      !this.iframeDocumentSeen.has(top)
    ) {
      this.iframeDocumentSeen.add(top);
      this.lastCloned = cloned;
      return;
    }
    this.lastCloned = cloned;

    const original = this.stack.pop();
    if (original === undefined) {
      this.rootDone = true;
      return;
    }
    if (!isElement(original) || !isStyled(cloned)) return;
    // Content of same-origin iframes lives in another coordinate space; leave it as cloned.
    if (original.ownerDocument !== this.doc) return;
    try {
      this.repair(original, cloned);
    } catch {
      // A failed repair on one element must not abort the whole capture.
    }
  };

  /** Runs after the whole tree is cloned and attached. */
  readonly onCloneNode = (clonedRoot: Node): void => {
    if (!isStyled(clonedRoot)) return;
    const { rootRect } = this.geometry;
    // Scroll the copy by pulling the root up and left, exactly as far as the
    // live page is scrolled. No SVG-level offset is involved, which keeps
    // WebKit (it misplaces layered HTML under SVG transforms) out of trouble,
    // and leaves the SVG viewport standing in for the real one, so
    // position: fixed content needs no correction.
    clonedRoot.style.setProperty('margin-left', `${rootRect.left}px`);
    clonedRoot.style.setProperty('margin-top', `${rootRect.top}px`);
    // Some engines snap box edges and glyphs to whole pixels of the grid the
    // SVG is laid out in. For those, lay the copy out in device pixels so the
    // snapping matches the live page.
    const { layoutScale } = this.geometry;
    if (layoutScale !== 1) clonedRoot.style.setProperty('zoom', String(layoutScale));
    const geo = (this.win as unknown as { __SPIKE_GEO__?: boolean }).__SPIKE_GEO__;
    if (geo) clonedRoot.style.setProperty('text-rendering', 'geometricPrecision');
    stripLayerNames(clonedRoot.style);
    this.applyStickyFixes();
    this.applyRootBackground(clonedRoot);
  };

  /** Sizes the SVG to the viewport, in the units the clone is laid out in. */
  readonly onCreateForeignObjectSvg = (svg: SVGSVGElement): void => {
    const width = this.geometry.width * this.geometry.layoutScale;
    const height = this.geometry.height * this.geometry.layoutScale;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  };

  private repair(original: Element, cloned: HTMLElement | SVGElement): void {
    const style = cloned.style;
    stripLayerNames(style);
    if (original === this.doc.body && cloned instanceof this.win.HTMLElement) {
      this.bodyClone = cloned;
    }

    // Do not fetch and inline pixels nobody can see.
    if (cloned instanceof this.win.HTMLImageElement) {
      if (!this.isVisible(original.getBoundingClientRect())) {
        cloned.removeAttribute('srcset');
        cloned.src = BLANK_IMAGE;
      }
    } else if (style.backgroundImage.includes('url(')) {
      if (!this.isVisible(original.getBoundingClientRect())) style.backgroundImage = 'none';
    }

    // A scrolled container shows its children shifted; the clone cannot scroll,
    // so shift the children instead.
    if (original !== this.root && original !== this.scroller) {
      const { scrollLeft, scrollTop } = original;
      if (scrollLeft !== 0 || scrollTop !== 0) {
        for (const child of cloned.children) {
          if (isStyled(child)) prependTranslate(child.style, -scrollLeft, -scrollTop);
        }
      }
    }

    const position = style.position;
    if (position === 'fixed') {
      const { live, clone } = this.fixedContainers(original);
      prependTranslate(style, live.x - clone.x, live.y - clone.y);
    } else if (position === 'sticky' && cloned instanceof this.win.HTMLElement) {
      const computed = this.win.getComputedStyle(original);
      if (computed.transform === 'none') {
        this.stickyFixes.push({
          cloned,
          rect: original.getBoundingClientRect(),
          origin: this.fixedContainers(original).clone,
        });
      }
    }
  }

  /**
   * Where `position: fixed` coordinates are measured from, in viewport
   * coordinates: in the live page, and in the clone (where an ancestor shifted
   * to emulate scrolling also becomes a containing block).
   */
  private fixedContainers(element: Element): { live: Point; clone: Point } {
    let clone: Point | null = null;
    let live: Point | null = null;
    for (let p = parentOf(element); p && p !== this.root; p = parentOf(p)) {
      const createsLive = containsFixed(this.win.getComputedStyle(p));
      const grandparent = parentOf(p);
      const shiftedForScroll =
        grandparent !== null &&
        grandparent !== this.root &&
        grandparent !== this.scroller &&
        (grandparent.scrollLeft !== 0 || grandparent.scrollTop !== 0);
      if (createsLive || shiftedForScroll) {
        const rect = p.getBoundingClientRect();
        const origin = { x: rect.left + p.clientLeft, y: rect.top + p.clientTop };
        clone ??= origin;
        if (createsLive) {
          live = origin;
          break;
        }
      }
    }
    return { live: live ?? VIEWPORT_ORIGIN, clone: clone ?? VIEWPORT_ORIGIN };
  }

  /**
   * A stuck sticky element sits away from its place in the flow. Pin the clone
   * at the position measured in the live page and leave an invisible copy
   * behind to keep the flow intact.
   */
  private applyStickyFixes(): void {
    for (const { cloned, rect, origin } of this.stickyFixes) {
      const parent = cloned.parentNode;
      if (!parent) continue;
      const spacer = cloned.cloneNode(false) as HTMLElement;
      spacer.removeAttribute('id');
      spacer.style.visibility = 'hidden';
      parent.insertBefore(spacer, cloned);

      const style = cloned.style;
      style.position = 'fixed';
      style.left = `${rect.left - origin.x}px`;
      style.top = `${rect.top - origin.y}px`;
      style.right = 'auto';
      style.bottom = 'auto';
      style.margin = '0';
      style.boxSizing = 'border-box';
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
    }
  }

  /**
   * The page background belongs to the canvas, not to a box: a background on
   * `<html>`, or on `<body>` when `<html>` has none, covers the whole viewport.
   * Rebuild that on the cloned root.
   */
  private applyRootBackground(clonedRoot: HTMLElement | SVGElement): void {
    const { rootRect, height } = this.geometry;
    const rootStyle = this.win.getComputedStyle(this.root);
    const body = this.doc.body as HTMLElement | null;
    const bodyStyle = body ? this.win.getComputedStyle(body) : null;

    let source: CSSStyleDeclaration | null = null;
    if (hasBackground(rootStyle)) {
      source = rootStyle;
    } else if (bodyStyle && hasBackground(bodyStyle)) {
      source = bodyStyle;
      for (const property of BACKGROUND_PROPERTIES) {
        clonedRoot.style.setProperty(property, bodyStyle.getPropertyValue(property));
      }
      this.bodyClone?.style.setProperty('background', 'none');
    }

    if (source && !isTransparent(source.backgroundColor)) this.fillColor = source.backgroundColor;
    if (!source) clonedRoot.style.setProperty('background-color', 'Canvas');
    if (!source || source.backgroundImage === 'none') {
      // Colour only: stretch the root so the colour reaches the viewport's bottom edge.
      const needed = Math.max(rootRect.height, -rootRect.top + height);
      clonedRoot.style.setProperty('height', `${needed}px`, 'important');
    }
  }

  private isVisible(rect: DOMRect): boolean {
    const { width, height } = this.geometry;
    return (
      rect.right > -VISIBILITY_MARGIN &&
      rect.bottom > -VISIBILITY_MARGIN &&
      rect.left < width + VISIBILITY_MARGIN &&
      rect.top < height + VISIBILITY_MARGIN
    );
  }
}
