import type { CardProgress, OpenDailyReviewResult } from '../../src/app/types.ts';

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type Need = NonNullable<Ready['day']>['lines'][number]['needs'][number];

const panelOf = <P extends CardProgress['panels'][number]['panel']>(progress: CardProgress, panel: P) => progress.panels.find((p): p is Extract<CardProgress['panels'][number], { panel: P }> => p.panel === panel);

// The day summary a Review as UI fixtures hold it would carry, worked from the cards' progress the way the coordinator works it from the facts
// (A300): the same counts and lines, no change and no skipped session. A fixture that needs more gives its own `day`.
export function dayOf(review: Pick<Ready, 'families' | 'owed'>): NonNullable<Ready['day']> {
  const walked = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  const marks = review.families.flatMap((f) => (f.family === 'Marks' ? f.today : [])).filter((row) => row.task === 'Manual').length;
  const settling = new Set(walked.filter((t) => panelOf(t.progress, 'Settlement')?.done === false).map((t) => t.tradeId));
  const needsOf = (progress: CardProgress, tradeId: string): Need[] =>
    progress.panels.flatMap((panel): Need[] => {
      if (panel.panel === 'Marks') return panel.done ? [] : ['Marks'];
      if (panel.panel === 'Reflections') return panel.done ? [] : ['Reflection'];
      if (panel.panel === 'Settlement') return panel.done ? [] : ['Settlement'];
      return panel.done || settling.has(tradeId) ? [] : ['Action'];
    });
  const reflections = [...walked, ...review.owed].reduce((sum, t) => sum + (panelOf(t.progress, 'Reflections')?.dueNow ?? 0), 0);
  return {
    trades: walked.length,
    toGo: { marks, actions: walked.filter((t) => panelOf(t.progress, 'Action')?.owed === true && !settling.has(t.tradeId)).length, expirations: settling.size, closeReviews: 0, reflections },
    change: { kind: 'Unavailable' },
    missed: [],
    lines: [
      ...walked.map((t) => ({ tradeId: t.tradeId, marks: panelOf(t.progress, 'Marks')?.needed ?? 0, closeReview: false, needs: needsOf(t.progress, t.tradeId) })),
      ...review.owed.filter((t) => !t.progress.done).map((t) => ({ tradeId: t.tradeId, marks: 0, closeReview: false, needs: ['Reflection' as const] })),
    ],
  };
}
