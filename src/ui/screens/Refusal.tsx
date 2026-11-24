import { useEffect, useRef } from 'react';

// W128: the refusal on the Trade pressed, naming the Trade whose form is unsaved.
export interface RefusalProps {
  // The Underlying of the Trade whose form holds the unsaved values.
  readonly holder: string;
  // How many times a Trade has been refused: each refusal takes focus again (A327).
  readonly count: number;
  // Save it is running: the three answers wait for it.
  readonly pending: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onBack: () => void;
}

export function Refusal({ holder, count, pending, onSave, onDiscard, onBack }: RefusalProps) {
  const save = useRef<HTMLButtonElement>(null);
  useEffect(() => save.current?.focus(), [count]);
  return (
    <div role="status">
      <p>{holder}'s note isn't saved.</p>
      <button type="button" ref={save} className="pill primary" disabled={pending} onClick={onSave}>
        Save it
      </button>
      <button type="button" className="pill secondary" disabled={pending} onClick={onDiscard}>
        Discard it
      </button>
      <button type="button" className="pill secondary" disabled={pending} onClick={onBack}>
        Back to {holder}
      </button>
    </div>
  );
}
