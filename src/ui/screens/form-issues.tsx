import { useEffect, useRef } from 'react';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import type { FieldIssue } from './plan-issues.ts';
import type { Answers } from './ReflectionPrompts.tsx';

export interface IssueSummaryProps {
  readonly id: string;
  readonly heading: string;
  // The issues of the last submission; focus moves only when a new set arrives.
  readonly issues: readonly FieldIssue[];
  // Issues the trader has since corrected: left out of the list, and the summary goes when none remain.
  readonly corrected?: (issue: FieldIssue) => boolean;
}

// Lists the issues of a rejected submission that are not yet corrected and takes focus each time a new set arrives.
export function IssueSummary({ id, heading, issues: submitted, corrected = () => false }: IssueSummaryProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (submitted.length > 0) ref.current?.focus();
  }, [submitted]);
  const issues = submitted.filter((issue) => !corrected(issue));
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

// Prices and quantities are decimals with at most 6 places (the same shape the server accepts).
const DECIMAL = /^\d+(\.\d{1,6})?$/;
export const isPositiveDecimal = (text: string) => DECIMAL.test(text.trim()) && Number(text) > 0;
export const isNonNegativeDecimal = (text: string) => DECIMAL.test(text.trim());

// Whether a Prompt now has an answer that differs from the one it had when the issue was reported.
export const answerChanged = (before: Answers, now: Answers, promptId: string) =>
  now[promptId] !== undefined && JSON.stringify(now[promptId]) !== JSON.stringify(before[promptId]);
