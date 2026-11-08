import type { EntryDefinitionRecord } from '../../app/types.ts';
import type { Rational } from '../../domain/values/index.ts';
import { isExpirationMustSettleAllOpenIssue, isSettlementTimeInvalidIssue } from '../calculation-words.ts';
import { quantity } from '../format.ts';
import { plural } from './ReviewCard.tsx';
import { describePositionChangeIssues } from './position-change-issues.ts';
import type { FieldIssue, Issue } from './plan-issues.ts';

type ExpirationIssue = Issue & { readonly member?: number; readonly available?: Rational };

// The one field the Expiration's own issues attach to: the form has no entered values to point at.
export const EXPIRATION_FIELD = 'expiration';

// Messages for a rejected Expiration (rows 21.8 to 21.10); the reflection's own issues keep their words.
export function describeExpirationIssues(issues: readonly ExpirationIssue[], definition: EntryDefinitionRecord, closeDefinition: EntryDefinitionRecord): FieldIssue[] {
  return issues.flatMap((issue): FieldIssue[] => {
    if (isExpirationMustSettleAllOpenIssue(issue)) {
      const open = issue.available ? plural(Number(quantity(issue.available)), 'contract', 'contracts') : 'contracts';
      return [{ field: EXPIRATION_FIELD, code: issue.code, message: `The expiration must cover all ${open} in the position. Load the latest Trade and try again.` }];
    }
    if (isSettlementTimeInvalidIssue(issue)) {
      return [{ field: EXPIRATION_FIELD, code: issue.code, message: 'The settlement time must be on or before the expiration date and after every Execution on the contract.' }];
    }
    if (issue.code === 'EconomicTimeInFuture') return [{ field: EXPIRATION_FIELD, code: issue.code, message: 'The settlement time cannot be in the future.' }];
    return describePositionChangeIssues([issue], [], definition, closeDefinition);
  });
}
