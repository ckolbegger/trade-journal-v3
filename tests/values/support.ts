import type { ValueResult } from "../../src/values";

/** Unwrap a successful value-layer result, failing the test on an unexpected typed error. */
export function value<T>(result: ValueResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, received ${result.error.kind}`);
  }
  return result.value;
}
