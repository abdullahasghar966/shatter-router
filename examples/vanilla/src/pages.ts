export interface Page {
  readonly title: string;
  readonly render: () => string;
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

export const notFound: Page = {
  title: 'Not found',
  render: () => `
    <section class="hero compact">
      <p class="eyebrow">404</p>
      <h1>Nothing here.</h1>
      <p class="lede"><a href="/">Back home</a></p>
    </section>`,
};
