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
