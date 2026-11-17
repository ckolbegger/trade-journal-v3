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
