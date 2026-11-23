import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { OpenDailyReviewResult, ReviewCompletion } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { instrumentLabel, text, unavailableWords } from '../calculation-words.ts';
import { signed } from '../figures.ts';
import { money, plural, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import type { PanelName } from './ReviewCard.tsx';
import { BAND_TEXT } from './review-attention.ts';

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
const COMPLETION_TEXT = { Incomplete: 'Incomplete', Complete: 'Complete', CompleteWithUnavailableMarks: 'Complete with Unavailable Marks' } as const;

type CalculationFamily = Extract<ReviewCompletion, { kind: 'CompleteWithUnavailableMarks' }>['families'][number];
const FAMILY_TEXT: Record<CalculationFamily, string> = { Valuation: 'Valuation', Risk: 'Risk', Reward: 'Reward', ConditionStatus: 'Condition status' };

type DaySummary = NonNullable<Ready['day']>;

// Opens a card, on a panel and an Instrument's row when they are named (A161).
export type OpenCard = (tradeId: string, panel?: PanelName, instrument?: string) => void;

export interface DayCardProps {
  readonly review: Ready;
  readonly name: (tradeId: string) => string;
  readonly openCard: OpenCard;
  // The unsaved-Marks notice with its Save Marks and Discard, which the page owns until T95.14.
  readonly unsaved?: ReactNode;
}

// A link that opens the card; it stays a real link, so it can be opened in a new tab.
function CardLink({ tradeId, open, panel, instrument, children }: { readonly tradeId: string; readonly open: OpenCard; readonly panel?: PanelName; readonly instrument?: string; readonly children: ReactNode }) {
  let href = `/review?trade=${tradeId}`;
  if (instrument !== undefined) href += `&instrument=${encodeURIComponent(instrument)}`;
  else if (panel !== undefined) href += `&panel=${panel}`;
  return (
    <a
      href={href}
      onClick={(event) => {
        // A new-tab or new-window click is the browser's: the href names the same card, panel and row.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        open(tradeId, panel, instrument);
      }}
    >
      {children}
    </a>
  );
}

const joinAnd = (parts: readonly string[]): string => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

// The counts still to go, in the order a card works through them (W96).
function toGoText({ trades, toGo }: DaySummary): string {
  const parts = [
    ...(toGo.marks > 0 ? [plural(toGo.marks, 'Mark', 'Marks')] : []),
    ...(toGo.expirations > 0 ? [`${plural(toGo.expirations, 'expiration', 'expirations')} to settle`] : []),
    ...(toGo.actions > 0 ? [plural(toGo.actions, 'Action', 'Actions')] : []),
    ...(toGo.closeReviews > 0 ? [plural(toGo.closeReviews, 'Close Review', 'Close Reviews')] : []),
    ...(toGo.reflections > 0 ? [plural(toGo.reflections, 'reflection', 'reflections')] : []),
  ];
  return parts.length > 0 ? `${plural(trades, 'Trade', 'Trades')} · ${joinAnd(parts)} to go` : plural(trades, 'Trade', 'Trades');
}

type StepState = 'todo' | 'now' | 'done';

// The three steps of the day (W97): Marks, then the Trades, then the day itself. The day is done once the Review is no longer Incomplete.
function stepStates({ toGo }: DaySummary, finished: boolean): readonly StepState[] {
  const marksDone = toGo.marks === 0;
  let trades: StepState = 'todo';
  if (marksDone) trades = finished ? 'done' : 'now';
  return [marksDone ? 'done' : 'now', trades, finished ? 'done' : 'todo'];
}

const NEED_TEXT = { Marks: (marks: number) => (marks > 1 ? `${marks} Marks` : 'Mark'), Reflection: (_: number, closeReview: boolean) => (closeReview ? 'Close Review' : 'Reflection'), Settlement: () => 'Settle', Action: () => 'Action' } as const;

// What a Trade still needs, in the order its card works through it (W101).
const todoText = (line: DaySummary['lines'][number]): string => (line.needs.length > 0 ? `To do: ${line.needs.map((need) => NEED_TEXT[need](line.marks, line.closeReview)).join(', ')}` : 'Done');

const STEPS = ['1 Marks', '2 Trades', '3 The day'] as const;

const PANEL_OF = { Marks: 'Marks', Reflection: 'Reflections', Settlement: 'Settlement', Action: 'Action' } as const satisfies Record<DaySummary['lines'][number]['needs'][number], PanelName>;

// The Trade the day card sends the trader to next: the first line, in the card's order, that still needs something (W98).
const nextLine = (day: DaySummary) => day.lines.find((line) => line.needs.length > 0);

export function DayCard({ review, name, openCard, unsaved }: DayCardProps) {
  const { day, completion } = review;
  const { timeZone } = useRuntime();
  // Trades whose recorded facts disagree or cannot be read together: no line of the day can say more, so the card names them.
  const facts = completion.kind === 'Incomplete' ? completion.reasons.filter((reason) => reason.code === 'IntegrityDisagreement' || reason.code === 'IncoherentFacts') : [];
  const underlyingOf = (tradeId: string): string => [...review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])), ...review.owed].find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  const marksFamily = review.families.find((f) => f.family === 'Marks');
  // A line opens its card on the panel of the first thing it needs, and on its first Mark still missing (A161).
  const targetOf = (line: DaySummary['lines'][number]) => {
    const need = line.needs[0];
    const instrument = need === 'Marks' && marksFamily?.family === 'Marks' ? marksFamily.today.find((row) => row.resolution.kind === 'Missing' && row.trades.includes(line.tradeId))?.instrumentKey : undefined;
    return { panel: need && PANEL_OF[need], instrument };
  };
  const open = (line: DaySummary['lines'][number]) => {
    const { panel, instrument } = targetOf(line);
    openCard(line.tradeId, panel, instrument);
  };
  // "Add them" opens the Marks of the first Instrument with a gap, on the first Trade of the walk that holds it.
  const walkedIds = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.tradeId) : []));
  const gap = marksFamily?.family === 'Marks' ? marksFamily.earlier[0] : undefined;
  const gapTrade = gap && walkedIds.find((id) => gap.trades.some((t) => t.tradeId === id));
  const labelOf = (tradeId: string): string | undefined => {
    const walkedTrade = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).find((t) => t.tradeId === tradeId);
    if (walkedTrade) return BAND_TEXT[walkedTrade.band];
    return review.owed.find((t) => t.tradeId === tradeId)?.lifecycle === 'Closed' ? 'Closed' : undefined;
  };
  const next = day && (day.toGo.marks > 0 ? day.lines.find((line) => line.marks > 0) : nextLine(day));
  const nextText = day && day.toGo.marks > 0 ? 'Enter the Marks' : next && `Next: ${underlyingOf(next.tradeId)}${next.needs[0] === 'Reflection' && next.closeReview ? "'s Close Review" : ''}`;
  return (
    <section className="card day-card" aria-label="The day">
      <div className="day-top">
        <div>
          <p>
            Review Date <time dateTime={review.reviewDate}>{shortDate(review.reviewDate)}</time>
          </p>
          {day && <p>{toGoText(day)}</p>}
        </div>
        {day && (
          <ol aria-label="Steps" className="day-steps">
            {stepStates(day, review.completion.kind !== 'Incomplete').map((state, i) => (
              <li key={STEPS[i]} data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
                {STEPS[i]}
                {state === 'done' && <span className="visually-hidden"> done</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
      <p>
        <strong>{COMPLETION_TEXT[completion.kind]}</strong>
      </p>
      {unsaved}
      {(nextText || day?.change.kind === 'Value') && (
        <div className="day-next">
          {nextText && (
            <button type="button" className="pill primary" onClick={() => next && open(next)}>
              {nextText}
            </button>
          )}
          {day?.change.kind === 'Value' && <span>Day so far: {signed(money)(day.change.dollars)}</span>}
        </div>
      )}
      {day && day.missed.length > 0 && (
        <p>
          <b>No Review for {day.missed.map(shortDate).join(', ')}.</b> Their Marks are optional.{' '}
          {gap && gapTrade && (
            <button type="button" className="pill secondary" onClick={() => openCard(gapTrade, 'Marks', gap.instrumentKey)}>
              Add them
            </button>
          )}
        </p>
      )}
      {day && (
        <ul aria-label="Trade lines" className="day-lines">
          {day.lines.map((line) => {
            const { panel, instrument } = targetOf(line);
            const label = labelOf(line.tradeId);
            return (
              <li key={line.tradeId}>
                <CardLink tradeId={line.tradeId} open={openCard} panel={panel} instrument={instrument}>
                  {underlyingOf(line.tradeId)}
                </CardLink>{' '}
                {label && (
                  <>
                    <Badge tone="neutral">{label}</Badge>{' '}
                  </>
                )}
                <span>{todoText(line)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {completion.kind === 'CompleteWithUnavailableMarks' && (
        <div role="group" aria-label="Unavailable Marks">
          <p>Instruments: {completion.instruments.map((instrument) => instrumentLabel(instrument, timeZone)).join(', ')}</p>
          <p>Trades: {completion.trades.map(name).join(', ')}</p>
          <p>Not calculated: {completion.families.map((family) => FAMILY_TEXT[family]).join(', ')}</p>
        </div>
      )}
      {facts.length > 0 && (
        <ul aria-label="Facts to check">
          {facts.map((reason, i) => (
            <li key={i}>
              {reason.code === 'IntegrityDisagreement' && `${name(reason.tradeId)}: recorded facts disagree`}
              {reason.code === 'IncoherentFacts' && (
                <>
                  <Link to={`/trades/${reason.tradeId}`}>{name(reason.tradeId)}</Link>: {text(unavailableWords({ reason: 'FactsIncoherent', findings: reason.findings }, 'sentence', timeZone ?? 'UTC'), timeZone ?? 'UTC')}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
