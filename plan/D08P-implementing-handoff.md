# Handoff: `claude-opus-5.5`, implement D08P

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D08P's specifics, the swarm procedure and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-12, after plan revision 84. [D08P-handoff.md](D08P-handoff.md) is the record of the planning session that drafted the breakdown.

This session **implements D08P, "The Trade Detail cockpit"**, under the frozen plan at revision 84. D08P is the D8 prefactor: Trade Detail is rebuilt as the "C. Cockpit" tab of `prototypes/trade-detail/index.html`. The breakdown is [D08P-trade-detail-cockpit.md](D08P-trade-detail-cockpit.md):
- 26 tasks (T8P.1 to T8P.26) in three waves with lanes, plus T8P.27 (revision 85, after T8P.22);
- agreed by the user on 2026-11-12 as **decision 110**, with P94–P102 as recommended and the words W1–W20 approved (W1's third tab is **"Plan and Risk"**, in the user's words);
- run as a **swarm** under **decision 111**.

Task status lives in the breakdown's Progress section, which has Wave and Lane columns (decision 100, amended by decision 111).

Where things stand:
- **D7S: complete, tagged `claude-opus-5.5-d7s` (`2240fe1c`)**, with its three post-gate bug fixes, BUG-1 to BUG-3.
- **Its last cumulative run** is `bug-1-2`, on `8476a30a`. It passed:
  - unit: 127 files, 1519 tests;
  - integration: 103 files, 218 tests;
  - browser: 119 in `browser-1` (4.8 min) and 74 in `browser-2` (4.4 min);
  - checks: 14 of 14.
- **No product code, test or tooling has changed since.**

**Starting a session.** The user starts a session with one prompt: *"Read plan/D08P-implementing-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next task(s) at once**, as section 3 orders them. Don't stop to report that the reading is done.

Continue through the gate (T8P.26) and the `claude-opus-5.5-d08p` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (the deliverable branch every lane merges into) |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `4175` (D08P runs no benchmark) |
| Frozen plan | tag `claude-opus-5.5-plan-r84` (revision 84, decisions 110 and 111); since 2026-11-13, `claude-opus-5.5-plan-r88` (revision 85 adds T8P.27; revision 86 tightens its test pairing; revision 87 re-anchors two layout checks; revision 88 allows the additive `nearest` and `days` in strict checks) |
| Code D08P builds on | tag `claude-opus-5.5-d7s` (`2240fe1c`) |
| D08P starting point | tag `claude-opus-5.5-pre-d08p`: the same commit as `plan-r84`, at the user's direction. `claude-opus-5.5-pre-d8p` (`5ae23f94`) marks where the planning session started. |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`, where N counts the commits not yet pushed. No uncommitted changes. |
| `git log --oneline claude-opus-5.5-pre-d08p..HEAD` | At the first session, one commit: "D08P implementing handoff, drawer labels follow the prototype; lane briefs carry the lane rules". Afterwards also: only D08P task and merge commits, their evidence and Progress updates, handoff updates, and any approved plan revisions. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-d7s`, `claude-opus-5.5-pre-d8p`, `claude-opus-5.5-plan-r84` and `claude-opus-5.5-pre-d08p`. |
| `git rev-parse 'claude-opus-5.5-d7s^{commit}'` | `2240fe1c9d6f1c0e1c8fa1846db700eb63fc82c4` |
| `git rev-parse 'claude-opus-5.5-plan-r84^{commit}' 'claude-opus-5.5-pre-d08p^{commit}'` | The same hash twice. |
| `git diff --stat claude-opus-5.5-d7s claude-opus-5.5-pre-d08p -- src e2e tests tools package.json 'eslint*'` | Empty. |
| `ls .claude/worktrees 2>/dev/null` | Empty or absent at the first session. Afterwards, only this deliverable's lane worktrees. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails, ask the user to run `ocr auth login`. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | 127 files and 1519 tests (unit); 103 files and 218 tests (integration). |

Record the exact Node version in `evidence/D08P/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The lane worktrees are different.** D08P's lane worktrees, under this worktree's `.claude/worktrees/`, belong to this implementation. Never confuse the two.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D7S.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It is the single-task procedure: briefs, `ocr-review`, bug tasks and `suite-runner`. **T8P.1 adds its "Running a swarm deliverable" section** (decision 111). Once T8P.1 has merged, read that section and the amended `tdd-task.md` and `suite-runner.md` before dispatching wave 1. The breakdown's section 9 holds the agreed text.

The governing instruction is [plan/kickoff.md](kickoff.md). It requires reading two baselines, each scoped to what D08P uses.

**The `specs/` baseline (A218).** D08P has no reading list of its own. Read **`plan/spec-reading/D07.md`** as `implementing.md` says. Also read these sections, which D9's list (`plan/spec-reading/D09.md`) holds; find their line ranges with `plan/spec-map.md`:
- `specs/design/trade-analysis.md`, "`replay`";
- `specs/design/market-data.md`, "Query contract" (`ReadSeries`);
- `specs/design/trade-views-and-reporting.md`, "`getTradeDetail`", "`replayTrade`" and "Invariants";
- `specs/acceptance/acceptance-contract.md`, AC-MARK-004 (S047);
- `specs/design/ui-contract.md`, the Trade Detail and replay paragraphs.

Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D08P/structural.md`.

**The frozen plan (scoped):**
- **`plan/D08P-trade-detail-cockpit.md` in full**, which is the work. Its appendix is the lookup output that T8P.4's and each lane's briefs cite.
- **`plan/implementation-plan.md`:** everything except the `## D8` through `## D28` definition sections. But read D9's, for its decision 110 note. That covers:
  - decisions 1–111 (100 as amended by 111);
  - the rules and cumulative obligations;
  - the freeze record;
  - the definitions through D08P;
  - tech debt items 1–23, of which 21 and 23 are fixed here.
- **`plan/technology-stack.md`** in full.
- **`plan/acceptance-matrix.md`:** only the opening sections, and the AC-MARK-004 row.
- **`plan/D07-approved-words.md`:** conventions C1–C8, and rows 23.x. D08P's words are section 1.6 of its breakdown.
- **`plan/D07S-option-price-stops-and-targets.md`:**
  - section 1.6 (W6, W7, W8; the condition words the Conditions card reuses);
  - section 4's O-S2 data (the examples in T8P.6, T8P.9 and T8P.14).
- **`plan/D07S-prefactor-mark-to-market-valuation.md`:** sections 1.1 and 1.7, for the valuation module and the read session that `replay` and `ReadSeries` build on.
- **`plan/D05R-review-redesign.md`:** sections 6.3 and 6.4, the precedent for moving earlier browser cases through shared helpers (decision 65).
- **The prototype**, `prototypes/trade-detail/index.html`, tab "C. Cockpit", every state. It is a picture, not a specification. The breakdown's P96 and section 1.6 say which wins, except for drawer labels, where the prototype wins (section 3, "Other rules").

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected passages, scenarios and durable compatibility.
3. Ask for approval.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r89, and the next decision is 112. (Revision 85, 2026-11-13, added T8P.27; revision 86 tightened its test pairing; revision 87 re-anchored two `ui-alignment` checks to the cockpit layout; revision 88 lets strict checks gain the additive `nearest` and `days`.) Editing the Progress section alone is not a revision.

## 3. D08P specifics

### Setup before T8P.1

Create `evidence/D08P/` with:
- `tdd-log.md`, with the note that its rows are single-case runs (`tdd.sh` maps `T8P.n` here today);
- `structural.md`;
- `provenance.md`.

T8P.1 moves `tdd.sh` to one log per task.

### Wave 0

Order: T8P.1, then T8P.2, then T8P.3 ∥ T8P.4, then T8P.5.

- **T8P.1 runs alone and first, in the main worktree, under the existing single-task rules.** The pre-commit hook runs `eslint .`, and until T8P.1's ignore lands, any worktree under `.claude/worktrees/` would be linted with every commit.
  - It builds the tooling: the lock, `lane-setup.sh`, the lane tier, per-task logs and the ignore.
  - It applies section 9's text to `implementing.md`, `tdd-task.md` and `suite-runner.md`.
  - It ends with a complete cumulative run, as today.
- **T8P.2 also runs alone in the main worktree.** It rewrites the hot files (`TradeDetail.tsx`, its two test files, `app.css`).
- **T8P.3 and T8P.4 are the first lane pair.** Dispatch each to a fresh `tdd-task` with `isolation: "worktree"`, whose brief starts with `.claude/scripts/lane-setup.sh`. T8P.4 runs the full browser tier inside the lock.
- **T8P.5 runs alone after both merge.** Its mechanical unit-test change touches every section's test file.

### Wave 1

The breakdown's sections 4.1 and 4.2 give the tasks and file ownership.

**Agents and order.**
- At most **six `tdd-task` agents at once**. `ocr-review` agents don't count against the cap.
- Start the backend lanes first, since they hold the longest chain: BV (T8P.9), BA (T8P.6) and BM (T8P.8).
- Then start UI lanes as slots free, in the order R2, R1, D2, D1, D4, D3, D5, D6.
- T8P.10 starts once T8P.7, T8P.8 and T8P.9 have merged.

**Each task** gets a fresh worktree from the deliverable branch's head at dispatch. A lane's next task starts once its previous task has merged.
- Before the brief, mark the task's Progress row "In progress from `<head>`".
- Record in `structural.md` the worktree and branch names the Agent tool gives.

**Merging.** A task is mergeable when two things are true:
- its ocr review and bug tasks are clean;
- its lane tier passed (`full-suite.sh <dir> <task> lane`, in its worktree, recorded in `suite-runs/`).

Then rebase its branch onto `claude-opus-5.5` and fast-forward. If the rebase changed a file the task doesn't own, rerun its lane tier first. Mark the row "Done" with the **rebased** hashes, since those are on the branch. Remove the lane worktree once merged.

**Merge order constraints.** None in wave 1. Thanks to the three legacy blocks (breakdown section 4.2), no figure disappears between two lanes' merges, so lanes merge in whatever order they finish.

**Merge runs.** When no merge is pending, and at least one task has merged since the last run:
1. Send `suite-runner` the complete cumulative run on `claude-opus-5.5`, with `browser-auto <last merge run's commit>`.
2. Record it in `structural.md`.
3. If a failure appears, pin it to a merged task with one targeted run, and fix it in a fresh `tdd-task` from the current head, failing test first.

Lanes keep working during merge runs.

### Wave 2

1. **T8P.22**, after every wave-1 task has merged. It also retires the three legacy blocks.
2. **T8P.27** (revisions 85 and 86): remove the old Detail sections, tests and styles the cockpit no longer renders. The pairing table is committed before any deletion, and the main session checks it row by row before merging.
3. A full-tier run.
4. **The checkpoint critic, T8P.23**, on flows C8P.1–C8P.4. Its defects become bug tasks, fixed before the tail.
5. **T8P.24 ∥ T8P.25.** The Node suite may start as soon as T8P.11 merges, but it is recorded in wave 2's order.
6. **The gate, T8P.26.**

### Other rules

- **Ports.** Every browser run, wherever it starts, goes through `.claude/scripts/with-browser-lock.sh` once T8P.1 has merged. Before that, only the main worktree runs browsers. Never run two browser suites outside the lock.
- **Words.** Screens use section 1.6's words: W1 "Today", "Position", "Plan and Risk", "Price History", "Journal", "Payoff". Moved content keeps its words (P96), including "Realized to date" and "Incurred fees". Words no row covers need the user's approval, which is a stop (section 5).
- **Drawer labels: the prototype wins** (the user's direction, 2026-11-12). Where the breakdown and the prototype's "C. Cockpit" tab disagree on a drawer tab's label, meaning its name or the count it carries, build and test the prototype's label. Record the difference in `structural.md`. It is not a stop. At revision 84 they agree: W1 matches the prototype's `DRAWERS` list and its counts.
- **Lane briefs carry the lane rules.** T8P.1 changes `.claude/agents/tdd-task.md` and `suite-runner.md` partway through the session, and a running session may keep the definitions it loaded at startup. So every brief for a task in a lane worktree (T8P.3 and T8P.4 onward), and every lane-tier request to `suite-runner`, states the rules itself rather than relying on the amended definitions:
  - start with `.claude/scripts/lane-setup.sh`;
  - run only the lane tier, `full-suite.sh <dir> <task> lane`, never a complete cumulative run;
  - run any browser test through `.claude/scripts/with-browser-lock.sh`;
  - write red and green rows to `evidence/D08P/tdd-log/<task>.md`;
  - commit on the lane branch only; the main session rebases and merges.
- **What must not change.**
  - Every existing case keeps its expected values, except where section 1.5's texts table names the case and the task. Everywhere else, a changed expected value is a defect.
  - Every existing query-count proof keeps its exact request lists. I8P.4 adds new ones.
  - No frozen fixture view changes (A220).
  - T8P.4's and T8P.5's test changes are mechanical only: they reach content, and change no expectation (the D5R rule).
- **Presentational components.** Code under `src/ui/cockpit/` takes plain props. Only `*.props.ts` adapters import view types, and T8P.3's lint rule enforces it.
- **TDD discipline, clock pinning, mutation builds, and ocr on test-only commits:** as in the D7S handoff's section 3.
  - Run each case red, then green.
  - Back out code written before its red.
  - A first-run pass gets the mutation check and is listed under section 7's open questions.
  - Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
  - Mutations rebuild `dist-faults` in the worktree they run in.
  - Test-only commits are relocated under `src/itg/d08p/` for `ocr-review`.
- **Tech debt triggers.**
  - Item 21 is fixed in T8P.19, and item 23 in T8P.9, with B8P.3 red first.
  - Raise item 11 (the Open list's Ready-state race) with the user if `TradeList.test.tsx:125` fails a run.
  - Don't fix other items unasked.
- **The gate (T8P.26).** As in D7S:
  1. Run the full tier with `suite-runner` until it passes.
  2. Run `.claude/scripts/acceptance-commands.sh plan/D08P-trade-detail-cockpit.md`, which must exit 0.
  3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with:
     - flows C8P.1–C8P.6;
     - the future-capability list in breakdown section 8;
     - the 375 and 320 px checks;
     - port 5175 under the lock;
     - no reading of `evidence/` or another worktree.
  4. Reports go to `test-results/critic-d08p-<n>/report.md`. Copy each to `evidence/D08P/critic-<n>.md`; the checkpoint's report is `critic-1.md`.
  5. At most three critics per checkpoint before asking the user.
  6. When the gate passes, mark section 13's rows covered, and tag `claude-opus-5.5-d08p`.

## 4. What is in place

Build on these. Read the code before extending it.

| Piece | Where | Notes for D08P |
|---|---|---|
| Trade Detail screen | `src/ui/screens/TradeDetail.tsx` (1,149 lines), `TradeDetail.test.tsx` (77 cases), `TradeDetailOptions.test.tsx` (21) | T8P.2 splits it; `PositionChangeForm.tsx:27` imports two constants from it. |
| Payoff view | `src/ui/screens/PayoffView.tsx`, `payoff-text.ts` (`valueAtCloseText`) | Shared with the Plan receipt (`PlanForm.test.tsx:973`), which stays. |
| Just-confirmed Detail | `src/ui/screens/confirmed-detail.ts`, called from `PlanForm.tsx:256–264` | A209. |
| Detail views | `src/coordinators/trade-views/trade-views.ts`: types :216–381, `expirationLineOf` :442, the Planned view's line :794, `getTradeDetail`'s assembly about :740–830 | T8P.9, T8P.10. |
| Evaluation | `src/domain/trade-analysis/evaluate.ts`: `headlineOf` :382–389; open P&L at :271 includes the opening fees | T8P.6 adds `nearest`. |
| Derivation and valuation | `derive`; `src/coordinators/valuation/` (`valueTrade`, `dated-line.ts`) | T8P.7 values each session through the dated-line path. |
| Market Data | `src/modules/market-data/market-data.ts`: `FrameContext`, `MarkFrame`, `HistoricalGaps`, `MarketDataReadSession` (:160–330); the decision 106 gaps scan | T8P.8 adds `series` and `ReadSeries`. |
| Instrument | `src/domain/instrument/` (`expiredOn`, `settlementDueOn`) | T8P.9's days helper. Only this module compares a date with an expiration (lint). |
| Journal narrative | `journal.query({ scope: 'TradeNarrative' })`; `NarrativeEntry` (`momentTime`, `reviewDate`, `positionChangeId`) in `src/modules/journal/effects.ts` | A213. |
| Words | `src/ui/calculation-words.ts` (`label`, `figure`, `sentence` lengths) | A222. |
| Capability manifest | `src/coordinators/workspace/capabilities.ts`; `npm run verify:capabilities` | T8P.11. |
| Facade | `src/app/compose.ts` (:66–115), `src/app/types.ts` | T8P.11. |
| Browser helpers | `e2e/d1`–`e2e/d7s` `support.ts` files; the appendix lists every Detail reader | T8P.4 adds `e2e/support/detail/`. |
| Suite tooling | `.claude/scripts/full-suite.sh` (maps `evidence/D08P` to `e2e/d8p`), `tdd.sh`, `run-complete.sh`, `acceptance-commands.sh`; `tools/install-hooks.sh` | T8P.1 extends them. `test:e2e:2` gains `e2e/d8p` in T8P.9. |
| Lint | `eslint.config.js` (`globalIgnores` at :19), `eslint.deps.config.js`, `eslint.wording.config.js` | T8P.1 ignores `.claude/worktrees/**`; T8P.3 adds `eslint.cockpit.config.js`. |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the attribution lines from the session's system reminder.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, and does the merging. Every task, bug task and code change goes to a fresh `tdd-task`.
- **Runs.**
  - Wave-0 tasks before T8P.1's merge end with a complete cumulative run, as today.
  - From T8P.1's merge on, decision 111 applies: lane tiers per task, one complete run per merge batch, and the full tier before every critic.
  - Tell the runner to check ports 9341, 9342 and 5175 inside the lock, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Only findings ocr itself raises become bug tasks, which run in the same lane. Copy each output to `evidence/D08P/ocr/<task>-<sha>.json`.
- **Subagents.**
  - General-purpose subagents run at medium effort.
  - Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Never use bare `git stash`.**
- **Refer to sections in words**, never with the "§" sign.
- **Asking.** Ask one consequential decision at a time, with a recommendation.
- **After each merge:** update the Progress row and section 7 of this note, commit, and keep the lanes full.

### Running a whole deliverable

Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity. This includes a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, a changed frozen view, or a screen text no approved word covers;
3. a suite failure or critic defect can't be fixed without such a deviation;
4. a fresh critic or a browser can't be provided, or three critics at one checkpoint still leave a FAIL or a high or moderate defect;
5. an ocr bug-task fix needs a deviation, or a third round on one task still leaves findings;
6. `acceptance-commands.sh` can't exit 0 without a revision;
7. a merge conflict falls in a file two lanes both own, which section 4.2 says can't happen.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

When the gate passes, tag `claude-opus-5.5-d08p` locally. Write `evidence/D08P/final-report.md`, with:
- tasks and commits;
- flagged items;
- decisions;
- critics;
- the wall-clock time against the breakdown's estimate (section 3.3).

Never push.

## 6. Out of scope

- **D8, and D9's remaining parts:** condition status per session, markers, the chart, its text equivalent, and audit navigation.
- **The sharing phase** and its follow-ons (breakdown section 10): the Review's Price History grid, a trimmed Journal, and "Today's Action is not recorded".
- **A second browser port** (P98). The user may assign one later.
- **Upgrade tests** (decision 76, tech debt item 10).
- **The other tech debt items**, and editing `specs/` or the frozen plan without an approved revision.

## 7. D08P progress

Task status and commits are in the breakdown's Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- **For T8P.12 to T8P.21 (from T8P.5):**
  - Five paths are placeholders typed `(props: ShellProps) => null` (`src/ui/cockpit/placeholder.ts`): `rail/pnl`, `rail/conditions`, `drawers/price-history`, `journal-cards` and `track`. The other eight re-export a composition from `src/ui/screens/trade-detail/Composed.tsx`.
  - A lane replacing a path takes the view and time zone through its `.props.ts`, since A216 bars `app/types` from the component.
  - Every drawer panel stays mounted, with the inactive ones `hidden` (T8P.5-B1), so an open form survives a tab change.
  - `eachDrawer` skips a tab name it can't find, so keep W1's names exactly.
- **For T8P.17:** T8P.5 pointed seven specs' Valuation reads at Today, since the legacy Valuation block renders there: d4/breach-overrun, d4/expected-mark, d4/responsive-a11y, d6/exit, d6/runtime-failure, d7/short-put and d7p/layout (two `openDrawer(page, 'Position')` lines removed). When Open P&L and Realized to date move to the Position drawer, flip them back with `e2e/support/detail/position.ts`.
- **For T8P.15:** the Needs-you debt reads are reached by `await openDrawer(page, 'Journal')` in nine specs: d5/detail-debt, faults, review-debt, responsive, kill-offline; d6/kill, update, runtime-failure; d7/kill. When the debts move to the rail, those lines go with them.
- **For T8P.12 to T8P.21:** each component's props type is frozen in its own `src/ui/cockpit/**/<name>.types.ts` (T8P.3), inside the lane's owned glob. `track.types.ts` (D1) and `footer.types.ts` (D3) sit at the cockpit root. The A216 rule exempts `*.props.ts` and `*.props.test.*` only. `Row`, `Table` and `Tone` are declared per file, since a shared file would belong to no lane.
- **For T8P.10, T8P.11:** `src/coordinators/trade-views/replay-view.ts` (T8P.3) isn't re-exported from `trade-views/index.ts` yet. Add the export and the facade type. `ReplayTradeResult` is `ReadViewResult<TradeReplayView> | ReplayNotApplicable`.
- **For T8P.19:** T8P.3's `PayoffDrawerProps` (finished `{price, value}` points, per-line `rows`, `stockNote`, `valueAtExpiration`) didn't settle how `PayoffView`'s `Rational` drawing becomes plain props. D4 may reshape it.
- **For T8P.9:** write B8P.3 first, and see it fail. Add `e2e/d8p` to `test:e2e:2` in the same task.
- **For T8P.14, T8P.16:** the per-condition value at expiration and distance on the Underlying move to the Today drawer (A223). Until T8P.22, the legacy Risk and reward block still shows them.
- **For T8P.19:** `PayoffView` stays as the Plan receipt uses it. The drawer's one chart may be a new component, but its sentence must come from `valueAtCloseText` (tech debt item 21). W18 also changes `CardFigures.tsx:94` and `CardFigures.test.tsx:96`, `:100`, `:106`.
- **For T8P.9:** T8P.4 left `d7/plan-open`'s "Expires Fri 20 Nov 2026" read scoped to the Summary card (`detail.summary`), so retarget it if the line moves.
- **For T8P.15:** T8P.4 scoped the Needs-you debt reads in `e2e/support/detail/rail-b.ts` (`reflectionOwed`, `reflectNowButton`, `declineButton`, `answerButton`, `debtForm`, `savedReflection`, `owedItem`) to the Journal card.
- **For T8P.22:** the `d7s/plan` and `d7s/entry-beyond-stop` reads go through `summaryValue` (`rail-a.ts`) and must move with the Summary card. Retire the three legacy blocks and their CSS (`.summary-card`, `.summary-text`), and move any expectation still reading them.
- **For T8P.27:** T8P.5 re-exports the old `src/ui/screens/trade-detail/` sections behind the cockpit paths, and each wave-1 lane replaces what a path renders without deleting the old file. Find the orphans from `src/main.tsx`'s import graph, not by name. Some old pieces live on inside the new drawers (for example the executions disclosure and the debt forms).

### Open questions

- **T8P.5: code ahead of red (flagged).** The shell was written whole while greening case 1. Cases 2 to 5 reached a genuine red only by reverting each case's own code, as recorded in a note row of `tdd-log/T8P.5.md`. Case 2's red is a runtime `TypeError` from the missing Planned branch.

- **T8P.1's bug-task rounds (user's decisions, 2026-11-13).**
  - The handoff's three-round stop was reached on T8P.1's tooling. The user chose to batch the remaining lock-wrapper findings, then allowed one last round, and to accept any further findings on `with-browser-lock.sh` as limits of dev tooling.
  - Accepted limits AL-1 to AL-4 are listed under "T8P.1-B19" in `evidence/D08P/structural.md`:
    - a malformed `ps` row in a zero-exit scan can drop a tracked descendant;
    - the signal dedupe key omits the command line;
    - a system binary with no readable environment, orphaned within one scan interval, can be missed;
    - the command runs in a background process group.
- **First-run pass, T8P.1-B3 case 2** ("it should still report run complete for a lane-tier run"). The old rule already passed a marked lane run. Its mutation check (a scratch copy looking for a differently named marker) failed as expected.
- **The lock is now a kernel lock** (T8P.1-B1-R1, implementation-level decision). Perl's `flock` on `<DARWIN_USER_TEMP_DIR>/tj-browser-lock-5175.flock` replaced the directory lock that section 9 and the T8P.1 note described, after two ocr rounds found races in its stale-holder takeover.
