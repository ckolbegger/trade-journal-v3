import type { TradeReplayView } from '../../../app/types.ts';
import { shortDate } from '../../format.ts';
import type { KeyMomentsWords } from './replay.types.ts';

// W148: the view's key moments (P172, from Trade Analysis) as the drop-down's finished words: "1. Entry · Mon Nov 2", "2. Stop + Sale · Mon Nov 9".
// In a Close Review walk the dates already seen are given too, and the count of them is put beside the drop-down.
export function keyMomentsOf(view: TradeReplayView, seen?: ReadonlySet<string>): KeyMomentsWords | undefined {
  const found = view.keyMoments ?? [];
  if (found.length === 0) return undefined;
  const unseen = found.find(({ date }) => !seen?.has(date));
  const seenCount = found.filter(({ date }) => seen?.has(date)).length;
  return {
    ...(seen && { walk: { progress: unseen ? `${seenCount} of ${found.length} seen` : `All ${found.length} seen. Now write.`, nextLabel: 'Next moment', ...(unseen && { next: unseen.date }) } }),
    label: 'Key moments',
    placeholder: 'Choose a moment',
    none: 'No key moment this session.',
    moments: found.map(({ date, kinds }, i) => ({ date, label: `${i + 1}. ${kinds.join(' + ')} · ${shortDate(date)}` })),
  };
}
