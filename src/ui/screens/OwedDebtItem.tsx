import { useEffect, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { EntryDefinitionRecord, TradeDetailDebt } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { localTime } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { DebtForm, type DebtFormProps, type DebtResolved, type DebtSubmitResult } from './DebtForm.tsx';
import { DUE_TEXT } from './ReviewReflections.tsx';

// An Outstanding Debt in a Trade's narrative: "Reflection owed" beside its Position Change, with its
// due status as text (absent outside session-policy coverage) and, while Writable, the ways to resolve it.
// Reflect now and Decline both open the same form, loaded at the Debt's snapshot revision; the form has
// its own Decline, with the optional reason.
export function OwedDebtItem({
  facade,
  debt,
  timeZone,
  blocked,
  onOpen,
  onClose,
  onResolved,
  onDirtyChange,
}: {
  readonly facade: UiFacade;
  readonly debt: TradeDetailDebt;
  readonly timeZone: string;
  // Another Debt's form is open and unresolved.
  readonly blocked: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onResolved: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}) {
  const { writable, report } = useRuntime();
  const [definition, setDefinition] = useState<EntryDefinitionRecord>();
  const [openFailed, setOpenFailed] = useState(false);

  const open = async () => {
    setOpenFailed(false);
    onOpen();
    try {
      const found = await facade.Journal.getDefinitions({ revision: debt.definitionId });
      if (found.kind === 'Found') {
        setDefinition(found.definition);
        return;
      }
    } catch {
      // Treated like a missing definition: shown below, and the item is released.
    }
    setOpenFailed(true);
    onClose();
  };
  // The form that took focus is replaced by the saved reflection, so focus moves to it.
  const formArea = useRef<HTMLDivElement>(null);
  // What the save returned: the item is relabelled from it, without reading the Trade again.
  const [settled, setSettled] = useState<{ readonly label: string; readonly timeLabel: string; readonly time?: string }>();
  useEffect(() => {
    if (settled) formArea.current?.focus();
  }, [settled]);
  const resolved = (result: DebtResolved) => {
    const answered = result.entry !== undefined;
    setSettled({
      label: answered ? 'Deferred, answered' : 'Declined later',
      timeLabel: answered ? 'Answered' : 'Declined',
      time: (result.entry ?? result.decline)?.authoredTime,
    });
    onResolved();
  };
  const close = () => {
    setDefinition(undefined);
    onClose();
  };

  const submit: DebtFormProps['submit'] = async ({ binding, resolution }): Promise<DebtSubmitResult> => {
    const result = await facade.Journal.save({
      intention: 'ResolveDebt',
      debtId: binding.debtId,
      expectedDebtRevision: binding.debtRevision,
      resolution:
        resolution.kind === 'Answer'
          ? { kind: 'Answer', form: { definitionId: binding.definitionRevision, answers: resolution.answers } }
          : { kind: 'Decline', ...(resolution.reason !== undefined && { reason: resolution.reason }) },
    });
    // A refusal to write switches the whole shell to read only.
    report(result);
    switch (result.kind) {
      case 'Saved':
        return { kind: 'Resolved', ...(result.entry && { entry: result.entry }), ...(result.decline && { decline: result.decline }), debt: result.debt };
      case 'Rejected':
        return { kind: 'Rejected', issues: result.issues.map((i) => ({ ...(i.promptId !== undefined && { promptId: i.promptId }), code: i.code })) };
      case 'Conflict':
        return { kind: 'Conflict', currentOutcome: result.currentOutcome };
      case 'NotFound':
      case 'RuntimeNotWritable':
        return { kind: result.kind };
      default:
        // Storage failed: nothing was saved, and the form keeps its values.
        throw new Error(result.kind);
    }
  };

  return (
    <li>
      <h3>
        {settled ? <Badge tone="info">{settled.label}</Badge> : <Badge tone="warning">Reflection owed</Badge>}
      </h3>
      <p>
        Position Change at <span className="nowrap">{localTime(debt.momentTime, timeZone)}</span>
      </p>
      {settled?.time && (
        <dl>
          <dt>{settled.timeLabel}</dt>
          <dd>{localTime(settled.time, timeZone)}</dd>
        </dl>
      )}
      {!settled && debt.dueStatus && (
        <dl>
          <dt>Due</dt>
          <dd>{DUE_TEXT[debt.dueStatus]}</dd>
        </dl>
      )}
      {openFailed && (
        <p role="alert">
          <strong>This reflection could not be opened.</strong> Try again.
        </p>
      )}
      {definition ? (
        <div ref={formArea} tabIndex={-1}>
          <DebtForm
            definition={definition}
            binding={{ debtId: debt.id, debtRevision: debt.revision, definitionRevision: debt.definitionId }}
            submit={submit}
            onResolved={resolved}
            onCancel={close}
            onDirtyChange={onDirtyChange}
          />
        </div>
      ) : (
        writable && (
          <>
            <button type="button" className="pill secondary" disabled={blocked} onClick={() => void open()}>
              Reflect now
            </button>
            <button type="button" className="pill secondary" disabled={blocked} onClick={() => void open()}>
              Decline
            </button>
          </>
        )
      )}
    </li>
  );
}
