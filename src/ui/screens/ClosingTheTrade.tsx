import type { ReactNode } from 'react';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import { ChoiceGroup, type Choice } from './reflection-choice.tsx';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';

export interface CloseReasonOption {
  readonly id: string;
  readonly label: string;
}

export interface ClosingTheTradeProps {
  // The selectable Close Reasons, in the order the Catalog lists them. A close that needs none (an
  // Expiration) gives `noReasonNote` in their place.
  readonly reasons?: readonly CloseReasonOption[];
  readonly reasonId?: string;
  readonly onReason?: (id: string) => void;
  readonly noReasonNote?: string;
  readonly definition: EntryDefinitionRecord;
  readonly choice: Choice;
  readonly onChoice: (choice: Choice) => void;
  readonly declineReason: string;
  readonly onDeclineReason: (reason: string) => void;
  readonly answers: Answers;
  readonly onAnswers: (answers: Answers) => void;
  // Issue messages beside their fields, from the form's issue handling.
  readonly fieldError: (field: string) => ReactNode;
  readonly describedBy: (field: string) => object;
  readonly promptErrors: Readonly<Record<string, string>>;
}

// What closing the Trade asks for (P21): the Close Reason, and the Close Review with its own
// disposition, apart from the exit's reflection.
export function ClosingTheTrade(props: ClosingTheTradeProps) {
  const { reasons, reasonId, definition, choice, answers, fieldError, describedBy } = props;
  return (
    <section className="card" aria-labelledby="closing-heading">
      <h2 id="closing-heading">Closing the Trade</h2>
      {reasons ? (
        <>
          <fieldset role="radiogroup" aria-labelledby="close-reason-legend" className="choices" {...describedBy('closeReasonId')}>
            <legend id="close-reason-legend">Close Reason</legend>
            {reasons.map((reason) => (
              <label key={reason.id} className="chip">
                <input type="radio" name="close-reason" checked={reasonId === reason.id} onChange={() => props.onReason?.(reason.id)} />
                {reason.label}
              </label>
            ))}
          </fieldset>
          {fieldError('closeReasonId')}
        </>
      ) : (
        <p>{props.noReasonNote}</p>
      )}
      <ChoiceGroup legend="Close Review" name="close-review-disposition" value={choice} onChange={props.onChoice} describedBy={describedBy('closeReview')} />
      {fieldError('closeReview')}
      {choice === 'decline' && (
        <div className="field">
          <label>
            Reason for declining the Close Review (optional)
            <textarea value={props.declineReason} onChange={(e) => props.onDeclineReason(e.target.value)} {...describedBy('closeReviewReason')} />
          </label>
          {fieldError('closeReviewReason')}
        </div>
      )}
      {choice === 'now' && <ReflectionPrompts definition={definition} answers={answers} onChange={props.onAnswers} errors={props.promptErrors} />}
    </section>
  );
}
