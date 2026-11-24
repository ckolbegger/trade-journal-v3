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
          text: PROMPT.earlierIntent,
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

const TAKE_AGAIN_OPTIONS = [
  ['yes-as-planned', 'Yes, as planned'],
  ['yes-with-changes', 'Yes, with changes'],
  ['no', 'No'],
  ['unsure', 'Unsure'],
] as const;

// D6 adds the Close Review Entry Type and the Trade Close Source (D6 A86).
export const D5_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 5,
  entryTypes: [
    ...D4_JOURNAL_MANIFEST.entryTypes,
    {
      productKey: 'entry-type.close-review',
      label: 'Close Review',
      // The exact initial definition from the Journal contract, "Initial Entry Definitions".
      prompts: [
        {
          id: 'prompt.close-review.take-again',
          kind: 'SingleSelect',
          text: 'Would you take this Trade again under similar conditions?',
          required: true,
          options: TAKE_AGAIN_OPTIONS.map(([slug, label]) => ({ id: `option.close-review.take-again.${slug}`, label })),
        },
        { id: 'prompt.close-review.what-worked', kind: 'Text', text: 'What worked, and what did not?', required: false },
        { id: 'prompt.close-review.key-lesson', kind: 'Text', text: 'What is the key lesson?', required: false },
      ],
    },
  ],
  sources: [...D4_JOURNAL_MANIFEST.sources, { productKey: 'source.trade-close', label: 'Trade Close' }],
};

type EntryTypeDefinition = JournalSeedManifest['entryTypes'][number];
const revisedType = (productKey: string, prompts: (earlier: readonly PromptDefinition[]) => readonly PromptDefinition[]) => (type: EntryTypeDefinition): EntryTypeDefinition =>
  type.productKey === productKey ? { ...type, prompts: prompts(type.prompts) } : type;

const REFLECTION_PROMPT = 'prompt.position-change-reflection';

// D9.5 revises the Daily Trade Review's reason prompt and Action, the Position Change Reflection's
// prompts and the Close Review's key lesson; the stored forms are revised on the next start (P173).
export const D6_JOURNAL_MANIFEST: JournalSeedManifest = {
  version: 6,
  entryTypes: D5_JOURNAL_MANIFEST.entryTypes
    .map(
      revisedType('entry-type.daily-trade-review', (earlier) =>
        earlier.map((prompt) => {
          if (prompt.id === ACTION && prompt.kind === 'SingleSelect') {
            return { ...prompt, options: [...prompt.options, { id: actionOption('settle-later'), label: 'Settle Later', protected: true as const }] };
          }
          if (prompt.id === 'prompt.daily-trade-review.intent' && prompt.kind === 'Text') {
            return { ...prompt, text: PROMPT.intent, requiredWhen: { promptId: ACTION, optionIds: ['Roll', 'Adjust'].map(actionOption) } };
          }
          return prompt;
        }),
      ),
    )
    .map(
      // Every prompt is optional, so a completed reflection may hold no answers; the two roles are placed by their workflows.
      revisedType('entry-type.position-change-reflection', (earlier) => [
        { id: `${REFLECTION_PROMPT}.plan-departure`, kind: 'Text', text: 'Why did you leave the Plan?', required: false, role: 'PlanDepartureReason' },
        { id: `${REFLECTION_PROMPT}.expiration-reason`, kind: 'Text', text: 'Why did it expire worthless?', required: false, role: 'ExpirationReason' },
        ...earlier.map((prompt): PromptDefinition => ({ ...prompt, required: false })),
      ]),
    )
    .map(
      revisedType('entry-type.close-review', (earlier) => earlier.map((prompt): PromptDefinition => (prompt.id === 'prompt.close-review.key-lesson' ? { ...prompt, required: true } : prompt))),
    ),
  sources: D5_JOURNAL_MANIFEST.sources,
};

// Every manifest a Workspace was ever seeded with, oldest first. The seed step revises an Entry Type
// whose latest stored form equals a form of an earlier manifest in this list (D9.5 P173); each new
// manifest is appended here when it ships.
export const SEEDED_MANIFESTS: readonly JournalSeedManifest[] = [
  D1_JOURNAL_MANIFEST,
  D2_JOURNAL_MANIFEST,
  D3_JOURNAL_MANIFEST,
  D4_JOURNAL_MANIFEST,
  D5_JOURNAL_MANIFEST,
  D6_JOURNAL_MANIFEST,
];
