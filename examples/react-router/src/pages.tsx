import { useLayoutEffect, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useLoaderData } from 'react-router';
import { ShatterLink, useShatterNavigate } from 'shatter-router/react-router';

/** Sets the document title while a page is shown (announced after each transition). */
function usePageTitle(title: string): void {
  useLayoutEffect(() => {
    document.title = `${title} — Shatter Router React Router example`;
  }, [title]);
}

const swatches = [
  ['Ember', '#ff5a36', '#ffb199'],
  ['Lagoon', '#1fb6a6', '#a7f3e8'],
  ['Iris', '#6d5efc', '#c9c3ff'],
  ['Citrine', '#f2c94c', '#fff1bf'],
  ['Moss', '#3f8f4f', '#bfe6c6'],
  ['Rose', '#e8457c', '#ffc2d6'],
] as const;

function Card({ swatch, index }: { swatch: (typeof swatches)[number]; index: number }): ReactNode {
  const [name, from, to] = swatch;
  return (
    <article className="card" style={{ '--from': from, '--to': to } as CSSProperties}>
      <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
      <h3>{name}</h3>
      <p>Case study {index + 1}: a page that breaks beautifully.</p>
    </article>
  );
}

export function Home(): ReactNode {
  usePageTitle('Home');
  const navigate = useShatterNavigate();
  const onProgrammatic = (event: MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    void navigate('/about', {
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  };
  return (
    <>
      <section className="hero">
        <p className="eyebrow">React Router example</p>
        <h1>Break the page.</h1>
        <p className="lede">
          A React Router data-mode app. Links are <code>&lt;ShatterLink&gt;</code> and{' '}
          <code>&lt;ShatterNavLink&gt;</code>: modifier clicks, new tabs, downloads and other
          origins are left to the browser.
        </p>
        <div className="actions">
          <ShatterLink className="button" to="/work">
            See the work
          </ShatterLink>
          <ShatterLink className="button ghost" to="/about">
            About this example
          </ShatterLink>
          <button type="button" className="button ghost" onClick={onProgrammatic}>
            Navigate in code
          </button>
        </div>
      </section>
      <section className="grid" aria-label="Featured">
        {swatches.slice(0, 3).map((swatch, index) => (
          <Card key={swatch[0]} swatch={swatch} index={index} />
        ))}
      </section>
    </>
  );
}

export function Work(): ReactNode {
  usePageTitle('Work');
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Selected work</p>
        <h1>Six pieces of glass.</h1>
      </section>
      <section className="grid" aria-label="All work">
        {swatches.map((swatch, index) => (
          <Card key={swatch[0]} swatch={swatch} index={index} />
        ))}
      </section>
      <p className="footnote">
        <ShatterLink to="/about#links">How links are handled</ShatterLink>
      </p>
    </>
  );
}

export function About(): ReactNode {
  usePageTitle('About');
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">About</p>
        <h1>Links that behave.</h1>
      </section>
      <section className="prose" id="links">
        <p>
          Ctrl/Cmd/Shift/Alt-click, middle-click, <code>target=&quot;_blank&quot;</code>,{' '}
          <code>download</code> and cross-origin links keep their native behaviour.
        </p>
        <ul>
          <li>
            <ShatterLink to="/work" target="_blank">
              Work in a new tab
            </ShatterLink>
          </li>
          <li>
            <ShatterLink to="/work" data-shatter="off">
              Work, opted out with data-shatter=&quot;off&quot;
            </ShatterLink>
          </li>
          <li>
            <ShatterLink to="/work" effect="shatter" reloadDocument>
              Work, with a full page load (reloadDocument)
            </ShatterLink>
          </li>
          <li>
            <a href="#links">Same-page anchor</a>
          </li>
        </ul>
      </section>
    </>
  );
}

/** How long the `/slow` route's loader takes, ms. */
export const SLOW_MS = 400;

export interface SlowData {
  readonly waited: number;
}

export async function slowLoader(): Promise<SlowData> {
  await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
  return { waited: SLOW_MS };
}

/** The `/slow` page in data mode, with its loader's data. */
export function SlowRoute(): ReactNode {
  return <Slow data={useLoaderData<SlowData>()} />;
}

/** The `/slow` page; in declarative mode there is no loader and no data. */
export function Slow({ data }: { data?: SlowData }): ReactNode {
  usePageTitle('Slow');
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Loader</p>
        <h1>Worth the wait.</h1>
        <p className="lede" data-testid="slow-data">
          {data ? `Loaded after ${data.waited} ms.` : 'No loader in declarative mode.'}
        </p>
      </section>
    </>
  );
}

export function NotFound(): ReactNode {
  usePageTitle('Not found');
  return (
    <section className="hero compact">
      <p className="eyebrow">404</p>
      <h1>Nothing here.</h1>
      <p className="lede">
        <ShatterLink to="/">Back home</ShatterLink>
      </p>
    </section>
  );
}
