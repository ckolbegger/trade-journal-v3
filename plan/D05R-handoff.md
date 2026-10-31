# Handoff: `claude-opus-5.5`, implement D5R

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D5R specifics, what D5 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-31, after D5R was agreed. D5R is not one of the numbered deliverables. Plan revision 20 (decision 61) inserted it between D5 and D6, after the user reviewed the Daily Review and asked for it to be reorganized one position at a time.

This session **implements D5R, "Review redesign: one card per position"**, under the frozen plan at revision 20. The breakdown is [D05R-review-redesign.md](D05R-review-redesign.md). The user agreed all of it on 2026-10-31:
- P36–P41;
- A150–A163;
- P37 and P38, after a discussion that chose to save a card's Marks through a Daily Review command whose result carries the refreshed Review, rather than refreshing through `open`.

The visual reference is layout B of the Review prototype: `prototypes/review-workflow/index.html`, the "B · Choose next" tab, as of commit `e4bbc4b`.

Where things stand:
- **D5:** complete and tagged `claude-opus-5.5-d5` (`fbe3bb7`).
- **Code:** unchanged since the last complete cumulative run at `853469f`, which passed 893 unit, 105 integration and 155 browser tests and 12 of 12 checks (`evidence/D05/structural.md`, "Dependency bump"). Every commit since then is plan, evidence or prototype.
- **D6:** its handoff, [D06-handoff.md](D06-handoff.md), now carries a note that D5R runs first.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D05R-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next step in section 7 at once**, without stopping to report that the reading is done.

Continue task by task through the browser-critic gate and the `claude-opus-5.5-d5r` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r20` (revision 20) |
| D5 release | tag `claude-opus-5.5-d5` (`fbe3bb7`) |
| D5R starting point | tag `claude-opus-5.5-pre-d5r` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`, where N is 11 at `claude-opus-5.5-pre-d5r` and grows with each D5R commit. No uncommitted changes. |
| `git log --oneline claude-opus-5.5-pre-d5r..HEAD` | Empty at the first session. Afterwards, only D5R task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r20`, `claude-opus-5.5-d5` and `claude-opus-5.5-pre-d5r`. |
| `git rev-parse claude-opus-5.5-d5` | `fbe3bb71dcc7114e7f0568272be48f0412cfeab8` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes. At `claude-opus-5.5-pre-d5r`: 69 files and 893 tests (unit), and 53 files and 105 tests (integration). The browser suite (`npm run test:e2e`) had 155 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D05R/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes:
- other sessions' scratch, task-output and Playwright directories;
- processes you did not start. Other worktrees' preview servers run on other ports; leave them alone.

Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates:
- the scoped reading below;
- delegating each task to the `tdd-task` subagent, and writing its brief;
- the `ocr-review` run, and bug tasks, after each task;
- recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D5R uses, as decision 45 directs.

**The `specs/` baseline (scoped).** D5R has no reading list of its own: `.claude/scripts/spec-reading-lists.py` names deliverables by number. Every section D5R uses is already core or tagged for D5, with one exception (D5R breakdown, section 10). So:
- Read [plan/spec-reading/D05.md](spec-reading/D05.md), then exactly the files and line ranges it lists, each range in full.
- Then read **AC-MARK-004**, `specs/acceptance/acceptance-contract.md` lines 289–295 (spec map entry S047).

Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, and read that section in the spec before building on it. Note any such section in `evidence/D05R/structural.md`.

**The frozen plan (scoped):**
- **`plan/implementation-plan.md`:** everything except the `## D6` through `## D28` definition sections. That leaves:
  - decisions 1–61;
  - the rules and cumulative obligations;
  - the freeze record;
  - the D1, D2, D4, D5 and D5R definitions;
  - the closing sections: parallelism, coverage index, review queue (including "Raised by the D5R breakdown"), and tech debt.
- **`plan/technology-stack.md`:** in full, including "Pinned versions".
- **`plan/acceptance-matrix.md`:** only the opening sections, through "Evidence methods common to every row". D5R's rows are in section 8 of its breakdown. Look up any other row by its scenario ID only when you need it.
- **`plan/D04-daily-review.md`:**
  - sections 1, 2, 3, 5 and 6;
  - in section 1, especially P10–P15, A38, A45–A48 (bindings, coherent reads, the Mark save result), A53 (frames), A56–A60 (the Marks family, the screen, the Action form and links, which D5R supersedes or keeps);
  - from section 4, also the cases of T4.7 (Market Data `save`), T4.14–T4.16 (the Review coordinator) and T4.21 (Mark entry), because D5R rebuilds or moves them.
- **`plan/D05-deferred-reflection-and-journal-debt.md`:** sections 1, 2, 3, 5 and 6, especially A64 (Journal's prepare and apply), A67 (the post-commit Review result), A68 and A71 (reflections in the Review), and the amendments by decisions 56–59.
- **`plan/D05R-review-redesign.md`:** in full. This is the work.
- **D1 and D2 breakdowns:** don't read them up front. Look up a section only when a brief needs it.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r22 and the next decision is 63 (r21 and decision 62 were made during T5R.3). Updating an acceptance row's status is not a revision. D5R adds no row, though: it re-proves existing rows, and the AC-REV-002 row already carries D5R's note.

## 3. D5R specifics

- **Setup before T5R.1: `tdd.sh` must accept D5R's task IDs.**
  - **The problem:** `.claude/scripts/tdd.sh` maps a task ID `T<n>.<m>` to `evidence/D<nn>/tdd-log.md` and rejects anything else. `T5R.1` doesn't match.
  - **The task:** delegate a small structural task, "setup: tdd.sh accepts T5R task IDs", to a fresh `tdd-task` subagent. It makes the script accept `T<n>R.<m>` and log to `evidence/D<nn>R/tdd-log.md` (so `T5R.1` → `evidence/D05R/tdd-log.md`), with every other ID mapped as before.
  - **Verification:** run it before the D05R log exists, so nothing is appended. `.claude/scripts/tdd.sh red T5R.1 x y` prints `no log at evidence/D05R/tdd-log.md`, and `.claude/scripts/tdd.sh red T99.1 x y` prints `no log at evidence/D99/tdd-log.md`. Record both outputs in `evidence/D05R/structural.md`.
  - **Afterwards:** create `evidence/D05R/tdd-log.md` with its header note. The `suite-runner`, `ocr-review` and critic briefs take `evidence/D05R` as the evidence directory.
- **Order.** Run tasks one at a time, in task-graph order: T5R.1 through T5R.16 (section 3 of the breakdown).
  - The breakdown's "parallel tracks" describe which tasks are independent. Don't run them concurrently.
  - The types T5R.6 checks (the prepared Mark effect, `SaveReviewMarks` and `MarksSaved`, the range position, the Plan baseline) are introduced by the tasks that first need them: T5R.1, T5R.3, T5R.4 and T5R.5. They go in `src/coordinators/daily-review/types.ts` and Market Data's types, next to their neighbours.
- **The breakdown was written against the built code,** unlike D6's, so its seams name real code. Give each brief these pointers rather than having the subagent search.
  - **Daily Review** (`src/coordinators/daily-review/daily-review.ts`):
    - `open` calls `assemble(context, withGaps = true)`, which runs `marketData.recover` with the historical-gap scan.
    - The Action save is `attemptSave`. The sequence is `checkBinding`, then `journal.prepareEffects`, then `beginSemanticTransaction`, then `tx.require` checks, then `journal.applyPreparedEffects(tx, prepared)`, then `persistence.commit(tx.close())`, then `postSaveReview`.
    - `postSaveReview` assembles with `withGaps = false` (Review-date frames only), then calls `getTrade` for the next step.
    - **`SaveReviewMarks` (T5R.5) follows the same shape**, with Market Data's prepared effect in place of Journal's (A155).
  - **Overview types** (`src/coordinators/daily-review/types.ts`): `ReviewTradeItem`, `PressureBasis` (one side only today, which is why P39 adds a range position), `WalkedTrade`, `MarkRow`, `HistoricalGapGroup` (no Trades today; T5R.3 adds them), `DailyTradeReview` (no Plan baseline today; T5R.4 adds it), `PostSaveReview`.
  - **Market Data** (`src/modules/market-data/market-data.ts`): `save` and `saveAcknowledgment` today validate, read a snapshot of the key, compare `expectedResolutionRevision`, build the new `ObservationRecord`, and commit with a `keyUnchanged` check. T5R.1 splits exactly this into `prepareEffects` and `applyPreparedEffects` (A154). Journal's `prepareEffects` and `applyPreparedEffects` (`src/modules/journal/`) are the pattern to follow.
  - **Persistence:** `src/persistence/semantic-transaction.ts` (`require`, `stage`, `close`). `persistence.commit` verifies every check in one read-write transaction and returns `Conflict` with nothing written. The `RuntimeNotWritable` recheck lives in `commit`.
  - **Trade Analysis:** `evaluate` is in `src/domain/trade-analysis/`. Reward : risk now (T5R.2) is computed there (ADR 0001), never in the UI.
  - **UI:**
    - **Retired:** `src/ui/screens/ReviewView.tsx` (the Marks family and Continue to Trades), `ReviewTrade.tsx` (the card placed below the list) and `ReviewReflections.tsx`.
    - **Kept with their tests:** `MarkEntry`, `DebtForm` and `ActionForm`, reused inside the new panels.
    - **Reused for figures:** `review-attention.ts` (band text), `src/ui/figures.ts` (figures in words), `src/ui/format.ts` (`ratio`, `rMultiple`), and Trade Detail's `RiskRewardSection`, `ExposureFigures` and `AtEntrySection` in `TradeDetail.tsx`.
    - **Colours:** tokens are in `src/ui/app.css`.
- **The prototype is a picture, not code to copy.** UI briefs point the subagent at layout B for layout, spacing and the slider:
  - the red-to-green track;
  - the entry tick and the Mark dot;
  - the pinned shape past an end;
  - the grey track with no dot;
  - a fixed-width side column so sliders line up;
  - a static header at narrow widths.

  Build it in the app's React idiom and CSS tokens, not the prototype's vanilla JS. Where they differ, the breakdown wins: Hold is preselected (A159), and issues come back from the command (A160).
- **Keep the cumulative suite green across the UI change.** T5R.8 retires Continue to Trades and the Marks family view, which breaks the D4 and D5 browser cases and the unit tests of the retired views.
  - **Unit tests:** in the same task, the subagent replaces those views' unit tests with the new ones (breakdown section 6.3).
  - **Browser cases:** in the same task, it moves the D4 and D5 browser cases onto cards. That happens once, in `e2e/d4/support.ts` and `e2e/d5/support.ts`, plus `review.spec.ts` and `responsive-a11y.spec.ts` in `e2e/d4`. No expectation about saved data, completion or durable state may change.
  - **Evidence:** the moved run is the first suite run section 11 asks for. Record it in `structural.md` before any `e2e/d5r` case exists.
  - **Later UI tasks:** T5R.9–T5R.12 keep those helpers green as the panels arrive.
- **No storage change (A163).** There is no schema version, migration, fixture freeze, capacity basis or release-harness change.
  - **Fixtures:** never regenerate the `workspace-v1` to `workspace-v4` fixtures.
  - **Release harness:** its `d5` label keeps building from current source, which becomes D5R's code. Since the schema is unchanged, the upgrade cases still hold.
- **Writes follow ADR 0011 (decision 52).** Persistence `commit` checks exact-key bindings, with no in-transaction read or increment.
  - **Market Data:** it has no shared counter (decision 53). A `SaveReviewMarks` Conflict is reported to the trader, never silently retried.
  - **The Action save's counter retry:** keep it as it is.
- **Keep the Review fast.**
  - **`SaveReviewMarks`:** its post-save assembly reads Review-date frames only, with no `recover` and no gap scan (P38). T5R.13's request counts are the guard.
  - **Gap groups:** T5R.3 must add no request to `open`; it computes them from what `open` already reads.
  - **Tech debt item 3:** opening the Review costs about 2.2 s on the benchmark profile. **Don't fix it in D5R**; T5R.13 only measures it.
- **Benchmark (T5R.13).** D5R changes no data, so the cached profile in `.cache/bench/profile` (generator 3) is used as is. If it is missing, run `bench:generate` in the background (about 100 minutes) and keep working.
  - **Timings:** T5R.13 adds disclosed, ungated timings for "open the first card", a `SaveReviewMarks`, and a `SaveTradeAction`. The Action save's post-save rebuild has never been timed.
  - **Gated thresholds:** they stay at a nearest-rank p95 of 2,500 ms cold and 1,500 ms warm. D5's results were cold 104.8 ms and warm 43.6 ms.
  - **Results** go in `evidence/D05R/bench.md`. The bench serves on `BENCH_PORT = 5181`; every other server uses 5175.
  - **Never run `bench:run` alongside a browser suite.**
- **Clock pinning in tests.** This Chromium has native Temporal, and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`.
  - **Browser cases:** every pinned case must also patch `Temporal.Now`, using `launchAt`, `pinClock` or `setClock` from `e2e/d4/support.ts` (re-exported by `e2e/d5/support.ts`).
  - **Faults build:** its `?clock=` (A49) pins both.
- **TDD discipline.** Run every `it should` case red, then green, one at a time, through `tdd.sh`, which logs to `evidence/D05R/tdd-log.md`. Playwright reds and greens are logged by hand.
  - **Code written before its red** is backed out and rerun to a genuine red.
  - **A case that passes on its first run** gets the mutation check in the `tdd-task` agent: an assertion failure or runtime exception, never a compile error or an actionability timeout. It is flagged for the user. Never fabricate a red.
  - **T5R.1's last case** (the D4 `save` cases through the prepared path) is a planned regression guard. Its red is shown by a mutation that bypasses `applyPreparedEffects`, and it is flagged as the breakdown says.
  - **Structural tasks** record their exact verification in `evidence/D05R/structural.md`.
  - **Engine and OS versions** go in `evidence/D05R/provenance.md`.
- **Browser mutation builds.** The release tests serve `dist-releases/<label>`, not `dist`.
  - **Rebuilding for a mutation:** a mutation check on a browser case must rebuild the served release with `TJ_BUILD_LABEL=d5 npx vite build --outDir dist-releases/d5 --emptyOutDir`. A plain `vite build` leaves it unchanged, so the mutation "passes" (D5's T5.24-B1).
  - **Afterwards:** rebuild clean after restoring.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build.
  - **`test:e2e`:** T5R.15 extends it with `e2e/d5r`.
  - **A single browser failure:** rerun it once alone before treating it as real, and record both outcomes.
- **ocr on test-only commits.** `ocr` excludes test files, so a commit that only adds tests reviews almost nothing in place.
  - **The workaround:** brief the `ocr-review` agent to recreate the commit in a scratch clone, in its own scratch directory and never in the worktree.
  - **In that clone:** relocate the test files under `src/itg/d5r/` as plain `.ts`, copying the `support.ts` files alongside in the parent commit.
  - **Relocation artifacts:** dismiss findings caused only by the relocation (import paths, suite discovery).
- **The browser-critic gate (T5R.16).**
  1. Run the complete cumulative unit, integration and browser suites with the `suite-runner` subagent until they pass, and record the run.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md` (brief v2). The frozen plan authorizes this spawn. The brief:
     - names deliverable D5R, the worktree and the commit;
     - forbids reading `evidence/` and any other worktree;
     - lists the setup helpers from `e2e/d5/support.ts` and `e2e/d5r/support.ts` by name, with the Temporal pin helpers and clock constants, including the helper that creates B5R.2's 16 routine Trades (C5R.1 needs 20 positions);
     - requires port 5175 only: never 5181, never an invented port;
     - names flows C5R.1–C5R.9 and the future-capability list (breakdown section 7: everything after D5R, including exits and Closed Trades, options, multi-leg structures, and automatic prices);
     - asks for the 375 and 320 px checks of the Review;
     - requires `git status --short` in the header.
  3. It starts the app itself, drives the production UI in a browser, and never edits code.
  4. Delegate each defect it finds to a fresh subagent, which reproduces it with a failing test first and then fixes it. Rerun the suites, then spawn another fresh critic.
  5. Save each report as `evidence/D05R/critic-<n>.md` and add a row to the critic-cost table in `evidence/D05R/structural.md` (tokens, tool calls and duration from the completion notice).

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes:**
  1. Commit, and create the local tag `claude-opus-5.5-d5r` on that commit.
  2. **Rewrite the D6 handoff's starting point:**
     - remove its "Not the next deliverable yet" note;
     - in section 1, name `claude-opus-5.5-d5r` as the release D6 builds on, with its SHA and the test counts at that point;
     - move the starting point to the commit that makes this rewrite, tagged `claude-opus-5.5-pre-d6b`. Don't move `claude-opus-5.5-pre-d6`.
     - in section 4, add a row for D5R's pieces (the cards, `SaveReviewMarks`, Market Data's prepare and apply, the range position, Reward : risk now);
     - in section 3, add that T6.20 is written against `ReviewCard` (the amendment note in the D6 breakdown);
     - in section 3, recommend that T6.21's previous release be built from `claude-opus-5.5-d5r`, the last release before D6.
  3. Commit the rewrite, and don't push.

## 4. What D5 left in place

Build on these rather than re-creating them. Read the code before extending it.
- **D4 and D5's pieces:** section 4 of [D06-handoff.md](D06-handoff.md) has a table describing every piece D5 added or changed, and points to `plan/D05-handoff.md`, section 4, for what D4 left. Read that table, but not the rest of the D6 handoff. All of it is still in place.
- **The test suites:**
  - Node integration is `tests/integration/d1`, `d2`, `d4` and `d5`, with `tests/support/` (`request-counter.ts`, `stack.ts`). `d5/query-count.test.ts` is the model for T5R.13's counts.
  - Browser is `e2e/d1`, `d2`, `d4` and `d5`. `e2e/d5/support.ts` re-exports d4 and adds the Debt and card helpers (`tradeCard`, `reflectionsOf`, `markAndOpenCard` and others). Those card helpers are what section 6.3's move changes.
- **The capability manifest:** `src/app/manifest.ts`. `verify:capabilities` reports 19 operations, 10 variant-qualified, 8 routes, 3 Entry Types and schema 4. T5R.6 adds `SaveReviewMarks` and the D5R read additions, and keeps Market Data's prepare and apply out of the facade.

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task` subagent, including the `tdd.sh` setup step.
- **Edit tool only.** Briefs tell subagents to use the Edit tool only, never `sed -i`, here-docs, `printf >>`, `cat >>`, or node or python edit scripts. This includes temporary mutations. D5's subagents still broke this twice, so check each report and record any slip.
- **Exit codes.** Briefs ask subagents to capture exit codes one command at a time. In zsh, a loop over a quoted command list fails with exit 127 for every command.
- **Cumulative runs.** End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent and recorded in `evidence/D05R/structural.md`. It writes the full outputs to `evidence/D05R/suite-runs/` and returns the table.
  - **Scope:** unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*` (12 checks at the end of D5).
  - **Brief:** tell it to leave no wait loop running, and give it a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says.
  - **Valid or Doubtful finding with a failure scenario:** it becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time.
  - **Wrong finding, or one with no failure scenario:** dismissed, with its reason in `structural.md`.
  - **Raw output:** copy each `ocr.json` to `evidence/D05R/ocr/<task>-<sha>.json`.
- **Background work.** Run independent background work in parallel where it doesn't compete for the machine; an `ocr-review` alongside the next task is fine. Never run `bench:run` alongside a browser suite.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own.
- **User proposals.** Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- **Derived values.** Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- **Planning horizon.** Don't plan far ahead of working code (decision 40).
- **After each finished task:** commit it, record its cumulative run, update section 7 of this note with where D5R stands, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D5R from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including a D5R passage that the code D4 and D5 built cannot meet as written;
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify);
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

The breakdown already settles two likely questions in its red notes. Follow them and record what you find; neither is a stop:
- **T5R.3, T-B's share past the Stop:** if Ongoing Risk to Stop is negative there, the share is clamped to 0.
- **T5R.3, the third case:** it is dropped if D4's figures never produce Ongoing Risk to Stop as Unavailable while Worst-Case is a Value.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d5r` locally and rewrite the D6 handoff's starting point (section 3, "When the gate passes"). Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' minor observations;
- the acceptance rows D5R re-proved (section 8 of the breakdown).

Never push.

## 6. Out of scope

- **Other deliverables:** D6 and every later deliverable, unless the user says otherwise. This includes D6's owed-reflection cards and Exit link: D5R's cards must leave room for them (section 9 of the breakdown) but not build them.
- **Automatic prices and multi-leg rows:** D11 and D10. Section 9 of the breakdown records only what they will change.
- **Fixing tech debt item 3**, the Review's open cost. T5R.13 measures it; the fix is the user's later choice. Items 1 and 2 are also out.
- **D5's critic observations** (`evidence/D05/critic-1.md`, "Minor observations") and **D4's**: the user chose not to pursue them on 2026-10-29. Where D5R's new screen replaces the view an observation was about, the new screen follows D5R's breakdown and the observation lapses. Record which ones lapse in the final report.
- **The prototype's extra controls:** its pricing and position-count switches (A160).
- **Plan edits:** editing `specs/`, or editing the frozen plan without an approved revision.
- **External setup:** Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D5R progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | Setup (`df352a7`); T5R.1 (`a101f74`, bug tasks B1 `733332e` and B3 `9e462e4`; cumulative suite green at `9e462e4`); T5R.2 (`cfc1bad`, `TradeEvaluation.rewardRiskNow`; ocr no findings; suite green); T5R.3 implemented (`d72476f`, ocr no findings, suite green; `cardFixture` added) with bug task B1 (`fd1415d`, decision 62) committed but **not yet closed** (see Next step) |
| Next step | **Close T5R.3.** First ask the user the open question below (decision 63, revision r22). Then make T5R.3's gap case match the answer as bug task T5R.3-B2 if needed, run ocr on `fd1415d` (and on B2), run the cumulative suite, update this section and commit. The user asked to stop after T5R.3 and restart before **T5R.4 Daily Review: `getTrade` with the Plan baseline**. |
| Last commit | the commit that recorded this handoff state, after `fd1415d` |
| Open questions | **Blocking T5R.3's close, asked of the user and unanswered:** T5R.3's planned gap case lists XYZ's Friday gap with T-A from 2026-10-09 and T-F from 2026-10-12, the Review date. Decision 62's last sentence ("A Trade with no such date is not listed") leaves T-F out, so `fd1415d` changed that planned case to expect T-A only. The screen is the same either way: Friday's gap shows on T-A's card only. Option 1, recommended: amend decision 62 so that a Trade with no relevant listed date gets `from` equal to the Review date, and restore the planned assertion. Option 2: keep `fd1415d` and note the amended case in A153. Either way, it is recorded as decision 63, revision r22.<br>**From T5R.3, not blocking:** one planned case was dropped (Worst-Case basis: never reachable for Long Stock); one case was added (Target pin); T-C's half of case 2 was a first-run pass, mutation-checked.<br>**From T5R.1, recorded in `evidence/D05R/structural.md`, not blocking:** one first-run pass (mutation-checked) and the planned regression guard on `save`, both flagged; an `AssertUnavailable` or `WithdrawAcknowledgment` entry adds one Stale-context read, which T5R.13 discloses; the ocr empty-batch finding was dismissed by the user as a caller precondition.<br>**Carried from D5, not blocking:** two tests each failed once under load and passed alone and in later cumulative runs. Rerun either once alone before treating it as real. Expect B4.13's narrow-layout check to be reworked when it moves onto cards.<br>• `src/ui/screens/TradeList.test.tsx:133` (the `tj:open-list-ready` mark count);<br>• B4.13, "Hold radio inside its chip at 375" (`e2e/d4/responsive-a11y.spec.ts:68`). |
