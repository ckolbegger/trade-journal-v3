import { useEffect, useId, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { OwedReflectionsCard, OwedReflectionsTrade, OwedTradeSummary, PostSaveReview } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { calculation, closedViaSale, signed } from '../figures.ts';
import { money, rMultiple, tradeSummary } from '../format.ts';
import { panelOf, plural, reflectionsStatus, type Go } from './ReviewCard.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';

// What the open owed card shows while its Trade is read, or when it could not be.
export type OwedDetail = 'Loading' | 'Unavailable' | { readonly card: OwedReflectionsCard };

// The card has no further panel to move on to when its reflections are answered.
const NOTHING_NEXT = () => undefined;

// "2 reflections due", "1 not yet due", or Done once nothing is owed now: the words of the progress record (A164, A167).
function remainsText(trade: OwedReflectionsTrade): string {
  const { dueNow, later } = panelOf(trade.progress, 'Reflections');
  if (dueNow > 0) return `${plural(dueNow, 'reflection', 'reflections')} due`;
  return later > 0 ? `${later} not yet due` : 'Done';
}

// The Trade's summary for its lifecycle (A90): how a Closed Trade ended, or what an Open Trade holds.
function Summary({ card }: { readonly card: OwedReflectionsCard }) {
  const summary: OwedTradeSummary | undefined = card.summary;
  return (
    <section aria-label="Result">
      <dl>
        <dt>Lifecycle</dt>
        <dd>{card.lifecycle}</dd>
        {summary?.kind === 'Closed' && (
          <>
            <dt>Realized P&L</dt>
            <dd className="number">{signed(money)(summary.realizedPnl)}</dd>
            <dt>Realized R</dt>
            <dd className="number">{calculation(summary.realizedR, signed(rMultiple))}</dd>
            <dt>Terminal Disposition</dt>
            <dd>{calculation(summary.terminalDisposition, closedViaSale)}</dd>
            {summary.closeReason && (
              <>
                <dt>Close Reason</dt>
                <dd>{summary.closeReason.label || summary.closeReason.id}</dd>
              </>
            )}
          </>
        )}
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
  // The trader tried to leave while the card holds an entered value (A156).
  readonly holdMessage: boolean;
  readonly onToggle: () => void;
  // Reads the Trade again when it could not be read.
  readonly onRetry: () => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
}

// One Trade of the group after the walk (P20): a position card with a Reflections panel and no Action panel (D5R, section 9).
export function OwedCard({ facade, trade, reviewDate, expanded, detail, reveal, go, holdMessage, onToggle, onRetry, onReflectionResolved, onEntryDirty }: OwedCardProps) {
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
            <span className="visually-hidden">Review</span> <span className="review-card-name">{trade.underlying}</span> <span className="review-card-remains">{remainsText(trade)}</span> <Badge tone="neutral">{trade.lifecycle}</Badge>
          </button>
        </h3>
      </div>
      {expanded && holdMessage && <p role="status">Save or discard what you entered for {trade.underlying} to leave it.</p>}
      {expanded && detail === 'Loading' && <p role="status">Loading the Trade…</p>}
      {expanded && detail === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
          <button type="button" className="pill secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {expanded && typeof detail === 'object' && <OwedBody facade={facade} card={detail.card} progress={trade.progress} reviewDate={reviewDate} go={go} onReflectionResolved={onReflectionResolved} onEntryDirty={onEntryDirty} />}
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
}

function OwedBody({ facade, card, progress, reviewDate, go, onReflectionResolved, onEntryDirty }: OwedBodyProps) {
  const uid = useId();
  const [open, setOpen] = useState(true);
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
          <ReviewReflections facade={facade} reviewDate={reviewDate} reflections={card.reflections} onReview={onReflectionResolved} onNoneRemaining={NOTHING_NEXT} onEntryDirty={onEntryDirty} />
        </div>
      </div>
    </section>
  );
}
