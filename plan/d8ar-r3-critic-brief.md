# D8aR R3 — advisory frame adapter: focused critic brief

Independent critic for the third D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
`src/domain/advisory-frames.ts` now owns exact contract resolution, the underlying-Mark join, days-to-expiration, side and the advisory result assembly. `detail-controller.ts` is a thin adapter that only resolves stored data and calls `buildAdvisory`. The capability flag is still checked at the app shell. Advisory values remain labels/estimates only — never valuation, P&L, risk, Stop/Target, payoff, Daily Review or reports.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Repair fixture still resolves the frozen Strategy id.** Seed the D8a repaired fixture (option plan with `strategyId` inside the Plan, exact contract, two underlying Marks and two option Marks). Open Complete detail. Advisory IV must be `1.9519`, Share Equivalent `34`, decomposition `60.03 / -126.32 / 226.29` as in D8a. No global banner, no alert.
2. **Both strategy-id placements agree.** With `strategyId` at the Trade top level instead of inside the Plan, the same advisory figures must appear. Report exact text.
3. **Capability off stays off.** With advisory capability absent (as in the stock-only path), no advisory section/values render, and the canonical detail fields (identity, figures, payoff, journal, timeline) are byte-identical to the capability-on case.
4. **No advisory leakage or writes.** Inspect the DOM: any IV / Share Equivalent / decomposition text must be labelled an estimate and must not appear in payoff, Stop/Target or risk figures. Compare `trade` and `journal` store digests before and after detail navigation — unchanged.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
