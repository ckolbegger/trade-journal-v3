# D8 display-repair focused critic brief

Independent focused critic for two non-blocking observations from the D8 repeat browser pass. Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/d8-critic-brief.md` (full D8 baseline and fixtures), `plan/freeze.md` rev `c5d28a8a`, DEV-001 (loopback only, never production HTTPS).

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close browser and stop server when done.

## Fixture
Fresh browser context; one Institution and Account. Option inputs: underlying AAPL, qty 2, entry 3.00, stop 1.00, target 7.00, strike 190, expiration 2026-12-18, multiplier 100. Open fill: instrument `AAPL 190Call 2026-12-18 x100`, qty 2, price 3.00, fee 1.00, time `2026-11-24T20:00:00Z`, Defer. Close fill: same instrument, qty 2, price 5.00, fee 1.00, time `2026-11-25T20:00:00Z`, Close Reason Target Reached, Defer.

## Flows
1. **Short opening action is honest.** Confirm a Cash-Secured Put plan, open its Planned detail, click **Add execution**: the read-only Action pill reads `Sell`, not `Buy`. Then record the opening fill: the stored execution still carries `action: Sell`, `opening: true`, and the Open detail net position is `-2`. Switch back to a Long Call plan: its pill reads `Buy`; a stock plan still reads `Buy`.
2. **FIFO Lot Match shows allocated fees.** Open and close the Long Call fixture. Immediately after Record close (before any reload), the Closed detail Lot Matches row shows `opening fee 1.00 · disposal fee 1.00` and the realized P&L remains `398.00`. Inspect the stored `lotMatches` row: it carries `allocatedOpeningFee: "1.00"` and `allocatedDisposalFee: "1.00"` while still carrying no `price` or P&L field. Reload and reopen: the same figures persist.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
