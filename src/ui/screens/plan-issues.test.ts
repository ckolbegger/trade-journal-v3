import { describe, expect, it } from 'vitest';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import { describeIssues, type PriceField } from './plan-issues.ts';

const definition = { prompts: [] } as unknown as EntryDefinitionRecord;
const invalidPrice = [{ source: 'TradeAnalysis', code: 'InvalidPrice' }];
const messages = (failing: PriceField[]) => describeIssues(invalidPrice, definition, failing).map((i) => i.message);

describe('plan issues', () => {
  it('should word the invalid price issue with an article that fits each price label', () => {
    expect(messages(['entry'])).toEqual(['Enter an intended entry price greater than zero, with at most 6 decimal places.']);
    expect(messages(['stop'])).toEqual(['Enter a Stop price greater than zero, with at most 6 decimal places.']);
    expect(messages(['target'])).toEqual(['Enter a Target price greater than zero, with at most 6 decimal places.']);
  });
});
