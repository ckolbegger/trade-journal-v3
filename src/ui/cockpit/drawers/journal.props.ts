// The Journal session cards' adapter (A216): a replay's slice and the Detail view in, finished display values out. Only this file and its test
// import the view's types.
import { createElement } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailNarrativeItem, TradeDetailView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import type { Instrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, localTime, money, shortDate } from '../../format.ts';
import { OwedDebtItem } from '../../screens/OwedDebtItem.tsx';
import { answerText } from '../../screens/trade-detail/words.ts';
import type { JournalCardItem, JournalCardProps, JournalDrawerProps, OwedControl } from './journal.types.ts';

// The slice of `TradeReplayView` the cards read. `ui-only-through-facade` bars importing the coordinator's type, so it is declared here and the
// real `TradeReplayView` must be assignable to it; T8P.22 swaps it for the facade's type.
export interface JournalReplaySession {
  readonly date: string;
  readonly tradePnl: CalculationResult<Rational>;
  readonly change: { readonly since: string; readonly dollars: Rational } | null;
  readonly marks: readonly {
    readonly instrument: Instrument;
    readonly resolution: { readonly kind: 'Available'; readonly mark: { readonly price: string } } | { readonly kind: 'Missing' | 'AcknowledgedUnavailable' };
  }[];
  readonly journal: readonly TradeDetailNarrativeItem[];
}

export interface JournalReplay {
  // Completed sessions, oldest first.
  readonly sessions: readonly JournalReplaySession[];
  readonly plan: readonly TradeDetailNarrativeItem[];
  readonly pending: { readonly date: string; readonly journal: readonly TradeDetailNarrativeItem[] } | null;
}

// Without a replay there are no cards; with one, the owed reflections need the facade for their forms.
// `today` is the Workspace-local date ("2026-11-12"); the clock's, when absent.
export type JournalCardsInput = { readonly view?: unknown; readonly timeZone?: string; readonly today?: string } & (
  | { readonly replay?: undefined }
  // 'Incoherent': the facts cannot be replayed, so the Detail's entries are one list (W13).
  | { readonly replay: JournalReplay | 'Incoherent'; readonly view: TradeDetailView; readonly facade: UiFacade; readonly onDirtyChange?: (dirty: boolean) => void }
);

const ZERO = Rational.of(0n);

// A tone for a gain or a loss, and none for zero.
function toneProp<K extends 'titleTone' | 'changeTone'>(key: K, value: Rational): { readonly [P in K]?: 'gain' | 'loss' } {
  const sign = value.compare(ZERO);
  if (sign === 0) return {};
  return { [key]: sign > 0 ? 'gain' : 'loss' } as { readonly [P in K]?: 'gain' | 'loss' };
}

// The change line: since the previous session with a figure, "First Mark" for the first figure, and none while the Trade P&L is unavailable.
function changeOf(tradePnl: CalculationResult<Rational>, change: JournalReplaySession['change']): Pick<JournalCardProps, 'change' | 'changeTone'> {
  if (change) return { change: `${signed(money)(change.dollars)} since ${shortDate(change.since)}`, ...toneProp('changeTone', change.dollars) };
  return tradePnl.kind === 'Value' ? { change: 'First Mark' } : {};
}

const DAY = 24 * 60 * 60 * 1000;

// "Thu Nov 12, 1:40 pm": the Plan's moment in the Workspace zone.
function plannedAt(instant: string, timeZone: string): string {
  const [date = '', time = '00:00'] = localTime(instant, timeZone).split(' ');
  const [hour = 0, minute = '00'] = time.split(':');
  return `${shortDate(date)}, ${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? 'am' : 'pm'}`;
}

// A session without a Mark:no Instrument has one that day.
const withoutMarks = (session: JournalReplaySession): boolean => session.marks.every((mark) => mark.resolution.kind !== 'Available');

function itemOf(item: TradeDetailNarrativeItem, symbol: string, timeZone: string, facade: UiFacade, onDirtyChange?: (dirty: boolean) => void): JournalCardItem {
  if (item.kind === 'Debt') {
    const owed = (control: OwedControl) => createElement(OwedDebtItem, { key: item.id, facade, debt: item, timeZone, ...control, ...(onDirtyChange && { onDirtyChange }) });
    return { id: item.id, type: item.entryType, badges: [], details: [], answers: [], owed };
  }
  const moment = localTime(item.momentTime, timeZone);
  const authored = localTime(item.authoredTime, timeZone);
  const settledLater = item.kind === 'Entry' ? item.answeredLater : item.declinedLater;
  const laterTimeLabel = settledLater && (item.kind === 'Entry' ? 'Answered' : 'Declined');
  const details = [
    ...(item.kind === 'Entry' && item.reviewDate !== undefined ? [{ term: 'Review Date', value: shortDate(item.reviewDate) }] : []),
    { term: 'Anchor', value: `Trade ${symbol}` },
    { term: 'Source', value: item.source },
    { term: 'Moment', value: moment },
    // A reflection resolved after it was deferred always shows when the trader resolved it.
    ...(authored !== moment || settledLater ? [{ term: laterTimeLabel ?? 'Authored', value: authored }] : []),
  ];
  return {
    id: item.id,
    type: item.entryType,
    badges: [...(item.kind === 'Entry' && item.edited ? ['Edited'] : []), ...(item.kind === 'Entry' && item.answeredLater ? ['Deferred, answered'] : [])],
    details,
    answers: item.kind === 'Entry' ? item.responses.map((response) => ({ prompt: response.prompt, answer: answerText(response.answer) })) : [],
    ...(item.kind === 'Decline' && { declined: { badge: item.declinedLater ? 'Declined later' : 'Reflection declined', reason: item.reason ?? 'No reason given' } }),
  };
}

// The Journal tab's count (W1): the reflections owed, as "1 owed"; absent when none is. It reads the Detail's own entries, so it needs no replay.
export function journalTabCount(view: unknown): string | undefined {
  // A Planned Detail's entries carry no kind; they are all saved Entries.
  const owed = (view as TradeDetailView).journal.filter((item) => 'kind' in item && item.kind === 'Debt').length;
  return owed > 0 ? `${owed} owed` : undefined;
}

export function journalCards(input: JournalCardsInput): JournalDrawerProps | undefined {
  const { timeZone = 'UTC' } = input;
  if (!input.replay) return undefined;
  const { replay } = input;
  const { view } = input;
  const { plan } = view;
  const symbol = plan.underlying;
  // A replayed Debt carries no due status, so an owed reflection takes it from the Detail's own Debt of the same id.
  const dueOf = new Map(view.journal.flatMap((item) => ('dueStatus' in item && item.dueStatus ? [[item.id, item.dueStatus] as const] : [])));
  const withDue = (item: TradeDetailNarrativeItem): TradeDetailNarrativeItem => {
    const dueStatus = item.kind === 'Debt' ? dueOf.get(item.id) : undefined;
    return item.kind === 'Debt' && dueStatus ? { ...item, dueStatus } : item;
  };
  const items = (journal: readonly TradeDetailNarrativeItem[]) => journal.map((item) => itemOf(withDue(item), symbol, timeZone, input.facade, input.onDirtyChange));
  if (replay === 'Incoherent') {
    // Only an incoherent Detail is listed this way, and its entries carry their kind.
    const entries = (view as Extract<TradeDetailView, { readonly recordedPositionChanges: unknown }>).journal;
    const newestFirst = [...entries].sort((a, b) => Date.parse(b.momentTime) - Date.parse(a.momentTime));
    const list: JournalCardProps = {
      id: 'list',
      kind: 'List',
      when: 'Every entry, newest first',
      title: 'Journal',
      note: 'Without a replay there are no sessions, so the entries are one list.',
      marks: [],
      items: items(newestFirst),
    };
    return { cards: [list] };
  }
  // An option's price has a "$"; an Underlying's keeps the Underlying format (convention C3), unless the Trade is a stock Trade, whose price is money.
  const optionTrade = replay.sessions.some((session) => session.marks.some((mark) => mark.instrument.kind === 'Option'));
  const priceOf = (instrument: Instrument, price: string): string => (instrument.kind === 'Stock' && optionTrade ? decimalUnderlyingPrice(price) : decimalMoney(price));
  const today = input.today ?? localTime(new Date().toISOString(), timeZone).slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
  // "Today, Thu Nov 12", "Yesterday, Wed Nov 11", or the date alone.
  const dayOf = (date: string): string => {
    if (date === today) return `Today, ${shortDate(date)}`;
    return date === yesterday ? `Yesterday, ${shortDate(date)}` : shortDate(date);
  };
  const last = replay.sessions.length - 1;
  // Back-to-back sessions without a Mark are one run, oldest first; every other session is a run of its own.
  const runs: JournalReplaySession[][] = [];
  replay.sessions.forEach((session, at) => {
    const previous = replay.sessions[at - 1];
    if (previous && withoutMarks(previous) && withoutMarks(session)) runs[runs.length - 1]!.push(session);
    else runs.push([session]);
  });
  const cards = runs.map((run): JournalCardProps => {
    const first = run[0]!;
    if (withoutMarks(first)) {
      const lastOfRun = run[run.length - 1]!;
      const dates = first === lastOfRun ? shortDate(first.date) : `${shortDate(first.date)} to ${shortDate(lastOfRun.date)}`;
      return { id: first.date, kind: 'Merged', when: `${dates} without Marks`, marks: [], items: items(run.flatMap((session) => session.journal)) };
    }
    const session = first;
    const { tradePnl, change } = session;
    const at = replay.sessions.indexOf(session);
    return {
      id: session.date,
      kind: 'Session',
      when: `${dayOf(session.date)}${at === last && replay.pending === null ? ', final session' : ''}`,
      title: calculation(tradePnl, money),
      ...(tradePnl.kind === 'Value' && toneProp('titleTone', tradePnl.value)),
      ...changeOf(tradePnl, change),
      marks: session.marks.map(({ instrument, resolution }) => ({
        label: instrument.kind === 'Option' ? `${instrument.right} Mark` : `${instrument.symbol} Mark`,
        value: resolution.kind === 'Available' ? priceOf(instrument, resolution.mark.price) : '—',
        ...(resolution.kind !== 'Available' && { gap: true as const }),
      })),
      items: items(session.journal),
    };
  });
  const pending: JournalCardProps[] = replay.pending
    ? [
        {
          id: 'pending',
          kind: 'Pending',
          when: dayOf(replay.pending.date),
          title: 'Session not ended yet',
          note: 'Its Marks are due once this session ends.',
          marks: [],
          items: items(replay.pending.journal),
        },
      ]
    : [];
  const planned: JournalCardProps[] =
    replay.plan.length > 0 ? [{ id: 'plan', kind: 'Plan', when: `Planned ${plannedAt(plan.planTime, timeZone)}`, title: 'Plan', marks: [], items: items(replay.plan) }] : [];
  return { heading: 'Sessions, newest first', cards: [...pending, ...cards.reverse(), ...planned] };
}
