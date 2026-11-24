# D2 browser-critic brief

Independent critic for Deliverable 2 (Plan only — Long Stock). Do NOT modify implementation code. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md`, `plan/d2-task-breakdown.md`, `plan/deviations.md` (DEV-001).

## Installed capabilities in D2
Everything from D1 plus: confirm a Long Stock Plan; Plan Assessment with live 1R/baseline; Plan Reflection; Planned Trade list and detail. No Execution, Mark, close, Review, report, backup or Restore.

## Start
`npm run dev`, port from `.env.local` (5182). Use `playwright-cli` against `http://localhost:5182`.

## Flows
1. New Plan form offers only the Long Stock Strategy; as the trader enters entry/stop/target/quantity, the live 1R and Plan R:R preview update (e.g. 10 shares, 100/95/110 → 1R 50.00, R:R 2.00).
2. Plan Reflection requires Thesis and Invalidation; submitting without them shows a typed inline error and writes nothing.
3. Confirming a valid Plan creates a Planned Trade visible in the Trades list; opening its detail shows Lifecycle Planned, frozen 1R/baseline and the reflection, with no Execution, Mark or close controls.
4. Capability honesty: navigation includes New Plan and Trades but no Execution, Mark, Review, Report, Backup or Restore control and no fake Unavailable placeholders.
5. Responsive: wide/narrow arrangements switch on live resize without reload; entered-but-unsaved form values are preserved.

For each flow: actions performed, observed result, PASS/FAIL; failures need repro steps, expected vs actual, screenshot. Do not treat missing future capabilities as defects. Close browser, stop server, edit nothing.
