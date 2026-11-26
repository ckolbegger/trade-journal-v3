import { useId } from 'react';
import type { KeyMomentsWords } from './replay.types.ts';

// W148: the drop-down of the Replay's key moments. Its value is the slider's session when that is a moment, and the placeholder otherwise, so
// the slider and the drop-down never disagree; choosing a moment moves the slider to it.
export function KeyMoments({ words, current, onChoose }: { readonly words: KeyMomentsWords; readonly current: string; readonly onChoose: (date: string) => void }) {
  const id = useId();
  const onMoment = words.moments.some((m) => m.date === current);
  return (
    <div className="replay-moments">
      <label htmlFor={id}>{words.label}</label>
      <select id={id} value={onMoment ? current : ''} onChange={(event) => event.target.value && onChoose(event.target.value)}>
        <option value="">{words.placeholder}</option>
        {words.moments.map((m) => (
          <option key={m.date} value={m.date}>
            {m.label}
          </option>
        ))}
      </select>
      {words.walk?.next && (
        <button type="button" onClick={() => onChoose(words.walk!.next!)}>
          {words.walk.nextLabel}
        </button>
      )}
      {words.walk && <p className="replay-moments-seen">{words.walk.progress}</p>}
      {!onMoment && <p>{words.none}</p>}
    </div>
  );
}
