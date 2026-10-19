import type { RuntimeNotWritable } from "../../results";
import type { ParticipantEffect, TransactionSeam } from "./transaction";

/** The binding kinds the persistence seam distinguishes (overview.md:128). */
export type BindingKind =
  | "querySnapshot"
  | "recordRevision"
  | "factVersion"
  | "definitionRevision"
  | "observationRevision"
  | "workspaceContentRevision";

export interface RecordRevision {
  readonly kind: "recordRevision";
  readonly subject: string;
  readonly value: number;
}

export interface QuerySnapshotToken {
  readonly kind: "querySnapshot";
  readonly value: string;
}

export type OptimisticBinding = RecordRevision | QuerySnapshotToken;

export interface RevisionedCommand {
  readonly store: string;
  readonly subjectId: string;
  readonly expected: OptimisticBinding;
  readonly change: Readonly<Record<string, unknown>>;
  /** Other stores this one semantic command must also write, atomically. */
  readonly additionalParticipants?: readonly ParticipantEffect[];
}

export type RevisionedResult =
  | {
      readonly kind: "Committed";
      readonly revision: RecordRevision;
      /** The complete post-commit subject, sufficient to render without a follow-up read. */
      readonly subject: Readonly<Record<string, unknown>>;
      readonly workspaceContentRevision: number;
    }
  | {
      readonly kind: "Conflict";
      readonly current: RecordRevision;
      /** The domains the rejected command would have changed. */
      readonly changedDomains: readonly string[];
    }
  | {
      readonly kind: "WrongBindingKind";
      readonly expected: BindingKind;
      readonly required: BindingKind;
    }
  | { readonly kind: "Rejected"; readonly reason: "missing-subject" | "empty-change" }
  | { readonly kind: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

export async function commitRevisioned(
  seam: TransactionSeam,
  command: RevisionedCommand,
): Promise<RevisionedResult> {
  if (command.expected.kind !== "recordRevision") {
    return {
      kind: "WrongBindingKind",
      expected: command.expected.kind,
      required: "recordRevision",
    };
  }
  if (Object.keys(command.change).length === 0) {
    return { kind: "Rejected", reason: "empty-change" };
  }

  const snapshot = await seam.snapshot([command.store]);
  const current = snapshot.rows(command.store).find((row) => row.id === command.subjectId);
  if (current === undefined) return { kind: "Rejected", reason: "missing-subject" };

  const currentRevision = typeof current.revision === "number" ? current.revision : 0;
  if (currentRevision !== command.expected.value) {
    return {
      kind: "Conflict",
      current: { kind: "recordRevision", subject: command.subjectId, value: currentRevision },
      changedDomains: Object.keys(command.change).sort(),
    };
  }

  const nextRevision = currentRevision + 1;
  const versions = [
    ...((current.versions as readonly Readonly<Record<string, unknown>>[] | undefined) ?? []),
    { revision: nextRevision, ...command.change },
  ];
  const subject: Record<string, unknown> = {
    ...current,
    ...command.change,
    id: command.subjectId,
    revision: nextRevision,
    versions,
  };

  const result = await seam.commit({
    participants: [
      { store: command.store, put: [subject] },
      ...(command.additionalParticipants ?? []),
    ],
    counters: ["workspaceContentRevision"],
  });
  if (result.kind === "Rejected") {
    return { kind: "RuntimeNotWritable", payload: result.payload };
  }

  return {
    kind: "Committed",
    revision: { kind: "recordRevision", subject: command.subjectId, value: nextRevision },
    subject,
    workspaceContentRevision: result.counters?.workspaceContentRevision ?? 0,
  };
}
