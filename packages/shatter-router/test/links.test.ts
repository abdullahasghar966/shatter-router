import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyLinkClick,
  findAnchor,
  getLinkEffect,
  type LinkClickEvent,
} from '../src/core/links';

const HERE = { href: 'https://app.example/work?tab=1' };

const plainClick: LinkClickEvent = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

function link(html: string): HTMLAnchorElement {
  document.body.innerHTML = html;
  const a = document.querySelector('a');
  if (!a) throw new Error('fixture has no <a>');
  return a;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('classifyLinkClick', () => {
  it('intercepts a plain same-origin click', () => {
    const decision = classifyLinkClick(plainClick, link('<a href="/about">About</a>'), HERE);
    expect(decision.intercept).toBe(true);
    if (decision.intercept) expect(decision.url.href).toBe('https://app.example/about');
  });

  it.each([['metaKey'], ['ctrlKey'], ['shiftKey'], ['altKey']] as const)(
    'does not intercept %s clicks',
    (key) => {
      const decision = classifyLinkClick(
        { ...plainClick, [key]: true },
        link('<a href="/x">x</a>'),
        HERE,
      );
      expect(decision).toEqual({ intercept: false, reason: 'modifier-key' });
    },
  );

  it('does not intercept middle or right clicks', () => {
    const a = link('<a href="/x">x</a>');
    expect(classifyLinkClick({ ...plainClick, button: 1 }, a, HERE)).toEqual({
      intercept: false,
      reason: 'not-primary-button',
    });
    expect(classifyLinkClick({ ...plainClick, button: 2 }, a, HERE)).toMatchObject({
      intercept: false,
    });
  });

  it('respects an already prevented event', () => {
    const decision = classifyLinkClick(
      { ...plainClick, defaultPrevented: true },
      link('<a href="/x">x</a>'),
      HERE,
    );
    expect(decision).toEqual({ intercept: false, reason: 'default-prevented' });
  });

  it.each(['_blank', '_parent', '_top', 'named-frame', '_BLANK'])(
    'does not intercept target="%s"',
    (target) => {
      const decision = classifyLinkClick(
        plainClick,
        link(`<a href="/x" target="${target}">x</a>`),
        HERE,
      );
      expect(decision).toEqual({ intercept: false, reason: 'target' });
    },
  );

  it('intercepts target="_self"', () => {
    const decision = classifyLinkClick(plainClick, link('<a href="/x" target="_self">x</a>'), HERE);
    expect(decision.intercept).toBe(true);
  });

  it('honours <base target>', () => {
    document.head.innerHTML = '<base target="_blank">';
    const a = document.createElement('a');
    a.setAttribute('href', '/x');
    document.body.append(a);
    expect(classifyLinkClick(plainClick, a, HERE)).toEqual({ intercept: false, reason: 'target' });
  });

  it('does not intercept downloads', () => {
    const decision = classifyLinkClick(
      plainClick,
      link('<a href="/file.pdf" download>x</a>'),
      HERE,
    );
    expect(decision).toEqual({ intercept: false, reason: 'download' });
  });

  it('does not intercept other origins', () => {
    const decision = classifyLinkClick(
      plainClick,
      link('<a href="https://other.example/x">x</a>'),
      HERE,
    );
    expect(decision).toEqual({ intercept: false, reason: 'external-origin' });
  });

  it('treats a different port or scheme as another origin', () => {
    expect(
      classifyLinkClick(plainClick, link('<a href="https://app.example:8443/x">x</a>'), HERE),
    ).toMatchObject({ reason: 'external-origin' });
    expect(
      classifyLinkClick(plainClick, link('<a href="http://app.example/x">x</a>'), HERE),
    ).toMatchObject({ reason: 'external-origin' });
  });

  it.each(['mailto:a@b.c', 'tel:+100', 'javascript:void(0)', 'blob:https://app.example/1'])(
    'does not intercept %s',
    (href) => {
      expect(classifyLinkClick(plainClick, link(`<a href="${href}">x</a>`), HERE)).toEqual({
        intercept: false,
        reason: 'non-http-protocol',
      });
    },
  );

  it('does not intercept data-shatter="off" on the link or an ancestor', () => {
    expect(
      classifyLinkClick(plainClick, link('<a href="/x" data-shatter="off">x</a>'), HERE),
    ).toEqual({ intercept: false, reason: 'opt-out' });
    expect(
      classifyLinkClick(plainClick, link('<nav data-shatter="off"><a href="/x">x</a></nav>'), HERE),
    ).toEqual({ intercept: false, reason: 'opt-out' });
  });

  it('does not intercept hash-only links to the same page', () => {
    expect(classifyLinkClick(plainClick, link('<a href="/work?tab=1#s">x</a>'), HERE)).toEqual({
      intercept: false,
      reason: 'same-page-hash',
    });
  });

  it('intercepts a hash link to a different page', () => {
    expect(classifyLinkClick(plainClick, link('<a href="/about#team">x</a>'), HERE).intercept).toBe(
      true,
    );
    expect(
      classifyLinkClick(plainClick, link('<a href="/work?tab=2#s">x</a>'), HERE).intercept,
    ).toBe(true);
  });

  it('does not intercept an <a> without href', () => {
    expect(classifyLinkClick(plainClick, link('<a>x</a>'), HERE)).toEqual({
      intercept: false,
      reason: 'no-href',
    });
  });
});

describe('findAnchor', () => {
  it('finds the anchor from a nested target', () => {
    document.body.innerHTML = '<a href="/x"><span><b id="inner">x</b></span></a>';
    let found: HTMLAnchorElement | null = null;
    document.addEventListener('click', (e) => (found = findAnchor(e)), { once: true });
    document
      .getElementById('inner')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(found).toBe(document.querySelector('a'));
  });

  it('finds an anchor inside an open shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<a href="/x"><i id="icon">i</i></a>';
    let found: HTMLAnchorElement | null = null;
    document.addEventListener('click', (e) => (found = findAnchor(e)), { once: true });
    root
      .getElementById('icon')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(found).toBe(root.querySelector('a'));
  });

  it('returns null when no anchor is on the path', () => {
    document.body.innerHTML = '<button id="b">x</button>';
    let found: HTMLAnchorElement | null = document.createElement('a');
    document.addEventListener('click', (e) => (found = findAnchor(e)), { once: true });
    document.getElementById('b')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(found).toBeNull();
  });
});

describe('getLinkEffect', () => {
  it('reads data-shatter-effect', () => {
    expect(getLinkEffect(link('<a href="/x" data-shatter-effect="implode">x</a>'))).toBe('implode');
  });

  it('inherits from an ancestor and ignores blanks', () => {
    expect(getLinkEffect(link('<div data-shatter-effect="flip"><a href="/x">x</a></div>'))).toBe(
      'flip',
    );
    expect(getLinkEffect(link('<a href="/x" data-shatter-effect="  ">x</a>'))).toBeUndefined();
    expect(getLinkEffect(link('<a href="/x">x</a>'))).toBeUndefined();
  });
});
