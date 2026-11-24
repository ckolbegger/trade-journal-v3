// One closed Calculation Result vocabulary. Each independently useful
// calculation gets its own result; absence is never a nullable number or zero.
export type CalculationResult<T> =
  | { kind: 'Value'; value: T }
  | { kind: 'Unbounded'; direction: 'Above' | 'Below'; explanation: string }
  | { kind: 'Unavailable'; reason: string; details: { instrument: string; date: string } }
  | { kind: 'NotApplicable'; reason: string; details?: Record<string, unknown> }

export function value<T>(result: T): CalculationResult<T> {
  return { kind: 'Value', value: result }
}

export function unavailable(reason: string, instrument: string, date: string): CalculationResult<never> {
  return { kind: 'Unavailable', reason, details: { instrument, date } }
}
