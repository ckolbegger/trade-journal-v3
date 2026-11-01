import type { CardProgress } from '../../src/app/types.ts';

// A walked card's progress for UI fixtures (D5R2 section 6.3), in the shape of the expected-progress table:
// the Marks resolved and needed, the given reflections, and the Action owed.
export function cardProgress(dueNow = 0, later = 0, over: { readonly needed?: number; readonly resolved?: number; readonly owed?: boolean } = {}): CardProgress {
  const { needed = 0, owed = true } = over;
  const { resolved = 1 - needed } = over;
  const panels: CardProgress['panels'] = [
    { panel: 'Marks', done: needed === 0, resolved, needed },
    { panel: 'Reflections', done: dueNow === 0, dueNow, later },
    { panel: 'Action', done: !owed, owed },
  ];
  return { kind: 'Walked', panels, done: panels.every((panel) => panel.done) };
}
