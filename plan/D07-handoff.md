# Handoff: `claude-opus-5.5`, implement D7

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D7 specifics, what D6 and the D7 prefactor left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-06, after the D7 prefactor completed and the spec map was rebased for D7. Two records cover the sessions since D6's note, and section 7 of each lists every task, commit, decision and flagged item:
- [D06-handoff.md](D06-handoff.md) is the record of D6's session.
- [D07P-handoff.md](D07P-handoff.md) is the record of the D7 prefactor's session.

This session **implements D7, "Single-leg options: happy path"**, under the frozen plan at revision 47. The breakdown is [D07-single-leg-options-happy-path.md](D07-single-leg-options-happy-path.md). It was agreed on 2026-10-17, before D4 to D6 were built, and has since been amended by decisions 76, 77 and 81 (section 3 lists what that means for each task).

Where things stand:
- **D6:** complete, tagged `claude-opus-5.5-d6` (`e10d55a`), pushed. Its acceptance rows are covered.
- **The D7 prefactor:** complete, tagged `claude-opus-5.5-d7p` (`b8517d4`), pushed. It made the Calculation Result the one value for every reason a figure has no number, carried unchanged through Daily Review and worded only through `src/ui/calculation-words.ts`, with `verify:wording` as the 13th check (decisions 77–80). It changed no stored shape. Its gate rerun passed 1225 unit, 154 integration and 167 browser tests and 13 of 13 checks.
- **After the prefactor:** the spec map was rebased (no tag changed, the reading lists are unchanged); revision 46 added tech debt items 11–13; and revision 47 (decision 81) gave D7's two new reasons their words and aligned two D7 seams with the built code. No code changed.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D07-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next step in section 7 at once**, without stopping to report that the reading is done.

Continue task by task through the browser-critic gate (T7.32) and the `claude-opus-5.5-d7` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r47` (revision 47) |
| Code D7 builds on | tag `claude-opus-5.5-d7p` (`b8517d4`), the prefactor's end |
| D6 release | tag `claude-opus-5.5-d6` (`e10d55a`) |
| D7 starting point | tag `claude-opus-5.5-pre-d7` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, up to date at the first session: the branch was pushed with this note's commit on 2026-11-06. Afterwards `[ahead N]`, where N counts D7's commits until the user asks for a push; if the user has pushed since, N counts from that push. No uncommitted changes, except the untracked `.claude/settings.json`: it is the user's own file, expected, and **never staged**. |
| `git log --oneline claude-opus-5.5-pre-d7..HEAD` | Empty at the first session. Afterwards, only D7 task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r47`, `claude-opus-5.5-d6`, `claude-opus-5.5-d7p` and `claude-opus-5.5-pre-d7`. |
| `git rev-parse 'claude-opus-5.5-d7p^{commit}'` | `b8517d481182069683cdfb43a733cb336d5da194` |
| `git rev-parse 'claude-opus-5.5-d6^{commit}'` | `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b` |
| `git diff claude-opus-5.5-d7p claude-opus-5.5-pre-d7 -- src e2e tests tools package.json` | Empty: nothing but plan and handoff documents changed after the prefactor. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 97 files and 1225 tests (unit), and 76 files and 154 tests (integration). At the prefactor's gate (`evidence/D07P/structural.md`, `t7p-12-rerun`) the browser suite (`npm run test:e2e`, D1 to D6 and `e2e/d7p`) had 167 passing on the full tier in 7.9 min, and the checks were 13 of 13. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D07/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes:
- other sessions' scratch, task-output and Playwright directories;
- processes you did not start. Other worktrees' preview servers run on other ports; leave them alone.

Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. It also registers two PreToolUse hooks on Bash, whose scripts are tracked in `.claude/hooks/`:
- `filter-test-output.sh` cuts single-case test output to failures and the summary.
- `guard-shell-writes.sh` refuses `sed -i`, `perl -i`, redirects, here-docs and `tee` into any tracked path outside `evidence/`, inline node or python that writes files, and git commands that move HEAD in the worktree (including `git reset`; drop a scratch commit with a revert, as the prefactor's T7P.6 did).

The registration file is untracked, so a fresh clone has neither hook until it is registered again. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates:
- the scoped reading below;
- delegating each task to the `tdd-task` subagent, and writing its brief;
- the `ocr-review` run, and bug tasks, after each task;
- recording `suite-runner` runs, and choosing the browser tier.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D7 uses, as decision 45 and the kickoff's plan-specific conditions direct.

**The `specs/` baseline (scoped):** read [plan/spec-reading/D07.md](spec-reading/D07.md), then read exactly the files and line ranges it lists, each range in full (180 entries, about 224,000 characters, rebased on 2026-11-06). It covers every core section of the [spec map](spec-map.md) plus every section tagged for D7. Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, then read that section in the spec before building on it. If the missing section should have been tagged for D7, correct the map, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`, and note the correction in `evidence/D07/structural.md`.

**The frozen plan (scoped):**
- **`plan/implementation-plan.md`:** everything except the `## D8` through `## D28` definition sections. That leaves:
  - the recorded decisions 1–81, the rules and cumulative obligations, and the freeze record;
  - the D1, D2, D4, D5, D5R, D5R2, D6 prefactor, D6, D7 prefactor and D7 definitions (D7's is the work);
  - the closing sections: parallelism, coverage index, review queue, open questions, and tech debt items 1–13.
- **`plan/technology-stack.md`** in full, including "Pinned versions".
- **`plan/acceptance-matrix.md`:** only the opening sections, through "Evidence methods common to every row". D7's rows are in full in section 8 of the D7 breakdown. Look up any other row by its scenario ID only when you need it, for example to update a status.
- **`plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`:** sections 1 (decisions, assumptions, A9's symbol format, the storage layout A10, and the mature dataset profile 1.3), 2, 3, 5 and 6.
- **`plan/D02-open-a-long-stock-position.md`:** sections 1 (Lots A22, the Entry window A23–A26, the schema-2 layout A28, the decline shape A29, the migration engine A30, the entry form A33), 2, 3, 5 and 6.
- **`plan/D04-daily-review.md`:** sections 1 (P8–P15 and A35–A60, especially A37 as P27 amends it, A41 `evaluate`, A46 bindings and coherent reads, A53 frames, A54 `AwaitingClose`), 2, 3, 5 and 6.
- **`plan/D05-deferred-reflection-and-journal-debt.md`:** sections 1 (P16–P18, A61–A75, and the amendments by decisions 56–59), 2, 3, 5 and 6.
- **`plan/D05R-review-redesign.md`:** section 1 (P36–P41, A150–A163, as amended by decisions 62–68), sections 6.4 and 6.5 (the card helpers and card identity), and section 9's D7 row.
- **`plan/D05R2-review-card-progress.md`:** sections 1.3 and 1.4 (P42–P54, A164–A176) and section 9's D7 row.
- **`plan/D06-close-a-long-stock-position.md`:** sections 1 (P19–P23, A76–A98, with decisions 71 and 72's notes), 2, 3, 5 and 6. D7 extends its exits, FIFO Lots, Terminal Disposition, position paths, Close Review and owed group.
- **`plan/D07-prefactor-calculation-results.md`:** sections 1 (P63–P76, the reason unions 1.3, the approved texts 1.4, A181–A188), 2, 4 and 8, with decisions 78–80. D7 builds every reason and every Instrument on what it left.
- **`plan/D07-single-leg-options-happy-path.md` in full**, which is the work, with its amendment notes (decisions 76, 77 and 81).

You may read D8's breakdown where it builds on D7 (its Restore fixtures include D7's option Trades and schema 6). Read only the parts that touch D7.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r48 and the next decision is 82. Updating an acceptance row's status from `planned` to `covered` once evidence exists is not a revision, but ask the user before doing it, as was done for D1 to D6; scenarios that become full in D7 are also marked in `plan/acceptance-matrix.md`. Run each row's command as written before marking it.

## 3. D7 specifics

- **Setup before T7.1:** create `evidence/D07/` with `tdd-log.md` (with its note that rows are single-case runs; `tdd.sh` maps `T7.n` to this folder and refuses to run without it), `structural.md` and `provenance.md`. Briefs take `evidence/D07` as the evidence directory. `full-suite.sh` derives `e2e/d7` from it as the current deliverable's folder.
- **Order.** Follow the task graph (breakdown, section 3). Fix the option Plan facts, the Expiration member, the payoff read model and the Settlement Due item in T7.18's type module early, so the four tracks the breakdown names can proceed: Trade Analysis (T7.1–T7.6), persistence and modules (T7.7–T7.11, T7.17), coordinators (T7.12–T7.16), and UI (T7.19–T7.24). Run tasks one at a time. T7.25 (now only a tag, below) needs nothing and can run early.
- **The breakdown predates the code it builds on.** It was agreed on 2026-10-17, before D4 to D6 and the prefactor were built and before decisions 46–81. Before each task, check its assumptions against what was actually built, and against these in particular. Where a passage can't be met as written against the built code, that is a plan question: stop and ask (section 5).
  - **The prefactor (decision 77, A188).** D7 adds to what the prefactor left, never beside it:
    - **Instruments.** `src/domain/instrument/` already owns `Instrument` (Stock only), `instrumentKey` and `instrumentOf`. T7.1 adds the Option variant there, with the OCC key of A99's amendment (`XYZ261120C00055000`, the `root` field, at most 3 strike decimals, equity options only). Section 2 and T7.1's seam carry decision 81's notes: the module is `src/domain/instrument/`, not a new `instruments/`, and the label is `instrumentLabel` in `src/ui/calculation-words.ts` ("XYZ 20 Nov 2026 55 Call"), the only code that names an Instrument in text.
    - **Reasons.** Every figure without a number is a `CalculationResult` (`src/domain/calculation-result/`) with a case of `UnavailableReason` or `NotApplicableReason`. D7's new reasons are union cases with their own details, never strings: `SettlementDue` (A110, A111, A122) and `NoOptionExpirationAnchor` (A121, T7.3). The breakdown's `Unavailable(MarkMissing)` and `NotApplicable(NoRemainingPosition)` are the prefactor's existing cases.
    - **Wording.** Each new reason is worded in `calculation-words.ts` at the three lengths (label, figure, sentence), in parts, with exhaustive switches; adding the union case makes `typecheck` fail until it is worded. No screen writes reason text of its own, and `verify:wording` (13th check) fails if one does. **The words for `SettlementDue` and `NoOptionExpirationAnchor` are decision 81's table** in the D7 breakdown's opening note: T7.3 adds `NoOptionExpirationAnchor` with its words, and T7.6 adds `SettlementDue` with its words, each with the module's unit cases for the three lengths.
    - **Findings.** Option facts that can't be replayed reuse the self-describing findings (P69): `ExceedsOpenQuantity` and `FlatBeforeLaterFacts` for short positions too (A103), with the Instrument and quantities the finding already carries.
    - **Daily Review.** Pressure, range position and risk and reward are Calculation Results; an option Trade's reasons pass through unchanged (P66, P67).
  - **D5R and D5R2: the Review card** (decision 81's note on T7.24). D4's `ReviewTrade` no longer exists. Where A112/A113 say "walked card", build on `src/ui/screens/ReviewCard.tsx` and `ReviewView.tsx`: Settlement Due is a panel between Reflections and Action in the card (D5R section 9), and a `PanelProgress` variant computed by the coordinator (D5R2 section 9). Results reach the screen through `held-review.ts`'s `fold` and `nextCard`. Reach cards in browser cases through the Trade-keyed helpers in `e2e/d4/support.ts`.
  - **Decision 76: no upgrade tests.** A120, B7.7 and C7.8 are withdrawn; the critic runs no `serve:releases`; AC-DEL-003 is deferred. **T7.25 only tags B6.6** (`e2e/d6/update.spec.ts`) `@release-history`: afterwards `npm run test:e2e -- --list` no longer lists it, and `--list --grep @release-history` lists 5. The integration migration tests (I7.1, I7.2) and B2.4/B2.6 still carry the schema-6 migration.
  - **Decision 78: fixture views.** `verify:fixtures` compares each fixture's derived views with its `expected-views.json`. T7.27 freezes the v6 fixture and migrates v1–v5; their `dump.json` files never change, and their views gain only what A121 adds. **Never regenerate v1–v5's dumps.**
  - **D6's built code.** Extend D6's FIFO Lots, position paths, Terminal Disposition and Close Review rather than adding parallel ones; an Expiration is a Position Change member with no agency (A106, A107).
- **This is the fifth schema change** (schema 5 → 6), through D2's migration engine (A30) as D4 to D6 used it: the `v5→v6` transform in `src/persistence/migrations/`, the `v1→…→v6` chain, candidate database, pointer flip, cleanup, the `tj-lifecycle` lock and Migration Blocked. Observation keys are unchanged (A99, A118): stock keys stay the bare symbol.
- **Writes follow ADR 0011 (decision 52).** Persistence `commit` checks exact-key bindings. A commit whose only failed binding is Journal's counter is retried through `retryCounterConflict` (`src/coordinators/trade-workflows/counter-retry.ts`). Index keys a write moves must be vacated (`vacateIndexKey`, tech debt item 9): check every index D7's writes touch, and the Closed range of `byLifecycleTerminal` that an Expiration close enters.
- **Keep the Review fast where D4 to D6 did.** The post-save path reads today's frames only (`framesOnly`). A111's one `ResolveFrames` `Historical(expirationDate)` request per distinct due expiration date is the only addition to `open`; add no per-history work (tech debt item 3).
- **Calendar coverage (decision 54)** is 2024-01-01 through 2028-12-31. Outside it, figures read "Outside the market calendar" (the prefactor's P72).
- **Do not build D8+ behavior early:** Assignment, Exercise and cash settlement; index options (D20); multi-leg Strategies and multiple expirations; option-price conditions; Not Entered (D10); backup and Restore; opening an exact past Review date; corrections; provider prices and Stop Discipline; reports. The same list (D7 section 7) is what D7's critic must not treat as defects.
- **Clock pinning in tests.** Chromium has native Temporal and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`, so every pinned browser case uses `launchAt`/`pinClock`/`setClock` from `e2e/d4/support.ts`. The faults build's `?clock=` (A49) pins both.
- **Benchmarks (AC-PERF-001, T7.28, T7.29).** D6's generator (version 5 at the end of D6) took several hours, and its first full runs exposed the index growth fixed in T6.25-B2 and B3 (decisions 73–75). Start `bench:generate` in the background as soon as T7.28's generator is committed, keep working on other tasks, and record the generation time. Never run `bench:run` alongside a browser suite.
- **TDD discipline.** Run every `it should` case red, then green, one at a time, logged in `evidence/D07/tdd-log.md` (`tdd.sh` runs vitest only; log Playwright reds and greens by hand). Code written before its red is backed out and rerun to a genuine red. A first-run pass gets the mutation check (an assertion failure or runtime exception, never a compile error) and is flagged in section 7.
- **Browser mutation builds.** The browser suites measure `dist-faults`. A mutation of UI code or CSS must rebuild that folder (`npm run build:faults`) before the run, and again after restoring; a plain `vite build` leaves the served build unchanged (D5's T5.24-B1).
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. `test:e2e` and `test:e2e:release-history` name their folders explicitly (`package.json:33-34`): the first task that adds `e2e/d7` adds it to both, after `e2e/d7p`. The task tier runs `e2e/d7` once it exists. **The full browser stage is near the Bash tool's 10-minute limit** (7.9 min at the prefactor's gate, 8.2 min after T7P.8, and one 13.4-min stage in T7P.10 with a load timeout; tech debt item 6). D7 adds its own browser suite. If a runner reports the browser stage above 9 minutes, raise item 6 with the user rather than choosing an alternative alone.
- **ocr on test-only commits.** `ocr` excludes test files. Brief the `ocr-review` agent to recreate a test-only commit in a scratch clone (in its own scratch directory, never in the worktree) with the test files relocated under `src/itg/d07/` as plain `.ts`, copying the `support.ts` files alongside in the parent commit. Findings caused only by the relocation are dismissed as relocation artifacts. Every brief names the task's breakdown section as background.
- **Tech debt triggers that D7 may hit:** item 11 (the Open list's Ready-state race, `TradeList.test.tsx:125`) if that case fails a run or a task touches the readiness mark; item 13 (`writeIntegrityFixture` in `e2e/d2/support.ts`) if a task changes that file. When a trigger fires, raise the item with the user; don't fix it unasked.
- **The browser-critic gate (T7.32).**
  1. Run the complete cumulative suites with `suite-runner` until they pass, with the browser stage on the full tier (`browser`, never `browser-auto`), and record the runs. Decision 76: no `test:e2e:release-history` run at the gate.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md`. Name the worktree and commit; forbid reading `evidence/` and any other worktree; list the setup helpers in `e2e/d4/support.ts`, `e2e/d5/support.ts`, `e2e/d5r/support.ts`, `e2e/d6/support.ts` and `e2e/d7/support.ts` by name with the Temporal pin helpers and clock constants; require port 5175 only; name the flows C7.1 onward without C7.8, the future-capability list, and the 375 and 320 px checks.
  3. It starts the app itself, drives the production UI in a browser, and never edits code.
  4. Delegate each defect it finds to a fresh subagent, which reproduces it with a failing test first and then fixes it; rerun the suites, and spawn another fresh critic.
  5. Save each report as `evidence/D07/critic-<n>.md` and add a row to the critic-cost table in `evidence/D07/structural.md`.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.

## 4. What is in place

Build on these rather than re-creating them. Read the code before extending it. [D06-handoff.md](D06-handoff.md), section 4, describes what D5 and earlier left; all of it is still in place. [D07P-handoff.md](D07P-handoff.md), section 7, has every prefactor task and commit.

| Piece | Where | Notes for D7 |
|---|---|---|
| **Calculation Results (prefactor)** | `src/domain/calculation-result/index.ts` (`CalculationResult<T, U, N>`, `UnavailableReason`, `NotApplicableReason`, `IncoherentFact`), re-exported by `src/domain/trade-analysis/` | Add `SettlementDue` and `NoOptionExpirationAnchor` as cases with their details. Figures narrow `U` and `N` to what they can return (A183). |
| **Instruments (prefactor)** | `src/domain/instrument/index.ts` (`Instrument`, `instrumentKey`, `instrumentOf`), with `instrument.test.ts` | Stock only; a stock key is its bare symbol. T7.1 adds the Option variant and its OCC key branch. |
| **Wording (prefactor)** | `src/ui/calculation-words.ts` (`instrumentLabel`, `unavailableWords`, `notApplicableWords`, `findingWords`, `unboundedWords`, `text`, and the Mark-status and issue-code helpers decision 80 moved in); `tools/wording-scan.ts` behind `npm run verify:wording` | Add the option label branch and each new reason's words. Item 12's line-number gap is known. |
| **Daily Review (prefactor)** | `src/coordinators/daily-review/types.ts`, `attention.ts` (`riskRewardOf`, `pressureOf`, `rangePositionOf`, `attentionOf`), `daily-review.ts` | `basis` and `rangePosition` are Calculation Results; ranking sorts a Value ahead of a non-Value. |
| **D6 (tag `claude-opus-5.5-d6`)** | Trade Analysis's FIFO Lots, position paths, Terminal Disposition and Realized R (`src/domain/trade-analysis/derive.ts`); the exit (`src/coordinators/trade-workflows/`); Close Review and the owed group (`src/modules/journal/`, `src/coordinators/daily-review/`); the Closed list and Detail (`src/coordinators/trade-views/`, `src/ui/screens/TradeList.tsx`, `TradeDetail.tsx`); `PositionChangeForm.tsx`'s exit | D7 extends each to options, short Lots and the Expiration member. |
| Schema 5 | `src/persistence/schema.ts` (`SCHEMA_VERSION` 5), `src/persistence/migrations/` (`v1→…→v5`) | `terminalTime` and the sparse `byLifecycleTerminal` index are private and rebuilt (D6 A87, A96). |
| Fixtures | `tests/fixtures/workspace-v1/` to `workspace-v5/` (`dump.json`, `expected-views.json`); `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts` | **Never regenerate v1–v5's dumps.** T7.27 adds v6. |
| Capacity | `tools/capacity/`, `src/delivery/capacity-basis.json` | Schema 5; T7.26 recomputes it for schema 6. |
| Benchmark | `src/app/bench.ts` (`BENCH_GENERATOR_VERSION` 5), `src/app/bench-generator.ts`, `tools/bench-generate.ts`, `tools/bench-run.ts`, `bench/`; cached profile in `.cache/bench/profile` | T7.28 bumps the generator for section 1.4's option mix. |
| Release harness | `tools/build-releases.ts`, `tools/release-server.ts` | Builds `d1`, `d2`, `d4`, `d5r2` and `d6` (plus `v1` and the current-source folders) for B2.4, B2.6, the card helpers and the `@release-history` tests. D7 adds no previous release (decision 76). |
| Node integration | `tests/integration/d1/` to `d6/`, `tests/support/` (`stack.ts`, `request-counter.ts`, `review-fixture.ts`) | D7 adds `tests/integration/d7/`; `d6/query-count.test.ts` is the model for T7.29. |
| Browser suites | `e2e/d1`, `d2`, `d4`, `d5`, `d5r`, `d6`, `d7p`; `e2e/smoke/` is RC's engine probe, outside `test:e2e` | 5 `@every-task` tests and 4 `@release-history` tests (5 after T7.25). `e2e/d7p/layout.spec.ts` checks worded reasons at 320 and 375 px; extend its pattern for D7's new reasons if the critic's narrow checks need evidence. |
| Suite runner | `.claude/agents/suite-runner.md`, `.claude/scripts/full-suite.sh` (`unit`, `integration`, `browser`, `browser-auto <base>`, `checks`) | Each stage is one foreground call; 13 checks. |

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks, and never push the tags `claude-opus-5.5-plan-r30` or `-plan-r32` to `-plan-r40`.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change (including dependency pins) goes to a fresh `tdd-task` subagent. The agent definitions hold the working rules (Edit tool only, scratch directories, exit codes, browser runs and ports, rebuilding after a mutation, staging, the clean-tree check), so briefs don't repeat them.
- **Cumulative runs.** End every task with a complete cumulative run, delegated to `suite-runner` and recorded in `evidence/D07/structural.md`, with outputs in `evidence/D07/suite-runs/`. The browser stage is `browser-auto <base>`, where `<base>` is the commit the task started from, recorded in section 7 before the task's brief; record the tier it chose and its printed reason. The full tier (`browser`) runs before every critic and in T7.31. Tell the runner to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen. Subagents never run `npm run build:releases` on its own.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says: a Valid or Doubtful finding with a failure scenario becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time; a Wrong finding, or one with no failure scenario, is dismissed with its reason in `structural.md`. Copy each `ocr.json` to `evidence/D07/ocr/<task>-<sha>.json`.
- **Background work.** An `ocr-review` alongside the next task is fine. Never run two browser suites at once (they share port 5175), and never run `bench:run` alongside a browser suite.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own. Check every user proposal against the spec; if one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- **Derived values** over specialist estimates from the trader (decision 31). Don't plan far ahead of working code (decision 40).
- **After each finished task:** commit it, record its cumulative run, update section 7 of this note, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D7 from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including a D7 passage that the built code can't meet as written (section 3), or a reason or label whose words the plan doesn't give;
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify);
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d7` locally. Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' minor observations;
- the acceptance rows ready to be marked `covered`. Ask before marking them.

Never push.

## 6. Out of scope

- Any deliverable other than D7, unless the user says otherwise.
- **Upgrade tests** (decision 76; tech debt item 10), and AC-DEL-003's D7 evidence.
- **Index options** (cash-settled, roots such as `SPXW`): D20, per the plan's open questions raised by the D7 prefactor. D7's options are equity options settled by delivering shares.
- **Earlier critics' minor observations** (D4, D5, D5R, D5R2, D6), which the user chose not to pursue.
- **The tech-debt items** at the end of `plan/implementation-plan.md`: 1–4, 6 to 9 and 11–13 stay as recorded (raise 6, 11 or 13 when section 3's triggers fire); 5 is resolved; 10 waits for the first release for real use.
- F12, the section-validator gaps, carried into D8's T8.6.
- Breakdowns for D8–D28 and RC. D9's numbering will start at P77, A189 and decision 82, unless D7 records further decisions first.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D7 progress

Update this section at the end of each task.

| | |
|---|---|
| Next task | Setup: create `evidence/D07/` (section 3) and record the location checks; then T7.1. |
| Base commit | the commit the next task starts from, for `browser-auto` (section 5). T7.1: the setup commit. |
| Tasks done | none |
| Last commit | `docs(plan): D7's handoff`, tagged `claude-opus-5.5-pre-d7` |
| Open questions | none yet. (Settled before the session: the words for D7's new reasons, decision 81, revision 47.) |
