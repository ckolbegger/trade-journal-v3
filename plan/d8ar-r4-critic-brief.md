# D8aR R4 — Position Change commit: focused critic brief

Independent critic for the fourth D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
`src/ui/position-change-commit.ts` is now the single commit seam: readiness gate, one atomic IndexedDB transaction for Trade + Journal outcome + lifecycle index, for both Open and Closed. `position-controller.ts`, `close-controller.ts` and `option-controller.ts` are thin fact adapters that only prepare candidates; their duplicated guard/transaction/index blocks were deleted. The option path now derives agreement and Terminal Disposition from effective Execution facts instead of fabricating `agreement`. UI `as unknown as Stored*` casts and the duplicated `Account` type are gone.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Stock open/close through one commit.** Fresh context: Institution, Account, Long Stock plan AAPL 10 @ 100 (stop 95, target 110). Open with one execution; confirm Open lifecycle, 1 open lot and the reflection outcome. Close with AAPL 10 @ 110, seeded reason `Target Reached`, Complete reflection; confirm Closed lifecycle, P&L and exactly one narrative row. Check IndexedDB `lifecycle-index` membership: Planned [] / Open [] / Closed [stock trade].
2. **Option open/close through the same commit.** Confirm a Long Call AAPL 190Call 2026-12-18 x100, 2 @ 3.00; open with the exact instrument, close 2 @ 5.00 with `Target Reached`. Confirm the stored Trade has a derived `terminalDisposition` of `FullyDisposedByExecution` and a non-fabricated `agreement` with empty `findings`. Confirm lifecycle index membership and no duplicate journal rows.
3. **Stale revision and non-Writable readiness still reject with no writes.** Open a detail, note its revision, attempt an open/close with a stale expected revision (use a second tab or page reload to create the stale state). Confirm a local alert appears and store digests are unchanged. Do not fabricate a Runtime Readiness failure if the app cannot produce one; report as not-covered instead.
4. **Reload durability and no UI casts in behaviour.** Reload after both closes; details, P&L and narratives must be unchanged. No global error banner at any point.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
