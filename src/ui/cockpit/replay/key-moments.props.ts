import type { TradeReplayView } from '../../../app/types.ts';
import { shortDate } from '../../format.ts';
import type { KeyMomentsWords } from './replay.types.ts';

// W148: the view's key moments (P172, from Trade Analysis) as the drop-down's finished words: "1. Entry · Mon Nov 2", "2. Stop + Sale · Mon Nov 9".
export function keyMomentsOf(view: TradeReplayView): KeyMomentsWords | undefined {
  const found = view.keyMoments ?? [];
  if (found.length === 0) return undefined;
  return {
    label: 'Key moments',
    placeholder: 'Choose a moment',
    none: 'No key moment this session.',
    moments: found.map(({ date, kinds }, i) => ({ date, label: `${i + 1}. ${kinds.join(' + ')} · ${shortDate(date)}` })),
  };
}
