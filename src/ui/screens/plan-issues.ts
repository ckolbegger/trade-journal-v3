import type { EntryDefinitionRecord } from '../../app/types.ts';
import { formatDecimal, type Rational } from '../../domain/values/index.ts';

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
  // The breakeven an option rejection names (A100).
  // `condition` names the Stop or Target an option-price rejection is about (A196).
  readonly details?: {
    readonly breakeven?: Rational;
    readonly condition?: { readonly role: 'Stop' | 'Target'; readonly position: number; readonly kind: string };
  };
}

// The option Plan being confirmed, as far as the wording goes: a bullish Strategy (Long Call,
// Cash-Secured Put) puts its Stop below its Target, and a bearish one (Long Put) above it.
export interface OptionPlan {
  readonly bullish: boolean;
  // A short option (the Cash-Secured Put) reverses its option-price Stop and Target against a long one.
  readonly short?: boolean;
}

// An option-price condition's rejection goes beside its own field (W4, W5), against the option's side.
function optionPriceIssue(issue: Issue, { short }: OptionPlan): FieldIssue | undefined {
  if (issue.details?.condition?.kind !== 'StructureValue') return undefined;
  if (issue.code === 'NoPositiveRisk') {
    return { field: 'stopOption', message: `The option-price Stop must be ${short ? 'above' : 'below'} the intended entry price to calculate Risk properly.` };
  }
  if (issue.code === 'TargetNotBeyondEntry') {
    return { field: 'targetOption', message: `The option-price Target must be ${short ? 'below' : 'above'} the intended entry price.` };
  }
  return undefined;
}

// One sentence per code (rows 19.12 to 19.23); the breakeven is an Underlying price, two decimals (C3).
function optionIssue(issue: Issue, option: OptionPlan): FieldIssue | undefined {
  const { bullish } = option;
  const optionPrice = optionPriceIssue(issue, option);
  if (optionPrice) return optionPrice;
  const breakeven = issue.details?.breakeven && formatDecimal(issue.details.breakeven, 2);
  const below = bullish ? 'below' : 'above';
  const fixed: Record<string, FieldIssue> = {
    ...OPTION_SENTENCES,
    StopTargetOrder: { field: 'stop', message: `The Stop must be ${below} the Target.` },
    ...(breakeven && {
      NoPositiveRisk: { field: 'stop', message: `The Stop must be ${below} the breakeven, ${breakeven}, so the Plan has a positive risk.` },
      TargetNotBeyondEntry: { field: 'target', message: `The Target must be ${bullish ? 'above' : 'below'} the breakeven, ${breakeven}.` },
    }),
  };
  return fixed[issue.code];
}

const OPTION_SENTENCES: Record<string, FieldIssue> = {
  ContractAlreadyExpired: { field: 'expiration', message: 'The expiration date must be on or after the Plan date.' },
  InvalidQuantity: { field: 'quantity', message: 'Enter a number of contracts greater than zero.' },
  ContractQuantityNotWhole: { field: 'quantity', message: 'Enter a whole number of contracts.' },
  InvalidStrike: { field: 'strike', message: 'Enter the strike as a number below 100,000.' },
  StrikeNotPositive: { field: 'strike', message: 'The strike must be greater than zero.' },
  StrikeTooPrecise: { field: 'strike', message: 'Enter the strike with at most 3 decimal places.' },
  InvalidExpiration: { field: 'expiration', message: 'Enter an expiration date in the years 2000 to 2099.' },
  RootTooLong: { field: 'symbol', message: 'Options can be recorded only on symbols of up to 6 characters, not counting a “.”.' },
  MissingInstrument: { field: 'symbol', message: 'Enter the Underlying symbol, such as XYZ or BRK.B.' },
  InvalidRight: { field: 'right', message: 'The type must be Call or Put.' },
  ExerciseIntentRequired: { field: 'exerciseIntent', message: 'Say whether you plan to exercise this option if it is in the money.' },
  ExerciseIntentNotApplicable: { field: 'exerciseIntent', message: 'Only a long option takes an exercise intent.' },
  ConditionKindRepeated: { field: 'stop', message: 'A Plan takes at most one Stop and one Target of each kind.' },
};

const ANALYSIS: Record<string, FieldIssue> = {
  NoPositiveRisk: { field: 'stop', message: 'The Stop must be below the intended entry, so the Plan has a positive risk.' },
  MissingStop: { field: 'stop', message: 'Enter a Stop.' },
  TargetNotBeyondEntry: { field: 'target', message: 'The Target must be above the intended entry.' },
  MissingTarget: { field: 'target', message: 'Enter a Target.' },
  InvalidQuantity: { field: 'quantity', message: 'Enter a quantity greater than zero, with at most 6 decimal places.' },
  MissingInstrument: { field: 'symbol', message: 'Enter a stock symbol, such as XYZ or BRK.B.' },
  UnderlyingMismatch: { field: 'symbol', message: 'The leg must be in the Plan’s symbol.' },
  StrategyShapeMismatch: { field: 'strategy', message: 'This Plan does not fit the chosen Strategy.' },
  ConditionKindNotApplicable: { field: 'stop', message: 'A stock Plan takes no option-price Stop or Target.' },
};

export type PriceField = 'entry' | 'stop' | 'target' | 'stopOption' | 'targetOption';

const PRICE_LABEL = { entry: 'an intended entry', stop: 'a Stop', target: 'a Target', stopOption: 'an option', targetOption: 'an option' } as const;

// The domain reports InvalidPrice once, without saying which price failed, so the form says which
// submitted prices fail the domain's rule (`failing`); the issue goes to each of them, and to the
// entry when none does (the server may judge more strictly than the form).
function priceIssues(failing: readonly PriceField[]): FieldIssue[] {
  return (failing.length > 0 ? failing : (['entry'] as const)).map((field) => ({
    field,
    message: `Enter ${PRICE_LABEL[field]} price greater than zero, with at most 6 decimal places.`,
    code: 'InvalidPrice',
  }));
}

// Plain-language messages for every issue in a rejected confirmation, keyed to their fields.
export function describeIssues(
  issues: readonly Issue[],
  definition: EntryDefinitionRecord,
  failingPrices: readonly PriceField[],
  option?: OptionPlan,
): FieldIssue[] {
  return issues.flatMap((issue): FieldIssue[] =>
    issue.source === 'TradeAnalysis' && issue.code === 'InvalidPrice'
      ? priceIssues(failingPrices)
      : [{ ...describeIssue(issue, definition, option), code: issue.code }],
  );
}

function describeIssue(issue: Issue, definition: EntryDefinitionRecord, option?: OptionPlan): FieldIssue {
  if (issue.source === 'TradeAnalysis') {
    return (option && optionIssue(issue, option)) ?? ANALYSIS[issue.code] ?? { field: 'symbol', message: 'Check the Plan.' };
  }
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
