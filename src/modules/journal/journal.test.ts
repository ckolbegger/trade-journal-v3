import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, NotInSemanticTransaction, type SemanticTransaction } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D1_JOURNAL_MANIFEST, type PlanReflectionRequest } from './index.ts';

const clock = fixedClock('2026-10-12T14:05:00Z');

async function journal() {
  const { persistence } = await emptyWorkspace();
  return { journal: createJournal({ persistence, ids: sequentialIds('j'), clock }), persistence };
}

async function stored(persistence: Awaited<ReturnType<typeof journal>>['persistence']) {
  const { value } = await persistence.readSnapshot(['journalTypes', 'journalDefinitions', 'journalEntries', 'meta'], async (tx) => ({
    types: await tx.getAll('journalTypes'),
    definitions: await tx.getAll('journalDefinitions'),
    entries: await tx.getAll('journalEntries'),
    meta: await tx.get('meta', 'journal'),
  }));
  return value;
}

describe('seedDefaults', () => {
  it('should create only the Plan Reflection Entry Type, its definition revision 1, and the Plan Confirmation Source under stable product keys', async () => {
    const { journal: j, persistence } = await journal();
    const result = await j.seedDefaults(D1_JOURNAL_MANIFEST);
    expect(result).toEqual({
      kind: 'Seeded',
      additions: ['entry-type.plan-reflection', 'source.plan-confirmation'],
      snapshot: { journalRevision: 1 },
    });
    const state = await stored(persistence);
    expect(state.types).toEqual([
      expect.objectContaining({ kind: 'EntryType', productKey: 'entry-type.plan-reflection', label: 'Plan Reflection' }),
      expect.objectContaining({ kind: 'Source', productKey: 'source.plan-confirmation', label: 'Plan Confirmation' }),
    ]);
    expect(state.definitions).toEqual([
      expect.objectContaining({ entryTypeKey: 'entry-type.plan-reflection', revisionNumber: 1 }),
    ]);
    expect(state.entries).toEqual([]);
  });

  it('should match the contract exactly: four prompts in order ("Why this trade, why now?" required Text, Thesis role; "What would invalidate the thesis?" required Text, Invalidation role; "Conviction" optional Scale 1–5; "Primary emotion" optional Single Select with Calm, Eager, Anxious, FOMO, Revenge, Relieved, Frustrated, Other in that order)', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const [definition] = (await stored(persistence)).definitions as { prompts: unknown[] }[];
    expect(definition?.prompts).toEqual([
      { id: 'prompt.plan-reflection.thesis', kind: 'Text', text: 'Why this trade, why now?', required: true, role: 'Thesis' },
      { id: 'prompt.plan-reflection.invalidation', kind: 'Text', text: 'What would invalidate the thesis?', required: true, role: 'Invalidation' },
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
    ]);
  });

  it('should add nothing when run again with the same manifest', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const before = await stored(persistence);
    expect(await j.seedDefaults(D1_JOURNAL_MANIFEST)).toEqual({
      kind: 'Seeded',
      additions: [],
      snapshot: { journalRevision: 1 },
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should return SeedConflict and write nothing when the manifest declares the Plan Reflection key with an incompatible definition', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const before = await stored(persistence);
    const [planReflection] = D1_JOURNAL_MANIFEST.entryTypes;
    const incompatible = {
      ...D1_JOURNAL_MANIFEST,
      version: 2,
      entryTypes: [{ ...planReflection!, prompts: planReflection!.prompts.slice(1) }],
    };
    expect(await j.seedDefaults(incompatible)).toEqual({ kind: 'SeedConflict', productKey: 'entry-type.plan-reflection' });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should seed the default Journal types and definitions exactly once and advance journalRevision once when two seeds run at once', async () => {
    const { journal: j, persistence } = await journal();
    const results = await Promise.all([j.seedDefaults(D1_JOURNAL_MANIFEST), j.seedDefaults(D1_JOURNAL_MANIFEST)]);
    const additions = results.map((r) => (r.kind === 'Seeded' ? r.additions : null));
    expect(additions).toContainEqual(['entry-type.plan-reflection', 'source.plan-confirmation']);
    expect(additions).toContainEqual([]);
    const state = await stored(persistence);
    expect(state.types).toHaveLength(2);
    expect(state.definitions).toHaveLength(1);
    expect(state.meta?.['journalRevision']).toBe(1);
  });

  it('should return its typed conflict and write nothing after 3 attempts when journalRevision keeps moving', async () => {
    const { persistence } = await emptyWorkspace();
    let attempts = 0;
    const wrapped: typeof persistence = {
      ...persistence,
      commit: async (set) => {
        attempts += 1;
        await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'journal', journalRevision: attempts } }] });
        return persistence.commit(set);
      },
    };
    const j = createJournal({ persistence: wrapped, ids: sequentialIds('j'), clock });
    expect(await j.seedDefaults(D1_JOURNAL_MANIFEST)).toEqual({ kind: 'Conflict' });
    expect(attempts).toBe(3);
    const state = await stored(persistence);
    expect(state.types).toEqual([]);
    expect(state.definitions).toEqual([]);
  });
});

describe('getDefinitions', () => {
  it('should return the latest Plan Reflection definition with stable Prompt and Option identities', async () => {
    const { journal: j } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const result = await j.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
    expect(result).toEqual({
      kind: 'Found',
      definition: {
        id: 'j-0001',
        entryTypeKey: 'entry-type.plan-reflection',
        revisionNumber: 1,
        prompts: D1_JOURNAL_MANIFEST.entryTypes[0]!.prompts,
      },
    });
  });

  it('should return an exact retained revision by identity and NotFound for an unknown revision', async () => {
    const { journal: j } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    expect(await j.getDefinitions({ revision: 'j-0001' })).toEqual(
      expect.objectContaining({
        kind: 'Found',
        definition: expect.objectContaining({ id: 'j-0001', revisionNumber: 1 }) as unknown,
      }),
    );
    expect(await j.getDefinitions({ revision: 'no-such-revision' })).toEqual({ kind: 'NotFound' });
  });
});

describe('prepareEffects: completed Plan Reflection', () => {
  const THESIS = 'prompt.plan-reflection.thesis';
  const INVALIDATION = 'prompt.plan-reflection.invalidation';
  const CONVICTION = 'prompt.plan-reflection.conviction';
  const EMOTION = 'prompt.plan-reflection.primary-emotion';

  async function seeded() {
    const setup = await journal();
    await setup.journal.seedDefaults(D1_JOURNAL_MANIFEST);
    return setup;
  }

  function request(answers: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
    return {
      obligation: 'PlanReflection',
      disposition: { kind: 'Complete', form: { definitionId: 'j-0001', answers } },
      anchor: { kind: 'Trade', ref: 'candidate:trade' },
      origin: { kind: 'Plan', ref: 'candidate:plan' },
      momentTime: '2026-10-12T13:30:00Z',
      ...overrides,
    } as PlanReflectionRequest;
  }

  const complete = {
    [THESIS]: { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
    [INVALIDATION]: { kind: 'Text', text: 'A close back below 48.' },
    [CONVICTION]: { kind: 'Scale', value: 4 },
    [EMOTION]: { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
  };

  it('should prepare an Entry with the definition-revision snapshot, a Trade Anchor to the candidate Trade, Source Plan Confirmation, Plan origin, moment time equal to the Plan Economic Time, and authored time from the clock', async () => {
    const { journal: j } = await seeded();
    const result = await j.prepareEffects(request(complete));
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Prepared',
        effects: {
          entries: [
            expect.objectContaining({
              entryTypeKey: 'entry-type.plan-reflection',
              definitionId: 'j-0001',
              sourceKey: 'source.plan-confirmation',
              anchor: { kind: 'Trade', ref: 'candidate:trade' },
              origin: { kind: 'Plan', ref: 'candidate:plan' },
              momentTime: '2026-10-12T13:30:00Z',
              authoredTime: '2026-10-12T14:05:00Z',
            }),
          ],
          declines: [],
        },
      }),
    );
  });

  it('should return the Thesis and Invalidation answers by semantic role', async () => {
    const { journal: j } = await seeded();
    const result = await j.prepareEffects(request(complete));
    expect(result).toEqual(
      expect.objectContaining({
        semantics: { Thesis: 'Breakout above the 50-day on volume.', Invalidation: 'A close back below 48.' },
      }),
    );
  });

  it('should store an unanswered optional prompt as Unanswered, never as declined', async () => {
    const { journal: j } = await seeded();
    const result = await j.prepareEffects(request({ [THESIS]: complete[THESIS], [INVALIDATION]: complete[INVALIDATION] }));
    if (result.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(result.effects.entries[0]?.responses).toEqual([
      { promptId: THESIS, value: { kind: 'Text', text: 'Breakout above the 50-day on volume.' } },
      { promptId: INVALIDATION, value: { kind: 'Text', text: 'A close back below 48.' } },
      { promptId: CONVICTION, value: { kind: 'Unanswered' } },
      { promptId: EMOTION, value: { kind: 'Unanswered' } },
    ]);
  });

  it('should return RequiredAnswerMissing for each blank required prompt, all at once', async () => {
    const { journal: j } = await seeded();
    expect(await j.prepareEffects(request({ [THESIS]: { kind: 'Text', text: '   ' } }))).toEqual({
      kind: 'Rejected',
      issues: [
        { promptId: THESIS, code: 'RequiredAnswerMissing' },
        { promptId: INVALIDATION, code: 'RequiredAnswerMissing' },
      ],
    });
  });

  it('should reject a Conviction outside 1–5 or non-integer with InvalidScaleValue and an unknown option with UnknownOption', async () => {
    const { journal: j } = await seeded();
    for (const value of [0, 6, 3.5]) {
      expect(await j.prepareEffects(request({ ...complete, [CONVICTION]: { kind: 'Scale', value } }))).toEqual({
        kind: 'Rejected',
        issues: [{ promptId: CONVICTION, code: 'InvalidScaleValue' }],
      });
    }
    expect(await j.prepareEffects(request({ ...complete, [EMOTION]: { kind: 'Option', optionId: 'option.bored' } }))).toEqual({
      kind: 'Rejected',
      issues: [{ promptId: EMOTION, code: 'UnknownOption' }],
    });
  });

  it('should reject an unknown prompt with UnknownPrompt and a non-current definition revision with DefinitionRevisionMismatch', async () => {
    const { journal: j } = await seeded();
    expect(await j.prepareEffects(request({ ...complete, 'prompt.made-up': { kind: 'Text', text: 'x' } }))).toEqual({
      kind: 'Rejected',
      issues: [{ promptId: 'prompt.made-up', code: 'UnknownPrompt' }],
    });
    const stale = request(complete, {
      disposition: { kind: 'Complete', form: { definitionId: 'an-older-revision', answers: complete } },
    });
    expect(await j.prepareEffects(stale)).toEqual({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] });
  });

  it('should reject Defer or Decline for Plan Reflection with DispositionNotAllowed', async () => {
    const { journal: j } = await seeded();
    for (const disposition of [{ kind: 'Defer' }, { kind: 'Decline' }]) {
      expect(await j.prepareEffects(request(complete, { disposition }))).toEqual({
        kind: 'Rejected',
        issues: [{ code: 'DispositionNotAllowed' }],
      });
    }
  });

  it('should write nothing (Journal revision unchanged)', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    const result = await j.prepareEffects(request(complete));
    expect(await stored(persistence)).toEqual(before);
    // The prepared outcome is bound to the unchanged Journal snapshot it was validated against.
    expect(result).toEqual(expect.objectContaining({ kind: 'Prepared', snapshot: { journalRevision: 1 } }));
  });
});

describe('applyPreparedEffects', () => {
  const answers = {
    'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' },
    'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'Below 48.' },
  } as const;
  const mapping = { 'candidate:trade': 'trade-1', 'candidate:plan': 'fact-plan-1' };

  async function prepared() {
    const setup = await journal();
    await setup.journal.seedDefaults(D1_JOURNAL_MANIFEST);
    const result = await setup.journal.prepareEffects({
      obligation: 'PlanReflection',
      disposition: { kind: 'Complete', form: { definitionId: 'j-0001', answers } },
      anchor: { kind: 'Trade', ref: 'candidate:trade' },
      origin: { kind: 'Plan', ref: 'candidate:plan' },
      momentTime: '2026-10-12T13:30:00Z',
    });
    if (result.kind !== 'Prepared') throw new Error('expected Prepared');
    return { ...setup, prepared: result };
  }

  it('should stage the Entry inside the shared transaction with candidate references mapped to Trade Record\'s durable identities and return the staged projection', async () => {
    const { journal: j, persistence, prepared: p } = await prepared();
    const tx = beginSemanticTransaction();
    const staged = j.applyPreparedEffects(tx, p, mapping);
    const expected = {
      id: 'j-0002',
      entryTypeKey: 'entry-type.plan-reflection',
      sourceKey: 'source.plan-confirmation',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      origin: { kind: 'Plan', factId: 'fact-plan-1' },
      momentTime: '2026-10-12T13:30:00Z',
      authoredTime: '2026-10-12T14:05:00Z',
      definitionId: 'j-0001',
      responses: p.effects.entries[0]!.responses,
    };
    expect(staged).toEqual({ kind: 'Staged', entries: [expected], declines: [] });
    expect((await stored(persistence)).entries).toEqual([]);
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    expect((await stored(persistence)).entries).toEqual([
      expect.objectContaining({ id: 'j-0002', anchorTradeId: 'trade-1', obligationKey: 'PlanReflection:trade-1' }),
    ]);
  });

  it('should refuse to run outside a semantic transaction', async () => {
    const { journal: j, prepared: p } = await prepared();
    const closed = beginSemanticTransaction();
    closed.close();
    const thrown = (run: () => unknown): unknown => {
      try {
        run();
      } catch (error) {
        return error;
      }
      return undefined;
    };
    expect(typeof NotInSemanticTransaction).toBe('function');
    expect(thrown(() => j.applyPreparedEffects(closed, p, mapping))).toBeInstanceOf(NotInSemanticTransaction);
    expect(thrown(() => j.applyPreparedEffects(undefined as unknown as SemanticTransaction, p, mapping))).toBeInstanceOf(
      NotInSemanticTransaction,
    );
  });

  it('should fail the transaction when a Plan Reflection already exists for the same obligation key', async () => {
    const { journal: j, persistence, prepared: p } = await prepared();
    const first = beginSemanticTransaction();
    j.applyPreparedEffects(first, p, mapping);
    expect((await persistence.commit(first.close())).kind).toBe('Committed');
    const before = await stored(persistence);

    const second = beginSemanticTransaction();
    j.applyPreparedEffects(second, p, mapping);
    second.stage({ op: 'put', store: 'trades', value: { tradeId: 'some-other-effect' } });
    expect(await persistence.commit(second.close())).toEqual({ kind: 'ConstraintViolation', store: 'journalEntries' });
    expect(await stored(persistence)).toEqual(before);
    const trades = await persistence.readSnapshot(['trades'], (tx) => tx.getAll('trades'));
    expect(trades.value).toEqual([]);
  });
});

describe('query: Trade narrative', () => {
  it('should return the Trade\'s Entries with their snapshot labels, ordered by moment time then identity, and an empty page for a Trade with none', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const entry = (id: string, tradeId: string, momentTime: string) => ({
      id,
      entryTypeKey: 'entry-type.plan-reflection',
      sourceKey: 'source.plan-confirmation',
      anchor: { kind: 'Trade', tradeId },
      anchorTradeId: tradeId,
      origin: { kind: 'Plan', factId: `plan-${id}` },
      momentTime,
      authoredTime: momentTime,
      versions: [
        {
          versionNumber: 1,
          definitionId: 'j-0001',
          savedAt: momentTime,
          responses: [
            { promptId: 'prompt.plan-reflection.thesis', value: { kind: 'Text', text: `thesis ${id}` } },
            { promptId: 'prompt.plan-reflection.invalidation', value: { kind: 'Text', text: 'x' } },
            { promptId: 'prompt.plan-reflection.conviction', value: { kind: 'Scale', value: 3 } },
            {
              promptId: 'prompt.plan-reflection.primary-emotion',
              value: { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.fomo' },
            },
          ],
        },
      ],
    });
    // Fixture records written directly: D1 allows only one Plan Reflection per Trade.
    await persistence.commit({
      checks: [],
      writes: [
        { op: 'put', store: 'journalEntries', value: entry('e-b', 'trade-1', '2026-10-12T13:30:00Z') },
        { op: 'put', store: 'journalEntries', value: entry('e-c', 'trade-1', '2026-10-11T13:30:00Z') },
        { op: 'put', store: 'journalEntries', value: entry('e-a', 'trade-1', '2026-10-12T13:30:00Z') },
        { op: 'put', store: 'journalEntries', value: entry('e-z', 'trade-2', '2026-10-10T13:30:00Z') },
      ],
    });

    const page = await j.query({ scope: 'TradeNarrative', tradeId: 'trade-1' });
    if (page.kind !== 'Page') throw new Error('expected a page');
    expect(page.items.map((i) => i.id)).toEqual(['e-c', 'e-a', 'e-b']);
    expect(page.items[0]).toEqual({
      kind: 'Entry',
      id: 'e-c',
      entryType: 'Plan Reflection',
      source: 'Plan Confirmation',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      momentTime: '2026-10-11T13:30:00Z',
      authoredTime: '2026-10-11T13:30:00Z',
      responses: [
        { prompt: 'Why this trade, why now?', answer: { kind: 'Text', text: 'thesis e-c' } },
        { prompt: 'What would invalidate the thesis?', answer: { kind: 'Text', text: 'x' } },
        { prompt: 'Conviction', answer: { kind: 'Scale', value: 3 } },
        { prompt: 'Primary emotion', answer: { kind: 'Option', label: 'FOMO' } },
      ],
    });
    expect(await j.query({ scope: 'TradeNarrative', tradeId: 'trade-none' })).toEqual({
      kind: 'Page',
      items: [],
      snapshot: { journalRevision: 1 },
    });
  });
});
