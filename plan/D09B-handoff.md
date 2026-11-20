# Handoff: `claude-opus-5.5`, implement D9, stage B (the option estimates)

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, stage B's specifics and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-19, when D9A-R's gate closed (`c2431d50`, tagged `claude-opus-5.5-d9ar`), and updated after the D9A-R retrospective (`a574d196`, tagged `claude-opus-5.5-d9ar-post-retro`). The breakdown is unchanged since revision 107.

This session **implements stage B of D9, "Trade replay": the option estimates**. For an option Trade, the replay gains three figures, each labelled "estimate": the option's implied volatility, how many shares the Position behaves like, and how the option's Mark change splits between the Underlying's move, time passing and volatility. They help the trader catch a wrong Mark and learn how options move. They never change a P&L, a risk figure or a condition's status. The breakdown is [D09-trade-replay.md](D09-trade-replay.md):
- stage B is nine tasks: T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28;
- agreed by the user on 2026-11-17 as **decision 117** (revision 106), with stage B's words W47, W48, W49 and W50 approved (open question 10);
- **amended for D9A-R by decision 118** (revision 107; D9A-R's breakdown, section 10). The amendments are already written into D9's breakdown: the odds decision row above T9.20's cases; the chips and the "since" line rendered in the overlay; table columns become session-card rows;
- run **one task at a time** (decision 100; open question 2, P119), not as a swarm. There are no lanes, lane worktrees or merges. Pending questions follow **decision 113 as amended by decision 115**: one question at a time, the others queued.

Task status lives in the breakdown's Progress section (section 15). Stage B's rows have no wave or lane.

Where things stand:
- **D9A-R: closed 2026-11-19 by the user's decision**, tagged `claude-opus-5.5-d9ar` at `c2431d50`. Critic-3 passed every flow. Its one moderate defect and two low defects were moved to tech debt (`evidence/D09AR/tech-debt.md`), which the user reviews before this stage starts (section 7, "Open questions").
- **The D9A-R retrospective** changed the code after the gate, up to `claude-opus-5.5-d9ar-post-retro`:
  - lint now rejects a new nested ternary; the 76 existing ones are recorded in `eslint-suppressions.json`;
  - `e2e/d9ar` writes its screenshots to `test-results/d9ar-screenshots/`, so a run leaves `evidence/` untouched;
  - the replay's progress line, crossing line, stake sentence and phone label strip now draw through `Words`, and a new strict spec, `e2e/d9ar/sweep.spec.ts`, checks the whole overlay at every session for figure text outside a `card-figure`;
  - `npm run report:labels` (`e2e/d9ar/label-sweep.spec.ts`, skipped in normal runs) reports chart labels drawn over; it is the tool for label work, and its 155 findings are one tech-debt item;
  - the agent rules changed. `ocr-review` marks "Style only" findings, which go to tech debt. Low critic defects go to tech debt (`critic-brief.md`). There are no "part 2" send-backs (`implementing.md`). A case that passes under its mutation is fixed or deleted (`tdd-task.md`). The main session saves the closing report and handoff.
- **The last complete cumulative run** is D9A-R's `gate3` (`evidence/D09AR/suite-runs/gate3-*.txt`, on `24a6a513`, full tier). It passed: unit 212 files, 2,485 tests; integration 135 files, 286 tests; browser 126 in `browser-1` (5.1 min), 79 in `browser-2` (4.8 min), 156 in `browser-3` (8.7 min); checks 14 of 14.
- **`browser-3` is over its 8-minute limit**: 8.2 minutes at `gate2` (before critic-2), and 8.7 at `gate3`. Stage B adds two more specs to it (B9.6, B9.7). This is the session's second question (section 3, "Two questions before T9.20").
- **No stage B code exists yet.** `src/domain/option-pricing/`, `replay-estimates.ts` and `eslint.estimates.config.js` are absent, and a replayed session carries no `estimates`. The frame's `renderSince` and `renderChips` slots exist (`replay.types.ts`, `frame.tsx`) and nothing fills them.
- **D9A-R's report** is `evidence/D09AR/report.md`, written at its close.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09B-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), ask the first of section 3's two questions, then **start the next task at once** as soon as nothing blocks it. Don't stop to report that the reading is done.

Continue through stage B's gate (T9.28) and the `claude-opus-5.5-d9b` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (every task commits here directly; stage B has no lanes) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, and stage B runs no benchmark (A265) |
| Frozen plan | tag `claude-opus-5.5-plan-r107` (decision 118). Stage B adds no revision of its own; D9A-R's handoff and this one are committed after it |
| Code stage B builds on | `claude-opus-5.5-d9ar-post-retro` (`a574d196`): D9A-R's gate, `claude-opus-5.5-d9ar` (`c2431d50`), plus the retrospective's changes |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes. |
| `git tag -l 'claude-opus-5.5-plan-r*' \| sort -V \| tail -1` | `claude-opus-5.5-plan-r107` at the first session. Afterwards, a later tag only for a revision approved in this stage. |
| `git log -1 --format=%s claude-opus-5.5-plan-r107` | `plan(D09A-R): handoff checked; frozen plan tag moved` |
| `git merge-base --is-ancestor claude-opus-5.5-plan-r107 HEAD && echo ok` | `ok` |
| `git rev-parse --short 'claude-opus-5.5-d9ar^{commit}'` | `c2431d50` |
| `git rev-parse --short 'claude-opus-5.5-d9ar-post-retro^{commit}'` | `a574d196` |
| `git diff --stat claude-opus-5.5-d9ar-post-retro HEAD -- src e2e tests tools package.json .claude/scripts .claude/agents` | Empty at the first session. Afterwards: only stage B's task commits. |
| `git log --oneline claude-opus-5.5-d9ar-post-retro..HEAD` | At the first session: only this handoff's updates (plan documents only). Afterwards also stage B's task commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `git tag -l 'claude-opus-5.5-d9b'` | Empty until stage B's gate closes. |
| `ls .claude/worktrees 2>/dev/null` | Empty, absent, or only this implementation's old lane worktrees (D9's `d09-<lane>`, D9A-R's `d09ar-<lane>`). Stage B creates none. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test passes. For reference, after the retrospective the unit stage (`npx vitest run --project unit`) was 2,487 tests and the integration stage 135 files, 286 tests. The unit stage also takes in the tooling tests, so `npx vitest run src` counts fewer. |

Once every check matches, record the exact Node version and the two test counts in `evidence/D09/provenance.md`, as a new row for stage B.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The old lane worktrees** under this worktree's `.claude/worktrees/` belong to this implementation, but stage B doesn't use them. Leave them alone.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D9A-R. The guard blocks shell and inline-script writes to project files: change them with the Edit and Write tools.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Pending decisions". Its "Running a swarm deliverable" section does not apply to stage B. Then, scoped (decision 45):

**The `specs/` baseline.** Read **`plan/spec-reading/D09.md`** as `implementing.md` says. Stage B leans on its entries for ADR 0007 (as amended by revision 106), the glossary's four Estimate terms ("Estimate", "Implied Volatility", "Share Equivalent", "Mark Change Split"), Trade Analysis's `replay` paragraph, the UI contract's sentence on Estimates, and AC-CALC-005. Revision 107's glossary term "No-Edge Odds" bears on the odds question (section 3). Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D09/structural.md`.

**The frozen plan (scoped):**
- **`plan/D09-trade-replay.md` in full.** Stage B's work is:
  - T9.20, T9.21, T9.22, T9.23, T9.24 and T9.25 in section 5;
  - T9.26, T9.27 and T9.28 in section 6;
  - I9.8 and I9.9 in section 7.1, B9.6 and B9.7 in section 7.2;
  - flows C9.5 and C9.6 in section 8;
  - P121, P122 and P137, A258 and A259, and the words W47, W48, W49 and W50.
  - Section 5's test Trades (R-BREN-U, R-CORV-D, R-DALE-D, R-AXIO-U) are what each case cites. Section 4.2's two stage B rows (marked B) list the files each task changes.
- **`plan/D09A-R-stage-a-refactor.md`**, as stage B builds on it:
  - section 10, "What D9's stage B and stage C must change" (already applied to D9's breakdown; read it to know why);
  - section 1.3's A267 (the odds), A274 (`replay=open`), A275 (the overlay's layout), A277 (the session cards), A280 (labels) and A286 (the split adapter);
  - section 1.6's W53 to W70;
  - section 15, Progress, for what D9A-R built.
  - Not its behavioral task text.
- **`plan/D09A-R-decisions.md`**: the user's eight decisions. Decision 4 (the odds) and decision 8 (the one "since" line) bear on T9.20 and T9.25.
- **`plan/implementation-plan.md`:** everything except the `## D10` through `## D28` definition sections. That covers decisions 1 to 118 (100 as amended by 111, 113 as amended by 115), the rules and cumulative obligations, the definitions through D9 and D9A-R, and the tech debt list.
- **`plan/acceptance-matrix.md`:** only the opening sections, and the AC-CALC-005, AC-CALC-004 and AC-UI-001 rows of D9's section 13.
- **`plan/D07-approved-words.md`:** conventions C1 to C8, with the D8R note above them.
- **The design:** `prototypes/replay/round-2.html`'s chips and the line under the charts, and `prototypes/replay/checks/model.js` (A258's reasons and thresholds). The prototype is a picture, not code to port: where it and the breakdown differ, the breakdown wins.
- **Evidence from D9A-R:** `evidence/D09AR/report.md`, `evidence/D09AR/critic-3.md` (its "Minor observations"), and `evidence/D09AR/tech-debt.md`.

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D09/DECISIONS-PENDING.md`, and pause only the tasks it blocks. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. Revision 108 (decision 119, the user's SB-Q2 answer) is the frozen plan from T9.20-D1 on. The next revision is r109, the next decision 120, and the breakdown's numbering continues at P154, A288 and W71. Editing the Progress section alone is not a revision.

## 3. Stage B specifics

### Evidence

Stage B's evidence goes under **`evidence/D09/`**, beside stage A's (D9's breakdown, section 9: `tdd.sh` maps `T9.n` there, and `full-suite.sh` maps `evidence/D09` to `e2e/d9`). The folder already holds `tdd-log.md` and `tdd-log/`, `structural.md`, `provenance.md`, `DECISIONS-PENDING.md`, `new-words.md`, `words-changed.md`, `suite-runs/` and `ocr/`. Add a heading "Stage B" in each file that has entries, and append below it. Two files are new:
- `tech-debt.md`, for the user's tech debt rule (section 5, "Working rules");
- `stage-b-report.md`, at the gate.

Stage A's critics are `critic-1.md` and `critic-2.md` in the same folder. Name stage B's critics **`critic-b1.md`, `critic-b2.md`, `critic-b3.md`**, with the report header `# D09 critic-b<n> report`, so nothing is overwritten.

### Two questions before T9.20

Ask them one at a time, in this order. The second is queued in `DECISIONS-PENDING.md` until the first is answered.

1. **The odds and the Estimate type** (the decision row above T9.20's cases, from D9A-R's section 10). D9A-R's odds read "about 8% : 92%", worded as an estimate, but they are exact arithmetic on the headline risk and reward (A267), held as fractions in Trade Analysis. Should they stay outside the `Estimate` type and the estimates rule, with a code comment saying why, or move under it? The planner's lean, which is the recommendation: **stay outside**, since no pricing formula or assumed rate is behind them, and revision 107 already named them "No-Edge Odds" apart from "Estimate". T9.20's brief waits for the answer. If the answer moves them under the rule, T9.20's cases change, which is a plan revision (r108).
2. **A fourth browser stage.** `browser-3` took 8.2 and 8.7 minutes at D9A-R's gate, over the 8-minute limit, and stage B adds `e2e/d9/estimates.spec.ts` and `estimates-a11y.spec.ts` to it. `implementing.md` says to add a `browser-4` stage for the newest folders above 8 minutes; the Bash tool's limit is 10. **Recommended:** a `browser-4` stage for `e2e/d9` and `e2e/d9ar`, as T9.1 added `browser-3` (`package.json`'s `test:e2e:4`, `full-suite.sh`, `run-complete.sh` and its test, `acceptance-commands.sh`, `suite-runner.md`, `implementing.md`), done as a structural task before T9.24, the first task to run the full tier. Options: that; leave it and accept the risk of a stage near 10 minutes; or a different split. This is not a planned task: run it only on the user's answer, as `T9.20-D1` or wherever the user places it.

Neither question blocks reading or the location checks.

### Run order

**First, before T9.20: D9AR-retro-7**, the user's direction of 2026-11-19 from the D9A-R retrospective. It is a structural task, briefed to a fresh `tdd-task`, and it changes test code only.
- **What to delete.** A browser case T9AR.24-B5 added passed before its fix and still passed with the fix disabled, so it never detected the defect it was written for (`evidence/D09AR/tdd-log/T9AR.24-B5.md`, the "First-run pass" note). In `e2e/d9ar/responsive-a11y.spec.ts`, delete the **375** instance of "should show no hover box or band from the Review card's Replay tap and after two taps on sessions at ${width}": make its `for (const width of [375, 320])` loop run at 320 only. Keep the 320 instance, which did fail without the fix.
- **Keep** "should leave the slider's value uncovered by any chart element for DALE from Trade Detail at 320". It also never detected B5's defect, but B5 part 2 renamed it to say what it does check, and the user chose to keep it.
- **Verify:**
  - `npx playwright test e2e/d9ar/responsive-a11y.spec.ts` passes with one fewer case than before.
  - `npx vitest run src/ui/cockpit/replay/corridor.test.tsx` passes unchanged (B5's unit cases stay).
  - `git diff --stat` shows only that spec.
- **Record:** the commit in `evidence/D09/structural.md` under "Stage B", and in this note's section 7.
- No ocr review (test-only deletion).

Then T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28, one at a time on `claude-opus-5.5`, in the Progress section's order. Each task ends with its own complete cumulative run (decision 100).
- **T9.20, T9.21, T9.22, T9.23** change the lint rule, a new pure module and Trade Analysis: no UI. Their complete runs are `browser-auto <base>`, which will mostly pick the task tier.
- **T9.24, T9.25** are UI: `browser-auto` picks the full tier.
- **T9.26** may run before T9.24 if convenient, since it is blocked only by T9.23; the Progress order is the default.
- **T9.27**, the browser suite, follows T9.25. Then a full-tier run, then **the gate, T9.28**.

### Other rules

- **The UI calculates nothing (ADR 0001).** Every estimate, share count, percentage and dollar figure comes from Trade Analysis as a finished value, through the replay view. The `*.props.ts` adapters select and format. Turning a finished figure into an SVG coordinate (the chips' small chart, the split's small bar) is drawing; working out a figure in `src/ui/` is a defect. Say this in the briefs for T9.24 and T9.25 and check it in each summary. Code under `src/ui/cockpit/` takes plain props, and only `*.props.ts` adapters import view types.
- **Estimates stay apart (P121).** No estimate enters a valuation, a risk or reward figure, a condition's status or a stored fact. `option-pricing` is read only by `replay-estimates.ts`, which is read only by `replay-series.ts`. I9.9 proves the exact figures don't read them.
- **Nothing later shows early** (P145). A session after the slider's is not in the DOM: no chip, no point of the small chart, no "since" line for it.
- **A gap stays a gap** (AC-MARK-004, P146). A session with no Mark is a gap in the small chart; nothing is bridged.
- **The overlay.** The replay opens as a full-page overlay, from Trade Detail's "Replay" button and from the Review card's (D9A-R's decision 3). The chips and the "since" line render inside it, through the frame's `renderChips` and `renderSince` slots. The overlay's own Escape closes it; a chip's small chart takes the first Escape (T9.24).
- **Words.** Screens use D9's W47, W48, W49 and W50, and D9A-R's W53 to W70 where they meet. A price is a **Mark**, never a "close"; the end of a session is "the close".
  - **Words no row covers** are not a stop: use the wording you would have recommended, and record each phrase in `evidence/D09/new-words.md`, under "Stage B", with the task, the screen and the nearest approved row. The stage report lists them for the user's approval (P135).
  - **The wording rule (P137), into the brief of every task that puts words on screen (T9.24, T9.25), pasted word for word.** This is D9A-R's copy (its breakdown, section 9), with only the evidence folder changed back to stage B's and "deliverable's" to "stage's":
    > Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance. What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the session cards. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the session cards); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09/words-changed.md`, by task, and listed in the stage's final report. Section 1.6 keeps the approved wording as the starting point.

    The main session copies each change from the task's summary into `evidence/D09/words-changed.md`, under "Stage B", by task.
- **What must not change.**
  - Every existing case keeps its expected values. Stage B's fields are additive. A changed expected value is a defect.
  - Every existing query-count proof keeps its exact request lists. The estimates read nothing new: they are worked out from the Marks the replay already reads.
  - No frozen fixture view changes (A263).
  - The shell's warnings and banners stay in place under the overlay, never dismissed or changed (P153).
  - `StopTargetSlider`, `rangePosition` and the Open list's order are stage C's.
- **TDD discipline.** Run each case red, then green. Never write a test after its code, and back out code written before its red. A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is flagged in section 7's open questions. Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
- **ocr reviews every commit in place**, test-only commits included (`.claude/ocr-rule.json` brings test files in); nothing is relocated.
- **Known flaky cases (P138).** Tech debt item 11's case (`TradeList.test.tsx`, the Ready state) and the `PositionChangeForm` focus case ("should move focus to the Record entry heading when the form finishes loading"). If either fails a run, have the runner rerun it alone once. A pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. Any other failing test is a failure: reproduce it with one targeted run and fix it in a fresh subagent.
- **Tech debt.** Don't fix the tech debt list's items unasked, nor D9A-R's three (section 7).
- **No benchmark** (A265). It runs once, after stage C.

### The gate (T9.28)

1. Run the full tier with `suite-runner` until it passes.
2. Run `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`. Every command must pass except AC-REV-002's (`e2e/d9/meter-review.spec.ts`), which names stage C's file and fails by design until stage C lands. Any other failure is a defect. After stage B, AC-CALC-005's `d9/estimates` command must pass.
3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with:
   - flows C9.5 and C9.6, opening the replay through the overlay (D9A-R: the pass conditions are unchanged);
   - what D9's section 8 says the critic receives, and its future-capability list, which names the meter as not a defect in stage B;
   - D9A-R's answered decisions and its closed tech debt items as not defects;
   - the 375 and 320 px checks;
   - port 5175 under the lock;
   - a fresh browser profile for every build (the app's service worker serves a profile's cached build, so a reused or copied profile shows stale code unless its `Default/Service Worker` folder is deleted);
   - its scratch in `test-results/critic-d09b-<n>/`;
   - no reading of the rest of `evidence/` or of another worktree.
4. Save each report with `node tools/agent-report.ts "# D09 critic-b<n> report" > evidence/D09/critic-b<n>.md` as soon as the critic hands back, never by retyping it (`critic-brief.md`). Copy its cost (tokens, tool calls, time, from the completion notice) to `structural.md`'s critic table.
5. **Critic rules.**
   - **High and moderate defects are fixed.** Each is first reproduced by a failing test, then fixed as a bug task in a fresh `tdd-task`. After the last fix, one full run.
   - **Low defects go to `evidence/D09/tech-debt.md`**, not to tasks (the user's rule, section 5). A critic that finds only low defects closes the gate.
   - A fresh critic repeats both flows whenever any high or moderate defect was found.
   - At most three critics (P138). If the third still leaves a moderate defect, the defect is recorded as tech debt and the gate closes; ask the user first, as D9A-R did, since P138's advance approval was given for stage A's defects. A high defect or a FAIL always stops the run.

## 4. What is in place

Build on these. Read the code before extending it. Paths are on `a574d196` (`claude-opus-5.5-d9ar-post-retro`).

| Piece | Where | Notes for stage B |
|---|---|---|
| Trade Analysis | `src/domain/trade-analysis/evaluate.ts`, `replay-series.ts` (`replay`, `ReplayedSession` with `figures`, `markers`, `plan`, the odds and first crossings from D9A-R) | T9.22 adds `replay-estimates.ts`; T9.23 adds `estimates` to the session. `riskChange` and `rewardChange` are gone (T9AR.21). |
| Replay assembly | `src/coordinators/replay/assemble-replay.ts` (`assembleReplay`) | T9.23's pass-through. |
| Replay views | `src/coordinators/trade-views/replay-view.ts`; `src/coordinators/daily-review/types.ts` (`DailyTradeReview.replay`) | View types only. The Review card reads the replay in `getTrade` and shows it only in the overlay. |
| The overlay | `src/ui/cockpit/replay/overlay.tsx` (`ReplayOverlay`; its Escape handler), `overlay.props.ts`; `src/ui/cockpit/styles/replay-overlay.css` | The chips and the "since" line render inside it (T9.24, T9.25). |
| Trade Detail's wiring | `src/ui/screens/trade-detail/Cockpit.tsx`, `src/ui/screens/TradeDetail.tsx` | The "Replay" button opens the overlay; `replay=open` in the address (A274). |
| The frame | `src/ui/cockpit/replay/frame.tsx` (`ReplayFrame`), `replay.types.ts` (`renderSince`, `renderChips` slots, unfilled) | T9.24 and T9.25 fill the slots. |
| The adapters | `src/ui/cockpit/replay/replay.props.ts`, `session-words.props.ts`, `stake-words.props.ts`, `readout.props.ts`, `plot.props.ts`, `cards.props.ts`, `overlay.props.ts` | T9.25 owns the estimate rows of `readout.props*` and `cards.props*` (section 4.2). |
| The readout | `src/ui/cockpit/replay/readout.tsx`; `src/ui/cockpit/styles/replay-readout.css` | T9.25: "Implied volatility" under Marks, the share equivalent under Position. |
| The session cards | `src/ui/cockpit/replay/session-cards.tsx` (`SessionCards`), `src/ui/cockpit/card-pager.tsx` (`CardPager`); `src/ui/cockpit/styles/replay-cards.css` | T9.25 adds both estimates as rows of each card. |
| Figures that never break | `src/ui/cockpit/replay/figure-parts.ts` (`figureParts`), `figure-words.tsx` (`Words`) | Use `Words` for any text holding a figure, so a sign never wraps away from its amount. `e2e/d9ar/sweep.spec.ts` fails on any figure text in the overlay outside `Words`, so T9.24's chips and T9.25's rows must use it. |
| The chart | `src/ui/cockpit/replay/corridor.tsx`, `corridor-pnl.tsx`, `price-strip.tsx`, `geometry.ts` (`LabelPlacer`, with `reserveColumn`; `timeAxis`) | Unchanged by stage B. |
| Review card | `src/ui/screens/ReviewCard.tsx` (the "Replay" button), `CardFigures.tsx` (the summary in the replay's words) | Unchanged by stage B. Critic-3's moderate defect is in `CardFigures.tsx` (section 7). |
| About page | `src/ui/screens/AboutView.tsx` | T9.24 adds "Option estimates" (W50). |
| Suites | `tests/integration/d9/`, `tests/integration/d9ar/`; `e2e/d9/` (`support.ts`), `e2e/d9ar/` (`support.ts`, which re-exports `e2e/d9/support.ts` and adds `buildReview`, `detailReplayButton`, `closeButton`, `expectFitsOneScreen`, `expectOneLine`) | T9.26 adds `estimates.test.ts` to `tests/integration/d9/`; T9.27 adds `estimates.spec.ts` and `estimates-a11y.spec.ts` to `e2e/d9/`. |
| Tooling | `.claude/scripts/tdd.sh`, `full-suite.sh`, `run-complete.sh`, `acceptance-commands.sh`, `with-browser-lock.sh`, `status.sh`; `package.json` (`test:e2e:3` runs `e2e/d8p e2e/d8 e2e/d9 e2e/d9ar`) | A `browser-4` stage only on the user's answer (section 3). |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the Co-Authored-By line the session's system reminder gives.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task`, working on `claude-opus-5.5` in this worktree, without `isolation`.
- **Runs (decision 111's tiers, for one task at a time).** One complete cumulative run after each task, with `browser-auto <base>`, where `<base>` is the commit in the task's Progress row; and the full tier before every critic. Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen. Run `run-complete.sh evidence/D09 <label>` before recording any run.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Copy each output to `evidence/D09/ocr/<task>-<sha>.json`.
  - **Only ocr's own Valid or Doubtful *correctness* findings become bug tasks** (the user's rule, 2026-11-19).
  - **A style-only finding goes to `evidence/D09/tech-debt.md`**, not to a task, Valid or not.
  - A Wrong finding is dismissed with its reason, checked against the cited lines.
  - A reviewer's or subagent's own note is recorded in `structural.md`, never made a bug task.
- **Tech debt (the user's rule, 2026-11-19).** Style-only ocr findings and low critic defects go to `evidence/D09/tech-debt.md`: source, kind and item, one row each. The list is reviewed with the user after the gate.
- **No "part 2".** Never send a task back for a second part on the strength of reviewer notes. A task is done when its planned cases pass and ocr's correctness findings are fixed.
- **Follow-on IDs.**
  - **B** is a bug task, for correctness (`T9.21-B1`).
  - **F** is a follow-on for maintainability (`T9.21-F1`).
  - **D** (`T9.21-D1`) is only for carrying out the user's answer to a pending decision.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D09` as a whole; add the files you mean.
- **Refer to sections in words**, never with the section sign. List each task ID ("T9.20, T9.21, T9.22"), never a range.
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
- `acceptance-commands.sh` can't pass its commands, AC-REV-002's excepted, without a revision.

Not pending decisions: a screen text no approved word covers (P135), a text a task shortens under P137, and a style-only or low item sent to tech debt. Each is recorded and reported.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

### When the gate closes

1. Mark D9's section 13 rows covered where stage B completes every task they list (AC-CALC-005 and AC-CALC-004; AC-UI-001 waits for stage C's T9.29 and T9.34), and tag **`claude-opus-5.5-d9b`** locally.
2. Write `evidence/D09/stage-b-report.md`: tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics with their cost, the tech debt list, the new words awaiting approval, every text shortened under P137 with its before and after, and the wall-clock time against the breakdown's estimate (about 7 hours serial, section 3).
3. Write **stage C's handoff, `plan/D09C-handoff.md`**, in this note's form, for T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38 and T9.39, run one task at a time (decision 100). Carry the "Starting a session" paragraph, these stop conditions, the notes below that name stage C's tasks, and D9A-R's section 10 amendments to T9.29 and T9.33. Stage C ends with the benchmark (decision 114) before the `claude-opus-5.5-d9` tag.
4. Remove `.claude/session.lock`. Never push.

The main session saves the report and the handoff itself (`implementing.md`, "Final report"). A subagent that drafts one returns it as text.

## 6. Out of scope

- **Stage C** (the meter and the Open list's order: T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39).
- **Refining the estimated odds with volatility** (D9's section 10 follow-on; D9A-R's decision 4): a new task for the user to commission, not part of T9.21 or T9.22.
- **The breakdown's other follow-ons** (D9's section 10): Ribbon, spreads, Daily Bar candles, Deviation and revision markers, sorting and filtering on the Trades list.
- **The benchmark** (A265), a second browser port, and the tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D9 stage B progress

Task status and commits are in D9's breakdown, Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- For T9.23: `replay-series.ts` was lane DM's in D9A-R and is now T9.23's. Stage B adds `estimates` to the same session shape; keep `figures` free of any number type. `riskChange` and `rewardChange` were removed by T9AR.21; the "since" figures come from the session's `change`.
- For T9.24, T9.25, T9.27: inside the overlay, `.replay-card` is a grid (`replay-overlay.css`): `minmax(0, 1fr)` and `372px` columns, `.replay-chart-box` in column 1, `.replay-readout` in column 2, every other child full width below. The frame renders `renderSince` and `renderChips` as plain children of the card, so they land full width by default. W48 puts the "since" line under the charts' column, so T9.25 must place it in column 1.
- For T9.24, T9.25, T9.27: the phone fit is tight. At 320 by 667 the headline and both charts already use almost all of the 588.9 px B9.5 allows; the price chart gave up 13 px for it (T9AR.12-D1), and W64's crossing sentence moved below the charts on a phone (T9AR.18-D1). Chips and the "since" line must sit below the charts on a phone, or B9.5's fit check fails at 320.
- For T9.24, T9.27: the overlay's Escape handler (`overlay.tsx`) closes the overlay. A chip's small chart must take the first Escape and stop it there, leaving the overlay open (T9.24's amended case); B9.7's "focus returns to the chip" stands. Critic-3 saw focus reach the "Replay" button a moment after Close or Escape following a reload; read focus after it settles.
- For T9.25: the "since" sentence builds on the Trade P&L's "since" line, the one place that line still stands on a figure (D9A-R's decision 8). Critic-3 saw "up $0.00 since Thu Nov 19" on an expired put's final session (DALE, Fri Nov 20). W48's line must not repeat it there: a final session has no option Mark change to split.
- For T9.25: the second `describe` of T9.25's cases still reads "estimates in the readout and the table". D9A-R's section 10 retitled the task to "… in the readout and the session cards", and its last case already says "rows of each session card". Use "the session cards" in the `describe` title; record it in `structural.md` as following section 10, not as a P137 change.
- For T9.27: B9.6 and B9.7 open the replay through the overlay (`detailReplayButton` in `e2e/d9ar/support.ts`), and B9.7 measures the chips' small charts at 375 and 320 inside the full-screen overlay. Their specs join `browser-4` (`test:e2e:4`, which runs `e2e/d9` and so `e2e/d9ar`; T9.20-D2).
- For T9.28: critic-3's other minor observations, for the critic to know and not report again as new: a reload with the overlay open lands on the latest session (A274 allows it); a final session's headline has no R; the Review card writes "+3.05R" where the replay writes "3.05R"; the key's "Stop breached" and "Target reached" swatches are black while the chart's flags are red and green; the hover box can cover the cursor's own value; at 320 the axis drops the cursor's date (W67); P153's read-only and "another tab" banners were not triggered.
- For T9.33 (stage C): the card's body now holds a "Replay" button and no chart; `e2e/d5r/review.spec.ts` line 28 was changed by T9AR.20, on different lines from T9.33's five.
- For T9.29 (stage C): "Banked +$400.00" in the meter's name reads "Realized −$440.00" when what was realized is a loss (D9A-R's W57); one case is added for it.
- For T9.33, T9.40 (stage C): stage A and D9A-R leave `StopTargetSlider` and `rangePosition` exactly as they are.

### Open questions

- D9AR-retro-7 done 2026-11-19 at `3618dcb0`: T9AR.24-B5's 375 instance deleted from `e2e/d9ar/responsive-a11y.spec.ts` (20 cases listed before, 19 after; the spec passed, 19 in 1.1 min; `corridor.test.tsx` 80 passed, unchanged). Recorded in `evidence/D09/structural.md`, "Stage B". No ocr review (test-only deletion).
- T9.20 done (`aa5a5c79`; B1 `273df21d`; B2 `4228114d`). First-run pass, flagged: case 5 "should pass every file of the current tree", mutation-checked (1 failed under the mutation). One ocr finding dismissed as Wrong (the `replay-estimates.test.ts` exclusion; reason in `structural.md`). Process slip in T9.20-B1, corrected by the subagent: fix written with its tests, then backed out for genuine reds.
- SB-Q2 answered (c): T9.20-D1 (remove `e2e/d9`'s duplicates of `e2e/d9ar`, rename stale titles; r108 if an acceptance command's file is emptied) and T9.20-D2 (`browser-4`), after T9.20 and before T9.21. SB-Q3 answered: D9A-R's three tech debt items stay tech debt.
- T9.20-D1 done at `f1209b94` (one duplicate deleted: B9.5's offline reload; stale names fixed; ocr clean after one retry for an overloaded server) and T9.20-D2 at `8d8f37c2` (`browser-4`; ocr clean). One complete run, `t9.20-d2`, covered both (main session's choice): every stage under 8 minutes (browser-3 4.2, browser-4 4.5). T9.20-D2's subagent noted `.claude/settings.json`'s allow list may not cover `npm run test:e2e:4` (relayed to the user; untouched).
- Tech debt item 1 (`evidence/D09/tech-debt.md`): the 76 suppressed nested ternaries, added by the user 2026-11-19.
- SB-Q1, the odds, answered 2026-11-19: option (a), they stay outside the `Estimate` type and the rule, with a comment (`DECISIONS-PENDING.md`).

- **D9A-R's tech debt, for the user to review before stage B starts** (`evidence/D09AR/tech-debt.md`). None is in a file stage B changes. If the user makes any of them a task, it runs before T9.20, with the ID the user's answer gives it (`T9AR.24-D<n>`).
  1. Critic-3's moderate defect: on the Review card (`CardFigures.tsx`), the past-a-line row sits under "Current Risk" or "Remaining Reward" ("Remaining Reward · Past the Target by $32.00 (0.10R)"), where the replay sets it above both headings (W56, decision 7).
  2. Low: finished Trades draw the At Stop and At Target lines with no label (A280).
  3. Low: labels drawn over away from the entry session ("Sold 2 at $4.00" under the Target line; "Realized −$440" under the sale line; the "No Mark" column label under the cursor; at 320, "Strike" under the price line, and a Mark dot on the slider value's minus sign).
- Stage A's provisional words (`evidence/D09/new-words.md`) and D9A-R's (`evidence/D09AR/new-words.md`) still await the user's approval, as do the texts shortened under P137 in both. Stage B's report lists its own.
