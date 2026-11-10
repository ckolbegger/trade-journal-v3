# Handoff: `claude-opus-5.5`, implement the D7S prefactor

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, the prefactor's specifics, what D7 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-10, after plan revision 72. [D07-handoff.md](D07-handoff.md) is the record of D7's session; its section 7 and the D7 breakdown's Progress section list every D7 task, commit, decision and flagged item.

This session **implements the D7S prefactor, "One Mark-to-Market Valuation"**, under the frozen plan at revision 72. The breakdown is [D07S-prefactor-mark-to-market-valuation.md](D07S-prefactor-mark-to-market-valuation.md): 15 tasks (T7SP.1 to T7SP.15), agreed by the user on 2026-11-10 after an architecture review of D7's commits (decisions 101 and 102). Task status lives in the breakdown's Progress section (decision 100).

Where things stand:
- **D7:** complete, tagged `claude-opus-5.5-d7` (`7e50d82`). Its gate run (`t7-32-b7-gate`) passed 1438 unit, 191 integration and 183 browser tests (119 in `browser-1`, 64 in `browser-2`), with every check.
- **After D7:** the D7 retrospective (`evidence/D07/retro.md`) changed process documents and tooling only: the critic gate's stopping rule, task notes and status in the breakdown's Progress section (decision 100), `.claude/scripts/acceptance-commands.sh` (revision 71), and a committed pre-commit hook with `npm run verify:hooks` (`tools/install-hooks.sh`, `tools/verify-hooks.sh`). No product code or test suite changed. The branch was pushed through the retro.
- **Revision 72** (`576aaa8`) added the breakdown, amended `specs/design/market-data.md` (`openReadSession`) and `specs/design/trade-analysis.md` (`derive`'s contract status), and rebased the spec map. It is not pushed.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D07SP-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next task at once**: the first row of the breakdown's Progress section not marked "Done". Don't stop to report that the reading is done.

Continue task by task through the gate (T7SP.15) and the `claude-opus-5.5-d7sp` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r72` (revision 72) |
| Code the prefactor builds on | tag `claude-opus-5.5-d7` (`7e50d82`) |
| Prefactor starting point | tag `claude-opus-5.5-pre-d7sp` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`. At the first session N is 2 (revision 72 and this note's commit), unless the user has pushed since; afterwards N also counts the prefactor's commits. No uncommitted changes. `.claude/settings.json` is committed, holding the project's permissions and the PreToolUse hook registrations; only the user edits it. |
| `git log --oneline claude-opus-5.5-pre-d7sp..HEAD` | Empty at the first session. Afterwards, only prefactor task commits, their evidence and Progress updates, and handoff updates. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r72`, `claude-opus-5.5-d7` and `claude-opus-5.5-pre-d7sp`. |
| `git rev-parse 'claude-opus-5.5-d7^{commit}'` | `7e50d82e4434e18ae48a140d251061e44b25a95b` |
| `git rev-parse 'claude-opus-5.5-plan-r72^{commit}'` | `576aaa8677ac7acc42087d40c0e6ba3e68f40cb0` |
| `git diff --stat claude-opus-5.5-d7 claude-opus-5.5-pre-d7sp -- src e2e tests` | Empty: no product code or test suite changed after D7. |
| `git diff --name-status claude-opus-5.5-d7 claude-opus-5.5-pre-d7sp -- tools package.json 'eslint*'` | Only the retro's hook work: `tools/install-hooks.sh` and `tools/verify-hooks.sh` added, `package.json` modified (`prepare`, `verify:hooks`). |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails, ask the user to run `ocr auth login` (`.claude/docs/implementing.md`). |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 121 files and 1438 tests (unit), and 94 files and 191 tests (integration), as at D7's gate. The full browser tier had 183 passing (`browser-1` 119 in 4.9 min, `browser-2` 64 in 4.0 min). The checks stage now runs 14 checks: D7's 13 plus the retro's `verify:hooks`. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D07SP/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start. Other worktrees' preview servers run on other ports; leave them alone.

Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The PreToolUse hooks on Bash, registered in `.claude/settings.json`, have their scripts in `.claude/hooks/`:
- `filter-test-output.sh` cuts single-case test output to failures and the summary.
- `guard-shell-writes.sh` refuses `sed -i`, `perl -i`, redirects, here-docs and `tee` into any tracked path outside `evidence/`, inline node or python that writes files, and git commands that move HEAD in the worktree (including `git reset`; drop a scratch commit with a revert).

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading, delegating each task to `tdd-task` and writing its brief (with the "Notes for later tasks" bullets in section 7 that name the task, copied word for word), the `ocr-review` run and bug tasks, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what the prefactor uses.

**The `specs/` baseline (scoped, A189).** The prefactor has no generated reading list, as the D7 prefactor had none. Read exactly these, each range in full (line ranges as rebased in revision 72):
- `specs/glossary.md`: the entries **Settlement Due** (line 69), **Calculation Result** and **Mark-to-Market Valuation** (lines 132–133).
- ADRs in full: `specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md`, `0007-observed-valuation-and-expiration-payoff.md`, `0011-optimistic-bindings-and-shared-counter-retry.md`.
- `specs/design/overview.md`: Approved modules (25–45), Dependency shape (46–97), Who may call whom (98–122), Calculation availability (160–172), Snapshot binding (188–191), Performance design constraint (266–273).
- `specs/design/market-data.md`: Contract (3–24), Query contract (87–116, with the new `openReadSession` paragraph), Automatic recovery (117–139).
- `specs/design/trade-analysis.md`: `derive` (59–72, with the new contract-status paragraph), `evaluate` (73–86), Staged evaluation (117–133).
- `specs/design/daily-review.md`: Date, eligibility, and ordering (17–33), `open` (34–65), `getTrade` (66–71), Settlement Due (127–145).
- `specs/design/trade-views-and-reporting.md`: `browseTrades` (24–36), `getTradeDetail` (37–67), `previewMarkChange` (136–160), Invariants (161–170).

Search `plan/spec-map.md` (don't read it in full) when the work touches another section, then read that section before building on it, and note it in `evidence/D07SP/structural.md`.

**The frozen plan (scoped):**
- **`plan/D07S-prefactor-mark-to-market-valuation.md` in full**, which is the work.
- **`plan/implementation-plan.md`:** everything except the `## D8` through `## D28` definition sections. That leaves the decisions 1–102 (101 and 102 are this work; 97 and 99 set the Open page's dated-line reads and the settlement time), the rules and cumulative obligations, the freeze record, the definitions through D7S, and the closing sections with tech debt items 1–21 (item 4 is cleared by T7SP.13).
- **`plan/technology-stack.md`** in full, including "Pinned versions".
- **`plan/acceptance-matrix.md`:** only the opening sections, through "Evidence methods common to every row". The prefactor adds no row and changes no status (breakdown, section 7).
- **`plan/D07-single-leg-options-happy-path.md`:** section 1 (A99–A122, especially A110 observation requirements, A111 and A112 settlement, with the amendment notes), section 2 (implementation boundaries), the T7.6, T7.14, T7.15, T7.16 and T7.29 task text (they built what the prefactor moves), and section 6.1's I7.15 row. Not the UI tasks.
- **`plan/D04-daily-review.md`:** section 1 (P12 and P13, the dated last-close line; A41 `evaluate`; A46 bindings and coherent reads; A53 frames; A54 `AwaitingClose`).
- **`plan/D07-prefactor-calculation-results.md`:** section 1.2's P68 (the Instrument module) and section 1.3 (the reason unions).
- **`plan/D05R2-review-card-progress.md`:** only the T5R2.1 and T5R2.3 text and decision 69's note, for T7SP.13's tech debt item 4.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r73 and the next decision is 103. Editing the breakdown's Progress section alone is not a revision (decision 100).

## 3. Prefactor specifics

- **Setup before T7SP.1:** create `evidence/D07SP/` with `tdd-log.md` (with its note that rows are single-case runs; `tdd.sh` maps `T7SP.n` to this folder and refuses to run without it), `structural.md` and `provenance.md`. Briefs take `evidence/D07SP` as the evidence directory. `full-suite.sh` derives `e2e/d7sp` from it as the current deliverable's folder.
- **Order.** The Progress section's order, one task at a time: T7SP.1 to T7SP.15. Mark a row "In progress from `<commit>`" before its brief; that commit is the base for `browser-auto`.
- **What must not change.** Every existing query-count proof passes with its exact request lists (D2, D4, D5, D5R, D6, D7, and D7's Open-list proof), and every existing case keeps its expected values, except the four changes the breakdown lists in section 6.1 (`settlement.test.ts:236` flipped in T7SP.8, the fixture field in T7SP.10, and the removals in T7SP.12 and T7SP.13). A changed request list or expected value anywhere else is a defect to fix, never an expectation to update. If a fix can't keep the counts, that is a plan question (section 5).
- **No stored change.** No store, index, record or schema version changes, and no `dump.json` changes. **Never regenerate any fixture's dump.**
- **Expiration Payoff stays out of the valuation module** (ADR 0007): `payoffOf` stays in `src/coordinators/settlement.ts`; only `settlementTimeOf` moves.
- **Lint rules.** ESLint replaces a rule's options rather than merging them, so T7SP.9's new `no-restricted-syntax` entry for files under `src/` repeats `noIdentitySelector` and the domain-purity selectors already in `eslint.deps.config.js`. T7SP.9's brief also runs `npm run lint` and `npm run verify:wording`, which share ESLint's config resolution.
- **The benchmark (T7SP.14).** `BENCH_GENERATOR_VERSION` is 6 and the generated profile is cached in `.cache/bench/profile`, stamped with the generator version and schema version. T7SP.2's change to `bench-generator.ts:662` is behaviour-identical, so it **must not bump the version**; the cached profile stays valid and `bench:run` reuses it. Compare with `evidence/D07/bench.md`. Never run `bench:run` alongside a browser suite.
- **Browser folders.** `test:e2e:2` and `test:e2e:release-history` pass `e2e/d7` to Playwright as a regex, which already matches `e2e/d7sp`, so no script change is needed. T7SP.11's spec is not tagged `@release-history` (decision 76).
- **TDD discipline.** Run every `it should` case red, then green, one at a time, logged in `evidence/D07SP/tdd-log.md` (`tdd.sh` runs vitest only; log Playwright reds and greens by hand). Code written before its red is backed out and rerun to a genuine red. A first-run pass gets the mutation check (an assertion failure or runtime exception, never a compile error) and is listed under section 7's open questions. The breakdown names the cases it expects to pass today (T7SP.3's requirement halves, T7SP.4's second and third cases) with their mutation checks.
- **Clock pinning in tests.** Chromium has native Temporal and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`, so every pinned browser case uses `launchAt`/`pinClock`/`setClock` from `e2e/d4/support.ts`.
- **Browser mutation builds.** The browser suites measure `dist-faults`. A mutation of coordinator or UI code must rebuild that folder (`npm run build:faults`) before the run, and again after restoring.
- **ocr on test-only commits.** `ocr` excludes test files. Brief the `ocr-review` agent to recreate a test-only commit in a scratch clone (in its own scratch directory, never in the worktree) with the test files relocated under `src/itg/d07sp/` as plain `.ts`, copying the `support.ts` files alongside. Findings caused only by the relocation are dismissed as relocation artifacts. This covers T7SP.11, T7SP.12 and T7SP.13.
- **Tech debt triggers:** item 11 (the Open list's Ready-state race, `TradeList.test.tsx:125`) if that case fails a run; item 1 (a late Stale-context Mark at a Review save) if T7SP.8's session binding changes what a save rechecks. When a trigger fires, raise the item with the user; don't fix it unasked.
- **The gate (T7SP.15).** No browser critic (P86). Run the complete cumulative suites with `suite-runner` on the full tier (`browser-full`: `browser-1` then `browser-2`) until they pass, and record the runs. The prefactor has no acceptance rows, so `acceptance-commands.sh` has nothing to check. Then tag `claude-opus-5.5-d7sp`, and do the breakdown's section 5 follow-up: search `plan/D08-backup-and-restore.md` for `coordinators/valuation.ts`, `settlementTimeOf`, `instrumentsOf`, `afterExpiration`, `primaryFrameOf`, `evaluateCurrent`, `closedCurrent` and `currentFrames`, and record the result. A hit is a plan revision: ask before making it.

## 4. What is in place

Build on these rather than re-creating them. Read the code before extending it. [D07-handoff.md](D07-handoff.md), section 4, describes what D6 and the D7 prefactor left; all of it is still in place.

| Piece | Where | Notes for the prefactor |
|---|---|---|
| Shared valuation (today) | `src/coordinators/valuation.ts` (`observationFrame`, `datedLineOf`, `datedCloseOf`); `src/coordinators/settlement.ts` (`payoffOf`, `settlementTimeOf`, `SettlementItem`) | T7SP.6 absorbs `valuation.ts` and `settlementTimeOf` into `src/coordinators/valuation/`. |
| Trade Views valuation | `src/coordinators/trade-views/trade-views.ts`: `instrumentsOf` (459), `afterExpiration` (465), `primaryFrameOf` (471), `evaluateCurrent` (479), `closedCurrent` (636), `currentFrames` (703), the Open page (946–970), Detail (840–900) | T7SP.7 deletes the first six and routes both reads through the module. |
| Daily Review valuation | `src/coordinators/daily-review/daily-review.ts`: `reviewItem` (202), `figuresOf` (243), `settlementItems` (348), `assemble` (357), `framesOnly`, the save binding check (726) | T7SP.8 routes them through the module; `derive` without a valuation date stays for the integrity derivation (296, A192). |
| Market Data reads | `src/modules/market-data/market-data.ts`: `ResolveFrames` and `ResolveSession` (`query`), `frameEvidence` (526, the date-wide read), `frameResult` (540, digest and snapshot id), `staleContextOf` (350), `historicalGaps` (452), `recover` | T7SP.5 builds `openReadSession` on these, and proves each answer equal to `ResolveFrames`' or `recover`'s. |
| `derive` and `evaluate` | `src/domain/trade-analysis/derive.ts` (`observationRequirementsOf`, 651; the entry checks at 438 and 455), `evaluate.ts` (229, 427), `plan.ts` (187) | T7SP.2 to T7SP.4. |
| Instrument module | `src/domain/instrument/` (`Instrument`, `OptionInstrument`, `instrumentKey`, `instrumentOf`, `multiplierOf`, `validateOptionContract`) | T7SP.1 adds `expiredOn` and `settlementDueOn`. |
| Request counting | `tests/support/request-counter.ts` (`countRequests`); the proofs in `tests/integration/d2`, `d4`, `d5`, `d5r`, `d6` and `d7` (`query-count.test.ts`, `open-list-query-count.test.ts`) | T7SP.5's unit cases and T7SP.8's new proof count through it. |
| Option fixtures | `tests/integration/d7/support.ts` (`confirmOption`, `recordOption`, `saveMark`, `onboardedAt`, `XYZ_CALL`, the clock constants); `src/coordinators/daily-review/settlement.test.ts` (`settlementFixture`, `cardOf`) | T7SP.6 and T7SP.8 build on them. |
| Due classification | `src/domain/journal-debt/classify-due.test.ts`; the coordinator copies in `daily-review/reflections.test.ts` (95–128) and `trade-views/debt-status.test.ts` (31–90) | T7SP.13 (tech debt item 4). |
| Lint configs | `eslint.config.js`, `eslint.deps.config.js` (`noIdentitySelector`, domain purity), `eslint.wording.config.js` | T7SP.9 adds the expiration rule to `eslint.deps.config.js` (A194). |
| Fixtures | `tests/fixtures/workspace-v1/` to `workspace-v6/`; `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts` | T7SP.10 may change only v6's `expected-views.json`. |
| Benchmark | `src/app/bench.ts` (`BENCH_GENERATOR_VERSION` 6), `src/app/bench-generator.ts`, `tools/bench-run.ts`, `.cache/bench/profile`; D7's results in `evidence/D07/bench.md` | T7SP.14. |
| Suite runner | `.claude/agents/suite-runner.md`, `.claude/scripts/full-suite.sh` (`unit`, `integration`, `browser-1`, `browser-2`, `browser-task`, `browser-auto <base>`, `checks`) | Each stage is one foreground call. When `browser-auto` picks the full tier it runs nothing and tells the runner to run `browser-1` and `browser-2` (decision 98). 14 checks. |

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks, and never push the tags `claude-opus-5.5-plan-r30` or `-plan-r32` to `-plan-r40`.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task` subagent. The agent definitions hold the working rules (Edit tool only, scratch directories, exit codes, browser runs and ports, rebuilding after a mutation, staging, the clean-tree check), so briefs don't repeat them.
- **Cumulative runs.** End every task with a complete cumulative run, delegated to `suite-runner` and recorded in `evidence/D07SP/structural.md`, with outputs in `evidence/D07SP/suite-runs/`. The browser stage is `browser-auto <base>`, where `<base>` is the commit in the task's Progress row; record the tier it chose and its printed reason. Tell the runner to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen. Subagents never run `npm run build:releases` on its own.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run. Only findings ocr itself raises become bug tasks (`implementing.md`): a Valid or Doubtful finding with a failure scenario becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time; a Wrong finding, or one with no failure scenario, is dismissed with its reason in `structural.md` and listed under section 7's open questions. Copy each `ocr.json` to `evidence/D07SP/ocr/<task>-<sha>.json`.
- **Background work.** An `ocr-review` alongside the next task is fine. Never run two browser suites at once (they share port 5175), and never run `bench:run` alongside a browser suite.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own. Check every user proposal against the spec; if one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- **After each finished task:** commit it, record its cumulative run, mark its Progress row "Done" with its commits, update section 7 of this note, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete the prefactor from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including a breakdown passage the built code can't meet as written, or a query-count proof that can't keep its request list (section 3);
3. a suite failure can't be fixed by a fresh subagent without such a deviation;
4. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings;
5. T7SP.14 measures a step more than 10% slower than `evidence/D07/bench.md` (O3);
6. T7SP.15's follow-up finds a stale reference in D8's breakdown (a plan revision).

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, such as the read session's and the module's final names (the breakdown's are indicative), and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **First-run passes:** log them with their mutation check and list them under section 7's open questions. They don't stop the session.
- **Context growth:** compaction is automatic. The breakdown's Progress section and section 7, updated after every task, are the recovery point.

When the gate passes, tag `claude-opus-5.5-d7sp` locally and do the D8 follow-up. Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the latency harness's comparison with D7;
- the D8 follow-up's result.

Never push.

## 6. Out of scope

- Any deliverable other than the D7S prefactor, unless the user says otherwise. In particular, **D7S's breakdown** is drafted in a later session, from `claude-opus-5.5-d7sp`; its numbering starts at P90, A195 and decision 103.
- **Candidate 2 of the architecture review** (Trade Detail as a finished read: held quantity, R division and the expiration line decided in `TradeDetail.tsx`), and candidates 3 to 5 (quantity words, Terminal Disposition words, the terminal Position Change's owner). The user kept them out of this prefactor.
- **The Pricing Provider** behind the read session (D11). The session serves `recover`'s gaps but no provider fetch is built.
- **`previewMarkChange` and `replayTrade`** (A190), which D11 and D9 build on the module.
- **Upgrade tests** (decision 76; tech debt item 10).
- **The other tech-debt items** at the end of `plan/implementation-plan.md`: they stay as recorded (raise 1 or 11 when section 3's triggers fire). Item 4 is this prefactor's T7SP.13.
- Editing `specs/`, or editing the frozen plan without an approved revision.

## 7. Prefactor progress

Task status and commits are in the breakdown's Progress section (decision 100). This section holds two lists, one bullet per entry.

### Notes for later tasks

- **T7SP.4:** `evaluate`'s date check applies to a state that carries a valuation date. Until T7SP.7, Trade Views derives without one (`trade-views.ts:840`, `:946`) and `closedCurrent` passes a frame dated at the terminal date, so a check on every state would break D7's Trade Views cases.
- **T7SP.5:** the oracle is equality with `ResolveFrames` and `recover` for the same context and Instruments, inside the same test (A193). `settlementTimeOf`'s calendar-only answer (decision 99, `src/coordinators/settlement.ts`) is the model for the session's settlement time.
- **T7SP.6:** `payoffOf` stays in `src/coordinators/settlement.ts` (ADR 0007). Check that `lint:deps` allows the new `src/coordinators/valuation/` folder to import `src/modules/market-data` and `src/domain/trade-analysis` as `valuation.ts` does today.
- **T7SP.7:** `d7/query-count` and `d7/open-list-query-count` must pass with their exact request lists unchanged; a changed list is a defect, not an expectation (section 3).
- **T7SP.8:** in the same commit as the first case's green, flip `src/coordinators/daily-review/settlement.test.ts:236` ("T7.24 known defect") to expect ABC's put dated line at Thursday's close, recording the old and new expectation. The D4, D5 and D6 Review query-count proofs (stock Trades) must not change; the new proof goes in `tests/integration/d7sp/review-query-count.test.ts`.
- **T7SP.9:** start from the throwaway rule in the breakdown's section 1.5, and keep `noIdentitySelector` and the domain-purity selectors in the same `no-restricted-syntax` entry (section 3).
- **T7SP.13:** item 4 says each suite keeps one case per classification plus decision 56's no-frame case in Trade Views. Check `reflections.test.ts:96` (an anchor with a New York offset) against `classify-due.test.ts` before removing it; if no domain case covers an offset, move it there.

### Open questions

None yet.
