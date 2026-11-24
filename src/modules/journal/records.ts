// Journal records. Seeded identities are their stable product keys; a label is never identity.

// PlanDepartureReason and ExpirationReason are Text prompt roles the sale and expiration forms place themselves (D9.5 A321, A322).
export type PromptRole = 'Thesis' | 'Invalidation' | 'Action' | 'Intent' | 'PlanDepartureReason' | 'ExpirationReason';

// RequireWhenOption (Journal, "Initial Entry Definitions"): the prompt is required when the named
// SingleSelect prompt holds one of these options.
export interface RequireWhenOption {
  readonly promptId: string;
  readonly optionIds: readonly string[];
}

export interface PromptOption {
  readonly id: string;
  readonly label: string;
  // A protected option is one a Review save may record without a Trade fact (Settle Later, D9.5 A321).
  readonly protected?: true;
}

export type PromptDefinition =
  | { readonly id: string; readonly kind: 'Text'; readonly text: string; readonly required: boolean; readonly role?: PromptRole; readonly requiredWhen?: RequireWhenOption }
  | { readonly id: string; readonly kind: 'Scale'; readonly text: string; readonly required: boolean; readonly min: number; readonly max: number }
  | {
      readonly id: string;
      readonly kind: 'SingleSelect';
      readonly text: string;
      readonly required: boolean;
      readonly role?: PromptRole;
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
