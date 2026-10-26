import type { EntryDefinitionRecord } from '../../app/types.ts';

export interface FieldIssue {
  // A form field name or a Prompt identity.
  readonly field: string;
  readonly message: string;
  // The code of the issue the server returned, so the form can tell which ones it may clear.
  readonly code?: string;
}

export interface Issue {
  readonly source: string;
  readonly field?: string;
  readonly code: string;
}

const ANALYSIS: Record<string, FieldIssue> = {
  NoPositiveRisk: { field: 'stop', message: 'The Stop must be below the intended entry, so the Plan has a positive risk.' },
  MissingStop: { field: 'stop', message: 'Enter a Stop.' },
  TargetNotBeyondEntry: { field: 'target', message: 'The Target must be above the intended entry.' },
  MissingTarget: { field: 'target', message: 'Enter a Target.' },
  InvalidQuantity: { field: 'quantity', message: 'Enter a quantity greater than zero, with at most 6 decimal places.' },
  MissingInstrument: { field: 'symbol', message: 'Enter a stock symbol, such as XYZ or BRK.B.' },
  UnderlyingMismatch: { field: 'symbol', message: 'The leg must be in the Plan’s symbol.' },
  StrategyShapeMismatch: { field: 'strategy', message: 'This Plan does not fit the chosen Strategy.' },
};

export type PriceField = 'entry' | 'stop' | 'target';

const PRICE_LABEL = { entry: 'intended entry', stop: 'Stop', target: 'Target' } as const;

// The domain reports InvalidPrice once, without saying which price failed, so the form says which
// submitted prices fail the domain's rule (`failing`); the issue goes to each of them, and to the
// entry when none does (the server may judge more strictly than the form).
function priceIssues(failing: readonly PriceField[]): FieldIssue[] {
  return (failing.length > 0 ? failing : (['entry'] as const)).map((field) => ({
    field,
    message: `Enter a ${PRICE_LABEL[field]} price greater than zero, with at most 6 decimal places.`,
    code: 'InvalidPrice',
  }));
}

// Plain-language messages for every issue in a rejected confirmation, keyed to their fields.
export function describeIssues(issues: readonly Issue[], definition: EntryDefinitionRecord, failingPrices: readonly PriceField[]): FieldIssue[] {
  return issues.flatMap((issue): FieldIssue[] =>
    issue.source === 'TradeAnalysis' && issue.code === 'InvalidPrice'
      ? priceIssues(failingPrices)
      : [{ ...describeIssue(issue, definition), code: issue.code }],
  );
}

function describeIssue(issue: Issue, definition: EntryDefinitionRecord): FieldIssue {
  if (issue.source === 'TradeAnalysis') return ANALYSIS[issue.code] ?? { field: 'symbol', message: 'Check the Plan.' };
  if (issue.source === 'Journal') return describeJournalIssue(issue, definition);
  if (issue.source === 'ReferenceCatalog') {
    return { field: issue.field ?? 'account', message: 'Choose an available Account and Strategy.' };
  }
  if (issue.code === 'EconomicTimeInFuture') return { field: 'planTime', message: 'The Plan time cannot be in the future.' };
  return { field: issue.field ?? '', message: 'Check this field.' };
}

// A Journal issue about one Prompt's answer, keyed to that Prompt.
export function describeJournalIssue(issue: Issue, definition: EntryDefinitionRecord): FieldIssue {
  const text = definition.prompts.find((p) => p.id === issue.field)?.text ?? 'this question';
  const message = issue.code === 'RequiredAnswerMissing' ? `Answer “${text}”.` : `Check your answer to “${text}”.`;
  return { field: issue.field ?? '', message };
}
