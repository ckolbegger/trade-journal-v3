// P96. Finished display values only (A216). One group per heading: Plan, Plan Baseline with 1R and the original
// reward once, and Entry Quality (its figures once resolved, and its progress note before, "0 of 100 entered" on a
// Planned Detail). Reshaped from T8P.3's `{ heading, rows }` so the moved sections keep their markup and words.
export interface PlanRiskRow {
  readonly label: string;
  // One string, or one line per condition in Plan order (a Stop or Target with several conditions).
  readonly value: string | readonly string[];
  // A text value, not a figure: no `number` class.
  readonly plain?: boolean;
  // The R multiple or planned comparison on its own muted line below the amount.
  readonly second?: string;
}

export interface PlanRiskGroup {
  // The heading's id stem ("plan" gives `plan-heading`).
  readonly id: string;
  readonly heading: string;
  readonly rows: readonly PlanRiskRow[];
  // A sentence standing where the rows would be.
  readonly note?: string;
}

export interface PlanRiskDrawerProps {
  readonly groups: readonly PlanRiskGroup[];
}
