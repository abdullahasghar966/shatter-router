/** Crossfade length for the View Transition fallback (master prompt 9: ≤ 200 ms). */
export const CROSSFADE_MS = 180;

const CROSSFADE_CSS = `::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation-duration:${CROSSFADE_MS}ms}`;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => {
    updateCallbackDone: Promise<void>;
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

let sheet: CSSStyleSheet | null | undefined;

/**
 * A constructed stylesheet shortening the default 250 ms crossfade. Constructed
 * sheets are not inline `<style>` elements, so a strict `style-src` CSP does
 * not block them. Null when the browser has no constructable stylesheets.
 */
function crossfadeSheet(): CSSStyleSheet | null {
  if (sheet !== undefined) return sheet;
  try {
    const created = new CSSStyleSheet();
    created.replaceSync(CROSSFADE_CSS);
    sheet = created;
  } catch {
    sheet = null;
  }
  return sheet;
}

/**
 * Runs `commit` inside a View Transition crossfade when the browser supports
 * it; otherwise runs it directly (instant swap). Resolves once the crossfade
 * is over. Errors thrown by `commit` reach the caller.
 */
export async function crossfade(doc: Document, commit: () => void | Promise<void>): Promise<void> {
  const vt = doc as ViewTransitionDocument;
  if (typeof vt.startViewTransition !== 'function') {
    await commit();
    return;
  }
  const css = crossfadeSheet();
  const added = css !== null && !doc.adoptedStyleSheets.includes(css);
  if (added) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, css];
  let transition: {
    updateCallbackDone: Promise<void>;
    ready: Promise<void>;
    finished: Promise<void>;
  };
  try {
    transition = vt.startViewTransition(() => commit());
  } catch {
    // Another view transition in progress, or an unusable document state.
    if (added) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== css);
    await commit();
    return;
  }
  // `ready` rejects when the animation is skipped (hidden tab, update timeout):
  // not an error for navigation, and it must not surface as an unhandled rejection.
  transition.ready.catch(() => undefined);
  try {
    await transition.updateCallbackDone;
    // The animation itself failing (skipped, interrupted) is not an error for navigation.
    await transition.finished.catch(() => undefined);
  } finally {
    if (added) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== css);
  }
}
