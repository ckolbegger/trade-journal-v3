// P96. Finished display values only (A216). One group per heading: Plan, Plan Baseline with 1R and the original
// reward once, Entry Quality, and the entry ("Not entered" on a Planned Detail).
export interface PlanRiskDrawerProps {
  readonly groups: readonly {
    readonly heading: string;
    readonly rows: readonly { readonly label: string; readonly value: string }[];
  }[];
}
