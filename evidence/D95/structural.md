# D9.5 structural evidence

## Reading (session 1, 2026-11-22)

Read in full: the handoff, `plan/kickoff.md`, `.claude/docs/implementing.md`, the breakdown's sections 1, 2, 3, 4, 6, 8, 9, 10, 12, 13 and 14, `plan/implementation-plan.md`'s recorded decisions 1 to 126, the freeze record, "Rules every deliverable follows", the D9.5 definition and tech debt items 1 to 11, and `specs/design/daily-review.md`. The mockup was opened headless at 1280 and 375 wide for all eight days (scenario switched in-page) and its NOTES.md opening read. Each task's brief names the `plan/spec-reading/D09.5.md` ranges and breakdown sections its subagent reads; the main session reads further spec ranges when a brief or decision needs them.

## T95.1 — Tooling: `status.sh D09.5` reads `evidence/D95` (Light)

Light (decision 122): no ocr, no suite run. Commit `34f94054`.
- `.claude/scripts/status.test.sh`: new case 17 (`D99.5` reads `evidence/D995` when `evidence/D99.5` is absent; prefers `evidence/D99.5` when present; no folder still prints "no decisions file"). Red: exit 1, "FAIL: dotted deliverable did not read the evidence folder named by its digits". Green: all 17 cases pass, exit 0.
- `.claude/scripts/status.sh D09.5 --all` prints the breakdown's 67 rows (Wave and Lane "—").
- `tdd.sh` maps `T95.1` to `evidence/D95` (it wrote `evidence/D95/tdd-log/T95.1.md` for a probe run, which the subagent deleted); `full-suite.sh --current-folder evidence/D95` prints `e2e/d95`.
- Subagent note: an early probe edit replaced a comment line in `status.test.sh`; it was restored in the same edit that added case 17.

## T95.2 — Journal: the Actions over a span of Review Dates (Standard)

Commit `5295f5e0`. Adds `queryActionHistory` (`{from, through}` read through `byObligation`, or `{tradeId}` through `byAnchorTrade`), returning `HistoryAction { tradeId, reviewDate, action, reason? }`; `queryActions` unchanged. Cases 2, 3 and 4 were first-run passes, each with a mutation check (assertion failures; recorded in `tdd-log/T95.2.md`). Case 5's branch was written ahead of its case, backed out for a genuine red, then restored.
- Subagent note: R1 needs T95.3 to call `queryActionHistory` from `open`; the existing `queryActions` read there does not meet it.

**ocr** (session 61b228db, gpt-6.1-sol, 4 files, 0 comments): No findings. Raw: `ocr/T95.2-5295f5e0.json`.

**Suite run `t95.2-action-span`** (browser-task; task tier, no `e2e/d95` yet): unit 228 files / 2693 tests pass; integration 141 / 300 pass; browser `@every-task` 5 pass (14.1 s); checks 14 of 14 exit 0. `run-complete.sh`: run complete.

## T95.3 — Daily Review `open`: bands, order and the last Action (Full)

Commit `2f9575d9`. Cases 3, 7, 8 and 9 were first-run passes, each mutation-checked (assertion failures; `tdd-log/T95.3.md`). The one Actions read on `open` is an optional `since` on Journal `queryActions` (same snapshot, adds exactly `journalEntries.getAll: 1`), because `queryActionHistory` costs four requests and replacing `queryActions` would drop R1b's `journalObligations.getAll`. R1 pins changed (+1 `journalEntries.getAll` on `open`): `tests/integration/d7/query-count.test.ts:87`, `d9/query-count.test.ts:27`, `d9ar/query-count.test.ts:21`, `d9r2/query-count.test.ts:18`; R1b and R3 held; `browseTrades` tallies unchanged. X1/S1 expectation changes are listed in the commit (BoundaryReached → StopReached or TargetReached; Blocker → SettlementDue for a due settlement). The screen maps the new bands to the old words until T95.11. Ten integration tests failed on four frozen fixtures' saved views: pending decision Q1, answered (a), decision 127, follow-on T95.3-D1.

**ocr** (session 1d48252c, gpt-6.1-sol, 19 files, 3 comments). Raw: `ocr/T95.3-2f9575d9.json`.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium bug | `daily-review.ts:230` (call 718) | `getTrade`'s card calls `reviewItem(entry)` with no last Action, so a Trade `open` shows as `ExitNotCarriedOut` loses that band on its card | Valid | bug task T95.3-B1 |
| medium bug | `journal.ts:549` | with `since` on or after the Review Date, the clamp to the day before returns that day's Actions instead of none | Valid | bug task T95.3-B2 |
| low test | `order.test.ts:60` | the Target fixture marks 56.50 against a 56.00 Target, so equality at the Target is untested | Valid, test coverage only (no defect) | tech debt |

**T95.3-B1.** Defect: a Trade whose most recent earlier Action is Exit is `ExitNotCarriedOut` on `open` but not on its card (`getTrade`), and the card carries no `lastAction`. Cases: "it should give the card the same ExitNotCarriedOut band and last Action as the overview"; "it should read the Trade's earlier Actions in one `journalEntries` read through `byAnchorTrade`" (R2, brought forward from T95.8, which then builds its decisions on the same read).
*T95.3-B1, first attempt (not committed):* using `queryActionHistory({tradeId})` added `journalDefinitions.getAll`, `journalTypes.getAll` and two `meta.get` beyond R2's one `journalEntries` read (I9.6 and I9AR.4's `CARD` tallies). Main-session decision (implementation level, no plan change): `getTrade`'s existing `queryActions` snapshot gains an optional Trade, adding only the `byAnchorTrade` `journalEntries` read, as T95.3 added `since`; R2 is then met exactly. Redone by a fresh subagent from the saved patch.
*T95.3-B1 done:* commit `91ba3635`. `queryActions` gains an optional `tradeId` (one `byAnchorTrade` `journalEntries` read in the same snapshot, `earlier` = that Trade's Actions before the Review Date); `getTrade` passes its last Action to `reviewItem`. R2 pins changed: `CARD` in `d9/query-count.test.ts` (I9.6) and `d9ar/query-count.test.ts` (I9AR.4) gain `journalEntries.getAll: 1`; `d9/query-count.test.ts:66` now expects exactly that `byAnchorTrade` read. ocr (session 5f7674b6, 6 files, 0 comments): No findings. Raw: `ocr/T95.3-B1-91ba3635.json`.
**T95.3-B2.** Defect: `queryActions` with `since` on or after the Review Date returns the day before's Actions. Case: "it should return no earlier Actions when `since` is on or after the Review Date".
*T95.3-B2 done:* commit `a605bb92`. Without `tradeId`, `earlier` keeps only Actions dated on or after `since`; the read is still made, so no tally changed (all 26 `countRequests` files pass unchanged). ocr (session 2c5717a6, 2 files, 0 comments): No findings. Raw: `ocr/T95.3-B2-a605bb92.json`.

## T95.5 — The Mark slip check (Standard)

Commit `34d79930`. `checkMarkSlip({instrument, entry, lastMark?}, limits = MARK_SLIP_LIMITS)` returns `Pass | NotAPrice | ZeroSharePrice | WorthNothing | Moved{percent} | Scaled{factor, candidate}`; `MARK_SLIP_LIMITS = { stock: {up: 5, down: 5}, option: {up: 100, down: 50} }` (percent, inclusive). Case 3's option band was written ahead of its case, backed out for a genuine red, then restored. Case 8 was a first-run pass, mutation-checked (assertion failure). Subagent assumptions: a missing or zero last Mark passes anything; a zero share price is always refused; a negative entry is `NotAPrice`; 10× is tried before 100×, smaller candidate first.

**ocr** (session 68b69603, gpt-6.1-sol, 3 files, 2 comments). Raw: `ocr/T95.5-34d79930.json`.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium bug | `mark-slip.ts:48` | the band check tests the exact scaled price but the candidate shown is rounded to 6 decimals, so a sub-cent suggestion (0.000115 vs last 0.000011 gives 0.000012) can lie outside the band | Valid | bug task T95.5-B1 |
| medium bug | `mark-slip.ts:23` | `BigInt(limit)` throws `RangeError` for a fractional limit | Valid (latent: today's limits are integers) | bug task T95.5-B2 |

**T95.5-B1.** Case: "it should offer a ten or hundred times reading only when the price it shows lies within the limits".
*T95.5-B1 done:* commit `b92f956c`; the scaled reading is rounded to the shown candidate and that value is tested against the band (red: `expected 'Scaled' to be 'Moved'`, stock 0.000115 vs 0.000011). ocr (session 78e32c6b, 2 files, 0 comments): No findings. Raw: `ocr/T95.5-B1-b92f956c.json`.
**T95.5-B2.** Case: "it should apply a fractional limit, such as 5.5%, without throwing".
*T95.5-B2 done:* commit `6ec0a2ab`; limits are read as exact decimals (red: `RangeError: The number 5.5 cannot be converted to a BigInt`). ocr (session 9dfad8a8, 2 files, 0 comments): No findings. Raw: `ocr/T95.5-B2-6ec0a2ab.json`.

## T95.6 — `SaveReviewMarks` for the whole page; the same-Review fix (Full)

Commit `c0c8c27a`. `SaveReviewMarksRequest` drops `tradeId`; `PostMarksReview.trade` is now the first walked Trade's card and `trades` is in the new order. A Review Date `CorrectMark` whose key resolves Available from a Manual source gets the reason "Fixed in the same Review" (subagent's reading of "typed"; D11 refines it). Frames for that check are read only when such an entry is present, so R4's counts hold. Cases 4, 5, 6 and 7 were first-run passes, each mutation-checked (assertion failures). `ReviewView.tsx` only drops `tradeId` from the request (UI path, so the full browser tier applies).

**ocr** (session b32092ef, gpt-6.1-sol, 20 files, 2 comments). Raw: `ocr/T95.6-c0c8c27a.json`.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| high bug | `ReviewView.tsx:626` | `marksSaved` swaps the open card for `post.trade`, now the first Trade, so saving Marks from another open card switches cards and can unmount unsaved Action or reflection input | Valid | bug task T95.6-B1 |
| low maintainability | `tests/integration/d5r/support.ts:70` | `saveMarksFrom` keeps an unused `tradeId` parameter | Valid, Style only | tech debt |

**T95.6-B1.** Defect: after T95.6, Save Marks from a card that is not first in the new order replaces the open card with the first Trade's, losing unsaved Action or reflection input on the card that was open. Cases: "it should keep the open card open after Save Marks when it is not first in the new order"; "it should keep an unsaved Action draft on that card after Save Marks".

## T95.3-D1 — the frozen fixtures' saved Review views take the new attention bands (Full)

Decision 127 as amended. Six `expected-views.json` files were regenerated through the app's own code (`launchOn`, `viewsOf`, `withWalkedReflections`, `restoredViews`), then merged into the old snapshot so that only keys the snapshot already held changed; fields the app has added since (the verifier allows them) were not added. `dump.json` and `backup.tjbackup` are untouched: `git diff --stat -- tests/fixtures` lists six `expected-views.json` files only. No figure or computation changed.

Moved entries (the same Trade in each case):
- workspace-v5 and backup-v5-blocked: `review.families[Trades].trades` and `reviewTrades`: fx-0072 (KO) moves from fourth to first (was fx-0046, fx-0114, fx-0129, fx-0072, fx-0089).
- workspace-v6 and backup-v6-blocked: fx-0075 (KO) moves from fifth to first (was fx-0174, fx-0049, fx-0117, fx-0132, fx-0075, fx-0092).
- workspace-v7 and backup-v7: fx-0075 moves from sixth to first (was fx-0174, fx-0223, fx-0049, fx-0117, fx-0132, fx-0075, fx-0092).
- `review.completion.reasons`: the Trade ids shift to the new order, and the ReflectionDue and ActionMissing entries swap places (ActionMissing now first; the `debtIds` go with ReflectionDue): v5 entries 5 to 9, v6 entries 7 to 12, v7 entries 7 to 13.

Changed values (field, old to new):
- fx-0072 in v5 and backup-v5 (band, and the same in `reviewTrades[].attention`): `band` EvidenceLimited to ExitNotCarriedOut; `reasons[0]` {code Unavailable, reason MarkMissing, instrument KO, date 2026-10-20} to {code ExitNotCarriedOut}.
- fx-0075 (KO) in v6, v7 and their backups: the same, with date 2026-11-20 in the old reason.
- fx-0174 in v6, v7 and their backups (Trade and `reviewTrades[].attention`): `band` Blocker to SettlementDue.
- fx-0223 in v7 and backup-v7 (Trade and `reviewTrades[].attention`): `band` BoundaryReached to StopReached.

Verification: `npm run verify:fixtures` passes (12 fixtures); `npx vitest run tests/integration` passes (141 files, 300 tests, including the ten named: d7/migration, d7s/migration x2, d8/blocked, d8/round-trip x3, d8r/restore x3). The first attempt's measurement matched; T95.6 changed none of it.

**T95.3-D1 ocr** (`1596b4df`): the repo rule selects nothing for fixture-only commits; reran with a scratch rule including `tests/fixtures/**/expected-views.json`: **No findings** (`ocr/T95.3-D1-1596b4df.json`). Its diff is listed in the T95.3-D1 section above.

**T95.6-B1** `f3038f3d`: `marksSaved` keeps the open card when it is not first in the new order and reads it again under the new binding; the Review is folded in its new order. Both cases red then green (case 2's first red was a fixture error, fixed). 11 e2e specs, 42 passed.

**T95.6-B1 ocr** (session 2158ac06, 2 files, 1 comment; `ocr/T95.6-B1-f3038f3d.json`):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| high bug | `ReviewView.tsx:617` | When the open card is not first, the new `read(tradeId, opening)` sets the card to Unavailable if `getTrade` fails or isn't ready, unmounting the card body and dropping unsaved Action and reflection drafts although Save Marks succeeded; the old `refreshTrade` path left the card in place | Valid (narrow trigger) | bug task T95.6-B2 |

**T95.6-B2.** Defect: after a successful Save Marks, a failed or not-ready read of the open (not first) card replaces it with the Unavailable banner and loses its drafts. Case: "it should keep the open card and its drafts when reading it again after Save Marks fails". Queued after T95.4 (one coding task at a time in this worktree).

**T95.6-B2** `72dd66a3`: `read` takes `keepShown`; on an Unavailable re-read after Save Marks the shown card stays. Case red (`expected <p></p> to be null`, the banner) then green. `src/ui/screens` 648 passed; 11 e2e specs, 36 passed (a different file set from B1's). ocr (`ocr/T95.6-B2-72dd66a3.json`): **No findings.**

## T95.4 — Daily Review `open`: the day summary (Standard)

Commit `4983cfc1` (from `72dd66a3`; a first attempt stopped for Q3, decision 128). `MarketDataReadSession.sessionDatesBetween(from, to)` (calendar only, both ends included; `SessionDates`), one sentence in `specs/design/market-data.md`. `OpenDailyReviewResult` Ready gains optional `day: DaySummary` (`trades`, `toGo {marks, actions, expirations, closeReviews, reflections}`, `change`, `nextReviewDate`, `missed`, `lines`, `finished {pastLine, chosen, due}`); `assemble` gains `withFinished` (only `open`). Nine cases red then green; one extra assertion in case 4 mutation-checked. Subagent readings: no earlier Action → missed sessions from the first exposure; an Unavailable earlier valuation makes the change Unavailable; `closeReviews` split from `reflections`; "comes due" lists expirations after the Review Date; "past a line" from the Review Date's condition readings; `day` optional until T95.10. R1, R1b, R3, R4 pins unchanged (measured); `verify:fixtures` equal. Unit run under the overlapped suite run: `tools/estimate-rules.test.ts` timed out twice at 9 s, passes alone (load; trial note).

**T95.4 ocr** (session 16c08040, 5 files, 2 comments; `ocr/T95.4-4983cfc1.json`):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium bug | `daily-review.ts:143` | `dayChangeOf` counts a Trade's whole P&L as the day's change when there is no earlier valuation only because the calendar has no previous session (or the earlier valuation is Unavailable for a Trade valued today) | Doubtful (needs the start of calendar coverage, 2024-01-01) | bug task T95.4-B1 |
| medium bug | `daily-review.ts:157` | `missedSessions` returns nothing when any date in the range is outside the calendar's coverage, though covered unreviewed sessions exist | Doubtful (needs a first exposure or last Action before 2024-01-01) | bug task T95.4-B2 |

**T95.4-B1.** Defect: with no previous session in the calendar, a Trade held then counts its whole P&L as the day's change. Case: "it should make the day's change Unavailable when the calendar has no session before the Review Date for a Trade open before it".
**T95.4-B2.** Defect: a range starting before the calendar's coverage gives no missed sessions at all. Case: "it should name the covered sessions with no Review when the range starts before the calendar's coverage".
Queued after T95.7.

**T95.4-B1** `f5db240e`: with no previous session, a Trade first exposed before the Review Date makes the change Unavailable; a Trade bought on the Review Date still counts from 0. Red (`{kind: 'Value'} … {kind: 'Unavailable'}`) then green. **T95.4-B2** `55788547`: `sessionDatesBetween`'s NotCovered answer gains `coverage` (from the policy diagnostic already read; no new read; the spec doesn't describe that shape, so no spec change), and `missedSessions` clamps to the covered start. Red (`expected undefined to be '2024-01-02'`) then green. Case names drop apostrophes for `-t` filtering. Daily-review and market-data unit 317; R1 and R1b pin files 19 passed. Not fixed (outside B1's case): an Unavailable earlier valuation for a Trade valued today — it already gives Unavailable per T95.4's reading. ocr on the range (`ocr/T95.4-B1-B2-55788547.json`): **No findings.**

## T95.7 — `SaveTradeAction` refuses until the Trade's Marks are resolved (Full)

Commit `f9d319d3` (from `4983cfc1`). `DailyReviewIssue = {code: 'ReviewMarksUnresolved'; instruments}` on `Rejected`; the gate reuses `checkBinding`'s frames and requirements (no new read; R2 holds). Cases 1–4 red then green; cases 5 and 6 first-run passes, each mutation-checked (assertion failures). Tests changed by the rule: `save.test.ts` (Intent case saves a DEF Mark first), I4.16 (saves an XYZ Mark first), d8p `oc3` (Tuesday's Marks acknowledged Unavailable before the Hold), I8P.1 (Tuesday's gap reads `AcknowledgedUnavailable`, not `Missing`). `ReviewReflections.tsx`: one line so the new issue shape compiles. Subagent note: browser specs that save an Action while a Review Date Mark is Missing will now be refused (the complete run will show them). ocr (`ocr/T95.7-f9d319d3.json`): **No findings.**

**Complete run `t95.3-t95.5`** (scratch copy at `1596b4df`, covering T95.3, T95.3-D1, T95.5, T95.6 before its fixes; `browser tier: full (first matching path since 34c2ce96: src/ui/screens/ReviewView.tsx)`; run complete): unit 2721 passed, **1 failed**: `tools/estimate-rules.test.ts` "should pass every file of the current tree", timed out at 5 s (load from the overlapped task; passes alone); integration 141 files, 300 tests; browser-1 119 passed, **7 failed** (7.4 min); browser-2 67, **13 failed** (9.4 min); browser-3 55, **2 failed** (5.9 min); browser-4 118, **19 failed**, 4 skipped (13.7 min); checks 14 of 14. All 41 browser failures are one pattern: after Save Marks, the card the test saved from (`…region XYZ review … Save Marks (0)`) is no longer shown, which is T95.6's defect fixed by T95.6-B1 (`f3038f3d`, after this commit; its own spec runs of d4, d5r, d9r2 passed). Not routed as a bug task; the next complete run, at `f5db240e` (after T95.6-B1, T95.6-B2, T95.4, T95.7), is the check. Two stages over 8 minutes (browser-2, browser-4): a browser-5 stage is worth adding (tech debt).

## T95.8 — Daily Review `getTrade`: the last decisions (Standard)

Commit `85912096` (from `55788547`). New `decisions.ts` (`lastDecisionsOf`); `DailyTradeReview.decisions?: LastDecisions` (`recent` ≤ 4 newest first with each session's Trade P&L, `earlier`, `sessionsWithoutReview`, `heldPast {line, sessions}`); optional until T95.19. Cases 1, 2, 4, 5, 6, 7 red then green (case 1's first green failed on a weak test assertion, replaced); cases 3 and 8 first-run passes, mutation-checked (assertion failures). Subagent reading: with no saved Action, sessions with no Review count from the first exposure's UTC date. R2 and R5 unchanged (T95.3-B1 already pinned the one `byAnchorTrade` read). daily-review 203 passed; the 27 `countRequests` files 264 passed; `verify:fixtures` OK. ocr not yet run (the user: start nothing else).

**Complete run `t95.6-t95.7`** (scratch copy at `f5db240e`: T95.6-B1, T95.6-B2, T95.4, T95.4-B1, T95.7; `browser tier: full (first matching path since 34c2ce96: src/ui/screens/ReviewReflections.tsx)`; run complete): unit 2740 passed, **1 failed**: `tools/estimate-rules.test.ts:122` timed out at 5 s again (T95.8 ran its tests during this stage; second run in a row, both under load; passes alone; tech debt); integration 141 files, 300 tests; browser-1 125 passed, **1 failed** (5.8 min); browser-2 80 (5.4 min); browser-3 41, **16 failed** (8.5 min); browser-4 137, 4 skipped (7.5 min); checks 14 of 14. All 17 browser failures are one cause, at `e2e/d4/support.ts:354` (`saveAction`): the Action's Save is refused, so the pressed button never hides — T95.7's rule refusing an Action while a Review Date Mark is Missing (the subagent foresaw it). T95.6's 41 failures are gone. Routed as **T95.7-B1** (suite failure): the e2e setups that save an Action before that Trade's Review Date Marks are saved or acknowledged Unavailable take the Mark step first; no product change, only what the rule forces. Confirmed by this run: T95.3, T95.3-D1, T95.5, T95.6 (Done). Not covered: T95.4-B2 (`55788547`) and T95.8.

**T95.7-B1 stopped (the user, 2026-11-22):** its 17 failing specs each wait out `saveAction`'s 20 s `READY` timeout after a refused save. The user chose to fix that first: **T95.7-F1** (test tooling) makes the save helpers fail at once, quoting the refusal. B1's partial edit (`e2e/d8p/support.ts`, 15+/2−) was saved as a patch in the session scratchpad and reverted; B1 restarts after F1.

**The user's direction (2026-11-22), replacing the stopped T95.7-F1 brief:** the e2e save helpers wait up to 20 s (`READY`) for success and report only a timeout when the app refuses the save. Measured (text search, approximate): `saveAction` (e2e/d4/support.ts:348) about 34 tests; `expectSavedReflection` (e2e/d5/support.ts:50) about 9; `checkSavedRow` (e2e/d4/support.ts:311) about 87; `saveMarks` (e2e/d9/support.ts:189) up to 80; `savedOptionMarkRow` (e2e/d7/support.ts:130) about 22; `enterTrade` (e2e/d9ar/support.ts:68) about 13; plus two inline copies of `saveAction`'s logic in e2e/d9ar/review.spec.ts (70, 104). **T95.7-F1:** the two inline copies call the helper. **T95.7-F2:** the six helpers fail at once, quoting the refusal, when the app refuses the save; success path unchanged, no caller changes. Then T95.7-B1 restarts.

**T95.7-F1** `8f0a419c`: `pressSave(form)` split out of `saveAction` (e2e/d4/support.ts) and exported; `saveAction` ends with it; both d9ar/review.spec.ts copies call it (calling `saveAction` whole would re-fill the draft the second case proves survived). d9ar/review and d4/review: 7 of 7 before (38.8 s) and after (39.8 s). ocr (`ocr/T95.7-F1-8f0a419c.json`): **No findings.**

## Trial: complete runs overlapped with the next task (the user, 2026-11-22, for 5 or 6 tasks)

Each task's complete run runs in a detached scratch copy (`.claude/worktrees/run-<label>`, set up by `lane-setup.sh`) at the task's commit, while the next task's subagent starts in this worktree. The run's files are copied back to `evidence/D95/suite-runs/`. A failure becomes a bug task as before; the next task restarts only if it built on the broken code. Times are recorded per run to measure the saving.

**Ended by the user, 2026-11-22 ~20:05**, after T95.4, T95.6-B2, T95.7, T95.4-B1, T95.4-B2 and T95.8's start: completed work was piling up unconfirmed, and load caused spurious failures (run `t95.3-t95.5`: `estimate-rules` timeout, browser stages up to 13.7 min against about 5; T95.4's own unit runs: the same timeout twice and 3 uncaptured failures). The run already started (`t95.6-t95.7`, at `f5db240e`) and T95.8 finish; from then on, one task at a time with its run before the next task, as before.
