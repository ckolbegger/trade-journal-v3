# D8aR R2 — Complete Trade Detail Expiration Payoff: focused critic brief

Independent critic for the second D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never label it production HTTPS.

## What changed
`src/domain/complete-detail.ts` now owns one payoff seam, `payoffForPlan`, fed by the frozen Planned Leg; `buildCompleteTradeDetail` uses it instead of the old hardcoded `NotApplicable: StockOnly`. `App.tsx` no longer computes payoff in the UI — its standalone panel uses the same seam. `complete-detail-view.tsx` renders the domain result including break-even and extrema. Stock-only Trades remain `NotApplicable: StockOnly`. No theoretical price, IV or advisory value feeds payoff.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Option payoff appears in both places.** Fresh context: create Institution and Account, confirm a complete Long Call (AAPL, qty 2, entry 3.00, stop 1.00, target 7.00, strike 190, expiration 2026-12-18, multiplier 100, thesis, invalidation). Open its planned Trade: the standalone payoff panel must show a contract and a break-even. Open Complete detail: `detail-payoff` must read `Available` and its break-even must equal the panel's. No global banner or alert.
2. **Stock-only stays NotApplicable.** Confirm a Long Stock plan, open planned Trade and Complete detail: `detail-payoff` must read `NotApplicable: StockOnly`, with no fabricated curve.
3. **No model price or advisory leakage.** In the option Complete detail, inspect the rendered payoff and advisory sections: break-even/extrema come only from intrinsic terms; any IV or Share Equivalent figure must remain explicitly labelled as an estimate and must not appear as payoff. Search the DOM for `theoretical` and report absence.
4. **Read-only navigation.** Opening Complete detail and stepping the replay slider must not change the `trade` or `journal` store counts in IndexedDB. Reload and confirm the same payoff.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
