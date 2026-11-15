// A developer log line for an unexpected failure (T8.13-B2). Never pass journal contents.
import type { FailureDetail } from '../../app/types.ts';

export function logFailure(detail: FailureDetail): void {
  console.error('[Trade Journal]', detail);
}
