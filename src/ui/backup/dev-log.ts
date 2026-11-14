// A developer log line for an unexpected failure (T8.13-B2). Never pass journal contents.
// Local copy of the shape T8.4-F2 adds as FailureDetail in coordinators/workspace/backup-types.ts; swap for that type when the lanes merge.
export interface FailureDetail {
  readonly stage: string;
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, string | number | boolean>>;
}

export function logFailure(detail: FailureDetail): void {
  console.error('[Trade Journal]', detail);
}
