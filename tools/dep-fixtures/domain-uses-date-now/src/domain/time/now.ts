// Violation fixture: pure domain code reading the wall clock.
export const now = (): number => Date.now();
