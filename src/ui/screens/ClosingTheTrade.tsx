import type { ReactNode } from 'react';

export interface CloseReasonOption {
  readonly id: string;
  readonly label: string;
}

export interface ClosingTheTradeProps {
  // The selectable Close Reasons, in the order the Catalog lists them.
  readonly reasons: readonly CloseReasonOption[];
  readonly reasonId?: string;
  readonly onReason: (id: string) => void;
  // Issue messages beside their fields, from the form's issue handling.
  readonly fieldError: (field: string) => ReactNode;
  readonly describedBy: (field: string) => object;
}

// What closing the Trade asks for (P21): the Close Reason. A closing sale always puts its Close Review off.
export function ClosingTheTrade(props: ClosingTheTradeProps) {
  const { reasons, reasonId, fieldError, describedBy } = props;
  return (
    <section className="card" aria-labelledby="closing-heading">
      <h2 id="closing-heading">Closing the Trade</h2>
      <fieldset role="radiogroup" aria-labelledby="close-reason-legend" className="choices" {...describedBy('closeReasonId')}>
        <legend id="close-reason-legend">Close Reason</legend>
        {reasons.map((reason) => (
          <label key={reason.id} className="chip">
            <input type="radio" name="close-reason" checked={reasonId === reason.id} onChange={() => props.onReason(reason.id)} />
            {reason.label}
          </label>
        ))}
      </fieldset>
      {fieldError('closeReasonId')}
      {fieldError('closeReview')}
    </section>
  );
}
