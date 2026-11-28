'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ShatterLink } from 'shatter-router/next';
import type { Framework } from '../lib/frameworks';
import { search, type SearchIndex, type SearchResult } from '../lib/search';
import { chooseFramework } from './framework-tabs';

/** Getting started's framework sections live in tabs: open the right one. */
const FRAMEWORK_ANCHORS: Readonly<Record<string, Framework>> = {
  '/docs/getting-started#nextjs': 'next',
  '/docs/getting-started#react-router': 'react-router',
  '/docs/getting-started#react': 'react',
  '/docs/getting-started#vanilla': 'vanilla',
};

let loading: Promise<SearchIndex> | null = null;

/** The index is its own chunk, fetched the first time the dialog opens. */
function loadIndex(): Promise<SearchIndex> {
  loading ??= import('../lib/search-index.json').then((module) => module.default);
  return loading;
}

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Search (ADR-061): Ctrl/Cmd+K or `/` opens a modal dialog over a prebuilt
 * index of every page; results are links that break the page like any other.
 */
export function Search(): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const id = useId();

  const open = (): void => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    input.current?.select();
    void loadIndex().then(setIndex);
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !typing(event.target);
      if (!combo && !slash) return;
      event.preventDefault();
      if (combo && dialog.current?.open) dialog.current.close();
      else open();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const results: SearchResult[] = useMemo(
    () => (index ? search(index, query) : []),
    [index, query],
  );

  const close = (): void => {
    dialog.current?.close();
  };

  const go = (result: SearchResult): void => {
    const framework = FRAMEWORK_ANCHORS[result.href];
    if (framework) chooseFramework(framework);
    // Closed before the click's transition captures the page.
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) =>
        results.length === 0 ? 0 : (current + step + results.length) % results.length,
      );
    } else if (event.key === 'Enter') {
      const link = dialog.current?.querySelector<HTMLAnchorElement>(
        `#${CSS.escape(`${id}-result-${String(active)}`)}`,
      );
      if (link) {
        event.preventDefault();
        link.click();
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className="search-button"
        onClick={open}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K /"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M10.4 10.4L14 14"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span>Search</span>
        <kbd aria-hidden="true">/</kbd>
      </button>
      <dialog
        ref={dialog}
        className="search-dialog"
        aria-label="Search the docs"
        onClick={(event) => {
          // A click on the backdrop (the dialog itself, outside its box) closes it.
          if (event.target === dialog.current) close();
        }}
        onClose={() => {
          setQuery('');
          setActive(0);
        }}
      >
        <div className="search-box">
          <input
            ref={input}
            type="search"
            className="search-input"
            placeholder="Search effects, options, guides…"
            aria-label="Search"
            aria-controls={`${id}-results`}
            aria-activedescendant={
              results.length > 0 ? `${id}-result-${String(active)}` : undefined
            }
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul id={`${id}-results`} className="search-results" role="listbox" aria-label="Results">
            {results.map((result, i) => (
              <li key={result.href} role="presentation">
                <ShatterLink
                  id={`${id}-result-${String(i)}`}
                  href={result.href}
                  role="option"
                  aria-selected={i === active}
                  className="search-result"
                  onClick={() => {
                    go(result);
                  }}
                  onMouseMove={() => {
                    setActive(i);
                  }}
                >
                  <span className="search-result-title">
                    {result.title}
                    {result.heading ? <span> › {result.heading}</span> : null}
                  </span>
                  <span className="search-result-text">{result.snippet}</span>
                </ShatterLink>
              </li>
            ))}
          </ul>
          <p className="search-status" role="status">
            {query.trim() === ''
              ? 'Type to search every page.'
              : index === null
                ? 'Loading the index…'
                : results.length === 0
                  ? 'Nothing found.'
                  : `${String(results.length)} result${results.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </dialog>
    </>
  );
}
