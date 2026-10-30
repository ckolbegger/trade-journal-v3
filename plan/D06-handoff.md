# Handoff: `claude-opus-5.5`, implement D6

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D6 specifics, what D5 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-30, after D5 completed. [D05-handoff.md](D05-handoff.md) is the record of D5's session (section 7 lists every D5 task, commit, decision and flagged item); this note is the starting point for D6.

This session **implements D6, "Close a Long Stock position"**, under the frozen plan at revision 19. D5 is complete:
- Its gate passed: critic-1 found no defects (`evidence/D05/critic-1.md`, seven minor observations).
- Every D5 acceptance row in section 8 of the D5 breakdown is marked covered, and AC-JOUR-003 (full in D5) is covered in `plan/acceptance-matrix.md`.
- It is tagged `claude-opus-5.5-d5` on `fbe3bb7`. The tag is local and has not been pushed.
- After the tag: the D5 acceptance rows were marked; revision 19 (decision 60) moved Vite to 8.3.4 and Zod to 4.6.7 for `npm audit` fixes (commit `4e7a620`), and a complete cumulative run at `853469f` passed (893 unit, 105 integration, 155 browser, 12 of 12 checks; `evidence/D05/structural.md`, "Dependency bump"). Tech debt item 3 (opening the Review grows with history) was added at the end of `plan/implementation-plan.md`.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D06-handoff.md and follow it."* Run the location checks in section 1, do the reading in section 2, and then **start the next task in section 7 at once**, without stopping to report that the reading is done. Continue task by task through the browser-critic gate and the `claude-opus-5.5-d6` tag, stopping only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r19` (revision 19) |
| D5 release | tag `claude-opus-5.5-d5` (`fbe3bb7`) |
| D6 starting point | tag `claude-opus-5.5-pre-d6` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`; nothing since D4 has been pushed, so N is large (404 at `claude-opus-5.5-pre-d6`). No uncommitted changes. |
| `git log --oneline claude-opus-5.5-pre-d6..HEAD` | empty at the first session; afterwards only D6 task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit |
| `git tag --list 'claude-opus-5.5-*'` | includes `claude-opus-5.5-plan-r19`, `claude-opus-5.5-d5` and `claude-opus-5.5-pre-d6` |
| `git rev-parse claude-opus-5.5-d5` | `fbe3bb71dcc7114e7f0568272be48f0412cfeab8` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | every test file and test passes; at `claude-opus-5.5-pre-d6`, 69 files and 893 tests (unit) and 53 files and 105 tests (integration). The browser suite (`npm run test:e2e`) had 155 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D06/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start (other worktrees' preview servers run on other ports; leave them alone). Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading below, delegating each task to the `tdd-task` subagent, writing briefs, the `ocr-review` run and bug tasks after each task, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D6 uses, as decision 45 and the kickoff's plan-specific conditions direct.

**The `specs/` baseline (scoped):** read [plan/spec-reading/D06.md](spec-reading/D06.md), then read exactly the files and line ranges it lists, each range in full. It covers every core section of the [spec map](spec-map.md) plus every section tagged for D6. Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, then read that section in the spec before building on it. If the missing section should have been tagged for D6, correct the map, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`, and note the correction in `evidence/D06/structural.md`.

**The frozen plan (scoped):**
- `plan/implementation-plan.md`: everything except the `## D7` through `## D28` definition sections. That leaves the recorded decisions 1–60, the rules and cumulative obligations, the freeze record, the D1, D2, D4, D5 and D6 definitions (D6's is the work), and the closing sections: parallelism, coverage index, review queue, and tech debt.
- `plan/technology-stack.md` in full, including "Pinned versions".
- `plan/acceptance-matrix.md`: only the opening sections, through "Evidence methods common to every row". D6's rows are in full in section 8 of the D6 breakdown. Look up any other row by its scenario ID only when you need it, for example to update a status.
- `plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`: only sections 1 (decisions, assumptions, the storage layout A10, and the mature dataset profile 1.3), 2, 3, 5 and 6.
- `plan/D02-open-a-long-stock-position.md`: only sections 1 (including the schema-2 layout A28, the decline shape A29, the migration engine A30, Lots A22, the Entry window A23–A26, the entry form A33, and the release harness A34), 2, 3, 5 and 6.
- `plan/D04-daily-review.md`: sections 1 (P8–P15 and A35–A60, especially A38, A45, A46 on bindings and coherent reads, A53 frames, A54 `AwaitingClose`, A55 the cutoff state D6 extends, A57 and A58 on the Review screen and Action form), 2, 3, 5 and 6.
- `plan/D05-deferred-reflection-and-journal-debt.md`: sections 1 (P16–P18, A61–A75, and the amendments by decisions 56–59), 2, 3, 5 and 6. Skip its behavioral task cases, critic flows, acceptance rows and clause check unless a D6 task builds on one.
- **`plan/D06-close-a-long-stock-position.md` in full**, which is the work.

You may read D7's and D8's breakdowns for context where they build on D6 (D7 adds options, Settlement Due and Expiration on top of D6's closes; D8's Restore fixtures include D6's Closed Trades and a Closed Trade whose stored lifecycle disagrees). Read only the parts that touch D6.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`; the next one is r20, and the next decision is 61 (D5's session added decisions 56–60 in revisions 15–19). Updating an acceptance row's status from `planned` to `covered` once evidence exists is not a revision, but ask the user before doing it, as was done for D1, D2, D4 and D5; scenarios that become full in D6 are also marked in `plan/acceptance-matrix.md`. Run each row's command as written before marking it.

## 3. D6 specifics

- **Order.** Follow D6's task graph (section 3 of its breakdown). Fix the close command, the Closed Detail and list read models, and the Review card kinds (`Walked`, `ReflectionsOwed`) in T6.16's type module early; that lets the four tracks the breakdown names proceed: Trade Analysis (T6.1–T6.4), persistence and modules (T6.5–T6.9, T6.15), coordinators (T6.10–T6.14), and UI (T6.17–T6.20). T6.21 (the D5 release in the harness) depends only on D5's T5.18 and can run early. Run tasks one at a time.
- **The breakdown predates the code it builds on.** D6's breakdown was agreed on 2026-10-17, before D4 and D5 were implemented and before decisions 46–60. Before each task, check its assumptions against what D4 and D5 actually built, and against these later decisions in particular:
  - **Decisions 58 and 59:** the user's direction is that every deferral is surfaced in every Review until it is resolved ("Due in the next Review", then "Due"). Read P20, A89 and A90's owed-reflection group and `ReflectionsOwed` cards, and A86's deferred Close Review, in that light: not-yet-due reflections are listed, and only due ones block Complete.
  - **Decision 56:** outside session-policy coverage an Outstanding Debt reads "Reflection owed" with no due classification; Close Review Debt on Trade Detail follows the same rule.
  - **Decision 57:** a Plan Reflection still cannot be deferred through `confirmPlan`; A66 gives Defer to the Close Review in D6.
  - **A89's "one read transaction":** D4 and D5 assemble the Review from separate module reads made coherent by the binding check (A46, `coherently` in `src/coordinators/daily-review/daily-review.ts`). Extend that pattern rather than inventing a second one; the request-count claims of T6.25 still hold.

  Where a D6 passage cannot be met as written against the built code, that is a plan question: stop and ask (section 5).
- **This is the fourth schema change** (schema 4 → 5), through D2's migration engine (A30) as D4 and D5 used it: the `v4→v5` transform (`src/persistence/migrations/`), the `v1→…→v5` chain, candidate database, pointer flip, cleanup, the `tj-lifecycle` lock and Migration Blocked. `terminalTime` and the sparse `byLifecycleTerminal` index are private and rebuilt, never copied or reported as findings (A87, A96; D8 A139). No Lot Match is ever stored (P23).
- **Writes follow ADR 0011 (decision 52).** Persistence `commit` checks exact-key bindings; there is no in-transaction read or increment. Counter bindings that fail alone re-read, re-validate and retry up to 3 attempts, as D4 and D5 do. A new outcome for a key still uses `add`, so a duplicate fails the transaction. The Close Review obligation key is `['CloseReview', tradeId]` (A86), separate from the exit's Position Change Reflection key.
- **Debt resolution reuses D5's core** (A64, A65): `Journal.prepareEffects` with `ResolveDebt`, the Debt snapshot by exact definition revision, and the Review's `ResolveReviewDebt`. Render prompts by stable Prompt and Option identities, never text (`src/domain/daily-trade-review-prompts.ts` is the Daily Trade Review's single source of wording).
- **Keep the Review fast where D4 and D5 did.** The post-save path reads today's frames only (`framesOnly`) and must stay free of the historical Mark-gap scan when the owed group and closed-after-cutoff Trades join it (A67). Opening the Review already costs about 2.2 s on D5's benchmark profile because of the gap scan (tech debt item 3); **do not fix that in D6** unless the user asks, but don't add per-history work to `open` either. T6.25's query-count claims are the guard.
- **Calendar coverage (decision 54).** Coverage is 2024-01-01 through 2028-12-31. Outside it there is no Expected Mark Date or frame and the Review cannot open.
- **Do not build D7+ behavior early:** options, Expiration, Settlement Due and non-agency closes; backup and Restore; opening an exact past Review date; Rolls and the Rolled Close Reason; correcting or Voiding an exit, and Not Entered on multi-leg Plans (moved to D10); provider prices and Stop Discipline; reports. The same list (D6 section 7) is what D6's critic must not treat as defects.
- **Clock pinning in tests.** This Chromium has native Temporal, and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`, so every pinned browser case must also patch `Temporal.Now`: use `launchAt`/`pinClock`/`setClock` (from `e2e/d4/support.ts`, re-exported by `e2e/d5/support.ts`). The faults build's `?clock=` (A49) pins both. The bench pin (`tools/bench/pin.ts`) patches Temporal too.
- **The previous release (A97, T6.21)** is exported from the tag `claude-opus-5.5-d5` (`fbe3bb7`) with `git archive` into a scratch directory and built there. Never create a worktree for it. T6.21 turns D5's current-source `d5` into the tagged one and adds a current `d6`.
- **Benchmarks (AC-PERF-001, T6.24, T6.25).** D5's generator 3 (`BENCH_GENERATOR_VERSION` in `src/app/bench.ts`) took about 100 minutes (5,980 s) for 1,255 sessions with only 400 Position Changes. D6's generator 4 grows to about 100,000 Position Changes and 24,700 closes (section 1.4), and every simulated session opens and saves a Review through the production facade, so expect several hours or more. Start `bench:generate` in the background as soon as T6.24's generator is committed, keep working on other tasks, and record the generation time. The dataset records the as-of Review's walk and owed-reflection group identities; a Debt's date field is named `momentDate` (the UTC calendar day of its Economic Time). Thresholds stay at a nearest-rank p95 of 2,500 ms cold and 1,500 ms warm (D5: cold 104.8 ms, warm 43.6 ms). Results go in `evidence/D06/bench.md`. The bench serves on `BENCH_PORT = 5181`; every other server uses 5175. If the generated dataset cannot meet a section 1.4 statement exactly (D5's two Outstanding Debts could not), stop and ask, as decision 58 did.
- **TDD discipline.** Run every `it should` case red, then green, one at a time. Record the commands and outcomes in `evidence/D06/tdd-log.md` (create it before the first task, with a note that its rows are single-case runs; `tdd.sh` refuses to run without it, and runs vitest only, so Playwright reds and greens are logged by hand). Code written before its red is backed out and rerun to a genuine red. A case that passes on its first run because earlier work already built the behavior gets the mutation check in the `tdd-task` agent (an assertion failure or runtime exception, never a compile error or an actionability timeout) and is flagged for the user; never fabricate a red. Structural tasks record their exact verification in `evidence/D06/structural.md`. Engine and OS versions go in `evidence/D06/provenance.md`.
- **Browser mutation builds.** The release tests serve `dist-releases/<label>`, not `dist`. A mutation check on a browser case must rebuild with `TJ_BUILD_LABEL=d6 npx vite build --outDir dist-releases/d6 --emptyOutDir` (D5's T5.24-B1 found that a plain `vite build` leaves the served release unchanged, so the mutation "passes"), and rebuild clean after restoring.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. `test:e2e` runs `e2e/d1 e2e/d2 e2e/d4 e2e/d5`; extend it with `e2e/d6`, since D6's gate needs all five. Evidence from all three engines belongs in RC. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **ocr on test-only commits.** `ocr` excludes test files, so a commit that only adds tests reviews almost nothing in place. Brief the `ocr-review` agent to recreate the commit in a scratch clone (in its own scratch directory, never in the worktree) with the test files relocated under `src/itg/<dnn>/` as plain `.ts`, copying the `support.ts` files alongside in the parent commit. Findings caused only by the relocation (import paths, suite discovery) are dismissed as relocation artifacts.
- **The browser-critic gate (T6.28).**
  1. Run the complete cumulative unit, integration and browser suites with the `suite-runner` subagent until they pass, and record the run.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md` (brief v2). The frozen plan authorizes this spawn. D5's critic brief worked first time: it named the worktree and commit, forbade reading `evidence/` and any other worktree, listed the setup helpers from `e2e/d5/support.ts` (and, for D6, `e2e/d6/support.ts`) by name with the Temporal pin helpers and clock constants, required port 5175 only (never 5181, never an invented port), named the amended flows and the future-capability list, asked for the 375 and 320 px checks of every screen D6 adds or changes, and required `git status --short` in the header.
  3. It starts the app itself, drives the production UI in a browser, runs C6.1 onward plus the narrow-layout checks, and never edits code.
  4. Delegate each defect it finds to a fresh subagent, which reproduces it with a failing test first and then fixes it; rerun the suites, and spawn another fresh critic.
  5. Save each report as `evidence/D06/critic-<n>.md` and add a row to the critic-cost table in `evidence/D06/structural.md` (tokens, tool calls and duration from the completion notice).

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes,** commit and create the local tag `claude-opus-5.5-d6` on that commit. D7's harness builds the previous release from it. Don't push the tag unless the user asks.

## 4. What D5 left in place

Build on these rather than re-creating them. Read the code before extending it. `plan/D05-handoff.md`, section 4, describes what D4 left (application facade, persistence and migration, session policy, Market Data, Journal, Daily Review, Trade Views, Workspace, UI, faults build, release harness, capacity, fixtures, benchmark, test suites); all of it is still in place. D5 added or changed:

| Piece | Where | Notes for D6 |
|---|---|---|
| Schema 4 | `src/persistence/schema.ts` (`SCHEMA_VERSION` 4), `src/persistence/migrations/v3-to-v4.ts`, `private-fields.ts` | Store `journalDebts` with private indexes `byOutstandingDue` and `byAnchorTrade` (A62). The `v1→v2→v3→v4` chain runs through `migrations/index.ts`. |
| Journal Debt | `src/modules/journal/` (`journal.ts`, `effects.ts`, `records.ts`, `section.ts`, `manifest.ts`) | Defer for the Position Change Reflection (A66), `ResolveDebt` (Answer, Decline) against the Debt's snapshot revision, `Journal.query` scopes `OutstandingDebt` (one `getAll` on `byOutstandingDue`) and `TradeNarrative` (one `getAll` on `byAnchorTrade`), Source Trade Detail. Debt records carry `momentTime`, `dueAnchor` and `authoredTime`. |
| Trade Workflows | `src/coordinators/trade-workflows/` | `recordPositionChange` with Complete, Decline or Defer for its reflection. Facts are never blocked by owed reflections. |
| Daily Review | `src/coordinators/daily-review/daily-review.ts` | `open` reads every Outstanding Debt once, groups it by Trade, and classifies Due / Due in the next Review / Due in the Review after next against the previous session's close; due reflections block Complete and are named in the blockers; `getTrade` returns each owed reflection with its snapshot form and save binding; `save` with `ResolveReviewDebt`. Post-save path still `framesOnly`. |
| Market Data | `src/modules/market-data/market-data.ts` | Point frames carry the previous session's close (A75). `recover`'s `historicalGaps` is tech debt item 3. |
| Trade Views | `src/coordinators/trade-views/` | Trade Detail lists each obligation once: "Reflection owed" with its due classification (A69, decision 56 outside coverage), "Deferred, answered", "Declined later". |
| UI | `src/ui/screens/` (`PositionChangeForm.tsx` disposition radio group, `DebtForm.tsx`, `OwedDebtItem.tsx`, `ReviewReflections.tsx`, `ReviewTrade.tsx`, `ReviewView.tsx`, `TradeDetail.tsx`, `PositionChangeReceipt.tsx`, `AboutView.tsx`) | The Review card's "Reflections" section sits above the Action form; focus moves to the next reflection, then the Action form, after a Debt save (A71). In Recovery Only the card's "Reflect on…" button opens the form read only. |
| Capability manifest | `src/app/manifest.ts` | `verify:capabilities` reports 19 operations, 10 variant-qualified, 8 routes, 3 Entry Types, schema 4. |
| Release harness | `tools/build-releases.ts`, `tools/release-server.ts` | `d1`, `d2`, `d4` from their tags, `d5` from current source (T5.18); folders under `dist-releases/`. |
| Capacity | `tools/capacity/`, `src/delivery/capacity-basis.json` | Schema 4: M 849,065,876 bytes, required quota 2,547,197,628 (3 × M). |
| Fixtures | `tests/fixtures/workspace-v1/` to `workspace-v4/`; `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts` | **Never regenerate v1–v4.** v4 is as of Monday 2026-10-19 17:00 with four Debts; v1–v3 migrate Debt-free. |
| Benchmark | `src/app/bench.ts` (generator 3), `src/app/bench-generator.ts`, `tools/bench-generate.ts`, `tools/bench-run.ts`, `bench/dataset.json`, `bench/expected-open-rows.json`; cached profile in `.cache/bench/profile` | `bench:run` compares Open rows and the as-of Review's due reflections (read from the overview's blockers) before and after the timed runs, and discloses the Review's render time ungated. |
| Node integration | `tests/integration/d1/`, `d2/`, `d4/`, `d5/` with `support.ts`; `tests/support/` (`request-counter.ts`, `stack.ts`) | `d5/query-count.test.ts` is the model for T6.25's counts. |
| Browser suite | `e2e/d1/`, `e2e/d2/`, `e2e/d4/`, `e2e/d5/` with `support.ts` | `e2e/d5/support.ts` re-exports d4 and adds `deferEntry`, `startEntry`, `debtForm`, `fillDebtAnswers`, `answerDebt`, `declineDebt`, `tradeCard`, `reflectionsOf`, `markAndOpenCard`, `debtsOf`, `entriesWithSettledDebt`, `declinesOf`, and Monday–Wednesday instants. |

## 5. Working rules

- Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder; **subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks.
- The main session edits only plan, evidence and handoff documents. Every task, bug task and code change (including dependency pins) goes to a fresh `tdd-task` subagent. Briefs tell it to use the Edit tool only, never `sed -i`, here-docs, `printf >>`, `cat >>`, node or python edit scripts, including for temporary mutations; D5's subagents still broke this twice, so check each report and record any slip.
- Briefs ask subagents to capture exit codes one command at a time. In zsh, a loop over a quoted command list fails with exit 127 for every command; several D5 subagents hit this and had to rerun.
- End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent (it writes the full outputs to `evidence/D06/suite-runs/` and returns the table), and recorded in `evidence/D06/structural.md`. The run covers unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*` (12 checks at the end of D5). Tell it to leave no wait loop running (one D5 run left an endless `until grep` loop). Give it a label without a trailing hyphen.
- Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says: each Valid or Doubtful finding with a failure scenario becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time; a Wrong finding, or one with no failure scenario, is dismissed with its reason in `structural.md`. Copy each `ocr.json` to `evidence/D06/ocr/<task>-<sha>.json`.
- Run independent background work in parallel where it doesn't compete for the machine (an `ocr-review` alongside the next task is fine), but never run `bench:run` alongside a browser suite: the timings would be noisy.
- A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- Never use bare `git stash`; use a WIP commit, or a tagged stash applied by SHA.
- Refer to document sections in words, never with the "§" sign.
- Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, and include enough context that the question stands on its own.
- Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- Don't plan far ahead of working code (decision 40).
- After each finished task, commit it, record its cumulative run, update section 7 of this note with where D6 stands, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D6 from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including a D6 passage that the code D4 and D5 built cannot meet as written (section 3);
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify);
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d6` locally. Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' minor observations;
- the acceptance rows ready to be marked `covered`. Ask before marking them.

Never push.

## 6. Out of scope

- Any deliverable other than D6, unless the user says otherwise.
- **D5's critic observations** (`evidence/D05/critic-1.md`, "Minor observations": focus on opening a Debt form on Trade Detail, "Due: Due" on Detail, the "Due" label kept on a resolved reflection, Source shown only after reload, "Reflect on…" in Recovery Only, and the Expected-Mark-Date-relative label at mid-session) and **D4's** (the user chose not to pursue them on 2026-10-29). Don't fix them as part of D6. D6's own requirements still apply where they overlap, for example focus after a save in the new `ReflectionsOwed` cards.
- **The tech-debt items** at the end of `plan/implementation-plan.md`: the late Stale-context Mark at a save, an older tab writing after a calendar change, and the Review's open cost growing with history (item 3, recorded 2026-10-30, with proposed fixes the user has not yet chosen).
- D1's and D2's optional polish, and the D2 items the user triaged as "leave" (`plan/D04-handoff.md`, section 6).
- F12, the section-validator gaps, carried into D8's T8.6.
- Breakdowns for D9–D28 and RC. D9's numbering will start at P36, A150 and decision 61, unless D6 records further decisions first.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D6 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | none |
| Next task | **T6.1 Trade Analysis: Sell replay, FIFO Lot Matches, fees, realized P&L**, after creating `evidence/D06/` (`tdd-log.md`, `structural.md`, `provenance.md`). |
| Last commit | the commit that added this note, tagged `claude-opus-5.5-pre-d6` |
| Open questions | **Carried from D5, not blocking:** `src/ui/screens/TradeList.test.tsx:133` (`tj:open-list-ready` mark count) and B4.13 "Hold radio inside its chip at 375" (`e2e/d4/responsive-a11y.spec.ts:68`) each failed once under load and passed alone and in later cumulative runs; rerun once alone before treating either as real. Opening the Review takes about 2.2 s on the benchmark profile, ungated (tech debt item 3). |
