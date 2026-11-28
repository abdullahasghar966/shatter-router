'use client';

import { type ReactNode, useId } from 'react';

interface Props<T extends string> {
  label: string;
  value: T;
  choices: readonly T[];
  /** Text for a choice; default: the choice itself. */
  text?: (choice: T) => string;
  onChange: (value: T) => void;
}

/**
 * A labelled native select. The label points at the select by id (a label
 * wrapping a select gives it its option text as part of its name).
 */
export function SelectField<T extends string>({
  label,
  value,
  choices,
  text,
  onChange,
}: Props<T>): ReactNode {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = choices.find((choice) => choice === event.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {text ? text(choice) : choice}
          </option>
        ))}
      </select>
    </div>
  );
}
