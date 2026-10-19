export type PromptKind = "text" | "singleSelect" | "scale";

export interface PromptOption {
  readonly stableKey: string;
  readonly label: string;
}

export interface PromptDefinition {
  readonly stableKey: string;
  readonly label: string;
  readonly kind: PromptKind;
  readonly required: boolean;
  readonly semanticRole?: "thesis" | "invalidation" | "revision-rationale";
  readonly options?: readonly PromptOption[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

export interface EntryTypeSeed {
  readonly stableKey: string;
  readonly label: string;
  readonly prompts: readonly PromptDefinition[];
}

export interface SourceSeed {
  readonly stableKey: string;
  readonly label: string;
  /** The product writing path this Source belongs to. */
  readonly writingPath: string;
}

export interface JournalSeedManifest {
  readonly version: string;
  readonly entryTypes: readonly EntryTypeSeed[];
  readonly sources: readonly SourceSeed[];
}

const EMOTIONS: readonly PromptOption[] = [
  { stableKey: "option.emotion.calm", label: "Calm" },
  { stableKey: "option.emotion.eager", label: "Eager" },
  { stableKey: "option.emotion.anxious", label: "Anxious" },
  { stableKey: "option.emotion.fomo", label: "FOMO" },
  { stableKey: "option.emotion.revenge", label: "Revenge" },
  { stableKey: "option.emotion.relieved", label: "Relieved" },
  { stableKey: "option.emotion.frustrated", label: "Frustrated" },
  { stableKey: "option.emotion.other", label: "Other" },
];

/** Seed manifest v1: the Plan Reflection Entry Type and the Plan Confirmation Source. */
export const SEED_MANIFEST_V1: JournalSeedManifest = {
  version: "journal-seed-v1",
  entryTypes: [
    {
      stableKey: "entryType.plan-reflection",
      label: "Plan Reflection",
      prompts: [
        {
          stableKey: "prompt.plan-reflection.thesis",
          label: "Why this trade, why now?",
          kind: "text",
          required: true,
          semanticRole: "thesis",
        },
        {
          stableKey: "prompt.plan-reflection.invalidation",
          label: "What would invalidate the thesis?",
          kind: "text",
          required: true,
          semanticRole: "invalidation",
        },
        {
          stableKey: "prompt.plan-reflection.conviction",
          label: "Conviction",
          kind: "scale",
          required: false,
          scaleMax: 5,
        },
        {
          stableKey: "prompt.plan-reflection.primary-emotion",
          label: "Primary emotion",
          kind: "singleSelect",
          required: false,
          options: EMOTIONS,
        },
      ],
    },
  ],
  sources: [
    {
      stableKey: "source.plan-confirmation",
      label: "Plan Confirmation",
      writingPath: "plan-confirmation",
    },
  ],
};

/** A later release's complete manifest, used to prove the mechanism carries every fixed identity. */
export const SEED_MANIFEST_FULL: JournalSeedManifest = {
  version: "journal-seed-full",
  entryTypes: [
    ...SEED_MANIFEST_V1.entryTypes,
    { stableKey: "entryType.position-change-reflection", label: "Position Change Reflection", prompts: [] },
    { stableKey: "entryType.management-revision", label: "Management Revision", prompts: [] },
    { stableKey: "entryType.close-review", label: "Close Review", prompts: [] },
    { stableKey: "entryType.daily-trade-review", label: "Daily Trade Review", prompts: [] },
    { stableKey: "entryType.review-note", label: "Review Note", prompts: [] },
    { stableKey: "entryType.trader-reflection", label: "Trader Reflection", prompts: [] },
  ],
  sources: [
    ...SEED_MANIFEST_V1.sources,
    { stableKey: "source.position-change", label: "Position Change", writingPath: "position-change" },
    { stableKey: "source.management-revision", label: "Management Revision", writingPath: "management-revision" },
    { stableKey: "source.trade-close", label: "Trade Close", writingPath: "trade-close" },
    { stableKey: "source.daily-review", label: "Daily Review", writingPath: "daily-review" },
    { stableKey: "source.trade-detail", label: "Trade Detail", writingPath: "trade-detail" },
    { stableKey: "source.journal", label: "Journal", writingPath: "journal" },
  ],
};

/**
 * Manifest v2 pins the exact initial Plan Reflection definition with its explicit 1–5 Conviction
 * bounds and repeats the v1 fixed identities unchanged. It creates no Entry Type and no Source that
 * v1 did not already declare; the other six fixed types and six Sources stay absent until D17.
 */
export const SEED_MANIFEST_V2: JournalSeedManifest = {
  version: "journal-seed-v2",
  entryTypes: [
    {
      stableKey: "entryType.plan-reflection",
      label: "Plan Reflection",
      prompts: [
        {
          stableKey: "prompt.plan-reflection.thesis",
          label: "Why this trade, why now?",
          kind: "text",
          required: true,
          semanticRole: "thesis",
        },
        {
          stableKey: "prompt.plan-reflection.invalidation",
          label: "What would invalidate the thesis?",
          kind: "text",
          required: true,
          semanticRole: "invalidation",
        },
        {
          stableKey: "prompt.plan-reflection.conviction",
          label: "Conviction",
          kind: "scale",
          required: false,
          scaleMin: 1,
          scaleMax: 5,
        },
        {
          stableKey: "prompt.plan-reflection.primary-emotion",
          label: "Primary emotion",
          kind: "singleSelect",
          required: false,
          options: EMOTIONS,
        },
      ],
    },
  ],
  sources: SEED_MANIFEST_V1.sources,
};
