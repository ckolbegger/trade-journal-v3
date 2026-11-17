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
