import type { OpenDailyReviewResult } from '../../app/types.ts';

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// One Trade's line of the day summary.
export type DayLine = NonNullable<Ready['day']>['lines'][number];

const NEED_TEXT = { Marks: (marks: number) => (marks > 1 ? `${marks} Marks` : 'Mark'), Reflection: (_: number, closeReview: boolean) => (closeReview ? 'Close Review' : 'Reflection'), SayWhy: () => 'Say why', Settlement: () => 'Settle', Action: () => 'Action' } as const;

// What a Trade still needs, in the order its card works through it, or what it is done with (W101). The day card's line and the card's header say it the same way.
export const todoText = (line: DayLine): string => {
  if (line.needs.length > 0) return `To do: ${line.needs.map((need) => NEED_TEXT[need](line.marks, line.closeReview)).join(', ')}`;
  return line.action ? `Done · ${line.action}` : 'Done';
};
