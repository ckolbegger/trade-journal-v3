import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ReplayDrawer } from '../drawers/replay.tsx';
import { useRuntime } from '../../runtime.tsx';
import { Refusal } from '../../screens/Refusal.tsx';
import type { DebtFormProps, DebtResolved } from '../../screens/DebtForm.tsx';
import type { ReplayView } from './replay.props.ts';
import { ReflectionPrompts, type Answers } from '../../screens/ReflectionPrompts.tsx';
import { overlayWordsOf } from './overlay.props.ts';
import { ReplayOverlay } from './overlay.tsx';

export interface CloseReviewWalkProps {
  readonly replay: ReplayView;
  readonly underlying: string;
  // The Debt's snapshot definition and binding, as the Debt form takes them.
  readonly definition: DebtFormProps['definition'];
  readonly binding: DebtFormProps['binding'];
  readonly submit: DebtFormProps['submit'];
  readonly onResolved: (resolved: DebtResolved) => void;
  readonly onClose: () => void;
  // Reports whether an answer was entered (update deferral, as the Debt form does).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

const KEY_LESSON = 'prompt.close-review.key-lesson';

// W152: what a missing required answer says, by the kind of question.
function missingText(prompt: DebtFormProps['definition']['prompts'][number]): string {
  if (prompt.kind !== 'Text') return 'Choose one.';
  return prompt.id === KEY_LESSON ? 'Write the lesson.' : `Answer “${prompt.text}”.`;
}

const isBlank = (answer: Answers[string] | undefined) => answer === undefined || (answer.kind === 'Text' && answer.text.trim() === '');

// A319, W148, W152: the Close Review is written beside the Trade's Replay. It opens on the first key moment; the questions unlock when every
// key moment has been shown. What was seen is state of this component only: closing the overlay forgets it, and nothing about it is sent.
export function CloseReviewWalk({ replay, underlying, definition, binding, submit, onResolved, onClose, onDirtyChange }: CloseReviewWalkProps) {
  const { writable } = useRuntime();
  const moments = useMemo(() => replay.keyMoments ?? [], [replay]);
  const first = moments[0]?.date;
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(first ? [first] : []));
  // Every route to a session (the drop-down, "Next moment", the slider, the step buttons) ends in the slider's session changing.
  const shown = useCallback(
    (date: string) => {
      if (moments.some((m) => m.date === date)) setSeen((now) => new Set(now).add(date));
    },
    [moments],
  );
  const [answers, setAnswers] = useState<Answers>({});
  const locked = moments.some(({ date }) => !seen.has(date));
  const headingId = useId();
  // The questions the definition requires that have no answer yet (A320: the snapshot's own rule, so a Close Review owed under the earlier form asks fewer).
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const refused = definition.prompts.find((p) => errors[p.id]);
    if (refused) formRef.current?.querySelector<HTMLElement>(`[name="${refused.id}"]`)?.focus();
  }, [errors, definition]);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  // The last save was not accepted, or threw before any result came back: nothing was saved and the answers stay.
  const [notSaved, setNotSaved] = useState(false);
  // Leaving with answers typed asks first (W128's words: save them, discard them, or go back).
  const dirty = Object.keys(answers).length > 0;
  useEffect(() => onDirtyChange?.(dirty && writable), [dirty, writable, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const [asks, setAsks] = useState(0);
  const [asking, setAsking] = useState(false);
  const leave = () => {
    if (!dirty || !writable) return onClose();
    setAsking(true);
    setAsks((n) => n + 1);
  };
  const save = async () => {
    if (!writable) return;
    const missing = definition.prompts.filter((p) => p.required && isBlank(answers[p.id]));
    setErrors(Object.fromEntries(missing.map((p) => [p.id, missingText(p)])));
    if (missing.length > 0 || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setNotSaved(false);
    try {
      const result = await submit({ binding, resolution: { kind: 'Answer', answers } });
      if (result.kind === 'Resolved') onResolved(result);
      else setNotSaved(true);
    } catch {
      setNotSaved(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <ReplayOverlay {...overlayWordsOf(underlying, replay)} onClose={leave}>
      <div className="close-review-walk">
        <div className="walk-replay">
          <ReplayDrawer replay={replay} seen={seen} onSessionChange={shown} {...(first && { initialSession: first })} />
        </div>
        <form className="walk-questions" aria-labelledby={headingId} noValidate ref={formRef} onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}>
          <h3 id={headingId}>Close Review</h3>
          {asking && <Refusal holder={underlying} count={asks} pending={pending} onSave={() => { setAsking(false); void save(); }} onDiscard={onClose} onBack={() => {
            setAsking(false);
            formRef.current?.querySelector<HTMLElement>('textarea, input')?.focus();
          }} />}
          {notSaved && (
            <div role="alert" className="banner warning">
              <strong>This reflection could not be saved.</strong> Nothing was saved. Your values are kept, so you can try again.
            </div>
          )}
          {locked && <p>{`See the ${moments.length} key moments first, then answer.`}</p>}
          <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={errors} disabled={locked || !writable || pending} />
          <button type="submit" className="pill primary" disabled={locked || !writable || pending}>
            Save the Close Review
          </button>
        </form>
      </div>
    </ReplayOverlay>
  );
}
