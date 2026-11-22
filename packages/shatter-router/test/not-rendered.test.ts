import { afterEach, describe, expect, it } from 'vitest';
import { CloneSession } from '../src/capture/clone-session';

/** Hidden HTML elements are left out of the copy (ADR-062). */

function session(): CloneSession {
  return new CloneSession(document, {
    width: 800,
    height: 600,
    rootRect: document.documentElement.getBoundingClientRect(),
    scroll: { x: 0, y: 0 },
    layoutScale: 1,
  });
}

function element(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const child = host.firstElementChild;
  if (!child) throw new Error('no element');
  return child;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('CloneSession leaves out what is not rendered', () => {
  it('leaves out an element with display: none', () => {
    expect(session().filter(element('<div style="display: none"><p>panel</p></div>'))).toBe(false);
    expect(session().filter(element('<dialog><p>closed</p></dialog>'))).toBe(false);
  });

  it('copies visible elements', () => {
    expect(session().filter(element('<div><p>shown</p></div>'))).toBe(true);
    expect(session().filter(element('<div style="visibility: hidden">kept</div>'))).toBe(true);
  });

  it('keeps a hidden sprite sheet that <use> elements may point into', () => {
    const sprite = element(
      '<div style="display: none"><svg><symbol id="icon"><path d="M0 0h1v1z"/></symbol></svg></div>',
    );
    expect(session().filter(sprite)).toBe(true);
  });

  it('keeps hidden options: a select shows its selected option', () => {
    const select = element(
      '<select><option value="" hidden selected>Choose…</option><option>One</option></select>',
    );
    const option = select.querySelector('option');
    if (!option) throw new Error('no option');
    expect(session().filter(option)).toBe(true);
  });
});
