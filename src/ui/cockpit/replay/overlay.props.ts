import type { TradeReplayView } from '../../../app/types.ts';
import { signed } from '../../figures.ts';
import { money } from '../../format.ts';
import type { ReplayOverlayProps } from './replay.types.ts';

// W53: the overlay's name and header, from finished values. The header's P&L is the latest session's (decision 3): "BREN · Trade P&L +$988.00",
// "BREN · Final result +$1,138.00" on a finished Trade, and the symbol alone while the replay is unread or the latest session has no Mark.
// The adapter formats what the view holds; it works out no figure (ADR 0001).
export function overlayWordsOf(symbol: string, replay?: TradeReplayView): Pick<ReplayOverlayProps, 'name' | 'header'> {
  const name = `Replay, ${symbol}`;
  const latest = replay?.sessions[replay.sessions.length - 1];
  if (latest?.tradePnl.kind !== 'Value') return { name, header: symbol };
  return { name, header: `${symbol} · ${latest.final ? 'Final result' : 'Trade P&L'} ${signed(money)(latest.tradePnl.value)}` };
}
