# D8aV V2 — Replay visualization: prototype-based critic brief

Independent read-only browser critic. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only (`http://localhost:5182`). Authority: `plan/vertical-deliverable-plan.md` D0/P1–P5, `specs/reference/ui-screenshots/index.md`, and `plan/d8av-task-breakdown.md` V2. Visual reference: `prototypes/replay/round-2.html`, **1. Corridor** variant only.

## Exclusions
Advisory IV/share-equivalent are estimates only (P3): no prediction, coaching, theoretical price, or feedback into valuation, P&L, Stop/Target, payoff, Daily Review or reports. The prototype's generator-inputs table, story fold and other five visualization tabs are demonstration scaffolding / out of scope. No composite score or provider candle.

## What changed
Replay is now its own view, reached from Complete detail → Journal → **Open replay**. `src/ui/replay-view.tsx` renders a sticky control bar (Price action segmented control, ‹/› step buttons, range slider, `date · n of N` label, six visualization tabs with only Corridor enabled), a two-column layout with a Corridor SVG chart between Stop and Target rails (gap bands, observed Mark dots, click-to-seek cursor), a result-coloured status strip, a move line with a named underlying/time/volatility split bar, IV and share-equivalent chips with popover sparklines (all labelled Estimate), a legend/plan line, a sticky readout with kv groups, and an every-session table with a Plan row and explicit `—` gaps. The bare slider and plain advisory text were deleted from the cockpit; `src/ui/detail-controller.ts` exposes per-session advisory estimates read-only.

## Flows
1. **Prototype composition.** Open a Long Call `AAPL 190Call 2026-12-18`, record an opening execution, seed at least two observed Mark sessions plus a gap (you may write Marks through the production Review UI or seed the `market` store read-only via page evaluation). Open Complete detail → Journal → Open replay. Compare the live layout to the Corridor prototype at 1280px: control bar, sticky readout, hero chart, status strip, chips, split bar, session table. Report exact structure and concrete differences.
2. **Chart and seek.** Confirm two rails, gap bands, one dot per observed Mark, no dot on a gap, and a cursor at the selected session. Click the chart at a different x and confirm the session label changes. Confirm the slider and ‹/› also seek. No interpolation or OHLC/number input.
3. **Advisory and read-only.** Open each chip popover; confirm a sparkline, `Estimate` label, and the disclaimer that these figures never feed results. Check readout groups and that no result figure is sourced from the advisory. Record `trade`/`journal`/`market` counts before and after seek/tab/popover/back navigation — they must be unchanged.
4. **Session table and narrow width.** Confirm the Plan row, one row per session, `—` for gaps, and no fabricated numbers. At 480px confirm one column, no horizontal page overflow, and that the readout remains readable.

For each flow: actions, observed evidence, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Distinguish unexplained divergences from logged exclusions. Report exact browser/OS versions. Close browser and stop the server. Edit nothing.
