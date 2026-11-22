'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { DEFAULT_FRAMEWORK, type Framework, FRAMEWORK_KEY, FRAMEWORKS } from '../lib/frameworks';

const CHANGE = 'docs-framework-change';

/** The framework chosen on this site (Next.js when none). */
export function currentFramework(): Framework {
  const value = document.documentElement.getAttribute('data-framework');
  return FRAMEWORKS.find((framework) => framework.id === value)?.id ?? DEFAULT_FRAMEWORK;
}

/** Shows `framework` in every tab group on the site and remembers it. */
export function chooseFramework(framework: Framework): void {
  document.documentElement.setAttribute('data-framework', framework);
  try {
    localStorage.setItem(FRAMEWORK_KEY, framework);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Framework tabs (ADR-061). Every tab group on the site shows the same
 * framework: the choice is an attribute on <html>, set before first paint by
 * the layout's script from localStorage, so the right panel shows without a
 * layout shift; CSS shows the panel, and this component keeps the tab
 * semantics (selected tab, arrow keys) in step.
 */
export function FrameworkTabs({
  label,
  panels,
}: {
  label: string;
  panels: Readonly<Record<Framework, ReactNode>>;
}): ReactNode {
  const id = useId();
  const [selected, setSelected] = useState<Framework>(DEFAULT_FRAMEWORK);

  useEffect(() => {
    setSelected(currentFramework());
    const sync = (): void => {
      setSelected(currentFramework());
    };
    window.addEventListener(CHANGE, sync);
    return () => {
      window.removeEventListener(CHANGE, sync);
    };
  }, []);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = FRAMEWORKS.findIndex((framework) => framework.id === selected);
    const last = FRAMEWORKS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    const target = FRAMEWORKS[next];
    if (!target) return;
    event.preventDefault();
    chooseFramework(target.id);
    document.getElementById(`${id}-tab-${target.id}`)?.focus();
  };

  return (
    <div className="fw-tabs">
      <div className="fw-tablist" role="tablist" aria-label={label}>
        {FRAMEWORKS.map((framework) => (
          <button
            key={framework.id}
            id={`${id}-tab-${framework.id}`}
            type="button"
            role="tab"
            className="fw-tab"
            data-fw={framework.id}
            aria-selected={selected === framework.id}
            aria-controls={`${id}-panel-${framework.id}`}
            tabIndex={selected === framework.id ? 0 : -1}
            onClick={() => {
              chooseFramework(framework.id);
            }}
            onKeyDown={onKey}
          >
            {framework.label}
          </button>
        ))}
      </div>
      {FRAMEWORKS.map((framework) => (
        <div
          key={framework.id}
          id={`${id}-panel-${framework.id}`}
          role="tabpanel"
          className="fw-panel"
          data-fw={framework.id}
          aria-labelledby={`${id}-tab-${framework.id}`}
        >
          {panels[framework.id]}
        </div>
      ))}
    </div>
  );
}
