import { isJournalCounterBinding } from '../../modules/journal/index.ts';

// Up to 3 attempts in all, as Journal.save makes (A175, ADR 0011).
const MAX_ATTEMPTS = 3;

// Repeats a whole workflow attempt (reads, preparation, commit) while its only Conflict is Journal's
// counter; a Conflict on any other binding, or after the last attempt, is returned as it came.
export async function retryCounterConflict<R extends { readonly kind: string }>(attempt: () => Promise<R>): Promise<R> {
  for (let n = 1; ; n++) {
    const result = await attempt();
    const changed = (result as { changed?: readonly string[] }).changed;
    const counterOnly = result.kind === 'Conflict' && changed?.length === 1 && isJournalCounterBinding(changed[0]!);
    if (!counterOnly || n >= MAX_ATTEMPTS) return result;
  }
}
