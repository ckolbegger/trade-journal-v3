import { describe, expect, it } from 'vitest';
import { D5_JOURNAL_MANIFEST, D6_JOURNAL_MANIFEST, type JournalSeedManifest } from './index.ts';

// T95.28: Journal seed manifest 6 (D9.5 P173, A321). Expected values are written out from the Journal
// contract's "Initial Entry Definitions", not read from the manifest.
const typeOf = (manifest: JournalSeedManifest, key: string) => {
  const found = manifest.entryTypes.find((t) => t.productKey === key);
  if (!found) throw new Error(`no Entry Type ${key}`);
  return found;
};
const DAILY = 'entry-type.daily-trade-review';
const REFLECTION = 'entry-type.position-change-reflection';
const CLOSE = 'entry-type.close-review';
const action = (slug: string) => `option.daily-trade-review.action.${slug}`;

describe('Journal seed manifest 6', () => {
  it('should define Daily Trade Review with the reason prompt Why, required only for Roll and Adjust', () => {
    const prompts = typeOf(D6_JOURNAL_MANIFEST, DAILY).prompts;
    const reason = prompts.find((p) => p.id === 'prompt.daily-trade-review.intent');
    expect(reason).toEqual({
      id: 'prompt.daily-trade-review.intent',
      kind: 'Text',
      text: 'Why?',
      required: false,
      role: 'Intent',
      requiredWhen: { promptId: 'prompt.daily-trade-review.action', optionIds: [action('roll'), action('adjust')] },
    });
  });

  it('should add the protected option Settle Later to its Action', () => {
    const actionPrompt = typeOf(D6_JOURNAL_MANIFEST, DAILY).prompts.find((p) => p.id === 'prompt.daily-trade-review.action');
    expect(actionPrompt?.kind === 'SingleSelect' && actionPrompt.options).toEqual([
      { id: action('hold'), label: 'Hold' },
      { id: action('exit'), label: 'Exit' },
      { id: action('roll'), label: 'Roll' },
      { id: action('adjust'), label: 'Adjust' },
      { id: action('settle-later'), label: 'Settle Later', protected: true },
    ]);
  });

  it('should define Position Change Reflection with its three earlier prompts optional, and two optional prompts with the Plan Departure Reason and Expiration Reason roles', () => {
    const prompts = typeOf(D6_JOURNAL_MANIFEST, REFLECTION).prompts;
    expect(prompts.map((p) => [p.id, p.kind, p.required, 'role' in p ? p.role : undefined])).toEqual([
      ['prompt.position-change-reflection.plan-departure', 'Text', false, 'PlanDepartureReason'],
      ['prompt.position-change-reflection.expiration-reason', 'Text', false, 'ExpirationReason'],
      ['prompt.position-change-reflection.decision-mode', 'SingleSelect', false, undefined],
      ['prompt.position-change-reflection.primary-emotion', 'SingleSelect', false, undefined],
      ['prompt.position-change-reflection.decision-confidence', 'Scale', false, undefined],
      ['prompt.position-change-reflection.note', 'Text', false, undefined],
    ]);
    expect(prompts.slice(0, 2).map((p) => p.text)).toEqual(['Why did you leave the Plan?', 'Why did it expire worthless?']);
  });

  it('should define Close Review with the key lesson required', () => {
    const prompts = typeOf(D6_JOURNAL_MANIFEST, CLOSE).prompts;
    expect(prompts.map((p) => [p.id, p.required])).toEqual([
      ['prompt.close-review.take-again', true],
      ['prompt.close-review.what-worked', false],
      ['prompt.close-review.key-lesson', true],
    ]);
  });

  it('should match the Journal contract Initial Entry Definitions prompt for prompt', () => {
    const shape = (key: string) =>
      typeOf(D6_JOURNAL_MANIFEST, key).prompts.map((p) => ({
        text: p.text,
        kind: p.kind,
        required: p.required,
        ...('role' in p && p.role ? { role: p.role } : {}),
        ...(p.kind === 'SingleSelect' ? { options: p.options.map((o) => o.label) } : {}),
        ...(p.kind === 'Scale' ? { range: [p.min, p.max] } : {}),
      }));
    const emotions = ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'];
    expect(shape('entry-type.plan-reflection')).toEqual([
      { text: 'Why this trade, why now?', kind: 'Text', required: true, role: 'Thesis' },
      { text: 'What would invalidate the thesis?', kind: 'Text', required: true, role: 'Invalidation' },
      { text: 'Conviction', kind: 'Scale', required: false, range: [1, 5] },
      { text: 'Primary emotion', kind: 'SingleSelect', required: false, options: emotions },
    ]);
    expect(shape(REFLECTION)).toEqual([
      { text: 'Why did you leave the Plan?', kind: 'Text', required: false, role: 'PlanDepartureReason' },
      { text: 'Why did it expire worthless?', kind: 'Text', required: false, role: 'ExpirationReason' },
      { text: 'Decision mode', kind: 'SingleSelect', required: false, options: ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed'] },
      { text: 'Primary emotion', kind: 'SingleSelect', required: false, options: emotions },
      { text: 'Decision confidence', kind: 'Scale', required: false, range: [1, 5] },
      { text: 'Note', kind: 'Text', required: false },
    ]);
    expect(shape(CLOSE)).toEqual([
      { text: 'Would you take this Trade again under similar conditions?', kind: 'SingleSelect', required: true, options: ['Yes, as planned', 'Yes, with changes', 'No', 'Unsure'] },
      { text: 'What worked, and what did not?', kind: 'Text', required: false },
      { text: 'What is the key lesson?', kind: 'Text', required: true },
    ]);
    expect(shape(DAILY)).toEqual([
      { text: 'Action', kind: 'SingleSelect', required: true, role: 'Action', options: ['Hold', 'Exit', 'Roll', 'Adjust', 'Settle Later'] },
      { text: 'Why?', kind: 'Text', required: false, role: 'Intent' },
      { text: 'Conviction now', kind: 'Scale', required: false, range: [1, 5] },
      { text: 'Anything you considered doing and decided against?', kind: 'Text', required: false },
      { text: 'Note', kind: 'Text', required: false },
    ]);
  });

  it('should leave manifest 5 as it was seeded, so a version-5 Workspace still equals a seeded form', () => {
    const intent = typeOf(D5_JOURNAL_MANIFEST, DAILY).prompts.find((p) => p.id === 'prompt.daily-trade-review.intent');
    expect(intent?.text).toBe('Why are you taking this action?');
    expect(D5_JOURNAL_MANIFEST.version).toBe(5);
    expect(D6_JOURNAL_MANIFEST.version).toBe(6);
  });
});
