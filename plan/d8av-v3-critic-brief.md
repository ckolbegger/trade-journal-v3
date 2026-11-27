# D8aV V3 — Daily Review: prototype-based critic brief

Independent read-only browser critic. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only (`http://localhost:5182`). Authority: `plan/vertical-deliverable-plan.md` D0/P1–P5, `specs/reference/ui-screenshots/index.md`, `plan/d8av-task-breakdown.md` V3. Visual reference: `prototypes/review-coach-mockup/index.html`.

## Exclusions
Nav labels, scenario bar, Phone toggle, "Coach numbers" and "15 suggestions" are mockup chrome — not product content. No LLM/coach judgement, prediction or theoretical pricing. P1: an exact Mark or acknowledgment is required before Action Save. P2: `Complete, settlement to record` is a disclosure of Incomplete. P5: deferred Close Review is due Debt at the next Review. The Closed-detail Close Review form was retained because it still has D7 callers; the Review overlay is the prototype path.

## What changed
`src/ui/review-view.tsx` replaces the flat Review section with: a day card (date, trade/Mark/Action summary, three-step stepper plus the four family chips, P2 completion chip due summary, due-Debt answers); a consolidated Marks card/table with dashed inputs, Save Marks, Can't get a price and Discard; a "Trades · most pressing first" group of trade cards with header grid and SVG meter, last-decision line, P1 locked gate with Enter it, a two-column planNow panel with a larger SVG meter, a replay strip with Replay, mark fields, Action choices with conviction, and a last-decisions trail; a "Closed · Close Review" group with a Plan vs What happened table and Write/Decline controls. Full-page overlays reuse existing reads and commands: Replay renders `ReplayView`, Close Review renders the D1 disposition form.

## Flows
1. **Day card and marks.** Onboard Schwab/Main, confirm a stock Long plan and record one opening execution, then open Review. Compare the day card and Marks card to the prototype: stepper states, next action, summary, P2 chip where applicable, and the table with instrument/previous/today/change, dashed inputs and Save/Discard/no-price controls. Verify an acknowledgement and an exact Mark behave differently and only the existing command writes.
2. **Trade cards and planNow.** Confirm cards are ordered most pressing first, each has a header grid with P&L/change/meter/todo, a planNow two-column panel with Stop/Target meter and explicit gaps, a replay strip, and the Action area with conviction and a last-decisions trail. Check the P1 locked box with Enter it while the Mark is Missing.
3. **Overlay and read-only.** Click Replay on a trade card; confirm the full-page overlay with a replay view and Back to the Review, and that no `trade`/`journal`/`market` count changes on open, seek or close. Close it and reopen; still no writes.
4. **Closed group and Close Review overlay.** Close a trade through the production UI, return to Review, open the Closed group, verify the Plan vs What happened table, then open the Close Review overlay and save a Complete outcome. Confirm the overlay closes, the Review stays mounted, and the stored outcome agrees with the Closed detail. Also check the deferred Debt path if reachable.
5. **Narrow width.** At 480px confirm one column, no horizontal page overflow, and readable controls on the day card, Marks table, trade cards and Closed group.

For each flow: actions, observed evidence, PASS/FAIL. Any FAIL needs repro, expected vs actual, screenshot. Distinguish exclusions from unexplained divergences. Report exact browser/OS versions. Close browser and stop the server. Edit nothing.
