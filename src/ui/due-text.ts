import type { DueClassification } from '../app/types.ts';

// The wording of a Reflection's due status, shared by the Review's reflections panel and Trade Detail's Debt.
export const DUE_TEXT: Record<DueClassification, string> = {
  Due: 'Due',
  DueInNextReview: 'Due in the next Review',
  DueInReviewAfterNext: 'Due in the Review after next',
};
