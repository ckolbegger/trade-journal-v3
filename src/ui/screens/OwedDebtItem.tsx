import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { EntryDefinitionRecord, TradeDetailDebt, TradeReplayView } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { DUE_TEXT } from '../due-text.ts';
import { localTime } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { entryLine } from '../cockpit/drawers/journal-line.ts';
import { CloseReviewWalk } from '../cockpit/replay/close-review-walk.tsx';
import { DebtForm, SavedReflection, type DebtFormProps, type DebtResolved, type DebtSubmitResult } from './DebtForm.tsx';

// An Outstanding Debt in a Trade's narrative: its Entry Type and "Reflection owed" beside its Position Change, with its
// due status as text (absent outside session-policy coverage) and, while Writable, the ways to resolve it.
// Reflect now and Decline both open the same form, loaded at the Debt's snapshot revision; the form has
// its own Decline, with the optional reason.
// A request from outside the item to open one Debt's form (A217: "Reflect now" in the rail's Needs you card). The Debt it names opens its own form
// under the one-form-at-a-time rule and calls `handled`, so the request clears and the same Debt can be requested again.
export interface ReflectRequest {
  readonly debtId?: string;
  readonly handled: () => void;
  // A Debt was answered or declined on its card: the rail's Needs you follows from the same save result, without a read (revision 95).
  readonly settled?: (debtId: string) => void;
}
export const ReflectRequestContext = createContext<ReflectRequest>({ handled: () => undefined });

// The Trade's replay the page already read, for a Close Review's walk (T95.60). Without it (not read, or none) a Close Review is answered in the Debt form.
export interface WalkSource {
  readonly replay: TradeReplayView;
  readonly underlying: string;
}
export const WalkSourceContext = createContext<WalkSource | undefined>(undefined);

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
  // A Close Review with a key moment to start on is written in the walk; "Decline…" asks first, with none of the questions (W153).
  const source = useContext(WalkSourceContext);
  const walkable = debt.entryTypeKey === 'entry-type.close-review' && source !== undefined && (source.replay.keyMoments?.length ?? 0) > 0;
  const [declining, setDeclining] = useState(false);
  const [walked, setWalked] = useState<DebtResolved>();
  // The form was opened by a request from outside, so it takes focus when it appears.
  const [focusOnOpen, setFocusOnOpen] = useState(false);

  const open = async (fromRequest = false, decline = false) => {
    setOpenFailed(false);
    setDeclining(decline);
    setFocusOnOpen(fromRequest);
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
    setFocusOnOpen(false);
    onClose();
  };
  // A request for this Debt opens its form, unless another form is open or the Runtime is read only; either way the request is handled.
  const request = useContext(ReflectRequestContext);
  const requested = request.debtId === debt.id;
  useEffect(() => {
    if (!requested) return;
    request.handled();
    if (writable && !blocked && !definition) {
      queueMicrotask(() => void open(true));
    }
    // Only a new request matters, not the item's own changes.
  }, [requested]);
  // The form that took focus is replaced by the saved reflection, so focus moves to it.
  const formArea = useRef<HTMLDivElement>(null);
  // A form opened from outside (the rail's button) is out of view and the pressed button is elsewhere, so the form takes focus and scrolls into view.
  useEffect(() => {
    if (!definition || !focusOnOpen) return;
    formArea.current?.focus();
    formArea.current?.scrollIntoView?.({ block: 'start' });
  }, [definition]);
  // What the save returned: the item is relabelled from it, without reading the Trade again.
  const [settled, setSettled] = useState<{ readonly label: string; readonly time?: string }>();
  useEffect(() => {
    if (settled) formArea.current?.focus();
  }, [settled]);
  const resolved = (result: DebtResolved) => {
    const answered = result.entry !== undefined;
    setSettled({
      label: answered ? 'Deferred, answered' : 'Declined later',
      time: (result.entry ?? result.decline)?.authoredTime,
    });
    request.settled?.(debt.id);
    onResolved();
  };
  const close = () => {
    setDefinition(undefined);
    setDeclining(false);
    setFocusOnOpen(false);
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

  const binding = { debtId: debt.id, debtRevision: debt.revision, definitionRevision: debt.definitionId };
  // The walk for a Close Review (once saved, its answers), or the Debt form: with all its questions, or only the decline's ask.
  const formOf = (loaded: EntryDefinitionRecord) => {
    if (walked) return <SavedReflection definition={loaded} resolved={walked} />;
    if (walkable && !declining) {
      return (
        <CloseReviewWalk
          replay={source.replay}
          underlying={source.underlying}
          definition={loaded}
          binding={binding}
          submit={submit}
          onResolved={(result) => {
            setWalked(result);
            resolved(result);
          }}
          onClose={close}
          {...(onDirtyChange && { onDirtyChange })}
        />
      );
    }
    return <DebtForm definition={loaded} binding={binding} requires={debt.requires} submit={submit} onResolved={resolved} onCancel={close} onDirtyChange={onDirtyChange} declineOnly={declining} />;
  };
  return (
    <li>
      <h3>
        <Badge tone="neutral">{debt.entryType}</Badge>
        {settled ? <Badge tone="info">{settled.label}</Badge> : <Badge tone="warning">Reflection owed</Badge>}
      </h3>
      {settled?.time ? (
        <p className="journal-line">{entryLine(debt.source, debt.momentTime, settled.time, timeZone)}</p>
      ) : (
        <p>
          Position Change at <span className="nowrap">{localTime(debt.momentTime, timeZone)}</span>
        </p>
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
          {formOf(definition)}
        </div>
      ) : (
        writable &&
        (walkable ? (
          <>
            <button type="button" className="pill secondary" disabled={blocked} onClick={() => void open()}>
              Write the Close Review
            </button>
            <button type="button" className="link-button" disabled={blocked} onClick={() => void open(false, true)}>
              Decline…
            </button>
          </>
        ) : (
          <>
            <button type="button" className="pill secondary" disabled={blocked} onClick={() => void open()}>
              Reflect now
            </button>
            <button type="button" className="pill secondary" disabled={blocked} onClick={() => void open()}>
              Decline
            </button>
          </>
        ))
      )}
    </li>
  );
}
