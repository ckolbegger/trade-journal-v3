# Handoff: `claude-opus-5.5`, implement D5

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D5 specifics, what D4 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-29, after D4 completed. [D04-handoff.md](D04-handoff.md) is the record of D4's session (section 7 lists every D4 task, commit, decision and flagged item); this note is the starting point for D5.

This session **implements D5, "Deferred reflection and Journal Debt"**, under the frozen plan at revision 14. D4 is complete:
- Its gate passed: critic-1 found four defects, fixed test-first; critic-2 passed with none (`evidence/D04/critic-2.md`).
- Every D4 acceptance row in section 8 of the D4 breakdown is marked covered; AC-MARK-001, AC-REV-003 and AC-JOUR-001 are covered in `plan/acceptance-matrix.md`.
- It is tagged `claude-opus-5.5-d4` on `4ab43d5` (moved there by the user from `cb34401`; the code is identical). The tag is local and has not been pushed.
- After the tag, revision 14 (decision 55) moved Vitest to 4.1.12 and Wrangler to 4.153.0 for `npm audit` fixes, and a "Tech debt" section was added at the end of `plan/implementation-plan.md`.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D05-handoff.md and follow it."* Run the location checks in section 1, do the reading in section 2, and then **start the next task in section 7 at once**, without stopping to report that the reading is done. Continue task by task through the browser-critic gate and the `claude-opus-5.5-d5` tag, stopping only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local` |
| Frozen plan | tag `claude-opus-5.5-plan-r14` (revision 14) |
| D4 release | tag `claude-opus-5.5-d4` (`4ab43d5`) |
| D5 starting point | tag `claude-opus-5.5-pre-d5` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`; D4 has not been pushed, so N is large (292 at `claude-opus-5.5-pre-d5`). No uncommitted changes. |
| `git log --oneline claude-opus-5.5-pre-d5..HEAD` | empty at the first session; afterwards only D5 task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit |
| `git tag --list 'claude-opus-5.5-*'` | includes `claude-opus-5.5-plan-r14`, `claude-opus-5.5-d4` and `claude-opus-5.5-pre-d5` |
| `git rev-parse claude-opus-5.5-d4` | `4ab43d58931f2966d6a2d05f6b41be9bc239dd1c` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run` | every test file and test passes; at `claude-opus-5.5-pre-d5`, `Test Files 102 passed (102)`, `Tests 892 passed (892)` (819 unit and 73 integration). The browser suite (`npm run test:e2e`) had 142 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D05/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start (other worktrees' preview servers run on other ports; leave them alone). Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading below, delegating each task to the `tdd-task` subagent, writing briefs, the `ocr-review` run and bug tasks after each task, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D5 uses, as decision 45 and the kickoff's plan-specific conditions direct.

**The `specs/` baseline (scoped):** read [plan/spec-reading/D05.md](spec-reading/D05.md), then read exactly the files and line ranges it lists, each range in full. It covers every core section of the [spec map](spec-map.md) plus every section tagged for D5. Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, then read that section in the spec before building on it. If the missing section should have been tagged for D5, correct the map, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`, and note the correction in `evidence/D05/structural.md`.

**The frozen plan (scoped):**
- `plan/implementation-plan.md`: everything except the `## D6` through `## D28` definition sections. That leaves the recorded decisions 1–55, the rules and cumulative obligations, the freeze record, the D1, D2, D4 and D5 definitions (D5's is the work), and the closing sections: parallelism, coverage index, review queue, and tech debt.
- `plan/technology-stack.md` in full, including "Pinned versions".
- `plan/acceptance-matrix.md`: only the opening sections, through "Evidence methods common to every row". D5's rows are in full in section 8 of the D5 breakdown. Look up any other row by its scenario ID only when you need it, for example to update a status.
- `plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`: only sections 1 (decisions, assumptions, the storage layout A10, and the mature dataset profile 1.3), 2, 3, 5 and 6.
- `plan/D02-open-a-long-stock-position.md`: only sections 1 (decisions and assumptions, including the schema-2 layout A28, the decline shape A29, the migration engine A30, the entry form's disposition A33, and the release harness A34), 2, 3, 5 and 6. Skip its behavioral tasks, critic flows, acceptance rows, clause check, evidence and follow-up sections. D5 changes D2's T2.5 "reject Defer" case (D5 section 1.2).
- `plan/D04-daily-review.md`: sections 1 (decisions P8–P15 and assumptions A35–A60, especially the schema-3 layout A38, A45 and A46 on bindings and coherent reads, A53 frames, A57 and A58 on the Review screen and Action form), 2, 3, 5 and 6. Skip its behavioral task cases, critic flows, acceptance rows and clause check unless a D5 task builds on one.
- **`plan/D05-deferred-reflection-and-journal-debt.md` in full**, which is the work.

You may read D6–D8's breakdowns for context, since some of them amend D5 (D8's backup round trip extends to Debt; D6 decides where Debt for a Trade outside the walk appears). Read only the parts that touch D5.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`; the next one is r15, and the next decision is 56. Updating an acceptance row's status from `planned` to `covered` once evidence exists is not a revision, but ask the user before doing it, as was done for D1, D2 and D4. Run each row's command as written before marking it (D4 found one that named no file).

## 3. D5 specifics

- **Order.** Follow D5's task graph (section 3 of its breakdown). Fix the Debt projection, the `ResolveDebt` command, and the Review Trade and Trade Detail read models in T5.13's type module early; that lets the three tracks the breakdown names proceed: Journal and persistence (T5.1–T5.5, T5.12), Market Data and coordinators (T5.6–T5.11), and UI (T5.14–T5.17). Run tasks one at a time.
- **This is the third schema change** (schema 3 → 4), through D2's migration engine (A30) as D4 used it: the `v3→v4` transform and the `v1→v2→v3→v4` chain, candidate database, pointer flip, cleanup, the `tj-lifecycle` lock and Migration Blocked. Per-record transforms read only authoritative fields; private indexes (`byOutstandingDue`, `byAnchorTrade`, `journalObligations`) are rebuilt, never copied (D8 A139).
- **Writes follow ADR 0011 (decision 52).** Persistence `commit` checks exact-key bindings; there is no in-transaction read or increment. Read A62's "guarded `put` … reads the record and requires the expected Debt" as a subject binding on the obligation record and the Debt at their expected revisions, checked by `commit`. The Journal revision is a counter binding: a commit that fails on it alone re-reads, re-validates and retries, up to 3 attempts, as T4.4-B6 to B8 built for Mark, Catalog and Journal seeds. A new outcome for a key still uses `add`, so a duplicate fails the transaction (`src/modules/journal/journal.ts`).
- **Frames already carry what D5 extends.** D4's `ResolveFrames` frames carry the date, that session's close and the next completed session (A53); T5.7 adds the previous session's close. Daily Review's post-save path reads today's frames only (`framesOnly`, T4.30-B1) and carries `resolutionRevisions` (T4.30-B2); keep it free of the historical gap scan when Debt joins the post-save result (A67), or saves become slow again at the bench's scale.
- **Calendar coverage (decision 54).** Coverage is 2024-01-01 through 2028-12-31. Outside it there is no Expected Mark Date or frame, so A69's Debt classification on Trade Detail (which needs E and the previous session's close) has no defined answer, and the Review cannot open. **This is an open plan question**: raise it with the user when T5.11 or T5.17 reaches it, unless it is settled before (section 7). The recommendation to offer: outside coverage, an Outstanding Debt reads "Reflection owed" with no due classification, and Reflect now and Decline still work.
- **Prompt identity.** D4 found that telling Responses apart by prompt text is fragile: `src/domain/daily-trade-review-prompts.ts` is the Daily Trade Review's single source of wording, and a reworded optional prompt would drop its answer from display. The Debt form renders the snapshot definition by exact revision (A64, A74); use the definition's stable Prompt and Option identities, never text.
- **Do not build D6+ behavior early:** no exits, Close Review or its Defer, Closed Trades; options or Settlement Due; opening an exact past Review date; provider prices or Stop Discipline; Journal history views, Edit, Addendum or Void (including reopening a Debt); Management Debt or `NeedsTradeWorkflow`; backup. The same list (D5 section 7) is what D5's critic must not treat as defects.
- **Clock pinning in tests.** This Chromium has native Temporal, and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`, so every pinned browser case must also patch `Temporal.Now`: use `launchAt`/`pinClock` from `e2e/d4/support.ts` (B5.x "Dates are set with Playwright's clock" means these helpers). The faults build's `?clock=` (A49) pins both and is what C5.5 uses. The bench pin (`tools/bench/pin.ts`) patches Temporal too; T4.31's first numbers were wrong because it didn't.
- **The previous release (A72, T5.18)** is exported from the tag `claude-opus-5.5-d4` (`4ab43d5`) with `git archive` into a scratch directory and built there. Never create a worktree for it. T5.18 turns D4's current-source `d4` into the tagged one and adds a current `d5`.
- **Benchmarks (AC-PERF-001, T5.21, T5.22).** D4's generator 2 takes about 90 minutes for 1,255 sessions (2024-01-02 to the as-of 2028-12-29T21:35:00Z); D5 bumps it to generator 3 with the section 1.4 dispositions (400 Position Changes match D4's dataset). Run generation in the background and continue with other tasks. Thresholds stay at a nearest-rank p95 of 2,500 ms cold and 1,500 ms warm (D4: cold about 104 ms, warm about 45 ms). Results go in `evidence/D05/bench.md`. The bench serves on `BENCH_PORT = 5181` (D2's convention, in `tools/bench/profile.ts`); every other server uses 5175.
- **TDD discipline.** Run every `it should` case red, then green, one at a time. Record the commands and outcomes in `evidence/D05/tdd-log.md` (create it before the first task, with a note that its rows are single-case runs; `tdd.sh` refuses to run without it, and runs vitest only, so Playwright reds and greens are logged by hand). Code written before its red is backed out and rerun to a genuine red. A case that passes on its first run because earlier work already built the behavior gets the mutation check in the `tdd-task` agent (an assertion failure or runtime exception, never a compile or type error) and is flagged for the user; never fabricate a red. Structural tasks record their exact verification in `evidence/D05/structural.md`. Engine and OS versions go in `evidence/D05/provenance.md`.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. `test:e2e` runs `e2e/d1 e2e/d2 e2e/d4`; extend it with `e2e/d5`, since D5's gate needs all four. Evidence from all three engines belongs in RC. One D4 case (B4.11, runtime failure) flaked once under load; rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **The browser-critic gate (T5.25).**
  1. Run the complete cumulative unit, integration and browser suites with the `suite-runner` subagent until they pass, and record the run.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md` (brief v2). The frozen plan authorizes this spawn. D4's critic-2 brief is a good model: it lists the support helpers by name, the Temporal pin rule, port 5175 only, and tells the critic not to read `evidence/`.
  3. Give it D5's section 7 inputs and the future-capability list.
  4. It starts the app itself, drives the production UI in a browser, runs C5.1 onward plus the 375 and 320 px checks, and never edits code.
  5. Delegate each defect it finds to a fresh subagent, which reproduces it with a failing test first and then fixes it; rerun the suites, and spawn another fresh critic.
  6. Save each report as `evidence/D05/critic-<n>.md` and add a row to the critic-cost table in `evidence/D05/structural.md`.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes,** commit and create the local tag `claude-opus-5.5-d5` on that commit. D6's harness builds the previous release from it. Don't push the tag unless the user asks.

## 4. What D4 left in place

Build on these rather than re-creating them. Read the code before extending it. `plan/D04-handoff.md`, section 7, records every D4 task's details if you need more; D2's pieces (application facade, migration engine, Trade Analysis, readiness and faults build, release harness, fixtures) are described in its section 4 and are still in place.

| Piece | Where | Notes for D5 |
|---|---|---|
| Application facade | `src/app/compose.ts` (`createApplication`), `src/app/types.ts`, `src/app/manifest.ts` | The UI imports facade types only through `src/app/types.ts`. `lint:deps` forbids UI → modules and coordinators → app, and `only-market-data-sees-session-policy`. `verify:capabilities` currently reports 18 operations, 7 variant-qualified, 8 routes, 3 Entry Types, schema 3. |
| Persistence and migration | `src/persistence/` (`schema.ts` with `SCHEMA_VERSION` 3 and `PRIVATE_STORES`, `persistence.ts`, `rebuild.ts`, `migrations/` with `v1-to-v2.ts`, `v2-to-v3.ts`) | Optimistic exact-key bindings at `commit` (ADR 0011); `commit` names the failed binding. `ReadTransaction` has `findLastFromIndex` and `getAllInRange`. |
| Session policy | `src/domain/session-policy/` (`rules.ts`, NYSE 2024–2028) | Only Market Data imports it. Two unreachable branches in `rules.ts` are recorded for the user. |
| Market Data | `src/modules/market-data/` | Manual Marks, acknowledgments, `ResolveFrames` (`Current`, `Review`, `Historical`), `ExpectedSnapshot`, `ResolveSession`, `recover` without a provider, `validateSection(source, policy)`. No module counter (decision 53): saves bind per key. |
| Journal | `src/modules/journal/` (`journal.ts`, `effects.ts`, `records.ts`, `section.ts`, `manifest.ts`) | Plan and Position Change Reflections, the Daily Trade Review Entry Type, the obligation index (`journalObligations`, `add` per outcome), seeds re-run on every initialize with counter retry. `Journal.actionAt` was removed (T4.16-B6). |
| Daily Review | `src/coordinators/daily-review/` | `open` (task families, attention order, completion), `getTrade`, `save` (`SaveTradeAction`); coherent reads with `ChangedDuringAssembly` (A46); post-save result from `framesOnly`. D5 adds owed reflections and `ResolveReviewDebt`. |
| Trade Views | `src/coordinators/trade-views/`, `src/coordinators/valuation.ts` | Current evaluation, dated "At <date> close" and "At entry" lines, Stale context, Unavailable reasons including `SessionPolicyNotCovered`. |
| Workspace | `src/coordinators/workspace/` | Migration to schema 3, seed manifest, policy identity and A40 findings (never blocking). |
| UI | `src/ui/screens/` (`ReviewView.tsx`, `ReviewTrade.tsx`, `ActionForm.tsx`, `MarkEntry.tsx`, `review-attention.ts`, `PositionChangeForm.tsx`, `ReflectionPrompts.tsx`, `TradeDetail.tsx`, `TradeList.tsx`, `AboutView.tsx`), `src/ui/figures.ts` (`dollarsAndR`), `src/ui/app.css` | Chip radio groups are `fieldset.choices` with `label.chip`; a disabled chip is dimmed with a not-allowed cursor. The walk holds while an Action form is dirty ("Save your Action or put back its saved values to leave this Trade."); a form holding values stays, disabled, when the shell turns read only. The calendar warning icon ("Coming soon - update calendar") and the storage icon link to About. |
| Faults build | `src/delivery/faults.ts` | `?faults=` (readiness checks, migration stages, `inventory`, `control`), `window.__tjFaults`, and `?clock=<ISO instant>` (A49). `verify:no-fault-hooks` checks `dist/`. |
| Release harness | `tools/build-releases.ts`, `tools/release-server.ts` | `d1` and `d2` from their tags, `d4` from current source. |
| Capacity | `tools/capacity/`, `src/delivery/capacity-basis.json` | Schema 3: Marks 621.3, acknowledgments 546.8, Actions 1,929.8 bytes; required quota about 2.48 GB (accepted by the user). |
| Fixtures | `tests/fixtures/workspace-v1/`, `workspace-v2/`, `workspace-v3/` | **Never regenerate v1, v2 or v3.** v3 is as of Monday 2026-10-19 17:00. |
| Benchmark | `src/app/bench-generator.ts`, `tools/bench-generate.ts`, `tools/bench-run.ts`, `tools/bench/pin.ts`, `bench/dataset.json`, `bench/expected-open-rows.json`; `npm run bench:expected` re-renders expected rows | Generator 2; cached profile in `.cache/bench/profile`. |
| Node integration | `tests/integration/d1/`, `d2/`, `d4/` with `support.ts`; `tests/support/` | `npm run test:integration -- d5/<name>` selects files; name each file so the section 8 commands run as written. |
| Browser suite | `e2e/d1/`, `e2e/d2/`, `e2e/d4/` with `support.ts` | `e2e/d4/support.ts` re-exports d2 and d1 and adds `pinClock`, `launchAt`, `onboardedAt`, `setClock`, the Monday and Tuesday instants, `createTrades`, `createTradeAt`, `openReview`, `enterMark`, `acknowledgeMark`, `continueToTrades`, `actionForm`, `saveAction`, `observationsOf`, `actionEntriesOf`. Helpers wait for the save result before returning. |

## 5. Working rules

- Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder; **subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name (D4's briefs forced the Opus trailer on about 100 Sonnet-written commits; the user chose not to rewrite them). **Never push** unless the user asks.
- The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task` subagent. Briefs tell it to use the Edit tool only, never `sed -i` or edit scripts (D4's subagents broke this several times); check each result.
- End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent (it writes the full outputs to `evidence/D05/suite-runs/` and returns the table), and recorded in `evidence/D05/structural.md`. The run covers unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*` (12 checks at the end of D4).
- Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says: each Valid or Doubtful finding with a failure scenario becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time; a Wrong finding, or one with no failure scenario, is dismissed with its reason in `structural.md` and listed in section 7's open questions. Be careful dismissing: T4.22's dismissal of "a refused write hides the entered values" was wrong.
- A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- Never use bare `git stash`; use a WIP commit, or a tagged stash applied by SHA.
- Refer to document sections in words, never with the "§" sign.
- Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose.
- Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- Don't plan far ahead of working code (decision 40).
- After each finished task, commit it, record its cumulative run, update section 7 of this note with where D5 stands, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D5 from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including the coverage question in section 3;
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify);
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d5` locally. Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' minor observations;
- the acceptance rows ready to be marked `covered`. Ask before marking them.

Never push.

## 6. Out of scope

- Any deliverable other than D5, unless the user says otherwise.
- **D4's critic observations.** On 2026-10-29 the user chose not to pursue them now (focus after Mark and Action saves, the stale status header, 2-decimal Mark display, the attention reason's missing at-entry and current figures, no Overrun in the Review's Trade panel, one-click Withdraw, no Action-form Revert, `aria-required` on Intent, the R's lost minus sign, the generic Review error outside coverage, and the rest in `evidence/D04/critic-1.md` and `critic-2.md`). Don't fix them as part of D5. D5's own requirements still apply where they overlap: A71 moves focus to the next reflection, or to the Action form, after a Debt save.
- **The tech-debt items** at the end of `plan/implementation-plan.md` (the late Stale-context Mark at a save, and an older tab writing after a calendar change). The user accepted both.
- D1's and D2's optional polish, and the D2 items the user triaged as "leave" (`plan/D04-handoff.md`, section 6).
- F12, the section-validator gaps, carried into D8's T8.6.
- Breakdowns for D9–D28 and RC. D9's numbering will start at P36, A150 and decision 56.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D5 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | T5.1 (`ec8e6c1`, with T5.1-S1 `fc2dfd7`); T5.18 (`f901511`); T5.2 (`cf85b93`); T5.3 (`ce6d64f`, T5.3-B1 `56f4dc9`); T5.4 (`fcd9132`); T5.5 (`12c927c`, T5.5-B1 `851f6b1`, B2 `367baf0`, B3 `2877686`). Cumulative run after T5.5: green except `verify:capacity`. |
| Next task | **T5.6 Trade Workflows: `recordPositionChange` with Defer.** |
| Last commit | the evidence and handoff commit after T5.5 |
| Open questions | **Flagged flake:** `src/ui/screens/TradeList.test.tsx:133` (`tj:open-list-ready` mark count 1 instead of 2) failed once in the T5.4 cumulative run; passes alone and in a full unit rerun. **Temporary rule:** `getTradeDetail` filters Debt items from the narrative until T5.11. **Flagged first-run passes:** T5.3 "validate the answers against the Debt snapshot revision" (mutation-checked). **Flagged:** B4.13 "Hold radio inside its chip at 375" (`e2e/d4/responsive-a11y.spec.ts:68`) failed twice in T5.18's combined d1+d2+d4 run, passing alone and in the cumulative run; likely a layout race after `setViewportSize`. **Before T5.11 and T5.17 (plan question for the user):** how an Outstanding Debt is classified on Trade Detail outside session-policy coverage, where there is no Expected Mark Date (decision 54 and A69); recommended answer in section 3. **Pending the user (raised 2026-10-29, not blocking):** `npm audit` reports vite 8.3.2 (high, dev server only; fixed in 8.3.5) and zod 4.6.5 (high, memory exhaustion on huge collections; fixed in 4.6.7; no app code imports zod until D8). Moving either pin is a plan revision (r15) with a full suite run; ask before doing it. |
