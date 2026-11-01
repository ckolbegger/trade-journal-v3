# Handoff: `claude-opus-5.5`, implement D5R2

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D5R2 specifics, what D5R left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-01, after D5R2 was agreed. D5R2 is not one of the numbered deliverables. Plan revision 28 (decision 69) inserted it between D5R and D6, after the user reviewed an architecture report on the Review code and chose four of its six candidates.

This session **implements D5R2, "Review card progress"**, under the frozen plan at revision 28. The breakdown is [D05R2-review-card-progress.md](D05R2-review-card-progress.md). The user agreed all of it on 2026-11-01: P42–P54 and A164–A176.

D5R2 is a refactor in three parts. A trader sees one change only: a Reflections panel with nothing owed reads "None", never "Resolved" (P46).
1. **Card progress and one due rule** (candidates 1 and 3):
   - the Daily Review coordinator computes each card's progress;
   - the due classification moves to `src/domain/journal-debt/`;
   - the UI words the progress and counts nothing.
2. **The held Review** (candidate 2): one pure module folds every result into the Review the screen holds, keeps each Mark key's standing, and picks the next card.
3. **Bindings staged by their owners** (candidate 5):
   - Journal binds the counter it advances. Trade Workflows today commits it unbound, which ADR 0011 calls a defect.
   - Market Data stages the evidence binding of a Review frame.

Where things stand:
- **D5R:** complete and tagged `claude-opus-5.5-d5r` (`72c742c`).
- **Code:** unchanged since the last complete cumulative run at `dea9849`, which passed 1011 unit, 117 integration and 179 browser tests and 12 of 12 checks (`evidence/D05R/structural.md`). Since then, only plan, evidence and handoff documents have changed, plus one added line in `specs/glossary.md` (decision 69).
- **D6:** its handoff, [D06-handoff.md](D06-handoff.md), now carries a note that D5R2 runs first.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D05R2-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next step in section 7 at once**, without stopping to report that the reading is done.

Continue task by task through the browser-critic gate and the `claude-opus-5.5-d5r2` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r28` (revision 28, `6565b99`) |
| D5R release | tag `claude-opus-5.5-d5r` (`72c742c`) |
| D5R2 starting point | tag `claude-opus-5.5-pre-d5r2` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`, where N is 175 at `claude-opus-5.5-pre-d5r2` and grows with each D5R2 commit. No uncommitted changes, except the untracked `.claude/settings.json`: it is the user's own file, expected, and **never staged**. |
| `git log --oneline claude-opus-5.5-pre-d5r2..HEAD` | Empty at the first session. Afterwards, only D5R2 task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r28`, `claude-opus-5.5-d5r` and `claude-opus-5.5-pre-d5r2`. |
| `git rev-parse 'claude-opus-5.5-d5r^{commit}'` | `72c742c1b6f393d432e533a7d65b84c45df933ff` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 75 files and 1011 tests (unit), and 60 files and 117 tests (integration). The browser suite (`npm run test:e2e`, D1 to D5R) had 179 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D05R2/provenance.md`.

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

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D5R2 uses, as decision 45 directs.

**The `specs/` baseline (scoped).** D5R2 has no reading list of its own: `.claude/scripts/spec-reading-lists.py` names deliverables by number. Every section D5R2 uses is already core or tagged for D5 (breakdown, A170). So:
- Read [plan/spec-reading/D05.md](spec-reading/D05.md), then exactly the files and line ranges it lists, each range in full. The list was regenerated in revision 28. It includes the new glossary entry "Due Classification" and the corrected ranges for `specs/README.md` and ADR 0011.
- ADR 0011 (`specs/adr/0011-optimistic-bindings-and-shared-counter-retry.md`) is on that list. It governs the binding tasks (T5R2.11–T5R2.15); read it with care.

Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, and read that section in the spec before building on it. Note any such section in `evidence/D05R2/structural.md`.

**The frozen plan (scoped):**
- **`plan/implementation-plan.md`:** everything except the `## D6` through `## D28` definition sections. That leaves:
  - decisions 1–69;
  - the rules and cumulative obligations;
  - the freeze record;
  - the D1, D2, D4, D5, D5R and D5R2 definitions;
  - the closing sections: parallelism, coverage index, review queue, and tech debt (items 1–5).
- **`plan/technology-stack.md`:** in full, including "Pinned versions".
- **`plan/acceptance-matrix.md`:** only the opening sections, through "Evidence methods common to every row". D5R2's rows are in section 8 of its breakdown.
- **`plan/D05R2-review-card-progress.md`:** in full. This is the work.
- **`plan/D05R-review-redesign.md`:** sections 1.3, 1.4 (A150–A163 with their amendment notes), 2, 3, 6.4 and 7. These describe the cards, panels, links and critic flows D5R2 must leave unchanged.
- **`plan/D05-deferred-reflection-and-journal-debt.md`:** section 1, especially P16, A63, A64, A67, A69 and A75 (the due rule, Journal's prepare and apply, the post-commit Review result), and decision 56's amendment.
- **`plan/D04-daily-review.md`:** section 1's A45 and A46 (bindings and coherent reads). Look up anything else only when a brief needs it.
- **D1, D2 and D6 breakdowns:** don't read them up front. D6's A86, A89, A90 and T6.20 carry decision 69's notes; read those rows only to check that D5R2 leaves room for them.

`specs/` and the frozen plan are read-only. Decision 69 lets the plan add entries to `specs/glossary.md`, but D5R2 needs no more. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r29 and the next decision is 70. Updating an acceptance row's status is not a revision. D5R2 adds no row: it re-proves existing rows.

## 3. D5R2 specifics

- **Setup before T5R2.1: `tdd.sh` must accept any deliverable suffix.**
  - **The problem:** `.claude/scripts/tdd.sh` takes the task ID as a parameter and derives the log from it, but its pattern, `^T([0-9]+)(R?)\.`, accepts only `T<n>.<m>` and `T<n>R.<m>`. `T5R2.1` doesn't match, and every new naming form so far has needed an edit.
  - **The task:** delegate a small structural task, "setup: tdd.sh accepts any deliverable suffix", to a fresh `tdd-task` subagent. It generalizes the pattern to `^T([0-9]+)([A-Z][A-Z0-9]*)?\.` and logs to `evidence/D<nn><suffix>/tdd-log.md`, with `<nn>` zero-padded as today. So `T5R2.1` goes to `evidence/D05R2/tdd-log.md`, a future `T6R.1` to `evidence/D06R/tdd-log.md`, and `T2.2`, `T12.4` and `T5R.1` map as before. The script's header comment and its error message describe the general form. The usage and every call site are unchanged.
  - **Verification:** run it only with IDs whose log doesn't exist, so nothing is appended. `.claude/scripts/tdd.sh red T5R2.1 x y` prints `no log at evidence/D05R2/tdd-log.md` (run it before that log is created), `.claude/scripts/tdd.sh red T6R.1 x y` prints `no log at evidence/D06R/tdd-log.md`, `.claude/scripts/tdd.sh red T99.1 x y` prints `no log at evidence/D99/tdd-log.md`, and `.claude/scripts/tdd.sh red X5.1 x y` is rejected with exit 2. **Don't run it with a `T1.`, `T2.`, `T4.`, `T5.` or `T5R.` ID:** those deliverables' logs exist, and a run would append to them. Check those mappings in the script's diff instead. Record the outputs in `evidence/D05R2/structural.md`.
  - **Afterwards:** create `evidence/D05R2/tdd-log.md` with its header note. The `suite-runner`, `ocr-review` and critic briefs take `evidence/D05R2` as the evidence directory.
- **Order.** Run tasks one at a time, in task-graph order: T5R2.1 through T5R2.19 (section 3 of the breakdown). The breakdown's three parallel tracks describe which tasks are independent; don't run them concurrently.
- **Code pointers.** The breakdown was written against the built code. Give each brief these pointers rather than having the subagent search. Line numbers are as of `claude-opus-5.5-pre-d5r2` and drift as tasks land.
  - **The due rule (T5R2.1–T5R2.3, T5R2.6):**
    - Daily Review's three-way classification is around `daily-review.ts:403`; its two-way `dueDebtIds` and `reflectionsOf` are around line 305.
    - Trade Views' `withDueStatus` and `DebtDueStatus` are around `trade-views.ts:219` and `:394`.
    - Journal's `dueRule: 'OneSessionGrace'` declarations are at `journal.ts:162` and `effects.ts:155`, `:249`. The stored value is written at `journal.ts:409`.
    - `DUE_TEXT` is at `ReviewReflections.tsx:9`, imported by `OwedDebtItem.tsx:8`.
    - `src/domain/trade-analysis/` shows how a domain module imports `temporal-polyfill`.
  - **Card progress (T5R2.4, T5R2.5, T5R2.10):**
    - `WalkedTrade`, `ReflectionCounts`, `PostSaveReview` and `PostMarksReview` are in `src/coordinators/daily-review/types.ts`, re-exported through `src/app/types.ts`.
    - The post-save assemblies call `assemble(context, withGaps = false)`. Keep them free of the gap scan (P49).
    - `WalkedTrade.reflections` is also read by `src/app/bench-generator.ts` (two places) and `resolve-debt.test.ts:86`.
    - In the UI: `remainingOf` and `isOwing` are in `ReviewView.tsx` (around lines 155 and 202). `Remaining`, `remainsText`, `marksStatus`, `reflectionsStatus`, `panelHeaders` and `resolvedDebts` are in `ReviewCard.tsx`.
    - The facade double is `tests/support/facade-double.ts`. The card fixture is `cardFixture` in `tests/support/review-fixture.ts`.
  - **The held Review (T5R2.7–T5R2.9):**
    - In `ReviewView.tsx`: `marksOf` (around line 204), `withSavedMarks` (223), the `apply` and `latest` refs, `saved` (361, including the `flushSync` Mark-card branch), `reflectionResolved` (404) and `marksSaved` (467).
    - `CardMarks.tsx` has `standings`, `setStanding` and `standing` (around line 303), and the `opened` earlier list (283), which stays (A172).
  - **Bindings (T5R2.11–T5R2.15):**
    - Journal: `journalUnchanged` (`journal.ts:57`), `save`'s retry (around line 604), and `applyPreparedEffects` (around 703, with its counter write around 871).
    - Trade Workflows: the commits around `record-position-change.ts:263` and `trade-workflows.ts:118`.
    - Daily Review: `checkBinding` (around `daily-review.ts:497`), `attemptSave`'s `tx.require` loop and counter check (around 573–590), and `resolveReviewDebt`'s counter check (around 673).
    - Market Data: `ResolveFrames` (around `market-data.ts:484–488`, which already reads each Review-date record and calls `staleContextOf`) and `staleContextOf` (around 327).
    - Persistence: `src/persistence/semantic-transaction.ts` (`require`, `stage`, `close`). `commit` names the failed binding.
- **The migration rule (P47).**
  - **Browser:** no file under `e2e/` changes. T5R2.18's `git diff claude-opus-5.5-d5r -- e2e` must be empty. A UI task that seems to need a browser change is a stop (section 5).
  - **Unit:** the only sanctioned expectation change is "Resolved" to "None" in the D5R T5R.16-B4 case (P46). Every case that moves to a coordinator, domain or table case keeps its expected values. The task records each removed case's values beside the case that carries them (sections 6.1 and 6.1a), in `evidence/D05R2/structural.md`.
  - **The facade double** gains `progress` built from the breakdown's section 4 table, so the UI and coordinator cases use the same numbers.
- **No storage change (A168).** There is no schema version, migration, fixture freeze, capacity basis or release-harness change.
  - **Fixtures:** never regenerate the `workspace-v1` to `workspace-v4` fixtures. T5R2.2 checks that `git diff claude-opus-5.5-d5r -- tests/fixtures` is empty.
  - **Capabilities:** `verify:capabilities` still reports 19 operations. Market Data's `bindEvidence` is internal and stays off the facade, like `prepareEffects` (A176).
- **Writes follow ADR 0011.** T5R2.11 and T5R2.12 are its "every write that advances a shared counter binds that counter" rule.
  - **The retry (P53, A175):** the coordinator that owns the command retries a counter-only conflict, repeating the whole read, validation, preparation and commit, up to 3 attempts in all, then returns its typed `Conflict`. Journal names its binding and exports `isJournalCounterBinding`.
  - **What stays:** Daily Review's existing retry loops. A conflict on any other binding is returned at once.
  - **The interleaving cases:** T5R2.11 writes the interleaving out in the test. T5R2.12 needs a persistence wrapper that lands one Journal write just before a chosen commit attempt. Build it in the test, not in production code.
- **Keep the Review fast.** The post-save assemblies stay free of the historical-gap scan (D5R P38, P49). T5R2.16's query-count cases are the guard, and they pass unchanged. The Action save issues one read-only transaction fewer before its commit after T5R2.15; record the before-and-after counts in the evidence.
- **Benchmark (T5R2.16).** D5R2 changes no data and doesn't bump the generator version, so the cached profile in `.cache/bench/profile` is used as is. If it is missing, run `bench:generate` in the background (about 100 minutes) and keep working. Results go in `evidence/D05R2/bench.md`, ungated beside the gated cold and warm thresholds. **Never run `bench:run` alongside a browser suite.**
- **Clock pinning, mutation builds and test cost** are as in D5R's handoff, section 3:
  - every pinned browser case also patches `Temporal.Now` (`launchAt`, `pinClock` or `setClock` from `e2e/d4/support.ts`);
  - a browser mutation check rebuilds the served release with `TJ_BUILD_LABEL=d5 npx vite build --outDir dist-releases/d5 --emptyOutDir`, then rebuilds clean;
  - routine browser suites run in Chromium only, with the faults build;
  - a single browser failure is rerun once alone before it is treated as real, and both outcomes are recorded.
- **Six fall-back-hour cases.** Six D2 cases that drive the frozen D1 release fail when the suite runs during 01:00–01:59 on a fall-back night (D5R handoff, section 7, F1). They cannot be fixed without rebuilding released code. If a cumulative run falls in that hour, rerun it outside it.
- **TDD discipline.** Run every `it should` case red, then green, one at a time, through `tdd.sh`, which logs to `evidence/D05R2/tdd-log.md`.
  - **Code written before its red** is backed out and rerun to a genuine red.
  - **A case that passes on its first run** gets the mutation check in the `tdd-task` agent: an assertion failure or runtime exception, never a compile error or an actionability timeout. It is flagged for the user. Never fabricate a red.
  - **Refactor reds:** T5R2.7 and T5R2.10 go red as the breakdown's red notes say: on a missing export, or on a facade double whose progress disagrees with its completion reasons.
  - **Structural tasks** record their exact verification in `evidence/D05R2/structural.md`. **Engine and OS versions** go in `evidence/D05R2/provenance.md`.
- **ocr on test-only commits.** `ocr` excludes test files, so a test-only commit reviews almost nothing in place. Brief the `ocr-review` agent to recreate the commit in a scratch clone and relocate the tests under `src/itg/d5r2/` as plain `.ts`. Dismiss findings caused only by the relocation.
- **The browser-critic gate (T5R2.19).**
  1. **Make sure a full green run covers the code the critic will see**, exactly as D5R's handoff, section 3, describes:
     - take the newest "Cumulative suite at `<sha>`" record;
     - run `git diff --quiet <sha> HEAD -- . ':!evidence' ':!plan'` and `git status --porcelain -- . ':!evidence' ':!plan'`;
     - reuse the run if both are clean, otherwise run the suites with `suite-runner` until they pass.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md` (brief v2). The frozen plan authorizes this spawn. The brief:
     - names deliverable D5R2, the worktree and the commit;
     - forbids reading `evidence/` and any other worktree;
     - lists the setup helpers from `e2e/d5/support.ts` and `e2e/d5r/support.ts` by name, including the Temporal pin helpers, the clock constants, and the helper that creates B5R.2's routine Trades (C5R.1 needs 20 positions);
     - requires port 5175 only;
     - names the flows of the breakdown's section 7: C5R.1, C5R.2, C5R.3, C5R.4, C5R.8, C5R.9 and C5R2.1;
     - gives the future-capability list: everything after D5R2, including exits and Closed Trades, owed-reflection cards for Trades outside the walk, options, multi-leg structures, and automatic prices;
     - says that D5R2 is a refactor, so any visible difference from D5R other than P46's "None" is a defect;
     - asks for the 375 and 320 px checks of the Review;
     - requires `git status --short` in the header.
  3. Delegate each defect to a fresh subagent, which reproduces it with a failing test first and then fixes it. Rerun the suites, then spawn another fresh critic.
  4. Save each report as `evidence/D05R2/critic-<n>.md` and add a row to the critic-cost table in `evidence/D05R2/structural.md` (tokens, tool calls and duration from the completion notice).

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes:**
  1. Commit, and create the local tag `claude-opus-5.5-d5r2` on that commit.
  2. **Rewrite the D6 handoff's starting point:**
     - remove its "Not the next deliverable yet" note about D5R2, and add a short "D5R2 is complete" paragraph beside the D5R one;
     - in section 1, name `claude-opus-5.5-d5r2` as the release D6 builds on, with its SHA and the test counts at that point;
     - move the starting point to the commit that makes this rewrite, tagged `claude-opus-5.5-pre-d6c`. Don't move `claude-opus-5.5-pre-d6` or `claude-opus-5.5-pre-d6b`;
     - in section 2, decisions 1–69 and the D5R2 breakdown's sections 1.3, 1.4 and 9;
     - in section 3, say that the owed-reflection cards carry `CardProgress` of kind `ReflectionsOwed`, that their results reach the screen through `held-review.ts`, and that the exit and Close Review commits get Journal's counter check from `applyPreparedEffects` (D5R2 section 9). Update T6.21's open question: the last release before D6 is now `claude-opus-5.5-d5r2`;
     - in section 4, add a D5R2 row: `CardProgress`, `src/domain/journal-debt/`, `src/ui/due-text.ts`, `src/ui/screens/held-review.ts`, Journal's counter binding and Trade Workflows' retry, and Market Data's `bindEvidence`.
  3. Commit the rewrite, and don't push.

## 4. What D5R left in place

Build on these rather than re-creating them. Read the code before extending it.
- **D4, D5 and D5R's pieces:** section 4 of [D06-handoff.md](D06-handoff.md) has a table of every piece through D5R. Read that table, but not the rest of the D6 handoff. All of it is still in place.
- **The test suites:**
  - Node integration is `tests/integration/d1`, `d2`, `d4`, `d5` and `d5r`, with `tests/support/` (`request-counter.ts`, `stack.ts`, `review-fixture.ts`, `debt-fixture.ts`). `d5r/query-count.test.ts` is T5R2.16's guard.
  - Browser is `e2e/d1`, `d2`, `d4`, `d5` and `d5r`, with the Trade-keyed card helpers in `e2e/d4/support.ts` (decisions 65 and 68). D5R2 changes none of them.
- **The capability manifest:** `src/app/manifest.ts`. `verify:capabilities` reports 19 operations and schema 4, and checks that prepare and apply seams stay off the facade.

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task` subagent, including the `tdd.sh` setup step.
- **Edit tool only.** Briefs tell subagents to use the Edit tool only, never `sed -i`, here-docs, `printf >>`, `cat >>`, or node or python edit scripts. This includes temporary mutations. Check each report and record any slip.
- **Exit codes.** Briefs ask subagents to capture exit codes one command at a time. In zsh, a loop over a quoted command list fails with exit 127 for every command.
- **Cumulative runs.** End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent and recorded in `evidence/D05R2/structural.md`. It writes the full outputs to `evidence/D05R2/suite-runs/` and returns the table.
  - **Scope:** unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*` (12 checks).
  - **Brief:** tell it to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says.
  - **Valid or Doubtful finding with a failure scenario:** it becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time.
  - **Wrong finding, or one with no failure scenario:** dismissed, with its reason in `structural.md`.
  - **Raw output:** copy each `ocr.json` to `evidence/D05R2/ocr/<task>-<sha>.json`.
- **Background work.** Run independent background work in parallel where it doesn't compete for the machine; an `ocr-review` alongside the next task is fine. Never run `bench:run` alongside a browser suite.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own.
- **User proposals.** Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- **After each finished task:** commit it, record its cumulative run, update section 7 of this note with where D5R2 stands, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D5R2 from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity, including a D5R2 passage the built code cannot meet as written;
3. a refactor task can't keep a moved case's expected values, or needs a change under `e2e/` (P47);
4. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
5. a fresh critic agent or a browser can't be provided (never self-certify);
6. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d5r2` locally and rewrite the D6 handoff's starting point (section 3, "When the gate passes"). Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' minor observations;
- the acceptance rows D5R2 re-proved (section 8 of the breakdown).

Never push.

## 6. Out of scope

- **Other deliverables:** D6 and every later deliverable. D5R2 leaves room for D6's `ReflectionsOwed` cards, the owed group's order in `src/domain/journal-debt/`, and D6's results in `held-review.ts` (breakdown section 9), but builds none of them.
- **Tech debt:**
  - **items 1–3** stay as they are;
  - **item 4** (trimming the coordinators' due cases) is a later choice of the user's, even though T5R2.1 makes it possible;
  - **item 5** (one vocabulary for missing evidence) is planned before D7, not here.
- **The architecture review's candidate 6** (the browser card resolver learning groups and panels): it belongs to D6's T6.20, if anywhere.
- **D5R's critic observations** and earlier ones: the user chose not to pursue them.
- **Plan edits:** editing `specs/`, or editing the frozen plan without an approved revision.
- **External setup:** Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D5R2 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | Setup (`tdd.sh`, `9cbbe55`); T5R2.1 (`9ebeb83`); T5R2.2 (`451b093`); T5R2.3 (`b7ea170`); T5R2.4 (`987f6d7`); T5R2.5 (`509f582`) with bug task T5R2.5-B1 (`dc004c4`); T5R2.6 (`753bca9`); T5R2.7 (`7359c21`) with bug task T5R2.7-B1 (`bfc250a`); T5R2.8 (`74a1ca2`); T5R2.9 (`7818001`); T5R2.10 (`2439bcb`); T5R2.11 (`ca04024`); T5R2.12 (`93dce82`) with test fix F2 (`479f8fb`). Latest cumulative run green at `479f8fb`: 1047 unit, 117 integration, 179 browser, 12 of 12 checks. |
| Next step | **T5R2.13** (Daily Review drops its `journal@` copies; `retryCounterConflict` is in `src/coordinators/trade-workflows/counter-retry.ts`). For the critic brief: ask C5R.2 to check the Action panel's status and summary right after a save (T5R2.10 note). |
| Last commit | the evidence and handoff commit after T5R2.12 |
| Open questions | (1) Location check: `git status -sb` read `ahead 0`, not `ahead 175`, because the branch had been pushed to exactly `claude-opus-5.5-pre-d5r2`; HEAD, tag and remote were the same commit, so the session proceeded (`evidence/D05R2/structural.md`, "Start of D5R2"). (2) T5R2.1 decision: `classifyDue` takes the repository's `Instant` strings, comparing them with `temporal-polyfill`. (3) First-run passes, flagged: T5R2.4 cases 2–5; T5R2.5 cases 3–5; T5R2.10's SaveTradeAction header case; T5R2.11 case 2; T5R2.12 case 3 (mutation checks in `tdd-log.md`). (4) User decision, 2026-11-01: the frozen v4 fixture views keep `WalkedTrade.reflections`; `tools/verify-fixtures.ts` states it from the Reflections panel before comparing (implementation note under D4 A51; `structural.md`, T5R2.5). (5) Slips against the Edit-only rule: T5R2.5-B1's subagent used heredocs for evidence rows; T5R2.10's used a Python replace script on one test file; T5R2.11's second subagent used one for three test inputs; T5R2.12's used a heredoc and `echo >>` for two tdd-log rows. (6) F1: one intermittent unit failure at `dc004c4` (`ReviewCards.test.tsx:607`), not reproduced in three reruns; watch for recurrence. F2, a second intermittent failure in the same file (the card-top scroll case), was a confirmed test race, fixed test-only in `479f8fb`; F1's cause is not confirmed. (7) `tools/fixture-views.test.ts` runs under `npm run test:unit`, not under the cumulative `npx vitest run src`. (8) Dismissed ocr finding (T5R2.7): a withdrawn earlier-session acknowledgment leaves both gap lists after a save, exactly as D5R's `withSavedMarks` did (unchanged behaviour, A172). (9) T5R2.11 decision: three existing cases that apply one prepared effect twice advance the second apply's `snapshot.journalRevision` so they still reach the uniqueness backstop with unchanged expected values (`structural.md`, T5R2.11). |
