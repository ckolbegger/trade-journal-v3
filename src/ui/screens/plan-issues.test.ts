import { describe, expect, it } from 'vitest';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import { describeIssues, type PriceField } from './plan-issues.ts';

const definition = { prompts: [] } as unknown as EntryDefinitionRecord;
const invalidPrice = [{ source: 'TradeAnalysis', code: 'InvalidPrice' }];
const messages = (failing: PriceField[]) => describeIssues(invalidPrice, definition, failing).map((i) => i.message);

describe('option plan issues', () => {
  const describeOption = (code: string) => describeIssues([{ source: 'TradeAnalysis', code }], definition, [], { bullish: true })[0]!;

  it('should give each option rejection code its own sentence beside its field, and none the Check the Plan fallback', () => {
    const expected: Record<string, readonly [string, string]> = {
      StopTargetOrder: ['stop', 'The Stop must be below the Target.'],
      ContractAlreadyExpired: ['expiration', 'The expiration date must be on or after the Plan date.'],
      InvalidQuantity: ['quantity', 'Enter a number of contracts greater than zero.'],
      ContractQuantityNotWhole: ['quantity', 'Enter a whole number of contracts.'],
      InvalidStrike: ['strike', 'Enter the strike as a number below 100,000.'],
      StrikeNotPositive: ['strike', 'The strike must be greater than zero.'],
      StrikeTooPrecise: ['strike', 'Enter the strike with at most 3 decimal places.'],
      InvalidExpiration: ['expiration', 'Enter an expiration date in the years 2000 to 2099.'],
      RootTooLong: ['symbol', 'Options can be recorded only on symbols of up to 6 characters, not counting a “.”.'],
      MissingInstrument: ['symbol', 'Enter the Underlying symbol, such as XYZ or BRK.B.'],
      InvalidRight: ['right', 'The type must be Call or Put.'],
      ExerciseIntentRequired: ['exerciseIntent', 'Say whether you plan to exercise this option if it is in the money.'],
      ExerciseIntentNotApplicable: ['exerciseIntent', 'Only a long option takes an exercise intent.'],
      ConditionCountNotOne: ['stop', 'An option Plan takes one Stop and one Target.'],
    };
    for (const [code, [field, message]] of Object.entries(expected)) {
      expect(describeOption(code)).toMatchObject({ field, message, code });
    }
  });
});

describe('plan issues', () => {
  it('should word the invalid price issue with an article that fits each price label', () => {
    expect(messages(['entry'])).toEqual(['Enter an intended entry price greater than zero, with at most 6 decimal places.']);
    expect(messages(['stop'])).toEqual(['Enter a Stop price greater than zero, with at most 6 decimal places.']);
    expect(messages(['target'])).toEqual(['Enter a Target price greater than zero, with at most 6 decimal places.']);
  });
});
