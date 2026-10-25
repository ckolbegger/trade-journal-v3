import { useEffect, useRef } from 'react';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import type { FieldIssue } from './plan-issues.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
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

// The decimal a text field holds, judged as the submit step and the domain judge it (trimmed, at most
// 6 places); undefined when it is not one. The comparisons use exact Rational values.
export function positiveDecimal(text: string): Rational | undefined {
  const parsed = parseDecimal(text.trim(), { positive: true });
  return parsed.ok ? parsed.value : undefined;
}
export function nonNegativeDecimal(text: string): Rational | undefined {
  const parsed = parseDecimal(text.trim());
  return parsed.ok && parsed.value.compare(Rational.of(0n)) >= 0 ? parsed.value : undefined;
}

// The symbol rule of the domain's Plan assessment (SYMBOL in src/domain/trade-analysis/plan.ts, which the UI may not import).
const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
export const isValidSymbol = (text: string) => SYMBOL.test(text.trim().toUpperCase());

// Whether a Prompt now has an answer that differs from the one it had when the issue was reported.
// A Text answer that is blank after trimming is no answer, as in the Journal's rule.
export const answerChanged = (before: Answers, now: Answers, promptId: string) => {
  const answer = now[promptId];
  if (answer === undefined || (answer.kind === 'Text' && answer.text.trim() === '')) return false;
  return JSON.stringify(answer) !== JSON.stringify(before[promptId]);
};
