'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Copies a code block's text (ADR-061); says so for two seconds, politely. */
export function CopyButton({ text }: { text: string }): ReactNode {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  const onClick = (): void => {
    navigator.clipboard.writeText(text).then(
      () => {
        setState('copied');
      },
      () => {
        setState('failed');
      },
    );
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setState('idle');
    }, 2000);
  };
  return (
    <button type="button" className="copy-button" onClick={onClick} aria-label="Copy code">
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select to copy' : 'Copy'}
      </span>
    </button>
  );
}
