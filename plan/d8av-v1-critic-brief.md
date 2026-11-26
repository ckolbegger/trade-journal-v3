# D8aV V1 — Trade Detail cockpit: prototype-based critic brief

Independent critic for the first D8aV task. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and frozen plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## Reference and authority
Visual reference: `prototypes/trade-detail/index.html`, **C. Cockpit** variant (tab `C` in the prototype bar). Use it literally for layout, mechanism and density. Authority rules: `plan/vertical-deliverable-plan.md` D0/P1–P5 and `specs/reference/ui-screenshots/index.md`. Do **not** require prototype adherence numbers, a composite score/grade, "Close position", Insights, stock multiplier arithmetic or nav labels — those are non-authoritative. P4 requires the prototype's card hierarchy, density and figure placement.

## What changed
`src/ui/complete-detail-view.tsx` now renders the cockpit: full-width integrity banner when findings exist, a sticky 320px "State of play" rail with Identity (badges + Integrity), P&L with the six canonical descriptive figures, Conditions (Stop/Target pills and price tracks) and Needs you chips; a right column with a six-tab `role="tablist"` (Today, Position, Plan and Risk, Price History, Journal, Payoff) and one tabpanel. Today has a previous/Today/Change comparison table and two price tracks; Position has lots and executions; Price History has a session table; Journal has a newest-first session rail and the mark-only slider; Payoff has an intrinsic SVG curve. `src/ui/detail-visual.ts` holds presentation-only helpers; flat sections were deleted.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Cockpit vs prototype at desktop.** Onboard, confirm a Long Call `AAPL 190Call 2026-12-18`, open Complete detail. Compare the live screen to prototype C: two columns, sticky rail with four cards, badge set, P&L figure and six figures, Conditions with Stop/Target pills and tracks, Needs you chips; right column tablist with counts, one active tabpanel. Report exact observed structure and concrete differences.
2. **Drawer mechanisms.** Cycle all six tabs. Verify Today shows a comparison table with Previous/Today/Change and two price tracks; Position shows lots, executions and net figures; Plan and Risk shows Plan/entry groups; Price History shows Earlier Marks as a table; Journal shows a horizontal session rail with `‹`/`›` controls and explicit gaps; Payoff shows an SVG with break-even 193 and extrema. Report what is missing or fabricated.
3. **Integrity and read-only.** With a findings case if reachable, or by reporting not-covered, check the full-width banner. On the healthy case verify trade/journal/market store counts are unchanged across tab changes, rail scrolling and slider seeks; no global banner; no "adherence", "composite" or "grade" text.
4. **Narrow width and figures.** At 480px, confirm the cockpit collapses to one column, the rail stays readable, tracks/tables do not clip, and all six canonical figure labels remain visible. Confirm no two-character truncation in adjacent trade rows.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Distinguish unexplained divergence from a logged non-authoritative exclusion. Report exact browser/OS versions. Edit nothing.
