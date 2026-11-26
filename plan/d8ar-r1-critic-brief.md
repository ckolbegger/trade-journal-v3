# D8aR R1 — stored-Trade read assembly: focused critic brief

Independent critic for the first D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files are read-only. DEV-001: loopback `http://localhost:5182` only, never label it production HTTPS.

## What changed
`src/ui/trade-read.ts` is now the single canonical stored-to-displayed Trade read (`normalizeStoredTrade`, `readStoredTrade`, `readPlannedTrades`, `plannedResultFrom`, `readCloseReasonLabels`). The three old normalisers were deleted: `detail-controller.ts` and `plan-controller.ts` are thin adapters, the invented `agreement` in `option-controller.ts` comes from the canonical read, and `App.tsx` no longer joins the catalog store itself. No trader-visible capability was added; all D1–D8a results must be unchanged.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Planned Trade still appears after Confirm.** Fresh context: create an Institution and Account, confirm a valid Long Stock plan (`AAPL`, qty 10, entry 100, stop 95, target 110, thesis, invalidation). The planned Trade must appear in the **Planned trades** region with the correct `1R` and the saved Thesis/Invalidation when its detail is opened. No global error banner.
2. **Option plan confirmation still works.** Confirm a complete Long Call (`seed-long-call`, strike/expiration/multiplier, thesis, invalidation). The planned Trade must appear with the exact contract line and `1R`; no banner; no alert.
3. **Open and close remain byte-equivalent.** Open each planned Trade with a matching execution, then close it with the seeded reason and a Complete reflection. Receipts, lifecycle index movement, Closed detail and Journal narrative must look exactly as before (no fabricated-looking fields, no duplicate rows).
4. **Complete detail and replay still work.** Open a Complete/Closed detail, step the replay slider, confirm the descriptive sections render and no Trade or Journal fact is written by navigation.
5. **Reads are read-only and defaults are canonical.** In IndexedDB before/after a planned/open/closed detail visit, the `trade`, `journal` and `catalog` stores must be unchanged. Close Reason labels in the close form must come from the seeded catalog.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
