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

T95.28-F2-B1 `622ab83e`: the launch seed step reads getStatus() again when initialize returns anything but Opened, and on a throw (as the migration path does). Two cases, each red ("Accounts (read only)" not found; Add Account enabled) then green; AppShell 55 passed; e2e/d1 readiness, recovery-only, update 9 passed.

T95.28-F2-B1 ocr (`622ab83e`), one finding (evidence/D95/ocr/T95.28-F2-B1-622ab83e.json; ocr's second pass hit a provider usage limit, no item failed): Valid, bug task **T95.28-F2-B2**: `AppShell.tsx:330` the `current` guard isn't checked again after the awaited getStatus() reads, so a stale launch effect (e.g. after `facade` changes) can overwrite the replacement effect's status. The reviewer's note on the catch branch's unhandled second read went to tech-debt.md.

T95.28-F2-B2 `a2dbcc59`: each awaited getStatus() re-read in the launch seed step checks `current` before setting the status (the not-Opened and catch branches; the catch's error handling unchanged). One case red (stale read overwrote the status) then green; AppShell 56 passed; e2e/d1 readiness, recovery-only, update 9 passed.

T95.28-F2-B2 ocr (`a2dbcc59`): not reviewed. The ocr provider (ChatGPT) failed its only request (usage limit; evidence/D95/ocr/T95.28-F2-B2-a2dbcc59-provider-failed.json); the reviewer waited about 95 minutes for a reset and was stopped. To be rerun once the provider is back, before the T95.46 gate's critics.

### T95.45 B95.10 (tdd-task, 2026-11-24)
Commit `00a4d031`: e2e/d95/upgrade.spec.ts. Setup on d9r2 (onboarded, XYZ 100 @ 50.00, entry reflection put off), update to current (checkForUpdate, reloadFromNotice). At 1280 and 375: the owed reflection's stored definitionId is unchanged and resolves to Position Change Reflection revision 1; its form has no "Why did you leave the Plan?"; the answer is stored under revision 1; a Hold saved from the Review (Mark 52.00) resolves to Daily Trade Review revision 2. Ids resolved through stored journalDefinitions rows. First-run pass, flagged (T95.28-F2 built it); mutation disabling the launch seed step failed (revisionNumber 2 expected, 1 received); restored, `git diff -- src` empty. e2e/d95: 47 passed.

ocr of `c05636b9..00a4d031` (T95.28-F2-B2, B95.10): not reviewed, all 3 files failed on the provider's usage limit (subscription_sharing_usage_limit_exceeded; evidence/D95/ocr/T95.28-F2-B2-B95.10-c05636b9..00a4d031-provider-failed.json). Owed: rerun on this range once the provider resets, before the T95.46 critics. Meanwhile one suite run covers T95.28-F2 and T95.45.

Run `t95.28-f2-t95.45` (browser-task, base c3d45308, at 682d3f89): integration 364, browser 52, checks 14 of 14 passed; unit 1 failed of 3093: `src/ui/screens/Onboarding.test.tsx:65` "should create the Institution then the Account and, from the returned onboarding state alone, show the Trades empty state…" — getStatus called 2 times, expected 1 (T95.28-F2's launch seed step and B1's re-read). Follow-on T95.28-F2-F1.

T95.28-F2-F1 `ce52daf6` (test only): the Onboarding test's facade double left Workspace.initialize returning undefined, so the launch seed step threw and B1's catch re-read getStatus; the real initialize returns Opened on that path, so the app makes no extra read. The test's initialize now resolves Opened; the toHaveBeenCalledTimes(1) assertion unchanged. Red was the suite failure; green; src/ui unit 1489 passed; e2e/d1 onboarding, readiness, update 9 passed. ocr owed with the range above (provider limit).

T95.28-F2 done: run `t95.28-f2-t95.45` passed but for the one unit failure fixed by T95.28-F2-F1 (src/ui unit re-run passed); the T95.46 full run confirms. ocr of B2 owed (provider limit).

T95.45 done: B1 to B5 and B95.10 (`00a4d031`); run `t95.28-f2-t95.45` browser 52 passed. ocr of B95.10 owed (provider limit).

### T95.46 — Part B gate (light)
Full run `t95.46-gate-full` (full tier, at 7d68892d): unit 3093, integration 364, browser 127, 79, 55 and 158 (4 skipped), checks 14 of 14; run complete, 21 min; no stage over 8 min. Passed.

T95.46 acceptance commands (`.claude/scripts/acceptance-commands.sh plan/D09.5-daily-review-redesign.md`): 43 checked, 31 pass, 12 fail; every failure names a Part C file not yet written (I95.13 settle-later, I95.14 expiration-reason, I95.16 close-review, I95.17 not-writable; B95.11 expiration, B95.12 settle-later, B95.15 keyboard-day, B95.16 offline, B95.17 resize). Every Part B command passes.

T95.46 critic B1 (general-purpose, effort medium; report evidence/D95/critic-b1.md): **PASS**, C95.5, C95.6, C95.7, C95.8 at 1280 and 375; no Part A regression. It could not rebuild (build denied by the permission classifier) and ran on dist-releases built at 18:57, after the last src commit (ce52daf6, 18:41). Defects: 1 moderate → **T95.46-B1** (a stale refusal, "Say why." and "Choose an Action.", stays after the Action is changed); 2 moderate → **T95.46-B2** (after a closing sale from the Review, the card keeps the open-position header and Now box figures beside the receipt until "Back to the Review"); 3 low → tech debt (day card omits "Sold 40 since", built that way on purpose). Minor observations → tech-debt.md.

T95.46-B1 `e7ead78f`: the Action radio's onChange clears the form's refusals (setIssues([])), so "Say why." and "Choose an Action." go when the choice changes (also clears a "could not be saved" refusal; taken as in scope). Two cases red then green; ActionForm 36 passed; e2e/d95 action and refusal 13 passed.

ocr of `a2dbcc59^..e7ead78f`: provider failed again (0 of 6 files; evidence copy not kept, no content). Owed range now a2dbcc59^..e7ead78f.

T95.46-B2 `db2de383`: ActionForm gains optional onClosedSale (fires when a sale's receipt returns the Trade Closed); ReviewCard sets soldOut, hiding the header's P&L, day change and label badges and the Now box beside the receipt; the Review is still read only on "Back to the Review"; no UI arithmetic, no new words. The flag is never reset (the Trade leaves the walk on the next read; if that read fails the figures stay hidden while the retry runs). Case red then green; src/ui/screens 869 passed; sale.spec.ts's Review closing-sale case gained two assertions at both widths; e2e/d95 sale and sale-form 8 passed.

ocr of `a2dbcc59^..db2de383`: provider failed again (all 9 files; resume id 144d0fe4-7968-4f58-a041-b17771daad8b). Owed. Full run before critic B2 started.

Full run `t95.46-gate-full-2` (full tier, at c7d88ee6, after T95.46-B1 and T95.46-B2): unit 3096, integration 364, browser 127, 79, 55 and 158 (4 skipped), checks 14 of 14; run complete, 20 min. Passed. Critic B2 next.

T95.46 critic B2 (report evidence/D95/critic-b2.md): **PASS**, C95.5, C95.6, C95.7, C95.8 at 1280 and 375; critic B1's two defects confirmed fixed; no Part A regression. It emptied the git-ignored test-results/ by running the root Playwright config (no tracked file touched). Defects: 1 moderate → **T95.46-B3** (a closing sale recorded through the Exit banner leaves the card and day card saying the Trade is held, with the banner, "To do: Action" and the Action form, beside the "closed" receipt, until "Back to the Review"); 2 moderate → **T95.46-B4** (the receipt says the reason and the Close Review are owed "at the next Review" when the sale's default time, after the close, puts them two Reviews away); 3 low → tech debt (bare colon). Minor observations → tech-debt.md.

T95.46-B3 `439f2f34`: soldOut moved up to ReviewView as a set of Trade ids (set by T95.46-B2's onClosedSale); a sold-out card also leaves out the Exit banner, the header's "To do", "You chose Exit and it is not recorded" and the Action panel's "Needed"; the day card's banner note goes by passing DayCard its existing holding set plus the sold-out Trades (DayCard unchanged). The day's counts stay as read until "Back to the Review" (no UI arithmetic). Case red then green; src/ui/screens 870 passed; exit-banner.spec.ts gained the banner-route closing sale at 1280 and 375; e2e/d95 exit-banner and sale 14 passed.

T95.46-B4 `1a774a68`: the sale's success returns optional `postCommit.dueIn {reflection?, closeReview?}` (DueClassification, classified by the coordinator against the Market Data frame at now, one more frame read; data-additions.md); the receipt says "the Review after next" when so classified (the Review's existing phrase; new-words.md Part B), else "the next Review". Coordinator after-close case red then green; before-close case first-run pass, flagged, mutation failed; two UI cases red then green; browser case (Close Review sentence at both widths) first-run pass, flagged, mutation failed. e2e/d95 sale 8 passed. Agent note on backdated sales → tech-debt.md.

Full run `t95.46-gate-full-3` (full tier, at 7e082c10, after T95.46-B3 and T95.46-B4): unit 3101, integration 364, browser 127, 79, 55 and 160 (4 skipped), checks 14 of 14; run complete, 20 min. Passed. Critic B3 (the last allowed) next.

T95.46 critic B3 (the third and last; report evidence/D95/critic-b3.md): **PASS**, C95.5, C95.6, C95.7, C95.8 at 1280 and 375; B1's and B2's four defects confirmed fixed (B2's defect 1 on the card; the day card's line remains, low); also reached "Record the buy-back" (short put) and T95.40-D1 item 3. Two low defects and minor observations → tech-debt.md. No high or moderate defect.

**T95.46 Part B gate: passed** — full run 3 passed, acceptance commands pass for every Part B row, critic B3 passed with lows only. Owed: the ocr review of `a2dbcc59^..1a774a68` (T95.28-F2-B2, B95.10, T95.28-F2-F1, T95.46-B1, B2, B3, B4), provider failing since about 18:30.

ocr retry, 2026-11-25 03:21 EST, after the user added credits: all seven code commits (a2dbcc59, 00a4d031, ce52daf6, e7ead78f, db2de383, 439f2f34, 1a774a68) failed at once on the provider; `ocr session show` gives "The ChatGPT user has reached their Subscription Sharing usage limit … (subscription_sharing_usage_limit_exceeded)". Still owed.

### ocr of the seven owed commits, one cumulative diff (`a2dbcc59^..1a774a68`, the user's choice, 2026-11-25)
Output: evidence/D95/ocr/T95.46-owed-a2dbcc59..1a774a68.json; 15 files complete. One round-2 request hit "server overloaded" (upgrade.spec.ts, AppShell.tsx, AppShell.test.tsx, Onboarding.test.tsx), so those four may be reviewed thinly.

| Severity | Location | Claim | Assessment | Route |
|---|---|---|---|---|
| high | `record-position-change.ts:534` | the Due Classification's Market Data read runs after the commit; if it rejects, a saved sale reports failure | Valid | bug task **T95.46-B5** |
| medium | `ExitReceipt.tsx:167` | a `Due` classification (backdated sale) reads "next Review" though the Review asks now | Valid | bug task **T95.46-B6** (supersedes the T95.46-B4 agent note in tech-debt.md) |
| medium | `ReviewCard.tsx:142` | after a closing sale, the header's aria-describedby and hidden reason spans keep the open-position reasons | Valid | bug task **T95.46-B7** |
| medium | `ReviewCard.tsx:141` | after a closing sale, the header still shows the summary ("Long 100 shares @ …") | Valid | bug task **T95.46-B8** |
| medium | `ReviewView.tsx:465` | soldOut is add-only, never cleared for the mounted view | Doubtful | bug task **T95.46-B9** |
| low | `AppShell.test.tsx:1332` | a fixed 20 ms wait instead of an awaited act | style | tech-debt.md |

T95.46-B5 `e0e2fdbb`: dueInOf catches a failed Market Data read after the commit and leaves dueIn out (the receipt falls back to "the next Review"); case red (StorageFailure) then green. T95.46-B6 `f90cd581`: a Due classification reads "due now" / "owed now" on the receipt (new-words.md Part B); case red then green. trade-workflows and ActionForm 118 passed; e2e/d95 sale 8 passed. Their ocr runs with T95.46-B7, B8, B9 as one range.

T95.46-B7 `26d98c55`: a soldOut card's header has no label reasons, so no reason ids or hidden spans (red then green). T95.46-B8 `c4759ee2`: the position summary is left off a soldOut card's header (red then green). T95.46-B9 `b5473f84` (test only): a closed Trade cannot come back as open in the mounted view (a closing sale is final; a later read lists it as closed; a void or correction happens on Trade Detail, which unmounts the Review), so the set is kept; case first-run pass, flagged, mutation (clear the set on every read) failed. src/ui/screens 876 passed; e2e/d95 sale and exit-banner 15 passed. Agent note → tech-debt.md.

ocr of `e0e2fdbb^..b5473f84` (T95.46-B5, B6, B7, B8, B9; evidence/D95/ocr/T95.46-B5-B9-e0e2fdbb..b5473f84.json): one style finding (nested ternary in ExitReceipt.tsx's `when` helper) → tech-debt.md; no correctness findings.

ocr re-review of the four thinly reviewed files (AppShell.tsx, AppShell.test.tsx, Onboarding.test.tsx, upgrade.spec.ts) over `a2dbcc59^..1a774a68`, restricted with --exclude (evidence/D95/ocr/T95.46-owed-four-files-rereview.json): complete, **no findings**. Every owed ocr review is now done. Full run next to confirm the Part B gate after T95.46-B5 to B9.

Full run `t95.46-gate-full-4` (full tier, at d3c571b5, after T95.46-B5 to B9): unit 3106, integration 364, browser 127, 79, 55 and 160 (4 skipped), checks 14 of 14; run complete. Passed. **T95.46 Part B gate stands; every ocr review is done.** Part C next.

## T95.47 — Trade Analysis: an expired contract's standing
Commit `a518f759`: new `expirationStanding(input)` in src/domain/trade-analysis/expiration-standing.ts (input: contract, exposure, oneR, underlyingMark?; figures: underlyingPrice, strike, inTheMoney, amount (per share, never negative), worth (signed: a short contract's is negative), ifSettled and ifExpiredWorthless in dollars and R); `positionOf` and `intrinsic` exported from payoff.ts. Unavailable (MarkMissing) with no Underlying Mark. 7 cases: six red then green; "at its strike, not in the money" first-run pass, flagged, mutation (> 0 → >= 0) failed. CORV check: 1467 and 4.61R, matching W137. Notes for T95.52: whether a short contract's worth shows signed or as owed; an acknowledged-Unavailable Mark has no distinct reason here.

T95.47 ocr (`a518f759`): **No findings** (evidence/D95/ocr/T95.47-a518f759.json).

Run `t95.47-expiration-standing` (browser-task, base 4656edba): unit 3113, integration 364, browser 54, checks 14 of 14; run complete. Passed. T95.47 done.

## T95.48 — Helpers first: every expiration sends a completed reflection and a deferred Close Review
Commit `30301fad` (21 files, tests and fixtures only; src/ untouched). New `completeExpiration(app)` (fixed Expiration Reason "Expired out of the money.") in tests/integration/d7/support.ts; optionCommand defaults an expiration's reflection to it; attemptExpiration always defers the Close Review; recordExpiration resolves Complete/Decline afterwards through the Debt; review stack gains expirationReflection; browser recordExpiration(page) always chooses "Reflect later" and fills "Why did it expire worthless?" only when present.
- Narrowed list: deferred and resolved through the Debt: lifecycle, rebuild (debtsByAnchorTrade 5 → 6); stopped sending Complete: payoff, d7sp trade-detail-finished, d8p detail, d9 lifetime, d9ar final; stopped sending Complete/Decline: rejections, write-gate; changed: retries case a (Entry → Debt), e2e/d7 kill.spec (Close Review owed; renamed), e2e/d7 responsive-a11y keyboard case ("Reflect later"); no edit needed: review, settlement-due, short-put, createSettlementFixture.
- Pairing row: d7/expiration-close-review.test.ts (I7.5): its Complete and Decline dispositions moved from an expiration to a sale of the same Long Call; the Defer case, CloseReasonNotApplicable and the Friday/Monday classification stay on the expiration. Retired: none.
- Checks: vitest 416 files, 3477 tests passed; browser specs touched 34 passed, the one failure (d7 keyboard case) fixed, 4 of 4 after; typecheck, tsc6, lint, lint:deps exit 0.
- Notes for T95.50: tools/fixtures-freeze.ts, tools/capacity/measure-page.ts, src/app/bench-generator.ts and src/ tests record expirations through the coordinator outside this Files line; they may need a reason. For T95.52: check the label regex /^Why did it expire worthless\?/ against W140.
- Paused here at the user's request (2026-11-25): ocr of 30301fad and its suite run not yet started.

ocr of T95.48 (session 8456bb31, after a ChatGPT usage-limit wait; earlier sessions 8661607f and 7a874c0a failed on every file with the limit): 21 files, 2 findings. `evidence/D95/ocr/T95.48-30301fad.json`.
- **T95.48-B1** (Doubtful, `e2e/d7/responsive-a11y.spec.ts:246`): the keyboard-only expiration case never fills "Why did it expire worthless?", unlike `recordExpiration`, so it may fail once T95.50 requires the reason. Reviewer's reading: T95.50 asks the reason only for an in-the-money expiration, and this case saves no Mark first; it becomes real if T95.50 also refuses an expiration with no Mark. Cases: it should fill "Why did it expire worthless?" by keyboard when the prompt is shown; it should still record the expiration by keyboard alone when the prompt is absent.
- Style only (tech-debt.md): `tests/support/replay-series-app.ts:68` nests the expiration ternary inside the sale ternary.
- Reviewer's note (not an ocr finding): it did not check the S6 and S7 lists for expiration tests the commit missed.

### T95.48-B1

Commit `a43299b9` (`e2e/d7/responsive-a11y.spec.ts` +7): the keyboard case tabs to "Why did it expire worthless?" and types the reason when the prompt is present (recordExpiration's check), else records by keyboard alone as before. First-run pass, flagged: the prompt is absent today (no Mark saved), so the absent path ran (1 passed); mutation `count() > 0` → `>= 0` made the case fail (tabTo: target never received focus), restored. The present path is not exercised. tdd-log rows written by hand (tdd.sh runs vitest only). typecheck, tsc6, lint:deps exit 0; lint 0 errors, 2 pre-existing warnings in OwedDebtItem.tsx.
- For T95.50: if it refuses an expiration with no Mark, this case needs a saved Mark first.

ocr of T95.48-B1 (session 9e1ec8bf): 1 file, 0 findings. `evidence/D95/ocr/T95.48-B1-a43299b9.json`. Next: run `t95.48-expiration-helpers` (browser-task).

Run `t95.48-expiration-helpers` (browser-task, task tier): unit 3113, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.48 done.


### T95.49

Commit `d7d38d7f` (11 files): `DailyReview.save` gains `SettleLater` (A315; codes `ActionNotOwed`, `SettleLaterNotApplicable`); `ReviewCompletion` gains `CompleteWithSettlementToRecord { trades, unavailable? }` (A316; `UnavailableDisclosure` exported, `CompleteWithUnavailableMarks` keeps its flat shape); `DailyTradeReview` gains `expirationStanding?` and `settledLaterOn?` (latest earlier Settle Later's date). A Settlement Due Trade's Action panel is done and not owed; its Settlement panel is done after a Settle Later; `toGo.expirations` and the day line follow. A saved Settle Later is recognised by the seeded action label 'Settle Later'. No schema, store, key or index change; no read added (the card's standing uses the Underlying Mark from the replay `getTrade` already reads). 10 cases; first-run passes flagged and mutation-checked: cases 1, 7, 8, 9. Case 4's first red row was a `-t` mismatch (apostrophe), renamed and taken through a real red; the Settle Later branch written early during case 3 was backed out to the case-3 minimum.
- Files beyond the line: `src/coordinators/settlement.ts` (shared open-option-lots helper, `standingOf`), `tests/integration/d7/review.test.ts` and `rebuild.test.ts` (no longer save an Action for the Settlement Due Trade), S5 readers `DayCard.tsx` (new kind worded "Complete") and `ReviewReflections.tsx` (the two codes as whole-Review issues), no new screen words.
- Assumptions (spec silent): Settle Later needs no Mark (skips `ReviewMarksUnresolved`); `ActionNotOwed` is checked before `ReviewMarksUnresolved`; the request carries only the card's binding; the disclosure nests under `unavailable`. Spec line 94 has Settle Later go through `SaveTradeAction`; A315 makes it its own `save` variant: A315 followed.
- Seam: the standing is on `getTrade`'s card, not on `DailyReview.open` (which reads no replay; adding it there needs a read). Carried to T95.62, whose capability list names `ExpirationStanding` under `open`.
- Until T95.52 the expired card still shows the Action form, and saving it returns `ActionNotOwed`.
- Checks: daily-review unit 250 passed; typecheck, tsc6, lint (2 pre-existing warnings, OwedDebtItem.tsx), lint:deps exit 0; browser specs run unedited 14 passed (d7 review-expiration, settlement-due, runtime-failure, responsive-a11y; d9 open-list; d9ar states).
- Known red: `verify:fixtures` and 7 integration tests (d7s/migration 1, d8/round-trip 2, d8r/restore 2, and the rest of the seven) fail on workspace-v6, workspace-v7, backup-v6-blocked, backup-v7: `review.families[2].trades[1].progress.panels[3].done`/`.owed`, `reviewTrades[1].progress.panels[3].done`/`.owed`, and one `ActionMissing` reason for `fx-0174` dropped from `review.completion.reasons`. This is the task's own rule (case 2) on a saved view; no figure changes. Decision 127's standing direction covers it: follow-on **T95.49-F1** updates those four `expected-views.json` at those paths only, diff recorded, after this task's ocr.

ocr of T95.49 (session a946bc84): 10 files, 2 findings, both Valid, bug tasks. `evidence/D95/ocr/T95.49-d7d38d7f.json`.
- **T95.49-B1** (Valid, `src/ui/screens/DayCard.tsx:15`, 308): the Unavailable disclosure block renders only for `CompleteWithUnavailableMarks`, so a day finished with a Settle Later and acknowledged Unavailable Marks (`CompleteWithSettlementToRecord` with `unavailable`) drops the instruments, Trades and uncalculated families. T95.53's cases don't name the disclosure. Cases: it should show the Unavailable disclosure (instruments, Trades, families) when the day is complete with a settlement to record and Marks unavailable; it should show none when the new kind carries no `unavailable`.
- **T95.49-B2** (Valid, `src/coordinators/daily-review/daily-review.ts:913`): the card's `expirationStanding` looks up the Underlying Mark in the replay on the expiration date exactly; an expiration on a weekend or holiday has no session there, so the standing is `MarkMissing` although the expiration session (the previous session, as `calendarSettlementTime` in `market-data.ts:597` settles it) has a Mark. Cases: it should give the standing at the session that settles a non-session expiration (the session before it); it should stay Unavailable when that session has no Underlying Mark.

### T95.49-B1

Commit `4a1f86b6` (DayCard.tsx, DayCard.test.tsx): the existing Unavailable block renders from one `disclosure` value, the Unavailable kind's own fields or the new kind's `unavailable`; no word changed. Case 1 red (no group "Unavailable Marks"), green; case 2 first-run pass, flagged, mutation (an empty disclosure when `unavailable` is absent) failed `expected <div role="group" …> to be null`, restored. DayCard 20 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.

### T95.49-B2

Commit `f4b9314a` (daily-review.ts, settle-later.test.ts): `expirationStanding` reads the Underlying Mark at the settling session, `missedSessions(read, replay.sessions[0].date, expiration).at(-1)` (the expiration date itself when it is a session, else the session before); the calendar call and the replay are already in hand, no store read added. Case 1 red (Unavailable vs Value), green; case 2 first-run pass, flagged, mutation (a missing Underlying Mark falls back to 46.00) failed, restored. Test fixture `expiryFixture` gained `expiration` and `mnoMark` options. daily-review 252 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.

ocr of T95.49-B1, T95.49-B2 (session 97a17144, range 4a1f86b6^..f4b9314a): 4 files, 0 findings. `evidence/D95/ocr/T95.49-B1-B2-f4b9314a.json`. Next: T95.49-F1.

### T95.49-F1

Updated the frozen `expected-views.json` of four fixtures for T95.49 (A316 case 2; decision 127's standing direction: a derived view the redesign changes, no figure or computation changed; `dump.json` and `backup.tjbackup` untouched). Cause: a Trade with Settlement Due owes no Action, so its Action panel is done and not owed, and its `ActionMissing` reason leaves `review.completion.reasons`. Before the edit `npm run verify:fixtures` failed on exactly four fixtures, and every differing path was one of: `review.families[2].trades[1].progress.panels[3].done`/`.owed`, `reviewTrades[1].progress.panels[3].done`/`.owed`, and `review.completion.reasons` (length one shorter, plus the tradeId, code and debtIds of later entries as they shifted up one index). No figure, band, order or other count differed. The Trade is fx-0174 in all four. No tool regenerates a single value, so the edit was a parse, change and rewrite of the same JSON (2-space indent, round trip checked byte-equal beforehand).

| Fixture | Action panel (families[2].trades[1], reviewTrades[1]) | reasons |
| --- | --- | --- |
| workspace-v6 | done false to true, owed true to false, both places | 15 to 14: `ActionMissing` fx-0174 (index 8) removed |
| workspace-v7 | same | 16 to 15: same, index 8 |
| backup-v6-blocked | same | 15 to 14: same, index 8 |
| backup-v7 | same | 16 to 15: same, index 8 |

Diff: 4 files, 16 insertions, 32 deletions. Green: `npm run verify:fixtures` OK (all workspace and backup folders views equal); integration d7, d7s, d8, d8r plus tools fixture-views and verify-fixtures tests: 49 files, 133 tests passed.


ocr of T95.49-F1 (session 5ae0de35, with a scratch rule including the fixture views): 4 files, 0 findings. `evidence/D95/ocr/T95.49-F1-8cc523bf.json`. Next: run `t95.49-settle-later` (browser-auto bb67fedd).

Run `t95.49-settle-later` (browser-auto bb67fedd, full tier: first matching path src/ui/screens/DayCard.tsx): unit 3127, integration 364, browser 127, 79, 55 and 160 (4 skipped), checks 14 of 14. Passed. T95.49 done.

### T95.50

Commit `cfdb6088` (record-position-change.ts, new record-expiration-reason.test.ts): an expiration accepts only a completed reflection (`ReflectionMustComplete`, field reflection); a terminal expiration's Close Review must be Defer (`CloseReviewMustDefer`, field closeReview); `ExpirationReasonRequired` (field: the Expiration Reason prompt id) when the contract is in the money at the settling session's Underlying Mark (`standingOf` from `src/coordinators/settlement.ts`; settling session from `settlementTime`, so a non-session expiration uses the session before) and the completed reflection has no reason. A form without the Expiration Reason prompt asks none. 7 cases; red then green: 2, 5; first-run passes flagged and mutation-checked: 1, 3, 4, 6, 7 (each mutated run "1 failed"; first failure lines not captured). Deviations: cases 2 and 5's code written together; case 3's first red row was invalid (wrong field name) and removed; the Expiration Reason prompt lookup is a local copy of the Plan Departure one in `sale-measure.ts`.
- Reads: at most one stored read per expiration (`historicalFrames` for the settling session's Underlying Mark), only when a completed reflection has no reason and the form has the prompt; a read that throws counts as no Mark (no reason asked). No measuring test added.
- The reason is checked only when the reflection is Complete; a non-Complete reflection returns `ReflectionMustComplete` alone.
- Checks: src/coordinators and tests/integration 986 passed, **6 failed** (tests T95.48 did not reach, against decision 65's "no further test edit"): record-position-change-options.test.ts two (the "should commit E1…" loop of Complete, Decline, Defer for the Close Review; the "should reject a Close Reason on E1…" case sends a Complete Close Review), trade-views/option-views.test.ts two and replay-trade.test.ts one (a Complete Close Review on an expiration), daily-review/settlement.test.ts one (defers an expiration's reflection). Follow-on **T95.50-F1** moves them to the A312 dispositions, after this task's ocr. Rest of src 2386 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; frozen fixture views and tools needed no change.
- Browser: 13 specs (d7 review-expiration, settlement-due, responsive-a11y, kill, offline, no-save, runtime-failure; d8p states, journal-final-session; d9ar chart, states; d8r responsive-a11y; d8 after-restore) 39 passed. The keyboard-only expiration case still asks no reason (no Mark saved).

ocr of T95.50 (session ec694ec2): 2 files, 1 finding, Valid, bug task. `evidence/D95/ocr/T95.50-cfdb6088.json`.
- **T95.50-B1** (Valid, `record-position-change.ts:495`): `ExpirationReasonRequired` is pushed as a TradeWorkflows issue, and any such issue skips `derive(...)`, so an in-the-money expiration with no reason and a wrong quantity or settlement time returns only `ExpirationReasonRequired`, hiding `ExpirationMustSettleAllOpen` / `SettlementTimeInvalid` (against case 7's "as today"). Nothing is recorded wrongly. `PlanDepartureReasonRequired` has the same shape (not raised by ocr; noted). Cases: it should return `ExpirationMustSettleAllOpen` together with `ExpirationReasonRequired` for an in-the-money expiration with no reason that settles part of the open quantity; it should return `SettlementTimeInvalid` together with `ExpirationReasonRequired` for one with a wrong settlement time.

### T95.50-B1

Commit `9b8e9c38`: the check that skips `derive(...)` now ignores an `ExpirationReasonRequired` issue (one line), so a missing reason no longer hides `ExpirationMustSettleAllOpen` or `SettlementTimeInvalid`. Case 1 red (only the reason issue), green. Case 2: the first fixture was wrong (Friday 21:30Z is valid; Saturday with now Friday trips `EconomicTimeInFuture`), so its first red and green rows aren't genuine; fixed to Saturday 15:00Z with now Monday, fix removed for a genuine red, restored, green; a note row records it. trade-workflows: only the two known T95.50-F1 failures; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.
- Agent note (not an ocr finding): `PlanDepartureReasonRequired` has the same shape (pushed before the `derive(...)` skip check), so a sale missing its reason hides the derivation's findings too. Not a bug task; for the final report.

### T95.50-F1

Commit `8d3aadcd` (tests only, plus `eslint-suppressions.json`: a stale `no-nested-ternary` entry for record-position-change-options.test.ts removed, since lint fails on a stale suppression). record-position-change-options "should commit E1…" runs Defer only (name kept); pairing row: its Complete and Decline Close Review iterations retired by A312 (a sale's dispositions are covered by I7.5, moved in T95.48); "should reject a Close Reason on E1…" sends Defer. option-views `closeLongCall`, `closeCashSecuredPut` defer the Close Review (unused `closeReviewForm` removed). replay-trade R-DALE-U "Expired" sends `stack.expirationReflection` and Defer, resolving the Close Review through the Debt as replay-series-stack does. settlement.test.ts owed case now sends a completed reflection; its subject is the owed Close Review (renamed; one item carrying the Expiration, was two). Sweep of `kind: 'Expiration'` in src/ and tests/: nothing else needed. Two more cases in record-position-change-options send `closeReviewForm` on an expiration and stay green (their issue lists don't depend on the Close Review); left. Log hand-written (tdd.sh is vitest-only). src/coordinators and tests/integration 994 passed (was 988 and 6 failed); typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.

ocr of T95.50-B1, T95.50-F1 (session be279bde, range 9b8e9c38^..8d3aadcd): 7 files, 0 findings. `evidence/D95/ocr/T95.50-B1-F1-8d3aadcd.json`. Next: run `t95.50-expiration-reason` (browser-auto 9e348856).

Run `t95.50-expiration-reason` (browser-auto 9e348856, task tier: no changed path on the full-tier list): unit 3136, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.50 done.

## T95.51 — The expiration form becomes a component

Structural task; no red/green rows.

- Split: `ExpirationForm` (component, props facade, tradeId, timeZone, onDirtyChange, onDone, backLabel, fromReview) and `ExpirationFormRoute` (route screen reading the path's tradeId and `?from=review`, wrapping it with onDone navigating to the Trade and backLabel "Back to the Trade"), both in `src/ui/screens/ExpirationForm.tsx`. `src/main.tsx` now places `ExpirationFormRoute`. `onDone` is accepted and unused until T95.52 places the card variant (as ExitForm's was until T95.40). No screen words changed; no Expiration Reason shown (T95.52).
- Tests: `ExpirationForm.test.tsx` (9) and `ReviewExpiration.test.tsx` (2): only the render call's component name changed to `ExpirationFormRoute`; `npx vitest run src/ui/screens/ExpirationForm src/ui/screens/ReviewExpiration`: 2 files, 11 passed.
- `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d7/kill.spec.ts no-save.spec.ts review-expiration.spec.ts runtime-failure.spec.ts settlement-due.spec.ts responsive-a11y.spec.ts offline.spec.ts`: 11 passed. Ports 5175, 9341, 9342 clear before and after.
- typecheck, tsc6, lint, lint:deps: exit 0.


T95.51 main-session note: commit `0e26fdef`; `ExpirationForm` takes `onDone`, `backLabel` and an added `fromReview` (the receipt needs it); new `ExpirationFormRoute` in the same file reads `tradeId` and `?from=review`, "Back to the Trade"; main.tsx places it. `onDone` unused until T95.52. Render-call name changes in ExpirationForm.test.tsx and also ReviewExpiration.test.tsx (not in the brief). Unit 11 passed; d7 kill, no-save, review-expiration, runtime-failure, settlement-due, responsive-a11y, offline 11 passed unchanged; d8p, d9ar, d8r callers of recordExpiration not run (the suite run covers them). No words changed.

ocr of T95.51 (session 2aaed851): 4 files, 1 finding, Valid (latent, `ExpirationForm.tsx:148`: `onDone` is never read, so the back control always links to the Trade; a card embedding the form would leave the Review). Not a bug task: as with T95.31 and T95.32, the next planned task builds it — T95.52 places the form in the card and wires `onDone` (the exit form's `onDone` was likewise unused until T95.40); carried to T95.52's brief. `evidence/D95/ocr/T95.51-0e26fdef.json`. Next: run `t95.51-expiration-form` (browser-task, Standard).

Run `t95.51-expiration-form` (browser-task): unit 3136, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.51 done.

### T95.52

Commit `6a7034e6` (18 files): `ReviewSettlement.tsx` becomes `ExpirationBlock`: W136 heading, W137 standing, the choices by standing (W138: "record later" main in the money, "Record expiration" main out of the money (W141), all three with no main button and W142 with no Underlying Mark), W139 under "record later", Settle Later saved with W143's line and the other two choices kept (no undo, Q7), "It expired worthless" in the money states what it books (W140) and asks the Expiration Reason before "Record expiration anyway", "Sold/Bought back before the close" opens the sale form in the card. The expiration form in the card and at Trade Detail sends a completed reflection and a deferred Close Review (the reflection's own optional prompts kept, "Reflection on this expiration"); it uses `onDone` ("Back to the Review" in the card; T95.51's ocr finding met). `PANELS` is `['Reflections', 'Action']` (S2: Settlement leaves; `PanelProgress` keeps 'Settlement'); a card with a settlement item mounts ActionForm with a new `idle` prop rendering the block until the sale form opens. `ExpirationReceipt` gains `onDismiss`. `describeExpirationIssues` maps `ExpirationReasonRequired` to "Say why.". DayCard's settle link has no `panel`. e2e/d7/support.ts: `openSettlement`/`settlementHeader` → `openExpiration(page, card)`; `recordExpiration(page)` saves and answers the reason after a refusal; new `recordExpirationInCard`; the label regex matches W140's prompt. 13 cases red then green; five more added after review (the reflection's optional prompts restored, the form's own save offered to the card (W128), Refresh after a refused "record later", a short contract's worth as an amount, no "Record expiration" for a date outside the market calendar), each red then green. First-run pass flagged and mutation-checked: case 12. Unit 3031 passed; typecheck, tsc6, lint, lint:deps clean.
- At Trade Detail the Expiration Reason appears only after the workflow refuses with `ExpirationReasonRequired` (Trade Detail's read carries no standing; no read added). In the card it appears at once in the "It expired worthless" path.
- Case 13: jsdom can't lay out, so the unit case reads app.css; the 375 proof is e2e/d7/review-expiration (out-of-the-money block: a row at 1280, a column at 375, no sideways scroll); the in-the-money block isn't checked at 375.
- Dropped from the old Settlement panel: the contract, quantity and settlement-time lines and the "wasn't a trading session" note (the form still shows the first three); the assignment/exercise limit sentence replaced by W139. Settle Later is offered whether or not Marks are entered. needs-you.props.ts unchanged ("this Trade stays open" still true). No data added.
- Browser: d7 review-expiration, settlement-due, responsive-a11y, kill, offline, no-save, runtime-failure 11 passed; d8r responsive-a11y, d95 card, day-card, action, exit-banner, refusal, sale, d8p states, journal-final-session, d9ar states 50 passed.

ocr of T95.52 (session 5946152c): 17 files, 2 findings. `evidence/D95/ocr/T95.52-6a7034e6.json`.
- **T95.52-B1** (Valid, `src/ui/screens/ReviewSettlement.tsx:105`): while the "record later" save is in flight only its own button is disabled; the sale, "Record expiration" and "It expired worthless" buttons stay enabled, and a form opened in that window loses its draft without warning when the save finishes and the card moves on (`ReviewView.saved` excludes `action:<tradeId>` from its dirty-form check). Cases: it should disable the block's other choices while "record later" is saving; it should enable them again when the save is refused.
- Style only (tech-debt.md): `ReviewCard.tsx:271` the open-panel `useState` initializer nests a ternary inside `??`.

### T95.52-B1

Commit `73ea3b70`: `disabled={saving}` on the sale button, "Record expiration" and both "It expired worthless" buttons. Case 1 red ("Sold before the close" enabled), green. Case 2 first-run pass, flagged; mutation (no `setSaving(false)` in `recordLater`'s finally) failed `expected true to be false`, restored; a green row was logged before the fix (ordering slip, explained in a note row). ReviewSettlement and ReviewCard tests 198 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; e2e/d7/review-expiration 1 passed.

ocr of T95.52-B1 (session 448d2ed9): 2 files, 0 findings. `evidence/D95/ocr/T95.52-B1-73ea3b70.json`. Next: run `t95.52-expiration-block` (browser-auto 9766fe8a).

Run `t95.52-expiration-block` (browser-auto 9766fe8a, full tier: first matching path e2e/d7/no-save.spec.ts): unit 3153, integration 364, browser 127, 79, 55 and 160 (4 skipped), checks 14 of 14. Passed. T95.52 done.

### T95.53

Commit `ebd31554`: the finished day reads "Complete, settlement to record" in amber (`data-tone="warning"`, existing `--warning-text`) with a "To record" row after "You chose" and before "Tomorrow" (W145); the day card counts expirations to settle (W96); the next Review's card says "record later" was chosen and that it asks again (W144, from `settledLaterOn`); the card is labelled "Expired: settle" with no Mark need ("To do: Settle"); the Now box row reads "Fri Nov 20 · expired" (W90). `ExpirationBlockProps` gains `settledLaterOn`. No data added (count, Trade names, quantity, date from `completion.trades`, the Settlement items and `settledLaterOn`). Cases 1 and 3 red then green; first-run passes flagged and mutation-checked: 2, 4, 5 (case 4's first run failed on a fixture error, not a valid red). Case 4's "asks no Marks" is proven only as a card with no Mark need; the coordinator side the day after wasn't checked. src/ui/screens 900 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser: d7 review-expiration, settlement-due, d95 day-card, card 12 passed; none covers the new day, the day-after card or the amber heading at 1280 and 375 (B95.12, T95.66). No P137 shortening.

ocr of T95.53 (session 46f2ff1d): 7 files, 0 findings. `evidence/D95/ocr/T95.53-ebd31554.json`. Next: run `t95.53-settlement-day` (browser-task, Standard).

Run `t95.53-settlement-day` (browser-task): unit 3158, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.53 done.

### T95.54

Commit `9f69da24`: new `keyMoments(sessions: readonly ReplayedSession[]): readonly KeyMoment[]` (`KeyMoment = { date; kinds }`, `KeyMomentKind = 'Entry' | 'Low' | 'Stop' | 'Target' | 'High' | 'Sale' | 'Now' | 'End'`), exported from trade-analysis' index; not yet carried on `replayTrade` or `getTrade` (T95.55). Cases 1-5 red then green; case 7 first passed by insertion order, strengthened (a Low after a later sale), then red and green with a sort by date; case 6 first-run pass, flagged, mutation (key by date and kind) failed, restored. trade-analysis 303 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.
- Assumptions: Entry is the series' first session; Low and High by `tradePnl` dollars over Value sessions, a tie keeps the earliest (all equal: day 1 is Entry, Low and High); Stop and Target from the last session's `crossings.stop.first` and `crossings.target.first`; a Sale is a session whose markers hold an Execution that Reduced or Closed (a buy to close a short counts; an Expiration doesn't); Now when the last session holds a Position, else End; kinds in the fixed order Entry, Low, Stop, Target, High, Sale, Now, End.

ocr of T95.54 (session 96871c81): 3 files, 1 finding, Valid, bug task. `evidence/D95/ocr/T95.54-9f69da24.json`.
- **T95.54-B1** (Valid, `key-moments.ts:36`): Now/End is read from `heldQuantity`, a signed net sum (`replay-series.ts:216`, `derive.ts:169`), so an open spread whose legs offset reads zero and its last session is End instead of Now. Cases: it should give Now for an open Trade whose positions' quantities sum to zero; it should give End when no position is held.

### T95.54-B1

Commit `1499c00f`: the last session reads End when `last.positions.length === 0` (positions holds only open lots), else Now; unused `ZERO` removed. Case 1 red (legs +1 and −1, heldQuantity 0; a first red on a stray High in the fixture was not genuine, fixed, reverted, genuine red), green. Case 2 first-run pass, flagged, mutation (End and Now swapped) failed, restored. trade-analysis 305 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.

ocr of T95.54-B1 (session 73da9999): 2 files, 0 findings. `evidence/D95/ocr/T95.54-B1-1499c00f.json`. Next: run `t95.54-key-moments` (browser-task, Standard).

Run `t95.54-key-moments` (browser-task): unit 3167, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.54 done.

### T95.55

Level raised from Standard to Full (decision 122: its Files line changes coordinators, `assemble-replay.ts`, `replay-view.ts`, `daily-review.ts`, `trade-views.ts`): ocr, then the run with `browser-auto b1bf44fa`.

Commit `8630e82d` (assemble-replay.ts, replay-view.ts, daily-review.ts, two test files): each replay session carries `action?: ReplayAction` (`{ action; intent? }`, intent from the saved reason) and `planCall?: PlanCall` (already present at runtime, now typed); `TradeReplayView` gains `keyMoments?`; `assembleReplay` options gain `actions?` (supplied by the card with `withJournal: false`, else from the narrative page's actions); `replayView` takes them as a new optional last parameter; Actions whose Review Date matches no session are dropped. In `getTrade`, `history` is now built before the replay from the same per-card read. A Settle Later is placed like any Action. Cases 1, 4 and 6 (replay-trade) red then green; first-run passes flagged and mutation-checked: 2, 3, 5, 6 (card equals replayTrade); keyMoments and the planCall type were coded early, reverted for a genuine red. Request counts: no tally changed; R6 still one `journalEntries.getAll`; `open` untouched. Entry: `replaySessions` starts the series at the first session closing at or after the first exposure, so Entry is the entry session on both replays (the T95.54 note is met). src/coordinators and trade-analysis 942 passed, tests/integration 364 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser not run (fields added only; e2e doesn't read them); no fixture view changed.

ocr of T95.55 (session a3418e8b): 5 files, 0 findings. `evidence/D95/ocr/T95.55-8630e82d.json`. Next: run `t95.55-replay-actions` (browser-auto b1bf44fa).

Run `t95.55-replay-actions` (browser-auto b1bf44fa, task tier: no changed path on the full-tier list): unit 3174, integration 364, browser 5 and 49, checks 14 of 14. Passed. T95.55 done.

### T95.56 — parked (pending decision Q10)

The tdd-task built nothing. Cases 6 and 7 need a replay on the owed card (`assembleOwedCard`, `daily-review.ts` ~841), which reads no Marks; only walked cards assemble one, and decision 131 covers no new read. Options put to the user: (1) the owed card reads its replay with `withJournal: false` (one replay read per owed card, pins change, recorded) (recommended); (2) words only on an owed card; (3) walked cards only, cases 6 and 7 moved. Findings for the resumed task: the replay carries what the chart needs (reuse `replay.props.ts` and `geometry.ts`); no field gives the sessions past a line or the session number and total, to be added as card fields under decision 131 the way `pastLineOf` counts them (`read.sessionDatesBetween(since, reviewDate)`); low and high from `keyMoments` and `tradePnl`; the Replay button sits in the Action panel (`ReviewCard.tsx` ~443) and `openReplay` hard-codes `panel=Action`; the mockup's "never under water" branch has no W row; X15's specs: e2e/d8p/responsive-a11y, d9/states, d9ar/review, d9ar/states. Carrying on with T95.57 meanwhile.

### T95.57

Commit `26626d39`: the Replay opens from a Review card on the first crossing's session when past a line, else the newest (read when the button is pressed; a saved slider position still wins); Trade Detail unchanged. "What you did that day" (fills, the Action and its reason, "no reason given", "No Review this session.", "Action: not chosen yet.", "Nothing recorded.", a Settle Later as "Expired. You chose Exercised: record later.") is the first thing in the readout column (`Readout` gains `lead`). The Action row under the chart with its key (W149). Key moments drop-down (W148) moves the slider; "No key moment this session." 44px slider and step buttons. New `action-row.tsx`, `key-moments.tsx` (+ props), `day-card.tsx`, `day-words.props.ts`; optional types `DayWords`, `ActionMark`, `KeyMomentsWords`; `ReplayFrameSession.day?`/`actionMark?`, `ReplayProps.actionKey?`/`keyMoments?`. 8 cases plus three added ("Nothing recorded.", Settle Later's words, the last session of a contract due for settlement is not a missed Review), each red then green; first-run pass flagged and mutation-checked: case 2. `day-words.props.ts` was written whole ahead of case 4's red and cut back, branch by branch. Case 8 reads the CSS text (jsdom).
- Rule for "No Review this session.": a session with no Action, the Position held at its close, and not the last session of a Trade with nothing to come; an Open Trade's last session reads "Action: not chosen yet."; the last session of an ended Trade or a contract due for settlement reads neither (A315). A Settle Later saved on a Review Date after the expiration session lands on no session (needs coordinator data; not added).
- Phone: the drop-down sits under the chart (above it pushed d9ar's one-screen check to 702px), so the focus order differs from the mockup. A fill appears in "What you did that day" and in Position's Execution row and the session cards' Events row (a repeat; for the critic). Not built: "Next moment", "1 of 4 seen" (T95.59); moment sentences (none in W148).
- Browser expectations changed by A318 (a BREN card now opens on Thu Nov 12): e2e/d9/review.spec.ts, d9ar/responsive-a11y.spec.ts (End first; phone "Thu Nov 12 · 9 of 11"), d9ar/review.spec.ts (headline "+$982.00 · 3.03R"; End first); e2e/d9/replay.spec.ts's later-session check now excludes the drop-down — pending decision Q11 (queued). New e2e/d95/replay-day.spec.ts (two tests at 1280 and 375).
- Checks: src/ui 1534 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser: e2e/d9* (incl. d9ar, d9r2), d95/replay-day, d8p/responsive-a11y 164 passed; d8p/settlement-due-replay 3 passed. No data added.

ocr of T95.57 (session 98fd0298): 20 files, 3 findings (2 Valid, the same defect, one bug task; 1 Doubtful). `evidence/D95/ocr/T95.57-26626d39.json`.
- **T95.57-B1** (Valid, `action-row.tsx:11` and `frame.tsx:118`): the Action row puts each cell in grid column `i + 2` by array index, but the chart places sessions by weekday `slot` (`plot.props.ts:82-83`, holiday slots blank, A256), so after a gap or holiday the marks sit under earlier dates. Cases: it should place each session's Action mark in its session's slot column after a holiday gap; it should leave the holiday's column empty.
- **T95.57-B2** (Doubtful, `day-words.props.ts:34`): the missed-Review rule reads `heldQuantity`, a signed sum, so a Trade with offsetting legs gets "Nothing recorded." instead of "No Review this session." or "Action: not chosen yet." (same shape as T95.54-B1). Cases: it should read "No Review this session." for a session with no Action while offsetting legs are held; it should read "Action: not chosen yet." on such an Open Trade's last session.

### T95.57-B1

Commit `774642b4`: each Action row cell takes `slot` (from `s.plot.slot` in frame.tsx); the grid column is `slot + 2`. Both cases red then green (Mon Nov 2, Tue Nov 3, Thu Nov 5, Fri Nov 6; Wed Nov 4 the holiday). src/ui/cockpit/replay 275 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d95/replay-day 2 passed.

### T95.57-B2

Commit `92f7c50b`: day-words.props.ts reads `session.positions.length > 0` (positions already reach the props; no coordinator data). Both cases red ("Nothing recorded.") then green. The test double `day()` gives a held-0 session an empty `positions` list (the real view lists only open lots); new `spread()` double. src/ui/cockpit/replay 277 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d95/replay-day 2 passed.

ocr of T95.57-B1, T95.57-B2 (session 3a455706, range 774642b4^..92f7c50b): 4 files, 0 findings. `evidence/D95/ocr/T95.57-B1-B2-92f7c50b.json`. Next: run `t95.57-replay-day` (browser-auto c0890903).

Run `t95.57-replay-day` (browser-auto c0890903, full tier: first matching path e2e/d9/replay.spec.ts): unit 3189, integration 364, browser 127, 79, 55 and 162 (4 skipped), checks 14 of 14. Passed. T95.57 done.

### T95.58

Commit `f6f84ca9`: the closed card says how the Trade ended (W150; long, short, expiration, mixed) with the date and result, sets the Plan beside what happened in a table ("Plan and what happened": Entry, Stop, Target, Exit, Result), shows no Lifecycle or Terminal Disposition and dates as dates, labels the card by its Close Review (due, next Review, saved, declined; W151), offers "Write the Close Review" (opens the existing Debt form until T95.59) and "Not due until the next Review." for a Close Review not Due, keeps a Position Change Reflection answerable, and stacks at 375. New `closed-card.ts` (`howEnded`, `planResultRows`); `conditionLines` exported from plan-risk.props.ts; ReviewReflections.tsx (shared with walked cards) keys the label and note on `entryTypeKey`. Coordinator: Closed summary's `plan`, `fills`, `expirations`; `OwedReflection.entryTypeKey?` (data-additions.md). Red then green: the two coordinator cases, cases 2, 3, 5 ("due", "saved", "declined"; only "next Review" was built by T95.40, mutation-checked), 6, 8 (browser, e2e/d95/closed-card.spec.ts, logged by hand). First-run passes flagged and mutation-checked: 1 (built by T95.40/T95.40-D1; two mutations), 4 (built by cases 2 and 3; two mutations), 7.
- The Stop and Target "What happened" cells are empty (the mockup's "Never reached"/"Reached <date>" needs Marks, which the owed card doesn't read — Q10). The collapsed header can't know "saved"/"declined" without a read in `open`; they show once the card is loaded. Reflection rows still read "Position Change at 2026-10-12 11:00" (shared with walked cards; case 4 left them). An open Trade's owed card is unchanged, Lifecycle row included.
- Tests changed for X13: the owed-card Terminal Disposition test (row 23.12) removed, replaced by the option wording test; P19's test asserts the new card; the Replay-button test no longer looks for the Result region. e2e/d6 close-review and responsive-a11y: button renamed.
- Checks: src/ui, src/coordinators, src/app 2220 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser: d95 closed-card, sale; d6 close-review, responsive-a11y; d7 review-expiration: 15 passed.

ocr of T95.58 (session 2a845f87): **partial** — ChatGPT's usage limit (`subscription_sharing_usage_limit_exceeded`) failed one request covering 8 files (e2e/d6/close-review, e2e/d6/responsive-a11y, e2e/d95/closed-card specs, src/ui/app.css, ReviewCard.test.tsx, ReviewOwed.test.tsx, ReviewOwedCard.tsx, closed-card.ts); a rerun over the commit is owed once usage resets. 14 files reviewed, 2 findings, bug tasks. `evidence/D95/ocr/T95.58-f6f84ca9-partial.json`.
- **T95.58-B1** (Valid, `ReviewReflections.tsx:81`): "Not due until the next Review." shows for any Close Review that is not Due, so one classified `DueInReviewAfterNext` is described as due a Review too early (the group heading's `DUE_TEXT` disagrees). Cases: it should say the Review after next for a Close Review due then (reuse `DUE_TEXT`'s words); it should say "Not due until the next Review." only for one due in the next Review.
- **T95.58-B2** (Doubtful, `ReviewOwedCard.tsx:27-30`): a due Position Change Reflection makes the label "N reflection(s) due" before any Close Review state, so a Close Review that is next Review, saved or declined isn't shown on the card's label, and no test covers a due Position Change Reflection beside a Close Review. Cases: it should show the Close Review's state beside "N reflection due" when a Position Change Reflection is due on a closed card; it should keep "Close Review due" when the Close Review itself is due.

### T95.58-B1

Commit `57a35542`: a Close Review classified `DueInReviewAfterNext` shows "Due in the Review after next." (`DUE_TEXT` plus a full stop); "Not due until the next Review." only for `DueInNextReview`. Case 1 red then green; case 2 first-run pass, flagged, mutation (condition back to `!== 'Due'`) failed, restored. src/ui/screens 911 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d95/closed-card 1 passed.

### T95.58-B2

Commit `0f1a0faa`: a closed card owing a due Position Change Reflection reads "N reflection(s) due · " plus W151's Close Review state ("Close Review · next Review", "saved", "declined"); a due Close Review still reads only "Close Review due"; `DueInReviewAfterNext` isn't named on the label (W151 has no words). Case 1 red then green; case 2 first-run pass (built by T95.40), flagged, mutation (due check only when `dueNow === 0`) failed, restored. src/ui/screens 913 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; browser d95 closed-card, sale, d6 close-review: 10 passed, exit 0 (per-spec lines for two not separately seen). Waiting: ChatGPT usage limit (hit 2026-11-26 ~10:52Z) for the rerun of T95.58's ocr over the 8 failed files and the ocr of B1 and B2.

ocr of T95.58, rerun over the whole commit (session c1007ee8): complete, no failed items; 14 files reviewed, 2 findings. `evidence/D95/ocr/T95.58-f6f84ca9.json`.
- Finding 2 (`ReviewOwedCard.tsx:27`, the `dueNow > 0` return hides the Close Review state) is the same defect as T95.58-B2, fixed at `0f1a0faa`; no new task.
- **T95.58-B3** (Valid, `closed-card.ts:42`): a short Plan stores a signed quantity (`'-2'`, copied from the leg by `daily-review.ts`), so the Plan's Entry cell reads "Sell -2 contracts" and a one-contract short (`'-1'`) gets the plural unit. Cases: it should show a short Plan's quantity without its sign ("Sell 2 contracts"); it should use the singular unit for a one-contract short ("Sell 1 contract").

ocr of T95.58-B1 and T95.58-B2 (range `57a35542^..0f1a0faa`, session defa83ef): complete, 3 files, no findings. `evidence/D95/ocr/T95.58-B1-B2-0f1a0faa.json`.

### T95.58-B3

Commit `a81e038f`: a short Plan's Entry cell names the count without its sign ("Sell 2 contracts", "Sell 1 contract"); the stored quantity is parsed with `parseDecimal` and its sign dropped (Rational has no absolute value), falling back to the raw text if it doesn't parse. New `closed-card.test.ts`. Cases 1 and 2 red then green; no first-run passes. src/ui/screens 915 passed (before a lint refactor), closed-card and ReviewOwed 28 passed after; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d95/closed-card 1 passed.

ocr of T95.58-B3 (session 48d34c6f): complete, 2 files, no findings. `evidence/D95/ocr/T95.58-B3-a81e038f.json`.

Run `t95.58-closed-card` (browser-auto 3d9cddb1, full tier; at `4ecc2c20`): unit 264 files, 3203 passed; integration 158 files, 364 passed; browser-1 127 passed, browser-2 79 passed, browser-3 55 passed, browser-4 1 failed, 4 skipped, 162 passed; 14 of 14 checks exit 0; run-complete. The failure: `e2e/d95/closed-card.spec.ts:26` (T95.58's own spec, which passed alone in T95.58, B2 and B3) found no "Trades with owed reflections" group at 1280. Its snapshot shows ABC still open with an Exit chosen and the Mark not saved, so the sale had not landed when the spec went back to the Review: a likely race in the spec's `closeAbc`. Follow-on **T95.58-F1**: reproduce under load (`--repeat-each`), fix the cause, then rerun.

### T95.58-F1

Commit `d27ebbd1`: `closeAbc` in e2e/d95/closed-card.spec.ts clicked "Save exit" then "Back to the Review" at once, so the Review could open before the sale saved. It now waits for "Recorded. ABC is closed. Its Close Review is due in the next Review." first, as sale.spec.ts does. No app fault seen. Reproduced 1 failed of 10 (`--repeat-each 10`, workers 1); after the fix 20 of 20 passed. Test-only; kept at Full (its row was opened at Full, and a level isn't lowered).

ocr of T95.58-F1 (session fb5fcd4c): complete, 1 file, no findings. `evidence/D95/ocr/T95.58-F1-d27ebbd1.json`.

Run `t95.58-f1-closed-card` (browser-auto 3d9cddb1, full tier; at `b1bf2862`): unit 264 files, 3203 passed; integration 158 files, 364 passed; browser-1 127, browser-2 79, browser-3 55, browser-4 163 passed, 4 skipped; 14 of 14 checks exit 0; run-complete. Passed. T95.58 and T95.58-F1 done.

## T95.62

Commit `b8b817c6`: Part C's capability variants. `DailyReview.open` adds `SettlementToRecord` (the `CompleteWithSettlementToRecord` completion kind it returns); `DailyReview.getTrade` adds `ExpirationStanding`, `SessionActions`, `KeyMoments`; `DailyReview.save` adds `SettleLater`; `replayTrade` (and the trade-detail route's entry) adds `SessionActions`, `KeyMoments`; `recordPositionChange` (and the record-entry route) drops `CloseReviewComplete`, `CloseReviewDecline`, keeps `CloseReviewDefer`. I95.7's case renamed to name Part C; red (`open` lacked `SettlementToRecord`) then green; no first-run passes. workspace.test.ts's lists updated list-only.
- Departure from the plan's list (from the handoff note of T95.49): `ExpirationStanding` is named under `getTrade`, not `open`: the field is on `getTrade`'s card and `open` reads no replay; no read added, no pending decision.
- Level kept Standard: `capabilities.ts` sits under src/coordinators but the plan names it as this task's file (as for T95.23 and T95.43, both Standard), and only string lists changed.
- Checks: src/coordinators/workspace and d95 capabilities 141 passed; verify:capabilities, typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. No e2e spec edited.

ocr of T95.62 (session 3aa11e3f): complete, 4 files, 1 finding. `evidence/D95/ocr/T95.62-b8b817c6.json`.
- Doubtful (`capabilities.ts:105`): `ExpirationStanding` is under `getTrade`, not `open` as the plan names. It is this task's recorded departure; making it match the plan would add a read to `open` (decision 131 covers only fields from data already read), so it is a pending decision, queued as Q12 (recommend: keep `getTrade`, correct the plan's wording), not a bug task. T95.62 is not parked: it is built as the recommended option.

Run `t95.62-capabilities` (browser-task; at `06f282e7`): unit 264 files, 3203 passed; integration 2 failed, 362 passed; browser 57 passed; 14 of 14 checks exit 0; run-complete. Failures: `tests/integration/d9/capabilities.test.ts` (I9.7) and `tests/integration/d9ar/capabilities.test.ts` (I9AR.3) assert the exact `replayTrade` list, which T95.62 lengthened by `SessionActions` and `KeyMoments` (the reported "4 more" counts both lists' compare). T95.62 updated only workspace.test.ts and the d95 test. Follow-on **T95.62-F1**: those two tests take Part C's list.

### T95.62-F1

Commit `88ab7b8f`: I9.7 (the manifest's and the trade-detail route's `replayTrade` lists) and I9AR.3 (its manifest list; its route check is `arrayContaining`) take Part C's list, extended in place as `f327db49` did. No other stale exact list in tests/ or src/. Integration 158 files, 364 passed; typecheck, tsc6, lint (2 pre-existing warnings) exit 0.

ocr of T95.62-F1 (session f9624c73): complete, 2 files, no findings. `evidence/D95/ocr/T95.62-F1-88ab7b8f.json`.

Run `t95.62-f1-capabilities` (browser-task; at `8cd2bb5a`): unit 264 files, 3203 passed; integration 158 files, 364 passed; browser 57 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.62 and T95.62-F1 done.

## T95.63

Fixtures frozen for manifest 6 (structural; the naming and content checks were written red first, rows in `tdd-log/T95.63.md`).
- Route: `workspace-v7-seed6` is built by `tools/fixtures/freeze-seed6.ts`, not by rerunning the old script. It loads the frozen `workspace-v7/dump.json` (read only), launches this release on it (the app delivers the three Journal revisions, named in its receipt: position-change-reflection, daily-trade-review, close-review; the Catalog adds nothing), then records the new content through the facade under ids prefixed `fx6-`. The old script cannot run on this release (a closing sale must defer its Close Review, a sale or expiration cannot be declined). The Debts of SYY and O-S supply the Close Reviews owed under the earlier form.
- Content (Friday 2026-11-20 Review Date): Hold with a reason (KO) and without (CSCO, Plan Call agrees); Exit with a reason (PFE) and without (XYZ at its Stop); Roll (QRS) and Adjust (MNO) with reasons (Roll and Adjust are refused without one, so those kinds exist only with); Settle Later (the XYZ call); PDR, a whole sale inside its Stop and Target with its Plan Departure Reason; PRT, a part sale with its reason; CLA, sold at its Target, its Close Review answered under the new form including its required key lesson; DEF, a short put expired in the money at Friday's Mark with its Expiration Reason. Close Reviews owed: two under the earlier form, two under revision 2 (PDR, DEF).
- `npm run fixtures:freeze -- --schema 7 --seed 6`: wrote tests/fixtures/workspace-v7-seed6; a second run exit 1, "exists; committed fixtures are never regenerated".
- `npm run fixtures:freeze-backup`: wrote tests/fixtures/backup-v7-seed6 (11949 bytes, Restore made 0 repairs); the five existing folders were reported as existing and left alone. A second run exit 1. Assumption: with several folders, existing ones are skipped and the run fails only when it writes nothing (the earlier loop threw at the first existing folder and so could never add one).
- `npm run verify:fixtures`: exit 0 for workspace-v1 to v7, workspace-v7-seed6, backup-v3 to v6 blocked, backup-v7 and backup-v7-seed6.
- `git diff -- tests/fixtures`: empty (no existing folder touched; no expected-views.json changed); only the two new folders are untracked.
- Checks: tools tests 126 passed; d8 round-trip and d8r restore integration (loop BACKUP_SCHEMAS) passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. No e2e spec edited.

T95.63 (main session's notes on commit `4c8bab62`):
- Level raised from Standard to Full: the commit writes frozen fixtures and the fixture tools (decision 122 lists fixtures under Full).
- Built by loading `workspace-v7/dump.json` read-only, launching this release on it (three revisions delivered, named in the receipt), then recording the seed-6 content through the facade: the old rebuild script can't run on this release (a closing sale must defer its Close Review; a sale or expiration can't be declined). `fixtures:freeze-backup` now skips existing folders and exits 1 only when it writes nothing.
- No older folder's `dump.json`, `backup.tjbackup` or `expected-views.json` changed (`git diff -- tests/fixtures` empty for them).
- The seed-6 Workspace's Review Date is Friday 2026-11-20 (for T95.64, T95.65).
- The subagent ended the commit with a Co-Authored-By naming Claude Sonnet 5.5 (the model it ran on) rather than the brief's line; left as it is.

ocr of T95.63 (session a8ac4d3d): complete, 7 files reviewed (8 generated fixture files excluded), 2 findings. `evidence/D95/ocr/T95.63-4c8bab62.json`.
- **T95.63-B1** (Valid, `tools/fixture-views.ts:190`): the "Close Review answered" check counts every `entry-type.close-review` journal record, owed Debts included (the seed-6 views hold 3 answered Entries and 4 Debts), so `>= 3` passes with no answered Close Review at all. Cases: it should name the answered Close Review when the views hold only owed Close Review Debts; it should name it when the only answered Close Reviews are under the earlier form (the one answered under revision 2 is missing); it should pass on the frozen seed-6 views.
- Dismissed (Wrong, `fixture-views.ts:182-183`): Roll and Adjust are checked only for existence, not with and without a reason. A308 and T95.31, T95.32, T95.33: a Roll or Adjust without a reason is refused (`IntentRequired`), so there is none to freeze.

### T95.63-B1

Commit `371a35ae`: the seed-6 check needs an Entry (not a Debt) of `entry-type.close-review` minted by the seed-6 freeze (id prefix `fx6-`; `fx6-0060`, answered from Debt `fx6-0043`). The views carry no form revision on an Entry, and the earlier-form Entries also hold a key lesson, so the freeze's id prefix is what tells the new-form answer apart (an assumption: it holds while the freeze answers no earlier-form Close Review). Cases 1, 2 red then green; case 3 first-run pass, flagged, mutation (`fx6-` to `fx9-`) failed, restored. tools 129 passed; verify:fixtures, typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0.

ocr of T95.63-B1 (session 6bc2024e): complete, 2 files, no findings. `evidence/D95/ocr/T95.63-B1-371a35ae.json`.

Run `t95.63-fixtures` (browser-auto 956f7a3c, which picked the task tier: no changed path is on the full-tier list; at `ae0bd7bb`): unit 264 files, 3212 passed; integration 158 files, 364 passed; browser 57 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.63 done.

## T95.64

First attempt (no commit): the generator is already on manifest 6 (T95.28) at version 9 (T95.28-B2), and its Actions already carry reasons as the new rule requires (Exit, Roll, Adjust carry an Intent; Hold none). But the committed `bench/dataset.json` and `bench/expected-open-rows.json` are still version 8; regenerated (about 14 minutes) they fail `bench:verify-capacity` until the basis is re-measured, which the brief had forbidden (`bench:setup`). Main session's calls, recorded as assumptions:
- The re-measure is part of this task: the plan's verification ("bench:verify-capacity passes; a changed basis is recorded with its cause") needs it. `bench:setup` and `measure:capacity` run on 4175, the benchmark's port.
- The generator's disposition mix (declined and completed sale reflections, Close Reviews completed or declined at the close) stays as it is. The plan asks only that its Actions carry reasons. The generated history is read as data from before Part C's rules, which existing Workspaces also hold. Not a pending decision.

Q10 answered 2026-11-26: option 1 (the owed card reads its replay). Decision 136, plan revision 125 (tag `claude-opus-5.5-plan-r125`); T95.56 gains cases 9 and 10. Noted: revisions 122, 123 and 124 (decisions 132 to 135) have rows in implementation-plan.md's decision table but no entry in revisions.md and no tag; left for the final report.

Q11 answered 2026-11-26: option 1 (keep the full Key moments list). Decision 137, plan revision 126 (tag `claude-opus-5.5-plan-r126`); T95.57 case 6 notes the exception to A276.

## T95.64 Benchmark generator and capacity on manifest 6

Commands and results (benchmark port 4175, free before and after each run):
- `npm run build:bench`, `npm run bench:generate`: generator 9, schema 7, 25,000 Trades, artifact 21,173,324 bytes, digest c8e03c999d4c40ea0ecdedaa8e7eaaec989b66496139680906cd8a026ca811ed (old: 6d819703928c5aa37ec3e9181b4ba164b325846296cf015f9412715cc894304b, generator 8). Writes bench/dataset.json and bench/expected-open-rows.json.
- `npm run bench:setup`: first-run Restore, 0 issues, 0 repairs.
- `npm run measure:capacity` then `npm run measure:capacity:reset-baseline` (the way T8.19-F1 first recorded the baseline; main session's call to run it).
- `npm run bench:verify-capacity`: pass. `npm run verify:capacity`: pass (required quota 2,737,548,396 = 3 x 912,516,132, unchanged).

Figures, old (D9 gate, evidence/D09/bench.md) to new:
| Figure | Old | New | Limit |
|---|---|---|---|
| Restored usage | 195,202,647 | 186,166,742 | |
| Usage over projection | 0.250 | 0.238 (projection 781,961,664) | 1.10 |
| Second Restore peak over M | 0.519 (473,280,928) | 0.476 (434,009,382) | below 3 |
| Baseline (bench/capacity-baseline.json) | 206,540,122, artifact 6d819703... | 186,166,742, artifact c8e03c99... | usage <= 1.50 x |
| Usage over baseline | 0.945 | 1.000 | 1.50 |
| Required quota | 2,737,548,396 | 2,737,548,396 | |

Cause: generator version 8 to 9 (T95.28 and T95.28-B2 changed the walk order and the Open rows), so the stored artifact, and with it the baseline's digest, changed; usage fell by about 4.6 percent. No limit was exceeded or loosened. No code change in bench-generator.ts was needed: its Actions already carry reasons as the new rule requires, and its disposition mix is unchanged (see above).

T95.64 (main session's notes on commit `68fcb9ee`): regenerated bench/dataset.json and expected-open-rows.json (generator 9, digest c8e03c99…, was 6d819703…) and re-measured the basis (`bench:setup`, `measure:capacity`, `measure:capacity:reset-baseline`, port 4175). Restored usage 195,202,647 to 186,166,742; usage over projection 0.250 to 0.238 (limit 1.10); second-Restore peak over M 0.519 to 0.476 (below 3); baseline 206,540,122 to 186,166,742 (usage over baseline 1.000, limit 1.50); required quota unchanged (2,737,548,396). Cause: generator version 8 to 9 (T95.28, T95.28-B2: walk order and Open rows). No limit exceeded or loosened. No bench-generator.ts change. A note for T95.65 and T95.67 added to the handoff (the benchmark history predates Part C's rules).

ocr of T95.64 (session 3fdb0a1c): complete, 2 files reviewed (bench/expected-open-rows.json too large, structural.md excluded by rule), no findings. `evidence/D95/ocr/T95.64-68fcb9ee.json`.

Run `t95.64-bench` (browser-task; at `50e4e5f6`): unit 264 files, 3212 passed; integration 158 files, 364 passed; browser 57 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.64 done.

### T95.56 — resumed (decision 136)

### T95.56 — the Replay strip on every card (resumed after decision 136)

The owed card (`assembleOwedCard`) assembles its Trade's replay (`withJournal: false`, from the read session it holds): one series read for each Instrument, nothing else added. **Pins changed by that read: none** — no request-count pin covers an owed card's `getTrade` (tests/integration d5r, d6, d9, d9ar, d9r2, d7sp all unchanged; the 158 integration files, 364 tests pass); the one-read claim is the case in `replay-strip.test.ts` (one `byInstrumentDate` getAll for MNP's one Instrument). New `replay-strip.ts` (`replayStripOf`) gives each card's `strip` (data-additions.md). The Replay strip: `ReplayStrip.tsx` (+ `replay-strip.props.ts`: words, chart path from `geometry.ts`), `CardReplay.tsx` (the strip with its overlay, shared by `ReviewCard.tsx` and `ReviewOwedCard.tsx`; the overlay logic moved there from CardBody, and the address entry now names the open panel, not always Action). The closed card's Stop and Target cells: "Never reached" or "Reached <Fri Nov 6>" from the strip's crossings, only for a line the Plan has.
- Cases 1 to 8 and 10 in `ReplayStrip.test.tsx` (1, 2, 3, 4, 6, 8), `ReviewCard.test.tsx` (5, 7), `closed-card.test.ts` (10); case 9 and the strip figures in `src/coordinators/daily-review/replay-strip.test.ts`. Extra: ReviewOwed.test.tsx wiring of case 10 (first-run pass, mutation-checked).
- Existing tests changed (X15, intent kept): ReviewCard.test.tsx's button-above-the-form and no-button-on-an-owed-card cases (now 5 and 7); e2e/d9/review.spec.ts's first test (the button is in the strip, none in the Action panel); e2e/d9/support.ts comment. d8p/responsive-a11y, d9ar/review, d9ar/states and the other specs that name the button pass unchanged: the strip's button keeps `review-card-replay`.
- New e2e/d95/replay-strip.spec.ts (1280 and 375: the chart beside the words, then above; no sideways scroll; the button opens the Replay).
- Browser: replay-strip 1 passed; d9/review, d6/close-review, d6/responsive-a11y 7 passed; d9/review, d9ar/review, d9ar/states, d8p/responsive-a11y, d95/card, closed-card, replay-day, d9/replay, d9ar/responsive-a11y, d95/sale, action: 59 passed (the 60th, d9/review's first test, fixed above and in the 7).
- Checks: src/ui, src/coordinators, src/app 2236 passed; integration 364 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; verify:fixtures OK, every view equal (no frozen expected-views change).
- Not built (T95.59): opening the Replay from the closed card's Close Review walk; the walk's locked questions.

ocr of T95.56 (session ecf2dbfe): complete, 20 files reviewed (4 excluded), 2 findings, both Valid. `evidence/D95/ocr/T95.56-801cd4bd.json`.
- **T95.56-B1** (Valid, `CardReplay.tsx:92`, `TradeDetail.tsx:178`): the Replay's Price History link doesn't carry the card's open panel and Trade Detail's "Back to the Review" always returns to `panel=Action`; safe while the Replay button sat only in the Action panel, wrong now that the strip is on every panel. Cases: it should return to the panel the Replay was opened from (e.g. Reflections) after Price History and "Back to the Review"; it should still return to Action when opened from Action.
- **T95.56-B2** (Valid, `replay-strip.props.ts:56`): a run of one P&L point yields only an SVG `M` command, which draws nothing, so a one-session Trade (or a lone point between missing Marks) shows the lines but no Trade P&L. Cases: it should draw a visible mark for a Trade with one session; it should draw a lone point between missing Marks.

### T95.56-B1

Commit `e365c63d`: the Replay's Price History link ends `&from=review&panel=<panel>`; Trade Detail reads `panel` once on load and "Back to the Review" uses it, falling back to Action. Three cases red then green (Back to Reflections; the link carries Reflections; the link still carries Action); the default-to-Action case was already covered. ReviewCard and TradeDetail tests 137 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d9ar/review 5 passed.

### T95.56-B2

Commit `24ffd1de`: `StripChart` gains `dots`, one per run of exactly one valid P&L point, drawn as a small circle in the line's colour (the full Replay draws every session as a circle, `corridor-pnl.tsx`). Cases 1, 2 red then green; a two-point run draws no dot. ReplayStrip tests 8 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. No browser spec covers the strip chart.

ocr of T95.56-B1 and T95.56-B2 (range `e365c63d^..24ffd1de`, session 0ce8cfb3): complete, 8 files, no findings. `evidence/D95/ocr/T95.56-B1-B2-24ffd1de.json`.

Q12 answered 2026-11-26: option 2 (`open` gives each Settlement Due Trade its standing, one replay read per such Trade). Decision 138, plan revision 127 (tag `claude-opus-5.5-plan-r127`); follow-on T95.62-D1 (Full: coordinator), after T95.56.

Run `t95.56-replay-strip` (browser-auto 10616873, full tier; at `57cc5e46`): unit 266 files, 3227 passed; integration 158 files, 364 passed; browser-1 127, browser-2 79, browser-3 55 passed; browser-4 1 failed, 4 skipped, 163 passed; 14 of 14 checks exit 0; run-complete. The failure: `e2e/d9/review.spec.ts:35` (B9.3's round trip) checks Trade Detail's address holds exactly `drawer`, `session` and `from`; since T95.56-B1 the Price History link also carries `panel` (here Action). T95.56-B1 ran only d9ar/review. Follow-on **T95.56-F1**: the spec expects `panel` too.

### T95.56-F1

Commit `e40840f8`: `e2e/d9/review.spec.ts:58` expects Trade Detail's address `{ drawer, session, from: 'review', panel: 'Action' }` (exact equality kept). The only other check of that address, `e2e/d9ar/review.spec.ts:124`, is an unanchored regex and still matches. d9/review and d9ar/review 7 passed.

ocr of T95.56-F1 (session b8e3ccac): complete, 1 file, no findings. `evidence/D95/ocr/T95.56-F1-e40840f8.json`.

Run `t95.56-f1-replay-strip` (browser-auto 10616873, full tier; at `91100379`): unit 266 files, 3227 passed; integration 158 files, 364 passed; browser-1 127, browser-2 79, browser-3 55, browser-4 164 passed, 4 skipped; 14 of 14 checks exit 0; run-complete. Passed. T95.56 and T95.56-F1 done.

## T95.62-D1

Commit `48aad904`: `open`'s walked Trades carry `expirationStanding` and `settledLaterOn` for a Settlement Due Trade, equal to `getTrade`'s card (shared `expirationStandingOf`); the manifest names `ExpirationStanding` under `DailyReview.open` (capabilities.ts, routes.ts, workspace.test.ts, d95 capabilities test) and `getTrade` keeps it. Case 1 and case 3 red then green; case 2 (the pin) first-run pass, flagged, mutation (replay assembly unreachable) failed, restored.
- Pin changes, `tests/integration/d7/query-count.test.ts` only: `open` with due Trades on one date, meta.get 14 to 15, observations.getAll 2 to 5, observations.openCursor 0 to 2; a second due expiration date adds one getAll and one openCursor (6, 3). The read session dedupes by Instrument, so 1, 2 and 4 due Trades issue the same requests (no per-Trade growth). The old equalities ("due run equals baseline minus mark reads", "two dates equal two Trades") replaced by these deltas; unused helpers removed.
- No expected-views change. Checks: src/coordinators, src/app, src/ui and tests/integration 318 files, 2606 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps, verify:capabilities, verify:fixtures exit 0. No browser spec edited.

ocr of T95.62-D1 (session 3e37a973): complete, 8 files, 1 finding. `evidence/D95/ocr/T95.62-D1-48aad904.json`.
- Doubtful, performance, not correctness (`daily-review.ts:682`): the replay is assembled twice in memory for a Settlement Due Trade past a line on the expiration session; no store read repeats. Sent to tech-debt.md (only correctness findings become bug tasks).

Run `t95.62-d1-standing` (browser-auto 8788c06d, full tier; at `535ab6e8`): unit 266 files, 3228 passed; integration 158 files, 364 passed; browser-1 127, browser-2 79, browser-3 55, browser-4 164 passed, 4 skipped; 14 of 14 checks exit 0; run-complete. Passed. T95.62-D1 done.

## T95.59

Commit `c26c6c70`: the Close Review walk (`close-review-walk.tsx`): the Replay opens on the first key moment with the questions beside it, locked; a moment counts as seen from the drop-down, "Next moment", the slider or the step buttons ("N of M seen"); unlocked when all are seen; "Would you take it again?" and the key lesson required (from the snapshot form's own flags, so a Close Review owed under the earlier form keeps the lesson optional, A320); "Save the Close Review" resolves through `ResolveReviewDebt` and marks the card "Close Review saved" from the response (no added read); asks before leaving with answers typed; forgets what was seen on close. Cases 1, 2, 4, 5 (two tests), 6, 9 and an extra (a refused save keeps the answers) red then green; first-run passes flagged and mutation-checked: 3, 7, 8 and "Save it from the ask". e2e/d6 close-review and responsive-a11y walk the Close Review (new helper `walkCloseReview`). New words in new-words.md (the leave prompt reuses Refusal's words). Not built: the mockup's tick on seen drop-down options; no Price History link inside the walk.
- Notes for T95.60, T95.61, T95.66 added to the handoff (no Decline in the walk yet; the walk's state is not in the address).
- The subagent ended the commit with a Co-Authored-By naming Claude Sonnet 5.5 rather than the brief's line; left as it is.
- Checks: src/ui 1576, src/coordinators 641 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser: d6 close-review, responsive-a11y, d95 closed-card, replay-strip, replay-day 9 passed.

ocr of T95.59 (session b8c0ad71): complete, 16 files reviewed (3 excluded), 2 findings, both Valid. `evidence/D95/ocr/T95.59-c26c6c70.json`.
- **T95.59-B1** (Valid, `close-review-walk.tsx:112`): the answer controls stay editable while a save is pending (`disabled` is only `locked || !writable`), and `onResolved` replaces the walk with the answers sent, so anything typed after "Save the Close Review" is lost. Cases: it should not let the answers change while the save is pending; it should keep the answers editable again after a refused save.
- **T95.59-B2** (Valid, `close-review-walk.tsx:73`): `save` doesn't check `writable`, so the leave-ask's "Save it" can send a write while the Workspace is read-only (`DebtForm`'s ask-save blocks on `pending || !writable`). Cases: it should not save from the leave-ask when the Workspace is not writable; it should still let the trader leave or go back from the ask.

### T95.59-B1

Commit `8f2d92f6`: the walk's answer prompts are disabled while the save is pending. Case 1 red then green; case 2 first-run pass (the save's `finally` already clears pending), flagged, mutation failed, restored. DebtForm doesn't disable its prompts while pending (it was not changed; the same gap there is noted for the final report). src/ui/cockpit and ReviewOwed 501 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d6/close-review 1 passed.

### T95.59-B2

Commit `9d0926e8`: `save` returns early when not writable; `leave()` closes at once when nothing is typed or the Workspace is not writable (nothing could be saved, so no ask). Case 1 red then green; case 2 first-run pass (built by case 1), flagged, mutation failed, restored. src/ui/cockpit and ReviewOwed 503 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; d6/close-review 1 passed.

ocr of T95.59-B1 and T95.59-B2 (range `8f2d92f6^..9d0926e8`, session 3b412f57): complete, 2 files, 1 finding: low, test style only (a settle outside `act`), sent to tech-debt.md. `evidence/D95/ocr/T95.59-B1-B2-9d0926e8.json`.

Run `t95.59-close-review-walk` (browser-auto 6a4f6492, full tier): unit 267 files, 3244 passed; integration 158 files, 364 passed; browser-1 127, browser-3 55, browser-4 164 passed (4 skipped); browser-2 1 failed, 78 passed; 14 of 14 checks exit 0; run-complete. (The runner's report was lost: its second hand-back was refused; read from the output files.) The failure: `e2e/d7/review-expiration.spec.ts:13` (B7.3), "no sideways scroll at 375" at line 43, on the Review with an expiration block open; it passed in T95.56's and T95.62-D1's runs, so T95.59 (the walk's stylesheet, ReviewReflections, ReviewOwedCard) is the likely cause. Follow-on **T95.59-F1**: reproduce, find what is wider than 375, fix with a failing test first.

### T95.59-F1

Commit `0eb14865`: the cause was not T95.59. The shell's wide layout (220px sidebar plus content) followed `.shell[data-layout='wide']`, set by a JS resize listener (`useWide`, AppShell.tsx), so for a moment after a resize to 375 the wide grid stayed (one capture: `220px 155px`, scrollWidth 409) and a spec measuring at once saw a sideways scroll; reproduced 2 failures in 5 runs. The wide-layout rules (sidebar grid, nav, content padding) moved into one `@media (min-width: 960px)` block on plain `.shell`, so the grid follows the viewport in the same frame; `data-layout` and `data-placement` still follow by script. New `src/ui/shell-layout.test.ts` (red then green). d7/review-expiration 10 of 10 after; d6 close-review, responsive-a11y, d95 closed-card, replay-day, replay-strip 9 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. A pre-existing race (since the shell's sidebar), so other specs that measure right after a resize benefit too.

ocr of T95.59-F1 (session 80746115): complete, 2 files, no findings. `evidence/D95/ocr/T95.59-F1-0eb14865.json`.

Run `t95.59-f1-close-review-walk` (browser-auto 6a4f6492, full tier; at `cf4f140a`): unit 268 files, 3245 passed; integration 158 files, 364 passed; browser-1 127, browser-2 79, browser-3 55, browser-4 164 passed (4 skipped); 14 of 14 checks exit 0; run-complete. Passed. T95.59 and T95.59-F1 done.

## T95.60

Commit `0e243169`: "Decline…" as a link apart from "Write the Close Review" (W153), the ask with "Why? (optional)", "Decline the Close Review" and "Keep it"; the card marked "Close Review declined" from the decline's response; Trade Detail's owed Close Review opens the same walk (saved and declined through `Journal.save`, decision 29) using the replay Cockpit already holds (Trade Detail's UI already calls `replayTrade` at open for a replayable Trade, D9; a test pins `getTradeDetail` and `replayTrade` at one call each; no read added). DebtForm gains `declineOnly`; every Debt form's decline now takes two presses (T95.42's "Decline anyway" one-press decline replaced). Cases 1, 2, 4, 5 red then green; first-run passes flagged and mutation-checked: 3, 6 (DebtForm, Review card, Trade Detail), Trade Detail's decline. Extra cases: "Keep it" when the Debt is gone or read-only; no "Decline…" when read-only; a reason typed in the ask doesn't hold the Review.
- **Case 6 does not hold for the Close Review's walk:** "Decline…" then "Decline the Close Review" is 2 presses; "Write the Close Review" then "Save the Close Review" is 2 presses plus the answers and one "Next moment" per further key moment. W153's words allow no third decline press, so none was added. Asked the user as Q13.
- needs-you.tsx untouched (the rail's "Reflect now" opens the item's form or walk). The commit's Co-Authored-By names Claude Sonnet 5.5; left as it is. New words and one shortening recorded. One unexplained single failure in an early src/ui run, not seen again in four full runs.
- Checks: src/ui 1594 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. Browser: 33 passed across 17 files (d5, d5r, d6, d8p, d8r, d95).

ocr of T95.60 (session 16a47510): complete, 19 files reviewed, 4 findings, all Valid. `evidence/D95/ocr/T95.60-0e243169.json`.
- Findings 1 and 2 (`ReviewReflections.tsx:108`, `OwedDebtItem.tsx:208`): declining a Close Review takes 2 presses, no more than answering (also for the plain Debt form fallback: "Write the Close Review" then "Answer"). This is Q13; whether they become bug tasks waits on the user's answer.
- **T95.60-B1** (Valid, `TradeDetail.test.tsx:446` and `DebtForm.test.tsx:406`, the same pattern): the `pressesToResolve` helpers return the count when they reach their press cap (6, 5) without checking the save was made, so a broken decline would count as "more presses" and pass. Cases: it should fail when the decline never saves (the helper asserts the save happened); it should still count the presses for a decline that does save, on Trade Detail and in DebtForm.

### T95.60-B1

Commit `80a8e8df`: each `pressesToResolve` helper asserts the save happened (Trade Detail: `Journal.save` once; DebtForm: the adapter once). Shown first with the decline's confirm made a no-op: both tests passed before the assertion, failed after; restored. Both files 66 passed; typecheck, tsc6, lint, lint:deps exit 0.

ocr of T95.60-B1 (session 5a04e17c): complete, 2 files, no findings. `evidence/D95/ocr/T95.60-B1-80a8e8df.json`.

Run `t95.60-declining` (browser-task; at `e3c3ec82`): unit 268 files, 3258 passed; integration 158 files, 364 passed; browser 58 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.60 parked on Q13 (its ocr findings 1 and 2 wait on the answer); T95.61 goes ahead.

## T95.61

Commit `146cb646`: after an Action, a Settle Later, a closing sale's receipt or Record expiration's "Back to the Review", focus moves to the first walked or owed card whose held `progress.done` is false, else to "The day" (now `tabIndex=-1`); the Action form's Discard returns focus to the card's header; the walk's and the plain Replay's Escape and Close return focus to their opener (built by T95.59 and the overlay). Cases 3, 2 (closing sale), 2 (Record expiration, a genuine red after removing code written ahead), 4 red then green; first-run passes flagged and mutation-checked: 1, 2 (Settle Later), 5 (walk). Not covered by its own test: a sale that leaves nothing focusing "The day". The Marks step's Discard unchanged. src/ui 1601 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; browser d95 card, action, action-form, sale, sale-form, closed-card, replay-strip, day-card, refusal, exit-banner and d7/review-expiration 43 passed.

ocr of T95.61 (session ec9450d6): complete, 8 files, 2 findings, both Valid. `evidence/D95/ocr/T95.61-146cb646.json`.
- **T95.61-B1** (Valid, `ReviewView.tsx:582`): when the re-read after a sale or expiration receipt returns Empty (the only walked Trade was sold), `focusNext` asks the day card for focus, but the Empty branch renders `EmptyReview`, which has no focus target, so focus falls to the body. Cases: it should put focus on the empty Review's heading (or its first control) when the re-read after a receipt is Empty; it should still focus "The day" when the Review is not empty and nothing is left.
- **T95.61-B2** (Valid, `ReviewView.tsx:362`): `focusNext` runs when the receipt's re-read resolves without checking the card selection is unchanged, so a card the trader opened meanwhile loses focus. Cases: it should leave focus where it is when the trader opened another card during the re-read; it should still move focus when the selection is unchanged.

### T95.61-B1

Commit `6af3aa53`: when the re-read after a receipt is Empty, focus goes to the empty Review's section (`EmptyReview` takes the same `focus` count as DayCard and is `tabIndex=-1`; it has no heading, and adding one would be a new screen word). Case 1 red (focus on body) then green; case 2 first-run pass (built by T95.61), flagged, mutation (DayCard focus guard) failed, restored. src/ui/screens 951 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; browser d95/sale and d7/review-expiration 9 passed.

Q13 answered (2026-11-26), option 1: decision 139, plan revision 128. T95.60's case 6 reworded (never fewer presses to decline than to answer; declining always asks to confirm). ocr findings 1 and 2 dismissed by that decision (the Close Review's 2-press decline meets the reworded case). No code change. T95.60 done.

### T95.61-B2

Commit `2a58109d`: a `picks` count of the trader's own card presses (bumped in `toggle`) is noted when a card's re-read starts; `focusNext` does nothing if it changed. (Comparing `selection.current` broke 3 ReviewSettlement tests: the Review's own collapse of a card that left the Review changes the selection too.) Case 1 red then green; case 2 first-run pass (built by T95.61), flagged, mutation (`focusNext` returns early) failed, restored. Not covered: a card opened through a day-line link (`select(tradeId, true)`) doesn't bump `picks`. src/ui/screens 953 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; browser d95/sale and d7/review-expiration 9 passed.

ocr of T95.61-B1 and T95.61-B2 (range `6af3aa53^..2a58109d`, session 50faeaea): complete, 3 files, 1 finding, Valid. `evidence/D95/ocr/T95.61-B1-B2-2a58109d.json`.
- **T95.61-B3** (Valid, medium, `ReviewView.tsx:372`): B2's `picks` guard counts only header presses (`toggle`); a card opened through `openCard` (a day-card link, or a changed address) doesn't bump it, so a re-read finishing after that still moves focus away. Cases: it should leave focus on a card opened from a day-card link during the re-read; it should still move focus after the Review's own advance to the next card.

Run `t95.61-focus` (browser-task; unit at `0a39d2b2`, browser and checks at `f48dde20`, with T95.61-B3's work in progress beside it): unit 268 files, 3269 passed; integration 158 files, 364 passed; browser 58 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.61 waits on T95.61-B3.

### T95.61-B3

Commit `02d8ef62`: `openCard` bumps `picks` (after the unsaved-drafts refusal, so a refused press doesn't count). `openCard` is reached only from the day-card links and the changed-address effect, never from the Review's own advance. Case 1 red then green; case 2 is B2's "should still move focus when the selection is unchanged", a first-run pass, flagged, mutation (`reopenAndApply` bumps `picks`) failed, restored. src/ui/screens 954 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0; browser d95/sale and d7/review-expiration 9 passed.

ocr of T95.61-B3 (session f80ce36f): complete, 2 files, no findings. `evidence/D95/ocr/T95.61-B3-02d8ef62.json`.

Run `t95.61-b3-focus` (browser-task; unit at `5560b8df`, the rest at `8e36cb57`, evidence-only between): unit 268 files, 3270 passed; integration 158 files, 364 passed; browser 58 passed; 14 of 14 checks exit 0; run-complete. Passed. T95.61 done.

## T95.65

Commit `39c4e305`: Part C integration suites I95.13 (settle-later, 9 cases), I95.14 (expiration-reason, 7), I95.15 (replay-actions, 5), I95.16 (close-review, 4), I95.17 (not-writable, 4: a Writable control, then the page Marks save, an Action under the rule, Settle Later). I95.7: no case added; `capabilities.test.ts` already asserts Part C's lists exactly (T95.62, T95.62-D1); its two Part C assertions mutation-checked. Every case a first-run pass (the code existed), each mutation-checked and restored (`git diff -- src` empty). tests/integration 393 passed; typecheck, tsc6, lint (2 pre-existing warnings), lint:deps exit 0. The commit's Co-Authored-By names Claude Sonnet 5.5; left as it is.
- Gaps recorded: `RuntimeNotWritable` is gated twice (the guard and the commit), so the Marks case needed both mutated to fail; I95.16's "no Entry" half has no mutation that reaches it (covered by an unchanged-entries assertion); a Settle Later saved after the expiry session has no replay session, so I95.15 saves it on the expiry day.
- **Found, asked as Q14:** the owed card's replay (`assembleOwedCard`, `daily-review.ts` 902, decision 136) carries no session Actions, so the Replay opened from a closed Trade's card (and the Close Review walk) shows no saved Hold under "What you did that day" (W147), while `replayTrade` and the walked card show it. I95.15 compares only dates, Plan Calls and key moments for the owed card.

ocr of T95.65 (session 792f187e): complete, 5 files, no findings. `evidence/D95/ocr/T95.65-39c4e305.json`.
