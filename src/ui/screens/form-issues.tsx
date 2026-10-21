import { useEffect, useRef } from 'react';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import type { FieldIssue } from './plan-issues.ts';

export interface IssueSummaryProps {
  readonly id: string;
  readonly heading: string;
  readonly issues: readonly FieldIssue[];
}

// Lists every issue of a rejected submission and takes focus each time a new set arrives.
export function IssueSummary({ id, heading, issues }: IssueSummaryProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (issues.length > 0) ref.current?.focus();
  }, [issues]);
  if (issues.length === 0) return null;
  return (
    <section ref={ref} tabIndex={-1} className="banner warning" aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </section>
  );
}

// Each field's issues shown beside it and tied to it for assistive technology.
export function fieldIssues(issues: readonly FieldIssue[]) {
  const errorFor = (field: string) =>
    issues
      .filter((i) => i.field === field)
      .map((i) => i.message)
      .join(' ') || undefined;
  return {
    fieldError: (field: string) => {
      const error = errorFor(field);
      return error ? (
        <p id={`${field}-error`} className="field-error">
          {error}
        </p>
      ) : null;
    },
    describedBy: (field: string) => (errorFor(field) ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {}),
    // Issue messages by Prompt identity, for ReflectionPrompts.
    promptErrors: (definition: EntryDefinitionRecord) =>
      Object.fromEntries(definition.prompts.flatMap((p) => (errorFor(p.id) ? [[p.id, errorFor(p.id)!]] : []))),
  };
}
