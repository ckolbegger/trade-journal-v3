# D5 browser-critic brief

Independent critic for Deliverable 5 (Daily Review Phase II — journaling and Action recording). Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md` (D5), `plan/d5-task-breakdown.md`, `specs/design/daily-review.md`, `specs/design/journal.md`, `specs/acceptance/acceptance-contract.md` (AC-REV-001..007, AC-JOUR-001), `plan/deviations.md` (DEV-001). Loopback evidence only; never relabel it production HTTPS.

## Installed capabilities in D5
D1–D4 plus: `DailyReview.open`/`getTrade`/`getDebt`/`save`, a Review navigation entry, exact-date corrected eligibility (current Open state in D5), attention-ranked task families in order (Marks → Debt → Settlement → Trades), one-click Hold with P1 Mark gate, Intent required for Exit/Roll/Adjust, dated Daily Trade Review Action Entries, Journal Debt resolution, Stop-Discipline episode reconciliation with stable fingerprints, and derived completion states. No provider recovery/configuration, replay visuals, Daily Bars, corrections, report, backup, restore or close control.

## Start
From the worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`: `open`, `snapshot` for refs, then `click`/`fill`/`check`/`eval`/`resize`/`reload`. Close browser and stop server when done.

## Fixture
Fresh browser context. Create one Institution and Account. Confirm a Long Stock Plan AAPL (10 @ 100, stop 95, target 110, Thesis/Invalidation). Record one opening Execution (10 @ 100 fee 5, instrument AAPL, economic time `2026-11-23T20:00:00Z`), defer reflection. Click **Review**; the app's explicit View Moment resolves `2026-11-23` as the Review Date. Use fresh Open trades (different underlyings) for independent flows because Marks are sticky per Instrument+date.

## Flows
1. **Day card and order.** Review shows date `2026-11-23`, an Incomplete state and step chips Marks, Debt, Settlement, Trades in that order. Due reflection Debt appears; the Trade walk card shows attention band and reasons. No Review Session, finish flag or placeholder exists in IndexedDB.
2. **P1 gate and acknowledgment.** With no exact Mark, the Action Save button is disabled and a visible MarkMissing gate is shown; saving writes nothing. Acknowledge unavailability with a reason: status becomes Acknowledged Unavailable, Entry Save is enabled, the saved Action creates exactly one dated Entry with Source Daily Review and origin (Trade, Review Date), and the day card eventually shows `Complete with unavailable Marks` once due Debt is resolved. Calculations remain Unavailable, not Values.
3. **Atomic episode and Action.** On a fresh Trade, record a Mark of `90.00` in Review; a Stop episode beginning `2026-11-23` is shown. Save the Action: IndexedDB has exactly one DailyReview Entry and one Stop-Discipline deviation fingerprint on the Trade, committed together. No close control, lifecycle change or Deviation category other than Stop Discipline appears.
4. **Stale evidence conflict.** Open a Review for a fresh Trade, change its Mark in another surface (Trades detail), then return and Save. The Save is rejected as changed evidence with no Action or deviation write; refreshed evidence is shown.
5. **No-write-on-leave, resumption and responsive.** Select Exit, type an Intent, resize 1200↔480 without reload — values survive. Navigate away and reopen: no Entry was written, form resets to Hold. A previously saved Action resumes from facts, not a stored session. Validation of a blank Intent is visible and non-colour-only.
6. **Capability honesty and durability.** Navigation is Accounts, Status, New Plan, Trades, Review. No provider configuration/recovery, report, backup, restore, close or fake Unavailable placeholder. Reload and reopen Review: Marks, Actions, Debt outcomes, episodes and completion match durable state. Report exact browser/OS versions.

For each flow: actions, observed result, PASS/FAIL; failures need repro, expected vs actual and a screenshot. Missing future capabilities are not defects; anything in these flows that fails is. Close browser, stop server, edit nothing.
