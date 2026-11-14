/** Longest wait for an animation frame before carrying on without one. */
const FRAME_TIMEOUT_MS = 120;

/**
 * Resolves on the next animation frame. Browsers stop firing
 * `requestAnimationFrame` in hidden tabs and unpainted panes, so a timer backs
 * it up: a transition must never hang because nobody is watching.
 */
export function nextFrame(win: Window): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      win.clearTimeout(timer);
      win.cancelAnimationFrame(frame);
      resolve();
    };
    const timer = win.setTimeout(finish, FRAME_TIMEOUT_MS);
    const frame = win.requestAnimationFrame(finish);
  });
}
