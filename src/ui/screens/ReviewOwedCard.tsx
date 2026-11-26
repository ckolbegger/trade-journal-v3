import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { UiFacade } from '../../app/compose.ts';
import type { OwedReflectionsCard, OwedReflectionsTrade, OwedTradeSummary, PostSaveReview } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { localTime, shortDate, tradeSummary } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { panelOf, plural, reflectionsStatus, type Go } from './ReviewCard.tsx';
import { howEnded, planResultRows, type ClosedSummary } from './closed-card.ts';
import { shownFirst, type FormRegister } from './form-handle.ts';
import { Refusal, type RefusalProps } from './Refusal.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';

// What the open owed card shows while its Trade is read, or when it could not be.
export type OwedDetail = 'Loading' | 'Unavailable' | { readonly card: OwedReflectionsCard };

// The card has no further panel to move on to when its reflections are answered.
const NOTHING_NEXT = () => undefined;

// "2 reflections due", "1 not yet due", or Done once nothing is owed now: the words of the progress record (A164, A167).
// The Close Review names the card when it is owed now, from the next Review, answered or declined (W151); the last two are read from the opened card.
function remainsText(trade: OwedReflectionsTrade, detail: OwedDetail | undefined): string {
  const { dueNow, later } = panelOf(trade.progress, 'Reflections');
  const closeReview = trade.owed.find((item) => item.entryTypeKey === 'entry-type.close-review');
  if (closeReview?.classification === 'Due') return 'Close Review due';
  const outcome = typeof detail === 'object' && detail.card.summary?.kind === 'Closed' ? detail.card.summary.closeReviewOutcome?.kind : undefined;
  let closeState: string | undefined;
  if (closeReview?.classification === 'DueInNextReview') closeState = 'Close Review · next Review';
  else if (!closeReview && outcome === 'Entry') closeState = 'Close Review saved';
  else if (!closeReview && outcome === 'Decline') closeState = 'Close Review declined';
  if (dueNow > 0) return [`${plural(dueNow, 'reflection', 'reflections')} due`, closeState].filter(Boolean).join(' · ');
  if (closeState) return closeState;
  return later > 0 ? `${later} not yet due` : 'Done';
}

// How a Closed Trade ended (W150): the words, the date and the Close Reason, then its result.
function Ended({ summary }: { readonly summary: ClosedSummary }) {
  const { timeZone = 'UTC' } = useRuntime();
  const date = summary.terminalTime && shortDate(localTime(summary.terminalTime, timeZone).slice(0, 10));
  const reason = summary.closeReason && (summary.closeReason.label || summary.closeReason.id);
  return (
    <section aria-label="How it ended">
      <p>
        How it ended: {howEnded(summary)}
        {date && `, ${date}`}.{reason && ` ${reason}.`}
      </p>
      <table className="plan-result" aria-label="Plan and what happened">
        <thead>
          <tr>
            <td />
            <th scope="col">Plan</th>
            <th scope="col">What happened</th>
          </tr>
        </thead>
        <tbody>
          {planResultRows(summary, timeZone).map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.plan}</td>
              <td>
                {row.happened.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// The Trade's summary for its lifecycle (A90): how a Closed Trade ended, or what an Open Trade holds.
function Summary({ card }: { readonly card: OwedReflectionsCard }) {
  const summary: OwedTradeSummary | undefined = card.summary;
  if (summary?.kind === 'Closed') return <Ended summary={summary} />;
  // A Closed Trade whose facts cannot be replayed has nothing to say of how it ended.
  if (card.lifecycle === 'Closed') return null;
  return (
    <section aria-label="Result">
      <dl>
        <dt>Lifecycle</dt>
        <dd>{card.lifecycle}</dd>
        {summary?.kind === 'Open' && (
          <>
            {summary.position && (
              <>
                <dt>Position</dt>
                <dd>{tradeSummary(summary.position)}</dd>
              </>
            )}
            <dt>Entry</dt>
            <dd>{summary.entryResolution.kind}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

export interface OwedCardProps {
  readonly facade: UiFacade;
  readonly trade: OwedReflectionsTrade;
  readonly reviewDate: string;
  readonly expanded: boolean;
  readonly detail: OwedDetail | undefined;
  // A count that grows each time the trader asks for this card: it scrolls into view and takes focus on its header.
  readonly reveal: number;
  // Where a link into the Review sends this card (A161): its Reflections panel is the one it has to open.
  readonly go: Go;
  // The trader pressed this card's header while another card's form holds an entered value (A156, W128).
  readonly refusal?: RefusalProps;
  readonly onToggle: () => void;
  // Reads the Trade again when it could not be read.
  readonly onRetry: () => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
  readonly onForm: FormRegister;
}

// One Trade of the group after the walk (P20): a position card with a Reflections panel and no Action panel (D5R, section 9).
export function OwedCard({ facade, trade, reviewDate, expanded, detail, reveal, go, refusal, onToggle, onRetry, onReflectionResolved, onEntryDirty, onForm }: OwedCardProps) {
  const item = useRef<HTMLLIElement>(null);
  const header = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reveal === 0) return;
    item.current?.scrollIntoView?.({ block: 'start' });
    header.current?.focus({ preventScroll: true });
  }, [reveal]);
  return (
    <li className="review-card" ref={item} data-trade-id={trade.tradeId}>
      <div className="review-card-head">
        <h3>
          <button type="button" ref={header} aria-expanded={expanded} onClick={onToggle}>
            <span className="visually-hidden">Review</span> <span className="review-card-name">{trade.underlying}</span> <span className="review-card-remains">{remainsText(trade, detail)}</span> <Badge tone="neutral">{trade.lifecycle}</Badge>
          </button>
        </h3>
      </div>
      {refusal && <Refusal {...refusal} />}
      {expanded && detail === 'Loading' && <p role="status">Loading the Trade…</p>}
      {expanded && detail === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
          <button type="button" className="pill secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {expanded && typeof detail === 'object' && <OwedBody facade={facade} card={detail.card} progress={trade.progress} reviewDate={reviewDate} go={go} onReflectionResolved={onReflectionResolved} onEntryDirty={onEntryDirty} onForm={onForm} />}
    </li>
  );
}

interface OwedBodyProps {
  readonly facade: UiFacade;
  readonly card: OwedReflectionsCard;
  readonly progress: OwedReflectionsTrade['progress'];
  readonly reviewDate: string;
  readonly go: Go;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
  readonly onForm: FormRegister;
}

function OwedBody({ facade, card, progress, reviewDate, go, onReflectionResolved, onEntryDirty, onForm }: OwedBodyProps) {
  const uid = useId();
  const [open, setOpen] = useState(true);
  const offerReflection = useCallback<FormRegister>((id, handle) => onForm(id, shownFirst(() => flushSync(() => setOpen(true)), handle)), [onForm, setOpen]);
  // A link to a card that is already open opens its Reflections panel again, if the trader has closed it, and takes focus (A161).
  const panelButton = useRef<HTMLButtonElement>(null);
  const [focusPanel, setFocusPanel] = useState<object>();
  const [handledGo, setHandledGo] = useState(go.count);
  if (go.count !== handledGo) {
    setHandledGo(go.count);
    if (go.panel === 'Reflections') {
      setOpen(true);
      setFocusPanel({});
    }
  }
  useEffect(() => {
    if (focusPanel) panelButton.current?.focus();
  }, [focusPanel]);
  const { dueNow: due, later } = panelOf(progress, 'Reflections');
  const owed = due + later;
  return (
    <section aria-label={`${card.underlying} review`}>
      <p>
        {card.labels.strategy} · {card.labels.account} · {card.labels.institution}
      </p>
      <Summary card={card} />
      <div className="review-panel">
        <h4>
          <button type="button" ref={panelButton} aria-expanded={open} aria-controls={`${uid}-Reflections`} onClick={() => setOpen(!open)}>
            <span className="review-panel-name">Reflections</span> <span className="review-panel-summary">{owed > 0 ? `${owed} owed, ${due} due now` : 'None owed'}</span> <Badge tone="neutral">{reflectionsStatus(due, owed)}</Badge>
          </button>
        </h4>
        <div id={`${uid}-Reflections`} hidden={!open}>
          <ReviewReflections facade={facade} reviewDate={reviewDate} reflections={card.reflections} onReview={onReflectionResolved} onNoneRemaining={NOTHING_NEXT} onEntryDirty={onEntryDirty} onForm={offerReflection} />
        </div>
      </div>
    </section>
  );
}
