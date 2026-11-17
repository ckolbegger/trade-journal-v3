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
