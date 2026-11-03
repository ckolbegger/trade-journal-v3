import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { DueClassification, OwedReflection, PostSaveReview } from '../../app/types.ts';
import { DUE_TEXT } from '../due-text.ts';
import { decimalMoney as price, localTime, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { DebtForm, type DebtSubmitResult, type DebtFormProps } from './DebtForm.tsx';

interface ReflectionsProps {
  readonly facade: UiFacade;
  readonly reviewDate: string;
  readonly reflections: readonly OwedReflection[];
  // The Review under the facts a resolution left: the host applies its progress and completion.
  readonly onReview: (review: PostSaveReview) => void;
  // A reflection was answered or declined here: the host counts it no longer owed.
  // No reflection is left to resolve in the card: the host moves focus on.
  readonly onNoneRemaining: () => void;
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
}

interface RowProps {
  readonly reflection: OwedReflection;
  readonly timeZone: string;
  readonly isOpen: boolean;
  readonly resolved: boolean;
  readonly blocked: boolean;
  readonly submit: DebtFormProps['submit'];
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onResolved: () => void;
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
  readonly buttonRef: (button: HTMLButtonElement | null) => void;
}

function ReflectionRow({ reflection, timeZone, isOpen, resolved, blocked, submit, onOpen, onClose, onResolved, onEntryDirty, buttonRef }: RowProps) {
  const { debtId } = reflection;
  const dirty = useCallback((isDirty: boolean) => onEntryDirty(`debt:${debtId}`, isDirty), [debtId, onEntryDirty]);
  const when = localTime(reflection.economicTime, timeZone);
  const row = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);
  // Opening the form moves focus into it, to its first enabled control; cancelling puts focus back on the button.
  // A resolved reflection keeps isOpen set, and the panel moves focus on itself.
  useEffect(() => {
    if (isOpen && !wasOpen.current) row.current?.querySelector<HTMLElement>('form :is(input, textarea, select, button):not(:disabled)')?.focus();
    else if (!isOpen && wasOpen.current) button.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <li ref={row}>
      <h6>{reflection.entryType}</h6>
      <p>
        Position Change at <span className="nowrap">{when}</span>
      </p>
      <ul className="executions">
        {reflection.executions.map((e) => (
          <li key={e.factId}>{`${e.action} ${e.quantity} ${e.instrument.symbol} @ ${price(e.price)}`}</li>
        ))}
      </ul>
      {!resolved && !isOpen && (
        <button
          type="button"
          ref={(element) => {
            button.current = element;
            buttonRef(element);
          }}
          className="pill secondary" disabled={blocked} onClick={onOpen}>
          Reflect on {when}
        </button>
      )}
      {(isOpen || resolved) && <DebtForm definition={reflection.definition} binding={reflection.saveBinding} submit={submit} onResolved={onResolved} onCancel={resolved ? undefined : onClose} onDirtyChange={dirty} />}
    </li>
  );
}

// The Trade's Outstanding reflections above its Action form (A71), each with its Position Change and when it is due.
// One Debt form is open at a time; a resolved reflection stays in the card as the result rendered it.
export function ReviewReflections({ facade, reviewDate, reflections, onReview, onNoneRemaining, onEntryDirty }: ReflectionsProps) {
  const { timeZone = 'UTC', report } = useRuntime();
  const [open, setOpen] = useState<string>();
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // Where focus goes once the resolved reflection has rendered: the next reflection's button, or on when none is due.
  const [focusNext, setFocusNext] = useState<{ readonly debtId: string | undefined }>();
  useEffect(() => {
    if (!focusNext) return;
    if (focusNext.debtId === undefined) onNoneRemaining();
    else buttons.current.get(focusNext.debtId)?.focus();
  }, [focusNext, onNoneRemaining]);

  const submit: DebtFormProps['submit'] = async ({ binding, resolution }): Promise<DebtSubmitResult> => {
    const result = await facade.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding, resolution });
    // A refusal to write switches the whole shell to read only.
    report(result);
    switch (result.kind) {
      case 'DebtResolved':
        onReview(result.review);
        return { kind: 'Resolved', ...(result.entry && { entry: result.entry }), ...(result.decline && { decline: result.decline }), debt: result.debt };
      case 'Rejected':
        // Only the Journal's issues name a prompt or the reason; a Mark issue is about the Review as a whole.
        return { kind: 'Rejected', issues: result.issues.flatMap((i) => ('field' in i ? [] : [{ ...(i.promptId !== undefined && { promptId: i.promptId }), code: i.code }])) };
      case 'Conflict':
        return { kind: 'Conflict', ...(result.currentOutcome && { currentOutcome: result.currentOutcome }) };
      case 'NotFound':
      case 'RuntimeNotWritable':
        return { kind: result.kind };
      default:
        // The Review changed or storage failed: nothing was saved, and the form keeps its values.
        throw new Error(result.kind);
    }
  };
  const resolvedOne = (debtId: string) => {
    setResolved(new Set(resolved).add(debtId));
    // The panel's work is finished once nothing due now remains; later ones stay listed and answerable.
    setFocusNext({ debtId: reflections.find((r) => r.debtId !== debtId && !resolved.has(r.debtId) && r.classification === 'Due')?.debtId });
  };
  const headingId = useId();
  if (reflections.length === 0) return null;
  const openUnresolved = open !== undefined && !resolved.has(open);
  // One group per session date of the Position Change, in the order the reflections come (oldest first).
  const groups: { readonly key: string; readonly date: string; readonly classification: DueClassification; readonly items: OwedReflection[] }[] = [];
  for (const reflection of reflections) {
    const date = localTime(reflection.economicTime, timeZone).slice(0, 10);
    const key = `${date}:${reflection.classification}`;
    const group = groups.find((g) => g.key === key);
    if (group) group.items.push(reflection);
    else groups.push({ key, date, classification: reflection.classification, items: [reflection] });
  }
  return (
    <section aria-label="Reflections">
      {groups.map((group) => (
        <div key={group.key} role="group" aria-labelledby={`${headingId}-${group.key}`}>
          <h5 id={`${headingId}-${group.key}`}>
            {shortDate(group.date)} · <span>{DUE_TEXT[group.classification]}</span>
          </h5>
          <ul>
            {group.items.map((reflection) => (
              <ReflectionRow
                key={reflection.debtId}
                reflection={reflection}
                timeZone={timeZone}
                isOpen={open === reflection.debtId}
                resolved={resolved.has(reflection.debtId)}
                blocked={openUnresolved}
                submit={submit}
                onOpen={() => setOpen(reflection.debtId)}
                onClose={() => setOpen(undefined)}
                onResolved={() => resolvedOne(reflection.debtId)}
                onEntryDirty={onEntryDirty}
                buttonRef={(button) => (button ? buttons.current.set(reflection.debtId, button) : buttons.current.delete(reflection.debtId))}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
