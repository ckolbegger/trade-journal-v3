import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { OwedReflection, PostSaveReview, ReflectionClassification } from '../../app/types.ts';
import { decimalMoney as price, localTime } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { DebtForm, type DebtSubmitResult, type DebtFormProps } from './DebtForm.tsx';

// Shared with Trade Detail, whose Debt due status has the same three values.
export const DUE_TEXT: Record<ReflectionClassification, string> = {
  Due: 'Due',
  DueInNextReview: 'Due in the next Review',
  DueInReviewAfterNext: 'Due in the Review after next',
};

interface ReflectionsProps {
  readonly facade: UiFacade;
  readonly reviewDate: string;
  readonly reflections: readonly OwedReflection[];
  // The Review under the facts a resolution left: the host applies its progress and completion.
  readonly onReview: (review: PostSaveReview) => void;
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
  return (
    <li>
      <p>
        Position Change at <span className="nowrap">{when}</span>
      </p>
      <ul className="executions">
        {reflection.executions.map((e) => (
          <li key={e.factId}>{`${e.action} ${e.quantity} ${e.instrument.symbol} @ ${price(e.price)}`}</li>
        ))}
      </ul>
      <p>{DUE_TEXT[reflection.classification]}</p>
      {!resolved && !isOpen && (
        <button type="button" ref={buttonRef} className="pill secondary" disabled={blocked} onClick={onOpen}>
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
  // Where focus goes once the resolved reflection has rendered: the next reflection's button, or on when none remains.
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
    setFocusNext({ debtId: reflections.find((r) => r.debtId !== debtId && !resolved.has(r.debtId))?.debtId });
  };
  if (reflections.length === 0) return null;
  const openUnresolved = open !== undefined && !resolved.has(open);
  return (
    <section aria-label="Reflections">
      <h4>Reflections</h4>
      <ul>
        {reflections.map((reflection) => (
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
    </section>
  );
}
