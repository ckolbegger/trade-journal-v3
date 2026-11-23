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

## Trial: complete runs overlapped with the next task (the user, 2026-11-22, for 5 or 6 tasks)

Each task's complete run runs in a detached scratch copy (`.claude/worktrees/run-<label>`, set up by `lane-setup.sh`) at the task's commit, while the next task's subagent starts in this worktree. The run's files are copied back to `evidence/D95/suite-runs/`. A failure becomes a bug task as before; the next task restarts only if it built on the broken code. Times are recorded per run to measure the saving.

**Ended by the user, 2026-11-22 ~20:05**, after T95.4, T95.6-B2, T95.7, T95.4-B1, T95.4-B2 and T95.8's start: completed work was piling up unconfirmed, and load caused spurious failures (run `t95.3-t95.5`: `estimate-rules` timeout, browser stages up to 13.7 min against about 5; T95.4's own unit runs: the same timeout twice and 3 uncaptured failures). The run already started (`t95.6-t95.7`, at `f5db240e`) and T95.8 finish; from then on, one task at a time with its run before the next task, as before.

## T95.9 Browser helpers: every Mark entry goes through the support helpers

Command: `grep -rnE "reachPanel\(|chooseCell\(|markRow\(|markCell\(" e2e`. Before: 132 uses, 106 of them outside the support files (21 spec files). After: 0 outside the support files; the rest are inside `support.ts` files only.

New helpers in `e2e/d4/support.ts` (re-exported down the chain): `marksPanelOf` (open Marks panel), `panelOf` (any panel, for a variable or non-Marks panel), `markEditorOf` (the cell's editor region), `markInputOf` (the cell's price input), `expectMark` (cell shows text). Each one calls the old helper, so no expectation moved or changed; T95.12 changes these helpers alone.

Specs now calling them: d4 (acknowledge, kill, update, no-save, review, gaps, offline, runtime-failure, card-helpers, responsive-a11y, correct-mark), d5 detail-debt, d5r (marks, durability, responsive-a11y), d7 marks-zero, d9r2 (editor, grid, responsive-a11y, drafts), d9ar states.

Browser stages under with-browser-lock.sh, unchanged: `test:e2e:1` 126 passed; `:2` 80 passed; `:3` 57 passed; `:4` 137 passed, 4 skipped (same as the last complete run). typecheck, tsc6, lint (2 existing warnings in OwedDebtItem.tsx, 0 errors) and lint:deps exit 0.
