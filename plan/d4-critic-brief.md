# D4 browser-critic brief

Independent critic for Deliverable 4 (Daily Review Phase I — current pricing, Marks and ongoing Risk/Reward). Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, `plan/vertical-deliverable-plan.md` (D4), `plan/d4-task-breakdown.md`, `specs/design/market-data.md`, `specs/design/trade-analysis.md` (`evaluate`), `specs/acceptance/acceptance-contract.md`, `specs/glossary.md` (market observations and valuation), `plan/deviations.md` (DEV-001). Local loopback is valid evidence; never relabel it production HTTPS.

## Installed capabilities in D4
D1–D3 plus: Manual Mark entry (initial, deliberate override, reasoned correction) and Unavailable Mark Acknowledgment with withdrawal; exact Expected Mark Date resolution, Stale context and explicit gaps; `TradeAnalysis.evaluate` returning independent `Value`/`Unbounded`/`Unavailable`/`NotApplicable` calculations, Stop/Target condition cards and disclosed Overrun; evaluated Open list/detail. No provider recovery/configuration, no replay, no Daily Review ritual, no Mark correction, no close control, no Report/Backup/Restore.

## Start
From the worktree root, run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`: `open`, `snapshot` for refs, then `click`/`fill`/`check`/`eval`/`resize`/`reload`. Close browser and stop server when done.

## Fixture
Fresh browser context. Create one Institution and Account through the UI. Confirm a Long Stock Plan AAPL (qty 10, entry 100, stop 95, target 110, Thesis/Invalidation). Record one opening Execution (10 @ 100 fee 5, instrument AAPL, economic time `2026-11-23T20:00:00Z`), defer reflection, and open the resulting Open trade detail. The app's explicit View Moment resolves `2026-11-23` as the Expected Mark Date.

## Flows
1. **Before a Mark.** Expected Mark Date shows `2026-11-23` and status `Missing`. Realized-to-date is a `Value` `0.00`; 1R remains `50.00`; mark-dependent figures (Marked P&L, ongoing risk, reward, Overrun) are visibly `Unavailable` naming `AAPL` and `2026-11-23`. No fill cost or zero is substituted, and no close control exists.
2. **Record a Manual Mark.** Enter price `105.00` and click Record mark. Status becomes `Available`; Marked P&L `45.00`, ongoing risk `100.00`, incremental reward `50.00`, 1R still `50.00`; Stop `Unbreached` and Target `Unreached` are independent condition cards. Confirm the values are right-aligned tabular numerals.
3. **Acknowledgment is not a price.** On a fresh Open trade, acknowledge unavailability with a reason. Status becomes `Acknowledged Unavailable`, Marked P&L stays `Unavailable` with a stable reason, and IndexedDB `market` shows an acknowledgment with no price and no Mark version. Later recording an exact Mark makes status `Available` while the acknowledgment remains in history.
4. **Overrun and capability honesty.** With a Mark of `90.00`, ongoing risk is `0.00`, Overrun `50.00`, Stop `Crossed` — with no lifecycle change, close control, Deviation, Review, Report, Backup, Restore or provider configuration control anywhere. No fake Unavailable placeholder for an undelivered capability.
5. **Durability and Stale context.** Reload and confirm the Mark, its revision history, the evaluation figures and the reflection outcome persist and match the display. If an older Mark exists, it appears only as labelled Stale context, never as a value.
6. **Responsive and evidence capture.** At 1200px and 480px the layout switches live without reload; entered-but-unsaved Mark price and reason survive the resize. Validation of an invalid price is visible, non-colour-only, and writes nothing. Report exact browser/OS versions.

For each flow: actions, observed result, PASS/FAIL; failures need repro, expected vs actual and a screenshot. Missing future capabilities are not defects; anything in these flows that fails is. Close browser, stop server, edit nothing.
