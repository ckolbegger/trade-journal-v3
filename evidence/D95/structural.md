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

**T95.7-F2** `38d61e16` (five e2e support files): `savedUnlessRefused(helper, scope, waitSaved)` in e2e/d4/support.ts keeps each success wait and polls every 100 ms for a `.field-error` or `[role="alert"]` in the form or section (the Marks panel's saved-but-out-of-date alert ignored), throwing "<helper>: the app refused the save and shows: …". Forced refusals (temporary `src/` edits, reverted) for helpers 2–6:

| Helper | Spec | Before | After |
|---|---|---|---|
| `pressSave` | e2e/d8r/today.spec.ts:8 (real) | 24.6 s, timeout | 3.9 s, "This Action could not be saved. Reopen the Trade and try again." |
| `expectSavedReflection` | e2e/d5/review-debt.spec.ts:36 | 23.0 s | 2.8 s |
| `checkSavedRow` | e2e/d4/review.spec.ts:6 | 23.7 s | 3.6 s |
| `saveMarks` | e2e/d9/gaps.spec.ts:11 | 21.8 s | 1.9 s |
| `savedOptionMarkRow` | e2e/d7/marks-zero.spec.ts:14 | 23.2 s | 3.2 s |
| `enterTrade` | e2e/d9ar/review.spec.ts:28 | 22.2 s | 2.0 s |

Success path: e2e/d4, d5, d7, d9, d9ar 225 passed, 4 skipped, 1 failed (the known `d4/responsive-a11y.spec.ts:114`, T95.7) before (13.7 min) and after (13.6 min). Note: a `ReviewMarksUnresolved` refusal shows the generic "This Action could not be saved. Reopen the Trade and try again." until the screen handles the code (later task).

**T95.7-F2 ocr** (session c272d095, 5 files, 2 comments; `ocr/T95.7-F2-38d61e16.json`):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium bug | `e2e/d5/support.ts:55` | `expectSavedReflection` watches for a refusal only when `card` is set; Trade Detail and the Review owed list still wait out READY | Valid | bug task T95.7-F2-B1 |
| medium bug | `e2e/d4/support.ts:309` | `REFUSAL` misses the Marks batch-limit refusal ("Save Marks takes up to N at once…", `<p role="status">`, CardMarks.tsx:424) | Valid (over 100 drafts only) | bug task T95.7-F2-B2 |

**T95.7-F2-B1** `8fbf57f3` (e2e/d5/support.ts): `expectSavedReflection` uses `savedUnlessRefused` on every path; without a card the success wait stays "Saved reflection visible" (waiting for the form to go broke d5/responsive.spec.ts:38). Forced refusal on d5/detail-debt.spec.ts:7: before, a generic "Saved reflection not found" after 5 s; after, 4.5 s quoting the refusal. The owed-list path shares the code but wasn't forced. **T95.7-F2-B2** `a5edf731` (e2e/d4/support.ts): `REFUSAL` adds `p[role="status"]:has-text("Save Marks takes up to")`. Forced on d9/gaps.spec.ts: 115 s → 12.8 s, quoting "Save Marks takes up to 1 at once; 2 are entered. Clear 1, then save." e2e/d4 and d5: 55 passed, 1 failed (the known d4/responsive-a11y.spec.ts:114) after each. Seen, not changed: `ReviewView.tsx:173` shows the same limit text outside a card's Marks section, outside the helpers' scopes. ocr on the range (`ocr/T95.7-F2-B1-B2-a5edf731.json`): **No findings.**

**T95.7-B1 (partial)** `0a14caae`: `buildOc3` (e2e/d8p/support.ts) acknowledges Tuesday's XYZ and call Marks Unavailable before the Wed 08:00 Hold (`acknowledgeTuesday`, from the saved patch); d4/responsive-a11y.spec.ts:114 saves ABC and DEF Holds first, keeps the "Incomplete" and accessibility checks (relabelled "with the other Actions saved"), then enters JKL's Mark and saves its Hold; no assertion removed. Red: 17 failed (14 counted, each ~4 s, "pressSave: the app refused the save…"). Green: 12 named specs pass; d8p/history.spec.ts:17 and :151 fail on the gap reading (Q4); 3 not confirmed (output cut). Whole folders not run: each browser run waited ~10 min for the lock held by the wait-split study.

**T95.7-B1 (completion)**: `buildOc3` (e2e/d8p/support.ts) takes `noTuesdayReview: true`: the Wed 08:00 step (Tuesday's acknowledgement and Hold) is skipped, so Tuesday stays a true gap. d8p/history.spec.ts:17 and :151 use it; every gap assertion kept; one expectation changed where the removed Review appeared: `Tue Oct 13` card `toContainText('Daily Review · Tue Oct 13')` becomes `not.toContainText('Daily Review')` (comment reworded to match). d8p/cockpit.spec.ts:37 (Tuesday now acknowledged, no gap): tab `'Price History 1'` becomes `'Price History'`. Green: history 3 passed; cockpit 1 passed; folders e2e/d4, e2e/d8, e2e/d8p, e2e/d8r run together: 83 tests, 82 passed and 1 failed (cockpit:37, then fixed and passed alone); no skips.
**The user's direction (2026-11-22), after the wait-split study** (`wait-split-study.md` in the session scratchpad: 413 READY waits, 222 after a launch or reload, 191 mid-test; 9,057 timed waits under load, mid-test p99 87 ms, launch p99 203 ms, slowest 1.3 s, the update notice): Q4 answered (b); then **T95.7-F3**: READY becomes two named waits, 5 s mid-test and 10 s after the app opens, after first timing the untimed release-switching (`@release-history`) tests and the d5r, d6, d7 folders; any wait measured near its limit keeps 20 s and is named. Order: T95.7-B1, T95.7-F3, the ocr reviews (T95.7-B1, T95.8, T95.7-F3), one complete run.

**T95.7-B1 (completion)** `8f1e5f0a`: `buildOc3` takes `noTuesdayReview: true` (skips the Wed 08:00 Review of Tuesday); d8p/history.spec.ts:17 and :151 use it, all gap assertions kept; history:17's Tue Oct 13 card `toContainText('Daily Review · Tue Oct 13')` → `not.toContainText('Daily Review')`. Also changed (outside the Q4 instruction): d8p/cockpit.spec.ts:37's tab `'Price History 1'` → `'Price History'` (the acknowledged Tuesday leaves no gap to count there). d4, d8, d8p, d8r together: 83 tests, 82 passed, 1 failed (cockpit:37, then fixed; alone passes); whole folders not rerun after that fix — the complete run will.

**T95.7-B1-D1** (the user, 2026-11-22): d8p/cockpit.spec.ts:37 uses `noTuesdayReview` too, restoring its `'Price History 1'` expectation so the gap count stays tested. Queued after T95.7-F3.

**T95.7-B1-D1** done: d8p/cockpit.spec.ts:37 builds with `noTuesdayReview: true` and expects `'Price History 1'` again; no other expectation changed. Green: cockpit 1 passed; e2e/d8p whole 20 passed; typecheck and lint exit 0.

**T95.7-F3** `0fbe7978` (81 files under e2e/ and tools/): `READY` (20 s) replaced by `LAUNCH = { timeout: 10_000 }` (271 uses: shared helpers, first readiness after open, restore, update and migration notices; 11 in tools/ui-screenshots.ts) and `STEP = { timeout: 5_000 }` (2 explicit: a click and `pressSave`'s waitForElementState); 151 mid-test waits drop the option (Playwright's 5 s default); none at 20 s. Step 1 timings (instrumentation removed): 2,500 expect waits over the release-history tests, d1/update, d5r, d6, d7 family: p99 196 ms, max 1,289 ms (d1/update.spec.ts:145, a launch wait); clicks max 212 ms. Every changed line pair is identical with the wait token stripped. Whole browser suite: stage 1 126 (334 s), stage 2 80 (314 s), stage 3 57 (287 s), stage 4 137, 4 skipped (446 s), release-history 4 (19 s); no failures. Classification is the study's scan plus rules, not read line by line (a wrong STEP still has 4× headroom).

**ocr, the T95.7 follow-ons:** T95.7-B1 (`0a14caae^..8f1e5f0a`, `ocr/T95.7-B1-8f1e5f0a.json`), T95.7-B1-D1 (`ocr/T95.7-B1-D1-ae590335.json`) and T95.7-F3 (81 files, `ocr/T95.7-F3-0fbe7978.json`; the subagent checked the diff: 151 waits drop the option for Playwright's 5 s default, 345 lines use LAUNCH, 6 STEP lines): **No findings** each.

**T95.8 ocr** (session 75999355, 4 files, 2 comments; `ocr/T95.8-85912096.json`):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium bug | `decisions.ts:12-13` | The Hold-past-line streak starts at the replay's last session, but the replay stops at a Settlement Due option's expiration, so for a Trade reviewed sessions after expiration the unreviewed sessions are skipped and a Hold on the expiration session still counts (breaks case 5) | Valid (narrow) | bug task T95.8-B1 |
| medium bug | `daily-review.ts:189` | `unreviewedSince` takes the first exposure's UTC date as the first Review Date, so a fill after the close lists that day in `sessionsWithoutReview`; the page-level `missed` (`earliestExposureDate`, ~694) does the same | Valid | bug task T95.8-B2 |

**T95.8-B1.** Case: "it should end the Hold count at a session with no Review after a Settlement Due expiration". **T95.8-B2.** Case: "it should not list the day of a first fill after the close as a session with no Review", on the card and the page (`missed`) alike.

**T95.8-B1** `edaa9cc6`: a Hold run exists only when `sessionsWithoutReview` is empty (no dependence on where the replay stops). Red `expected { line: 'Stop', sessions: 2 } to be undefined`, green. **T95.8-B2** `69f574fa`: `firstReviewDate(read, exposureInstant)`: the first session whose close is at or after the first exposure, for the card and the page `missed`; falls back to the UTC date outside calendar coverage. Red on the card, then on the day summary, then green. daily-review 205 passed; the 27 `countRequests` files 266 passed; `verify:fixtures` OK. Subagent note (maintainability, not a bug task): the close is found through `read.settlementTime` with a placeholder option contract expiring that date, since Market Data's read session has no session-close call; a `sessionCloseOn(date)` would be cleaner. ocr on the range (`ocr/T95.8-B1-B2-69f574fa.json`): **No findings.**

**Complete run `t95.4-t95.8`** (on `a65745b2`, 2026-11-22; `browser tier: full (first matching path since f5db240e: e2e/d1/integrity-blocked.spec.ts)`; run complete): unit 234 files, 2,752 tests; integration 141 files, 300 tests; browser-1 126 (5.4 min); browser-2 80 (5.3 min); browser-3 57 (4.8 min); browser-4 137 passed, 4 skipped (7.4 min); checks 14 of 14. **No failures, no flakes.** Confirms T95.4, T95.7 and T95.8 with all their follow-ons (Done).

**T95.9 ocr** (22 files; `ocr/T95.9-267964e5.json`): **No findings.** Main-session note: the five new helpers are thin wrappers over `reachPanel`, `markRow`, `markCell`; T95.12 changes both layers, all inside support files (decision 65 holds).

**Complete run `t95.9-mark-helpers`** (on `aa2258ca`, browser-task; run complete): unit 234 files, 2,752 tests; integration 141 files, 300 tests; browser `@every-task` 5 in 13.7 s (no `e2e/d95` yet; the subagent ran all four stages on `267964e5`: 126, 80, 57, 137 + 4 skipped); checks 14 of 14. No failures. T95.9 Done.

## T95.4-D1 — every save returns the day summary; figures for T95.10 and T95.11 (Full; decision 129)

Commit `b8a99091` (from `783d7730`). `PostSaveReview` and `PostMarksReview` Ready gain `day?: DaySummary` (built in each save's pass; the finished-day lists on any save after which nothing is to go, replaying only Trades read as crossed); `DaySummary.lines[]` gains `marks` (Review Date Marks to go) and `closeReview`; `MeterPreviousReading` gains `zone?`; `WalkedTrade` gains `expiresOnReviewDate?: true` (a held contract `DueToday`); `DaySummary` exported. Cases 1, 2, 4, 5, 6, 7 red then green; case 3 (request counts) a first-run pass, mutation-checked (an extra `queryActions` read: assertion failure). Each save's tallies are unchanged; the finishing save adds only the replay's reads (one `meta` get, one `meta,observations` transaction, one `observations.byInstrumentDate` getAll). `day.test.ts`'s Close Review assertion widened from `toEqual` to `toMatchObject` (lines gained fields). No snapshot changed; `verify:fixtures` equal. src/coordinators 540; journal, market-data, trade-views, valuation and src/ui 1,620; integration 300. ocr (`ocr/T95.4-D1-b8a99091.json`): **No findings.**

**Complete run `t95.4-d1-day-on-saves`** (on `4e217d99`; `browser tier: task (no changed path since 783d7730 is on the full-tier list)`; run complete): unit 235 files, 2,759 tests; integration 141 files, 300 tests; browser `@every-task` 5 (13.1 s); checks 14 of 14. No failures. T95.4-D1 Done.

## T95.10 — the page: three steps and the day card (Full)

Commit `8c2b0643` (from `4e217d99`; a first attempt from `b2400751` stopped before code and raised Q5). New `DayCard.tsx`; `ReviewView.tsx` uses it. Cases 1 to 9 red then green; case 10 (375 wide, `e2e/d4/responsive-a11y.spec.ts`) a first-run pass, CSS built before the case, flagged: mutation `display: flex` on `.day-lines` failed "one left edge, Expected: 1, Received: 4". Case 4's page-level focus test also a first-run pass, flagged: mutation (no panel or Instrument to `openCard`) failed on focus. Extra case, red then green, in `held-review.test.ts`: the held Review takes `day` from each save result. Outside the Files line: `held-review.ts`, `tests/support/review-day.ts` (`dayOf` fixture builder), `eslint-suppressions.json` (one fewer), `app.css`. `e2e/d4/support.ts` `status(page)` now reads the day card ("The day", or "Review status" for previous-release specs); new `dayLine`. The completion word, Unavailable Marks group and unsaved-Marks notice stay in the day card; IntegrityDisagreement and IncoherentFacts lines in "Facts to check". Two assertions of removed behaviour deleted (the Mark-missing blocker link; the contract label in the blocker); Blockers-list tests rewritten as day-line tests. No snapshot changed. Browser: d4, d5r, d9r2, d9ar folders, edited specs and 23 further Review-page specs, all pass.

**Subagent notes (not bug tasks):** "Next: XYZ" can be ambiguous when two Trades share an Underlying (three specs use `.first()`); "Add them" opens the first Instrument with a gap, which T95.12's grid should take over; a line with nothing to do reads "Done", since W101's "Done · Hold" needs the saved Action, which `day.lines` lacks; walked lines keep `BAND_TEXT`'s old words until T95.11.

ocr (`ocr/T95.10-8c2b0643.json`, 27 files): **No findings.**

**Complete run `t95.10-day-card`** (on `befe8916`; `browser tier: full (first matching path since 4e217d99: e2e/d4/acknowledge.spec.ts)`; run complete): integration 141 files, 300 tests; browser 127 (5.9 min), 80 (5.6 min), 57 (5.2 min), 137 and 4 skipped (7.9 min); checks 14 of 14. Unit 2,768 of 2,769: `tools/estimate-rules.test.ts:122` timed out (5,407 ms against 5,000 ms) under the run's load; rerun alone it passed (8 of 8, 3.5 s). Not reproduced, so recorded as a flake (its second; tech debt already lists it). T95.10 Done.

**The user's direction (2026-11-22):** give `tools/estimate-rules.test.ts:122` a 10 s limit, untested until the next task's run. Commit `eacad071`.

## T95.11 — plain labels (Standard)

Commit `c823f8ba` (from `befe8916`; a first attempt stopped before code and joined Q5). `labelsOf(trade)` in `review-attention.ts` replaces `BAND_TEXT`; labels on the card header and the day lines. Cases 1 to 7 red then green (case 1 red a runtime TypeError); no first-run pass. Precedence: "Expired: settle", then "Marks needed" (beside the session before's label with its day) while the Marks panel isn't done, then "Past Stop" / "At Target", "No price today", the share. Labels come from returned figures (`meter.now.share`, `meter.previous.zone` and date, `expiresOnReviewDate`); the short day is formatting. `isAcknowledgedUnavailableAttention` added to `calculation-words.ts` (`verify:wording`). Each card label's reasons are its accessible description (`aria-describedby`); day lines carry labels only. `ReviewSettlement.test.tsx`'s fixture band corrected from `Blocker` to `SettlementDue`. Browser: d4 review, d7s conditions, d5r responsive-a11y, 6 pass. No snapshot changed; no words shortened.

**Subagent notes (not bug tasks):** A302 has no label for a Blocker, an Exit not carried out (T95.41's banner), or a Routine or QuantifiedPressure Trade with no share; those show no label, and a card keeps its reason text in the body.

ocr (`ocr/T95.11-c823f8ba.json`, 13 files, 4 comments):
- `ReviewCard.tsx:129` (Valid) and `:135` (Valid): the description sits on a span inside the header button, so the button gets none; and every label shares the joined `trade.reasons`, so "Past Stop Fri" is described by today's missing Mark. → **T95.11-B1** (one fix: each label's own reason, reachable from the button).
- `DayCard.tsx:171` (Doubtful): day-line labels have no description. → **T95.11-B2**.
- `review-attention.ts:25` (Doubtful): a Blocker or Exit-not-carried-out Trade loses its visible warning. Needs words A302 doesn't have; put to the user with the unlabelled bands (not a bug task until words exist).

**T95.11-B1** `8c8cb60d`: `aria-describedby` moved to the header button, one hidden span per label with a reason; new `describedLabelsOf(trade, timeZone)` gives each label its own reason from returned figures (Marks needed: the MarkMissing reason; "Past Stop Fri": `meter.previous`; a share: its percent). Past Stop, At Target and Expired: settle get no description when the walk's `reasons` lacks the matching entry. `Badge`'s `describedBy` removed. Three cases red then green (one stub rerun for a TypeError red); src/ui 1,285; browser 6 of 6.

**T95.11-B2** `beaaf5a3`: each day-line link carries `aria-describedby` to one hidden element per label with a reason, placed after the Trade lines list so each line's text is unchanged; "Closed" has no reason. One case red then green; src/ui 1,286; browser 21 (8 specs).

ocr of B1 and B2 (`ocr/T95.11-B1-B2-beaaf5a3.json`): **No findings.**

**Complete run `t95.11-labels`** (on `f1e30021`; browser-task; run complete): unit 236 files, 2,779 tests (including `estimate-rules.test.ts:122` under its new 10 s limit); integration 141 files, 300 tests; browser `@every-task` 5 (12.5 s); checks 14 of 14. No failures. T95.11 Done (`c823f8ba`; B1 `8c8cb60d`; B2 `beaaf5a3`).

## T95.12 — the Marks step (Full)

First attempt (from `84e1b153`) stopped before code: no source for the grid's change from the previous Mark (W104; cases 1 and 3). **Main-session ruling under P167 (not a pending decision):** one pure function in `src/domain/mark-slip/` returns the change in dollars and percent; the grid calls it, as P167 has it call the slip check; `src/ui` does no arithmetic (ADR 0001). Also settled for the retry: the grid's own control for skipped sessions shows whenever the family has an earlier gap, not only when `day.missed` is non-empty; a saved Review Date Mark keeps the cell editor until T95.14.

Commit `db400f79` (from `82fe3fb6`). New `MarksStep.tsx` (from `CardMarks.tsx`), `marks-step.ts`, `MarksStep.test.tsx`, `e2e/d95/marks-step.spec.ts`; `markChange({entry, previous})` in `src/domain/mark-slip/` (dollars, percent). Cases 1, 3, 4, 5, 8 and the two `markChange` cases red then green (one `markChange` case coded ahead, reverted, then a real red). First-run passes, each mutation-checked: case 2 (`gridModel`'s dedupe), case 6 (`toggle` discarding drafts), case 7 (`PANELS` regaining Marks), case 9 (375 wide, browser: the previous-Mark cell on row 1). Pairing table for CardMarks' retired and moved cases in `tdd-log/T95.12.md`. `PANELS` is Reflections, Settlement, Action; `OpenCard(tradeId, panel?)`; DayCard takes `openMarks`, `openSkipped`. **Deviations:** `UnsavedMarks` is gone (Save Marks and Discard sit under the grid; the day card's `unsaved` prop is unused; T95.14 must not expect the old notice); focus drops after Save Marks (T95.14 case 4 owns it; d4's keyboard flow uses Shift+Tab); a Correct holds the page, not a card. Specs edited directly where they asserted the old card or turned grid (d4, d5r, d7, d9ar, d9r2); B9R2.5's paging-keyboard case is covered by unit cases only. No snapshot changed. src/ui and mark-slip 1,298; browser by folder, all pass (d4 27, d5r 16, d9r2 17, d95 1, d6 and d7p 21, d7 24, d7s, d7sp, d8 22, d8p and d8r 35, d9 39, d9ar 79; one combined d9 and d9ar run hit 600 s with 113 failures from a fixture helper filling unopened skipped cells, fixed in both supports, rerun separately).

ocr (`ocr/T95.12-db400f79.json`, 40 files, 9 comments; run with `--provider chatgpt` because ocr's saved config names provider anthropic): eight Valid, one Doubtful, grouped into three bug tasks:
- **T95.12-B1** (a Refresh): `ReviewView.tsx:457` the out-of-date notice stays after a Refresh with no card open (`reopenAndApply` never clears `stale`); `MarksStep.tsx:291` the gap columns are captured at mount, so a Refresh never adds a newly found gap or drops a removed one.
- **T95.12-B2** (the grid's skipped sessions and "Can't get a price"): `MarksStep.tsx:311` the skipped-sessions target is the first held cell, not the first Missing one; `:333` adding the columns re-runs the link-focus effect and steals focus; `MarksGrid.tsx:184` a Review Date no-price draft's save rejections (e.g. `ReasonTooLong`) aren't shown and the inline reason has no length limit; `:64` (Doubtful) a typed reason isn't a draft, so Discard and navigation ignore it.
- **T95.12-B3** (browser helpers): `e2e/d4/support.ts:304` `chooseCell`'s `.or(editor)` matches two elements for an earlier Missing cell (strict mode); `:339` `expectMark`'s Missing path skips revealing the skipped columns (`gaps.spec.ts:32-35` after a reload); `e2e/d5r/responsive-a11y.spec.ts:36` a duplicated assertion replaced the "Unsaved" check.

**T95.12-B1** `971cde6e`: `refreshHeld` and the no-card `markSaved` path clear `stale` once `reopenAndApply` succeeds; ReviewView counts successful Refreshes (`reads`) and MarksStep resets its gap groups from the held Review when it changes (not on a per-row save's re-read, so a session just filled stays a column). Two cases red then green; a third a first-run pass, mutation-checked (`setOpened(opened)`: assertion failure). One unidentified `src/ui` failure in one of five runs (output filter hid its name); later runs 1,289 of 1,289. Browser 8 of 8.

**T95.12-B2** `bd6a24a4`: the skipped-sessions target is the first Missing cell (skipped sessions newest first, then the previous session); adding the columns keeps focus there; a refused Review Date "Can't get a price" shows its words in the row and focuses the reason; the inline reason holds 500 characters (`MAX_REASON`); the typed reason lives in the held `CantGetPrice` draft, so it counts in Save Marks (n), Discard and the leave-page hold; Cancel drops the draft. Six cases red then green (one fixture rewritten after a first-run pass gave no real red); one existing case that relied on the focus bug changed (refactor row). Not handled: a first Missing skipped cell beyond page 1 (20 sessions) isn't mounted for focus; the editor textarea has no limit. src/ui 1,295; browser 6 specs, all pass after the order fix (five not rerun after it; it touched only responsive-a11y's flow).

**T95.12-B3** `8e409a71` (browser helpers): `chooseCell` returns the editor alone when one exists after the click, else `input.or(editor)` (the union is still needed for a Review Date cell turned editor after a Conflict); `expectMark` reveals the skipped sessions when the cell is absent; d5r responsive-a11y's duplicate assertion replaced by Monday's input holding 52.00 (the grid shows no "Unsaved" on a Review Date cell, so the old check has no counterpart). Red seen for defect 1 (strict mode, gaps.spec.ts:23); defect 2's red was masked by it; defect 3 could not fail. Browser d4 27, d5r 16, d5 detail-debt 3, d7 marks-zero 1, d9r2 editor 4; src/ui 1,295.

ocr of B1, B2, B3 (`ocr/T95.12-B1-B3-8e409a71.json`, 7 files, 6 comments, all Valid):
- **T95.12-B1-B1**: `ReviewView.tsx:488-492` and `MarksStep.tsx:214-217` (one defect): `reads` is bumped only on a Refresh with no card open; `refreshTrade` (the open-card path, the default) never bumps it, so the skipped columns stay stale; `MarksStep.tsx:216` after a Refresh shrinks the skipped list, the grid's page index isn't clamped, so columns can be unreachable (more than 20 skipped sessions).
- **T95.12-B2-B1**: `MarksGrid.tsx:97-98` a repeat rejection of the same id doesn't reopen the reason field (batched into one render); `:244` a successful Save Marks leaves the reason editor open (`asking` not cleared); `MarksStep.tsx:318-320` the first Missing target can lie beyond the first 20 columns and no path switches the page, so focus is lost.

**T95.12-B1-B1** `f7d30832`: `refreshHeld` bumps `reads` whenever `refreshTrade(openId)` succeeds too; MarksGrid clamps the shown page to the last that exists (`requestedPage`). Two cases red then green. One existing ReviewView case asserted the defect (a column staying after a card-open Refresh) and was rewritten to expect it gone once the Refresh reads a Review that no longer lists it. Note: after a clamp `onPage` isn't called, so the visible-dates report comes only from `goTo` (nothing failed). src/ui 1,297; browser 7 of 7.

**T95.12-B2-B1** `244c8ada`: MarksStep passes `refusals` so a repeat refusal of the same cell reopens and focuses the reason; the reason field closes once its cell is no longer Missing; the grid brings up the first Missing cell's page whenever `showSession.count` rises (on `requestedPage`). Four cases red then green (one red rerun after a wrong date label in the test). The page switch doesn't check `pagingHeld` (a Correct in progress keeps its editor and focus). src/ui 1,301; browser 8 of 8.

ocr of B1-B1 and B2-B1 (`ocr/T95.12-B1-B1-B2-B1-244c8ada.json`, 5 files, 1 comment): `MarksStep.tsx:310` (Valid) the skipped-sessions link changes the grid's page while a Correct holds paging (`gapShown` bypasses `pagingHeld`), so the correction's cell can go off-page. → **T95.12-B2-B2**.

**T95.12-B2-B2** `5fa87ce0`: while a Correct holds, "Add the skipped sessions" and the skipped link are refused like the other refusal paths (status line, focus back to the correction; no columns, no page request); MarksGrid unchanged (one guard). The reused status line says "choose another cell", slightly off for adding sessions. Two cases red then green; src/ui 1,303; browser 7 of 7. ocr (`ocr/T95.12-B2-B2-5fa87ce0.json`): **No findings.**

**Complete run `t95.12-marks-step`** (on `d5197410`; `browser tier: full (first matching path since 84e1b153: e2e/d4/card-helpers.spec.ts)`; run complete): unit 236 files, 2,798 tests; integration 141 files, 300 tests; browser 127 (5.6 min), 80 (5.4 min), 57 (4.7 min), 136 and 4 skipped (7.6 min); checks 14 of 14. No failures. T95.12 Done (`db400f79`; B1 `971cde6e`; B2 `bd6a24a4`; B3 `8e409a71`; B1-B1 `f7d30832`; B2-B1 `244c8ada`; B2-B2 `5fa87ce0`).

## T95.13 — slip questions in the grid (Full)

Commit `e8fbbc64` (from `5971acd3`). New `SlipQuestion.tsx`; MarksStep, MarksGrid (blur callback, a slot under the row, an answer callback; not on the Files line), `marks-grid.ts` `previousMark` (shared by the Change column and the slip check); `answerSlipQuestions` in e2e/d4/support.ts (used by `enterMark`) and the d7, d9, d9ar supports; new `e2e/d95/slip-questions.spec.ts`. mark-slip unchanged. Cases 1 to 8 red then green (case 7's first red a fixture failure, rewritten); case 9 a first-run pass, mutation-checked (a `slipAnswered` spread into `saveEntries`: assertion failure). Cases sit in `MarksStep.test.tsx` (its fixtures aren't exported). W109's "3 Marks to go." left to T95.14 case 5. Three unit cases typed "abc" or "9" and now type valid prices (server mocks unchanged). `e2e/d7/marks-zero.spec.ts` (B7.6) contradicted W107 (it saved a zero share Mark and expected the server's refusal of -1); it now expects the screen's refusals and stores one revision. Assumptions: checks only on the Review Date cell; a refusal counts toward "to check first" and holds Save; Save Marks with a question open focuses the first such input. Holding Enter at an open question left to T95.15. Lane run: unit 2,807, integration 300, checks 14 of 14. Browser by folder, all pass (d95 and d9r2 19, d4 27, d5 30, d5r 16, d6 17, d7 33, d7p and d8p 24, d9* 137 and 4 skipped). No snapshot changed.

ocr (`ocr/T95.13-e8fbbc64.json`, 11 files, 3 comments, all Valid):
- **T95.13-B1** (the question's lifecycle): `MarksStep.tsx:468` typing doesn't clear the cell's `left` entry, so clearing and retyping the same price re-asks mid-typing, and `left` survives Discard; `:466-470` the cell editor's Price input (`DraftFields`, an acknowledged-unavailable Review Date cell) has no leave handler and its `panel.hold` never clears `slipAnswered`, so no question on leaving and an old answer survives a retype.
- **T95.13-B2**: `SlipQuestion.tsx:29` two readings that differ only beyond the cents show the same (`decimalMoney` rounds) and share a React key.

**T95.13-B1** `e60318da`: `Panel` gains `typePrice` (clears the cell's `left` and `slipAnswered`, then holds the Price; used by the grid input and the editor's Price input) and `leavePrice` (`leave`, now ignoring cells not on the Review Date); Discard clears `left` and `slipAnswered`. Three cases red then green (the editor case's reds by mutation, after a fixture slip). src/ui 1,315; browser 13 of 13.

**T95.13-B2** `0480e840`: when both readings show the same to the cent (only possible under a cent), each is shown as typed ("$0.0004 or $0.004?"); buttons keyed by label and price. One case red then green (new `SlipQuestion.test.tsx`). src/ui 1,316; browser 8 of 8.

ocr of B1 and B2 (`ocr/T95.13-B1-B2-0480e840.json`): **No findings.**

**Complete run `t95.13-slip-questions`** (on `b9607645`; `browser tier: full (first matching path since 5971acd3: e2e/d4/support.ts)`; run complete): unit 237 files, 2,811 tests; integration 141 files, 300 tests; browser 127 (5.3 min), 80 (5.0 min), 57 (4.4 min), 137 and 4 skipped (7.3 min); checks 14 of 14. No failures. T95.13 Done (`e8fbbc64`; B1 `e60318da`; B2 `0480e840`).

## T95.14 — Save Marks: fold, Edit, the re-sort, the fix in place (Full)

Commit `ca71b127` (from `58172855`), 29 files. Cases 2, 4, 5, 6 red then green (case 5's code written with case 2, reverted for a real red); cases 1, 3, 7, 9 first-run passes, each mutation-checked (`saveEntries` keeping only prices; the fold keeping held trades; `discard` not clearing drafts; `save` setting no failure). **Case 8 not built: parked on Q7.** No coordinator change: `SaveReviewMarks` already supplies "Fixed in the same Review" for a `CorrectMark` with an empty reason (T95.6); the UI sends that for a typed Review Date Mark changed in place (`savedInPlace` in held-review.ts). "Marks to go" is the day summary's `toGo.marks`. A typed Review Date Mark no longer opens Correct/Withdraw; an acknowledged cell keeps Withdraw; an earlier session's Mark still needs a reason; tests that corrected a typed Review Date Mark moved to the previous session, an acknowledged cell, or the in-place flow (`correct-mark.spec.ts`, `d8p/support.ts` expect "Fixed in the same Review"). Not built (no case): the grid starting folded when every Mark is in; refolding after Edit with no change; the "Corrected" tag on Review Date cells; "Undo after Edit" for an acknowledged cell. d4's keyboard flow restored (focus on the first Trade's header after Save Marks). e2e: `expectMarksSaved` replaces waiting for "Save Marks (0)"; `reachPanel` presses Edit when folded. Process slip: `write()` used on three tracked test files. src/ui 1,324. Browser: d95 2, d4 27, d9r2 17, d5r 16 and four single specs on the final code; d9ar states and review, d9 meter-review and review, d5 detail-debt and review-debt, d7 review-expiration passed before the last change (the suite run covers them). No snapshot changed.

ocr (`ocr/T95.14-ca71b127-partial.json`): **incomplete.** 17 of 28 files reviewed; 11 (every source file) failed with "servers are currently overloaded", and a rerun failed on all 28 with the ChatGPT "Subscription Sharing usage limit". One comment: `e2e/d4/support.ts:364` (Valid) `expectCellShows` builds an unanchored regex, so an expected 51.5 also passes for 151.50 or 51.59. → **T95.14-B1**. The full review reruns once ChatGPT usage is back. `ocr llm test` can't detect it (it tests only the default provider, Anthropic), so `.claude/scripts/ocr-usage-wait.sh` now probes with a one-commit ChatGPT review.

**T95.14-B1** `92c52094`: `expectCellShows` anchors its pattern (`^\$?<escaped price>` then `0*` with a dot, `(\.0+)?` without), so 51.5 matches 51.5 and 51.50 but not 151.50 or 51.59. Shown first by a wrong expected price in correct-mark.spec.ts passing before and failing after (spec restored). Browser: d4 27, and every other `expectMark` caller (18, 13), all pass.

ocr rerun of T95.14 and B1 (`ocr/T95.14-B1-92c52094.json`, 29 files, 6 comments; complete; it ran while T95.13-D1 edited MarksStep.tsx near line 425, after every cited line, so the judgments stand):
- **T95.14-B2** (MarksStep, three Valid): `:387` the grid folds on `saved && toGo === 0 && count === 0`, ignoring `dirtyIds`, so a Save Marks that finishes the day while a Correct is open drops the typed correction (Save Marks is disabled only by `count === 0 || saving`); `:482` `if (ok) setBlanked(new Set())` restores a saved cell emptied while the save was pending (inputs aren't disabled while saving); `:462` emptying a saved Mark's price leaves `count` 0, so Save Marks and Discard are both disabled and the cell looks missing with no way to cancel.
- `:415` no Price History link on the folded line: **Wrong** (Q7 (a)).
- `.claude/scripts/ocr-usage-wait.sh:20` (Doubtful) any provider failure read as the usage limit; `:13` (Doubtful) `mktemp -t` template without X's fails on GNU. Fixed in the main session (tooling): the probe now reads the session's error for `usage_limit_exceeded`, and `mktemp` uses an `XXXXXX` template.

**T95.14-B2** `0c20cda2`: the grid doesn't fold while a Correct is open or any saved cell is emptied (typed Marks still save; it folds once the Correct ends); cells emptied during a pending save stay empty (`setBlanked` reset removed); leaving a saved Mark's input empty restores its saved price (Save Marks and Discard stay disabled, nothing pending). Three cases red then green (two reworked after fixture-mistake reds). src/ui/screens 710; browser 20 of 20 (they don't exercise the new cases). ocr (`ocr/T95.14-B2-0c20cda2.json`): **No findings.**

**T95.14-D1** `48221326` (Q7 (a), Light): one case in `ReviewCard.test.tsx`: after Save Marks folds the grid, the folded line has Edit and no Price History link, and the card's Replay still links to Price History with the right href. First-run pass (the link already existed), mutation-checked (the Replay's Link replaced by a span: "Unable to find … link … Price History"). No product code; src/ui/screens 711. T95.14 case 8 met.

**T95.12-D1** `4792dfab` (the user's answer: bring back "Unsaved"): a typed Review Date price, or an unsaved "Can't get a price" draft, shows "Unsaved" in its cell (the input's `aria-describedby` points at it; name unchanged; writable Review only); not shown when empty or typed back to the saved price in a cell edited in place. Two cases red then green. Browser check restored in e2e/d5r/responsive-a11y.spec.ts through a new `expectMarkUnsaved` helper. src/ui 1,331; browser d5r 16, d95 2, d9r2 17. ocr (`ocr/T95.12-D1-4792dfab.json`): **No findings.**

**Complete run `t95.14-save-marks`** (on `f6d255d6`; covers T95.14, T95.14-B1, T95.14-B2, T95.14-D1, T95.13-D1, T95.12-D1; `browser tier: full (first matching path since 58172855: e2e/d4/correct-mark.spec.ts)`; run complete): unit 237 files, 2,827 tests (0:56); integration 141 files, 300 tests (1:01); browser 127 (5:37), 80 (5:21), 57 (4:38), 137 and 4 skipped (7:39); checks 14 of 14 (0:38 together). Total 26:13. No failures. Per-stage timings in `suite-runs/t95.14-save-marks-timings.md` (the user's direction, for the dedup comparison). T95.14 Done (`ca71b127`; B1 `92c52094`; B2 `0c20cda2`; D1 `48221326`); T95.13-D1 `d06479f7` and T95.12-D1 `4792dfab` done.

**T95.13-D1** `d06479f7` (Q6 (a)): `checkMarkSlip` takes an optional `expiresOnReviewDate`; when true a $0.00 option Mark passes instead of "Worth nothing?"; MarksStep sets it when a Trade holding the Instrument has `expiresOnReviewDate` (no date comparison in src/ui). Two cases red then green; case 4's "asked on any other day" cases unchanged and green. Note: the fact is per Trade, not per contract, so a Trade with two options where only one expires today skips the question for both (the grid's W111 line has the same reach). src/ui and mark-slip 1,338; browser 11 of 11.

ocr (`ocr/T95.13-D1-d06479f7.json`, 4 files, 1 comment): `MarksStep.tsx:426` (Valid) the exemption is decided per Trade (`expiresOnReviewDate` is set when any contract in the Trade is `DueToday`, `daily-review.ts:642`), so in a Trade with mixed expirations a mistyped 0 on a live contract skips the question; the W111 line (`:616`) has the same reach. **Not a bug today, the user's decision (2026-11-23):** a Trade holds at most one option contract until D10 (single-leg option Plans, D7), so the Trade-level fact is exact. No bug task (T95.13-D1-B1 dropped); a to-do added to D10's section, plan revision 119.

## T95.15 — the grid's keys (Standard)

Commit `41cf5039` (from `67f28e44`). New `e2e/d95/marks-keys.spec.ts` (B95.3: the hint at 375 wide with no sideways scroll; Enter, arrows, N). Cases 2 to 5 red then green; case 1 (Enter to the next input, then Save Marks) a first-run pass (T9R2's A295 built it), mutation-checked (`enterFrom` +1 to +2: assertion failure). W72 turned out to be D9R2's "Earlier sessions don't block the Review." (still used), not an old key hint, so W105 is new text and no expectations changed. Provisional behaviour: the Enter hold asks the question and keeps focus in the price (also on the not-a-price and zero-share refusals; not for a saved Mark left unchanged); N only in unsaved Review Date inputs ("4n" keeps its "n"); arrows only in the focused column, skipping rows with no price there, staying put at the ends. `MarksGridProps.asksAbout?` added. src/ui/screens 718; browser d95 3, d9r2 and three responsive specs 28.

ocr (gpt-6.1-sol, session dd5070e1): 4 files, 0 findings. `evidence/D95/ocr/T95.15-41cf5039.json`. D9.5 paused by the user on 2026-11-23 for the test dedup work, after this task.

Run `t95.15-grid-keys` (full browser tier; also the dedup baseline with T95.14's run): unit 2832 passed, integration 300 passed, browser-1 127 passed, browser-2 80 passed, browser-3 57 passed, browser-4 138 passed and 4 skipped, checks 14 of 14 exit 0. About 26m07s; browser stages 23m. Unit and integration ran at `757e31be`, browser-2 on at `e6c5f3d6` (plan-only). Timings: `evidence/D95/suite-runs/t95.15-grid-keys-timings.md`. T95.15 Done.

## Trial: complete runs overlapped with the next task (the user, 2026-11-22, for 5 or 6 tasks)

Each task's complete run runs in a detached scratch copy (`.claude/worktrees/run-<label>`, set up by `lane-setup.sh`) at the task's commit, while the next task's subagent starts in this worktree. The run's files are copied back to `evidence/D95/suite-runs/`. A failure becomes a bug task as before; the next task restarts only if it built on the broken code. Times are recorded per run to measure the saving.

**Ended by the user, 2026-11-22 ~20:05**, after T95.4, T95.6-B2, T95.7, T95.4-B1, T95.4-B2 and T95.8's start: completed work was piling up unconfirmed, and load caused spurious failures (run `t95.3-t95.5`: `estimate-rules` timeout, browser stages up to 13.7 min against about 5; T95.4's own unit runs: the same timeout twice and 3 uncaptured failures). The run already started (`t95.6-t95.7`, at `f5db240e`) and T95.8 finish; from then on, one task at a time with its run before the next task, as before.

## T95.9 Browser helpers: every Mark entry goes through the support helpers

Command: `grep -rnE "reachPanel\(|chooseCell\(|markRow\(|markCell\(" e2e`. Before: 132 uses, 106 of them outside the support files (21 spec files). After: 0 outside the support files; the rest are inside `support.ts` files only.

New helpers in `e2e/d4/support.ts` (re-exported down the chain): `marksPanelOf` (open Marks panel), `panelOf` (any panel, for a variable or non-Marks panel), `markEditorOf` (the cell's editor region), `markInputOf` (the cell's price input), `expectMark` (cell shows text). Each one calls the old helper, so no expectation moved or changed; T95.12 changes these helpers alone.

Specs now calling them: d4 (acknowledge, kill, update, no-save, review, gaps, offline, runtime-failure, card-helpers, responsive-a11y, correct-mark), d5 detail-debt, d5r (marks, durability, responsive-a11y), d7 marks-zero, d9r2 (editor, grid, responsive-a11y, drafts), d9ar states.

Browser stages under with-browser-lock.sh, unchanged: `test:e2e:1` 126 passed; `:2` 80 passed; `:3` 57 passed; `:4` 137 passed, 4 skipped (same as the last complete run). typecheck, tsc6, lint (2 existing warnings in OwedDebtItem.tsx, 0 errors) and lint:deps exit 0.

## T95.21 — "The day" on a finished day (Standard)

Commit `d542bfe9` (from `2a0751e6`). DayCard.tsx, DayCard.test.tsx, app.css (`.day-rows`). Cases 2, 3 and 5 red then green (3 and 5 first written ahead of red, taken out, red seen, put back; logged). Cases 1 and 4 first-run passes (built in T95.10), mutation-checked (`COMPLETION_TEXT.Complete` → 'Done'; the Trades list emptied). ReviewView.tsx not touched: COMPLETION_TEXT and the Unavailable Marks group already live in DayCard.tsx. W119 shortened (words-changed.md). W119's held-past sentences match the Trade's past lines against the saved Hold in the UI (a set match, not arithmetic). No browser case; no snapshot changed. src/ui 1341 passed.

ocr (gpt-6.1-sol, session 170d4202): 3 files, 2 findings, both Valid. `evidence/D95/ocr/T95.21-d542bfe9.json`.
- **T95.21-B1** (`DayCard.tsx:214`): with several saved Exits, "Tomorrow" lists every Trade but the one "record the sale" link opens only the first Trade's card.
- **T95.21-B2** (`DayCard.tsx:227`): the expiration reminder names one Instrument per option contract, so two contracts of one Trade expiring that day read "AXIO, AXIO expire …".

### T95.21-B1

Commit `953cd3c0`. Each Trade to be sold links to its own card; red: no link named "CORV"; green. DayCard.test.tsx 14 passed. New words in new-words.md.

### T95.21-B2

Commit `996d2ee5`. The expiration reminder names each Trade once (de-duplicated by tradeId in the UI before naming the underlying; not arithmetic). Red: "AXIO, AXIO expire Fri Nov 20."; green. DayCard.test.tsx 15 passed.

ocr of T95.21-B1 and T95.21-B2 (gpt-6.1-sol, session cff735b4, d542bfe9..996d2ee5): 2 files, 0 findings. `evidence/D95/ocr/T95.21-B1-B2-996d2ee5.json`.

Run `t95.21-finished-day` (browser-task): unit 2839, integration 300, checks 14 of 14 passed; browser `@every-task` 5 passed, `e2e/d95` 2 passed and 1 failed: `e2e/d95/marks-keys.spec.ts:9` "B95.3 … key hint at 375 wide, and take Enter, the arrow keys and N" — `toBeFocused` on "DEF Mark, Mon Oct 12" (line 35) received inactive. Failed again twice alone in the main session. It passed in `st.11-setup-snapshot` at `1e3b3fab`, so T95.21 or its fixes broke it. Bug task **T95.21-B3**.

### T95.21-B3 (stopped, no change) → T95.15-B1

The marks-keys failure is not T95.21's: `e2e/d95/marks-keys.spec.ts` fails about half the time, also with DayCard.tsx and app.css reverted to `1e3b3fab` (4 of 12). The grid lists Instruments in the Trades' attention order; ABC's and DEF's Trades tie, and `byAttention` (`src/coordinators/valuation/attention.ts:187`) breaks the tie by tradeId, which is random per run, so the order is stable within a journal but differs between runs. The test assumes ABC first. The app is right (overview: the order is stable within a Review view; ties fall to stable identity); the test is wrong. Main session ruling: fix the test to follow the grid's row order, as **T95.15-B1** (T95.15's spec). T95.21-B3 is closed with no change.

### T95.15-B1

Commit `a5b4592a`: marks-keys reads the grid's row order (ABC and DEF y positions) and gives each Instrument its own price (ABC 31.00, DEF 40.50; 31.00 on DEF opened a large-move question). `--repeat-each=12`: 12 passed; e2e/d95 3 passed.

Run `t95.21-finished-day-2` (browser-task, after T95.15-B1): unit 2839, integration 300, browser 8 passed, checks 14 of 14. Passed. T95.21 Done.

## T95.16-D1 — Thesis and "No longer valid if" on the Review card's data (Full; decision 130)

Commit `04ec189a` (from `467bb2c8`). `DailyTradeReview.plan?: { thesis, invalidation }`, set by `getTrade` from the Trade Analysis record it already reads (one line). Optional, like `decisions?`, because hand-built cards in five UI test files don't carry it; `getTrade` always returns it. Case 1 red then green; cases 2 and 3 first-run passes, mutation-checked (invalidation set to the thesis; one extra `journal.queryActions` read). Request counts equal I9AR.4's `CARD`. No snapshot changed.

ocr (gpt-6.1-sol, session 14c44730): 4 files, 0 findings. `evidence/D95/ocr/T95.16-D1-04ec189a.json`.

Run `t95.16-d1-plan-text` (browser-auto 467bb2c8 → task tier): unit 2840, integration 302, browser 8, checks 14 of 14. Passed. T95.16-D1 Done.

## T95.22 — The Open list follows the order (Standard)

Commit `0afb8500` (from `bb650283`). `browseTrades` passes each Trade's last Action to `attentionOf`, with one `queryActions` range read (earliest Plan time to the day before the Review Date; none with no Open Trades). Cases 2 and 3 red then green; cases 1 and 4 first-run passes, mutation-checked. Case 4: no Open row shows a band name; the "Stop breached"/"Target reached" badges are condition status and keep their label (A301), so a guard test only. B95.5 passed.

ocr (gpt-6.1-sol, session 5cae7dd0): 4 files, 1 finding, Valid: the Open list's `queryActions` includes the Review Date, so each Action saved that day adds a `journalEntries` read (breaks R3's constant reads; the test seeds none). Bug task **T95.22-B1**. `evidence/D95/ocr/T95.22-0afb8500.json`.

### T95.22-B1

Commit `23a7393a`: `ReviewDateQuery.earlierOnly?`; with `since`, `queryActions` skips the Review-Date reads; the Open list passes it, the Review's callers don't. Red then green on Review-Date Actions with two and four Trades (one read).

ocr of T95.22-B1 (session d657cf39): 4 files, 0 findings. `evidence/D95/ocr/T95.22-B1-23a7393a.json`.

Run `t95.22-open-order` (browser-task): unit 2845, integration 302, browser 9, checks 14 of 14. Passed. T95.22 Done.

## T95.16-D2 — P&L in dollars and R and the change on each walked Trade (Full; decision 131)

Commit `755901fa` (from `a4bc18e0`). `WalkedTrade.pnl?: { dollars, planR, change }` (optional like `meter`; absent when facts can't replay); change from `dayChangeOf` per Trade. Cases 1 and 2 red then green (case 2's red needed a placeholder, logged); cases 3 and 4 first-run passes, mutation-checked. Request counts equal `OPEN`. One existing test strips `pnl` beside `meter`. No snapshot changed.

ocr (session 446d666e): 5 files, 0 findings. `evidence/D95/ocr/T95.16-D2-755901fa.json`.

Run `t95.16-d2-walked-pnl` (browser-auto a4bc18e0 → task tier): unit 2848, integration 303, browser 9, checks 14 of 14. Passed. T95.16-D2 Done.

## T95.16 — The card: header and Plan box (Full)

Commits `77002281` (data: `day.lines[].action`, the Review Date's saved Action, from the Actions `open` already reads; T95.16-D3 under decision 131's standing approval) and `f878796f` (from `a60389a3`). New PlanBox, todo-text; header per U3 and W101 ("To do: Mark, Action", "Done · Hold"); no meter in the open card's header. Cases 1, 2, 3, 5 and 7 red then green; cases 4 and 6 first-run passes, mutation-checked. Case 5 partly met: CardFigures' Conditions list still shows Stop and Target prices until T95.17 removes CardFigures; its "At entry" group is hidden. The header's Trade P&L repeats CardFigures' row until T95.17. **Broken:** e2e specs that read the open card's header meter (`meterOf`, `reviewMeters`): `e2e/d5r/{review,marks,sliders,responsive-a11y}` fail (5 cases); `e2e/d7p/layout` and `e2e/d9/{meter-a11y,open-list}` likely. T95.17's Now box is a new drawing, not the shared meter in the header, so these go to follow-on **T95.16-F1** before the run.

ocr (session 30a10fbb, a60389a3..f878796f): 27 files, 6 findings. Valid, bug tasks: **T95.16-B1** header hardcodes `closeReview: false` (header says "Reflection" where the day card says "Close Review"); **T95.16-B2** the At entry group is dropped whenever a Plan column exists, though fills can differ from the Plan; **T95.16-B3** Plan box Thesis text has no `overflow-wrap`; **T95.16-B4** `e2e/d4/update.spec.ts:35` now expects "Done · Hold" against the frozen d4 release (restore the original); **T95.16-B5** `MarksStep.test.tsx` ~805 negative check `not.toContain('1 Mark')` is now vacuous. Wrong, dismissed: `e2e/d5/update.spec.ts:45` "Done" is a substring of the d5r2 release's "Done · Action saved". `evidence/D95/ocr/T95.16-f878796f.json`.

### T95.16-B1, T95.16-B2, T95.16-B3, T95.16-B4, T95.16-B5

B1 `2dfeacb3` (header passes `closeReview`), B2 `0827a7bc` (At entry hidden only when equal to the Plan box's figures), B3 `347ace42` (`overflow-wrap: anywhere`; new browser case), B4 `5ba40d94` (d4 release-history expectation restored; red then green), B5 `e857812f` (`not.toContain('To do: Mark')`, mutation-checked). Each red then green; no first-run passes.

ocr of T95.16-B1 to B5 (session 868b5592, f878796f..e857812f): 6 files, 0 findings. `evidence/D95/ocr/T95.16-B1-B5-e857812f.json`.

### T95.16-F1

Commit `2823e2b7`: `collapseOpenCard(page)` in `e2e/d5r/support.ts` (re-exported by d9); each case collapses the open card before reading its meter. Before: 8 failed, 14 passed; after (with e2e/d95): 28 passed. Checks that only the open card's meter can make, carried to **T95.17**'s Now box: B5R.11 case 1 (T-A's meter while its drafts are held), B9.11 (the open card's meter in the viewport at 1280, 375, 320), B9.9 (Open list row named as the open card's meter), T7P.11 (meter beside the open card's attention sentence).

Run `t95.16-card-header` (browser-auto a60389a3 → full tier): unit 2857, integration 303, browser 127 + 79 + 55 + 117 (4 skipped), checks 14 of 14; 19m00s. Passed. T95.16 Done.

## T95.17 — The "Now" box: the drawing and its rows (Full)

Data commit `5e00f791` (decision 131, fields only, request counts unchanged: tests/integration/d95/now-box.test.ts): `DailyTradeReview.expiration { date, sessionsLeft? }` (the open contract's date and the session dates after the Review Date through it, from the calendar `open` already reads) and `datedLastClose.meter` (the dated close's meter reading, `meterReadingOf` of the dated evaluation). Both are for the box: W90's "4 sessions", and a drawing for "At the Fri Nov 13 Marks".

New: NowBox.tsx, now-box.props.ts, their tests (19 cases: the planned 13, the three that pair CardFigures' retired cases 2, 12 and 13, the short put and sign case, the amount-only case and the dated-close case). The box draws the shared Meter itself, so its name, test ids and tone are the meter's (S12 untouched). The labels and arrows stand at the places the Meter wrote on its own marks (read from its inline offsets), so no position is worked out twice.

**CardFigures retired; its 13 cases paired.** CardFigures.tsx and CardFigures.test.tsx are deleted.

| CardFigures case | Paired with |
|---|---|
| A158 figures: P&L, Risk to stop, Worst case, Reward to target each in dollars and R, then Reward : risk, then At entry | NowBox "Worst case and Max reward", "Reward to risk"; the captions' dollars (cases 4, 5, 6); P&L is the header's (T95.16); At entry stays where it differs from the Plan box (ReviewCard, T95.16-B2) |
| a figure that is not a Value in words, never 0 | NowBox "Worst case and Max reward" (third fixture) and "should word a Reward to risk the Mark cannot give" |
| dated figures headed "At the Fri Oct 9 Marks", and their group named the same | NowBox case 1 (heading, region name) and "should read every figure from the dated close" |
| the dated group kept beside the figures when the Review Date Mark is missing | the same two cases; the box shows the one session |
| value at expiration beside the payoff summary | NowBox "Expiration row" (W90) and "More figures" (W92); the summary stays Trade Detail's words |
| the same figure in words when the Underlying Mark is missing or the contract is due | NowBox "Expiration row", fourth fixture |
| no such line on a stock Trade | NowBox "Expiration row", last fixture |
| the replay's names Current Risk, Remaining Reward | retired: the captions (W82, W83) replace the rows; the names stay in the Replay and Trade Detail |
| Reward to risk in one row with the odds and the Plan | NowBox case 8: ratio and the Plan's, no odds (U8) |
| past a line: the replay's wording in place of the row, no zero | NowBox case 5 (W86); e2e/d9ar/review.spec.ts |
| the marked result named Trade P&L, in both groups | retired: the header carries it (T95.16 case 1); ReviewCards.test.tsx "Stop and Target prices once ... no Trade P&L in the body" |
| each renamed figure's canonical term as hover text | NowBox "should keep the renamed figures canonical term as hover text" |
| the extremes' weight | NowBox "should give the extremes the Plan weight" |

The W8 Conditions list case (ReviewCard.test.tsx, O-S2 on Wednesday) is retired and paired with NowBox "should caption the line a short put has crossed and sign the move to the other by the side its line is on", which uses the same O-S2 fixture; each condition's status stays in Trade Detail and the Replay.

**Existing cases whose expectations changed** (the card's figures moved from CardFigures to the box; fixtures gained `maximumIncrementalReward`, `realizedToDate`, `remainingOpenPnl` and an empty `sessions` where they hand-build a card): ReviewCard.test.tsx (Trade figures cases, save and ReviewChanged cases), ReviewCards.test.tsx (two "Trade P&L" figure checks; T95.16's "no meter in the open card header" now looks at the header, and the card-list case at the drawing), MarksStep.test.tsx, ReviewOptionMarks.test.tsx (the Mark line leaves with CardFigures; the payoff summary is behind More figures). Browser: e2e/d4/review.spec.ts, d5r/review.spec.ts, d7s/responsive-a11y.spec.ts, d9r2/history.spec.ts, d7sp/review-dated-line.spec.ts, d9ar/review.spec.ts read the box in place of the retired rows.

**T95.16-F1 checks put back on the drawing:** B5R.11 case 1 (T-A's drawing while its drafts are held; `nowDrawingOf` in d5r/support.ts), B9.11 (the open card's drawing, named and inside the viewport at 1280, 375, 320), B9.9 (the open card's drawing is named as that Trade's row in the Open list; case 13 makes them equal), T7P.11 (the drawing beside the attention sentence at 320 and 375). All four apply.

New browser case: e2e/d95/card.spec.ts "should draw the Now box with its labels, arrows and captions whole inside the viewport at 1280, 375 and 320 wide".

Browser runs: e2e/d95/card.spec.ts 3 passed; e2e/d4/review, d5r/review, d5r/responsive-a11y, d7s/responsive-a11y, d7sp/review-dated-line 9 passed; e2e/d9ar/review, d9/meter-a11y, d9/open-list, d9r2/history, d7p/layout 15 passed.

Review of T95.17 (before the final commit): a line crossed by its condition while the result is inside the lines now reads "$1.00 past Stop" (bold) and hides Reward to risk, as the replay's F2 reads it. `npm run verify:fixtures`: OK, no snapshot changed (the card's new fields are not in any frozen view). One full `npx vitest run src/ui`: 91 files, 1361 tests passed; in an earlier combined run TradeList.test.tsx "Open list" failed once ("expected 2 to be 3") and passed alone and in this run (a timing flake, not this task's).

## T95.17 — The "Now" box (Full)

Commits `5e00f791` (data, T95.17-D1: `DailyTradeReview.expiration { date, sessionsLeft? }`, `datedLastClose.meter`; from what `getTrade` reads; counts pinned) and `eb20b229` (from `a0238c2c`): NowBox and now-box.props; CardFigures removed from the Review card (its cases paired, deleted); the Conditions list retired from the card (statuses stay in Trade Detail and the Replay). Cases 1 to 12 red then green; case 13 and extras first-run, mutation-checked. The four T95.16-F1 checks restored onto the drawing (B5R.11 case 1, B9.11, B9.9, T7P.11). T95.16 case 5 now fully met. Marks line shows dollar change only (percent would be a new figure). "More figures" keeps Trade Detail's existing payoff wording ("max loss: unlimited") rather than W92's "no limit" (keep-existing-wording rule); listed for the word review.

ocr (session 19a40ed2, a0238c2c..eb20b229): 27 files, 3 findings. Valid: **T95.17-B1** "Realized, open" hidden after a sale that nets to zero (gated on the amount, not on a sale). Doubtful: **T95.17-B2** Stop and Target labels can overlap when the lines sit close (no collision handling). Style only, to tech debt: `atEntry != null` loose equality (ReviewCard.tsx 332, 334). `evidence/D95/ocr/T95.17-eb20b229.json`.

### T95.17-B1, T95.17-B2

B1 `e0c4b85c`: "Realized, open" shows after any sale (a `Reduced` or `Closed` marker in the replay up to the shown date, or nonzero realized P&L); no new field. B2 `1c1dc9e6`: real after a sale (both results on one side of $0); when the label boxes overlap, the Target label drops to a second row (measured on layout and resize). Both red then green. Observed once: `ReviewCards.test.tsx` "Loading the Trade…" failed in a full `src/ui` run and passed alone (60 of 60); watched for a repeat.

ocr of T95.17-B1, T95.17-B2 (session c2b70a12): 5 files, 1 finding, Doubtful: the label-overlap check reruns only when the meter's percentages change, not when the label text changes. Bug task **T95.17-B3**. `evidence/D95/ocr/T95.17-B1-B2-1c1dc9e6.json`.

### T95.17-B3

Commit `31bb87f5`: the overlap effect depends on `[at, stopText, targetText]`. Red then green (same places, wider text, Target to row 2).

ocr of T95.17-B3 (session 24bb72f2): 2 files, 0 findings. `evidence/D95/ocr/T95.17-B3-31bb87f5.json`.

Run `t95.17-now-box` (full tier, 19:05): unit 2870 passed; integration 1 failed (`tests/integration/d7sp/review-valuation.test.ts` "should give O-C a card the same dated line as the Trade Views Detail": the card's dated line now carries T95.17-D1's `meter`); browser-2 1 failed (`e2e/d7s/conditions.spec.ts:65` B7S.4: the Review card's Conditions list, retired by T95.17); others passed; checks 14 of 14. Both follow from T95.17's planned changes: follow-on **T95.17-F1**.

### T95.17-F1

Commit `b0a1f067`: the d7sp dated-line test compares the shared fields and checks `meter` apart; B7S.4 checks the Review card has no Conditions heading and reads the four W8 lines in Trade Detail's Conditions (per-share wording there, "$0.10 past", where the old card said "$20.00 beyond"; same status). Each red then green; d7sp 11 passed, e2e/d7s 8 passed.

Run `t95.17-now-box-2` (full tier, 18:41): unit 2870, integration 304, browser 127 + 79 + 55 + 119 (4 skipped), checks 14 of 14. Passed. T95.17 Done.

## T95.18 — Caption lengths and accessible names (Standard)

Commit `5307f1b1` (from `f917ada7`). `caption-fit.ts` picks one of three lengths for both captions by measuring hidden copies; reruns on ResizeObserver. Full sentence kept as the caption's accessible name (`role="note"` + `aria-label`) and title. Four cases red then green; two first-run passes, mutation-checked. Three e2e specs now read the full sentence from `aria-label`. **Flake, second sighting:** `ReviewCards.test.tsx` (card list A150 "should render one card per walked Trade…" and earlier "Loading the Trade…") fails intermittently in a whole-folder `src/ui/screens` run, 2 of 4 on the clean base; passes alone. Follow-on **T95.18-F1**.

ocr (session 70ebe2ba): 9 files, 0 findings. `evidence/D95/ocr/T95.18-5307f1b1.json`.

### T95.18-F1

Commit `b34205bd`: the card-list case read the open card's drawing before `getTrade` filled it; `getByRole` → `await findByRole`. Before: 3 of 4 folder runs failed. After: 1 uncaptured failure in the first 10 runs, then 44 of 44 passed (sequential and 3 or 4 in parallel). The uncaptured one may be the earlier "Loading the Trade…" race; watched — a further sighting gets its own task.

Run `t95.18-captions` (browser-task): unit 2877, integration 304, browser 13, checks 14 of 14. Passed. T95.18 Done.

## T95.19 — The last decision line and "Your last decisions" (Standard)

Commit `f14e8e71` (from `539eed9d`). LastDecisions and LastDecisionLine. Seven cases red then green. Assumption (U6): the list shows in the Action panel; the top line shows only where Action isn't offered (Marks to enter, or a contract to settle); `listShown` in ReviewCard.tsx is where T95.20 and later tasks hook in. Nothing shown with no earlier Action (not the mockup's "First Review of this Trade."). "No Review …" once above the list. 375-wide fold by unit test with stubbed `matchMedia`; browser coverage left to B95.4 (T95.25).

ocr (session 21ef97db): 5 files, 2 findings. Doubtful: **T95.19-B1** with another panel open (e.g. Reflections) and the Action panel closed, neither the list nor the top line shows the last decision. Valid: **T95.19-B2** `--warning-line` on `--tint` is about 3.66:1, below AA 4.5:1, for `.last-decisions-held[data-line='target']` and `.last-decisions-missed`. `evidence/D95/ocr/T95.19-f14e8e71.json`.

### T95.19-B1, T95.19-B2

B1 `b00bec4a`: top line shows whenever the list isn't visible (`listVisible = listShown && open === 'Action'`). B2 `09f6f3d8`: new `--warning-text: #8a5200` (5.57:1 on `--tint`) for the two text rules; `--warning-line` unchanged; computed-contrast unit check. Both red then green.

ocr of T95.19-B1, T95.19-B2 (session aea3e611): 4 files, 0 findings. `evidence/D95/ocr/T95.19-B1-B2-09f6f3d8.json`.

Run `t95.19-last-decisions` (browser-task): unit 2886, integration 304, browser 13, checks 14 of 14. Passed. T95.19 Done.

## T95.20 — The card before its Marks (Standard)

Commit `1a4ef61d` (from `3158ffe4`). Gate on the card's Marks to go: W94 "figures wait" with the box on the session before; W95 "No Action until today's Marks are in" replaces the Action form (kept mounted so drafts survive), with a link to the Marks step; a `ReviewMarksUnresolved` save shows the same words. Cases 1, 2, 4 red then green; case 3 first-run pass, mutation-checked. Existing card cases that assumed an Action form with a Mark to go now start with Marks in.

ocr (session 2ea56bf8): 5 files, 1 finding, Wrong, dismissed: the "Enter them" link does open the Marks step (ReviewView.tsx 424-433 applies each new search string). Reviewer note, not an ocr finding: a click when the address is already that link changes nothing. `evidence/D95/ocr/T95.20-1a4ef61d.json`.

Run `t95.20-before-marks` (browser-task): unit 2890, integration 304, browser 13, checks 14 of 14. Passed. T95.20 Done.

## T95.23 — Capability variants and routes, Part A (Standard)

Structural. `OPERATIONS` and the Review route gain: `DailyReview.open` DaySummary, PlanOrder, LastAction; `DailyReview.getTrade` LastDecisions; `DailyReview.save` SaveReviewMarksPage, MarksFirst. `SaveReviewMarks` stays (still the request kind the page sends). New `tests/integration/d95/capabilities.test.ts` (I95.7) asserts the exact lists, that the Review route presents them, and that every route is installed.
- `npx vitest run tests/integration/d95/capabilities.test.ts tests/integration/d9ar/capabilities.test.ts tests/integration/d9/capabilities.test.ts`: 3 passed.
- `npm run verify:capabilities`: exit 0, "24 operations, 12 variant-qualified, 10 routes".
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`: all exit 0.

Main session on T95.23's note: keeping `SaveReviewMarks` beside `SaveReviewMarksPage` is right; the request kind is unchanged and still sent, and manifest names are labels only. No decision needed.

ocr of T95.23 (session 1fb907e3): 3 files, 0 findings. `evidence/D95/ocr/T95.23-a8eef6af.json`.

Run `t95.23-capabilities` (browser-task): unit 1 failed (`src/coordinators/workspace/workspace.test.ts` "Installed Capability Manifest > should list exactly the public operations and variants through D8": its expected manifest lacks T95.23's new variants); integration 305, browser 13, checks 14 of 14 passed. T95.23 missed this pinned manifest: follow-on **T95.23-F1**.

### T95.23-F1

Commit `6dd789dc`: the workspace manifest pin gains the six variants. Red then green; workspace 131 and the other manifest pins (62) pass.

Run `t95.23-capabilities-2` (browser-task): unit 2890, integration 305, browser 13, checks 14 of 14. Passed. T95.23 Done.

## T95.24 — Integration suite, Part A (Standard)

Commit `78f40087` (from `865200d2`): I95.1 to I95.6, 23 cases in six files plus `tests/integration/d95/support.ts`; no production code. All first-run passes (behaviour built earlier), each mutation-checked; two mutations reach only part of their case (noted in the tdd log). Main session on the binding note: AC-REV-005 is about Action saves; a page Marks save checks the Workspace and each entry's revision, which is what decides whether that Mark changed, so the overview's binding need not be compared. As built.

ocr (session a641c7b7): 7 files, 3 findings. Valid: **T95.24-B1** the R5 case uses stock Trades only, so it never measures an option's dated-line `observations` read. Doubtful: **T95.24-B2** the measured `getTrade` results aren't asserted Ready. Doubtful, no task: a fixed extra preparation snapshot isn't caught by the 1-versus-3 comparison, but `d5r/query-count.test.ts` (202-221) already pins the single snapshot (one safeguard per risk). `evidence/D95/ocr/T95.24-78f40087.json`.

### T95.24-B1, T95.24-B2

B2 `d8c6ef5a`: both measured `getTrade` results asserted Ready. B1 `8593a801`: an O-C Long Call with 1 and 2 fills pins one extra date-wide `observations` read for its dated line, same for both. Test additions, first-run passes, each mutation-checked.

ocr of T95.24-B1, T95.24-B2 (session 32247238): 1 file, 0 findings. `evidence/D95/ocr/T95.24-B1-B2-8593a801.json`.

Run `t95.24-integration` (browser-task): unit 2890, integration 329, browser 13, checks 14 of 14. Passed. T95.24 Done.

## T95.25 — Browser suite, Part A (Standard)

Commit `cfa99464` (from `79c42910`): B95.1 (new day-card.spec.ts), B95.2, B95.4 added through `atBothWidths` (1280 and 375); B95.3 and B95.5 already covered. Six cases, all first-run passes (behaviour built earlier), each mutation-checked; B95.2's mutation reaches only the fix-in-place words. e2e/d95: 14 passed in 40 s. "Edit with a reason for an earlier session" left to its integration case. A325: browser-4 ran 3:18 and 3:22 in the last two full runs (t95.16, t95.17-2; the 13.7 min tech-debt figure predates the shared setups), well under 8 minutes, so no browser-5 stage. The full run at T95.25 confirms.

ocr (session 870d4727): 5 files, 2 findings. Valid: **T95.25-B1** marks-step's fix-in-place never checks the corrected ABC Mark (27.00) was saved. Valid in part: **T95.25-B2** typing, Save Marks and Edit are driven only at 1280; 375 re-checks only the folded state. Scope: drive the Marks step's type, save and fix-in-place at 375 in marks-step.spec.ts; resizing with typed state stays B95.17's (Part B). `evidence/D95/ocr/T95.25-cfa99464.json`.

### T95.25-B1, T95.25-B2

Commit `6d25dc13` (both): B1 reloads the Review after the fix and asserts ABC reads 27.00 (red with the second save discarding drafts, at both widths); B2 runs the whole flow at 1280 and 375 from the shared `openCardFixture` setup, every assertion kept (+1.4 s). No 375-only behaviour to mutate.

ocr of T95.25-B1, T95.25-B2 (session 47ad248d): 1 file, 0 findings. `evidence/D95/ocr/T95.25-B1-B2-6d25dc13.json`.

Run `t95.25-browser` (browser-task): unit 2890, integration 329, browser 20, checks 14 of 14. Passed. T95.25 Done.

## T95.26 — Part A gate

Run `t95.26-gate` (browser-full, 26m31s): unit 2890, integration 329, browser-3 55, browser-4 126 (4 skipped), checks 14 of 14 passed. Failed 6 older browser cases, all on the open Action form: `e2e/d4/card-helpers.spec.ts` 39, 59 and 140; `e2e/d5r/marks.spec.ts:79` (B5R.5); `e2e/d5r/responsive-a11y.spec.ts:8` (B5R.11); `e2e/d4/runtime-failure.spec.ts:7` (B4.10, expects "No Action saved."). Cause: T95.20 offers no Action form until the Trade's Marks are in (W95); these cases type an Action with Marks still owed. T95.20 ran only the specs it named; the full tier wasn't run after it (Standard). Follow-on **T95.20-F1**. The browser runner's report was lost (its first hand-back was a placeholder); this record is from the output files.

### T95.20-F1

Commit `9ec06f79`: card-helpers 39, 59 and 140, B5R.5 and B5R.11 save the Trade's Review Date Mark first (B5R.11's draft moves to T-C's Monday cell; its labels, To-do text and keyboard start follow the new order; every check kept). B4.10 left failing: a product defect. In Recovery Only, ABC's card says "No Action until today's Mark is in. Enter it" with a link to a Marks step that has no Price field; `ActionForm.tsx` 194 (`toGo > 0` → MarksFirst) runs before 195 (read-only → "No Action saved."). Bug task **T95.20-B1**.

### T95.20-B1

Commit `f988238f`: the read-only New-form branch now comes before the Marks-first branch in `ActionForm.tsx`. Red then green; src/ui 1384 passed; B4.10 and e2e/d95 17 passed.

ocr of T95.20-B1 (session 8667b40f): 2 files, 0 findings. `evidence/D95/ocr/T95.20-B1-f988238f.json`.

Run `t95.26-gate-2` (browser-full, 20m06s): integration 329, browser 127 + 79 + 55 + 126 (4 skipped), checks 14 of 14 passed; unit 1 failed: `src/ui/screens/TradeList.test.tsx:154` Open list states, `marks('tj:open-list-ready')` 2 not 3. This is tech debt item 11's load flake (seen in D5, once during T95.17, now); it passed 5 of 5 alone in the main session. Decision 116 allows one rerun for it; the browser tier the critic stands on passed in full, so the critic proceeds on this run, and the flake gets its own fix task, **T95.26-F1**, after the critic (no code changes while a critic runs).

### Critic-1 (T95.26)

Report `evidence/D95/critic-1.md`. Overall PASS; 2 moderate, 4 low. Cost: 315,588 tokens, 250 tool calls, 29.1 min; brief `self.criticBrief` v1; defects found.

| Critic | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|
| critic-1 | 315,588 | 250 | 29.1 min | 2 moderate, 4 low |

Moderate, bug tasks: **T95.26-B1** a Trade past its Stop on the Underlying with its option Mark unavailable is labelled and ranked "No price today" (spec: boundary-reached status stays in its higher band), while the day card says it's past the Stop. **T95.26-B2** at 320 the Expiration row breaks between "−" and "$2,016.00". Low, to tech debt: defects 3, 4, 5, 6. Brief note: `e2e/d95/support.ts` doesn't re-export d1's support as the template assumes; fix the brief for critic-2.

### T95.26-B1

Commit `e7366355`: `attentionOf` counts the Underlying-only crossed-line reading (the one the day card and Trade Detail use) for the band; a Stop crossed that way is StopReached, a Target TargetReached; overrun optional, pressure stays Unavailable, no figure invented. Red then green in a coordinator test and `tests/integration/d95/stop-unavailable.test.ts` (MNO short put, option Mark unavailable). e2e/d95 and e2e/d9ar 85 passed.

ocr of T95.26-B1 (session f14acec8): 3 files, 0 findings. `evidence/D95/ocr/T95.26-B1-e7366355.json`.

Run `t95.26-b1` (browser-task): unit 2892, integration 330, browser 20, checks 14 of 14. Passed.

### T95.26-B2

Commit `2bd629f7`: new `Figures` wraps each signed money figure in `.nowrap`; the Now box uses it for row values and the Marks' change. Plan box has no signed figure. Red then green (browser, DALE at 320: "−$2,016.00" broken). e2e/d95 and e2e/d9ar 86 passed.

ocr of T95.26-B2 (session a4136929): 3 files, 0 findings. `evidence/D95/ocr/T95.26-B2-2bd629f7.json`. T95.26-F1 (Light, test-only) goes next; B2's quick run follows it and covers both.

### T95.26-F1

Commit `ce3e1043`: `tj:open-list-ready` is emitted from a `useEffect` after the Ready render; the three count assertions after a `findBy` now `await waitFor`. Under load 1 of 12 failed before; 0 of 10 after. Product unchanged. Tech debt item 11's unit flake closed. B2's quick run is folded into the full run that follows (the full tier contains the task tier).

Run `t95.26-gate-3` (browser-full, T95.26-B1, T95.26-B2, T95.26-F1): unit 2892, integration 330, browser 127, 79, 55 and 127 (4 skipped), checks 14 of 14. Passed. It covers T95.26-B2's quick run. Critic-2 follows.

### Critic-2 (T95.26)

Report `evidence/D95/critic-2.md`. Overall PASS; 3 moderate, 2 low. Cost: 285,710 tokens, 206 tool calls, 35.2 min; brief `self.criticBrief` v2 (support imports fixed); defects found. Critic-1's B1 and B2 confirmed fixed.

| Critic | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|
| critic-2 | 285,710 | 206 | 35.2 min | 3 moderate, 2 low |

Moderate, bug tasks (not started; the user asked to stop after critic-2 for a Claude Code update): **T95.26-B3** a Trade with a partial sale shows a label percent from the meter's P&L share (AXIO "86% to Stop") while the card's own line and the spec's Pressure give 67%. **T95.26-B4** at 320 "Your last decisions" breaks between "−" and "$1,040.00" (B2 fixed only the Now box). **T95.26-B5** a card whose option Mark is acknowledged unavailable does not say so (no "No price today", Now box shows the session before's Marks). Low, to tech debt: defects 4, 5. After B3, B4 and B5: a full run, then critic-3 (the last before asking the user).

The user (2026-11-23): fix T95.26-B3 and T95.26-B4; T95.26-B5 (the unavailable option Mark not shown on its card) moves to tech debt and is not a bug task. After B3 and B4: a full run, then critic-3.

### T95.26-B3

Commit `21656a1a`: `describedLabelsOf` (src/ui/screens/review-attention.ts) words the label percent from the Trade's `basis.share` (the spec's Pressure, the figure the line already shows) instead of the meter's P&L share; the coordinator was already right and the attention order already sorts on `basis.share`. AXIO 67% to Stop, BREN 58% to Target, DALE 61%. Red (unit: "86% to Stop" vs "67% to Stop"), green; browser `e2e/d95/pressure-label.spec.ts` at 1280 failed on the old code, passed twice. First-run pass flagged: the coordinator case (the coordinator was already right; mutation in attention.ts failed it). `tests/support/replay-series-stack.ts` no longer sends an exercise intent for a stock plan.

ocr of T95.26-B3 (session fe810424): 6 files, 1 finding, Valid. `evidence/D95/ocr/T95.26-B3-21656a1a.json`. **T95.26-B6** (`review-attention.ts:40`): the label is still gated on the meter's share, which is absent when total P&L is exactly zero, so a partly sold Trade with a valid Pressure gets no label.

### T95.26-B6

Commit `049abeca`: `describedLabelsOf` builds the share label from the Pressure `basis` alone, no longer gated on the meter's share (absent when total P&L is zero). Red ("expected [] to deeply equal [ { label: '67% to Stop' … } ]"), green; src/ui/screens 768 passed. Agent's note: with a Pressure Value and the meter Unavailable, a label now shows, consistent with the card's line.

ocr of T95.26-B6 (session 5497543c): 2 files, 0 findings. `evidence/D95/ocr/T95.26-B6-049abeca.json`. T95.26-B4 goes next; the quick runs of B3, B6 and B4 are folded into the full run that follows (the full tier contains the task tier), as with B2.

### T95.26-B4

Commit `8e2f88e7`: `LastDecisions.tsx` wraps the signed Trade P&L in `Figures` (B2's component). Red at 320 ("AXIO: signed figures broken across lines at 320: Received ["−$1,040.00"]"), green; new `e2e/d95/last-decisions.spec.ts`. A temporary widened check over the whole AXIO and DALE cards at 320 found no other break. Prettier --check warns on LastDecisions.tsx and the new spec (lint passes).

ocr of T95.26-B4 (session 94056617): 2 files, 0 findings. `evidence/D95/ocr/T95.26-B4-8e2f88e7.json`. Next: full run `t95.26-gate-4` (covers the quick runs of T95.26-B3, T95.26-B6 and T95.26-B4), then critic-3.

Run `t95.26-gate-4` (browser-full, T95.26-B3, T95.26-B6, T95.26-B4; about 20:01): unit 2895, integration 330, browser 127, 79, 55 and 129 (4 skipped), checks 14 of 14. Passed. It covers the quick runs of B3, B6 and B4. Critic-3 follows (the gate's last; brief rebuilt from critic-2's after a session restart, with the known tech-debt items listed and the fixes to check).

The user (2026-11-24): if critic-3 passes, add **T95.26-F2**: `src/app/bench-generator.test.ts` restores the benchmark smoke artifact about 7 times (about 5-6 s each, about 40 of the unit stage's 53.8 s in that one file); restore once and share the loaded app across as many tests as feasible. Answer (a): `viewsOfRestored` in `src/app/bench-generator.ts` may take an already-restored app (ocr review for that change). Verification: the file's tests pass, then one full suite run; no critic.

### Critic-3 (T95.26)

Report `evidence/D95/critic-3.md`. Overall PASS (C95.1, C95.2, C95.3, C95.4); 1 moderate, no low. Cost: 253,884 tokens, 177 tool calls, 23.7 min; brief rebuilt from critic-2's; defects found. T95.26-B3 and T95.26-B4 confirmed fixed.

| Critic | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|
| critic-3 | 253,884 | 177 | 23.7 min | 1 moderate |

Moderate 1: on a partly sold Trade the drawing's name, the collapsed header's meter and the Open list row's meter say "86% of the way to the Stop" (the shared meter's P&L share, T95.17 case 13, S12: the shared meter is not edited), while the label and line say 67% (Pressure). The third critic leaves a moderate defect: asked of the user (the gate cap).

### T95.26-F2

Commit `dc09ad2f`: `viewsOfRestored` restores then calls a new exported `viewsOfApp(port, app, expected)` (same checks); the test's views port keeps the app `smokeWithViews()` restored, and the Open rows, Review walk order and membership failure tests share it, reading only. File 44.29 s before, 16.59 s after (Open rows 12.3 → 6.7 s, walk 5.5 s → under 0.1 s, membership 16.7 s → under 0.1 s). Each changed test broken once and restored (tdd-log). The prepareRestore test is unchanged (a different path). 24 of 24 pass.

ocr of T95.26-F2 (session a5546e98): 2 files, 0 findings. `evidence/D95/ocr/T95.26-F2-dc09ad2f.json`. Next: full run `t95.26-f2` (the user: a full suite run, no critic).

Run `t95.26-f2` (browser-full, 19 min 11 s): unit 2895 in 25 s (was 53.8 s in t95.26-gate-4), integration 330, browser 127, 79, 55 and 129 (4 skipped), checks 14 of 14. Passed. T95.26-F2 done (Progress row added).

The user (2026-11-24) chose (a) for critic-3's moderate defect: it goes to tech debt. `acceptance-commands.sh plan/D09.5-daily-review-redesign.md`: 43 commands checked, 26 failed; every failing command names a Part B or Part C file (d95/plan-rule, action.spec, d95/sale-plan-exit, sale.spec, d95/settle-later, settle-later.spec, d95/expiration-reason, expiration.spec, d95/close-review, d95/seed-6, resize.spec, keyboard-day.spec, offline.spec, d95/not-writable, d95/restore-seed, d95/rebuild), as expected until those parts write them. **The T95.26 gate is closed; Part A is complete.**

### T95.27

Commit `d5f4ada1`: 13 cases in `src/modules/journal/seed-revision.test.ts`. New: `SEEDED_MANIFESTS` (D1 to D5) in manifest.ts (a manifest revises only a type whose latest stored form equals an earlier manifest's form; T95.28 appends D6); `PromptRole` gains PlanDepartureReason and ExpirationReason (Text prompts only); `PromptOption.protected?`; Defer carries `requires?`, kept on the stored Debt, `PreparedDebt` and `DebtProjection`; restore accepts them; a revised type's key in `additions`. First-run passes flagged and mutation-checked: cases 4, 5, 6, 7, 8. Code for cases 2 and 3 was written before their reds, backed out, re-added after genuine reds. Existing `journal.test.ts` SeedConflict case moved to manifest version 1 (a version-2 change is now a revision). No schema change.

ocr of T95.27 (session 5bb57fab; two earlier runs failed on provider errors): 7 files, 4 findings, all Doubtful. `evidence/D95/ocr/T95.27-d5f4ada1.json`. Style-only (`records.ts:4`, PromptRole shared with SingleSelect) to tech debt. Correctness, bug tasks:
- **T95.27-B1** (`journal.ts:246`): a stored revision equal to the manifest skips the check on the latest revision, so an unrecognized later revision is not a SeedConflict.
- **T95.27-B2** (`journal.ts:446`): a deferral accepts `requires` roles with no matching Text prompt in the pinned form, making a Debt that can never be resolved.
- **T95.27-B3** (`journal.ts:679`): the required-role check counts a non-Text answer as answering the required Text prompt.
The three are small and in one file; one fresh tdd-task does them in order, one commit each.

### T95.27-B1, T95.27-B2, T95.27-B3

Commits `5e904f21` (B1: the seed looks only at the latest stored revision: equal to the manifest adds nothing, equal to an earlier seeded form adds the next revision, else SeedConflict), `5d17e26e` (B2: a deferral whose `requires` role has no Text prompt in the current revision is refused, `DispositionNotAllowed`), `b44f35cf` (B3: a required role is answered only by a non-empty Text answer). Red then green each; Journal module 328 passed. `validateForm`'s acceptance of a non-Text answer for an ordinary Text prompt pre-dates D9.5 and is unchanged.

ocr of T95.27-B1, T95.27-B2, T95.27-B3 (range d5f4ada1..b44f35cf, session 1e68c1c0): 2 files, 0 findings. `evidence/D95/ocr/T95.27-B1-B3-b44f35cf.json`. Next: run `t95.27-seed-revision` (browser-auto af6d3071).

Run `t95.27-seed-revision` (browser-auto af6d3071, task tier): unit 2911, integration 330, browser 5 + 18, checks 14 of 14. Passed. T95.27 done.

### T95.28

Journal seed manifest 6 (`D6_JOURNAL_MANIFEST`, appended to `SEEDED_MANIFESTS`) and its delivery. Wired in `workspace.ts` (a start, a new Workspace, both receipts), `migration.ts`, `restore.ts` and `bench-generator.ts`. Decisions recorded:
- A323: a backup's Journal seed version for a current-schema Workspace is read from its stored forms (`seededManifestVersion` in journal.ts, called by `exportBackup` for a KnownWorkspace); the per-schema table stays for databases the release has not migrated and as the fallback if the read fails. A schema-7 Workspace not yet started on this release (still manifest 5) therefore still exports as 5, which I8.3 needs (its fresh export of W7 equals the committed A7 digest). No new stored field, so no pending decision.
- A revised form's definition identity is `<entryTypeKey>.revision-<n>`, not a minted id. Reason: `verify:fixtures` compares a restored backup's views with the matching Workspace fixture's, and a minted id differs by route (`verify-` against `restore-` prefix, and a candidate id shifts the count), so no one expected value could satisfy both. New types keep minted ids.
- `DAILY_TRADE_REVIEW_PROMPTS.intent` is now "Why?"; `earlierIntent` keeps manifests 3 to 5's wording, which D3 still reads, and ActionForm reads an Action saved under either wording.
- Restore's preview `seedAdditions` and a migration receipt's journal additions list new Entry Types only, so they do not name a revised type (the Workspace start receipt does, case 7). Not asked for by a case; left.
- Until T95.32 lands, a Daily Review Exit or Hold saves with no reason (the Journal form now requires one only for Roll and Adjust); T95.32 adds the Plan Call rule.

Fixture diff (`npm run verify:fixtures` passes; `dump.json`, `backup.tjbackup` and `downloaded.json` untouched): only `"definitionRevision"` values in `reviewTrades[]` of each older fixture's `expected-views.json`, to `entry-type.daily-trade-review.revision-2`: workspace-v3 and backup-v3-blocked 1 line (fx-0004), workspace-v4 and backup-v4-blocked 1 (fx-0004), workspace-v5 and backup-v5-blocked 5 (fx-0008), workspace-v6 and backup-v6-blocked 6 (fx-0011), workspace-v7 and backup-v7 7 (fx-0011). No `definitionId` value changed: verify reports none (a saved Action keeps the revision it was saved under).

Checks: typecheck, tsc6, lint (0 errors; 2 existing warnings), lint:deps, verify:fixtures, verify:capabilities, verify:capacity pass. Browser: e2e/d4/responsive-a11y, e2e/d4/runtime-failure, e2e/d5r/responsive-a11y (the "Why?" label): 11 passed.

Main session on T95.28 (`3cee01da`): accepted (implementation-level, recorded) the deterministic revision id `<entryTypeKey>.revision-<n>` so a restored backup and its Workspace fixture agree under verify:fixtures; the fixture diff is only `definitionRevision` values in `reviewTrades[]` (the frozen-view change T95.28 is allowed). Accepted: `seededManifestVersion` for A323 (no stored field); the I5.10 "blank required prompt" case removed (no Position Change Reflection prompt is required now); the one-line `ActionForm.tsx` change that reads a reason saved under either wording. Temporary until T95.32: an Exit or Hold saves with no reason. Words: the Action form's reason label "Why?" (planned X8). First-run passes flagged and mutation-checked: case 5, case 11 (Journal side), the "manifest 5 stays as seeded" guard.

ocr of T95.28 (session 26d354ec, second run; the first had 8 stream failures): 48 files selected, 43 reviewed, 5 failed on provider stream errors (test and support files only: closed-views.test, option-views.test, replay-trade.test, tests/support/closed-trade-review-fixture.ts, tests/support/replay-series-stack.ts; recorded, not re-run). 5 findings. `evidence/D95/ocr/T95.28-3cee01da.json`.
- **T95.28-B1** (Valid, `migration.ts:192`): the migration receipt lists only new Entry Types, not the revised ones; the start receipt names them (case 7).
- **T95.28-B2** (Valid, `bench-generator.ts:407`): `closeReviewAnswers` gives the now-required key lesson only for even, non-deferred Trades, so the benchmark writes Close Reviews with an Unanswered required prompt.
- **T95.28-B3** (Doubtful, `backup.ts:211`): the Journal seed version is read in a separate snapshot from the export.
- Dismissed as planned later work: `ActionForm.tsx:158` still marks the reason required for Exit (T95.33 case 4 sets the form's rule); `save.test.ts:133` has no "Exit with no reason saves" case (T95.32 case 4).

### T95.28-B1, T95.28-B2, T95.28-B3

Commits `9998748f` (B1: the migration receipt names revised Entry Types as `seedDefaults` does; d4, d5, d6 migration expectations updated), `707765c8` (B2: `closeReviewAnswers` always answers the key lesson; generator version and marker 9), `1a8fb348` (B3: the export snapshot reads `journalDefinitions` in its own transaction; `ExportJob.journalSeedFromForms` for a current-schema Workspace; `storedJournalSeed` removed; the race is shown by a table value no stored form matches). Red then green each; 714 tests in the touched folders passed.

ocr of T95.28-B1, T95.28-B2, T95.28-B3 (range 3cee01da..1a8fb348, session 9a152bc6): 14 files, 0 findings. `evidence/D95/ocr/T95.28-B1-B3-1a8fb348.json`. Next: run `t95.28-seed-6` (browser-auto a3578e49).

Run `t95.28-seed-6` (browser-auto a3578e49, full tier): unit 2928, integration 329, checks 14 of 14 passed; browser 16 failed (browser-1 2, browser-2 8, browser-3 3, browser-4 3): d4/card-helpers:39, d4/no-save:38, d6/close-review:41 ("Answer “What is the key lesson?”."), d6/exit-action:9, d6/exit:10, d6/kill:9, d6/offline:11, d6/responsive-a11y:28, d7/kill:8, d7/responsive-a11y:225, d8p/journal-final-session:14, d8p/lot-matches-fit:55, d8p/states:101, d9ar/responsive-a11y:230, d9ar/review:28, d9ar/review:82. Manifest 6 (key lesson required, "Why?" label, optional reflections) broke browser setups that T95.28's agent did not run. Fix: **T95.28-F1** in a fresh tdd-task.

### T95.28-F1

Commit `7e2938c6`: `answerCloseReviewIn` (e2e/d6/support.ts, used by the d7, d8p, d9 and d8r helpers) also answers "What is the key lesson?"; d6 and d7 responsive-a11y keyboard exits gain one Tab stop and the lesson; the reason label matcher `/^Why\?/` in d4/card-helpers, d4/no-save, d9ar/review (two) and d9ar/responsive-a11y. No assertion dropped; no product code. d4 27 passed; d6, d7, d8p, d9ar passed.

ocr of T95.28-F1 (session cf6944ad): 7 files, 0 findings. `evidence/D95/ocr/T95.28-F1-7e2938c6.json`. Next: run `t95.28-seed-6-2` (browser-auto a3578e49).

Run `t95.28-seed-6-2` (browser-auto a3578e49, full tier, after T95.28-F1): unit 2928, integration 329, browser 127, 79, 55 and 129 (4 skipped), checks 14 of 14. Passed. T95.28 done.

### T95.29

Commit `b6d31abe` (tests and helpers only; 38 files): sale reflections in helpers carry a Plan Departure Reason (`completeSale`, `saleReflection`, browser `answerSaleIn`); a closing sale's Close Review is deferred and resolved through the Debt (`resolveCloseReview`, `answerCloseReviewOnDetail`); `closeTheTrade(page)` takes no argument. Red came from a temporary stand-in for T95.36's rule in record-position-change.ts (removed; `git diff -- src` holds tests only); 13 red/green rows. Retired parts: AC-POS-004 "for each disposition" now defers and resolves through the Debt (source `source.trade-detail`); the Catalog resolution case lost its Close Review form-issue half. `eslint-suppressions.json` pruned (two entries the edit removed; one for the deleted CardFigures.tsx). Unchanged: d8/backup.test (seed 5 fixture, no Plan Departure Reason prompt; note for T95.36). Unit and integration 3257 passed; e2e d6, d7, d7p, d8p 48 passed.

ocr of T95.29 (session 5ded078d): 39 files, 0 findings. `evidence/D95/ocr/T95.29-b6d31abe.json`. Next: run `t95.29-helpers` (browser-task).

Run `t95.29-helpers` (browser-task): unit 2928, integration 329, browser 5 + 18, checks 14 of 14. Passed. T95.29 done.

### T95.30

Commit `e0e2a55e`: new `src/domain/trade-analysis/plan-call.ts` `planCall(evaluation)` → `{ call: 'Out' | 'Hold' | 'Unknown'; condition? }`; `ReplayedSession.planCall?` filled by `replay`. Seven cases; first-run pass flagged and mutation-checked: case 5 (either of two headline conditions). Decisions recorded (implementation-level): headline conditions from the Plan Baseline's nearest line per role (A197); Out names the reached condition, the Stop when both; Unknown names the first unreadable headline condition; an option with its contract Mark missing is Unknown even if the Underlying crossed; nothing held is Unknown. trade-analysis 287 passed.

ocr of T95.30 (session 5ac8cb60; round 2 hit a provider overload, marked complete): 4 files, 1 finding, Valid. `evidence/D95/ocr/T95.30-e0e2a55e.json`. **T95.30-B1** (`plan-call.ts:25`): `planCall` reads only each condition's dollar `result`, ignoring `underlyingReading` (A110), so an option with its contract Mark missing and its Underlying past the headline Stop is Unknown, not Out; `replay-series.ts` `statusOf` and T95.26-B1's `attentionOf` already use the Underlying-only reading. This reverses T95.30's recorded "Unknown even if the Underlying crossed" choice, for consistency with the day card, Trade Detail and the attention band.

### T95.30-B1

Commit `e7092508`: `planCall` reads a condition's status from `result`, or from `underlyingReading.status` when `result` is Unavailable; an Underlying-only crossing gives Out (Stop named first when both). An uncrossed Underlying-only reading counts as read for that condition; Unknown stays when any headline condition has no reading (A110 doesn't say an Underlying-only reading alone makes Hold). Red "expected 'Unknown' to be 'Out'", green; second case a first-run pass, mutation-checked. trade-analysis and ui 1676 passed. `statusOf` duplicated from replay-series.ts (not exported there).

ocr of T95.30-B1 (session 5d915602): 2 files, 0 findings. `evidence/D95/ocr/T95.30-B1-e7092508.json`. Next: run `t95.30-plan-call` (browser-task).

Run `t95.30-plan-call` (browser-task): unit 2937, integration 329, browser 5 + 18, checks 14 of 14. Passed. T95.30 done.

### T95.31

Commit `4803ac91`: `WalkedTrade.planCall?` and `DailyTradeReview.planCall?` (from the evaluation already read; no request count moves); a new Action's `viewState.selectedAction` is 'Hold' only when the call is Hold, else `{}`. First-run passes flagged and mutation-checked: Hold selected for Hold, nothing for Unknown, a saved Action returned as saved, nothing recorded on open (a first mutation threw a TypeError and was redone). Bridge outside the Files line: `ActionForm.tsx` `selectedAction ?? 'Hold'` keeps today's screen until T95.33. 2,760 tests in the touched folders passed.

ocr of T95.31 (session 37fe31a8): 5 files, 1 finding, Doubtful (`ActionForm.tsx:83`: the `?? 'Hold'` bridge re-selects Hold when the coordinator selects nothing). Not a bug task: it is the recorded bridge, and T95.33 (items 2, 5, 10) builds the form with nothing chosen; carried to T95.33's brief. `evidence/D95/ocr/T95.31-4803ac91.json`. Next: run `t95.31-plan-call-page` (browser-auto a54d6298).

Run `t95.31-plan-call-page` (browser-auto a54d6298, full tier): unit 2943 passed; browser 127, 79, 55, 129 (4 skipped) passed; integration 10 failed (d7/migration, d7s/migration two, d8/blocked I8.10, d8/round-trip three, d8r/restore three) and `verify:fixtures` failed: workspace-v5, workspace-v6, workspace-v7, backup-v5-blocked, backup-v6-blocked, backup-v7 views differ at `reviewTrades[n].form.viewState.selectedAction` (A307: Hold only when the Plan Call is Hold). P174 as amended by decision 127 allows a frozen derived-view change the redesign causes, with no figure or computation changed and the diff recorded: **T95.31-F1** updates the six `expected-views.json` at those values only.


### T95.31-F1

Updated the frozen `expected-views.json` of six fixtures for T95.31 (P174 as amended by decision 127: a derived view the redesign changes, no figure or computation changed; `dump.json` and `backup.tjbackup` untouched). Cause: a new Action's `form.viewState` is `{ selectedAction: 'Hold' }` only when the Plan Call is Hold (A307), else `{}`. The compare lists every differing path; before the edit all were `reviewTrades[n].form.viewState.selectedAction` and nothing else. After: each `"viewState": { "selectedAction": "Hold" }` became `"viewState": {}` (no Review Trade kept Hold: every one is Out or Unknown). No tool regenerates a single value, so the edit was exact-text.

| Fixture | reviewTrades changed |
| --- | --- |
| workspace-v5 | 5 (0 to 4) |
| workspace-v6 | 6 (0 to 5) |
| workspace-v7 | 7 (0 to 6) |
| backup-v5-blocked | 5 (0 to 4) |
| backup-v6-blocked | 6 (0 to 5) |
| backup-v7 | 7 (0 to 6) |

Diff: 6 files, 36 insertions, 108 deletions (36 viewState objects, 3 lines each to `{}`). Green: `npm run verify:fixtures` OK (all workspace and backup folders views equal); the 10 integration tests (d7/migration, d7s/migration I7S.1 two, d8/blocked I8.10, d8/round-trip I8.12 three, d8r/restore I8R.6 three) pass, as do their folders (tests/integration/d7, d7s, d8, d8r) and tools fixture-views and verify-fixtures tests: 49 files, 133 tests.

ocr of T95.31-F1 (session 42827c8f, with a scratch rule including the fixture views; the repo rule skipped them, to tech debt): 6 files, 0 findings. `evidence/D95/ocr/T95.31-F1-efdae00f.json`. Next: run `t95.31-plan-call-page-2` (browser-auto a54d6298).

Run `t95.31-plan-call-page-2` (browser-auto a54d6298, full tier, after T95.31-F1): unit 2943, integration 329, browser 127, 79, 55 and 129 (4 skipped), checks 14 of 14. Passed. T95.31 done.

### T95.32

Commit `096be3e1`: the reason rule in `saveTradeAction` (A308): `IntentRequired` refuses a Hold without a reason when the call is Out, an Exit without one when the call is Hold, Roll and Adjust without one at any call, the Unknown rule, a reason of spaces, and a changed saved Action; every Action saved as intent only. The Plan Call is read only when a Hold or Exit has no reason, so saves with a reason keep their request counts. First-run passes flagged and mutation-checked: cases 1, 3, 4, 10. Existing tests that save a Hold past a line now give a reason (save, save-day, d95/day, d5r/gap-trades, d5r/save-marks, d5/rebuild, d5/review-debt). One-line UI bridges: ActionForm.tsx (IntentRequired as RequiredAnswerMissing), ReviewReflections.tsx (skips it). No fixture change.

ocr of T95.32 (session f3758c73): 12 files, 1 finding (Valid in the UI, `ActionForm.tsx:159`: the form still requires a reason for every Action but Hold, so an Exit with no reason on an Out call can't be saved from the screen). Not a bug task: T95.33 case 4 ("mark it required as the rule says") is planned next and builds that form; carried into T95.33's brief. `evidence/D95/ocr/T95.32-096be3e1.json`. Next: run `t95.32-reason-rule` (browser-auto e7815aa7).

Run `t95.32-reason-rule` (browser-auto e7815aa7, full tier): unit 2953, integration 329, browser-3 55, checks 14 of 14 passed; browser 6 failed: d4/offline:20, d4/responsive-a11y:138, d5r/review:8, d95/day-card:40, d95/last-decisions:7 (each "pressSave: the app refused the save and shows: 'Say why you are taking this action.'", the T95.32 rule on a Hold past a line), and d5r/responsive-a11y:8 (toHaveText, not yet traced). Fix: **T95.32-F1** in a fresh tdd-task.

### T95.32-F1

Commit `3934d569` (six specs): each Hold the rule now refuses gets the reason "Holding as planned." (d4/offline, d4/responsive-a11y, d5r/review, d95/day-card, d95/last-decisions); B5R.11 (d5r/responsive-a11y) had the same cause (ABC past its Stop), now Tabs to "Why?" and types the reason, still keyboard only. No assertion dropped; no product defect. d4, d5r, d95 61 passed.

ocr of T95.32-F1 (session 6b635650): 6 files, 0 findings. `evidence/D95/ocr/T95.32-F1-3934d569.json`. Next: run `t95.32-reason-rule-2` (browser-auto e7815aa7).

Run `t95.32-reason-rule-2` (browser-auto e7815aa7, full tier, after T95.32-F1): unit 2953, integration 329, browser 127, 79, 55 and 129 (4 skipped), checks 14 of 14. Passed. T95.32 done.

### T95.33

Commit `45cdf246`: the Action form: the Plan Call line above the choices, Hold chosen only when the view returns it ("Nothing is chosen for you here."), what the Action means for the Plan, "Why?" required exactly as the shared rule `reasonOwed` (new `src/domain/reason-rule.ts`, used by the save and the form), "Choose an Action." / "Say why.", "Save Hold" etc., Conviction as five buttons, "Add more", Discard, the saved Action as one line with "Change", a saved Exit "Not done…", "No price today: deciding on the … figures.", two rows at 375 (browser case). Added case: the form follows a late preselection until the trader chooses (a bug the browser run found). Case 12's code was written ahead of red; backed out, red, green. First-run pass flagged and mutation-checked: case 6. ReviewCard.tsx (outside the Files line) passes planCall, replay, decidingOn. 29 specs that save or read an Action passed, with older tests updated to the planned form (Save name regex, saved-line texts, Conviction, "Say why.", no-save opens "Add more", d5r/responsive-a11y chooses Hold). New words in new-words.md (Part B); changes in words-changed.md.

ocr of T95.33 (session fff4c78a): 21 files, 2 findings, both Valid. `evidence/D95/ocr/T95.33-45cdf246.json`.
- **T95.33-B1** (`ActionForm.tsx:125`): the form follows a changed preselection whenever the current Action equals the old one; a trader who chose Exit then Hold loses the explicit Hold when the preselection becomes empty (no flag records an explicit choice).
- **T95.33-B2** (test, `e2e/d5r/responsive-a11y.spec.ts:105`): the keyboard-only section now picks Hold with `check()`, so the keyboard path to the Action radios is no longer exercised.

### T95.33-B1, T95.33-B2

Commits `98860c07` (B1: a `chose` flag set by any radio change ends following the view's preselection; Discard clears it; a restored draft counts as chosen; red "expected [] to deeply equal [ 'Hold' ]", green) and `00361cce` (B2: the keyboard-only section reaches Hold by Tab and selects it with Space; mutation tabIndex=-1 failed with "focus ring on BODY", restored). ActionForm.test 19 passed; the browser case passed.

ocr of T95.33-B1, T95.33-B2 (session dfe0f83c): 3 files, 1 finding, Valid: **T95.33-B3** (`ActionForm.tsx:282`): clicking or pressing Space on the already-checked preselected Hold fires no onChange, so `chose` stays false and a later loss of the preselection clears the confirmed Hold. `evidence/D95/ocr/T95.33-B1-B2-00361cce.json`.

### T95.33-B3

Commit `dbdfa898`: the Action radio also sets `chose` on click (Space on a checked radio fires a click). Red "expected [] to deeply equal [ 'Hold' ]", green; ActionForm.test 20 passed.

ocr of T95.33-B3 (session c1613295): 2 files, 0 findings. `evidence/D95/ocr/T95.33-B3-dbdfa898.json`. Next: run `t95.33-action-form` (browser-auto d485fdbe).

Run `t95.33-action-form` (browser-auto d485fdbe, full tier): unit 2973, integration 329, browser 127, 79, 55 and 130 (4 skipped), checks 14 of 14. Passed. T95.33 done.

### T95.34

Commit `785eee18`: the refusal on the Trade pressed (W128; X5 names W122, built to W128): "<Underlying>'s note isn't saved." with "Save it" (focused; saves through the form's own save, then opens the Trade pressed; stays on the form's own refusal when it can't save), "Discard it", "Back to <Underlying>"; Marks-step drafts don't refuse. New `Refusal.tsx`, `form-handle.ts` (FormHandle {save, focus}); ReviewView, ActionForm, DebtForm, ReviewReflections edited (outside the Files line). Assumption: "Save it" on a reflection draft presses its Answer (an added case). First-run pass flagged and mutation-checked: case 7. Case 4 passed first because case 3's code held the guard; guard removed, red, restored. Known edges recorded: a day-line link's panel is lost after Save it/Discard it; with two unsaved forms Save it saves the first and refuses again. Same-Underlying wording question added to new-words.md. e2e d4/support (reachCard, refusal()) and two specs follow the new words; d95 and d5r 35 passed.

ocr of T95.34 (session 42f4e726): 14 files, 4 findings, all Valid. `evidence/D95/ocr/T95.34-785eee18.json`.
- **T95.34-B1** (`ReviewView.tsx:411`): the refusal's buttons stay enabled while Save it runs; a second Save it gets false and `finally` clears `asked.current` mid-save, so the first save ends through the ordinary next-step path; Discard it can open another card mid-save.
- **T95.34-B2** (`ActionForm.tsx:235`, `ReviewView.tsx:430`, one root cause): "Back to X" and Save it act on a form in a hidden panel (`hidden={open !== name}`): focus goes nowhere and the form's refusal is hidden. Open the owning panel first.
- **T95.34-B3** (`ReviewView.tsx:304`): with another form also unsaved, an asked Action save skips `refreshTrade(…[action:id])`, leaving the Action form stale (a later save can conflict).

### T95.34-B1, T95.34-B2, T95.34-B3

Commits `96804a9d` (B1: the refusal's buttons disabled while Save it runs; one save; the Trade pressed opens after), `73001569` (B2: `shownFirst` opens the owning panel before focus or save; Action panel cases only, Reflections and owed-card share the helper), `00833676` (B3: an asked Action save with a reflection also unsaved reads the Trade again). Each red first, then green; src/ui 801 passed.

(T95.34's four ocr findings are three bug tasks: B2 covers two findings with one root cause.)

ocr of T95.34-B1, T95.34-B2, T95.34-B3 (session cdceeeb0): 6 files, 1 finding, Valid: **T95.34-B4** (`ReviewView.tsx:307`): refreshes fold in with `apply({kind:'Opened'})`, which replaces the Review wholesale, and nothing drops a result that arrives out of order; B3's asked-save refresh (like the ordinary one at 316 and `markSaved`) can land after a newer save and undo it. `evidence/D95/ocr/T95.34-B1-B3-00833676.json`.

### T95.34-B4

Commit `06df0de8`: `apply` counts every result carrying a Review; `reopenAndApply` drops a read that started before a newer one was applied (covers the asked-save refresh, the ordinary-save refresh, `markSaved`, header Refresh); `reopen` no longer shares a stale in-flight read. Red "expected <strong></strong> to be null", green; mutation check (guard off fails). A per-row MarkSaved carries no Review and doesn't count (an existing MarksStep test shares one read for two quick saves): a residual narrow window, noted.

ocr of T95.34-B4 (session b730d892): 2 files, 0 findings. `evidence/D95/ocr/T95.34-B4-06df0de8.json`. Next: run `t95.34-refusal` (browser-task, Standard).

Run `t95.34-refusal` (browser-task): unit 2986, integration 329, browser 24 (@every-task 5, e2e/d95 19), checks 14 of 14. Passed. (The task agent ran the changed e2e/d4 and e2e/d5r specs itself.) T95.34 done.

### T95.35

Commit `9c9c0275`: `measurePlanExit` in new `src/domain/plan-exit/` (Follows; Leaves with BeforeCondition, HeldPast {line, since, sessions}, PartOnly {held, sold}, every reason together; undefined for a buy). First-run pass flagged and mutation-checked: case 7. Assumptions recorded: a `pricedInTradedInstrument` flag per condition; a Hold past a line counts only while the line is still reached; a sale of at least what is held is the whole Position. No lint:deps change needed. Facts the views must return carried to T95.37.

ocr of T95.35 (session b72baacd): 3 files, 2 findings, both Doubtful (bug tasks under the rule): **T95.35-B1** (`plan-exit.ts:52`): a zero Sell gives PartOnly and selling more than held gives Follows; **T95.35-B2** (`plan-exit.ts:60`): with Holds past two reached lines only the first HeldPast is given. Batched into one tdd-task, a commit each. `evidence/D95/ocr/T95.35-9c9c0275.json`.

### T95.35-B1, T95.35-B2

Commits `05194184` (B1: no measure for a sold quantity not positive or above what is held; red, green) and `970dc05f` (B2: one HeldPast per reached line held past, Stop before Target; red, green). plan-exit 10 passed.

ocr of T95.35-B1, T95.35-B2 (session c64bb69a): 2 files, 0 findings. `evidence/D95/ocr/T95.35-B1-B2-970dc05f.json`. Next: run `t95.35-plan-exit` (browser-task, Standard).

Run `t95.35-plan-exit` (browser-task): unit 2996, integration 329, browser 24, checks 14 of 14. Passed. T95.35 done.

### T95.36

Commit `04a1e1d4`: a sale that reduces the Position is measured (measurePlanExit) by Trade Workflows itself: it reads the latest Marks, the replay's crossings and the Action history (assumption: the plan shows no command carrying the facts and the breakdown has the workflow alone enforce, so `TradeWorkflowsDeps.marketData` is now required; `compose.ts` passes it; no request-count pin covers recordPositionChange). New codes `PlanDepartureReasonRequired`, `ReflectionDeclineNotAllowed`, `CloseReviewMustDefer` (closing sale only; expiration left for T95.48 and T95.50). Old-form Workspaces (no Plan Departure prompt) need no reason (guard: d8/backup I8.2). 16 cases (14, 15, 16 added for hold-past and the sale's own price); first-run passes flagged and mutation-checked: cases 1, 3, 5, 7, 8, 11, 12, 13, 16. Files beyond the line: types.ts, compose.ts, plan-call.ts (`headlineConditionsOf` exported, no behavior change), valuation/plan-exit-facts.ts, sale-measure.ts. Untested assumptions recorded: the option StructureValue branch, multi-Execution combining, hold-past since/sessions values. Helpers: `fillDebtAnswers` (e2e/d5) fills "Why did you leave the Plan?" when present (fixed d8p/history, d8r/history); `saveAction` (review-fixture) takes an optional intent. Browser: sale specs 46 + reruns, and d6, d7, d7p, d8p, d8r, d9, d9ar, d9r2, d95 212 passed.

ocr of T95.36 (session f75cbe5c): 11 files, 3 findings (1 Valid, 2 Doubtful), all bug tasks, batched:
- **T95.36-B1** (Valid, `sale-measure.ts:76`): the Hold cutoff date comes from `members[0]`, not the earliest member, so member order decides whether the reason is owed.
- **T95.36-B2** (Doubtful, `sale-measure.ts:73`): the Action history read that waives the reason is not bound to the commit (its journalRevision is dropped), so a concurrent change of that Exit to a Hold could still record the sale without a reason.
- **T95.36-B3** (Doubtful, `sale-measure.ts:75`): `Temporal.Instant.from` on a malformed economicTime throws, giving StorageFailure instead of an economicTime issue.
`evidence/D95/ocr/T95.36-04a1e1d4.json`.

### T95.36-B1, T95.36-B2, T95.36-B3

Commits `44ca55d0` (B1: the hold-past cutoff uses the earliest member's time), `f2ff9bc6` (B2: `SaleMeasure.journalRevision`; a revision moved before the reflection is prepared returns Conflict `journal@N`, and the existing retry re-measures; no new stored shape), `0c616a21` (B3: `unreadableTimeIssues` at the coordinator's start, `EconomicTimeInvalid` on economicTime, nothing written; the throw came from `compareInstants` via prepareChange, so it covers every Position Change). Each red, then green; src/coordinators and tests/integration 926 passed.

ocr of T95.36-B1, T95.36-B2, T95.36-B3 (session 58744809): 3 files, 1 finding, Valid: **T95.36-B4** (`sale-measure.ts:78`): the earliest-member reduce uses `Date.parse`, which gives NaN for an annotated instant (`…Z[UTC]`) the B3 check accepts, so the first member wins again; the same pattern at `record-position-change.ts` 247-249 and 327 and `trade-workflows.ts:71`. `evidence/D95/ocr/T95.36-B1-B3-0c616a21.json`.

### T95.36-B4

Commit `c59d4ad7`: `Temporal.Instant.compare` picks the earliest member in sale-measure.ts and in record-position-change.ts (`earliest()`, memberIssues' before-plan and in-future bounds). Red, green (annotated times in both orders); the moment's agreement rests on the code, not asserted. `confirmPlan`'s `Date.parse` (trade-workflows.ts:71, pre-existing) added to tech-debt.md. src/coordinators and tests/integration 927 passed.

ocr of T95.36-B4 (session fd23e829): 3 files, 0 findings. `evidence/D95/ocr/T95.36-B4-c59d4ad7.json`. Next: run `t95.36-sale-measured` (browser-auto 0039d2db).

Run `t95.36-sale-measured` (browser-auto 0039d2db, full tier): unit 3016, integration 329, browser 127, 79, 55 and 130 (4 skipped), checks 14 of 14. Passed. T95.36 done.

### T95.37 — parked (pending decision)

The tdd-task built nothing. Cases 2, 3 and 4 can't all hold: Trade Detail's held-past facts need the Trade's replay (each Hold session's crossings), which the card already assembles but `getTradeDetail` does not; adding it costs one more observations read (counted: Detail makes observations.getAll + the byInstrumentDate cursor; replayTrade one more). Options put to the user: (1) read the replay on Detail only when a Hold exists, case 4 reworded (recommended); (2) always read it; (3) leave held-past facts off Detail. Carrying on with T95.38 (no dependence on T95.37) meanwhile.

## T95.38 — The exit form becomes a component

- Split: `PositionChangeFormBody.tsx` (the shared body, now taking `tradeId`, `exit`, `onDone`, `backLabel`), new `ExitForm.tsx` (the sale: body with `exit`), `PositionChangeForm.tsx` (route screen reading the Trade and `?action=Sell`, wrapping ExitForm or the buy body). `src/main.tsx` needed no change.
- `npx vitest run src/ui/screens/PositionChangeForm` (PositionChangeForm, PositionChangeFormExit, PositionChangeFormOptions tests, no test edited): 3 files, 77 passed.
- `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d6/exit.spec.ts exit-action.spec.ts exit-requirements.spec.ts close-review.spec.ts no-save.spec.ts`: 6 passed.
- typecheck, tsc6, lint (2 pre-existing warnings in OwedDebtItem.tsx), lint:deps: exit 0.

T95.38 main-session note: commit `ca2ea8e4`; the body moved unchanged to `PositionChangeFormBody.tsx` (props tradeId, exit, onDone, backLabel); `ExitForm.tsx` wraps it; main.tsx unchanged. Recorded difference: moving between Record entry and Record exit on one Trade now remounts the form (row state not kept); no test covers it. d6 exit, exit-action, exit-requirements, close-review, no-save 6 passed; PositionChangeForm tests 77 passed unedited.

ocr of T95.38 (session 331df033): 3 files, 0 findings. `evidence/D95/ocr/T95.38-ca2ea8e4.json`. Next: run `t95.38-exit-form` (browser-task, Standard).

Run `t95.38-exit-form` (browser-task): unit 3016, integration 329, browser 24, checks 14 of 14. Passed. T95.38 done.

T95.37 decision: the user chose option 1 (decision 133, plan revision 122): Trade Detail reads the replay only when the Trade has a saved Hold; case 4 reworded. The user also confirmed T95.28's fixed revision identity (decision 132). T95.37 resumes after T95.42.

### T95.42

Commit `f65df05c`: the workflow prompts (Plan Departure Reason, Expiration Reason) are left out of a buy's form, today's expiration form and an owed reflection whose Debt requires neither; "Why did you leave the Plan?" is shown required (aria-required) on a Debt that requires it (DebtForm, Review card, Trade Detail); declining such a Debt takes one more press ("Decline anyway", unapproved, temporary until T95.60); a Debt requiring nothing still declines in one press (guard with its own mutation); "Say why" (W155) on the day line and card header (new DayNeed `SayWhy`); a saved reflection skips unanswered workflow prompts; `requires` carried on OwedReflection, TradeDetailDebt and NarrativeDebt with no added read (data-additions.md). First-run passes flagged and mutation-checked: case 3, case 5 refusal, case 6 (first mutation didn't fail; a second did). Interim: the sale form still shows the Plan Departure prompt via PositionChangeFormBody (T95.39 places it); the expiration form shows no Expiration Reason until T95.52. Browser: d5, d6, d7, d8p, d8r, d95 131 passed.

ocr of T95.42 (session 3058ecc4): 22 files, 0 findings. `evidence/D95/ocr/T95.42-f65df05c.json`. Next: run `t95.42-reflection-prompts` (browser-task, Standard).

Run `t95.42-reflection-prompts` (browser-task): unit 3032, integration 329, browser 24, checks 14 of 14. Passed. T95.42 done.

### T95.37

Commit `eb591078`: `PlanExitFacts` on `DailyTradeReview.planExit` and `OpenTradeDetail.planExit` (per open Position its signed quantity and headline conditions with status; heldPast; the latest Exit with its reason); shared functions moved into `valuation/plan-exit-facts.ts` (heldPastOf, holdsBefore, latestExitOf, planExitFactsOf, signedDecimalOf), `measureSale` calls them; `JournalPage.actions` and `ReviewDateActions.onDate` from reads already made (data-additions.md). Trade Detail reads the replay only when a saved Hold counts (decision 133). First-run passes flagged and mutation-checked: case 3, case 4. Pins: case 4 new; for an option Trade with a Hold the replay reads one series per Instrument, so `d8p/replay-query-count` (D7S_DETAIL_WITH_HOLD) and `d8r/query-count` (D8_OPEN_DETAIL_WITH_HOLD) go from observations.getAll 1 to 3 and meta.get 11 to 12; main session accepted this as decision 133's meaning (the replay's own reads) and worded the decision so. verify:fixtures equal (no expected-views change). Integration d2 to d95 pass.

ocr of T95.37 (session 7130443a): 14 files, 0 findings. `evidence/D95/ocr/T95.37-eb591078.json`. Next: run `t95.37-plan-exit-facts` (browser-task, Standard).

Run `t95.37-plan-exit-facts` (browser-task): unit 3036, integration 329, browser 24, checks 14 of 14. Passed. T95.37 done.

### T95.39

Commit `a770136a`: the sale form's Plan check (new `PlanCheck.tsx`, `checkSale` calling `measurePlanExit`): "Against the Plan", "Follows the Plan" (W131 in full), "Leaves the Plan" with each reason, updated as typed; one question ("Why did you leave the Plan?", or "Why only part?" when part-only is the sole reason) with "Say why later" (saves at once, reflection put off); the carried Exit reason (W133) for a whole sale; empty question refused locally, and the workflow's `PlanDepartureReasonRequired` (e.g. a backdated sale) shows the question with its message (the save is the authority); no reflection choices on a sale; earlier prompts behind "Add more"; Close Reason with nothing preselected, no Close Review choice, Close Review always Defer; a buy keeps its three choices (first-run pass, mutation-checked). One unit case retired (the Close Review group's issue tie: the group no longer exists on a sale). e2e helpers and d6, d8p, d8r, d95 specs follow the form (same intent). New words in new-words.md. Browser: d6 14, d7 21, d7p/d8/d8r 40, d8p 19, d9/d9ar/d9r2/d95 130 (4 skipped) passed.

ocr of T95.39 (session 61c24bd6): 14 files, 1 finding, Valid: **T95.39-B1** (`PositionChangeFormBody.tsx:306`): after a reason-required refusal, `asksWhy` stays true while that issue sits in `issues`; `corrected()` clears it only when the answer changes, so after editing the sale to follow the Plan the card says "Nothing more to ask" but the question shows and Save stays blocked. `evidence/D95/ocr/T95.39-a770136a.json`.

### T95.39-B1

Commit `634c0bcf`: `saleEdited` (any row's quantity or price differs from the values last reported) stops a reason-required issue keeping `asksWhy` on, releasing the Save guard; a time-only edit doesn't clear it (the form's Plan check ignores time; the save's hold-past cutoff uses the sale date, and its refusal reappears on the next save). Red "expected <textarea> to be null", green; PositionChangeForm tests 92 passed; d95/card 8 passed.

ocr of T95.39-B1 (session 558e0d2e): 2 files, 2 findings, both Valid, one root cause, one bug task **T95.39-B2**: (`PositionChangeFormBody.tsx:308`) the banner keeps the stale "Say why you left the Plan, or choose “Say why later”." after the question is hidden; (`:307`) removing an Execution isn't a sale edit, so the question and the Save block stay. Fix at the root: the reason-required issue follows the current Plan check (dropped from question, banner and guard whenever the check owes no reason), not an edit detector. `evidence/D95/ocr/T95.39-B1-634c0bcf.json`.

### T95.39-B2

Commit `cbccc891`: a reason-required refusal lapses (question, banner, Save guard) when the current check owes nothing and the check at the refusal did not already say clear (so a workflow refusal on a sale the form measures as Follows stays: the existing "workflow refusal" case); `saleEdited` removed; local `CheckState` owes/clear/unmeasured. Cases: edit-to-follow clears question and banner (red: banner item); removing the extra Execution clears both and Save sends (built from the workflow's refusal: with a Stop-only Plan an over-total sale can't be measured; two setup reds, then the valid red); an edit still leaving keeps the refusal (first-run pass, mutation-checked). src/ui/screens 833 passed; d6 exit and exit-requirements passed.

ocr of T95.39-B2 (session 4d7e1905): 2 files, 1 finding (`PositionChangeFormBody.tsx:314`: a workflow reason refusal that arrives while the form's check is `clear` never lapses on later edits). Dismissed by the main session, not a defect: there the save (the authority, with Current statuses and the sale's date) owes a reason the form can't see, so the form can't know an edit lifted it; keeping the question until answered or "Say why later" is the intended rule (T95.39 note), and Save isn't blocked (either choice saves). `evidence/D95/ocr/T95.39-B2-cbccc891.json`. Next: run `t95.39-plan-check` (browser-auto 7e623a14).

Run `t95.39-plan-check` (browser-auto 7e623a14, full tier): unit 3053, integration 329, browser 127, 79, 55 and 130 (4 skipped), checks 14 of 14. Passed. T95.39 done.

### T95.40 — parked (pending decision)

The tdd-task stopped before any edit: case 6 ("show the Trade under 'Closed · Close Review' as 'Close Review · next Review'", W135) quotes words the breakdown gives to T95.58 (the group heading, X12 and T95.58 case 1, now "Trades with owed reflections" at ReviewView.tsx:599; the card label W151, T95.58 case 5, now from remainsText in ReviewOwedCard.tsx); neither file is on T95.40's Files line; B95.8 (T95.45) asserts the same. Options put to the user: (1) T95.40 builds the heading and label (T95.58 cases 1 and 5 then first-run pass, flagged; X12's test edits move to T95.40) — recommended; (2) case 6 moves to T95.58; (3) an interim wording.

T95.40 decision: the user chose option 1 (decision 134, plan revision 123): T95.40 builds the closed group's heading (W103) and the owed card's Close Review label (W151) with X12's test edits; T95.58 cases 1 and 5 will first-run pass, flagged.

### T95.40

Commit `25cc8ba3`: the sale in the Review card: "Record the sale" / "Record the buy-back" on a saved Exit; the exit form in the Action panel with "Back to the Review" (card-only path in PositionChangeFormBody/PositionChangeReceipt: no history.replaceState, a "Save it" handle; route screens unchanged); the receipt in the card (a partial sale refreshes at once; a closing sale waits for "Back to the Review", or reads the Review again if the card is left); W155 on "Say why later"; the saved Exit stays; per decision 134 the group heading "Closed · Close Review" (W103) and the owed header "Close Review · next Review" (W151); a half-typed sale refused like a half-typed Action; one column at 375 (new e2e/d95/sale-form.spec.ts). First-run passes flagged and mutation-checked: case 5, the receipt negative, the owed-header negative, the closing-sale integration case. X12 expectations updated (three e2e files, two unit files). P137: W135 shortened (words-changed.md). `plural` imported from format.ts to break an import cycle. Browser: d4, d5, d5r, d6, d95, d7/review-expiration 94 passed.

ocr of T95.40 (session a59ae1e9): 18 files, 3 findings. `evidence/D95/ocr/T95.40-25cc8ba3.json`.
- **T95.40-B1** (Valid, `ActionForm.tsx:298`): after a sale the refresh result is ignored and the "refresh owed" flag cleared first; if the Review read fails, the receipt is gone, the closed Trade stays with old figures and nothing retries (the partial-sale path too).
- Finding 2 (Valid in fact, a design question; to the user): "Closed · Close Review" (W103, decision 134) heads the owed group, which also holds open Trades owing only a Position Change Reflection (`owedGroup` lists any Trade outside the walk with an outstanding reflection), so an open Trade shows under "Closed".
- Finding 3 (Doubtful, `PositionChangeFormBody.tsx:88`): "Back to the Review" ends a half-typed sale at once. Dismissed by the main session: an explicit leave, like the Action form's Discard and the page form's Cancel (drafts are never saved); case 7's refusal is for leaving to another card, which is built.

### T95.40-B1

Commit `b8afe82d`: `readAfterSale` awaits the read and keeps the "refresh owed" flag on failure (partial-sale and dismissal paths); ReviewView's onRefresh now sets the existing banner "We couldn’t refresh the Review. Nothing was changed." on any card refresh failure (cleared on success). Three cases, each red then green. Residual: a read still in flight when the card unmounts and then fails sets the flag after cleanup (no retry). src/ui/screens 848 passed; d95/sale-form passed.

ocr of T95.40-B1 (session f0f0ad6e): 4 files, 1 finding, Valid: **T95.40-B2** (`ActionForm.tsx:146`): `readAfterSale` clears the flag before the read finishes, so a dismissal or unmount while it is pending queues no retry (B1's recorded residual). `evidence/D95/ocr/T95.40-B1-b8afe82d.json`.

### T95.40-B2

Commit `26286f6e`: `readAfterSale` sets the owed flag when a read starts and clears it only on success; a `reading` flag blocks a second read in flight; a dismissal during a read queues a retry run only on failure; an unmount during a read skips `onLeftSold`, which the read calls itself only on failure. Cases: dismissed-pending-fails and left-pending-fails (red, green); dismissed-pending-succeeds and left-pending-succeeds (first-run passes, mutation-checked). src/ui/screens 852 passed.

ocr of T95.40-B2 (session 0195e4c5): 2 files, 1 finding, Valid: **T95.40-B3** (`ActionForm.tsx:144`): `gone.current` is set in the effect cleanup and never reset in setup, so under StrictMode's replay (development) a mounted form is marked gone and a failed read calls `onLeftSold` instead of the in-card retry. `evidence/D95/ocr/T95.40-B2-26286f6e.json`.

### T95.40-B3

Commit `86f6abd9`: the effect's setup resets `gone.current = false` (StrictMode replay). Case in <StrictMode>: red "called 2 times, but got 1", green; ActionForm.test 34 passed.

ocr of T95.40-B3 (session bf621f7c): 2 files, 0 findings. `evidence/D95/ocr/T95.40-B3-86f6abd9.json`. Next: run `t95.40-sale-in-card` (browser-auto 17841c4a).

Run `t95.40-sale-in-card` (browser-auto 17841c4a, full tier): unit 3073, integration 329, browser 127, 79, 55 and 131 (4 skipped), checks 14 of 14. Passed. T95.40 done. (Open: the owed group's heading for open Trades owing only a reflection, put to the user.)

### T95.41

Commit `1173c055`: the banner for an Exit not carried out: `ReviewTradeItem.exitCarry` {direction, held, sold?} from the new `exit-carry.ts` (the most recent Action before the Review Date is an Exit, A313; sold since = Executions after its Review Date, exchange-local; first open Position only; no added read, data-additions.md); first on the card with the day and what is held, "Sold N since"; on the day card with the reason; "I sold: record it" opens the sale form (also before today's Marks); "Still holding" hides it, saves nothing, Hold stays preselected (ReviewView state, lost on reload = a fresh open); none for an earlier Roll or Adjust; off once the Review Date's own Action is saved. Files beyond the line: the coordinator, ActionForm.tsx, ReviewView.tsx. First-run passes flagged and mutation-checked: case 6, case 7 (moved to the coordinator seam; a card-level version couldn't fail and was deleted), two "off once saved" guards. New words in new-words.md. B95.9 (exit-banner.spec.ts) left to T95.45. Browser: d95, d5r, d4 63 passed.

ocr of T95.41 (session 9ace9183): 11 files, 2 findings, both Valid, batched:
- **T95.41-B1** (`ReviewCard.tsx:329`): opening the sale form from "I sold: record it" while the Action has unsaved edits drops the leave-warning: the sale form reports not dirty under the same `action:<tradeId>` id while ActionForm skips its own report when selling; the Action draft can be lost on a card switch.
- **T95.41-B2** (low, `ExitBanner.tsx:10`): "I sold: record it" stays enabled when the runtime is read-only, but ActionForm returns "No Action saved." before the selling branch, so the button does nothing (card and day card).
`evidence/D95/ocr/T95.41-1173c055.json`.

### T95.41-B1, T95.41-B2

Commits `277640b3` (B1: ActionForm reports dirty while the Action draft changed or the sale form holds typed values; "Save it"/"Discard it" act on the shown sale form, the held draft returns on "Back to the Review"; the case checks the dirty report the refusal reads) and `011130ff` (B2: "I sold: record it" disabled while read-only, in the shared Answers component, card and day card; "Still holding" stays enabled). Each red then green; src/ui/screens 864 passed.

ocr of T95.41-B1, T95.41-B2 (session 32fb8bab, second run; the first failed on a provider HTTP error): 3 files, 0 findings. `evidence/D95/ocr/T95.41-B1-B2-011130ff.json`. Next: run `t95.41-exit-banner` (browser-task, Standard).

Run `t95.41-exit-banner` (browser-task): unit 3086, integration 329, browser 25, checks 14 of 14. Passed. T95.41 done.

### T95.43

Commit `ee16e93c`: variants `DailyReview.open` PlanCall; `getTrade` PlanCall, PlanExit; `save` PlanRule; `getTradeDetail` PlanExit; `recordPositionChange` PlanExitMeasure; each on its route (review, trade-detail, record-entry). I95.7 asserts the exact DailyReview lists and the presence of PlanExit/PlanExitMeasure on the other two (their full lists stay asserted by workspace.test.ts's exact-list case, updated); no route needs an uninstalled variant. verify:capabilities passes (24 operations, 12 variant-qualified, 10 routes).

ocr of T95.43 (session d1c4cca4): 4 files, 0 findings. `evidence/D95/ocr/T95.43-ee16e93c.json`. Next: run `t95.43-capabilities` (browser-task, Standard).

Run `t95.43-capabilities` (browser-task): unit 3086, integration 329, browser 25, checks 14 of 14. Passed. T95.43 done.

### T95.44

Commit `a109c44e`: Part B integration suites I95.8 (seed-6, 5 cases), I95.9 (restore-seed, 3), I95.10 (plan-rule, 12), I95.11 (sale-plan-exit, 13), I95.12 (rebuild, 3), with `seed-support.ts`. No defect found. Every case a first-run pass (the code existed), each mutation-checked (mutations across reason-rule, daily-review, journal, sale-measure, record-position-change, trade-views, manifest, restore, backup-export, rebuild); two cases strengthened until their mutation failed (I95.8 second start asserts the exact receipt; I95.12 three separate mutations). Recorded gaps: I95.9's equal-views half rests on D8's I8.1; I95.10's nothing-written half is an unchanged dump no mutation reached. tests/integration 367 passed.

ocr of T95.44 (session e50bc4dd): 6 files, 2 findings, both Valid test gaps, batched as **T95.44-B1** (`plan-rule.test.ts:64`: the Out-Trades case saves a justified Hold only for `shallow`, not `target`) and **T95.44-B2** (`seed-support.ts:61`: `shapeOf` drops `requiredWhen.promptId`, so a Why? prompt linked to the wrong controlling prompt would still equal the contract). `evidence/D95/ocr/T95.44-a109c44e.json`.

### T95.44-B1, T95.44-B2

Commits `3d423c43` (B1: the justified Hold saved and asserted for target too; mutation refusing a Hold at the Target, after a first mutation that couldn't reach the path, fails at plan-rule.test.ts:66) and `ca2069f0` (B2: `shapeOf`/`CONTRACT` keep `requiredWhenPrompt`, the controlling prompt's text; mutation pointing "Why?" at Conviction fails the equality cases). Tests only; first-run passes mutation-checked; tests/integration/d95 66 passed.

ocr of T95.44-B1, T95.44-B2 (session 052ff93d): 2 files, 0 findings. `evidence/D95/ocr/T95.44-B1-B2-ca2069f0.json`. Next: run `t95.44-integration-b` (browser-task, Standard).

Run `t95.44-integration-b` (browser-task): unit 3086, integration 363, browser 25, checks 14 of 14. Passed. T95.44 done.

### T95.45 (in part)

Commit `78d30f66`: B95.6 action.spec.ts (4), B95.7 refusal.spec.ts (6), B95.8 sale.spec.ts (6; closing-sale cases set the sale time to 11:00 so the Trade leaves the walk; nothing asserted about where an open Trade owing a reflection sits), B95.9 exit-banner.spec.ts (4) — 18 cases, at 1280 and 375 (atBothWidths), all first-run passes, each mutation-checked (two first mutations redone after making assertions exact); e2e/d95 40 passed. **B95.10 upgrade.spec.ts not written**: it needs a served D9 release; dist-releases stops at d5r2; adding a `d9r2` entry to tools/build-releases.ts was tried, its build denied by the permission classifier, and reverted — put to the user. Focus note (agent's, low) to tech-debt.md.

ocr of T95.45 (session eeb2cbf5): 5 files, 3 findings, test gaps, batched:
- **T95.45-B1** (Valid, `sale.spec.ts:57`, `:106`, `:109`): "a refused sale writes nothing" reads a `facts` store that doesn't exist, so both snapshots are `[]`.
- **T95.45-B2** (Valid, `sale.spec.ts:108`): `getByText(/Say why/).first()` can match the "Say why later" button; assert the refusal text itself.
- **T95.45-B3** (Doubtful, `action.spec.ts:29` and the other three specs): `atBothWidths` returns to 1280 before Save/Discard/record-sale clicks, so no click runs at 375.
`evidence/D95/ocr/T95.45-78d30f66.json`.

### T95.45-B1, T95.45-B2, T95.45-B3 (tdd-task, 2026-11-24)
- `8621f4b8` B1: sale.spec.ts's refused-sale checks snapshot trades, journalEntries, journalDeclines, journalObligations and journalDebts (helper throws on a missing store); each sale case also asserts the snapshot changes after the save.
- `67b66d97` B2: asserts the exact refusal "Say why you left the Plan, or choose “Say why later”."
- `84af6c09` B3: six new cases make every click at 375 (action, refusal, exit-banner, sale); desktop runs kept.
- First-run passes, flagged and mutation-checked: B1 (snapshot check flipped: both closing cases failed), B2 (SAY_WHY text changed: both part-sale cases failed), B3 (buttons made unclickable under 400px: all six failed). Source restored each time; `git diff -- src` empty.
- Browser: all of e2e/d95 46 of 46 passed (1.5 min).

### T95.45-B ocr (`dc62c7f2..84af6c09`), two findings
Output: evidence/D95/ocr/T95.45-B-dc62c7f2..84af6c09.json. Both Valid, both test gaps; they become bug tasks:
- T95.45-B4: `e2e/d95/refusal.spec.ts:101` "Save it at 375 wide" checks only that one Action exists; assert, as the desktop twin does, the saved Action is the Roll with "Moving it out.".
- T95.45-B5: `e2e/d95/sale.spec.ts:139` the closing sale "every click made at 375 wide" opens and fills the form at desktop width; narrow to 375 before opening it.

### T95.45-B4, T95.45-B5 (tdd-task, 2026-11-24)
- `d0349676` B4: refusal.spec.ts "Save it … at 375 wide" asserts the saved Action holds option.daily-trade-review.action.roll and contains "Moving it out.". First-run pass, flagged; mutation (ActionForm saved 'Hold') failed with "the Roll, not a Hold".
- `f1faff8a` B5: sale.spec.ts narrows to 375 before openSale, so opening and filling happen at 375. First-run pass, flagged; mutation (buttons unclickable under 400px) failed with a click timeout. The agent did not confirm which click failed; its log row's claim that it was an opening or row click is unverified.
- Source restored after each mutation; `git diff -- src` empty. All of e2e/d95: 46 passed.

### T95.45-B4, T95.45-B5 ocr (`af20a1ae..f1faff8a`): no findings
Output: evidence/D95/ocr/T95.45-B4-B5-af20a1ae..f1faff8a.json.

### T95.45 suite run t95.45-browser-b (browser-task, base c3d45308, at b0e65437): all passed
Unit 3086, integration 363, browser 51 (5 @every-task + 46 e2e/d95), 14 of 14 checks; run complete, 3m55s. T95.45 stays open only for B95.10, which awaits the user's answer on adding the D9 release to tools/build-releases.ts.

### T95.40-D1 — The owed group heading for open and closed Trades (decision 135)
Commit `30671d8e`: the owed group's heading "Trades with owed reflections" (W103 as amended) and the moved-to-owed notice "… is now in Trades with owed reflections, so what you entered for it was not kept."; a new case lists an open Trade owing only a Position Change Reflection under it with no Close Review label. Three cases red then green; no first-run passes. Expectations quoting the old heading updated (ReviewOwed, ReviewCards, e2e d6 close-review and responsive-a11y, d7 review-expiration, d95 sale). Review unit files 208 passed; browser 13 passed.

T95.40-D1 ocr (`30671d8e`): no findings (evidence/D95/ocr/T95.40-D1-30671d8e.json).

Run `t95.40-d1` (browser-task, base 22249ee8, at b3e298f6): unit 3088, integration 363, browser 51, checks 14 of 14; run complete. T95.40-D1 done.

### T95.45 B95.10 stopped (tdd-task, 2026-11-24): a product gap
d9r2 builds and serves (tools/build-releases.ts gained d9r2, the user's approval, committed). A probe onboarded a Workspace on d9r2 with a Position Change Reflection owed, then updated to current: data intact, but journalDefinitions stayed at the four revision-1 forms, after reloads, the Review and a Mark. Only `Workspace.initialize` runs the seed; the browser calls it on first run and on a schema migration only, and D9 and D9.5 are both schema 7. I95.8 calls initialize directly. Nothing committed. Follow-on T95.28-F2 (carries out T95.28 case 6 "on its next start" in the app): run the seed step on every Writable open of an existing Workspace. B95.10 resumes after it (plan: a saved d9r2 setup, assert the owed reflection's stored definition id stays revision 1 and a new Hold's is revision 2).

### T95.28-F2 — The app delivers manifest 6 to an existing Workspace on launch
Commit `f25aecb0`: AppShell's launch effect, after `getStatus`, calls `Workspace.initialize({})` for a Ready status with Writable readiness (the existing idempotent seed step; workspace.ts and the schema untouched) and shows the status it returns, or the original on failure. Cases: the seed runs on a Writable open (red then green); not on a read-only open (first-run pass, flagged; mutation removing the Writable test failed); the real facade on the workspace-v7 fixture rendered through AppShell gains the three revisions (first-run pass after case 1, flagged; mutation failed). A second launch adding nothing stays with I95.8. Browser: e2e/d1 identity, onboarding, readiness, recovery-only, offline, plan, update 15 passed.

T95.28-F2 ocr (`f25aecb0`), one finding (evidence/D95/ocr/T95.28-F2-f25aecb0.json): Valid, bug task **T95.28-F2-B1**: `AppShell.tsx:328` when the launch-time initialize returns anything but Opened (e.g. RuntimeNotWritable, another tab took the Workspace after the first status read) or throws, the shell keeps the stale Ready/Writable status, so write controls stay enabled; the migration path reads getStatus() again instead.
