import type { BindingCheck, Write, WriteSet } from './persistence.ts';

// The coordinator-owned staging area for one semantic command. Modules' apply operations
// stage their checks and writes here and only here; the coordinator closes it into one
// persistence commit, so every effect commits together or not at all.
export interface SemanticTransaction {
  readonly isOpen: boolean;
  require(check: BindingCheck): void;
  stage(write: Write): void;
  close(): WriteSet;
}

// A module apply operation called without an open semantic transaction: a programming error.
export class NotInSemanticTransaction extends Error {
  constructor() {
    super('Apply operations run only inside an open semantic transaction');
    this.name = 'NotInSemanticTransaction';
  }
}

export function requireOpen(tx: SemanticTransaction | undefined): SemanticTransaction {
  if (!tx?.isOpen) throw new NotInSemanticTransaction();
  return tx;
}

export function beginSemanticTransaction(): SemanticTransaction {
  let open = true;
  const checks: BindingCheck[] = [];
  const writes: Write[] = [];
  const ensureOpen = () => {
    if (!open) throw new Error('The semantic transaction is closed');
  };
  return {
    get isOpen() {
      return open;
    },
    require(check) {
      ensureOpen();
      checks.push(check);
    },
    stage(write) {
      ensureOpen();
      writes.push(write);
    },
    close() {
      ensureOpen();
      open = false;
      return { checks, writes };
    },
  };
}
