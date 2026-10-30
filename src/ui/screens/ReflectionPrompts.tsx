import type { AnswerInput, EntryDefinitionRecord } from '../../app/types.ts';

export type Answers = Readonly<Record<string, AnswerInput>>;

export interface ReflectionPromptsProps {
  readonly definition: EntryDefinitionRecord;
  readonly answers: Answers;
  readonly onChange: (answers: Answers) => void;
  // Issue messages by Prompt identity.
  readonly errors?: Readonly<Record<string, string>>;
  // The values are shown but cannot be changed (the shell is read only).
  readonly disabled?: boolean;
}

// Renders the exact definition revision loaded for the form, answering stable Prompt and
// Option identities. Single choices are radio groups inside a labelled fieldset.
export function ReflectionPrompts({ definition, answers, onChange, errors = {}, disabled }: ReflectionPromptsProps) {
  const set = (promptId: string, answer: AnswerInput | undefined) => {
    const next = { ...answers };
    if (answer === undefined) delete next[promptId];
    else next[promptId] = answer;
    onChange(next);
  };
  return (
    <>
      {definition.prompts.map((prompt) => {
        const error = errors[prompt.id];
        const errorId = `${prompt.id}-error`;
        const described = error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
        const message = error && (
          <p id={errorId} className="field-error">
            {error}
          </p>
        );
        if (prompt.kind === 'Text') {
          const answer = answers[prompt.id];
          return (
            <div key={prompt.id} className="field">
              <label>
                {prompt.text}
                <textarea
                  name={prompt.id}
                  disabled={disabled}
                  value={answer?.kind === 'Text' ? answer.text : ''}
                  onChange={(e) => set(prompt.id, e.target.value === '' ? undefined : { kind: 'Text', text: e.target.value })}
                  {...described}
                />
              </label>
              {message}
            </div>
          );
        }
        const choices =
          prompt.kind === 'Scale'
            ? Array.from({ length: prompt.max - prompt.min + 1 }, (_, i) => ({
                value: String(prompt.min + i),
                label: String(prompt.min + i),
                answer: { kind: 'Scale', value: prompt.min + i } as const,
              }))
            : prompt.options.map((o) => ({ value: o.id, label: o.label, answer: { kind: 'Option', optionId: o.id } as const }));
        const current = answers[prompt.id];
        const selected = current?.kind === 'Scale' ? String(current.value) : current?.kind === 'Option' ? current.optionId : undefined;
        return (
          <fieldset key={prompt.id} role="radiogroup" aria-labelledby={`${prompt.id}-legend`} className="choices" {...described}>
            <legend id={`${prompt.id}-legend`}>{prompt.text}</legend>
            {choices.map((choice) => (
              <label key={choice.value} className="chip">
                <input
                  type="radio"
                  name={prompt.id}
                  value={choice.value}
                  disabled={disabled}
                  checked={selected === choice.value}
                  onChange={() => set(prompt.id, choice.answer)}
                />
                {choice.label}
              </label>
            ))}
            {message}
          </fieldset>
        );
      })}
    </>
  );
}
