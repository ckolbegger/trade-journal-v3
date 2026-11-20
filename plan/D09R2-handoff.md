# Handoff: `claude-opus-5.5`, implement D9R2 (the Review's Marks grid)

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D9R2's specifics and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-20, when the user agreed D9R2's breakdown. The frozen plan is revision 112 (decision 123: D9R2), on top of revision 111 (decision 122: task levels; word-only decisions need no revision).

This session **implements D9R2, the Review's Marks grid**. Each Trade's Marks panel on the Review becomes a grid like Price History: a row per Instrument, a column per session (the Review Date, the previous session, then each earlier session missing a Mark), with one cell editor under it. A price typed in one Trade shows "Unsaved" in every Trade holding the Instrument, and one Save Marks saves every draft. Three small fixes come first: the Review card's "At the … Marks" heading, acknowledged sessions in Price History and the Journal, and Price History's gain and loss colours. The breakdown is [D09R2-review-marks-grid.md](D09R2-review-marks-grid.md):
- 17 tasks: T9R2.1, T9R2.2, T9R2.3, T9R2.4, T9R2.5, T9R2.6, T9R2.7, T9R2.8, T9R2.9, T9R2.10, T9R2.11, T9R2.12, T9R2.13, T9R2.14, T9R2.15, T9R2.16, T9R2.17;
- agreed by the user on 2026-11-20 as **decision 123** (revision 112), with its three questions answered and the words W71 to W81 approved;
- run **one task at a time** (P162; decision 100), in the Progress section's order. No lanes, lane worktrees or merges. Pending questions follow **decision 113 as amended by decision 115**: one question at a time, the others queued.

Task status lives in the breakdown's Progress section (section 14).

Where things stand:
- **D9 closed 2026-11-20**, tagged `claude-opus-5.5-d9` (`10a4689e`). Its final report is `evidence/D09/final-report.md`; its tech debt (`evidence/D09/tech-debt.md`, items 1 to 11) was reviewed with the user, and all open items stay tech debt.
- **No D9R2 code exists yet.** Since the D9 tag, only plan and evidence documents changed, plus the D9 stage C retro's tooling commit (`78a10e66`): `npm run test:e2e:specs` for subagents' browser runs, a lint rule for a price called a "close", a Reads lookup in the drafting guide, a benchmark note, and `status.sh --all`.
- **Waiting for later, not for this session:** the coach review of the Review page (`evidence/D09/coach-review-2-prompt.md`, untracked, the user's; leave it alone) runs after D9R2.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09R2-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), then **start the next task at once** as soon as nothing blocks it. Don't stop to report that the reading is done.

Continue through the gate (T9R2.17), the benchmark and the `claude-opus-5.5-d9r2` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (every task commits here directly; D9R2 has no lanes) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, used only for the benchmark after the gate |
| Frozen plan | tag `claude-opus-5.5-plan-r112` (decision 123) |
| Code D9R2 builds on | `claude-opus-5.5-d9` (`10a4689e`) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes except the untracked `evidence/D09/coach-review-2-prompt.md`. |
| `git tag -l 'claude-opus-5.5-plan-r*' \| sort -V \| tail -1` | `claude-opus-5.5-plan-r112` at the first session. Afterwards, a later tag only for a revision approved in D9R2. |
| `git merge-base --is-ancestor claude-opus-5.5-plan-r112 HEAD && echo ok` | `ok` |
| `git rev-parse --short 'claude-opus-5.5-d9^{commit}'` | `10a4689e` |
| `git diff --stat 78a10e66 HEAD -- src e2e tests tools bench package.json .claude/scripts .claude/agents` | Empty at the first session. Afterwards: only D9R2's task commits. (`78a10e66` is the D9 stage C retro's commit, after the D9 tag: `package.json`'s `test:e2e:specs`, `.claude/scripts/status.sh` and its test, `.claude/agents/tdd-task.md`, the wording lint rule and its suppressions.) |
| `git log --oneline claude-opus-5.5-d9..HEAD` | At the first session: only plan and evidence commits (the D9R2 drafting handoff, the breakdown's drafts, revision 112, this handoff, the D9 evidence the user reviewed) and the D9 stage C retro's commit `78a10e66`. Afterwards also D9R2's task commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `git tag -l 'claude-opus-5.5-d9r2'` | Empty until the benchmark passes after the gate. |
| `ls .claude/worktrees 2>/dev/null` | Empty, absent, or only this implementation's old lane worktrees (D9's `d09-<lane>`, D9A-R's `d09ar-<lane>`). D9R2 creates none. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:4175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run --project unit && npx vitest run tests/integration` | Every test passes: at D9's close, unit 224 files, 2,592 tests; integration 137 files, 294 tests. |

Once every check matches, record the exact Node version and the two test counts in `evidence/D09R2/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The old lane worktrees** under this worktree's `.claude/worktrees/` belong to this implementation, but D9R2 doesn't use them. Leave them alone.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D9. The guard blocks shell and inline-script writes to project files: change them with the Edit and Write tools.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Task levels" and "Pending decisions". Its "Running a swarm deliverable" section does not apply. Then, scoped (decision 45):

**The `specs/` baseline.** Read **`plan/spec-reading/D09.md`** as `implementing.md` says (D9R2 has no tag of its own; revision 112 added the Review's Marks sections to D9's list: S039, S042, S043, S046, S091, S094, S096 and S123). D9R2 leans on its entries for the Daily Review open and Save Marks, Market Data's read session and series, the UI contract, AC-REV-002, AC-REV-005, AC-REV-006, AC-MARK-003, AC-MARK-004, AC-JOUR-001, AC-UI-001, AC-UI-002 and AC-PERF-001. Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D09R2/structural.md`.

**The frozen plan (scoped):**
- **`plan/D09R2-review-marks-grid.md` in full.**
- **`plan/D05R-review-redesign.md`**: A150 to A163 (A153, A155, A156 and A161 most of all, with their decision 123 notes), section 6.3 and section 6.4 (the card helpers and the migration rule). Not its behavioral task text.
- **`plan/D05R2-review-card-progress.md`**: A171 and A172 (the held Review).
- **`plan/D08P-trade-detail-cockpit.md`**: A210, A214 and A216; W1, W9 and W19; section 10.2 (this follow-on).
- **`plan/D04-daily-review.md`**: A57.
- **`plan/D09-trade-replay.md`**: P133 (the Review open's second read session, beside which D9R2 reads), P137 and P138 (the run rules D9R2 keeps).
- **`plan/implementation-plan.md`:** everything except the `## D10` through `## D28` definition sections. That covers decisions 1 to 123, the rules and cumulative obligations (including "Benchmark once, at the end (decision 114, from D9)"), the definitions through D9R2, and the tech debt list.
- **`plan/acceptance-matrix.md`:** only the opening sections, and the rows of D9R2's section 12.
- **`plan/D07-approved-words.md`:** conventions C1 to C8, with the D8R note above them.
- **The design:** `research/review-page-style.html`, sections 4 to 10, open in a browser (no server needed): its mockups are the signed-off look (open question 1). Where the mockups and the breakdown differ, the breakdown wins. Its line numbers predate D9.

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D09R2/DECISIONS-PENDING.md`, and pause only the tasks it blocks. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r113, the next decision 124, and the breakdown's numbering continues at P163, A300 and W82. Editing the Progress section alone is not a revision, nor is a word-only decision (decision 122; `implementing.md`, "Plan revisions and evidence").

## 3. D9R2 specifics

### Evidence

Under `evidence/D09R2/`, as the breakdown's section 13 lists. `tdd.sh` maps T9R2 there, and `full-suite.sh` maps it to `e2e/d9r2`; `test:e2e:4` (`playwright test e2e/d9`) already includes `e2e/d9r2`. Create `tdd-log.md` before the first task.

### Run order and levels

The breakdown's section 4 and Progress section: T9R2.1, T9R2.2, T9R2.3, T9R2.4, T9R2.5, T9R2.6, T9R2.7, T9R2.8, T9R2.9, T9R2.10, T9R2.11, T9R2.12, T9R2.13, T9R2.14, T9R2.15, T9R2.16, T9R2.17. Each task's level is in the task graph (decision 122): Full for T9R2.5, T9R2.6 and T9R2.7; Light for T9R2.1, T9R2.4, T9R2.10, T9R2.15 and T9R2.16; Standard for the rest. Raise a task's level when its commits touch a higher level's paths; never lower it.

### Rules

- **The UI calculates nothing (ADR 0001).** Which cells a column holds, each cell's state and its binding come from the open result (`today`, `earlier`, `previousSession`, `earlierMarks`) through `held-review.ts` and the drafts module (A291, A292). Deciding a cell from those fields is presentation; working out a Mark, a gap or a revision in `src/ui/` is a defect. Say this in the briefs for T9R2.7, T9R2.9, T9R2.11, T9R2.12 and T9R2.13.
- **No added read** (A289, I9R2.4). `earlierMarks` comes from the open's existing read session's `series`, reusing the gaps scan; Instruments whose Trades all opened on the Review Date get no call. The open's store request list stays exactly D9's. A proof that can't keep it is a pending decision.
- **Additive fields only** (A290). An existing strict expectation that fails only because `resolutionRevision` appears gets exactly that field added, and is listed in `structural.md`. No frozen fixture view changes; a changed one is a pending decision.
- **The hold rules** (P156's table) are the riskiest change. Every existing case that holds a card with a Mark draft either switches to a form that still holds it or becomes "keeps the draft"; `structural.md` lists each one and which it was. Any other changed expected value is a defect.
- **Browser helpers move first** (T9R2.10, decision 65): mechanical edits only, every spec green on the old layout, before T9R2.11.
- **Price History looks the same after T9R2.8**: its test titles and expectations unchanged, and the before-and-after screenshots compared.
- **Retired unit cases** get a pairing table in `structural.md` (A299).
- **Words.** W71 to W81 are approved. A price is a **Mark**, never a "close"; the end of a session is "the close".
  - **Words no row covers** are not a stop: use the wording you would have recommended, and record each phrase in `evidence/D09R2/new-words.md` with the task, the screen and the nearest approved row.
  - **The wording rule (P137), into the brief of every task that puts words on screen (T9R2.1, T9R2.2, T9R2.3, T9R2.9, T9R2.11, T9R2.12, T9R2.13, T9R2.14), pasted word for word:**
    > Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance. What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the session cards. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the session cards); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09/words-changed.md`, by task, and listed in the stage's final report. Section 1.6 keeps the approved wording as the starting point.

    For D9R2 the record is `evidence/D09R2/words-changed.md` and the approved wording is the breakdown's section 1.7. The main session copies each change from the task's summary into it, by task.
- **TDD discipline.** Run each case red, then green. Never write a test after its code, and back out code written before its red. A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is flagged in section 7's open questions. Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
- **Browser access in subagents.** Tell every UI task's subagent to run the browser specs that cover its screens with `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- <spec files>` on port 5175 (one call that rebuilds every served folder, then runs them; `.claude/agents/tdd-task.md`), and to say so in its summary if it can't. In stage C, builds joined to a run with `&&` were refused, so subagents tested old builds.
- **Known flaky cases (P138).** Tech debt item 11's case (`TradeList.test.tsx`, the Ready state), the `PositionChangeForm` focus case ("should move focus to the Record entry heading when the form finishes loading"), and B8.16 (`e2e/d8/responsive-a11y.spec.ts:299`, tech debt item 3). If one fails a run, have the runner rerun it alone once. A pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. Any other failing test is a failure: reproduce it with one targeted run and fix it in a fresh subagent. `ReviewCards.test.tsx`'s links case (D9's tech debt item 7) was fixed by T9.29-D1; T9R2.14 changes the links, so a failure there is a failure, not a flake.
- **Tech debt.** Don't fix the tech debt list's items unasked (`evidence/D09/tech-debt.md`, `evidence/D09AR/tech-debt.md`). Item 11 (the Open list's "close") and the stale-context note's "close" (the breakdown's section 10) are not D9R2's.

### The gate (T9R2.17)

1. Run the full tier with `suite-runner` until it passes.
2. Run `.claude/scripts/acceptance-commands.sh plan/D09R2-review-marks-grid.md`. Every command must pass.
3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with:
   - flows C9R2.1, C9R2.2, C9R2.3, C9R2.4, C9R2.5 and C9R2.6;
   - the research page's mockups as the signed-off look, and what is out of scope (the rail, drawers, tabs, Replay's place on the card; breakdown section 2);
   - the standing tech debt items (`evidence/D09/tech-debt.md`, `evidence/D09AR/tech-debt.md`), named as known and not reported again unless D9R2 made them worse;
   - the 375 and 320 px checks;
   - port 5175 under the lock;
   - a fresh browser profile for every build (the app's service worker serves a profile's cached build, so a reused or copied profile shows stale code unless its `Default/Service Worker` folder is deleted);
   - its scratch in `test-results/critic-d09r2-<n>/`;
   - no reading of `evidence/` or of another worktree.
4. Save each report as soon as the critic hands back, with `node tools/agent-report.ts "# D09R2 critic-<n> report" > evidence/D09R2/critic-<n>.md`. If the report comes back as the Agent call's result rather than a hand-back message, take the text from the session transcript's task notification (from the heading to the end of the result), never retyping it. Copy its cost (tokens, tool calls, time) to `structural.md`'s critic table.
5. **Critic rules.**
   - **High and moderate defects are fixed.** Each is first reproduced by a failing test, then fixed as a bug task (`T9R2.17-B<n>`) in a fresh `tdd-task`. After the last fix, one full run.
   - **Low defects go to `evidence/D09R2/tech-debt.md`**, not to tasks. A critic that finds only low defects closes the gate.
   - A fresh critic repeats every flow whenever any high or moderate defect was found.
   - At most three critics (P138). If the third still leaves a moderate defect, ask the user. A high defect or a FAIL always stops the run.
6. **The benchmark** (decision 114; `implementation-plan.md`, "Benchmark once, at the end (decision 114, from D9)"). After the gate closes, with no development work left, run it once, alone, on port 4175, in this worktree, by that rule's steps. It re-proves AC-PERF-001's Review-open row and the restored capacity checks. A failure is a pending decision, not a fix to make unasked.

## 4. What is in place

- **Save Marks:** `src/coordinators/daily-review/daily-review.ts` (`saveReviewMarks`) binds the Workspace and takes 1 to 100 entries for any of the Review's keys (Market Data's `MAX_ENTRIES`, A154); `tradeId` only chooses the card `postMarksReview` refreshes. Unchanged by D9R2.
- **The Review open:** `assemble` in the same file reads the Review Date's session, a second session at the previous session for the meter (P133), and the gaps through `valueTrade`'s `withGaps`. Market Data's `historicalGaps` and `series` (`src/modules/market-data/market-data.ts`) share one scan per Instrument (A289 explains when).
- **The Review screen:** `src/ui/screens/ReviewView.tsx` (the card list, links, the hold and the status header), `ReviewCard.tsx`, `CardMarks.tsx` (today's rows, drafts and the gap list), `MarkEntry.tsx`, `held-review.ts`.
- **Price History:** `src/ui/cockpit/drawers/price-history.tsx`, `price-history.props.ts`, `price-history.types.ts`, `src/ui/cockpit/styles/history.css`; the Journal's cards in `journal.props.ts`.
- **Browser support to reuse** (A298): `e2e/d4/support.ts`, `e2e/d5r/support.ts` (`createCardFixture`), `e2e/d7/support.ts`.

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the Co-Authored-By line the session's system reminder gives.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task`, working on `claude-opus-5.5` in this worktree, without `isolation`.
- **Runs (decision 122's levels, one task at a time).** After a Full task, one complete cumulative run with `browser-auto <base>`, where `<base>` is the commit in the task's Progress row; after a Standard task, the same run with `browser-task`; after a Light task, none. The full tier before every critic. Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen. Run `run-complete.sh evidence/D09R2 <label>` before recording any run. Start a task's run only after its ocr reviews, and its bug tasks' reviews, are clean (`implementing.md`, step 3); don't run ocr and the suite side by side.
- **ocr reviews.** Every Full and Standard task's implementation commit, and each of its bug-fix commits, gets an `ocr-review`; Light tasks get none. Copy each output to `evidence/D09R2/ocr/<task>-<sha>.json`.
  - **Only ocr's own Valid or Doubtful *correctness* findings become bug tasks** (the user's rule, 2026-11-19).
  - **A style-only finding goes to `evidence/D09R2/tech-debt.md`**, not to a task, Valid or not.
  - A Wrong finding is dismissed with its reason, checked against the cited lines.
  - A reviewer's or subagent's own note is recorded in `structural.md`, never made a bug task.
- **Tech debt (the user's rule, 2026-11-19).** Style-only ocr findings and low critic defects go to `evidence/D09R2/tech-debt.md`: source, kind and item, one row each. The list is reviewed with the user after the gate.
- **No "part 2".** Never send a task back for a second part on the strength of reviewer notes. A task is done when its planned cases pass and ocr's correctness findings are fixed.
- **Follow-on IDs.**
  - **B** is a bug task, for correctness (`T9R2.11-B1`).
  - **F** is a follow-on for maintainability (`T9R2.11-F1`).
  - **D** (`T9R2.11-D1`) is only for carrying out the user's answer to a pending decision.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D09R2` as a whole; add the files you mean. Never add `evidence/D09/coach-review-2-prompt.md`.
- **Refer to sections in words**, never with the section sign. List each task ID ("T9R2.11, T9R2.12, T9R2.13"), never a range.
- **Asking.** Plain language first, then the context, the options with their tradeoffs, and a recommendation. One question per message; queue the rest (decision 113 as amended).
- **After each task:** update the Progress row and section 7 of this note, commit, and start the next task.

### Running a whole deliverable

Stop all work and ask the user **only** when:
1. the session lock exists, or a location check in section 1 fails;
2. nothing unblocked remains while a pending decision waits;
3. a fresh critic or a browser can't be provided, or three critics at the gate still leave a FAIL or a high defect (a moderate defect left by the third critic is asked about, section 3, "The gate").

These are pending decisions, asked one at a time while any unblocked task keeps going (decision 113 as amended):
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity: a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, or a changed frozen view;
- a suite failure, critic defect or ocr bug-task fix can't be fixed without such a deviation, or a third ocr round on one task still leaves correctness findings;
- a known flaky case fails twice in a row (P138);
- `acceptance-commands.sh` can't pass every command without a revision;
- the benchmark fails.

Not pending decisions: a screen text no approved word covers, a text a task shortens under P137, and a style-only or low item sent to tech debt. Each is recorded and reported.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

### When the gate closes

1. Run the benchmark (section 3, "The gate", step 6).
2. Mark D9R2's section 12 rows covered where the deliverable completes every task they list, and tag **`claude-opus-5.5-d9r2`** locally.
3. Write `evidence/D09R2/final-report.md` as `implementing.md`, "Final report", says: tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics with their cost, the benchmark's result, the tech debt list, new words awaiting approval, and every text shortened under P137.
4. Remove `.claude/session.lock`. Never push.

The main session saves the reports itself (`implementing.md`, "Final report"). A subagent that drafts one returns it as text.

## 6. Out of scope

- **The rest of the Review's restyle** (the rail, drawers, tabs, Replay's own place on the card): after the coach review, by the user's decisions. The breakdown's section 3 says what moving the grid into a Marks drawer would cost; don't build toward it beyond that.
- **Tech debt item 11** and the stale-context note's "close" wording.
- Editing in Trade Detail's Price History (it stays read-only).
- A second browser port, and the tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D9R2 progress

### Notes for later tasks

- For T9R2.15 and T9R2.16: the acceptance script fails on every D9R2 row until those tasks write their files; that is expected until then.

- For T9R2.11, T9R2.13, T9R2.14: `review-drafts.ts` (T9R2.7) has no draft list or count and no "newest draft's Trade" (P157's `tradeId` with no card open); `held-review.ts` exports no "is this key listed in the Review" helper for `keepOnly`'s predicate (`standing(held, key) !== undefined` would also keep a key learned only from a save; use `listedStanding(...) !== undefined`). The task that first needs each adds it, with a case. `saveEntries` returns entries in first-entered order and binds a key with no known standing at `'None'`.

### Open questions

- The location checks found 2 unit failures in `tools/wording-rules.test.ts` from the D9 stage C retro commit (`78a10e66`). The user chose a tools-only fix before T9R2.1 (2026-11-20): commit `ceefd574` (`chore(retro-D09C)`). The section 1 check `git diff --stat 78a10e66 HEAD -- …` therefore also lists `tools/wording-rules.test.ts` from that commit.
- First-run passes (mutation-checked by assertion; `structural.md`): T9R2.6 cases 2, 5, 6 and 8; T9R2.6-B1's case.
- A subagent note from T9R2.6, not a bug task: a Trade whose Review Date is the first covered session (2024-01-02) appears to crash `valueTrade` in `observationFrame`. Existing behaviour; for the final report.
