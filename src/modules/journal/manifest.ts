import { DAILY_TRADE_REVIEW_PROMPTS as PROMPT } from '../../domain/daily-trade-review-prompts.ts';
import type { PromptDefinition, PromptOption } from './records.ts';

export interface JournalSeedManifest {
  readonly version: number;
  readonly entryTypes: readonly {
    readonly productKey: string;
    readonly label: string;
    readonly prompts: readonly PromptDefinition[];
  }[];
  readonly sources: readonly { readonly productKey: string; readonly label: string }[];
}

// D1 seeds only Plan Reflection and the Plan Confirmation Source; later deliverables add the
// other fixed Entry Types and Sources as seed migrations.
export const D1_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 1,
  entryTypes: [
    {
      productKey: 'entry-type.plan-reflection',
      label: 'Plan Reflection',
      // The exact initial definition from the Journal contract, "Initial Entry Definitions".
      prompts: [
        { id: 'prompt.plan-reflection.thesis', kind: 'Text', text: 'Why this trade, why now?', required: true, role: 'Thesis' },
        {
          id: 'prompt.plan-reflection.invalidation',
          kind: 'Text',
          text: 'What would invalidate the thesis?',
          required: true,
          role: 'Invalidation',
        },
        { id: 'prompt.plan-reflection.conviction', kind: 'Scale', text: 'Conviction', required: false, min: 1, max: 5 },
        {
          id: 'prompt.plan-reflection.primary-emotion',
          kind: 'SingleSelect',
          text: 'Primary emotion',
          required: false,
          options: ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'].map((label) => ({
            id: `option.plan-reflection.primary-emotion.${label.toLowerCase()}`,
            label,
          })),
        },
      ],
    },
  ],
  sources: [{ productKey: 'source.plan-confirmation', label: 'Plan Confirmation' }],
};

// Stable option identities for a Position Change Reflection prompt, derived from the initial labels.
function options(prompt: string, labels: readonly string[]): PromptOption[] {
  return labels.map((label) => ({
    id: `option.position-change-reflection.${prompt}.${label.toLowerCase().replaceAll(' ', '-')}`,
    label,
  }));
}

// D2 adds the Position Change Reflection Entry Type and the Position Change Source.
export const D2_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 2,
  entryTypes: [
    ...D1_JOURNAL_MANIFEST.entryTypes,
    {
      productKey: 'entry-type.position-change-reflection',
      label: 'Position Change Reflection',
      // The exact initial definition from the Journal contract, "Initial Entry Definitions".
      prompts: [
        {
          id: 'prompt.position-change-reflection.decision-mode',
          kind: 'SingleSelect',
          text: 'Decision mode',
          required: true,
          options: options('decision-mode', ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed']),
        },
        {
          id: 'prompt.position-change-reflection.primary-emotion',
          kind: 'SingleSelect',
          text: 'Primary emotion',
          required: true,
          options: options('primary-emotion', ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other']),
        },
        {
          id: 'prompt.position-change-reflection.decision-confidence',
          kind: 'Scale',
          text: 'Decision confidence',
          required: true,
          min: 1,
          max: 5,
        },
        { id: 'prompt.position-change-reflection.note', kind: 'Text', text: 'Note', required: false },
      ],
    },
  ],
  sources: [...D1_JOURNAL_MANIFEST.sources, { productKey: 'source.position-change', label: 'Position Change' }],
};

const ACTION = 'prompt.daily-trade-review.action';
const ACTIONS = ['Hold', 'Exit', 'Roll', 'Adjust'] as const;
const actionOption = (label: string) => `option.daily-trade-review.action.${label.toLowerCase()}`;

// D4 adds the Daily Trade Review Entry Type and the Daily Review Source.
export const D3_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 3,
  entryTypes: [
    ...D2_JOURNAL_MANIFEST.entryTypes,
    {
      productKey: 'entry-type.daily-trade-review',
      label: 'Daily Trade Review',
      prompts: [
        {
          id: ACTION,
          kind: 'SingleSelect',
          text: PROMPT.action,
          required: true,
          role: 'Action',
          options: ACTIONS.map((label) => ({ id: actionOption(label), label })),
        },
        {
          id: 'prompt.daily-trade-review.intent',
          kind: 'Text',
          text: PROMPT.intent,
          required: false,
          role: 'Intent',
          requiredWhen: { promptId: ACTION, optionIds: ['Exit', 'Roll', 'Adjust'].map(actionOption) },
        },
        { id: 'prompt.daily-trade-review.conviction', kind: 'Scale', text: PROMPT.conviction, required: false, min: 1, max: 5 },
        { id: 'prompt.daily-trade-review.considered', kind: 'Text', text: PROMPT.considered, required: false },
        { id: 'prompt.daily-trade-review.note', kind: 'Text', text: PROMPT.note, required: false },
      ],
    },
  ],
  sources: [...D2_JOURNAL_MANIFEST.sources, { productKey: 'source.daily-review', label: 'Daily Review' }],
};

// D5 adds the Trade Detail Source, where a Debt is resolved from a Trade (P17).
export const D4_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 4,
  entryTypes: D3_JOURNAL_MANIFEST.entryTypes,
  sources: [...D3_JOURNAL_MANIFEST.sources, { productKey: 'source.trade-detail', label: 'Trade Detail' }],
};
