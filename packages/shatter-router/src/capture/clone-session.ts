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

/** Computed properties copied onto a substitute so it takes the original's place in layout. */
const BOX_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'clear',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'vertical-align',
  'transform',
  'transform-origin',
  'opacity',
  'visibility',
  'object-fit',
  'object-position',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-self',
  'justify-self',
  'order',
  'grid-row-start',
  'grid-row-end',
  'grid-column-start',
  'grid-column-end',
  'aspect-ratio',
  'background-color',
  'box-shadow',
] as const;

/** Elements whose content cannot (or must not) be copied: replaced by a substitute box. */
const SUBSTITUTED_TAGS = new Set(['IFRAME', 'VIDEO', 'OBJECT', 'EMBED']);

/** Longest side of a video frame grabbed for the copy, in device pixels. */
const MAX_FRAME_SIDE = 2048;

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

/** Elements whose font comes from the platform rather than from inheritance. */
const FORM_CONTROLS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'OPTGROUP']);

/** The font longhands pinned on form controls in the copy. */
const FONT_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'line-height',
  'letter-spacing',
] as const;

/** WebKit's "standard font" keyword: resolved from browser settings, which an SVG image does not share. */
const STANDARD_FONT = /(^|,)\s*-webkit-standard\s*(?=,|$)/g;

/** Text whose width differs between common serif, sans-serif and monospace faces. */
const PROBE_TEXT = 'mmmwwwiiil0O@Qg';

/**
 * The generic family (`serif`, `sans-serif`, `monospace`) whose glyphs the
 * live page uses for `-webkit-standard`, measured with a detached 2D canvas
 * (no DOM mutation). Null when none matches exactly or canvas is missing.
 */
function resolveStandardFont(doc: Document): string | null {
  const context = doc.createElement('canvas').getContext('2d');
  if (!context) return null;
  const width = (family: string): number => {
    context.font = `72px ${family}`;
    return context.measureText(PROBE_TEXT).width;
  };
  const standard = width('-webkit-standard');
  const matches = ['sans-serif', 'serif', 'monospace'].filter(
    (family) => width(family) === standard,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Replaces each `-webkit-standard` entry of a `font-family` list with `generic`. */
export function withStandardFont(family: string, generic: string): string {
  return family.replace(
    STANDARD_FONT,
    (_match, lead: string) => `${lead}${lead ? ' ' : ''}${generic}`,
  );
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
  /** Live elements left out of the clone; a substitute takes their place. */
  private readonly substituted = new WeakSet<Element>();
  private readonly stickyFixes: StickyFix[] = [];
  private readonly win: Window & typeof globalThis;
  private readonly root: HTMLElement;
  private readonly scroller: Element | null;
  private bodyClone: HTMLElement | null = null;
  private rootDone = false;
  private mappingBroken = false;
  /** What `-webkit-standard` resolves to live; undefined until first needed. */
  private standardFont: string | null | undefined;

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
      if (
        SUBSTITUTED_TAGS.has(node.tagName.toUpperCase()) ||
        node.hasAttribute('data-shatter-ignore') ||
        this.isUnfetchableImage(node)
      ) {
        this.substituted.add(node);
        return false;
      }
    }
    this.stack.push(node);
    return true;
  };

  readonly onCloneEachNode = (cloned: Node): void => {
    if (this.rootDone) {
      this.mappingBroken = true;
      return;
    }
    const original = this.stack.pop();
    if (original === undefined) {
      this.rootDone = true;
      return;
    }
    if (!isElement(original) || !isStyled(cloned)) return;
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
    stripLayerNames(clonedRoot.style);
    // The root's font is inherited by everything without an author font.
    this.pinStandardFont(this.win.getComputedStyle(this.root).fontFamily, clonedRoot.style);
    this.applyStickyFixes();
    this.applyRootBackground(clonedRoot);
  };

  /**
   * Replaces WebKit's `-webkit-standard` in `family` with the generic family
   * it resolves to live: inside an SVG image it resolves to the default
   * settings' serif, which differs from the live page on Linux (ADR-029).
   */
  private pinStandardFont(family: string, style: CSSStyleDeclaration): void {
    if (!family.includes('-webkit-standard')) return;
    if (this.standardFont === undefined) this.standardFont = resolveStandardFont(this.doc);
    const generic = this.standardFont;
    if (generic === null) return;
    style.setProperty('font-family', withStandardFont(family, generic));
  }

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
    // Form controls take their font from the platform (UA `font: -webkit-small-control`
    // and the like). The library inlines only styles that differ from its sandbox's
    // defaults, so the font is left out, and inside an SVG image Linux WebKit
    // resolves the control default to serif. Pin the live font (ADR-029).
    if (FORM_CONTROLS.has(original.tagName)) {
      const computed = this.win.getComputedStyle(original);
      for (const property of FONT_PROPERTIES) {
        style.setProperty(property, computed.getPropertyValue(property));
      }
      this.pinStandardFont(computed.fontFamily, style);
    }
    // Text first: substitutes add children that have no live counterpart to pair with.
    this.keepSingleLines(original, cloned);
    this.insertSubstitutes(original, cloned);
    if (original === this.doc.body && cloned instanceof this.win.HTMLElement) {
      this.bodyClone = cloned;
    }

    // Do not fetch and inline pixels nobody can see.
    // (Images that must not be fetched never reach this point: see isUnfetchableImage.)
    if (!(cloned instanceof this.win.HTMLImageElement) && style.backgroundImage.includes('url(')) {
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
   * Pairs live children with their clones the way the library cloned them:
   * comments, <style>, <script> and Shatter's own nodes are not cloned, and
   * substituted elements have no clone (copy is null). Null when the lists do
   * not line up (shadow roots, slots), in which case nothing is changed.
   */
  private pairChildren(
    original: Element,
    cloned: HTMLElement | SVGElement,
  ): { live: ChildNode; copy: ChildNode | null }[] | null {
    if (original.shadowRoot) return null;
    const copies = Array.from(cloned.childNodes);
    const pairs: { live: ChildNode; copy: ChildNode | null }[] = [];
    let next = 0;
    for (const child of original.childNodes) {
      if (child.nodeType === 8) continue;
      if (isElement(child)) {
        const tag = child.tagName.toUpperCase();
        if (tag === 'STYLE' || tag === 'SCRIPT') continue;
        if (tag === 'SLOT') return null;
        if (child.hasAttribute(OVERLAY_ATTRIBUTE) || child.id.startsWith('__SANDBOX__')) continue;
        if (this.substituted.has(child)) {
          pairs.push({ live: child, copy: null });
          continue;
        }
      }
      const copy = copies[next++];
      if (!copy) return null;
      pairs.push({ live: child, copy });
    }
    return next === copies.length ? pairs : null;
  }

  /** Puts a substitute box where each left-out child was (section 9: hard-to-capture content). */
  private insertSubstitutes(original: Element, cloned: HTMLElement | SVGElement): void {
    if (!original.firstElementChild) return;
    const pairs = this.pairChildren(original, cloned);
    if (!pairs) return;
    let anchor: ChildNode | null = null;
    // Walk backwards so each substitute goes in front of the next real clone.
    for (let i = pairs.length - 1; i >= 0; i--) {
      const pair = pairs[i];
      if (!pair) continue;
      if (pair.copy) {
        anchor = pair.copy;
        continue;
      }
      if (!isElement(pair.live)) continue;
      const substitute = this.substitute(pair.live);
      cloned.insertBefore(substitute, anchor);
      anchor = substitute;
    }
  }

  /**
   * A box with the original's size, position and background. Videos show
   * their current frame when it can be read without tainting, else the poster,
   * else the background colour. Unfetchable images become a transparent image.
   * Iframes, plugins and `data-shatter-ignore` elements show their computed
   * background colour.
   */
  private substitute(live: Element): HTMLElement {
    const computed = this.win.getComputedStyle(live);
    const video = live instanceof this.win.HTMLVideoElement ? live : null;
    const image = live instanceof this.win.HTMLImageElement;
    const box = this.doc.createElement(video || image ? 'img' : 'div');
    for (const property of BOX_PROPERTIES) {
      box.style.setProperty(property, computed.getPropertyValue(property));
    }
    if (computed.display === 'inline' || computed.display === 'contents') {
      const rect = live.getBoundingClientRect();
      box.style.display = 'inline-block';
      box.style.boxSizing = 'border-box';
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    }
    if (box instanceof this.win.HTMLImageElement) {
      box.alt = '';
      const picture = video ? (this.videoFrame(video) ?? this.posterOf(video)) : null;
      box.src = picture ?? BLANK_IMAGE;
    }
    return box;
  }

  /**
   * Off-screen images, and cross-origin images loaded without CORS, must not
   * be fetched: the first would waste the capture budget, the second would
   * fail and log a CORS error. They become substitutes (a fresh transparent
   * image: the capture library's placeholder behaviour), because rewriting
   * the clone's \`src\` is not enough: Firefox keeps the old \`currentSrc\`,
   * which the library reads first.
   */
  private isUnfetchableImage(node: Element): boolean {
    if (!(node instanceof this.win.HTMLImageElement)) return false;
    return !this.isVisible(node.getBoundingClientRect()) || !this.isReadable(node);
  }

  /** The current frame as a data URL, or null when there is none or reading it would taint. */
  private videoFrame(video: HTMLVideoElement): string | null {
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const rect = video.getBoundingClientRect();
    if (!this.isVisible(rect)) return null;
    const dpr = Math.min(this.win.devicePixelRatio || 1, 2);
    const wanted = Math.max(
      (rect.width * dpr) / video.videoWidth,
      (rect.height * dpr) / video.videoHeight,
    );
    const scale = Math.min(
      1,
      wanted,
      MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = this.doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    try {
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Throws a SecurityError for a cross-origin video without CORS.
      return canvas.toDataURL();
    } catch {
      return null;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /** The poster URL when the capture may read it (same origin, data or blob URL), else null. */
  private posterOf(video: HTMLVideoElement): string | null {
    const poster = video.poster;
    if (!poster) return null;
    const local =
      poster.startsWith('data:') || poster.startsWith('blob:') || this.sameOrigin(poster);
    return local ? poster : null;
  }

  /** True when the image's pixels may be read: same origin, data/blob URL, or loaded with CORS. */
  private isReadable(image: HTMLImageElement): boolean {
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith('data:') || source.startsWith('blob:')) return true;
    return this.sameOrigin(source) || image.crossOrigin !== null;
  }

  private sameOrigin(url: string): boolean {
    try {
      return new URL(url, this.doc.baseURI).origin === this.win.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Text that sits on one line in the live page must not wrap in the copy.
   *
   * The copy can measure text a fraction of a pixel wider than the live page
   * (glyph hinting at a different size, a different rounding grid), and a
   * shrink-to-fit box such as a button is exactly as wide as its text: the
   * last word then drops to a new line. Each text run that is on a single line
   * live is wrapped in a `white-space: nowrap` span in the copy. Runs that
   * already wrap live are left alone.
   */
  private keepSingleLines(original: Element, cloned: HTMLElement | SVGElement): void {
    if (original.shadowRoot || !(cloned instanceof this.win.HTMLElement)) return;
    const whiteSpace = this.win.getComputedStyle(original).whiteSpace;
    if (whiteSpace === 'nowrap' || whiteSpace === 'pre') return;

    const pairs = this.pairChildren(original, cloned);
    if (!pairs) return;
    const range = this.doc.createRange();
    pairs.forEach(({ live, copy }) => {
      if (live.nodeType !== 3 || copy?.nodeType !== 3) return;
      const text = live.textContent ?? '';
      if (text.trim().length < 2) return;
      range.selectNodeContents(live);
      const rects = range.getClientRects();
      if (rects.length === 0) return;
      let top = Infinity;
      let bottom = -Infinity;
      for (const rect of rects) {
        if (rect.width === 0) continue;
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.top);
      }
      // Rects of one line share their top; a second line starts a line-height lower.
      if (!(bottom - top < 1)) return;
      const span = this.doc.createElement('span');
      span.style.whiteSpace = 'nowrap';
      cloned.replaceChild(span, copy);
      span.append(copy);
    });
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
