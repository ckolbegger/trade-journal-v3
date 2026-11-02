import type { EntryDefinitionRecord, ReflectionDisposition } from '../../app/types.ts';
import type { Answers } from './ReflectionPrompts.tsx';

// How the trader meets a reflection: write it now, owe it for later, or decline (P18, A70).
export type Choice = 'now' | 'later' | 'decline';
const CHOICES: readonly (readonly [Choice, string])[] = [
  ['now', 'Reflect now'],
  ['later', 'Reflect later'],
  ['decline', 'Decline to reflect'],
];

// The disposition a choice submits; answers and a reason that were not chosen are never submitted.
export function dispositionOf(choice: Choice, definition: EntryDefinitionRecord, answers: Answers, reason: string): ReflectionDisposition {
  switch (choice) {
    case 'now':
      return { kind: 'Complete', form: { definitionId: definition.id, answers } };
    case 'later':
      return { kind: 'Defer' };
    case 'decline':
      return { kind: 'Decline', definitionId: definition.id, ...(reason.trim() !== '' && { reason }) };
  }
}

export interface ChoiceGroupProps {
  readonly legend: string;
  // Ties the legend to its group and keeps this group's radios apart from another's.
  readonly name: string;
  readonly value: Choice;
  readonly onChange: (choice: Choice) => void;
}

// One reflection's disposition as a radio group in a labelled fieldset.
export function ChoiceGroup({ legend, name, value, onChange }: ChoiceGroupProps) {
  return (
    <fieldset role="radiogroup" aria-labelledby={`${name}-legend`} className="choices">
      <legend id={`${name}-legend`}>{legend}</legend>
      {CHOICES.map(([choice, label]) => (
        <label key={choice} className="chip">
          <input type="radio" name={name} checked={value === choice} onChange={() => onChange(choice)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
