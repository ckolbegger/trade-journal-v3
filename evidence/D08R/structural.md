# D08R structural verifications

Each entry records a structural task's exact verification (D08R breakdown, section 6), each task's `ocr-review` findings and bug tasks under the task's heading (raw outputs in `ocr/`), the lane tiers and merge runs (full outputs in `suite-runs/`), and any spec section read beyond the reading list. Decision 111 applies: each lane task ends with its lane tier in its lane worktree, and the complete cumulative run runs once per merge batch on `claude-opus-5.5`, with the full tier before every critic. Versions are in [provenance.md](provenance.md).

## Start of D08R

Location checks (D08R implementing handoff, section 1) on 2026-11-17, 00:49 EST:
- `.claude/session.lock`: absent; written by this session.
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 20]`, clean.
- `git log --oneline claude-opus-5.5-plan-r105..HEAD`: empty.
- `claude-opus-5.5-d8^{commit}`: `be736f8b`.
- `git diff --stat claude-opus-5.5-d8 claude-opus-5.5-plan-r105 -- src e2e tests`: empty.
- `ls .claude/worktrees`: absent.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful` (and `✓ Tool-call round trip verified`).
- `DEV_PORT=5175`; nothing listening on 5175, 9341 or 9342; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: 181 files, 1927 tests passed. `npx vitest run tests/integration`: 118 files, 258 tests passed.

## Lane worktrees

Worktree and branch names the Agent tool gives each lane task (handoff, section 3).

| Task | Lane | Worktree | Branch | Base |
|---|---|---|---|---|
| T8R.1 | TY (wave 0) | `.claude/worktrees/d08r-ty` | `d08r/ty` | `0c6f9828` |
| T8R.2 | SH (wave 0) | `.claude/worktrees/d08r-sh` | `d08r/sh` | `0c6f9828` |
| T8R.3 | CN (wave 0) | `.claude/worktrees/d08r-cn` | `d08r/cn` | `0c6f9828` |
| T8R.4 | PH (wave 0) | `.claude/worktrees/d08r-ph` | `d08r/ph` | `0c6f9828` |

**The Agent tool's worktree isolation is not used (2026-11-17).** The first dispatch of T8R.1, T8R.2, T8R.3 and T8R.4 used the Agent tool's `isolation: "worktree"`. It created each worktree under the main checkout (`/Users/ckolbegger/src/trade-journal-v3/.claude/worktrees/agent-<id>`) on a new branch from `main` (`4185bae7`), which holds no `src/`, `plan/` or `.claude/scripts/`, so `lane-setup.sh` refused to run. T8R.1, T8R.2 and T8R.4 stopped and reported it with no change; T8R.3 was stopped by the main session. The one worktree left behind (T8R.1's, which it had reset to `0c6f9828` with no commit) and its branch were removed; the harness had cleaned up the others. From then on the main session creates each lane worktree itself with `git worktree add -b d08r/<lane>` under this worktree's lane folder, from the base commit, runs `lane-setup.sh` in it, and dispatches the `tdd-task` without isolation, with the lane's absolute path in the brief. The rows above are lanes made this way.

## T8R.1 ocr review and bug tasks

ocr on `e4ca52b0` (session 2f91a416-4b51-4f15-94df-b3a2472643b6, gpt-6.1-sol, 4 files reviewed, 1 comment; raw output `ocr/T8R.1-e4ca52b0.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/coordinators/trade-views/trade-views.ts:329` | `ClosedTradeDetail extends OpenTradeDetail`, so it inherits `openAverage?`, although A236 says Closed Details have no such field. | Valid (type-only): `ClosedCurrentEvaluation` already blocks Open-only fields with `?: never`. |

Reviewer notes (not ocr findings, no bug task): `settlementUnderlying?` is inherited by `ClosedTradeDetail` in the same way, which A234 limits to Settlement Due Details; and `exchangeDate` is optional although section 4.1 writes it without `?`, which T8R.1 chose and recorded (section 6: additive fields are optional; T8R.21 decides).

**T8R.1-B1** (from the Valid finding). Defect: a Closed Detail's type admits `openAverage`, so a producer or test double can set a field A236 says a Closed Detail never has, with no type error. Fix: `ClosedTradeDetail` declares `openAverage?: never`, following `ClosedCurrentEvaluation`'s pattern. Structural verification: a type assertion that a Closed Detail with `openAverage` set is rejected (`@ts-expect-error`) fails `npm run typecheck` before the fix and passes after it; then `npx tsc6 --noEmit`, `npm run lint` and the lane tier.

## T8R.4 notes

- Task summary (`15811755`): 3 cases; "should give a gap no provenance" is a first-run pass with a mutation check (the cell's title falling back to "Manual" on a gap failed it), flagged for the final report. Lane tier passed (unit 2030, integration 258, 14 of 14 checks); `e2e/d8p/history.spec.ts` 2 of 2.
- `priceHistoryProps` now takes `(replay, onOpenReview, timeZone)`; `PriceHistory` renders only when the shell passes a `timeZone`. `ReplaySource`'s Available Mark carries `source`, `savedAt` and an optional `correctionReason`.
- **Follow-up T8R.4-F1** (an implementation-level gap, not an ocr finding): A241 says a corrected Mark "keeps its visible Corrected marker", but Price History never had one; only the Today drawer shows "Corrected", and T8R.6 removes it once Price History holds the provenance (P116). Without a visible marker in Price History, a correction would show only on hover, against the UI contract's correction indicators on Trade Detail. F1 adds the visible marker in lane PH, red first, before T8R.4 merges, so T8R.6 (which merges after T8R.4) never leaves the correction unmarked.
- The browser case for a corrected Mark is B8R.6 (T8R.27, `e2e/d8r/history.spec.ts`); T8R.4's lane couldn't add a correction step to `e2e/d8p/support.ts`, which it doesn't own.

## T8R.4 ocr review and bug tasks

ocr on `15811755` (session d5afeeab-88c6-4249-b050-6ece010ce024, gpt-6.1-sol, 5 files reviewed, 1 comment; raw output `ocr/T8R.4-15811755.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/cockpit/drawers/price-history.props.ts:40` | A corrected Mark shows only its price; the correction is only in `title` and `aria-label`, so a sighted user sees no "Corrected" marker without hovering. | Doubtful (the reviewer: the three cases are met, but A241's visible marker is not). |

**T8R.4-B1** (from the Doubtful finding). Defect: a corrected Mark in Price History is not visibly marked. It is the gap the main session had already given to follow-up T8R.4-F1 (see "T8R.4 notes"), whose case ("should show a visible Corrected marker in a corrected Mark's cell, and none in an uncorrected one") is this bug task's case. B1 is therefore met by F1's commit, with no separate agent; F1's own ocr review closes both.

Reviewer note (not an ocr finding): one ocr tool call tried to read a nonexistent `src/ui/cockpit/shell.props.ts`; all five selected files completed.

## T8R.2 notes

- Task summary (`7fefc1f2`): 4 cases, each red then green; no first-run pass. `Cockpit.test.tsx` 16 of 16; `e2e/d8p/states.spec.ts` 3 of 3 under the lock. The lane tier's unit stage failed 6 of 2030: existing cases in `Position.test.tsx` (3), `Result.test.tsx` (1) and `Placed.test.tsx` (2), outside lane SH, assumed Position was the default drawer on Closed and Settlement Due Details.
- **Follow-up T8R.2-F1** (main session's implementation-level decision, recorded here): no wave-0 lane owns those files (PO and TD own them in wave 1), so F1 runs in lane SH with only those six cases granted. Four take a reach step (`openDrawer(user, 'Position')`) with every matcher and value kept. The two `Placed.test.tsx` cases assert D08P's old W1, which W1 (amended) and T8R.2's third case reverse: the Settlement Due one is rewritten to read the Today drawer, and "on a state without a Today drawer" is retired, since no state with current Marks lacks Today; T8R.2's third case covers it.
- `states.spec.ts`: beyond its three drawer lines, T8R.2 added a reach to Position before the Settlement Due case's `positionOpenPnl` read, renamed two titles from "Position selected" to "Today selected", and made `expectDrawers` check that the selected panel is not `hidden` instead of `toBeVisible`, since a Closed Detail's Today panel is empty until T8R.7.
- Drawer request API (for T8R.17): `Cockpit.tsx` exports `type Drawer` (the W1 tab names), `type DrawerRequest = (drawer, heading) => void` and `useDrawerRequest()`; a request selects the drawer and then focuses the `h1`–`h6` in its panel whose trimmed text matches (adding `tabindex=-1` if needed); with no match the drawer is still selected. `CockpitProps` gained an optional `children` slot, rendered inside both providers, as the test seam.

## T8R.4-F1 ocr review

ocr on `60b0e01f` (session e0346156-4ce0-4160-bd77-94a4f9f31475, gpt-6.1-sol, 5 files reviewed, 0 comments; raw output `ocr/T8R.4-F1-60b0e01f.json`): **No findings.** The reviewer confirmed the commit answers T8R.4-B1. F1's task summary: 1 case, red ("expected '57.40' to be '57.40Corrected'") then green; lane tier passed (unit 2031, integration 258, 14 of 14 checks). The marker is the word "Corrected" in the Today drawer's `Badge tone="info"`, on its own line under the price, hidden from the accessibility tree (the cell's accessible name already says "Corrected: <reason>").

## Merge: lane PH (T8R.4, T8R.4-F1)

Rebased `d08r/ph` onto `claude-opus-5.5` (`62106632`): T8R.4 `15811755` → `c7a9a3ca`, T8R.4-F1 `60b0e01f` → `bed2afe0`. The rebase brought in only the main session's evidence commits, no file the tasks own, so F1's lane tier stands. Fast-forwarded `claude-opus-5.5` to `bed2afe0`; lane worktree `d08r-ph` and branch `d08r/ph` removed.

## T8R.1-B1 ocr review

ocr on `3b78080e` (session 559cf529-888a-4d66-8e8e-12bc149df4f5, gpt-6.1-sol, 3 files reviewed, 0 comments; raw output `ocr/T8R.1-B1-3b78080e.json`): **No findings.** Reviewer note (not an ocr finding): `current:ClosedCurrentEvaluation` lacks a space after the colon in `closedDetail`'s signature; cosmetic. B1's first agent stopped for one test double outside lane TY (`tests/support/closed-detail-fixtures.ts`, owned by no wave-0 lane); the main session granted it, and a fresh agent finished B1 from the uncommitted work, with the first agent's recorded red.

## T8R.1

Types only, in lane TY. Commands (each exit 0): `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`; lane tier `.claude/scripts/full-suite.sh evidence/D08R T8R.1 lane` (unit 2027 passed, integration 258 passed, 14 of 14 checks exit 0; outputs in `evidence/D08R/suite-runs/T8R.1-*.txt`).

Every new field is optional, including `MarketDataReadSession.exchangeDate`, which section 4.1 writes without a `?`: a required field would force producer and test-double changes in a types-only task. T8R.21 decides whether it becomes required.

Final shapes:
- `ConditionReading.trigger?: { distance: Rational; beyond: Rational | null }` (`src/domain/trade-analysis/evaluate.ts`)
- `TradeEvaluationInput.nextSessionDate?: string` (same file)
- `UnavailableReason` AwaitingClose case: `{ reason: 'AwaitingClose'; after: string; due?: string }` (`src/domain/calculation-result/index.ts`)
- `MarketDataReadSession.previousSessionDate?: string`, `exchangeDate?: string` (`src/modules/market-data/market-data.ts`; readonly fields like `nextSessionDate`)
- `OpenTradeDetail` (`src/coordinators/trade-views/trade-views.ts`): `marksColumns?: { today: { date: string; next: boolean }; yesterday: string }`; `settlementUnderlying?: { today?: SeriesPoint; yesterday?: SeriesPoint; change?: ReplayChange }`; `openAverage?: Rational`. `ClosedTradeDetail extends OpenTradeDetail`, so it inherits all three.
- A Settlement Due Detail has no variant of its own: it is an `OpenTradeDetail` whose `settlement` array has items, so the fields sit on `OpenTradeDetail`. `ClosedTradeDetail` inherits `settlementUnderlying` and `openAverage` as optional; A236 says Closed has none, which T8R.23 should enforce by never filling them.
- `src/app/types.ts` already re-exports `OpenTradeDetail` and `ClosedTradeDetail`, so no change was needed.

## T8R.1-B1

Bug task from ocr (medium, `trade-views.ts:329`): `ClosedTradeDetail extends OpenTradeDetail` inherited `openAverage?`, though A236 (section 1.3 of the D8R trade detail refactor plan) says a Closed Detail has none. Types only, lane TY.

- Red: new `src/coordinators/trade-views/detail-types.test.ts` sets `openAverage` on a `Pick<ClosedTradeDetail, 'openAverage'>` under `@ts-expect-error`, and on an Open Detail with no error. Before the fix `npm run typecheck` failed: `detail-types.test.ts(8,5): error TS2578: Unused '@ts-expect-error' directive`.
- Fix: `ClosedTradeDetail` declares `readonly openAverage?: never;`; the `closedDetail` parameter `open` is `Omit<OpenTradeDetail, 'current' | 'openAverage'>`.
- File outside the task's lane, granted by the main session for this bug task (type-level change only): `tests/support/closed-detail-fixtures.ts`. `closedDetailOf` now types its Open Detail as `Omit<OpenTradeDetail, 'openAverage'>` (import added). No runtime change: `openDetailOf` never sets `openAverage`. (A destructure-away form failed lint as an unused variable.)
- Results (each exit 0): `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` (2 pre-existing warnings), `npm run lint:deps`; the new test passes under vitest; lane tier `.claude/scripts/full-suite.sh evidence/D08R T8R.1-B1 lane`: unit 2028 passed, integration 258 passed, 14 of 14 checks exit 0 (`evidence/D08R/suite-runs/T8R.1-B1-*.txt`).
- Correction to the T8R.1 note above: `ClosedTradeDetail` no longer inherits a usable `openAverage` (it is `never`); it still inherits `settlementUnderlying` and `marksColumns`.

## Merge: lane TY (T8R.1, T8R.1-B1)

Rebased `d08r/ty` onto `claude-opus-5.5` (`63355868`): T8R.1 `e4ca52b0` → `dddd063b`, T8R.1-B1 `3b78080e` → `5b333e64`. The one conflict was in this file (both sides appended); the main session kept the deliverable branch's text and appended T8R.1's section after it. No code file changed in the rebase, so B1's lane tier stands. Fast-forwarded `claude-opus-5.5` to `5b333e64`; lane worktree `d08r-ty` and branch `d08r/ty` removed.

## T8R.2 ocr review

ocr on `7fefc1f2` (session eef43a5c-004a-4c73-8397-d77bef04b28f, gpt-6.1-sol, 3 files reviewed, 1 comment; raw output `ocr/T8R.2-7fefc1f2.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/trade-detail/Cockpit.tsx:91-92` | The drawer request looks for its heading only inside the requested drawer's panel, so a request for ("Plan and Risk", "Deviations") finds nothing while `DetailFooter` renders Deviations outside every panel; the test asks for "Plan Baseline". | Reviewer: Doubtful. |

**Dismissed (Wrong), after checking the cited lines.** The behavior is the planned one: T8R.2's fourth case is "should select a requested drawer and move focus to the requested heading **in it**". The claimed failure needs a caller asking for Deviations while Deviations is still in the footer, and none exists: `useDrawerRequest` has no non-test caller in this commit. The plan moves Deviations into Plan and Risk in T8R.11 and makes the first call in T8R.17, which is blocked by T8R.11, and T8R.17's second case ("should select Plan and Risk and move focus to its Deviations heading when See Plan and Risk is pressed") proves that very request. Listed in the handoff's open questions for the final report.

## T8R.3 notes

- Task summary (`5580fda4`, 37 files): 6 cases; case 1 and case 2 red then green; cases 3, 4, 5 and 6 are first-run passes, each with a mutation check that failed it as expected (an earlier year using `<=`; a raw strike; the two-digit year), flagged for the final report. About 100 expectation lines changed, every appendix line present and changed; none found outside the appendix in `src/` and `e2e/`. One appendix line changed its strike too, as case 4 requires ("BRK.B Nov 20 $412.50 Put", was "BRK.B 20 Nov 2026 412.5 Put"). Six screen test files gained a clock pin. Ten browser spec files passed under the lock.
- `instrumentLabel` takes no time zone, so its current-year rule uses the UTC year, as `summaryExpiration` does when given none; A238 names the Workspace zone. Noted for ocr and the final report.
- Lane tier: unit 2032 passed, 1 failed (`tools/bench/compare.test.ts`, the old contract-name form); integration 258; checks 14 of 14.
- **Follow-up T8R.3-F1** (main session's implementation-level decision): section 1.5 says `tools/bench/compare.ts` and its test "keep working" untouched, but the appendix's grep searched `e2e/`, `tests/` and `src/**/*.test.*`, never `tools/`, and `compare.test.ts` asserts two contract names in the old form. They are contract-name expectations the appendix missed, so they follow W28 like the rest (C1). F1, in lane CN, changes only those two names, pins the case's clock, and updates the comment at `compare.ts:63`; no code in `tools/` changes and the bench's generated rows are not regenerated. Listed for the user in the final report.

## T8R.3 ocr review and bug tasks

ocr on `5580fda4` (session 0fdfc9e7-d876-46a2-8c63-7e417b40cf5c, gpt-6.1-sol, 32 files reviewed, 2 comments; raw output `ocr/T8R.3-5580fda4.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/calculation-words.ts:18` | `instrumentLabel` passes no time zone, so its current-year test uses UTC; near New Year the contract name can drop the year while the Trade Summary line, given the Workspace zone, shows it. | Valid (A238 names the Workspace zone). |
| medium | bug | `src/ui/calculation-words.ts:18` | `summaryStrike` rounds through `money` to 2 decimals, but strikes carry up to 3 (decision 77), so 52.501 and 52.504 both read "$52.50"; the old label printed the raw strike. | Valid (`validateOptionContract` accepts 3 decimals). |

Reviewer note (not an ocr finding): several `tradeSummary` callers (`ReviewCard`, `ReviewOwedCard`, `ReviewView`, `tradeName`) also omit the zone.

**T8R.3-B1** (finding 1). Defect: a contract name decides "the current year" in UTC. Between the Workspace zone's New Year and UTC's, a contract name shows or drops its year differently from the Trade Summary line and from the trader's calendar. Case: "it should decide the current year in the Workspace zone": with the clock at 2027-01-01 03:00 UTC (Thu Dec 31 2026, 22:00 in New York) and the zone America/New_York, a contract expiring 2027-01-15 reads "XYZ Jan 15 2027 $55 Call". Fix: `instrumentLabel` takes the Workspace zone and passes it to `summaryExpiration`; each caller passes the zone it already holds.

**T8R.3-B2** (finding 2). Defect: a strike with a third decimal is rounded, so two contracts can read alike. Case: "it should keep a strike's third decimal": "XYZ Dec 18 $52.505 Put", while 52.5 still reads "$52.50" (case 4). Fix: `summaryStrike` shows two decimals, and the third when the strike has one. The Trade Summary line shares it and gains the same.

## T8R.2-F1 ocr review

ocr on `d731bf2f` (test-only, relocated; session 686bc8fa-d2a5-4c4c-b1a5-308b64628f07, gpt-6.1-sol, 3 files reviewed, 0 comments; raw output `ocr/T8R.2-F1-d731bf2f.json`): **No findings.** F1's summary: four cases took a reach step with every matcher and value kept; the Settlement Due current-Marks case in `Placed.test.tsx` reads the Today drawer (mutation: `<CurrentMarksOnly>` replaced by `<div />` failed it with "expected null not to be null"); the "state without a Today drawer" case was retired, covered by T8R.2's third case. Lane tier passed (unit 2029, integration 258, 14 of 14 checks).

## T8R.3-F1 ocr review

ocr on `740b4008` (session c8e0b9ea-dc03-4e08-a1a0-4ee150c05928, gpt-6.1-sol, 2 files reviewed, 0 comments; raw output `ocr/T8R.3-F1-740b4008.json`): **No findings.** F1 changed three contract-name expectations in `tools/bench/compare.test.ts` (NVDA, AAPL, and QAB, which surfaced once the clock was pinned), pinned the case's clock to 2026-11-17 (`Date` only), and updated `compare.ts:63`'s comment. Lane tier passed (unit 2033, integration 258, 14 of 14 checks).

## T8R.2-F1: earlier cases that read the old default drawer

Six cases outside T8R.2 assumed the old default drawer (Position) and failed after W1 amended (Today first, opens on Today).

| Case | File | Change |
|---|---|---|
| should list an Expiration in its own Settlement section after the Executions, with the contract named by its label | Position.test.tsx | Reach only: `await openDrawer(user, 'Position')` before the read; every expect unchanged |
| should show a Closed option Trades Lot Match disposed by an Expiration as Expired on 2026-11-20 16:00 on Trade Detail | Position.test.tsx | Reach only, same |
| should head an option Trades Lot Matches Opened and Closed on Trade Detail, open or closed, and a stock Trades Bought and Sold | Position.test.tsx | Reach only, added to the Closed render |
| should show lifecycle Closed as text, Closed via sale of 100 shares and the Close Reason ... | Result.test.tsx | Reach only: open Position before the Position tabpanel lookup |
| should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail | Placed.test.tsx | Rewritten and renamed "should show only the current Marks card in the Today drawer on a Settlement Due Detail": opens Today, reads `#drawer-panel-today`; other assertions unchanged; the no-Today-tab assertion dropped |
| should show the current Marks in the Position drawer on a state without a Today drawer | Placed.test.tsx | Retired: no state with current Marks lacks a Today drawer now. Covered by T8R.2's third case in Cockpit.test.tsx, "should show the Settlement Due current Marks in Today, not in Position" |

Mutation (rewritten case): in `Cockpit.tsx` the Today panel's Settlement Due branch `<CurrentMarksOnly {...replayed} />` replaced by `<div />`. The case failed: `AssertionError: expected null not to be null` (the `section.current-marks` check). Restored; `git diff -- src` shows only the three test files.

Results: the three files pass (29 cases); `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0. Lane tier (`.claude/scripts/full-suite.sh evidence/D08R T8R.2-F1 lane`) exit 0: unit 189 files, 2029 tests; integration 118 files, 258 tests; 14 of 14 checks exit 0. Outputs in `evidence/D08R/suite-runs/T8R.2-F1-*.txt`.

## Merge: lane SH (T8R.2, T8R.2-F1)

Rebased `d08r/sh` onto `claude-opus-5.5` twice; the second was needed because `2560f259` landed between the first rebase and the merge. Final hashes: T8R.2 `7fefc1f2` → `29e50716`, T8R.2-F1 `d731bf2f` → `08437851`, plus the evidence commit `45ae2621`. Each rebase had one conflict, in this file, where both sides had only appended; the main session kept both. After the first rebase, which brought T8R.1 and T8R.4's code in under lane SH, the lane tier reran on `bf1131b5` (`suite-runs/T8R.2-rebased-*.txt`): unit 2034 passed, integration 258 passed, 14 of 14 checks exit 0. The second rebase brought in only evidence, so that run stands. Fast-forwarded `claude-opus-5.5` to `45ae2621`, then removed the lane worktree `d08r-sh` and the branch `d08r/sh`. While merging, one shell chain carried on after the fast-forward was refused and removed the worktree early; the branch kept every commit, so the main session re-added the worktree and rebased again.

## T8R.3-B1 notes and follow-up B1-F1

- B1 (`48cbd15b`, lane CN): 1 case, red (`expected 'XYZ Jan 15 $55 Call' to be 'XYZ Jan 15 2027 $55 Call'`) then green; no first-run pass. `instrumentLabel`, `text`, `expirationLine`, `executionWhat` and `holdingText` gained an optional trailing `timeZone`, and every caller lane CN owned now passes the Workspace zone. Three screens read it with `useRuntime()`: `CardFigures`, `CardMarks` and `MarkEntry`. `ReviewView`'s `.map(instrumentLabel)` became an explicit arrow, because the bare form would have passed the array index as the zone. Lane tier: unit 2034, integration 258, 14 of 14 checks. No expected value changed.
- Rule slip: B1 made its first source edit (`needs-you.props.ts`) with an in-place perl command instead of the Edit tool, and the guard hook did not block it inside the lane worktree. The content is correct. Listed in the handoff's open questions.
- The fix was partial. Callers outside lane CN's file list still name contracts in UTC: the receipts (`ExpirationReceipt`, `ExitReceipt`, `PositionChangeReceipt`), `ReviewReflections` and `trade-detail/words.ts` through the helpers, plus the `text(unavailableWords(...))` callers that pass no zone to `text` (`figures.ts`, `needs-you.props.ts:57`, `today.props.ts:243`, `review-attention.ts`, `Banner.tsx:85`, `ReviewView.tsx:117`). Wave 0's other lanes have merged and wave 1 has not started, so no lane holds these files. The main session granted them to follow-up **T8R.3-B1-F1** in lane CN, which has 2 cases (a receipt line and an unavailable-Mark sentence, both at New York's New Year) and also decides whether the zone becomes required.

## T8R.3-B1 ocr review

ocr on `48cbd15b` (session 8433ad1b-b957-4085-9308-d40b7d69bfa3, gpt-6.1-sol, 14 files reviewed, 0 comments; raw output `ocr/T8R.3-B1-48cbd15b.json`): **No findings.** The background named the callers outside the lane, which B1-F1 is threading, as known.

## T8R.3-B1-F1 notes

`8df55c00` (lane CN, 28 files) has 2 cases, each pinned to 2027-01-01 03:00 UTC with the zone America/New_York.
- **The Expiration receipt.** Red: `expected 'Expiration of 1 XYZ Jan 15 $55 Call, …' to contain 'XYZ Jan 15 2027'`. An earlier red failed on a fixture error ("reading 'price'") and was rejected; the fixture was fixed first. Then green.
- **`review-attention.ts`'s `reasonText` for a MarkMissing reason.** Red: `expected 'Mark missing for XYZ Jan 15 $55 Call …' to contain 'XYZ Jan 15 2027'`. Then green.

No first-run pass and no changed expected value.

The zone now reaches:
- the receipts and `ReviewReflections`;
- `legText` and `positionText` in `trade-detail/words.ts`, through `footer.props`, `plan-risk.props` and `position.props`;
- `review-attention.ts`, `today.props.ts` and `Banner.tsx`;
- the figure words in `figures.ts`, which used `NO_ZONE` for MarkMissing, AcknowledgedUnavailable and SettlementDue, through `pnl.props.ts` (which had received the zone and ignored it), `conditions.props.ts`, `CardFigures`, `ReviewCard` and `TradeList`.

Signature changes:
- **Zone now required:** `expirationLine`, `executionWhat`, `holdingText`, `legText`, `positionText`.
- **Optional trailing zone, defaulting to UTC:** `calculation`, `dollarsAndR`, `pnlText`, `settlementDueFigure`, `pnlProps`, `conditionsProps`.
- **Zone still optional:** `instrumentLabel` (`tools/bench/compare.ts` calls with none) and `text` (it also words parts with no instrument).

Left on the UTC default:
- **Words with no instrument:** `unavailableLabel`, `FACTS_INCOHERENT_FIGURE`, the payoff words and `ActionForm`.
- **Results that never depend on a Mark:** realized R, disposition, fees, lot matches.
- **Callers wave-1 lanes will take:** `payoff.props.ts:63` and `journal.props.ts:177`. Each has a zone in reach and could name a contract in an Unavailable result. They are noted in the handoff for T8R.5 and T8R.15.
- **Not an `instrumentLabel` caller:** `tradeSummary` in the `ReviewCard` header.

Lane tier: unit 2036, integration 258, 14 of 14 checks.

## T8R.3-B1-F1 ocr review

ocr on `8df55c00` (session 9a511e82-0c81-402a-8c81-1fe02361e6cb, gpt-6.1-sol, 21 files reviewed, 0 comments; raw output `ocr/T8R.3-B1-F1-8df55c00.json`): **No findings.** The plan files the reviewer saw change during its run were the main session's own commit `7868d587`.

## T8R.3-B2 notes

`562b715f` (lane CN): 1 case in `calculation-words.test.ts`, red (`expected 'XYZ Dec 18 $52.51 Put' to be 'XYZ Dec 18 $52.505 Put'`) then green; no first-run pass. `summaryStrike` shows the comma-grouped 3-decimal value when the third digit is non-zero and keeps the old output otherwise ("$150", "$52.50", "$55"); the Trade Summary line gains the same. No signature change; every expected value unchanged. The brief's example "$150.00" was wrong (W28 writes "$150"); B2 kept the existing behavior. Lane tier: unit 2037, integration 258, 14 of 14 checks.

## T8R.3-B2 ocr review

ocr on `562b715f` (session 40534323-5d48-443c-a033-690b4f44aae8, gpt-6.1-sol, 2 files reviewed, 0 comments; raw output `ocr/T8R.3-B2-562b715f.json`): **No findings.**

## T8R.3-F1

The bench comparison's contract-name expectations (structural; test expectations and one comment).

- Before: `npx vitest run tools/bench/compare.test.ts` failed 1 of 15: `Expected: "NVDA 20 Nov 2026 107 Call"  Received: "NVDA Nov 20 $107 Call"` (case "should word a contract key, a signed quantity and an expiration date as the Review does").
- Changed lines in `tools/bench/compare.test.ts`: NVDA expectation to "NVDA Nov 20 $107 Call"; the QAB expectation (a year other than 2026, so it keeps its year) to "QAB Jan 4 2027 $92.50 Put" (hidden behind the first failure; same case, same concept); the settlement identity to "t1 AAPL Nov 20 $105 Call Long 20 contracts expired Fri Nov 20".
- Clock pin: inside that case, `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))`, with `afterEach(() => vi.useRealTimers())` in the describe. Only Date is faked, so no async work is affected.
- `tools/bench/compare.ts` line 63: comment only, now `("NVDA Nov 20 $107 Call")`; no code change.
- After: compare.test.ts 15 of 15 pass; typecheck, tsc6, lint, lint:deps exit 0; lane tier (unit 2033, integration 258, 14 of 14 checks) all pass; outputs in `evidence/D08R/suite-runs/T8R.3-F1-*.txt`.

## Merge: lane CN (T8R.3, T8R.3-F1, T8R.3-B1, T8R.3-B1-F1, T8R.3-B2)

Rebased `d08r/cn` onto `claude-opus-5.5` (`9e01e6a0`): T8R.3 `5580fda4` → `556a1e2a`, T8R.3-F1 `740b4008` → `b7a648d4`, T8R.3-B1 `48cbd15b` → `0cd52adf`, T8R.3-B1-F1 `8df55c00` → `61451412`, T8R.3-B2 `562b715f` → `87bd7743`. The one conflict was in this file (F1's section; both sides appended); the main session kept the deliverable branch's text and appended F1's section after it. The rebase brought T8R.1's, T8R.2's and T8R.4's code under lane CN, so the lane tier reran on `87bd7743` (`suite-runs/T8R.3-rebased-*.txt`): unit 2044 passed, integration 258 passed, 14 of 14 checks exit 0; evidence commit `2d24c9cb`. Fast-forwarded `claude-opus-5.5` to `2d24c9cb`; lane worktree `d08r-cn` and branch `d08r/cn` removed. Every wave-0 lane has merged.

## Merge run: wave 0

Complete cumulative run on `11c5c14a` via `suite-runner` (label `wave0-merge`, `browser-auto 0c6f9828` → full tier, first matching path `e2e/d7/marks-zero.spec.ts`): unit 192 files, 2044 passed; integration 118 files, 258 passed; browser stage 1 126 passed (5.1m), stage 2 120 passed (7.5m); 14 of 14 checks exit 0. `run-complete.sh`: run complete. No failures; the Ready-state case did not fail. Outputs `suite-runs/wave0-merge-*.txt`. This is the base for wave 1's `browser-auto`.

## Wave 1: lane worktrees

Created by hand from `fee1f3ad` (the Progress commit; the rows say `77d475d0`, the head before it, which differs only in the plan), each with `lane-setup.sh` (exit 0), under this worktree's `.claude/worktrees/`:

| Lane | Worktree | Branch | First task |
|---|---|---|---|
| TD | `d08r-td` | `d08r/td` | T8R.6 |
| BV | `d08r-bv` | `d08r/bv` | T8R.21 |
| PR | `d08r-pr` | `d08r/pr` | T8R.10 |
| RA | `d08r-ra` | `d08r/ra` | T8R.13 |
| BA | `d08r-ba` | `d08r/ba` | T8R.18 |
| JR | `d08r-jr` | `d08r/jr` | T8R.15 |

PO (T8R.5) waits for the first free slot (agent cap 6).

## T8R.18 ocr review

ocr on `682bd8fb` (session 45db47a3-9eb7-4ae8-a290-d6086aaa0286, gpt-6.1-sol, 2 files reviewed, 0 comments; raw output `ocr/T8R.18-682bd8fb.json`): **No findings.** Reviewer notes (not ocr findings):
- The distance is in price per share or contract quote for both sides: the dollar `toward` divided by |quantity| × multiplier leaves the sign-adjusted price difference. Short stock and short option-price conditions are covered by reading only, with no case.
- Case 4's Underlying Stop (48.00, Underlying 47.50) is crossed rather than "at its boundary": distance 0, beyond 1/2, consistent with A230. A Mark exactly on the boundary counts as crossed (`toward <= 0`), giving beyond 0, consistent with the existing `status` and `overrun`.
- A net quantity of zero with lots left would divide by zero; the reviewer found no path to it.

## T8R.18

Lane tier on `fee1f3ad` plus the T8R.18 change (`suite-runs/T8R.18-*.txt`): unit 193 files, 2048 passed; integration 118 files, 258 passed; 14 of 14 checks exit 0. `verify:fixtures` passes, so no frozen expected view failed on the added `trigger` field. `nearest` is untouched (T8R.20 removes it).

## Merge: lane BA (T8R.18)

Rebased `d08r/ba` onto `claude-opus-5.5`: T8R.18 `682bd8fb` → `69582aaa`. The only conflict was in this file, where both sides had appended; kept both. The deliverable branch had changed only plan and evidence since the base, so the lane tier stands. Fast-forwarded to `69582aaa`; removed lane worktree `d08r-ba` and branch `d08r/ba`. T8R.19 waits for T8R.21.

## T8R.13 ocr review

ocr on `4f54cea2` (session 66457317-1c8a-4b47-afda-466530310994, gpt-6.1-sol, 11 files reviewed, 0 comments; raw output `ocr/T8R.13-4f54cea2.json`): **No findings.** Reviewer notes (not ocr findings): `datedLineProps` reads `view.current.datedLine` and formats it, so ADR 0001 holds. It says "Marks" when the first plan leg is an Option. When the expiration is due, `openProps` returns before the dated line is spread in, so an expiration-due Trade shows no dated line. Neither A231 nor the cases cover that path.

T8R.13 notes (from its hand-back): the rail CSS lives at `src/ui/cockpit/styles/rail-a.css`, which is the lane's file at the real path. `PnlCardProps` gains `datedLine?` and `datedTone?`; `IdentityCardProps` loses `deviationActive`. The Deviation active assertions in `TradeDetail.test.tsx` and `Placed.test.tsx` now assert absence, as the task retires that badge. No browser spec changed. Lane tier: unit 2047, integration 258, 14 of 14 checks.

## T8R.13 Rail: no Deviation active badge; the P&L card's dated line

Behavioral task; its red and green rows are in `tdd-log/T8R.13.md`. The badge assertions in `TradeDetail.test.tsx` (the "Deviation active" block) and `trade-detail/Placed.test.tsx` now prove absence. The rail styles live in `src/ui/cockpit/styles/rail-a.css` (the brief named `src/ui/styles/`). No browser spec changed, so none was run.

## Merge: lane RA (T8R.13)

Rebased `d08r/ra` onto `claude-opus-5.5` (`355d6823`): T8R.13 `4f54cea2` → `5237ada5`. The one conflict was in this file, where both sides had appended; kept both. The rebase brought in T8R.18's code, so the lane tier reran on `5237ada5` (`suite-runs/T8R.13-rebased-*.txt`): unit 2051 passed, integration 258 passed, 14 of 14 checks exit 0. The evidence commit is `06a8135f`. Fast-forwarded to it, then removed the lane worktree `d08r-ra` and the branch `d08r/ra`.

## T8R.21 ocr review

ocr on `60c526db` (session aafa7fb0-ab39-44cd-a414-ae89c9997b49, gpt-6.1-sol, 5 files reviewed, 0 comments; raw output `ocr/T8R.21-60c526db.json`): **No findings.** Reviewer notes, not ocr findings:
- The reviewer traced `marksColumnsOf` by hand. At Thu 12:00 it gives Today Thu, `next: false`, Yesterday Wed. At Thu 18:00 it gives the same. On a Saturday it gives Mon, `next: true`, Yesterday Fri. At Thanksgiving noon, Fri 11-27, `next: true`, Yesterday Wed. On Monday before the close, Mon, `next: false`, Yesterday Fri. So `next` is true only when the exchange date is not a session (A232, W29).
- The new fields are additive. `previousSession` makes no store request, and the frozen fixtures still compare equal.
- Case 1's helper `detailAt` checks the view kind leniently, but its assertions are strict.

T8R.21 notes, from its hand-back:
- `exchangeDate` stays optional. A Review or Historical session has no as-of instant; a Current session always carries it.
- `marksColumns` is filled on Open, Settlement Due and Closed Details, never on Planned or Incoherent ones.
- `trade-summary.test.ts` gained `'marksColumns'` in its exact key list. That file is in lane BV's `src/coordinators/trade-views/`. The change is additive, and no value changed.
- Cases 3, 4 and 5 passed on their first run. Each was mutation-checked: `next` forced to false; `yesterday` fabricated. They are listed in the handoff's open questions.
- Lane tier: unit 2049, integration 258, 14 of 14 checks.

## T8R.21

Today's column dates (A232, P110). Behavioral; rows in `tdd-log/T8R.21.md`. `MarketDataReadSession.exchangeDate` stays optional: only a Current context has an as-of instant, so a Review or Historical session carries none; a Current session always carries it, covered or not. `previousSessionDate` comes from the calendar alone, as `nextSessionDate` does. `marksColumns` is derived in Trade Views from the session's trading date, exchange date, previous and next sessions, with no calendar of its own, and is filled on Open, Settlement Due and Closed Details with a session read.

## Merge: lane BV (T8R.21)

Rebased `d08r/bv` onto `claude-opus-5.5` twice. The first rebase, onto `359e0498`, had one conflict, in this file, where both sides had appended; I kept both. It brought in T8R.13's and T8R.18's code, so I reran the lane tier (`suite-runs/T8R.21-rebased-*.txt`): unit 2056 passed, integration 258 passed, 14 of 14 checks exit 0. The second rebase, onto `3189b504`, brought in a plan row only. T8R.21 `60c526db` → `c9155d02`, plus evidence `400b4b02`. Fast-forwarded to `400b4b02`, then removed lane worktree `d08r-bv` and branch `d08r/bv`. T8R.19 (lane BA) is now unblocked.

## T8R.15 ocr review

ocr on `da5e23ce` (session 3305c4fc-d802-42af-bcb8-8c295e32c786, gpt-6.1-sol, 13 files reviewed, 0 comments; raw output `ocr/T8R.15-da5e23ce.json`): **No findings.**

T8R.15 notes, from its hand-back:
- Cases: 5, red then green. The incoherent-list test passed on its first run because it shares the card item builder; its mutation (joining with " - ") failed it, and it is flagged.
- Changed expectations: `JournalCardItem.details` became `line`. The Anchor, Source, Moment, Authored and Review Date expectations in `journal-cards.props.test.tsx`, `Journal.test.tsx`, `Position.test.tsx:76–82` and `history.spec.ts` became dated-line or absence checks (W27). `history.spec.ts` passed in the browser (2 passed).
- Not yet verified: `e2e/d5/responsive.spec.ts:97–98`. It serves `dist-releases/current`, the classifier denied `npm run build:releases` in the lane, and against the stale release it fails. The agent changed `settledItem` to match the new line. The merge run's full tier rebuilds the release and will verify it.
- `journal.props.ts:177` now passes the Workspace zone to `calculation` (the handoff note for T8R.15). `JournalSection`'s `symbol` prop is now optional and unread; `Composed.tsx`, not lane JR's, still passes it.
- `OwedDebtItem.tsx` kept its old rows. Follow-up T8R.15-F1 in lane JR covers it.
- The CSS sits at `src/ui/cockpit/styles/journal.css`. Lane tier: unit 2048, integration 258, 14 of 14 checks.

## T8R.10 and T8R.6 notes (committed in their lanes; follow-ups running)

- **T8R.10** (`d8fd9ffe`, lane PR):
  - Cases: 5, each red then green.
  - The Conditions table replaces `conditionFiguresGroup`.
  - Three browser places outside the lane read the old Risk to stop and Reward to target rows: `e2e/support/detail/rail-b.ts`, `e2e/d4/breach-overrun.spec.ts:28,53` and `e2e/d7s/conditions.spec.ts:25`. The main session granted them to follow-up **T8R.10-F1** in lane PR. It told T8R.14, lane RA, to leave those helpers in `rail-b.ts`.
  - W6's "arrive with the first Marks" notes are not built: before the first Marks, Worst case and Max reward show their own unavailable words.
  - The agent ran prettier by mistake, then redid its edits by hand. The final diff holds only the intended lines.
- **T8R.6** (`651e5470`, lane TD):
  - Cases: 7. Cases 2, 4 and 5 were first-run passes, each mutation-checked.
  - Four lane browser specs (`d4/expected-mark`, `d4/breach-overrun`, `d4/responsive-a11y`, `d8p/today-narrow`) assert the merged state and need T8R.21's dates.
  - Two specs outside the lane still read the old card: `e2e/d4/correct-mark.spec.ts:23-26`, where "Corrected" now belongs on Price History (T8R.4), and `e2e/d4/runtime-failure.spec.ts:61` ("Mark missing"). The main session gives them to follow-up **T8R.6-F1** in lane TD, after rebasing onto T8R.21.
  - The agent's reading of A232 matches the plan: when `marksColumns` is absent, the table draws with undated "Today" and "Yesterday" headings and dashes.

## T8R.6 ocr review and bug tasks

ocr on `651e5470` (session 390e1509-a32f-4f9c-b235-a575e5e32f8a, gpt-6.1-sol, 14 files reviewed, 2 comments; raw output `ocr/T8R.6-651e5470.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `src/ui/cockpit/drawers/today.props.ts:72` | Production `getTradeDetail` never fills `marksColumns`, so every Open Trade shows undated headings and dashes. | Doubtful (planned interim state until T8R.21) |
| medium | test | `src/ui/screens/TradeDetail.test.tsx:42` | The fixture adds `marksColumns` by hand, so the dated-table assertion passes on data production never emitted. | Doubtful |

- **Finding 1, met by T8R.21's merge.** It was true at `651e5470`. T8R.21 merged (`c9155d02`) before T8R.6, and lane TD was rebased onto it (`f0cd69cd`), so production now fills the field. Its proof is T8R.6-F1's rerun of the four browser specs that read dated cells.
- **T8R.6-B1** (finding 2). Defect: the Trade Detail test's dated table rests on a hand-made `marksColumns`. Fix: remove the override now that the Detail fills it, keeping the expected values. Proof: a mutation of `marksColumnsOf` fails the test. It runs in lane TD with T8R.6-F1, as its own commit.

## T8R.10 ocr review and bug tasks

ocr on `d8fd9ffe` (session d4043ab7-10f8-455f-9caa-41fa7eb9d011, gpt-6.1-sol, 7 files reviewed, 2 comments; raw output `ocr/T8R.10-d8fd9ffe.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/cockpit/drawers/plan-risk.props.ts:76` | The dated fallback is chosen without checking `settlement`. A Settlement Due Trade with no current Mark but a `datedLine` shows the last Marks' figures beside "The contract expired, so its conditions are no longer measured." | Valid |
| low | maintainability | `src/ui/cockpit/drawers/plan-risk.props.ts:93` | A chained ternary builds the Distance cell. | Doubtful |

- **T8R.10-B1** (finding 1). Defect: on a Settlement Due Trade whose current Mark is missing, the Conditions table shows dated figures that contradict its expired note. Case: "it should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing". Fix: check `settlement` before choosing the dated fallback, as the rail's `conditions.props.ts` does.
- **T8R.10-B2** (finding 2). Defect: the Distance cell's chained ternary is hard to read. Fix: a small named function with the same three outcomes (blank, "away", "past"). Kind: structural, with existing cases unchanged.

Both run in lane PR after T8R.10-F1.

## T8R.5 ocr review and bug task

ocr on `88a8d106` (session d7b3fa98-17a2-4d5f-ab21-d0ae9079f73c, gpt-6.1-sol, 9 files reviewed, 1 comment; raw output `ocr/T8R.5-88a8d106.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | test | `src/ui/cockpit/drawers/position.props.test.tsx:89` | The Instrument assertions cover only single-instrument Trades, and the two-leg case checks only the Position rows. Labelling every lot or Lot Match with the first leg's contract would still pass. | Valid |

**T8R.5-B1.** Defect: no case pins the Instrument column on a Trade with two different contracts, so a first-leg-only label would pass. Case: "it should name each open lot and each Lot Match by its own contract on a Trade with two contracts", a $55 and a $60 call, one lot of each, one partly closed. The case may pass on its first run, because the code reads as correct. The mutation then labels every row with the first leg's contract. Runs in lane PO.

T8R.5 notes, from its hand-back: 4 cases, red then green. An Expiration-receipt case was a first-run pass and was mutation-checked. The agent edited `PositionChangeFormExit.test.tsx` and `PositionChangeFormOptions.test.tsx`, which belong to no lane and hold the exit receipt's Lot Matches expectations, adding only the new column. No new words. `src/ui/styles/position.css` does not exist. Narrow-width browser checks in `e2e/d6`, `e2e/d7` and `e2e/d2/ui-alignment.spec.ts`'s Open Lots may be affected and were not run; the next merge run covers them. Lane tier: unit 2049, integration 258, 14 of 14 checks.

## T8R.15-F1 ocr review

ocr on `78d942c7` (session d23df672-a042-4570-91a6-e4769f2fa3e8, gpt-6.1-sol, 2 files reviewed, 0 comments; raw output `ocr/T8R.15-F1-78d942c7.json`): **No findings.**

F1's notes, from its hand-back: 1 case, red ("Unable to find … Position Change · Mon Oct 12, 10:00 am · written Tue Oct 13") then green, with no first-run pass. An owed Debt resolved in place now shows `entryLine(...)` in a `.journal-line`. The existing case "should relabel a reflection resolved on Trade Detail …" changed from `termValue(item, 'Answered'|'Declined')` = `2026-10-13 09:05`/`09:10` to the dated line, with no Answered or Declined `dt`. Its other assertions stayed. Lane tier: unit 2049, integration 258, 14 of 14 checks.

## T8R.15 (lane JR): one dated line per Journal entry

- Shared words: `src/ui/cockpit/drawers/journal-line.ts` holds `dateAndTime(instant, timeZone)` ("Thu Oct 15, 4:00 pm") and `entryLine(source, momentTime, authoredTime, timeZone)` ("Daily Review · Thu Oct 15, 4:00 pm", plus " · written Fri Oct 16" when the authored time falls on a later Workspace-zone date). The session cards, the incoherent list (`journal.props.ts`) and the fallback `JournalSection` (`Journal.tsx`) all use it. `JournalCardItem.details` is replaced by `line: string` (empty for an owed Debt, which draws its own item).
- Unanswered prompts are filtered out in both renderers. The Trade Anchor, Review Date, Source, Moment, Authored, Answered and Declined rows are gone. The Edited and "Deferred, answered" badges, "Declined later" / "Reflection declined" with the reason stay.
- `journal.props.ts` line 177 (`calculation(tradePnl, money)`): now passes `timeZone` as the trailing argument (the T8R.3-B1-F1 handoff note). One argument; no case of its own.
- Tests changed: `journal-cards.props.test.tsx` (3 existing cases to the line; 5 new), `Journal.test.tsx` (the Anchor, Source, Moment, Authored, Review Date, Intent "Not answered" and Answered/Declined expectations; one prose case retitled), `Position.test.tsx:76–82`. `Position.test.tsx:181` stays: it reads an Execution's own details, not a Journal item. `Cockpit.test.tsx:161` and `TradeDetail.test.tsx:33` hold no Journal item (a tab list and a Debt fixture's `dueAnchor`), so they are unchanged.
- E2E: `e2e/d8p/history.spec.ts` (Review Date lines now the Source-and-moment line; the deferred Wednesday entry reads "Trade Detail · Wed Oct 14, 11:00 am · written Thu Oct 15"; a whole-drawer check that "Review Date", "Anchor", "Moment", "Authored" and "Not answered" appear nowhere, hidden cards included), `e2e/support/detail/journal.ts` (`settledItem` still takes "2026-10-12 10:30" and matches the new line), comments in `e2e/d8p/support.ts` and `e2e/d2/ui-alignment.spec.ts`. `npm run build:faults` then `npx playwright test e2e/d8p/history.spec.ts`: 2 passed.
- Not verified: `e2e/d5/responsive.spec.ts:97–98` uses `settledItem` and serves `dist-releases/current`; the rebuild (`npm run build:releases`) was denied by the permission classifier in this session, so the case ran against a stale release and failed on it. It needs `build:releases` and a rerun by the main session.
- The path `src/ui/styles/journal.css` in the lane table is `src/ui/cockpit/styles/journal.css`: `.journal-line` joins the muted-text rule there.
- `JournalSection`'s `symbol` prop is now unread; it is optional, and `Composed.tsx` (not lane JR's) still passes it.

## T8R.15-F1 (lane JR): an owed Debt resolved in place shows the dated line

- `OwedDebtItem.tsx`: once resolved in place, the saved item shows `entryLine(debt.source, debt.momentTime, authoredTime, timeZone)` (the same line the cards build) in place of the "Position Change at" line, and no Answered or Declined row. The unresolved item is unchanged. The `timeLabel` state field is removed.
- New case in `Journal.test.tsx`: the dated line "Position Change · Mon Oct 12, 10:00 am · written Tue Oct 13", no Answered or Declined term.
- Changed expectation, `Journal.test.tsx` "should relabel a reflection resolved on Trade Detail ...": before, `termValue(item, term)` was `2026-10-13 09:05` (Answered) or `2026-10-13 09:10` (Declined); after, the item has the text "Position Change · Mon Oct 12, 10:00 am · written Tue Oct 13" and no `dt` named Answered or Declined. The label, no "Reflection owed" and no Due expectations are unchanged. The table's `time` field is removed.

## Merge: lane JR (T8R.15, T8R.15-F1)

Rebased `d08r/jr` onto `claude-opus-5.5` (`75b3ef64`): T8R.15 `da5e23ce` → `727fd53a`, T8R.15-F1 `78d942c7` → `17b8abc6`. Conflicts only in this file, where both sides had appended; the main session kept both and checked there were no duplicate sections. The rebase brought in T8R.13's, T8R.18's and T8R.21's code, so the lane tier reran (`suite-runs/T8R.15-rebased-*.txt`): unit 2061 passed, integration 258 passed, 14 of 14 checks exit 0, with evidence in `e7e5f7bf`. Fast-forwarded to `e7e5f7bf`; lane worktree `d08r-jr` and branch `d08r/jr` removed. T8R.16 is next in lane JR, once a slot frees.

## T8R.10-F1 ocr review and bug task

ocr on `ccc698f1` (test-only; session 35762f66-12f1-4cc2-8669-ceec59d8d208, gpt-6.1-sol, 2 files reviewed, 1 comment; raw output `ocr/T8R.10-F1-ccc698f1.json`):

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| low | maintainability | `e2e/support/detail/rail-b.ts:16-18` | The new `riskFigure` adds a nested ternary; a block with early returns would be clearer. | Doubtful |

**T8R.10-F1-B1** (structural): rewrite `riskFigure` with early returns, same three outcomes, with the browser specs that use it passing before and after. It runs in lane PR after T8R.10-B1, B2 and F2.

T8R.10-F1 notes: the helpers read the "Conditions table" cells. `breach-overrun.spec.ts:28` now expects "Risk to stop $50.00 · 0.20R past" (W32), and lines 53 and `d7s/conditions.spec.ts:25` needed no change. `d7s/conditions` has 2 passing cases. `breach-overrun` passes line 28 but fails at line 42: `riskFigure(page, 'Worst case')` matches both the rail card and Plan and Risk's new notes until T8R.14 removes the rail's Worst case. With `.first()` tried and then reverted, the whole spec passed. **So T8R.10 and T8R.14 merge in one batch before a merge run.** `e2e/d8p/cockpit.spec.ts:144-145` goes to T8R.10-F2.

## T8R.19 ocr review, and follow-up F1

ocr on `a471e993` (session 1b85ba45-15c8-4d56-afc6-1ba3c5e436e1, gpt-6.1-sol, 4 files reviewed, 0 comments; raw output `ocr/T8R.19-a471e993.json`): **No findings.** Reviewer notes: `due` is always the session after `after`, since both come from the same `day.date` through `sessionPolicy.nextSession`. Outside coverage the result is SessionPolicyNotCovered, not AwaitingClose. The Closed, dated-line and replay-series paths cannot produce AwaitingClose, because they have no `resolution` or are cut off at the close. `trade-views.ts:487` and its replay view at line 876 read `nextSessionDate` from the session directly; T8R.24 may consider reading `due` instead.

T8R.19 notes: 3 cases plus one extra pass-through case in `value-trade.test.ts`. Case 3 passed on its first run, and its mutation check is recorded. `valueTrade` passes `nextSessionDate` into the main evaluation only. The lane tier had 3 failures: exact AwaitingClose expectations outside lane BA (`tests/integration/d4/intraday.test.ts` I4.18, `trade-views/current-evaluation.test.ts`, `trade-views/option-views.test.ts`). `verify:fixtures` stayed green. **Follow-up T8R.19-F1** (lane BA) adds `due` to those three exact values and loosens nothing, as A243 and A245 require. It is listed for the final report.

## T8R.22 stop, and follow-up F1

T8R.22's agent built both cases (case 2 a first-run pass, mutation-checked) and stopped before committing. Its lane tier failed one existing proof: `tests/integration/d7/query-count.test.ts:126`, T7.29, "should issue the same Trade Detail requests, bar the frame reads, for an expired and a live contract at one clock". A234's Underlying `series` read gives the expired Detail extra requests (seen as two `observations.getAll` reads and one more `meta.get`). The plan's I8R.7 records that the Settlement Due Detail gains exactly that one read, so T7.29's "the same requests" premise no longer holds, and the plan's rule that existing proofs keep their exact lists cannot hold for T7.29.

The main session's implementation-level decision: T7.29 keeps an exact comparison, and the expired list equals the live list plus exactly the one series read's requests. If those requests are more than one series read needs, that is a stop. A fresh agent commits T8R.22 and makes this change as **T8R.22-F1**. The first agent still had background work in the lane and was stopped. Listed for the final report.

## Merge run: wave 1, batch 1 (`wave1-merge1`)

Complete cumulative run on `db0352e9`, 2026-11-17 02:19 to 02:34 EST, by `suite-runner`. It covers T8R.18, T8R.13, T8R.21, T8R.15 and T8R.15-F1, merged since `wave0-merge` (`11c5c14a`). Browser tier: full (`browser-auto 11c5c14a`; the first matching path was `e2e/d2/ui-alignment.spec.ts`). `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 194 files, 2061 tests passed |
| Integration | 118 files, 258 tests passed |
| Browser 1 | 125 passed, **1 failed** (5.3m) |
| Browser 2 | 119 passed, **1 failed** (7.6m) |
| Checks | 14 of 14 exit 0 |

Failures:
- `e2e/d2/ui-alignment.spec.ts:1730` T2.64, at line 1763: "description-list values above the Fulfillment row", expected > 0, received 0.
- `e2e/d5/detail-debt.spec.ts:7` B5.3, at line 25: `detail.journal(page).getByText('Answered', { exact: true })` was not found.

Tech debt item 11's flake did not occur. Both failures are in the Journal drawer, so the suspect is T8R.15. One targeted run, before and after T8R.15, is pinning them. The fix goes to a fresh `tdd-task` from the current head, failing test first.

Load note: T8R.19-F1's first lane-tier run had two 5-second timeouts (`tools/wording-rules.test.ts`, `src/app/bench-generator.test.ts`). Both passed alone, and the whole tier passed on rerun. Several lanes were running suites at once.

### Pinned: T8R.15, and follow-up T8R.15-F2

One targeted run of the two specs, in a scratch worktree removed afterwards: both pass at `75b3ef64` and both fail at `727fd53a` (T8R.15), with the merge run's failure lines. T8R.15-F1 is not involved.
- **T2.64** lined the Fulfillment value up with the `dl:not(.answers) dd` values above it in the open drawer panel. The only matches were the Journal items' details `<dl>`, which T8R.15 replaced with `<p class="journal-line">`.
- **B5.3** expected the old details row "Answered" with "2026-10-13 12:30". T8R.15 removed that row: the answer came the same day, so the dated line has no "· written" part (A239).

The plan supports the new markup. T8R.15 "replaces W10's items and the details grid"; W27 gives the dated line, and A239 gives "· written". T8R.15's file list named neither spec. **T8R.15-F2** (test-only) brings both specs up to date in a fresh lane, JF: worktree `.claude/worktrees/d08r-jf`, branch `d08r/jf`, from `41e9b8dc`.

## T8R.22 and T8R.22-F1 ocr review

ocr on the range `82e339bf..11de60eb` (`c2c42f24` T8R.22, `11de60eb` T8R.22-F1). Session 80bece3d-1ea3-4771-9ada-541d07f4feb3, gpt-6.1-sol, 3 files reviewed, 0 comments, raw output in `ocr/T8R.22-11de60eb.json`. **No findings.**

The first run (session 09a2f606) hit the ChatGPT usage limit on every file. The agent waited from 02:23 to 03:50 and reran. T8R.22-F1 notes: the expired Detail's extra requests are exactly what one `series` call makes: two `observations.getAll` (the range scan, and the evidence read for the clock date) and one `meta.get` (the shared snapshot id). So T7.29 stays exact: the live list plus those three.

## T8R.22

Behavioral task; rows in `tdd-log/T8R.22.md`. `settlementUnderlying` on an Open Detail with `settlement` items and column dates, from one `series` read of the Underlying over the two column dates.

## T8R.22-F1

Structural; `tests/integration/d7/query-count.test.ts`, the T7.29 case at line 126. A234 and I8R.7: the Settlement Due Detail gains exactly one `series` read of its Underlying, so "the same requests" no longer held (due: `meta.get` 11, `observations.getAll` 2 more than the live-less-frame list).

- Before: title "... should issue the same Trade Detail requests, bar the frame reads, for an expired and a live contract at one clock"; due tally `{ ..., 'meta.get': PINNED['meta.get'] - 1, 'trades.get': 2 }`.
- After: title "... bar the frame reads and the Underlying series read ..."; due tally `{ ..., 'meta.get': PINNED['meta.get'], 'observations.getAll': 2, 'trades.get': 2 }`, with a comment naming A234 and I8R.7. The live assertion and every other assertion are unchanged.
- The extra requests, all from the one `series` call (no other query-count proof reads a series, so the source was read): `observations.getAll` 1, the scan's `byInstrumentDate` range read (`historicalGaps`); `observations.getAll` 1, the clock date's evidence read (`evidenceFor`, because the series reaches the session's own date); `meta.get` 1, the read snapshot's id (one shared snapshot for both). Nothing else.

## Merge: lane BV (T8R.22, T8R.22-F1)

`d08r/bv` was rebased onto `claude-opus-5.5` at `6b3cd7a7`:
- T8R.22: `c2c42f24` → `a414c8c4`
- T8R.22-F1: `11de60eb` → `ef9f6ba7`

The only conflicts were in this file, where both sides had appended. The main session kept both sides and appended the lane's T8R.22 and T8R.22-F1 sections, one per commit. The rebase brought in code the lane doesn't own (T8R.15 and others), so the lane tier was rerun as `suite-runs/T8R.22-rebased-*.txt`:
- unit: 2063 passed
- integration: 258 passed
- checks: 14 of 14 exit 0

That evidence is commit `d0ddd741`. Main fast-forwarded to `d0ddd741`, and lane worktree `d08r-bv` and branch `d08r/bv` were removed. T8R.23 is next in lane BV.

## T8R.6-F1 ocr review

ocr on `3226c502` (test-only, reviewed in place): session e1ba32d4-cb40-438d-b570-fb561c9b6251, gpt-6.1-sol, 2 files reviewed, 0 comments. Raw output: `ocr/T8R.6-F1-3226c502.json`. **No findings.** The first run hit the usage limit, and the agent waited from 02:23 to 03:50.

T8R.6-F1 notes:
- `correct-mark.spec.ts:23-26` now reads the Price History cell's corrected provenance.
- `runtime-failure.spec.ts:61` now reads the Today "ABC Mark" cell as "—" (W29).
- 16 of 16 specs pass on T8R.21's merged column dates, which confirms T8R.6 ocr finding 1 was met by T8R.21's merge.

T8R.6-B1 changed no code. `TradeDetail.test.tsx:42`'s `marksColumns` override stays, because that test renders a hand-built view through `facadeDouble()` and never runs the coordinator. Real emission is proved in `columns.test.ts` (I8R.2, A232). Recorded as met by that coverage.

## T8R.19-F1 ocr review

ocr on `972795f5` (test-only): session 2ee26eb2-170f-4c7e-aa51-da1551d98a47, gpt-6.1-sol, 3 files reviewed, 0 comments. Raw output: `ocr/T8R.19-F1-972795f5.json`. **No findings.**

An earlier agent gave up while waiting on the usage limit (sessions 82caa9ab and 7ad5d16d, nothing reviewed). It was not counted, and a fresh agent ran the review once usage came back.

## T8R.15-F2 ocr review

ocr on `f6eaacff` (test-only, reviewed in place): session ad09b055-ee9a-429b-83f6-b0e76f9851fe, gpt-6.1-sol, 2 files reviewed, 0 comments. Raw output: `ocr/T8R.15-F2-f6eaacff.json`. **No findings.** The first run hit the usage limit, and the agent waited from 02:44 to 03:52.

T8R.15-F2 changes:
- **B5.3:** the "Answered" and "2026-10-13 12:30" rows are replaced by the exact dated line "Trade Detail · Tue Oct 13, 10:00 am". The answer came the same day, so there is no "· written" part (A239). The time 12:30 no longer shows anywhere on the Journal, so the "12:30" in the test name has nothing to assert against. This goes in the final report.
- **T2.64:** this is an interim, looser check. Plan and Risk's `dl.figure-grid` left edges must equal the Fulfillment list's, and Fulfillment's right edge must be at most the drawer values' maximum. The footer's 480 px column can't share a right edge with Plan and Risk's narrower columns. The main session accepts this until T8R.11 moves Fulfillment into Plan and Risk (handoff note for T8R.11), and it goes in the final report.

## Usage-limit wait, 02:20 to 03:50

ChatGPT's usage limit blocked every ocr review from about 02:20 until 03:50. While waiting, one review agent killed its own wait loops with `pkill -f` on part of their command text. That pattern could have matched other waiters; the main session's own waiter ended at that time. Later briefs say to kill only your own processes, by PID.

## T8R.6 Today: one Marks table on an Open Trade

Behavioral task; its rows are in `tdd-log/T8R.6.md`. Browser specs changed in lane TD: `e2e/d4/expected-mark.spec.ts`, `e2e/d4/breach-overrun.spec.ts`, `e2e/d4/responsive-a11y.spec.ts`, `e2e/d8p/states.spec.ts`, `e2e/d8p/today-narrow.spec.ts`, through the new `marksTable`, `marksHeadings`, `marksCell` and `marksNotes` helpers in `e2e/support/detail/today.ts`.

Run in the lane (`npm run build:faults`, `npm run build:releases`, then `npx playwright test <specs>` under `with-browser-lock.sh`): `first-marks-pending` and `states` pass. `expected-mark`, `breach-overrun`, `d4/responsive-a11y` and both `today-narrow` cases fail only on a Mark or change value (each reads a dash), because Trade Views does not name the column dates until T8R.21 merges (the cells are selected by those dates, A233). Their assertions are written for the merged state; rerun them after T8R.21.

## T8R.6-F1 The browser specs read the Marks table

Structural. Two specs outside the lane read the old current-Marks card; both now read where W29 and A232 put the fact.

- `e2e/d4/correct-mark.spec.ts`: the "Corrected" badge and the reason are read on Price History (T8R.4, T8R.4-F1), as the Mon Oct 12 cell whose accessible name is `$51.50. <provenance>. Corrected: Misread the closing quote.` (the Price History drawer is opened first). The `$130.00` check on the rail and the two-revision probe are unchanged.
- `e2e/d4/runtime-failure.spec.ts`: "Mark missing" in the old card becomes ABC's Today cell in the Marks table reading a dash (W29: a cell without a Mark reads "—"; the Mark-missing link left Today). Every other expectation is unchanged.

Browser results (`npm run build:faults`, `build:releases`, `build`; then `npx playwright test <files> --reporter=list` under `with-browser-lock.sh`; nothing on 5175, 9341 or 9342 before or after):

| Spec | Before my changes (on T8R.21) | After |
| --- | --- | --- |
| `d4/correct-mark` | fail (`.current-marks` not found) | pass |
| `d4/runtime-failure` (B4.10) | fail (`.current-marks` not found) | pass |
| `d4/runtime-failure` (B4.11) | pass | pass |
| `d4/expected-mark` | pass | pass |
| `d4/breach-overrun` | pass | pass |
| `d4/responsive-a11y` | pass (all 5) | pass |
| `d8p/today-narrow` (both cases) | pass | pass |
| `d8p/first-marks-pending` | pass | pass |
| `d8p/states` | pass (3 cases) | pass |

The four lane specs written for the merged state pass now that T8R.21 fills the column dates; none needed a change. `breach-overrun.spec.ts` lines 28 and 53 were not touched.

## T8R.6-B1 Trade Detail's Marks-table test uses the Detail's own column dates

ocr found that `src/ui/screens/TradeDetail.test.tsx` adds `marksColumns` to its `thursday()` fixture by hand (line 42). T8R.21 now fills the field in `getTradeDetail`.

Result: the override stays; no code changed. The test does not build its Detail through the coordinator. `facadeOf` makes `getTradeDetail` a mock (`facadeDouble()`, `mockResolvedValue({ kind: 'Ready', view, binding })`) and returns the hand-built `thursday()` view, so the screen only ever renders what the fixture holds. Removing the override would leave the table with no dates and the heading assertion (`Today, Thu Oct 15`, `Yesterday, Wed Oct 14`, `Change`) would fail for want of a source that this test has none of; a `marksColumnsOf` mutation could not reach it. The real emission is checked where the coordinator runs: `src/coordinators/trade-views/columns.test.ts` (I8R.2, A232), which T8R.21 added. The override mirrors the real field's shape (`{ today: { date, next }, yesterday }`), so it cannot drift silently from the type.

## T8R.19

- Cases: 3 in `src/domain/trade-analysis/evaluate.test.ts`, plus one coordinator case in `src/coordinators/valuation/value-trade.test.ts` for the pass-through (A243). Case 3 was a first-run pass, mutation-checked.
- `AwaitingClose.due` is set from `TradeEvaluationInput.nextSessionDate`; `valueTrade` passes the read session's `nextSessionDate` into the main evaluation (not the dated line's).
- Lane tier: three existing tests outside the lane now see `due` in toEqual expectations and fail: `tests/integration/d4/intraday.test.ts` (I4.18), `src/coordinators/trade-views/current-evaluation.test.ts` (AwaitingClose figures with dated and at-entry lines), `src/coordinators/trade-views/option-views.test.ts` ("should not say so once shares are added after an earlier Mark"). No frozen fixture failed: `verify:fixtures` exit 0. 14 of 14 checks exit 0.

## T8R.19-F1

- Before: each of the three cases failed with "AssertionError: expected { kind: 'Unavailable', ... } to deeply equal ..." where the actual value carried the extra `"due": "2026-10-13"` (current-evaluation shows it twice, for `remainingOpenPnl`-style figures and conditions).
- Every true `due` is 2026-10-13, the session after Monday 2026-10-12, as A243 says. Nothing else changed; every comparison stays exact.
- `tests/integration/d4/intraday.test.ts` line 35:
  - before: `const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: MONDAY };`
  - after: `const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: MONDAY, due: TUESDAY };`
- `src/coordinators/trade-views/current-evaluation.test.ts` line 127:
  - before: `const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: REVIEW_DATE };`
  - after: `const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: REVIEW_DATE, due: '2026-10-13' };`
- `src/coordinators/trade-views/option-views.test.ts` line 514:
  - before: `... toEqual({ kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' });`
  - after: `... toEqual({ kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12', due: '2026-10-13' });`
- After: the three files pass together (3 files, 33 tests).

## T8R.15-F2

Test-only; no product code changed.

- Red at base `6ea5d5aa`: B5.3 failed at `detail-debt.spec.ts:25` (`getByText('Answered', { exact: true })`: element(s) not found); T2.64 failed at `ui-alignment.spec.ts:1763` ("description-list values above the Fulfillment row": expected > 0, received 0).
- B5.3: the Answered and `2026-10-13 12:30` expectations became one on the dated line, `Trade Detail · Tue Oct 13, 10:00 am`. The line shows the moment, not the answer time, and has no "· written" because the answer came the same day (W27, A239). The time 12:30 now appears nowhere on the Journal.
- T2.64: Fulfillment renders in the footer below the drawers. The Journal's `<dl>` items are gone, so the check now opens Plan and Risk. Its figure lists are two 259 px columns at 1280, while Fulfillment is one 480 px column, so no value column shares its right edge any more. The check now asserts the same left edge for the figure lists and Fulfillment, and the Fulfillment value right edge within the drawer values' right extent. The row-width cap, answers-below-questions and accessibility parts are unchanged.
- Green: both pass; the whole of `ui-alignment.spec.ts` and `detail-debt.spec.ts` passes (46).

## T8R.16

Journal paging keeps keyboard focus (tech debt item 24). B8R.6's focus case written first, red (`toBeFocused` on Newer sessions: inactive), green after the fix. Two unit cases in `journal-cards.props.test.tsx`; the first passed on its first run (flagged and mutation-checked in `tdd-log/T8R.16.md`). Lane tier: `.claude/scripts/full-suite.sh evidence/D08R T8R.16 lane` exit 0 (unit 2063, integration 258, 14 of 14 checks).

## T8R.5

Behavioral task (4 cases); rows in `tdd-log/T8R.5.md`. Notes:
- The handoff note on `payoff.props.ts:63`, `journal.props.ts:177` and the `ReviewCard` header's `tradeSummary` zone did not apply: none of those files belongs to lane PO.
- `src/ui/styles/position.css` does not exist and needed no change. `e2e/support/detail/position.ts` needed no change; no browser spec was changed, so none was run.
- The exit receipt has no test file of its own; its tests live in `PositionChangeFormExit.test.tsx` and `PositionChangeFormOptions.test.tsx`, whose Lot Matches expectations gained the Instrument column.

## T8R.5-B1

Behavioral bug task (1 case); rows in `tdd-log/T8R.5-B1.md`. First-run pass with a two-part mutation, no product change. The case builds a Trade with a $55 call and a $60 call and checks that each open lot and the Lot Match name their own contract.

## T8R.23 Trade Views: the open lots' average

- **Helper and field:** `openLotsAverageOf(derived)` in `src/coordinators/trade-views/trade-views.ts` is the quantity-weighted Open Lot price, fees excluded and unrounded; it is absent with no open quantity. `getTradeDetail` sets `openAverage` on the Open Detail only when `settlement.length === 0`, so a Settlement Due Detail and a Closed Detail carry no field (A236).
- **Refactor:** `openItem`'s `averageOpenCost` now calls `openLotsAverageOf` in place of its inline copy of the same sum.
- **First-run pass, flagged:** "should give a stock Trade the Trade Summary price" passed on its first run, because case 1's helper already gives a stock Trade its lots' average. Mutation: added 1 to the average in `openLotsAverageOf`. Command: `npx vitest run src/coordinators/trade-views/trade-summary.test.ts -t "should give a stock Trade the Trade Summary price"`. It failed on the expected value (off by 1); restored, green again.
- **Renamed cases:** the planned names carry apostrophes, `$` and `+`, which break `-t` filtering. "should give O-C3+'s open lots' average, $2.65" is "should give O-C3+ open lots average 2.65" (run with the filter "open lots average 2.65"). "should give a stock Trade the Trade Summary's price" is "should give a stock Trade the Trade Summary price". The describe name is "getTradeDetail: open lots' average (A236)".
- **Key list:** `'openAverage'` was added to the Open Detail's exact key list in "should keep every other field of every item and Detail unchanged" (`trade-summary.test.ts`): main-session decision, additive (A245). The comparison stays exact.
- **Note for T8R.8:** `openAverage` is absent on an Open Detail with no open lots, so the track must handle an undefined field.
- **Lane tier:** `.claude/scripts/full-suite.sh evidence/D08R T8R.23 lane`: unit 2065 passed, integration 258 passed, 14 of 14 checks exit 0.

## T8R.10

Plan and Risk's Conditions group (behavioral; 5 cases, rows in `evidence/D08R/tdd-log/T8R.10.md`). Files: `src/ui/cockpit/drawers/plan-risk.{tsx,props.ts,types.ts,test.tsx}`, `src/ui/cockpit/styles/plan.css` (the path of "styles/plan.css" in this repository), and the T8R.10-assigned expectations in `src/ui/screens/TradeDetail.test.tsx` and `src/ui/screens/trade-detail/Placed.test.tsx`.

- Not done here, left for the lane that owns the file: `e2e/support/detail/rail-b.ts` (`riskToStop`, `rewardToTarget` and `figureIn(... 'Risk to stop')` read the old `dt` rows) and the specs that call them (`e2e/d4/breach-overrun.spec.ts:28,53`, `e2e/d7s/conditions.spec.ts:25`). They need the Conditions table's cells.

## T8R.10-F1

The browser helpers read the Conditions table (structural; follow-up to T8R.10).

- `e2e/support/detail/rail-b.ts`: `riskToStop` was `valueIn(planRiskPanel(page), 'Risk to stop')`, now the cell of the "Conditions table" region (inside Plan and Risk's panel) whose text starts "Risk to stop "; `rewardToTarget` likewise with "Reward to target ". `riskFigure(page, 'Risk to stop')` now returns `riskToStop(page)`. The cell text carries its label (W31), so an expectation reads "Risk to stop $220.00 · 1.10R".
- `e2e/d4/breach-overrun.spec.ts:28`: before `toHaveText('$0.00 · 0.00R')`, after `toHaveText('Risk to stop $50.00 · 0.20R past')` (W32's past form; the Stop is crossed by $50.00, 0.20R).
- `e2e/d4/breach-overrun.spec.ts:53`: unchanged. It reads the dated line's own `dt` row in the Today drawer, which T8R.10 did not touch; it passes.
- `e2e/d7s/conditions.spec.ts:25`: unchanged. Line 25 is only the test title; the body never calls `riskToStop` or `rewardToTarget`. Passes before and after.
- `e2e/support/detail/plan.ts`: no line read the old rows; unchanged.

Browser (after `npm run build:faults` and `npm run build:releases`, through `with-browser-lock.sh`):
- Before: `e2e/d7s/conditions.spec.ts` 2 passed; `e2e/d4/breach-overrun.spec.ts:11` failed at line 28, "Expected: "$0.00 · 0.00R" ... element(s) not found".
- After: `e2e/d7s/conditions.spec.ts` 2 passed; `e2e/d4/breach-overrun.spec.ts:11` passes line 28 and fails at line 42 (not an owned line): `detail.riskFigure(page, 'Worst case')` is a strict-mode violation, resolving to 2 elements, the rail's Conditions card (still has Worst case until T8R.14) and Plan and Risk's new notes list (T8R.10). With `.first()` on that line (temporary, reverted) the whole spec passes, so line 53 holds.
- Also affected, not owned: `e2e/d8p/cockpit.spec.ts:144-145` read `riskToStop` and `rewardToTarget` with `'$220.00 · 1.10R'` and `'$180.00 · 0.90R'`; they now need the "Risk to stop " and "Reward to target " prefixes.

Lane tier: `evidence/D08R/suite-runs/T8R.10-F1-*.txt`; unit 2049 passed, integration 258 passed, 14 of 14 checks exit 0.

## T8R.10-B2 The Distance cell without a chained ternary

`src/ui/cockpit/drawers/plan-risk.props.ts`: the chained ternary in the Distance cell became a named function `distanceText` with the same three outcomes (blank without a trigger, "... away" while Active, "... past" once crossed).

- Before (after B1, ternary still in place): `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx` exit 0, 13 passed.
- After: `npx vitest run src/ui/cockpit/drawers` exit 0, 7 files, 54 passed; `npm run typecheck` exit 0.
- `git diff --stat`: only `plan-risk.props.ts`, 6 insertions, 3 deletions, all in that function.

## T8R.10-F2 The cockpit spec reads the Conditions table cells

`e2e/d8p/cockpit.spec.ts` lines 144-145: the expected texts of `riskToStop` and `rewardToTarget` now carry the cell labels: `'Risk to stop $220.00 · 1.10R'`, `'Reward to target $180.00 · 0.90R'`.

- Before: `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/cockpit.spec.ts` exit 1, 1 failed: B8P.1 at line 116 (`Plan and Risk cards`: received an extra "conditions" heading, not in the spec's HEADINGS list). The test stops there, before lines 144-145.
- After: same command, exit 1, same single failure at line 116. Lines 144-145 are not reached, so the new texts are not yet exercised; the line 116 expectation is outside this task's lines (T8R.14 owns that file's other lines).

## T8R.10-F1-B1

`riskFigure` in `e2e/support/detail/rail-b.ts` is now a block with early returns instead of a nested ternary. The three outcomes are unchanged: Worst case and Max reward read the rail's summary list, Risk to stop reads `riskToStop`, anything else reads `figureIn(planRiskPanel(page), term)`.

Specs that call `riskFigure` (grep of `e2e/`): `e2e/d4/breach-overrun.spec.ts`, `e2e/d4/responsive-a11y.spec.ts`. Both runs: `npm run build:faults && npm run build:releases`, then `.claude/scripts/with-browser-lock.sh npx playwright test <both specs> --reporter=list`.

| Spec | Before (ca42db6b) | After |
|---|---|---|
| e2e/d4/breach-overrun.spec.ts | 1 failed at line 11 test (strict mode violation: the Worst case locator resolved to 2 elements) | identical failure |
| e2e/d4/responsive-a11y.spec.ts | passed | passed |

Totals both times: 1 failed, 5 passed. `npm run typecheck` exit 0, `npm run lint` exit 0.

## Merges: lanes TD, BA, JF, JR, PO, BV (T8R.23) and PR, in that order

Each lane was rebased onto the deliverable branch's head at its turn and its lane tier rerun (each rebase brought in code it doesn't own), then fast-forwarded. Main took no commits between a rebase and its fast-forward. Evidence conflicts were resolved by keeping upstream and appending the lane commit's own lines.

| Lane | Tasks, rebased hashes | Rerun lane tier (unit, integration, checks) |
|---|---|---|
| TD | T8R.6 `c4585d5e`, T8R.6-F1 `665baf34`, T8R.6-B1 evidence `d87d1da8` | 2066, 258, 14 of 14 (`T8R.6-rebased-*`) |
| BA | T8R.19 `ce6d4c88`, T8R.19-F1 `e1ae8adc` | 2070, 258, 14 of 14 (`T8R.19-rebased-*`) |
| JF | T8R.15-F2 `5b653d2d` | 2070, 258, 14 of 14 (`T8R.15-F2-rebased-*`) |
| JR | T8R.16 `9170efb5` | 2072, 258, 14 of 14 (`T8R.16-rebased-*`) |
| PO | T8R.5 `fc58e8ca`, T8R.5-B1 `ff8f7f72` | 2078, 258, 14 of 14 (`T8R.5-rebased-*`) |
| BV | T8R.23 `7d5d1543` | 2080, 258, 14 of 14 (`T8R.23-rebased-*`) |
| PR | T8R.10 `ff4b2d79`, F1 `e69bf95e`, B1 `a80d5663`, B2 `992e5792`, F2 `2d901dfe`, F1-B1 `db0ecf20` | 2086, 258, 14 of 14 (`T8R.10-rebased-*`) |

**Lane PR's code conflict.** `src/ui/screens/TradeDetail.test.tsx` conflicted at T8R.10's commit. T8R.6 had replaced the "Risk to stop", "Reward to target" and Expected Mark Date lines with W29's check that "Expected Mark Date", "Mark", "Source" and "Saved" appear nowhere. T8R.10 had replaced the Risk to stop lines with "Risk or reward" in Plan and Risk, but still expected the Expected Mark Date in Today. The main session kept T8R.10's "Risk or reward" line and T8R.6's four-term check, which is the merged state both tasks describe. `new-words.md` conflicted too, and both sides' rows were kept. The rerun lane tier above passed on the resolution.

**Pending in the same batch.** Lane RA (T8R.14, T8R.14-B1, and T8R.14-F1 to come) must merge before the next merge run. With T8R.10 merged, `e2e/d4/breach-overrun.spec.ts:42` matches two elements, and `e2e/d8p/cockpit.spec.ts:116` lacks the "Conditions" heading. T8R.14-F1 fixes both, along with the specs that T8R.14's rail change leaves stale.

## ocr reviews: T8R.16, T8R.5-B1, T8R.10-B1/B2/F2, T8R.10-F1-B1, T8R.14, T8R.14-B1, T8R.23

All reviews ran on gpt-6.1-sol. Several first runs hit the usage limit, waited until about 03:50 to 03:59, and the reports come from the complete reruns.

| Commit | Session | Files reviewed, comments | Raw output | Result |
|---|---|---|---|---|
| T8R.16 `86cdd686` | 3e527d81 | 3, 0 | `ocr/T8R.16-86cdd686.json` | No findings |
| T8R.5-B1 `f7a99f6e` | 349f0c18 | 1, 0 | `ocr/T8R.5-B1-f7a99f6e.json` | No findings |
| T8R.10-B1, B2, F2 (`ccc698f1..e6b9be9b`) | 2ef0b40a | 3, 0 | `ocr/T8R.10-B1-B2-F2-e6b9be9b.json` | No findings |
| T8R.10-F1-B1 `af8fa64f` | 23963e16 | 1, 0 | `ocr/T8R.10-F1-B1-af8fa64f.json` | No findings |
| T8R.14 `51b50abc` | 5b8f0079 | 8, 1 | `ocr/T8R.14-51b50abc.json` | 1 finding, below |
| T8R.14-B1 `0ef232cd` | 75f4ae64 | 2, 0 | `ocr/T8R.14-B1-0ef232cd.json` | No findings |
| T8R.23 `dbe5ae08` | d743c54b | 3, 0 | `ocr/T8R.23-dbe5ae08.json` | No findings |

**T8R.14's finding** (low, bug, `src/ui/cockpit/rail/conditions.tsx:32`): the list of notes beneath the conditions kept `aria-label="Worst case and Max reward"`, though it now holds only the notes. **Valid.** It became **T8R.14-B1**, which renamed the list "Conditions notes" (a new word) and added a case on a Planned Detail. The note-states case now queries the new name.

T8R.14 reviewer note, answering the main session's question: removing `conditionsProps`'s `timeZone` loses nothing. The only zone-dependent text was Worst case and Max reward's `dollarsAndR`, now gone. The remaining reasons come from `unavailableLabel`, which names no contract.

T8R.16 reviewer notes: `flushSync` in the click handler is sound. An effect keyed on the page would need a "the press asked for focus" flag, because "Reflect now" also changes the page. Separately, the Earlier handler in `journal-cards.tsx` ends with stray spaces and `}}>` on one line. That is formatting only, and is not a bug task (only ocr's own findings are).

T8R.10-B1, B2 and F2 reviewer notes: B1's settlement test matches the rail's and `notesOf`'s. B2 keeps the three outcomes. F2 matches W31's cells. ADR 0001 holds.

## T8R.23 stop, and the main session's decision

T8R.23's agent built both cases. Case 2 passed on its first run, and its mutation check is recorded. The agent stopped before committing, because one exact expectation broke: `trade-summary.test.ts:153-154` lists the Open Detail's exact keys. The main session's implementation-level decision is to add `'openAverage'` at its sorted place. The comparison stays exact, the field is additive (A245), and T8R.21 did the same for `marksColumns`. A fresh agent applied it and committed. This goes in the final report. Note for T8R.8: `openAverage` is absent on an Open Detail with no open lots.

## T8R.11

Behavioral task; its rows are in `tdd-log/T8R.11.md`. Plan and Risk now ends with Planned-Leg Fulfillment and, only when a Deviation is recorded, Deviations (the heading is exactly "Deviations", for T8R.17's drawer request). The footer is gone: `src/ui/cockpit/footer.{props.ts,tsx,types.ts}`, `footer.test.tsx` and `trade-detail/Footer.test.tsx` were deleted, and `Cockpit.tsx` lost the `<DetailFooter>` line and its import.

Retired by name: T8P.18's case 3 ("should show Planned-Leg Fulfillment and Deviations below the drawers", in `footer.test.tsx`) and `Footer.test.tsx`'s cases: "should show Planned-Leg Fulfillment and each Entry Size Deviation with its quantity and causing Position Change", "should show Planned-Leg Fulfillment as a label/value row with the leg as label and the result as value", "should show an Active Deviation as plain text with no status badge", "should strike through a Superseded Deviation and name it Superseded for assistive technology", "should word an option Entry Size Deviation and the Planned Leg in contracts on Trade Detail". Their words live on in the four new cases. `Banner.test.tsx:133` needed no change (it asserts those regions are absent on an incoherent Detail, still true).

Browser specs changed (run after `npm run build:faults` and `npm run build:releases`, through `with-browser-lock.sh`):
- `e2e/d4/breach-overrun.spec.ts:29`: before `toContainText('No Deviations recorded.')`, after `toHaveCount(0)` (no Deviations group when none). Passes. The same spec's test B4.14 then fails at line 43, `riskFigure(page, 'Worst case')` matching the rail card and Plan and Risk's notes: the known T8R.10-F1 finding, not this task's (the rail's Worst case goes with T8R.14).
- `e2e/support/detail/plan.ts`: comments only; `fulfillment` and `deviations` helpers unchanged (`deviations` now matches nothing when none are recorded).
- `e2e/d2/ui-alignment.spec.ts` T2.64: before, it checked left edges and that Fulfillment's right edge was no further right than the drawer's values (a 480 px column). After, Fulfillment sits in the same figure grid as the drawer's other values, so the test again requires its value's right edge to equal one of the drawer's value right edges (within 1 px), plus the left-edge check; the row-width cap went. Passes.
- `open-position`, `d2/responsive-a11y` read `detail.deviations` and `detail.fulfillment` after opening Plan and Risk and passed unchanged.

Not touched: `src/ui/cockpit/styles/legacy-detail.css` `dl.figure-grid.one-column` is now unused (not a lane PR file; left). `Cockpit.tsx:19`'s comment still says "and the footer".

## T8R.11 ocr review, and the lane PR merge

ocr ran on `5d46301f`: session 918c4936-19d1-4d29-a315-088fde9680e5, gpt-6.1-sol, 9 files reviewed, 0 comments, raw output in `ocr/T8R.11-5d46301f.json`. **No findings.**

Merge: `d08r/pr` was rebased onto `e5c91f2a`, which upstream only changed in the plan, so the lane tier was not rerun. T8R.11 is now `d8682e62`. The lane worktree and branch were removed.

T8R.11 notes:
- The footer is deleted. Planned-Leg Fulfillment and Deviations are Plan and Risk's last two groups. Deviations is omitted when none is recorded, and "No Deviations recorded." is gone.
- `PlanRiskGroup.items?` was added.
- The Deviations heading is exactly "Deviations", ready for T8R.17's drawer request.
- Retired: T8P.18's case 3 and `Footer.test.tsx`'s five cases.
- T2.64's exact right-edge match is restored, and its 480 px cap is gone.
- `breach-overrun.spec.ts:29` now has an absence check for Deviations.
- **Coding ahead of red:** the agent first wrote the code for cases 1, 2 and 3 together. It noticed, removed the omit-when-empty condition and the struck-through markup, ran cases 2 and 3 to a genuine red, then restored the code. This is recorded in its tdd-log and listed for the final report.
- **Left as orphans outside the lane:**
  - `dl.figure-grid.one-column` in `src/ui/cockpit/styles/legacy-detail.css` is now unused.
  - The comment at `Cockpit.tsx:19` still says "and the footer".
  
  Both are listed for the final report as small cleanups.

## T8R.14-F1 and T8R.7 returned; follow-up T8R.5-F1

**T8R.14-F1** (`9c82340c`, lane RA, test-only) brings the rail and Plan and Risk specs up to date. One choice in it was checked against the plan: during Awaiting close, the specs now expect the last Marks' dated figures ("… · Mon Oct 12 Mark") where they used to expect "Awaiting close". A231 supports this: each condition row whose current reading is unavailable shows its dated distance. W31 gives the same for Plan and Risk.

The agent also fixed `d4/expected-mark.spec.ts:35`, which now shows the dated distance, and `cockpit.spec.ts`'s Today heading "marks" (from T8R.6). With the old name, two `toHaveCount(0)` checks in `states.spec.ts` passed without testing anything; they now find the renamed list.

One browser spec still fails outside its files: `e2e/d7/responsive-a11y.spec.ts:163` (B7.13). At 1280 px the Position drawer has 5 columns and scrolls, and "Unconsumed opening fee" and "$0.65" are cut off. The suspect is T8R.5's Instrument column. **T8R.5-F1** (lane PO, from `e5c91f2a`) pins it with one targeted run and fixes the layout so the five columns fit without a scroll. The column count changes from 4 to 5.

**T8R.7** (`932587cb`, lane TD) returned all five cases red then green, with no first-run pass. It removes `CurrentMarksOnly`, `currentMarksProps`, the `CurrentMarks` type and Cockpit's `settlementDue` local. `states.spec.ts` checks `toBeVisible` again.

It edited one case outside its lane: `Cockpit.test.tsx`'s "should show the Settlement Due current Marks in Today, not in Position" asserted the card T8R.7 removed. It now reads "should show no current Marks card in Today or in Position on a Settlement Due Detail". The main session accepts this as cleanup of the task's own change.

It added new words (rows in `new-words.md`): a Closed Today column heading over empty cells, and the "Closed" stamp drawn as a bordered tag.

T8R.14-F1 ocr review: on `9c82340c`, session 8b44f72c-96e1-42c6-9b63-b62451ddae0c, gpt-6.1-sol, 8 files reviewed, 0 comments. Raw output: `ocr/T8R.14-F1-9c82340c.json`. **No findings.** Lane RA (T8R.14, B1, F1) can merge.

## T8R.14

Behavioral task; its red and green rows are in `tdd-log/T8R.14.md`. The rail's Conditions card now shows each condition's distance from `trigger` (W21): "Stop · $2.20 away", "Target · 2.10 away", "Breached · $0.10 past", and a dated "· Mon Oct 12 Marks" form. The `nearest` badge, the "Change in Trade P&L" sentence, Worst case and Max reward are gone from the card. The card's `ConditionItem` lost `nearest` and `why`; the summary lost its `label`; `conditionsProps` no longer takes a time zone.

Browser spec run: `e2e/d8p/cockpit.spec.ts` passes.

Outside this task's files, still reading what the rail no longer shows (not edited):
- `e2e/d4/breach-overrun.spec.ts:24` (`.condition-why`), `:42` (`riskFigure(page, 'Worst case')`)
- `e2e/d4/responsive-a11y.spec.ts:169` (`riskFigure(page, 'Max reward')`)
- `e2e/d7s/conditions.spec.ts:52-55` (old figures `−$70.00`, `+$670.00`, `Breached`, `Reached` via `toContainText`) and `:56` (`conditionsSummary` Worst case, Max reward)
- `e2e/support/detail/rail-b.ts` `riskFigure`'s Worst case and Max reward branch reads the rail's summary (the Plan and Risk helpers in that file belong to T8R.10-F1)
- `e2e/d8p/states.spec.ts:55,114` and `e2e/d4/expected-mark.spec.ts:35` read `.condition-why` and `.condition-figure` as absent or as "Mark missing": still true.

## T8R.14-B1

Behavioral bug task; its red and green rows are in `tdd-log/T8R.14-B1.md`. The Conditions card's list of notes (the before-Marks, Planned and expired notes) is now named "Conditions notes" instead of "Worst case and Max reward", which left the rail in T8R.14.

The older case "should say beneath the conditions when their distances arrive..." now queries the new name. This is not a loosening: it still expects exactly the three notes where they apply and an empty result on a Closed Detail, so it still proves the list is absent where it should be. Querying the old name would have passed vacuously everywhere after the rename.

Left alone, for T8R.14-F1 after T8R.10 merges: `e2e/support/detail/rail-b.ts` `conditionsSummary` (line 20) still finds the list by the old name, and the browser specs that use it.

## T8R.14-F1

Test-only follow-up (lane RA). No product code. Browser specs and `rail-b.ts` follow T8R.14's rail and T8R.10's Plan and Risk. Reds were run at head `85bbb4c1` with the old `rail-b.ts` (stashed) before the spec edits.

- `rail-b.ts`: `riskFigure`'s Worst case and Max reward now read a new `planRiskNotes` (the "Worst case and Max reward" list in `#drawer-panel-plan-and-risk`); early-return form kept. `conditionsSummary` is now `conditionsNotes`, finding the rail's list named "Conditions notes". Callers renamed in `d8p/states.spec.ts` and `d7/settlement-due.spec.ts`.
- `d8p/cockpit.spec.ts`: red `Plan and Risk cards ... + "conditions"`; HEADINGS gets "conditions"; lines 144-145 then run and pass. Two more stale lines surfaced: Today's heading is now "marks" (was "marks: thu oct 15 against wed oct 14"), and the accepted repeats gain `h2: conditions` (rail card W5 and Plan and Risk group W31).
- `d4/breach-overrun.spec.ts`: red `Expected "Breached" / Received "Breached · $0.50 past"`; now asserts it, `.condition-why` count 0, Target `^$x away$`, Worst case `$4,700.00 · 18.80R if XYZ goes to zero · Mon Oct 12 Mark` (W31 dated), and the rail's Stop and Target figures `... · Mon Oct 12 Mark` (W21, A231).
- `d4/responsive-a11y.spec.ts`: Max reward read after opening Plan and Risk; Today reopened before the axe pass so what it audits is unchanged.
- `d7s/conditions.spec.ts`: red `Expected substring "−$70.00" / Received "Stop · 3.60 away..."`; now `3.60 away`, `Breached · $0.05 past`, `Reached · 0.10 past`, `$3.35 away` on `.condition-figure`, an absence check on `conditionsNotes`, and Worst case and Max reward read from Plan and Risk.
- `d4/expected-mark.spec.ts:35`: red `Expected "Mark missing" / Received "$3.70 away · Fri Oct 9 Mark"`; the earlier note that this line was still true was wrong; now expects the dated distances (A231).
- Not fixed, not in this lane: `e2e/d7/responsive-a11y.spec.ts:186` (Open Lots shows a fifth column "Unconsumed opening fee", cut off, `scrolls: true` at 1280 px). A Position drawer layout, untouched by T8R.14 or this task.

## Merge: lane RA (T8R.14, T8R.14-B1, T8R.14-F1)

`d08r/ra` was rebased onto `70cbef94`, which brought in T8R.11's code. That gave:
- T8R.14 `9a116056`
- T8R.14-B1 `8a44e36c`
- T8R.14-F1 `703452dd`

`breach-overrun.spec.ts` took T8R.11's line 29 and F1's lines 24 and 42 without a conflict. The lane tier was rerun (`T8R.14-rebased-*`): unit 2083, integration 258, 14 of 14. Fast-forwarded to `60fd04f6`, and the lane was removed.

With this merge, `breach-overrun.spec.ts:42` (two Worst case matches), `cockpit.spec.ts:116` (the "conditions" heading) and `cockpit.spec.ts:37` (Today's "marks" heading, as reported by T8R.5-F1) are fixed on the deliverable branch.

## Decision P1 answered; T8R.7-B1

T8R.7's ocr review was session 79ac0ad5-ff53-421a-bbcf-3224c150373f, gpt-6.1-sol, 10 files reviewed, 2 comments, raw output in `ocr/T8R.7-932587cb.json`. It raised two findings:
1. **Medium, bug, Valid:** `today.props.ts:136` dated a Closed Trade's Exit column by the replay's last session. A Trade sold out before today's close then read "Exit <yesterday>". This follows A235 as written, so it was put to the user as decision P1 (`DECISIONS-PENDING.md`). **Answer: date the column by the exit session.** It becomes **T8R.7-B1**: Trade Views gives the Closed Detail the exit session's trading date (additive, A245), the adapter heads the column with it, and the Underlying's cell shows "—" until that session's Marks exist.
2. **Low, maintainability, Valid:** a nested ternary in the `yesterday` cell. This became **T8R.7-B2**, committed as `493ee2f6`, a structural change: an `exitCell` function with early returns and the same outcomes (32 of 32 tests before and after; lane tier 2090, 258, 14 of 14).

Reviewer notes, ADR 0001: `expiredOn` comes from `domain/instrument`, which is the route `eslint.deps.config.js` prescribes. The exit price is a selection of the last Execution, which A235 calls selection, not arithmetic.

## Returns: T8R.12, T8R.17, T8R.5-F1

**T8R.12** is committed as `ed21a477` (lane PR). It has 2 cases, red then green, with no first-run pass. All four figures come from existing `evaluation.atEntry` fields. The group sits after Conditions and is hidden while `firstMarksDue` is set. Its new words are in `new-words.md`.

On the group's place, B8R.4 reads "W23, W31 and W32 groups in order". The main session reads that literally: Since the last Marks (W23) comes before Conditions (W31, W32), and T8R.27's browser case will check that order. Follow-up **T8R.12-F1** moves the group. This is an implementation-level reading of the plan and goes in the final report.

**T8R.17** (lane JR, uncommitted) is built. Its 3 cases are red then green; case 3 passed on its first run, and a mutation check is recorded. The count follows A240 in `journal.props.ts`. An earlier agent had stopped because the main session's first brief wrongly forbade counting in the UI; that was a brief error, since A240 settles it.

The build now fails `lint:deps` with a cycle: `journal-cards.tsx` imports `useDrawerRequest` from `Cockpit.tsx`, which imports `JournalCards`. The main session's decision is to move `DrawerRequest`, `DrawerRequestContext` and `useDrawerRequest` (`Cockpit.tsx` lines 26 to 28) into `src/ui/screens/trade-detail/drawer-request.ts`. Cockpit re-exports the hook, so existing imports keep working. A fresh agent finishes T8R.17 with that grant.

**T8R.5-F1** is committed as `8449ed9f` (lane PO). Pinned: B7.13 passes at `fc58e8ca^` and fails at `fc58e8ca`. The fix is in `position.css` only:
- `min-width: 0` on Open Lots' second column, which `table.trades` gave an 11.5rem minimum;
- the Instrument cell wraps from 960 px;
- Lot Matches' wrap rule now covers Instrument as well.

At 1280 px the table is 550 px wide inside a 550 px region, with no scroll. That is an exact fit, so any wider column brings the scroll back; listed for the final report. B7.13's column count goes from 4 to 5. `lot-matches-fit.spec.ts` broke on the first fix and passes on the second. 66 layout specs pass.

## ocr: T8R.7-B2 and T8R.5-F1

| Task | Commit | Session | Files | Comments | Raw output |
|---|---|---|---|---|---|
| T8R.7-B2 | `493ee2f6` | a4ad8f09-aef4-49ad-9983-4bc9f60db2f6 | 1 (5 excluded) | 0 | `ocr/T8R.7-B2-493ee2f6.json` |
| T8R.5-F1 | `8449ed9f` | dbb2b598-170f-43f1-992c-66a8853a297c | 2 (6 excluded) | 0 | `ocr/T8R.5-F1-8449ed9f.json` |

Neither review raised a finding, so neither creates a bug task.

**T8R.7-B2, reviewer note:** `exitCell` checks the same conditions in the same order as the old ternary.

**T8R.5-F1, reviewer notes.** None of these are ocr findings, so none becomes a bug task (decision 114). All go to the final report.
- **The exact fit.** "550 = 550" is the table stretched by `width: 100%`. The real margin is the sum of the columns' smallest widths, which is not recorded.
- **What absorbs a squeeze.** The Instrument cell can shrink because `table.trades td:first-child` sets `overflow-wrap: anywhere`. The nowrap figure columns can't: a five-digit Price, a large Quantity or a large fee could bring the scroll back, and B7.13's `$0.65`-sized figures cannot catch that.
- **Sturdier options the reviewer named:**
  - a B7.13 variant with wide figures;
  - scoping `app.css`'s 11.5rem minimum to `table.trades:not(.lots)` instead of overriding it in `position.css`;
  - letting Opened wrap from 960 px.

  Each would touch files or specs outside lane PO's scope. Recorded as tech debt for the final report; not acted on.

**Lane PO's merge** waits for merge run 2 (`wave1-merge2`, on `bf3218f1`) to finish, so that the run tests one fixed head.

## ocr: T8R.12 and T8R.12-F1

- **Range:** `70cbef94..6c58bd33`.
- **Session:** 2f955e69-b1fd-41d9-b723-2c08c9a6c662.
- **Files reviewed:** 2 (`plan-risk.props.ts`, `plan-risk.test.tsx`); 12 excluded.
- **Result:** 0 comments, so there is no bug task.
- **Raw output:** `ocr/T8R.12-F1-6c58bd33.json`.

Lane PR's merge waits for merge run 2 (`wave1-merge2`, on `bf3218f1`) to finish.

## ocr: T8R.17 and T8R.7-B1

| Task | Commit | Session | Files | Comments | Raw output |
|---|---|---|---|---|---|
| T8R.17 | `5c077545` | ba66fd8a-f8de-467d-a98c-bdbda537eca1 | 7 | 1 | `ocr/T8R.17-5c077545.json` |
| T8R.7-B1 | `0ab30648` | 637d3cc4-cefb-406b-b568-5e2d9092d162 | 4 (6 excluded) | 0 | `ocr/T8R.7-B1-0ab30648.json` |

### T8R.17: one finding, which becomes T8R.17-B1

- **Severity:** medium. **Category:** bug. **Verdict:** Valid.
- **Location:** `journal.props.ts:98`.
- **Finding:** on an incoherent Detail, the Journal shows the active-Deviation line and its "See Plan and Risk" button. Plan and Risk shows no Deviations heading for that state (`plan-risk.props.ts:165-166`, which builds its groups only when `'positionChanges' in view`). So the button selects the drawer, but focus cannot move to the heading.
- **Becomes:** bug task **T8R.17-B1**.

### T8R.7-B1: no findings

The reviewer's notes, which are not ocr findings:
- **An exit between 16:00 and 16:30** is dated today, as intended. No test covers that window.
- **An exit on a Saturday or Sunday** is dated the next Monday: "the session that holds the terminal time", which is how the Today column treats a weekend read. That follows decision P1's wording. Not acted on; it goes in the final report.
- **Reads:** one `openReadSession` per Closed Detail, with no stored read. The query count is unchanged.

## ocr: T8R.20

- **Commit:** `349c0898`.
- **Session:** a9304efe-5f1b-40c6-9979-d2b6041b8287.
- **Files reviewed:** 4.
- **Excluded:** 10, which are the five fixture `expected-views.json` files (by request) and evidence.
- **Comments:** 0, so there is no bug task.
- **Raw output:** `ocr/T8R.20-349c0898.json`.

The main session checked the fixture diff separately with `git diff -U0 bf3218f1 349c0898 -- tests/fixtures`. It holds only 90 `-"nearest": true`, 90 `-},` and 90 `+}` lines, and nothing else (P111).

## ocr: T8R.17-B1

- Commit `bf818480`.
- Session cbeb3384-20ea-4afb-a233-80ca9ded0d5b.
- 2 files reviewed, 6 excluded.
- 0 comments, so there is no bug task.
- Raw output: `ocr/T8R.17-B1-bf818480.json`.

Lane JR is ready to merge after merge run 2.

## Merge run: wave1-merge2 (on `bf3218f1`)

- **Browser tier:** full (`browser-auto db0352e9`).
- **Results:**
  - unit: 2083 passed
  - integration: 258 passed
  - checks: 14 of 14 exit 0
  - browser-1: 126 passed
  - browser-2: 116 passed, 5 failed
- `run-complete.sh` confirms the run is complete.
- **Timing:** browser-2 took 8.1 minutes, over the 8-minute mark, so the runner suggests adding a browser-3 stage. This is a tooling note for the final report and is not acted on in D8R.

### Failures

**Position drawer at 1280 px (4 specs).** These are B6.12 (`d6/responsive-a11y.spec.ts:293`), B7.13 (`d7/responsive-a11y.spec.ts:163`) and both cases in `d8p/lot-matches-fit.spec.ts` (lines 55 and 75). All four are the Instrument column that T8R.5 added. T8R.5-F1 already traced the cause to T8R.5 (`fc58e8ca`) and fixed it in lane PO (`8449ed9f`); its own browser runs passed `d6/responsive-a11y`, `d7/responsive-a11y` and `lot-matches-fit`. No new task: lane PO merges, and the next merge run confirms the fix.

**`d8p/cockpit.spec.ts:37` (B8P.1).** Plan and Risk's headings on O-C3 now end with "planned-leg fulfillment", which the spec's `HEADINGS` does not list. The spec passed in wave1-merge1 on `db0352e9`. To be traced to a commit with one targeted run after this batch of lanes merges, then fixed in a fresh task (bug task T8R.10-F3 or similar, named after the commit the trace finds), failing spec first.

## T8R.5-F1

B7.13 passed at `fc58e8ca^` and failed first at `fc58e8ca` (T8R.5's Instrument column): Open Lots scrolled and cut "Unconsumed opening fee" and "$0.65". Fix in `position.css`: Open Lots' second column (Opened) loses the 11.5rem minimum `table.trades` gives its Trade column, and Instrument cells wrap at their spaces from 960 px; Lot Matches' Instrument cell wraps with Bought and Sold from 960 px. The expected Open Lots column count moves from 4 to 5. Region 550 px; table 566 px before, 550 px after. Detail in `tdd-log/T8R.5-F1.md`.

## T8R.12

Behavioral, 2 cases; rows in `tdd-log/T8R.12.md`. The group "Since the last Marks" reads `evaluation.atEntry` (quantity, averageEntry, riskFromEntry, rewardFromEntry and their Plan R figures), all existing Trade Analysis fields, so nothing is calculated in the UI. It is hidden when `current.firstMarksDue` is set (before the first Marks), and on a Closed Trade. It sits after Conditions and before Plan Baseline, Entry Quality and Planned-Leg Fulfillment; W23 and the plan name no place, so this is the recorded choice. The first case went red, green; the second went red, green after the first case's code showed the group before the first Marks, so no first-run pass. No browser heading list needed the new group: only O-C3+ style Trades with lots newer than the Marks show it, and the grep of `e2e` for Plan and Risk headings found none that list the group order.

## T8R.12-F1

Since the last Marks (W23) moved to sit immediately before Conditions (W31, W32), after the Plan group, following browser row B8R.4 ("W23, W31 and W32 groups in order; Deviations last"). Only `planRiskProps` changed order; every other group keeps its place. Case 1 of T8R.12 went red (Conditions came first), then green. `grep -rn "Since the last\|since-last" e2e` finds nothing, so no browser spec reads the group's place (`e2e/d8p/cockpit.spec.ts` HEADINGS reads O-C3 without new lots). The T8R.12 place row in `new-words.md` was updated.

## T8R.7 Today on Settlement Due and Closed Trades

Behavioral task, five cases in `src/ui/cockpit/drawers/today.props.test.ts` ("Today drawer: Settlement Due and Closed"); rows in `tdd-log/T8R.7.md`.

- `e2e/d8p/states.spec.ts`: `expectDrawers` checks `toBeVisible` again (T8R.2 had relaxed it to "not hidden" until a Closed Today had content), and two blocks of assertions were added: the Settlement Due Today table ("Expired", named "Expired Fri Nov 20") and the Closed Today ("Closed" stamp, empty Today cell, "Expired Fri Nov 20" heading). Run: `npx playwright test e2e/d8p/states.spec.ts` after `npm run build:faults` and `npm run build:releases`: 3 passed.
- `CurrentMarksOnly`, `CurrentMarksCard`, `currentMarksOf`, `currentMarksProps`, the `CurrentMarks` type, Cockpit's `settlementDue` local and the e2e helpers `valuation` and `todayFigure` are removed (orphaned).
- Retired tests: Placed.test.tsx "should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark"; Placed.test.tsx "should show only the current Marks card in the Today drawer on a Settlement Due Detail" became "should show no current Marks card, price track or At entry in the Today drawer on a Settlement Due Detail"; Cockpit.test.tsx "should show the Settlement Due current Marks in Today, not in Position" became "should show no current Marks card in Today or in Position on a Settlement Due Detail" (a file outside lane TD's list, one case, changed because the card it asserted is gone).

## T8R.7-B2

ocr finding (low, maintainability): the `yesterday` cell in `closedMarksOf` (`src/ui/cockpit/drawers/today.props.ts`) nested ternaries. It is now a small named function, `exitCell`, with early returns: "Expired" by expiration, the Underlying's Mark at the exit session, otherwise the final exit Execution's price. Outcomes are unchanged.

- Before: `npx vitest run src/ui/cockpit/drawers/today.props.test.ts src/ui/screens/trade-detail/Today.test.tsx src/ui/screens/trade-detail/SettlementDue.test.tsx src/ui/screens/trade-detail/Placed.test.tsx` gave 4 files, 32 passed.
- After: the same command gave 4 files, 32 passed.
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.

## T8R.7-B1

ocr finding (medium, Valid; decision P1): a Closed Trade's second Today column was dated by the replay's last session, so a Trade sold out in a session that has not closed read "Exit <previous session>" with today's sale price. The Closed Detail now carries `exitSessionDate` (an optional string, additive per A245): the trading date of the session that holds the final exit, or the expiration session. Trade Views reads it as the Today column's date of a read opened at the terminal time (`marksColumnsOf(await openSession(terminalTime))`, calendar only, no stored read); it is absent outside session-policy coverage. The Today adapter heads the column "Exit <date>" or "Expired <date>" from it, and the Underlying's cell is the replay's Mark at that session, or a dash while the replay has not reached it. The exit price of the option or stock is unchanged.

- Expectations that gained the field: `src/ui/cockpit/drawers/today.props.test.ts`, the two existing Closed views in "Settlement Due and Closed" (the by-sale view, `exitSessionDate: '2026-11-13'`, and the by-expiration view, `'2026-11-20'`), compared exactly. No Trade Views expectation compares a whole Closed Detail with `toEqual`, so none changed.

## T8R.20 Remove `nearest` (lane BA)

Before: `grep -rn nearest src tests e2e` had 27 non-fixture hits (the field and `nearestOf` in `evaluate.ts`, T8P.6's four cases in `evaluate.test.ts`, `nearest: true` in `current-evaluation.test.ts` and `tests/integration/d8p/detail.test.ts`, plus unrelated words such as `nearest` in `plan.ts`, `derive.ts`, `PayoffView.tsx` and comments) and 90 `"nearest": true` fixture lines (18 in each of the five backup fixtures). `npm run typecheck` and `npm run verify:fixtures` passed.

Removed: the `nearest?: true` field, `nearestOf`, `nearestConditions` and `conditionsWithNearest` in `evaluate.ts`. Retired, in `evaluate.test.ts`: "should mark O-S2's option-price Stop and its MNO Target as nearest on Tuesday, and no other condition"; "should mark no Stop as nearest on Wednesday, when the option-price Stop is Breached and the headline is zero"; "should mark no condition of a role as nearest when its headline is Unavailable"; "should mark the earlier in Plan order when two conditions of a role are equally near" (with the helper `nearestIds`). Also removed: the `nearest: true` line in `current-evaluation.test.ts` and the nearest assertion line in I8P.5 (`detail.test.ts`; the case stays, with its condition-id and expiration assertions).

Fixture diff check: `git diff --stat tests/fixtures` shows 5 files, 90 insertions, 180 deletions. `git diff -U0 tests/fixtures`, with indentation stripped and sorted, shows exactly 90 `-"nearest": true`, 90 `-},` and 90 `+}`, and nothing else. So 90 `"nearest": true` lines are deleted, each with the comma on the line before it.

After: `npm run typecheck` exit 0; `npx vitest run src/domain` 258 passed; `npm run verify:fixtures` OK (all seven workspaces and the backups, views equal); `npm run test:integration` passed. Remaining `nearest` hits are unrelated wording only (plan.ts and derive.ts condition-picking helpers and comments, PayoffView.tsx label placement, session-policy, entry tests, rail "no nearest" negative checks).

## T8R.17 Journal: the active Deviation line (lane JR)

**Count's place (A240).** `deviationsOf(view)` in `src/ui/cockpit/drawers/journal.props.ts` counts the Deviations whose last version has `status === 'Active'`. It is the same test `identity.props.ts:38` used before T8R.13. The line shows above the sessions, with a "See Plan and Risk" button that selects Plan and Risk and moves focus to its Deviations heading (W24).

**Drawer-request move (main-session decision to break an import cycle).** `journal-cards.tsx` needs `useDrawerRequest`, which lived in `Cockpit.tsx`, and `Cockpit.tsx` imports `journal-cards.tsx`; `npm run lint:deps` failed with `no-circular`. The main session decided to move `DrawerRequest`, `DrawerRequestContext` and `useDrawerRequest` into `src/ui/screens/trade-detail/drawer-request.ts`. A type-only import of `Drawer` from `Cockpit.tsx` still counted as a cycle, so `DRAWERS` and the `Drawer` type moved there too (one step beyond the stated lines, needed for the same fix). `Cockpit.tsx` imports them and still exports `useDrawerRequest` and `Drawer`, so `Cockpit.test.tsx` is unchanged. No behaviour change: Cockpit and Journal tests were 39 passed before the move and 39 passed after. `lint:deps` is clean afterwards.

**Case 3 first-run pass.** "should not show the line when no Deviation is active" passed on its first run (with no line built yet, absence passed trivially; once cases 1 and 2 built the line, the case guards the Active test). Its mutation check, counting every Deviation with a current version, failed the case; see `tdd-log/T8R.17.md`.

**Fallback list.** The fallback Journal list (`Composed.tsx`, shown without a replay) has no Deviation line; only the session cards do.

**Browser specs** (after `build:faults` and `build:releases`): `d8p/history.spec.ts`, `d8p/journal-final-session.spec.ts` and `d2/open-position.spec.ts` pass. `d4/breach-overrun.spec.ts` B4.14 fails at its Worst case check on Plan and Risk, before any Journal step. That spec is brought up to date by T8R.14-F1 in lane RA, which this lane's base does not contain (`9a116056` is not an ancestor); not caused by this task.

## T8R.17-B1

The Journal's active-Deviation line is hidden on an incoherent Detail. The plan (W24, A240, test list for T8R.17) says nothing about Deviations on an incoherent Detail, and Plan and Risk draws none there (`'positionChanges' in view` is false), so the line's button would lead nowhere. `deviationsOf` in `journal.props.ts` now also requires the Detail not to have `recordedPositionChanges`. Red then green in `tdd-log/T8R.17-B1.md`.

## T8R.11-F1

`e2e/d8p/cockpit.spec.ts` (B8P.1) listed Plan and Risk's cards without Planned-Leg Fulfillment. T8R.11 (`d8682e62`) made it the drawer's last group, and T8R.14-F1 edited the list from an older base. Fix: `'planned-leg fulfillment'` added to `HEADINGS['Plan and Risk']`. Plan text: `plan/D08R-trade-detail-refactor.md` line 10 and the kept-words row ("Deviations and Planned-Leg Fulfillment keep their words as Plan and Risk's last groups; Deviations is hidden when there are none"), and T8R.11's "gone" case, so a plain O-C3 shows no Deviations card. No other expectation changed: the label counts and accepted repeats passed unchanged.

Red: `npx playwright test e2e/d8p/cockpit.spec.ts` after `npm run build:faults` and `npm run build:releases`: `Plan and Risk cards ... + "planned-leg fulfillment"`. Green: same command, 1 passed. Whole `e2e/d8p` folder: 18 passed, 2 failed, both in `lot-matches-fit.spec.ts` (the Instrument column that T8R.5-F1 fixes in lane PO, not this task).

## ocr: T8R.11-F1

- Commit `6d3f6498`, session 078febd4-bd28-491b-ba30-b469d0734a52.
- 1 file reviewed (`e2e/d8p/cockpit.spec.ts`); 6 excluded.
- 0 comments, so there is no bug task.
- Raw output: `ocr/T8R.11-F1-6d3f6498.json`.

## Merges after wave1-merge2: lanes PO, PR, TD, BA, JR, FX

Each lane was rebased onto the head at the time. Upstream had changed code each lane does not own, so each got a lane-tier rerun (`<task>-rebased`) and then a fast-forward.

| Lane | Tasks | Rebased commits | Rerun (unit, integration, checks) |
|---|---|---|---|
| PO | T8R.5-F1 | `3e3e6862` | 2083, 258, 14 of 14 |
| PR | T8R.12, T8R.12-F1 | `27f3a0bf`, `01f728ff` | 2085, 258, 14 of 14 |
| TD | T8R.7, T8R.7-B2, T8R.7-B1 | `a28d05f9`, `e9834187`, `4cd6991a` | 2092, 258, 14 of 14 |
| BA | T8R.20 | `1474e144` | 2088, 258, 14 of 14 |
| JR | T8R.17, T8R.17-B1 | `f62cb546`, `708d67ea` | 2092, 258, 14 of 14 |
| FX | T8R.11-F1 | `9d873233` | 2092, 258, 14 of 14 |

**Conflicts.** Lanes PR and TD each had conflicts in `new-words.md` and `structural.md`. Both were resolved by hand:
- `new-words.md`: both sides' rows were kept.
- `structural.md`: ours was kept, and the lane's saved additions were appended.

There were no code conflicts. `Cockpit.tsx` merged on its own: lane TD's T8R.7 edits and lane JR's drawer-request move touch different lines.

**Lane state.** Lane TD stays open for T8R.8 (`e1c1ddc1`, ocr review running) and T8R.9 (in progress). Lanes PO, PR, BA, JR and FX are removed.

**T8R.17's B4.14 note.** T8R.17's own browser run failed `d4/breach-overrun.spec.ts` B4.14, because its base was older than T8R.14-F1's spec update. Merge run 3 runs it again on the merged head.

## T8R.8 returned

T8R.8 is committed as `e1c1ddc1` (lane TD). It has 3 cases, each red then green, and no first-run pass.

**Process slip, for the final report.** The tick code was written while case 1 was being made green, ahead of the red runs for cases 2 and 3. The agent then took genuine reds by temporarily rendering no ticks, and restored the code afterwards; the tdd-log notes it. The same kind of slip as T8R.11's.

**Data.** The entry dot reads `view.openAverage` (T8R.23). The ticks read `positions[].openLots` (selection), dated by each lot's opening Execution. `PriceTrackProps` gains a required `ticks`.

**New word.** The tick's name, "$3.30 · Fri Oct 16" (A237).

**Note for later fixtures.** The fixture builders in `tests/support` do not set `openAverage`.

## ocr: T8R.8

- **Commit:** `e1c1ddc1`
- **Session:** c201279a-4b7a-4326-a117-3144a34a5cf8
- **Files reviewed:** 7 (7 excluded)
- **Comments:** 1
- **Raw output:** `ocr/T8R.8-e1c1ddc1.json`

**Finding (medium, bug, Valid).** `track.tsx:18` makes each lot tick a `role="img"` span. The ticks sit inside the `.track` div, which is itself `role="img"`. ARIA treats the children of an `img` as presentational, so screen readers may not announce the ticks' names ("$3.30 · Fri Oct 16") that A237 asks for. The unit test reads `aria-label` from the DOM, so it passes without proving the name is exposed.

This becomes bug task **T8R.8-B1**. It runs in lane TD after T8R.9, which is already working in that worktree.

## Merge run: wave1-merge3 (on `a17e6f89`)

The full browser tier ran (`browser-auto bf3218f1`). `run-complete.sh` confirms the run is complete.

| Suite | Result |
|---|---|
| Unit | 2092 passed |
| Integration | 258 passed |
| Checks | 14 of 14 exit 0 |
| Browser 1 | 126 passed (5.2 min) |
| Browser 2 | 121 passed (7.8 min) |

wave1-merge2's 5 failures now pass:
- B6.12
- B7.13
- both `lot-matches-fit` cases
- B8P.1

They were fixed by T8R.5-F1 and T8R.11-F1. T8R.17's B4.14 note is closed: `d4/breach-overrun` passes on the merged head. The tech debt item 11 flake did not occur.

## T8R.9 returned; ocr

T8R.9 is committed as `c0905d18` in lane TD. It has 3 cases, each red then green. Case 2 first logged a skipped run as exit 0, because the quotes in the `-t` filter stopped it matching. That run is flagged as an invalid red, and a genuine red was then taken. There were no first-run passes.

**Retired:**
- T8P.16's case 5 and case 4
- the "figures moved (T8P.27)" describe, which held 3 cases
- `Today.test.tsx`, which held 2 cases

**Changed browser lines:**
- `d4/breach-overrun`, `d4/expected-mark` and `d4/responsive-a11y`: each removed figure is now an absence check
- `d7s/entry-beyond-stop`: the "Risk from entry" line is dropped

All 21 Today specs passed.

**Coverage gap.** No browser spec now reads Plan and Risk's "Risk from that price". It is covered only by `plan-risk.test.tsx` until T8R.27's B8R.4 (`plan-risk.spec.ts`, "W23, W31 and W32 groups in order"). That case should check the W23 figures. This goes into T8R.27's brief.

**Orphans in files T8R.9 does not own:** `ConditionReading.underlying` and `trigger` are no longer read by Today, as A230 says. Removing `underlying` waits for the next fixture refreeze; listed for the final report.

**ocr:** session 06f4f8a9-e600-4441-8133-d07f15a51354, 14 files reviewed, 0 comments, raw output in `ocr/T8R.9-c0905d18.json`. The reviewer checked by hand that no dead code remains and that the absence checks use the same region lookup that would have matched the old cards.

## T8R.8

The price track's entry dot is the view's `openAverage` (A236), no longer Entry Quality's average entry. Each open lot gets a tick (`PriceTrackProps.ticks`, a required `{ label, price }` list; label "$3.30 · Fri Oct 16", A237) drawn as a `.tick` span with that accessible name and hover text, on the option price track (or the stock's track), not on the Underlying's track of an option Trade. The range includes the ticks' prices. The Today adapter reads lots from `positions[].openLots` and their dates from the recorded executions.

- Existing expectations that gained the field: `today.props.test.ts` (the O-S2 views gained `openAverage: 1.25`), `track.test.tsx` and `today.test.tsx` (`ticks: []`).
- No browser spec reads the track's entry dot or ticks (grep of `e2e` for `.mk`, `.track`, `.dot`, `data-kind` finds none), so no browser line changed.

## T8R.9

Today drops At entry, the dated "At the <date> Marks" card and the Underlying condition lines under its track (items 4, 5, 7). Each figure's home is Plan and Risk (T8R.10, T8R.12), the rail's dated line (T8R.13) and its Conditions card (T8R.14).

Retired unit expectations (the replacement is the three cases in "Today drawer: one place for each figure"):

- `src/ui/cockpit/drawers/today.props.test.ts`, T8P.16's case 5 "should show At the Mon Oct 12 Marks and At entry in their existing figures" (was about line 128). New homes: Plan and Risk's "Since the last Marks" group (T8R.12, `plan-risk.test.tsx`) and the rail's dated line (T8R.13).
- `today.props.test.ts`, T8P.16's case 4 "should list each Underlying condition's value at expiration and distance on the Underlying under its track" (was about line 157; A223 reversed). New homes: Plan and Risk's Conditions rows (T8R.10) and the rail's Conditions card (T8R.14).
- `today.props.test.ts`, the whole describe "figures moved from the retired Valuation section and conditions table (T8P.27)" (was about lines 217 to 279): the dated card with its signed Realized to date (T8R.13), the Long Call and O-S2 Stop and Target value at expiration and distance (T8R.10, T8R.14), and the unavailable condition result worded at figure length (T8R.10, T8R.14).
- `src/ui/screens/trade-detail/Today.test.tsx`, deleted with both its cases: the stock At entry section and the option contract-count At entry (T8R.12, "Since the last Marks").
- `Placed.test.tsx` (the Settlement Due case's negative assertions on tracks, condition lines and At entry) stays: it asserts absence, which still holds. `SettlementDue.test.tsx` held no removed figure. The Position-drawer case named in the handoff was already retired by T8R.7.

Retired browser expectations:

- `e2e/d4/breach-overrun.spec.ts`: the dated figures (Mark, Open P&L, Risk to stop) and the At entry figures (Quantity, Average entry, Risk from entry, Reward from entry) on Today; now two absence checks and the Yesterday Mark. Homes: T8R.12, T8R.13.
- `e2e/d4/expected-mark.spec.ts`: the "At the Fri Oct 9 Marks" heading and its Mark figure; the heading is now an absence check. Home: T8R.13.
- `e2e/d4/responsive-a11y.spec.ts`: the dated and At entry headings and Quantity; now absence checks, and the accessibility scan label no longer names the cards.
- `e2e/d7s/entry-beyond-stop.spec.ts`: "Risk from entry $735.00 · 0.98R" on Today; the case keeps Actual initial risk in Plan and Risk. Its new home (Plan and Risk's "Risk from that price") is covered by `plan-risk.test.tsx` only; no browser line reads it any more.
- `e2e/support/detail/today.ts`: `dated`, `datedHeading`, `datedFigure`, `atEntryHeading`, `atEntryFigure` removed; `todayCard` added for the absence checks.

Removed code: `atEntryOf`, `valuedAtOf`, `conditionLineOf` (`today.props.ts`); `FigureCard` (`today.tsx`); `TodayDrawerProps.atEntry` and `.valuedAt`; `PriceTrackProps.conditionLines` and the track's Conditions list; the `.conds` rules in `styles/today.css`. `CurrentMarksCard` was already gone (T8R.7).

Orphans in files this lane does not own: none found. `ConditionReading.underlying` and `trigger` are now unread by Today, as A230 says; the `underlying` field's removal waits for the next fixture refreeze.

## T8R.8-B1

The price track's lot ticks are no longer inside the `role="img"` element. `.track` is now a plain positioned container holding a `.track-art` image (the track's accessible name, zones and markers) and the ticks as sibling named images, so ARIA no longer makes the ticks presentational. Testing Library does not model presentational children, so the case checks that no ancestor of a tick has `role="img"`; Playwright's `getByRole` does not model it either, so no browser case was added. `today.css` gained `.track-art` and z-index values that keep ticks under the markers. Browser: `e2e/d8p/responsive-a11y.spec.ts` and `e2e/d8p/today-narrow.spec.ts`, 4 passed.

## T8R.8-B1 and the lane TD merge: wave 1 complete

**T8R.8-B1** was committed as `f273ff78`.
- The ticks now sit beside a `.track-art` `role="img"` element, which carries the track's unchanged accessible name. They no longer sit inside it.
- First red attempt: invalid. Testing Library's `getByRole` does not model presentational children, so the case passed. A case was then added that asserts no ancestor of a tick has `role="img"`, which is the ARIA rule itself. That gave a genuine red, then green.
- Browser specs: `d8p/responsive-a11y` (axe) and `d8p/today-narrow`, 4 passed.

**ocr:** session f2e46efe-fcda-488e-aa26-516617c81746. 4 files reviewed, 0 comments, raw output at `ocr/T8R.8-B1-f273ff78.json`.

**Lane TD** was rebased onto `ff3b517e`. The new commits are T8R.8 `e43b29f0`, T8R.9 `8134c1af` and T8R.8-B1 `777d6329`.
- Lane-tier rerun (`T8R.9-rebased`): 2092 unit, 258 integration, 14 of 14 checks.
- Fast-forwarded to `d31b7e8f`, and the lane was removed.

**Wave 1 is complete:** every wave-1 task and follow-up has merged.

**Next:**
- T8R.24 starts in lane WD.
- T8R.26 is running in lane NS; it started early, as the handoff allows.
- A full-tier run follows T8R.24's merge.

## T8R.24 returned; ocr

T8R.24 is committed as `09ab4c86` in lane WD.

**Cases.** Case 1 went red then green. Case 2, which checks that the words are unchanged without `due`, passed on its first run. Its mutation check (always take the `due` branch) failed as expected, then the code was restored.

**Wording rule.** `PHRASE_PATTERNS` was added, and `tools/wording-rules.test.ts` went red then green.

**Browser expectations.** Three specs changed: `d7p/layout`, `d4/responsive-a11y` and `d4/breach-overrun`. They now read "Awaiting the Tue Oct 13 close" for Tuesday noon with Monday's Mark in hand. 10 passed.

**Unit expectations.** Unit tests that build `AwaitingClose` without `due` keep the old words, which is correct (W34).

**ocr.** Session 4b1eca24-2898-49e5-a71a-faf83ff133df, 7 files reviewed, 0 comments, raw output in `ocr/T8R.24-09ab4c86.json`. No bug task.

**Reviewer's answer to the main session's C1 question.** This is not an ocr finding, so it creates no bug task (decision 114).
- **Trade Detail, the Trades list and the Review's figures** all get `due` through `valueTrade` (`value-trade.ts:94`), because every covered session carries `nextSessionDate` (`market-data.ts:937`).
- **The Review's attention sentence is the one gap.** `daily-review/attention.ts:102-103` (`unavailableReason`) rebuilds the `AwaitingClose` reason without `due`, so that sentence would still read "Awaiting the next close after …". `ReviewCards.test.tsx:1146` and `:1161` expect the old words.
- **It is likely unreachable.** Review reads use `factsAtClose`, so `openedAfterClose` (`evaluate.ts:233`) is false.
- **Follow-up.** The fix is one line (carry `due`). Recorded for the final report as a known C1 gap. The checkpoint critic (T8R.25) and the gate will show whether any Review flow reaches it.

## T8R.24

- Wording rule (eslint.wording.config.js): `PHRASES` keeps "Awaiting close", "Awaiting the close", "Awaiting the next close". New `PHRASE_PATTERNS` ("Awaiting the .+ close" and "Awaiting the $", the opening words before the date in a template or JSX text) joins the same regex, so a screen cannot write the dated words either whole or split around the date. Red: `tools/wording-rules.test.ts` case "fails on the dated before-Marks words" failed (`expected [] to deeply equal [ 1 ]`) before the change; green after. `npm run verify:wording` exit 0 on the real src/ui.
- Screen expectations changed (browser, real app at Tuesday noon, Monday's Mark in hand, so due is Tue Oct 13): e2e/d7p/layout.spec.ts (AWAITING_TUESDAY, two uses), e2e/d4/responsive-a11y.spec.ts lines 222 and 231, e2e/d4/breach-overrun.spec.ts lines 11, 41, 42. Unit expectations that build an AwaitingClose by hand without `due` keep the old words and are unchanged.
- Browser: `npm run build:faults`, `npm run build:releases`, then the three specs through with-browser-lock.sh: 10 passed.

## T8R.24 merged; T8R.26 returned; ocr

**T8R.24 merged.** It was rebased to `80d37dd1`. Upstream had changed no code since its base, so no rerun was needed, and it was fast-forwarded.

**T8R.26 committed as `dba5c934` (lane NS).**
- It holds seven cases, I8R.1 to I8R.7, in `tests/integration/d8r/`. All passed on their first run, because they re-prove merged behaviour.
- Each case was then mutated to fail and restored; the failure lines are in `tdd-log/T8R.26.md`.
- The full integration suite runs 269 tests, all passing.
- I8R.7 matches D8's 20-request baseline exactly. A Settlement Due Detail adds exactly one read: the Underlying's `series`, from `byInstrumentDate` `getAll`.
- The acceptance script passes its Node rows. Its three `e2e/d8r` browser rows fail until T8R.27 writes them.

**Plan reading for I8R.1** (implementation level; for the final report). The Given says "Fri 10-16 12:00 with Friday's call Mark missing". At 12:00 Friday's session has not closed, so no Friday Mark is due and no dated line can show. The case therefore reads at two times:
- Fri 12:00: the figures equal Thursday's.
- Fri 18:00, with no Friday call Mark: the dated line carries Thursday's distances, which is what the plan's Then says.

B8R.3 (`rail.spec.ts`) has the same Given. T8R.27's brief carries this reading.

**ocr.** Session a9c5e00e-7a72-477e-a72c-cc3616eb4e2a, 6 files reviewed, 0 comments, raw output in `ocr/T8R.26-dba5c934.json`. ocr reported one failed `file_read`, of a D8 path that does not exist; all 6 selected files completed.

**Reviewer note** (not an ocr finding). The closing `evaluationOf(...).resolves.toBeDefined()` in `columns.test.ts` cannot fail, because `evaluationOf` already throws. It is redundant but harmless; for the final report.

## T8R.26

Node integration suite, `tests/integration/d8r/` (`detail.test.ts`, `columns.test.ts`, `settlement.test.ts`, `restore.test.ts`, `query-count.test.ts`, `support.ts`). Tests only; no production code.

- `npm run test:integration`: 123 files, 269 tests, all passed (the 5 new files hold 11 tests: I8R.1 to I8R.7, with I8R.6 one test per backup fixture).
- `.claude/scripts/acceptance-commands.sh plan/D08R-trade-detail-refactor.md`: the Node rows pass (`npm run test:integration -- d8r/detail` lists 3 tests; `-- d8r/query-count` lists 1). The three Playwright rows (`e2e/d8r/states.spec.ts`, `today.spec.ts`, `responsive-a11y.spec.ts`) print `FAIL: playwright --list exited 1, no tests` because T8R.27 has not written `e2e/d8r/` yet, so the script exits 1 until then. Summary line: `5 commands checked, 3 failed, 0 rows are procedures, not checked`.
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` (0 errors; 2 existing warnings in `OwedDebtItem.tsx`), `npm run lint:deps`: all exit 0.
- I8R.7's measured counts match D8's baseline with no adjustment: Open Detail of O-C3 and of O-S2X, 20 requests each (D7S_DETAIL); Settlement Due Detail of O-S2X, the same 20 plus one `observations` `byInstrumentDate` `getAll` (the Underlying's series).
- Deviation from the plan's wording for I8R.1: "Fri 10-16 12:00 with Friday's call Mark missing" cannot give a dated line, since at 12:00 the read session's Marks are Thursday's and are present. The case reads Fri 18:00 (after Friday's close, no Friday Mark for the call), where the figures are Unavailable and the dated line carries Thursday's distances, and also reads Fri 12:00.
- Each case's first-run pass and mutation are in `tdd-log/T8R.26.md`.

## T8R.26 merged

T8R.26 was rebased to `77ee17e1`. The lane tier was rerun as `T8R.26-rebased`: unit 2095, integration 269, and 14 of 14 checks. The branch was then fast-forwarded to `16876019`.

Next is a full-tier run (`wave2-full1`, browser full). After it, T8R.25 (the checkpoint critic) runs beside T8R.27 (the browser suite).

## Full-tier run: wave2-full1 (on `241abe68`)

This full run (browser full) came before the checkpoint critic. Every stage passed:

| Stage | Result |
|---|---|
| Unit | 2095 passed |
| Integration | 269 passed |
| Checks | 14 of 14 exit 0 |
| Browser 1 | 126 passed (5.1 min) |
| Browser 2 | 121 passed (7.6 min) |

`run-complete.sh` confirms the run is complete. The tech debt item 11 flake did not occur.

Next: T8R.25, the checkpoint critic (critic-1, flows C8R.1 to C8R.4), on `241abe68`. T8R.27 is being written in lane BR at the same time.

## T8R.25: checkpoint critic-1

The report is in `critic-1.md`, saved with `tools/agent-report.ts`. The critic ran on `ad832150` after `wave2-full1`.

**Result:** PASS overall. All four flows passed, C8R.1 to C8R.4, and the 375 and 320 px checks passed. The critic found **3 moderate defects**, in states next to the named scenarios. Each becomes a bug task. They run one at a time, and each starts with a failing test (critic-brief).

| Bug task | Defect | Severity |
|---|---|---|
| T8R.25-B1 | Plan and Risk shows "Since the last Marks" when no lots were bought after earlier Marks: on O-S2X with no Marks at Fri 11-20 12:00, and on Settlement Due at Mon 11-23 18:00. W23 says "Shown only when lots were bought after earlier Marks". | Moderate |
| T8R.25-B2 | On the expiration evening (Fri 11-20 18:30), Plan and Risk's Conditions table still measures the expired contract, while the note beneath it says it is no longer measured and the rail shows no distances. | Moderate |
| T8R.25-B3 | On a stock Trade, the Conditions table's Condition cell shows a bare price ("$47.50") instead of naming the condition ("ABC at or below $47.50"), unlike option Trades and the rail (W31). | Moderate |

**Minor observations** are not defects, so they create no bug tasks. All 10 go in the final report:
1. Payoff repeats Realized to date and the XYZ Mark.
2. The track's markers lag the table at midday.
3. W24's line has no closing period after the button.
4. An owed reflection on a Journal card keeps the old form.
5. The Daily Trade Review keeps "Action: Hold" as its own row.
6. The Conditions table scrolls at 375 px.
7. The Settlement Due Today table scrolls 14 px at 1280 px on the expiration evening.
8. The Closed-by-sale row is labelled "Call Mark" for the exit price.
9. The same date appears in both columns on the exit day.
10. Dated Risk or reward cells carry no date.

**What follows.** Moderate defects remain, so after the last fix there is one full run (browser full) and then a fresh critic-2 (critic-brief: "FAIL, or any high or moderate defect: spawn a fresh critic"). The checkpoint may use at most three critics (decision 116 (3)).

### Critic cost

| Critic | Brief | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|---|
| critic-1 (T8R.25) | critic-brief template, flows C8R.1 to C8R.4, plus decision P1 | 217,339 | 94 | 14 min 17 s | 3 moderate |
| critic-2 (T8R.25) | as critic-1, plus nearby states and 375/320 px on every drawer | 197,247 | 71 | 12 min 27 s | 4 moderate |

## T8R.25-B1 returned; ocr

T8R.25-B1 was committed as `3d5277a7` in lane CB.

**Root cause.** Trade Analysis sets `atEntry` with no `firstMarksDue` in two cases:
- Marks are missing and no earlier Mark exists.
- A contract is past expiration, so no Mark is read.

**Fix.** Trade Views now has `OpenCurrentEvaluation.noLotsAfterMarks?: true`, which is additive (A245) and set by `noLotsAfterMarksOf`. Plan and Risk hides the group when it is set.

**Cases.**
- Case 1 went red, then green.
- Case 2 passed on its first run; a mutation check made it fail.
- Case 3 (`option-views.test.ts`) is a process slip for the final report. It was written after the code, so it had no first red. It then failed genuinely against the agent's first version, which ignored the dated line, and passed after the fix.

**Browser.** 12 specs passed.

**Lane tier.** 2098 unit tests, 269 integration tests, 14 of 14 checks.

**ocr.** Session e53719b4-e97f-4bf6-a6dc-12fb178abf75. It reviewed 4 files and left 0 comments, so there is no bug task. Raw output: `ocr/T8R.25-B1-3d5277a7.json`.

**Reviewer notes** (not ocr findings):
- O-C3+ still shows the group, because its exact Mark or dated line keeps the field unset.
- A Trade with only a stale Mark is not hidden, because `staleContext` keeps the field unset.
- Edge case for the final report: a Settlement Due Trade with a lot bought after its last Mark would hide the group, because no stale context or dated line exists after expiration. This is rare, and it agrees with the critic's expectation that the group is hidden on Settlement Due.

## T8R.27 returned

T8R.27 is committed as `f1e5fe8a` in lane BR.

**Coverage.** `e2e/d8r/` holds 13 tests covering B8R.1 to B8R.7. Every case passed on its first run. Each was then checked by changing one asserted value so it failed on an assertion; the failure lines are in `tdd-log/T8R.27.md`.

**Acceptance script.** `acceptance-commands.sh` exits 0: 5 commands, 0 failed.

**Browser time.** `e2e/d8r` takes 1.2 minutes.

**Support changes.**
- `e2e/d8p/support.ts`: `buildOc3` gains `correctedWednesdayXyz`, which adds B8R.6's correction step (handoff, section 7).
- New exports: `confirmOc3`, `at` and `CORRECTION_REASON`.

**Readings applied.**
- **B8R.3:** the rail at Fri 12:00 shows no dated line. The dated distances are checked at Fri 18:00, the same reading as I8R.1.
- **B8R.4:** the group order is checked, and so are W23's four figures. This closes T8R.9's coverage gap for "Risk from that price".
- **B8R.2:** K1 sold at 11:00 shows its column as "Exit Fri Nov 13" (decision P1). Its Underlying cell is "—", because no NVDA Mark exists for that session at the read time, which is what P1 says. This is the implementation-level reading for the final report.

**W24 punctuation.** The Journal line has no final period after the button, as shipped. critic-1 raised the same point as minor observation 3. It goes in the final report.

**`e2e/d8p/history.spec.ts`.** The T8R.27 agent thought this spec might be stale. It is not: it passed in `wave2-full1`.

## ocr: T8R.27

- Commit `f1e5fe8a`, reviewed in place.
- Session 059e5d4d-0192-499f-8ffe-0378636c964d.
- 9 files reviewed, 6 excluded.
- 1 comment. Raw output: `ocr/T8R.27-f1e5fe8a.json`.

**Finding (medium, test, Valid).** `e2e/d8r/names.spec.ts:27`: `namesOn` collects only the accessible-text substrings that match the broker-format pattern. A contract spelled any other way, such as `aria-label="XYZ 2026-12-18 55 Call"`, is never compared. B8R.5 exists to catch exactly that spelling. This becomes bug task **T8R.27-B1** in lane BR.

**Reviewer notes** (not ocr findings):
- `buildOc3`'s existing callers are unchanged.
- In `rail.spec.ts`, the class-based absence check is partly trivial. The text checks for "nearest", "Worst case" and "Max reward" are the real guard.
- Possible flake sources were noted, but none was confirmed.

## T8R.25-B2 returned; ocr

T8R.25-B2 was committed as `96d9cec9` in lane CB.

**Root cause.** `figureOf` showed the Settlement Due reason only when a result was Unavailable. On the expiration evening the Marks are saved, so the results are real readings. The note and the rail test `view.settlement`.

**Fix.** `figureOf` now follows `view.settlement` too.

**Tests.** One case went red, then green. Changed test double: B1's stub settlement entry was replaced with the real one. The 11 browser specs passed.

**ocr.** Session 989671c4-8325-491f-920c-522eb22d7656, 2 files, 0 comments, raw output in `ocr/T8R.25-B2-96d9cec9.json`.

**Reviewer notes** (not ocr findings):
- A single-leg Plan has no second leg, so no live leg's figures can be hidden.
- `settlementDueFigure` cannot throw on a real entry.
- ADR 0001 holds.

## T8R.25-B3 returned; ocr

T8R.25-B3 is committed as `320bda9e` in lane CB.
- The Condition cell now uses the rail's `conditionText`, exported from `rail/conditions.props.ts`. A stock condition reads "<Underlying> at or below $47.50". Option rows are unchanged.
- One case went red, then green.
- Browser: `e2e/d4` and `d8p/cockpit`, 27 passed.

**Reading for the final report.** On a stock Trade, the Value at expiration column is kept with empty cells. T8R.10's new-words row approves the empty cell, and hiding the whole column would be a plan change. critic-1 mentioned the column inside defect 3. critic-2 will judge it again.

**ocr:** session 4eb8370e-6ba4-49c1-b2a8-42cd7242e14e, 3 files, 0 comments, raw output `ocr/T8R.25-B3-320bda9e.json`.

**Reviewer notes** (not ocr findings):
- Option wording is identical to before.
- `drawers/` may import from `rail/`; both files are `*.props.ts` adapters.
- Nothing else used `triggers`.
- The Plan group's Stop and Target rows keep the bare stock price, as W6 says.
- The test name says "ABC", but the fixture's Underlying is XYZ. The assertion is sound.

## T8R.25-B1

Plan and Risk showed "Since the last Marks" whenever the evaluation had at-entry lots and `firstMarksDue` was unset. With no Marks at all (Mark missing, none earlier) or on a Settlement Due contract (no Mark is read), every lot is "at entry" and `firstMarksDue` stays unset, so the group appeared although no lot was bought after any Marks.

Fix: Trade Views adds the optional, additive field `OpenCurrentEvaluation.noLotsAfterMarks?: true` (A245). It is set when the evaluation has at-entry lots but no Marks exist: no exact Mark, no stale Mark, no dated line. Plan and Risk leaves the group out when it is present. Entry Quality still covers the entry.

Known limit: a Settlement Due Trade is treated as having no lots after Marks, since an expired contract reads no Mark and cannot be bought after expiration.

Browser, via with-browser-lock.sh on 5175 (after `npm run build:faults` and `npm run build:releases`): e2e/d8p/states.spec.ts, e2e/d8p/cockpit.spec.ts, e2e/d7s (all four specs): 12 passed.

## T8R.25-B2

Plan and Risk's Conditions cells read the Settlement Due reason whenever the view is due for settlement (the same `view.settlement` the note and the rail use), not only when a condition's result is Unavailable. Fixes the expiration evening (Fri 11-20 18:30 with the day's Marks saved), where readings exist yet the contract is due.
- Case: should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do (red, then green; see tdd-log/T8R.25-B2.md).
- Browser (port 5175): e2e/d8p/states, e2e/d8p/settlement-due-replay and the four e2e/d7s specs, 11 passed.

## T8R.25-B3

Plan and Risk's Conditions table names each condition in its Condition cell with the rail's own words (`conditionText`, exported from `rail/conditions.props.ts`): "XYZ at or below $47.50", "XYZ at or above $56.00" on a stock Trade; an option Trade's rows read as before ("Option at or below $1.00"). The Plan group's Stop and Target rows keep their bare price.
- Case: should name a stock Trades conditions in the Condition cell (red, then green; see tdd-log/T8R.25-B3.md).
- Reading for the main session: the Value at expiration column is kept on a stock Trade, its cells empty. The plan's new-words row approves an empty cell for a stock condition and says nothing of hiding the column; hiding it would be a deviation.
- No new-words row: the wording is the rail's (W21, W22).
- `e2e/d8r/plan-risk.spec.ts` does not exist on this lane, so there was nothing to change there.
- Browser (port 5175): e2e/d4 (all) and e2e/d8p/cockpit.spec.ts, 27 passed.

## Lane CB merged (T8R.25-B1, B2, B3)

Lane CB was rebased onto `91b0ed1c`. Upstream had changed no code since its base, so no rerun was needed. It was then fast-forwarded. The rebased hashes are:
- B1 `a3256de7`
- B2 `aef3d956`
- B3 `0adedd00`

Next, lane BR (T8R.27, plus T8R.27-B1 once it has been reviewed) merges. Then come one full run (browser full) and a fresh critic-2.

## ocr: T8R.27-B1 (second ocr round on T8R.27's names spec)

**T8R.27-B1** was committed as `8ce31c4f`. A planted misspelling passed the old check and fails the new one, and all 13 `e2e/d8r` tests pass.

**Review card label.** The agent asked whether "XYZ (Long 2 Dec 18 $55 Call)" breaks W28. It doesn't: it is the Trade Summary form P117 approves ("Long 1 Dec 19 2025 $55 Call"). Answered by the main session.

**ocr run.** Session c395d403-a021-4f24-be10-e807150e3d73, 1 file reviewed, 2 comments. Raw output: `ocr/T8R.27-B1-8ce31c4f.json`.

**Findings.** Both are medium, test, and Valid. Both become bug task **T8R.27-B2**.
1. `names.spec.ts:40`: an element whose own label lacks "XYZ", but whose child shows the contract, is never tagged. A name that leaves out the contract is therefore not compared with the visible text.
2. `names.spec.ts:31-32`: the attribute scan no longer resolves `aria-labelledby`, and `ariaSnapshot` skips hidden elements. A hidden drawer panel labelled by a misspelt contract would pass. This is a coverage regression from T8R.27.

**Reviewer notes** (not ocr findings):
- The mention pattern is case-sensitive.
- The prefix strip applies on every screen, not only on the Review card.
- `data-b8r5` tags are never cleared between calls, a latent strict-mode flake.

B2's brief lets it clear the tags inside the tag step it rewrites. The other two notes go to the final report.

**Round count.** A third ocr round on this chain (T8R.27, then B1, then B2) that still leaves findings becomes a pending decision for the user (handoff, section 5).

## Full-tier run wave2-full2 (on `54a9c95d`), before critic-2

| Stage | Result |
|---|---|
| Unit | 2100 passed |
| Integration | 269 passed |
| Checks | 14 of 14 |
| Browser 1 | 126 passed (5.1 min) |
| Browser 2 | 121 passed (7.6 min) |

`run-complete.sh` confirms the run is complete, and there was no flake. Next comes critic-2, the second critic at the T8R.25 checkpoint, run fresh on flows C8R.1 to C8R.4.

## ocr: T8R.27-B2 (third ocr round on the names spec)

T8R.27-B2 was committed as `b10ea3de`. Both planted mutations that passed under B1 now fail, and all 13 `e2e/d8r` specs are green with no mutation.

ocr session dc51b3c3-0288-42fb-818f-367855a5003d reviewed 1 file and left 2 comments. Raw output: `ocr/T8R.27-B2-b10ea3de.json`.

**Findings** (both medium, test, Valid):
1. `names.spec.ts:44-45`: for a button or link, the name is taken from its raw content, not the name the browser computes. In `<button><span aria-label="Open">XYZ Dec 18 $55 Call</span></button>`, the browser names the button "Open", but the check reads it as the contract.
2. `names.spec.ts:46`: an element with another role and an explicit label, such as `<div role="img" aria-label="Open">` holding contract text, keeps no text, so the check never compares its name with its content.

**Reviewer notes** (not ocr findings):
- `title` is read before content, so a button with a `title` could fail when it shouldn't.
- `textContent` joins neighbouring blocks with no space.
- No new source of flakes.

Neither DOM shape exists in the app; the check passes on every real screen. This is the third round on this spec to leave findings, so it is pending decision **P2** for the user, not an automatic T8R.27-B3.

## T8R.25: checkpoint critic-2

critic-2 tested the `949e4aef` build: **PASS, with 4 moderate defects.** Its report is in `critic-2.md`, and its cost row is in the critic-cost table under critic-1. All four flows passed, C8R.1, C8R.2, C8R.3 and C8R.4.

The critic could not find the `e2e/d8r` helpers, because lane BR had not merged yet. It built the starting states from the D8P, D7 and D4 helpers instead.

Each defect becomes a bug task. They run one at a time in a new lane, C2, branched from main:
- **T8R.25-B4** (defect 1). At 1280 px the Today table is wider than its box: about 588 px of content in a 550 px box. It loads scrolled sideways, so the sticky column covers the first heading, which reads "T SESSION, MON OCT 19".
- **T8R.25-B5** (defect 2). The call's Mark is missing or acknowledged, but the Underlying's Mark exists. The Underlying Target still reads "2.10 away · Thu Oct 15 Marks" when it should read the current "1.90 away", undated. This conflicts with A110 and A231, and with section 7 of the audit.
- **T8R.25-B6** (defect 4). On an option Trade, when the Underlying's Mark is acknowledged unavailable, no note appears under the Today table. `notesOf` checks only the contract's own `markResolution`.
- **T8R.25-B7** (defect 3). At 320 px, axe reports `scrollable-region-focusable` on the Payoff drawer's `.table-scroll`. It probably predates D8R, but it sits in a Trade Detail drawer at a width B8R.7 requires.

The critic's 10 minor observations go to the final report.

After B7, one full run (browser full) follows, then critic-3. That is the last critic this checkpoint allows.

## T8R.27

Browser suite, `e2e/d8r/` (`today.spec.ts`, `states.spec.ts`, `rail.spec.ts`, `plan-risk.spec.ts`, `names.spec.ts`, `history.spec.ts`, `responsive-a11y.spec.ts`, `support.ts`): B8R.1 to B8R.7, 13 tests. Tests only; no production code. The correction step B8R.6 needs is `buildOc3`'s `correctedWednesdayXyz` option in `e2e/d8p/support.ts`, which also exports `confirmOc3` and `at`.

- `npm run build:faults` and `npm run build:releases`: exit 0.
- `npx playwright test e2e/d8r` (under `.claude/scripts/with-browser-lock.sh`): 13 passed, 1.2 min run time. Mutation notes in `tdd-log/T8R.27.md`.
- `.claude/scripts/acceptance-commands.sh plan/D08R-trade-detail-refactor.md`: exit 0, `5 commands checked, 0 failed` (states 4 tests, today 2, responsive-a11y 1, detail 3, query-count 1).
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` (0 errors; 2 existing warnings), `npm run lint:deps`: exit 0. Lane tier `T8R.27 lane`: unit 2095, integration 269, 14 of 14 checks.
- Readings applied: B8R.3's Fri 12:00 shows no dated line, and the dated distances are read at Fri 18:00 (as I8R.1). B8R.4's group order is Plan, Since the last Marks, Conditions, Plan Baseline, Entry Quality, Planned-Leg Fulfillment, Deviations, with W23's four figures ($3.30 average, $230.00 · 1.15R, $170.00 · 0.85R). B8R.2's K1 column is "Exit Fri Nov 13" (decision P1).
- K1's Underlying cell reads a dash: K1 was sold at 11:00 on Fri 11-13, before that session's close, so no NVDA Mark exists for it (T8R.7-B1's case "sold before the close").
- B8R.6's keyboard paging case is also in `e2e/d8p/history.spec.ts` (T8R.16); it is repeated in `e2e/d8r/history.spec.ts` on the corrected-Mark fixture.

## T8R.27-B1

`e2e/d8r/names.spec.ts` now compares the whole accessible name of every element that names an XYZ option, not only substrings that fit the broker format. It reads the browser's accessibility tree (`ariaSnapshot`, so aria-label, aria-labelledby, alt, title and content are joined by the browser), every aria-label, title and alt attribute, and each tagged element's accessible name against its visible text. A mention is anything from XYZ through a digit to Call or Put, so "XYZ 2026-12-18 55 Call" is found.

- Red: with `aria-label="XYZ 2026-12-18 55 Call"` set on a contract element, the old spec passed (1 passed), the new spec failed (`Detail: an accessible name's contract`, expected "XYZ Dec 18 $55 Call", received "XYZ 2026-12-18 55 Call"). Mutation removed; new spec passed. Rows in `tdd-log/T8R.27-B1.md`.
- `npm run build:faults` and `npm run build:releases`: exit 0. `npx playwright test e2e/d8r/names.spec.ts`: 1 passed. `npx playwright test e2e/d8r`: 13 passed (1.2 min), both under the browser lock.
- Reading applied: the Review card names a position "XYZ (Long 2 Dec 18 $55 Call)" and its button "Review XYZ Long 2 Dec 18 $55 Call ...". The check removes the side and quantity and requires the remaining contract text to be the W28 name. Raised as a question to the main session.
- Typecheck, `tsc6`, lint (0 errors, 2 existing warnings), `lint:deps`: exit 0.
