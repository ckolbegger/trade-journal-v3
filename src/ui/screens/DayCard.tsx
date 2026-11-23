import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { OpenDailyReviewResult, ReviewCompletion } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { instrumentLabel, text, unavailableWords } from '../calculation-words.ts';
import { signed } from '../figures.ts';
import { money, plural, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import type { PanelName } from './ReviewCard.tsx';
import { describedLabelsOf } from './review-attention.ts';

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
const COMPLETION_TEXT = { Incomplete: 'Incomplete', Complete: 'Complete', CompleteWithUnavailableMarks: 'Complete with Unavailable Marks' } as const;

type CalculationFamily = Extract<ReviewCompletion, { kind: 'CompleteWithUnavailableMarks' }>['families'][number];
const FAMILY_TEXT: Record<CalculationFamily, string> = { Valuation: 'Valuation', Risk: 'Risk', Reward: 'Reward', ConditionStatus: 'Condition status' };

type DaySummary = NonNullable<Ready['day']>;

// Opens a card, on a panel when one is named (A161).
export type OpenCard = (tradeId: string, panel?: PanelName) => void;

export interface DayCardProps {
  readonly review: Ready;
  readonly name: (tradeId: string) => string;
  readonly openCard: OpenCard;
  // The Marks step's cell for an Instrument, chosen and focused; with none named, the first Mark still to enter (A161).
  readonly openMarks: (instrument?: string) => void;
  // The Marks step with the skipped sessions' columns added.
  readonly openSkipped: () => void;
}

// A link that opens the card; it stays a real link, so it can be opened in a new tab.
function CardLink({ tradeId, open, panel, instrument, describedBy, children }: { readonly tradeId: string; readonly open: () => void; readonly panel?: PanelName; readonly instrument?: string; readonly describedBy?: string; readonly children: ReactNode }) {
  let href = `/review?trade=${tradeId}`;
  if (instrument !== undefined) href += `&instrument=${encodeURIComponent(instrument)}`;
  else if (panel !== undefined) href += `&panel=${panel}`;
  return (
    <a
      href={href}
      aria-describedby={describedBy}
      onClick={(event) => {
        // A new-tab or new-window click is the browser's: the href names the same card, panel and row.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        open();
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

// The Actions in the order the "You chose" row lists them: an Exit first, since it is still to record.
const ACTION_ORDER = ['Exit', 'Roll', 'Adjust', 'Hold'] as const;

// The two lines a Trade can be past, with the words each row uses.
const LINES = [
  { key: 'stop', label: 'Past Stop', held: "past the Stop. Tomorrow's Review asks again." },
  { key: 'target', label: 'At Target', held: 'past the Target, with no new line.' },
] as const;

// One sentence for each line that a Trade was held past: the Trades past it whose saved Action for the day is Hold.
function heldPast({ pastLine, chosen }: NonNullable<DaySummary['finished']>, underlyingOf: (tradeId: string) => string): readonly string[] {
  return LINES.flatMap(({ key, held }) => {
    const names = pastLine[key].filter(({ tradeId }) => chosen.some((c) => c.tradeId === tradeId && c.action === 'Hold')).map(({ tradeId }) => underlyingOf(tradeId));
    return names.length > 0 ? [`You held ${names.join(', ')} ${held}`] : [];
  });
}

const STEPS = ['1 Marks', '2 Trades', '3 The day'] as const;

// A Mark is entered in the Marks step, not in the card.
const PANEL_OF = { Reflection: 'Reflections', Settlement: 'Settlement', Action: 'Action' } as const satisfies Partial<Record<DaySummary['lines'][number]['needs'][number], PanelName>>;

// The Trade the day card sends the trader to next: the first line, in the card's order, that still needs something (W98).
const nextLine = (day: DaySummary) => day.lines.find((line) => line.needs.length > 0);

export function DayCard({ review, name, openCard, openMarks, openSkipped }: DayCardProps) {
  const { day, completion } = review;
  const { timeZone } = useRuntime();
  const reasonId = useId();
  // Trades whose recorded facts disagree or cannot be read together: no line of the day can say more, so the card names them.
  const facts = completion.kind === 'Incomplete' ? completion.reasons.filter((reason) => reason.code === 'IntegrityDisagreement' || reason.code === 'IncoherentFacts') : [];
  const underlyingOf = (tradeId: string): string => [...review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])), ...review.owed].find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  const marksFamily = review.families.find((f) => f.family === 'Marks');
  // A line whose first need is a Mark goes to its first Mark still missing in the Marks step; any other opens its card on that need's panel (A161).
  const targetOf = (line: DaySummary['lines'][number]) => {
    const need = line.needs[0];
    if (need === 'Marks') return { panel: undefined, instrument: marksFamily?.family === 'Marks' ? marksFamily.today.find((row) => row.resolution.kind === 'Missing' && row.trades.includes(line.tradeId))?.instrumentKey : undefined };
    return { panel: need && PANEL_OF[need], instrument: undefined };
  };
  const open = (line: DaySummary['lines'][number]) => {
    const { panel, instrument } = targetOf(line);
    if (line.needs[0] === 'Marks') openMarks(instrument);
    else openCard(line.tradeId, panel);
  };
  // "Add them" opens the Marks step's skipped-session columns, when the Review lists a gap.
  const gap = marksFamily?.family === 'Marks' ? marksFamily.earlier[0] : undefined;
  const labelsFor = (tradeId: string): { label: string; reason: string | undefined }[] => {
    const walkedTrade = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).find((t) => t.tradeId === tradeId);
    if (walkedTrade) return describedLabelsOf(walkedTrade, timeZone ?? 'UTC');
    return review.owed.find((t) => t.tradeId === tradeId)?.lifecycle === 'Closed' ? [{ label: 'Closed', reason: undefined }] : [];
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
      {(nextText || (day?.change.kind === 'Value' && !day.finished)) && (
        <div className="day-next">
          {nextText && (
            <button type="button" className="pill primary" onClick={() => next && open(next)}>
              {nextText}
            </button>
          )}
          {day?.change.kind === 'Value' && !day.finished && <span>Day so far: {signed(money)(day.change.dollars)}</span>}
        </div>
      )}
      {day && !day.finished && day.missed.length > 0 && (
        <p>
          <b>No Review for {day.missed.map(shortDate).join(', ')}.</b> Their Marks are optional.{' '}
          {gap && (
            <button type="button" className="pill secondary" onClick={openSkipped}>
              Add them
            </button>
          )}
        </p>
      )}
      {day?.finished && (
        <dl className="day-rows">
          {day.change.kind === 'Value' && (
            <div>
              <dt>The day</dt>
              <dd>{signed(money)(day.change.dollars)}</dd>
            </div>
          )}
          {(day.finished.pastLine.stop.length > 0 || day.finished.pastLine.target.length > 0) && (
            <div>
              <dt>Past a line</dt>
              <dd>
                {LINES.filter(({ key }) => day.finished!.pastLine[key].length > 0)
                  .map(({ key, label }) => `${label}: ${day.finished!.pastLine[key].map(({ tradeId, sessions }) => underlyingOf(tradeId) + (sessions > 1 ? ` (${sessions} sessions)` : '')).join(', ')}`)
                  .join(' · ')}
              </dd>
            </div>
          )}
          {day.finished.chosen.length > 0 && (
            <div>
              <dt>You chose</dt>
              <dd>
                {ACTION_ORDER.filter((action) => day.finished!.chosen.some((c) => c.action === action))
                  .map((action) => `${action} ${day.finished!.chosen.filter((c) => c.action === action).map((c) => underlyingOf(c.tradeId)).join(', ')}`)
                  .join(' · ')}
              </dd>
            </div>
          )}
          {(day.finished.due.sales.length > 0 || heldPast(day.finished, underlyingOf).length > 0 || day.finished.due.expirations.length > 0) && (
            <div>
              <dt>Tomorrow</dt>
              <dd>
                {day.finished.due.sales.length > 0 && (
                  <p>
                    Sell {day.finished.due.sales.map(underlyingOf).join(', ')}, then{' '}
                    <CardLink tradeId={day.finished.due.sales[0]!} open={() => openCard(day.finished!.due.sales[0]!)}>
                      record the sale
                    </CardLink>
                    .
                  </p>
                )}
                {heldPast(day.finished, underlyingOf).map((sentence) => (
                  <p key={sentence}>
                    {sentence}
                  </p>
                ))}
                {day.finished.due.expirations.map(({ expiration, sessionsLeft, contracts }) => (
                  <p key={expiration}>
                    {contracts.map((c) => underlyingOf(c.tradeId)).join(', ')} expire {shortDate(expiration)}
                    {sessionsLeft !== undefined && `: ${plural(sessionsLeft, 'session', 'sessions')} left`}.
                  </p>
                ))}
              </dd>
            </div>
          )}
          {day.missed.length > 0 && (
            <div>
              <dt>Missed</dt>
              <dd>
                {day.missed.map(shortDate).join(', ')}
                {gap && (
                  <>
                    {' '}
                    <button type="button" className="pill secondary" onClick={openSkipped}>
                      Add them
                    </button>
                  </>
                )}
              </dd>
            </div>
          )}
          {day.nextReviewDate && (
            <div>
              <dt>Next Review</dt>
              <dd>{shortDate(day.nextReviewDate)}, after the close.</dd>
            </div>
          )}
        </dl>
      )}
      {day && (
        <>
          <ul aria-label="Trade lines" className="day-lines">
          {day.lines.map((line) => {
            const { panel, instrument } = targetOf(line);
            const labels = labelsFor(line.tradeId);
            const reasonIds = labels.flatMap(({ reason }, i) => (reason ? [`${reasonId}-${line.tradeId}-${i}`] : []));
            return (
              <li key={line.tradeId}>
                <CardLink tradeId={line.tradeId} open={() => open(line)} panel={panel} instrument={instrument} describedBy={reasonIds.join(' ') || undefined}>
                  {underlyingOf(line.tradeId)}
                </CardLink>{' '}
                {labels.map(({ label }) => (
                  <span key={label}>
                    <Badge tone="neutral">{label}</Badge>{' '}
                  </span>
                ))}
                <span>{todoText(line)}</span>
              </li>
            );
          })}
        </ul>
          {/* Each label's reason, the description of its line's link; kept outside the list so a line's text stays as shown. */}
          {day.lines.flatMap((line) => labelsFor(line.tradeId).map(({ reason }, i) => reason && <span key={`${line.tradeId}-${i}`} id={`${reasonId}-${line.tradeId}-${i}`} className="visually-hidden">{reason}</span>))}
        </>
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
