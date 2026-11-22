export interface Page {
  readonly title: string;
  readonly render: () => string;
  /** Runs after the page HTML is in the DOM (canvas drawing, media). */
  readonly mount?: (root: HTMLElement) => void;
}

const swatches = [
  ['Ember', '#ff5a36', '#ffb199'],
  ['Lagoon', '#1fb6a6', '#a7f3e8'],
  ['Iris', '#6d5efc', '#c9c3ff'],
  ['Citrine', '#f2c94c', '#fff1bf'],
  ['Moss', '#3f8f4f', '#bfe6c6'],
  ['Rose', '#e8457c', '#ffc2d6'],
] as const;

function card([name, from, to]: (typeof swatches)[number], index: number): string {
  return `
    <article class="card" style="--from:${from};--to:${to}">
      <span class="card-index">${String(index + 1).padStart(2, '0')}</span>
      <h3>${name}</h3>
      <p>Case study ${index + 1}: a page that breaks beautifully.</p>
    </article>`;
}

export const pages: Readonly<Record<string, Page>> = {
  '/': {
    title: 'Home',
    render: () => `
      <section class="hero">
        <p class="eyebrow">Vanilla example</p>
        <h1>Break the page.</h1>
        <p class="lede">
          A plain <code>history.pushState</code> app. Every internal link below goes through
          Shatter Router's link rules: modifier clicks, new tabs, downloads and other origins
          are left to the browser.
        </p>
        <div class="actions">
          <a class="button" href="/work">See the work</a>
          <a class="button ghost" href="/about">About this example</a>
        </div>
      </section>
      <section class="grid" aria-label="Featured">
        ${swatches.slice(0, 3).map(card).join('')}
      </section>`,
  },
  '/work': {
    title: 'Work',
    render: () => `
      <section class="hero compact">
        <p class="eyebrow">Selected work</p>
        <h1>Six pieces of glass.</h1>
      </section>
      <section class="grid" aria-label="All work">
        ${swatches.map(card).join('')}
      </section>
      <p class="footnote"><a href="/about#links">How links are handled</a></p>`,
  },
  '/about': {
    title: 'About',
    render: () => `
      <section class="hero compact">
        <p class="eyebrow">About</p>
        <h1>Links that behave.</h1>
      </section>
      <section class="prose" id="links">
        <p>
          Ctrl/Cmd/Shift/Alt-click, middle-click, <code>target="_blank"</code>,
          <code>download</code> and cross-origin links keep their native behaviour.
        </p>
        <ul>
          <li><a href="/work" target="_blank">Work in a new tab</a></li>
          <li><a href="/work" data-shatter="off">Work, opted out with data-shatter="off"</a></li>
          <li><a href="#links">Same-page anchor</a></li>
        </ul>
      </section>`,
  },
};

/** Every built-in effect, each link playing its own (per-link `data-shatter-effect`). */
const EFFECTS = [
  ['shatter', 'A long crack from the click, then the pane drops.'],
  ['explode', 'A flash, a shockwave and a spider-web blast toward you.'],
  ['implode', 'Shards spiral into the click like a black hole.'],
  ['flip', 'Every shard turns over: the new page is on the back.'],
  ['assemble', 'The old page falls away as the new one flies together.'],
] as const;

/** The motion families (ADR-055), one link each. */
const MOTION_FAMILIES = [
  ['Gravity', ['crumble', 'rain']],
  ['Force', ['vortex', 'wind']],
  ['Order', ['blinds', 'domino', 'slide', 'fold']],
  ['Matter', ['melt', 'ripple', 'glitch']],
] as const;

export const effectsPage: Page = {
  title: 'Effects',
  render: () => `
    <section class="hero compact">
      <p class="eyebrow">Effects</p>
      <h1>Sixteen ways to break.</h1>
    </section>
    <section class="prose" aria-label="Effects">
      <ul class="effects">
        ${EFFECTS.map(
          ([name, text]) => `
        <li><a href="/work" data-shatter-effect="${name}">${name}</a> — ${text}</li>`,
        ).join('')}
        <li><a href="/work" data-shatter-effect="sweep">sweep</a> — a composition: shatter, left to right.</li>
      </ul>
      <p class="families">
        ${MOTION_FAMILIES.map(
          ([family, names]) =>
            `<span>${family}: ${names.map((name) => `<a href="/work" data-shatter-effect="${name}">${name}</a>`).join(' · ')}</span>`,
        ).join('<br>')}
      </p>
    </section>`,
};

export const notFound: Page = {
  title: 'Not found',
  render: () => `
    <section class="hero compact">
      <p class="eyebrow">404</p>
      <h1>Nothing here.</h1>
      <p class="lede"><a href="/">Back home</a></p>
    </section>`,
};
