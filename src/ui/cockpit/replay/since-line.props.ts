import type { TradeReplayView } from '../../../app/types.ts';
import { instrumentKey, type OptionInstrument } from '../../../domain/instrument/index.ts';
import { signed } from '../../figures.ts';
import { money, shortDate } from '../../format.ts';
import type { SinceLineProps } from './since-line.tsx';

// W48: the line under the charts, selected and formatted from the view's finished figures (T9.23): the Trade P&L's change, the option Mark's change and the
// split's parts. A part is rounded to the cent for the screen; nothing is worked out here (ADR 0001).
type ViewSession = TradeReplayView['sessions'][number];

const signedMoney = signed(money);
const TAG = 'estimate';

// A part of the split, a finished number of dollars a share, as "−$0.52".
function partMoney(value: number): string {
  const cents = Math.round(value * 100);
  const text = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  if (cents === 0) return text;
  return `${cents < 0 ? '−' : '+'}${text}`;
}

const optionOf = (view: TradeReplayView): OptionInstrument | undefined => view.instruments.find((instrument): instrument is OptionInstrument => instrument.kind === 'Option');
// "call" or "put".
const rightOf = (view: TradeReplayView): string => optionOf(view)?.right.toLowerCase() ?? 'option';

// The option Mark's change since the session before, as the view measured it.
function optionChange(view: TradeReplayView, session: ViewSession): { readonly words: string; readonly right: string } | undefined {
  const option = optionOf(view);
  if (!option) return undefined;
  const change = session.marks.find((mark) => instrumentKey(mark.instrument) === instrumentKey(option))?.change;
  return change ? { words: signedMoney(change.dollars), right: rightOf(view) } : undefined;
}

export function sinceOf(view: TradeReplayView): (date: string) => SinceLineProps | undefined {
  return (date) => {
    const session = view.sessions.find((s) => s.date === date);
    const split = session?.estimates?.split;
    if (!session?.change || !split) return undefined;
    const symbol = view.instruments[0]?.symbol ?? '';
    const lead = `Since ${shortDate(session.change.since)}: Trade P&L ${signedMoney(session.change.dollars)}.`;
    if (split.kind === 'NotApplicable') {
      // Stock: the Underlying's own Mark change is the whole move, exact and so untagged.
      const stock = view.instruments[0];
      const move = stock && session.marks.find((mark) => instrumentKey(mark.instrument) === instrumentKey(stock))?.change;
      return move ? { lead, move: `${symbol} moved ${signedMoney(move.dollars)} a share.` } : { lead };
    }
    if (split.kind === 'Unavailable') {
      const real = split.since !== undefined && split.change !== undefined ? ` Its Mark changed ${partMoney(split.change)} since ${shortDate(split.since)}.` : '';
      return { lead, move: `The ${rightOf(view)}'s move is not split: no implied volatility for ${shortDate(split.session)}.${real}` };
    }
    const change = optionChange(view, session);
    if (!change) return { lead };
    const underlying = { name: `${symbol}'s move`, text: partMoney(split.underlying), value: split.underlying };
    const parts = 'time' in split
      ? [underlying, { name: 'time', text: partMoney(split.time), value: split.time }, { name: 'volatility', text: partMoney(split.volatility), value: split.volatility }]
      : [underlying, { name: 'time and volatility together', text: partMoney(split.timeAndVolatility), value: split.timeAndVolatility }];
    return { lead, move: `The ${change.right} moved ${change.words} a share:`, parts, tag: TAG };
  };
}
