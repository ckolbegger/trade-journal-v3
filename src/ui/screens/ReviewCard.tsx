import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DailyTradeReview, PostSaveReview, SliderEvaluation, WalkedTrade } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { money, ratio, shortDate, tradeName, tradeSummary } from '../format.ts';
import { calculation, signed } from '../figures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { ActionForm, type SavedAction } from './ActionForm.tsx';
import { CardFigures } from './CardFigures.tsx';
import { CardMarks,type CardMarkRows, type CardMarksProps, type EntryDirty } from './CardMarks.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';
import { BAND_TEXT, reasonText } from './review-attention.ts';
import { StopTargetSlider } from './StopTargetSlider.tsx';

// What a card still owes, from the Review's completion: Marks and reflections by count, the Action by presence.
export interface Remaining {
  readonly marks: number;
  readonly reflections: number;
  readonly action: boolean;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// "2 Marks · 1 reflection due · Action", or Done once nothing remains (A150).
function remainsText({ marks, reflections, action }: Remaining): string {
  const parts = [...(marks > 0 ? [plural(marks, 'Mark', 'Marks')] : []), ...(reflections > 0 ? [plural(reflections, 'reflection', 'reflections') + ' due'] : []), ...(action ? ['Action'] : [])];
  return parts.length > 0 ? parts.join(' · ') : 'Done · Action saved';
}

// The slider's description speaks these figures in the app's own words (figures.ts), never as zero when missing.
function sliderFigures(figures: SliderEvaluation | undefined): { readonly riskToStop: string; readonly pnl: string; readonly rewardToRisk: string } {
  if (!figures) return { riskToStop: 'Not available', pnl: 'Not available', rewardToRisk: 'Not available' };
  return { riskToStop: calculation(figures.riskToStop, money), pnl: calculation(figures.pnl, signed(money)), rewardToRisk: calculation(figures.rewardRiskNow, ratio) };
}

export const PANELS = ['Marks', 'Reflections', 'Action'] as const;
export type PanelName = (typeof PANELS)[number];

// Where a link into the Review sends this card (A161): a panel to open, and an Instrument's row to focus. The count grows
// with each link, so a card that is already open answers the next one too.
export interface Go {
  readonly panel?: PanelName;
  readonly instrument?: string;
  readonly count: number;
}
export const NO_GO: Go = { count: 0 };

// What the open card shows while its Trade is read, or when it could not be.
export type CardDetail = 'Loading' | 'Unavailable' | { readonly trade: DailyTradeReview };

export interface ReviewCardProps {
  readonly facade: UiFacade;
  readonly trade: WalkedTrade;
  readonly remaining: Remaining;
  readonly expanded: boolean;
  readonly detail: CardDetail | undefined;
  // A count that grows each time the trader asks for this card: it scrolls into view and takes focus on its header.
  readonly reveal: number;
  // A count that grows each time Save Marks finishes on this card: it moves on to its next panel that is not done (A157).
  readonly advance: number;
  readonly go: Go;
  readonly marks: CardMarkRows;
  readonly tradeLine: (tradeId: string) => string;
  readonly onToggle: () => void;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly onMarkSaved: () => void;
  readonly onSaveMarks: CardMarksProps['onSaveMarks'];
  // The Marks were saved but the figures were not read under them: the card says so and offers Refresh.
  readonly outOfDate: boolean;
  // The trader tried to leave while the card holds an entered value (A156).
  readonly holdMessage: boolean;
  // The Review is being read again after a Mark save, so the Action cannot be saved yet.
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// One position of the Review: a collapsed header (Underlying, what remains, band, slider) over its content.
export function ReviewCard({ facade, trade, remaining, expanded, detail, reveal, advance, go, marks, tradeLine, onToggle, onSaved, onReflectionResolved, onRefresh, onMarkSaved, onSaveMarks, outOfDate, holdMessage, pending, onEntryDirty }: ReviewCardProps) {
  const item = useRef<HTMLLIElement>(null);
  const header = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reveal === 0) return;
    item.current?.scrollIntoView?.({ block: 'start' });
    header.current?.focus({ preventScroll: true });
  }, [reveal]);
  // The press scrolled while the body was still loading and the page short, so the browser clamped the position: once the body
  // is there, the card is brought to the top again, so its header and first input are in view.
  const bodyShown = expanded && typeof detail === 'object';
  const scrolledFor = useRef(0);
  useEffect(() => {
    if (reveal === 0 || !bodyShown || scrolledFor.current === reveal) return;
    scrolledFor.current = reveal;
    // A Mark-row landing has already focused its row in the body (child effects run first): that focus scroll stays.
    const focused = document.activeElement;
    if (focused && focused !== header.current && item.current?.contains(focused)) return;
    item.current?.scrollIntoView?.({ block: 'start' });
  }, [reveal, bodyShown]);
  return (
    <li className="review-card" ref={item} data-trade-id={trade.tradeId}>
      <div className="review-card-head">
        <h3>
          <button type="button" ref={header} aria-expanded={expanded} onClick={onToggle}>
            <span className="visually-hidden">Review</span> <span className="review-card-name">{trade.underlying}</span>{' '}
            {trade.summary && (
              <>
                <span className="review-card-summary">{tradeSummary(trade.summary)}</span>{' '}
              </>
            )}
            <span className="review-card-remains">{remainsText(remaining)}</span>{' '}
            <Badge tone="neutral">{BAND_TEXT[trade.band]}</Badge>
          </button>
        </h3>
        <StopTargetSlider position={trade.rangePosition} figures={sliderFigures(trade.figures)} />
      </div>
      {expanded && holdMessage && <p role="status">Save or discard what you entered for {tradeName(trade)} to leave it.</p>}
      {expanded && detail === 'Loading' && <p role="status">Loading the Trade…</p>}
      {expanded && detail === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
        </div>
      )}
      {expanded && typeof detail === 'object' && (
        <CardBody
          key={`${detail.trade.tradeId}:${detail.trade.saveBinding.reviewDate}`}
          facade={facade}
          trade={detail.trade}
          name={tradeName(trade)}
          advance={advance}
          go={go}
          remaining={remaining}
          marks={marks}
          tradeLine={tradeLine}
          onSaved={onSaved}
          onReflectionResolved={onReflectionResolved}
          onRefresh={onRefresh}
          onMarkSaved={onMarkSaved}
          onSaveMarks={onSaveMarks}
          outOfDate={outOfDate}
          pending={pending}
          onEntryDirty={onEntryDirty}
        />
      )}
    </li>
  );
}

interface CardBodyProps {
  readonly facade: UiFacade;
  readonly trade: DailyTradeReview;
  // The Trade's name (A150): it labels the region, so a screen reader hears which Trade it is.
  readonly name: string;
  readonly advance: number;
  readonly go: Go;
  readonly remaining: Remaining;
  readonly marks: CardMarkRows;
  readonly tradeLine: (tradeId: string) => string;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly onMarkSaved: () => void;
  readonly onSaveMarks: CardMarksProps['onSaveMarks'];
  readonly outOfDate: boolean;
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// What a panel's header says: a one-line summary and a status.
interface PanelHeader {
  readonly summary: string;
  readonly status: string;
  readonly done: boolean;
}

function marksStatus(needed: number, rows: number, earlier: number): string {
  if (needed > 0) return `${needed} needed`;
  if (rows > 0) return 'Saved';
  if (earlier > 0) return 'Optional';
  return 'None';
}

function reflectionsStatus(due: number, anyResolved: boolean, owed: number): string {
  if (due > 0) return `${due} due`;
  if (anyResolved) return 'Resolved';
  if (owed > 0) return 'Not due';
  return 'None';
}

function panelHeaders(trade: DailyTradeReview, marks: CardMarkRows, remaining: Remaining): Record<PanelName, PanelHeader> {
  const rows = marks.today.length;
  const earlier = marks.earlier.reduce((sum, group) => sum + group.missing.length + group.acknowledged.length, 0);
  const date = shortDate(trade.saveBinding.reviewDate);
  const owed = trade.reflections.length;
  const due = remaining.reflections;
  const form = trade.form;
  return {
    Marks: {
      summary: [rows > 0 ? `${remaining.marks} of ${rows} for ${date}` : `No Marks for ${date}`, ...(earlier > 0 ? [`${earlier} earlier optional`] : [])].join(' · '),
      status: marksStatus(remaining.marks, rows, earlier),
      done: remaining.marks === 0,
    },
    Reflections: {
      summary: owed > 0 ? `${owed} owed, ${due} due now` : 'None owed',
      status: reflectionsStatus(due, trade.reflections.some((r) => r.classification === 'Due'), owed),
      done: due === 0,
    },
    Action: {
      summary: form.kind === 'Saved' ? form.action.action : 'Hold, Exit, Roll or Adjust',
      status: form.kind === 'Saved' ? 'Saved' : 'Needed',
      done: form.kind === 'Saved',
    },
  };
}

// The open card: its figures, then the three panels in the spec's work order (P36, A152), one open at a time.
function CardBody({ facade, trade, name, advance, go, remaining, marks, tradeLine, onSaved, onReflectionResolved, onRefresh, onMarkSaved, onSaveMarks, outOfDate, pending, onEntryDirty }: CardBodyProps) {
  const uid = useId();
  const headers = panelHeaders(trade, marks, remaining);
  // The next panel that is not done after this one, wrapping to the ones before it; none when every other panel is done.
  const nextAfter = (from: PanelName): PanelName | undefined => {
    const start = PANELS.indexOf(from);
    return [...PANELS.slice(start + 1), ...PANELS.slice(0, start)].find((name) => !headers[name].done);
  };
  // The card opens on the panel a link names, or else on its first panel that is not done.
  const [open, setOpen] = useState<PanelName>(() => go.panel ?? PANELS.find((name) => !headers[name].done) ?? 'Action');
  const panelButtons = useRef<Partial<Record<PanelName, HTMLButtonElement | null>>>({});
  const [focusPanel, setFocusPanel] = useState<{ readonly panel: PanelName }>();
  useEffect(() => {
    if (focusPanel) panelButtons.current[focusPanel.panel]?.focus();
  }, [focusPanel]);
  // A link to a card that is already open moves it to the panel named (A161).
  const [handledGo, setHandledGo] = useState(go.count);
  if (go.count !== handledGo) {
    setHandledGo(go.count);
    if (go.panel) {
      setOpen(go.panel);
      if (!go.instrument) setFocusPanel({ panel: go.panel });
    }
  }
  // Focus goes to the row of the Instrument a link names.
  const body = useRef<HTMLElement>(null);
  const { count: linked, instrument } = go;
  useEffect(() => {
    if (linked === 0 || instrument === undefined) return;
    const row = [...(body.current?.querySelectorAll<HTMLElement>('section[aria-label]') ?? [])].find((section) => section.getAttribute('aria-label')?.startsWith(`${instrument} Mark, `));
    const control = row?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    if (row && !control) row.tabIndex = -1;
    (control ?? row)?.focus();
  }, [linked, instrument]);
  // A panel's work is finished: the next panel that is not done after that one opens and takes focus. A trader who has
  // since opened another panel that still has work stays on it.
  const moveOn = (from: PanelName) => {
    const next = nextAfter(from);
    if (next && (open === from || headers[open].done)) {
      setOpen(next);
      setFocusPanel({ panel: next });
    }
  };
  const [finished, setFinished] = useState(0);
  const finishPanel = useCallback(() => setFinished((count) => count + 1), []);
  const [handledMarks, setHandledMarks] = useState(advance);
  const [handledReflections, setHandledReflections] = useState(finished);
  if (advance !== handledMarks) {
    setHandledMarks(advance);
    moveOn('Marks');
  }
  if (finished !== handledReflections) {
    setHandledReflections(finished);
    moveOn('Reflections');
  }
  // The Action form reports under its Trade, so the Review's unsaved state counts it with the Mark entries.
  const tradeId = trade.tradeId;
  const report = useCallback((dirty: boolean) => onEntryDirty(`action:${tradeId}`, dirty), [tradeId, onEntryDirty]);
  return (
    <section aria-label={`${name} review`} ref={body}>
      <p>
        {trade.labels.strategy} · {trade.labels.account} · {trade.labels.institution}
      </p>
      {trade.attention.reasons.map((reason, i) => (
        <p key={i}>{reasonText(reason, trade.attention.basis)}</p>
      ))}
      <CardFigures trade={trade} />
      {/* Every panel stays mounted, so a panel left open keeps its drafts; only the open one is shown. */}
      {PANELS.map((name) => (
        <div key={name} className="review-panel">
          <h4>
            <button type="button" ref={(button) => void (panelButtons.current[name] = button)} aria-expanded={open === name} aria-controls={`${uid}-${name}`} onClick={() => setOpen(name)}>
              <span className="review-panel-name">{name}</span> <span className="review-panel-summary">{headers[name].summary}</span> <Badge tone="neutral">{headers[name].status}</Badge>
            </button>
          </h4>
          <div id={`${uid}-${name}`} hidden={open !== name}>
            {name === 'Marks' && <CardMarks facade={facade} tradeId={trade.tradeId} marks={marks} tradeLine={tradeLine}onEntryDirty={onEntryDirty} onMarkSaved={onMarkSaved} onSaveMarks={onSaveMarks} outOfDate={outOfDate} onRefresh={onRefresh} />}
            {name === 'Reflections' && <ReviewReflections facade={facade} reviewDate={trade.saveBinding.reviewDate} reflections={trade.reflections} onReview={onReflectionResolved} onNoneRemaining={finishPanel} onEntryDirty={onEntryDirty} />}
            {name === 'Action' && <ActionForm facade={facade} form={trade.form} binding={trade.saveBinding} onSaved={onSaved} onRefresh={onRefresh} onDirtyChange={report} pending={pending} />}
          </div>
        </div>
      ))}
    </section>
  );
}
