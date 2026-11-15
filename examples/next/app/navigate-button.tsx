'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useShatterNavigate } from 'shatter-router/next';

/** Programmatic navigation with a transition, breaking from the button's centre. */
export function NavigateButton(): ReactNode {
  const navigate = useShatterNavigate();
  const onClick = (event: MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    void navigate('/about', {
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  };
  return (
    <button type="button" className="button ghost" onClick={onClick}>
      Navigate in code
    </button>
  );
}
