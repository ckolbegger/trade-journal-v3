// Journal records. Seeded identities are their stable product keys; a label is never identity.

export type PromptRole = 'Thesis' | 'Invalidation';

export interface PromptOption {
  readonly id: string;
  readonly label: string;
}

export type PromptDefinition =
  | { readonly id: string; readonly kind: 'Text'; readonly text: string; readonly required: boolean; readonly role?: PromptRole }
  | { readonly id: string; readonly kind: 'Scale'; readonly text: string; readonly required: boolean; readonly min: number; readonly max: number }
  | {
      readonly id: string;
      readonly kind: 'SingleSelect';
      readonly text: string;
      readonly required: boolean;
      readonly options: readonly PromptOption[];
    };

// One immutable revision of an Entry Type's form.
export interface EntryDefinitionRecord {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly revisionNumber: number;
  readonly prompts: readonly PromptDefinition[];
}

export interface JournalTypeRecord {
  readonly id: string;
  readonly kind: 'EntryType' | 'Source';
  readonly productKey: string;
  readonly label: string;
}

export interface JournalSnapshot {
  readonly journalRevision: number;
}
