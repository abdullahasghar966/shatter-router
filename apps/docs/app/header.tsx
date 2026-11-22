'use client';

import { usePathname } from 'next/navigation';
import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { ShatterLink, useShatter } from 'shatter-router/next';
import { CrackText } from './crack-text';
import {
  applyMaterial,
  applySound,
  applyTheme,
  currentMaterial,
  currentTheme,
  type Material,
  soundChosen,
  MATERIALS,
  SWATCHES,
  type Theme,
} from './lab-theme';

const NAV = [
  ['/effects', 'Effects'],
  ['/playground', 'Playground'],
  ['/docs', 'Docs'],
] as const;

function centre(event: MouseEvent<HTMLElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The material switcher and the light/dark toggle (ADR-050). Switching plays
 * a real transition: the page flips over and its back is the page in the new
 * material or theme. Without Shatter (not loaded yet) it switches at once.
 */
function LabControls(): ReactNode {
  const shatter = useShatter();
  // Rendered with defaults on the server; the real values after mount.
  const [theme, setTheme] = useState<Theme>('light');
  const [material, setMaterial] = useState<Material>('glass');
  const [sound, setSound] = useState(false);
  useEffect(() => {
    setTheme(currentTheme());
    setMaterial(currentMaterial());
    setSound(soundChosen());
  }, []);
  // Every transition on the site is made of the chosen material (ADR-057).
  useEffect(() => {
    shatter?.setMaterial(material);
  }, [shatter, material]);

  const switchTo = (
    apply: () => void,
    event: MouseEvent<HTMLElement>,
    nextMaterial?: Material,
  ): void => {
    if (!shatter) {
      apply();
      return;
    }
    void shatter.transition({
      commit: apply,
      effect: 'flip',
      origin: centre(event),
      scroll: 'none',
      // The switch itself turns over in the new material.
      ...(nextMaterial ? { material: nextMaterial } : {}),
    });
  };

  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <div className="lab-controls">
      <div className="swatches" role="group" aria-label="Material">
        {MATERIALS.map((name) => (
          <button
            key={name}
            type="button"
            className="swatch"
            style={{ '--swatch': SWATCHES[name] } as CSSProperties}
            aria-pressed={material === name}
            aria-label={`Material: ${name}`}
            title={name}
            onClick={(event) => {
              if (name === material) return;
              switchTo(
                () => {
                  applyMaterial(name);
                  setMaterial(name);
                },
                event,
                name,
              );
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="theme-toggle"
        aria-label="Sound"
        aria-pressed={sound}
        title={sound ? 'Sound on' : 'Sound off'}
        onClick={() => {
          const next = !sound;
          setSound(next);
          applySound(next);
          shatter?.setSound(next);
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {sound ? (
            <path
              d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M11 6l3.5 4M14.5 6L11 10"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      <button
        type="button"
        className="theme-toggle"
        aria-label={`Switch to ${nextTheme} theme`}
        title={`Switch to ${nextTheme} theme`}
        onClick={(event) => {
          switchTo(() => {
            applyTheme(nextTheme);
            setTheme(nextTheme);
          }, event);
        }}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Header(): ReactNode {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <ShatterLink className="brand" href="/">
        Shatter<span aria-hidden="true">/</span>
        <span className="sr-only"> </span>Router
      </ShatterLink>
      <nav aria-label="Main">
        {NAV.map(([href, label]) => (
          <ShatterLink
            key={href}
            href={href}
            {...(pathname === href || pathname.startsWith(`${href}/`)
              ? { 'aria-current': 'page' as const }
              : {})}
          >
            <CrackText>{label}</CrackText>
          </ShatterLink>
        ))}
        <a href="https://github.com/abdullahasghar966/shatter-router" rel="noopener">
          <CrackText>GitHub</CrackText>
        </a>
      </nav>
      <LabControls />
    </header>
  );
}
