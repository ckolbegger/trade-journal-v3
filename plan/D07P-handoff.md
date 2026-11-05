# Handoff: `claude-opus-5.5`, implement the D7 prefactor

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, the prefactor's specifics, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-04, after the user approved the prefactor's design and breakdown. The prefactor is not one of the numbered deliverables. Plan revision 42 (decision 77) inserted it between D6 and D7. It resolves tech debt item 5, which D7's opening note (decision 69) asked to raise before D7.

This session **implements the D7 prefactor, "one Calculation Result throughout"**, under the frozen plan at revision 42. The breakdown is [D07-prefactor-calculation-results.md](D07-prefactor-calculation-results.md). The user approved all of it on 2026-11-04: P63–P76 and A181–A188.

The prefactor changes the domain's result types, Daily Review's shapes, and the UI's wording. **No stored, exported or backed-up shape changes** (A182).
1. **One value** (P63–P65): `src/domain/calculation-result/` owns `CalculationResult<T, U, N>` and the two reason unions, each case a reason with its own details.
2. **Instruments** (P68): `src/domain/instrument/` owns the tagged `Instrument`, `instrumentKey` and `instrumentOf`. The Stock variant only; D7 adds the option.
3. **Self-describing findings** (P69): each finding for facts that can't be replayed carries its fact's kind, Instrument, Economic Time, side and quantities.
4. **Daily Review** (P66, P67): risk and reward, pressure and range position become Calculation Results; the reasons pass through unchanged, and ranking keeps its meaning.
5. **One wording module** (P70–P72): `src/ui/calculation-words.ts`, at three lengths, in parts, with the texts in the breakdown's section 1.4. `verify:wording` (P74) keeps it the only one.
6. **Browser tests** (section 6): the listed expectations follow the approved texts, and a new layout spec runs at 320 and 375 px.

Where things stand:
- **D6:** complete and tagged `claude-opus-5.5-d6` (`e10d55a`), and pushed.
- **Code:** unchanged since the last complete cumulative run, `d6-final` at `e10d55a`, which passed 1188 unit, 154 integration and 163 browser tests and 12 of 12 checks (`evidence/D06/structural.md`). Since then only plan, evidence and handoff documents have changed (revisions 41 and 42, and D6's acceptance rows).
- **D7:** not started. Its breakdown's opening note (decision 77) says this prefactor runs first, and that D7 starts from the tag this session creates at its end. D7's handoff is written afterwards, with the spec-map rebase (breakdown, section 5).

**Starting a session.** The user starts a session with one prompt: *"Read plan/D07P-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next step in section 7 at once**, without stopping to report that the reading is done.

Continue task by task through T7P.12 and the gate in section 5. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r42` (revision 42) |
| D6 release | tag `claude-opus-5.5-d6` (`e10d55a`) |
| Prefactor starting point | tag `claude-opus-5.5-pre-d7p` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`. N counts the commits since `ad870c91` (revision 41), the last pushed commit: 2 at the first session, growing with each prefactor commit. No uncommitted changes, except the untracked `.claude/settings.json`: it is the user's own file, expected, and **never staged**. |
| `git log --oneline claude-opus-5.5-pre-d7p..HEAD` | Empty at the first session. Afterwards, only prefactor task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r42`, `claude-opus-5.5-d6` and `claude-opus-5.5-pre-d7p`. |
| `git rev-parse 'claude-opus-5.5-d6^{commit}'` | `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b` |
| `git diff claude-opus-5.5-d6 -- src e2e tests tools` | Empty at the first session. Afterwards, only the prefactor's task commits. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 94 files and 1188 tests (unit), and 76 files and 154 integration tests. The browser suite (`npm run test:e2e`, D1 to D6) had 163 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D07P/provenance.md`.

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
- `guard-shell-writes.sh` refuses `sed -i`, `perl -i`, redirects, here-docs and `tee` into any tracked path outside `evidence/`, and inline node or python that writes files.

The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates:
- the scoped reading below;
- delegating each task to the `tdd-task` subagent, and writing its brief;
- the `ocr-review` run, and bug tasks, after each task;
- recording `suite-runner` runs, and choosing the browser tier.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what the work uses, as decision 45 directs.

**The `specs/` baseline (scoped, A181).** The prefactor has no generated reading list; read these sections, found through `plan/spec-map.md` by their IDs:
- `specs/glossary.md`, "Market observations and valuation" (S251): the entries Calculation Result, Expected-Mark Status and Unavailable Mark Acknowledgment.
- ADR 0007, observed valuation and expiration payoff (S085).
- `specs/design/trade-analysis.md`: "Shared values" (S164), and the `derive` (S166) and `evaluate` (S167) contracts.
- `specs/design/daily-review.md`: "Date, eligibility, and ordering" (S090), `open` (S091), and "Completion and resumption" (S096).
- `specs/design/trade-views-and-reporting.md`: `browseTrades` (S188) and `getTradeDetail` (S189).
- `specs/design/ui-contract.md`: "Trade and Journal presentation" (S211) and "Numbers, availability, and graphs" (S212).
- `specs/design/overview.md`: "Shared value and result conventions", "Calculation availability" (S137).
- The acceptance rows the breakdown's section 7 re-proves: AC-CALC-002 (S051), AC-LIFE-003 (S016), AC-REV-002 (S039), AC-REV-006 (S043), AC-UI-001 (S074), AC-UI-002 (S075) and AC-RESP-001 (S011). Look each up in `plan/acceptance-matrix.md` too.

Search `plan/spec-map.md` for anything else the work touches, and read that section before building on it. Note any such section in `evidence/D07P/structural.md`.

**The frozen plan (scoped):**
- **`plan/implementation-plan.md`:**
  - decisions 54 (figures outside session-policy coverage), 69 (D7's opening note), 71 (the browser tiers), 76 (upgrade tests deferred) and 77 (this prefactor);
  - the freeze record;
  - the D7 prefactor's definition;
  - tech debt item 5 (resolved by this prefactor) and item 10.
- **`plan/D07-prefactor-calculation-results.md`:** in full. This is the work.
- **`plan/D07-single-leg-options-happy-path.md`:** the opening note and A99, with decision 77's amendment notes. These are what D7 inherits from the prefactor (A188).
- **`plan/D02-ui-alignment.md`** and **`plan/D04-daily-review.md`:** decision 77's amendment notes (the breakdown's section 8 lists them).

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r43 and the next decision is 78. (Revision 43, decision 78, was made on 2026-11-04 before T7P.1: the derived-view snapshots `expected-views.json` change shape only, with every `dump.json` unchanged. The next revision is now r44 and the next decision 79.)

## 3. Prefactor specifics

- **Setup before T7P.1:** create `evidence/D07P/` with:
  - `tdd-log.md`, with its note that rows are single-case runs (`tdd.sh` refuses to run without it, and maps `T7P.n` to this folder);
  - `structural.md`;
  - `provenance.md`.
  The `suite-runner`, `ocr-review` and `tdd-task` briefs take `evidence/D07P` as the evidence directory.
- **Order.** T7P.1 through T7P.12, one at a time, in an order the task graph (breakdown, section 2) allows: T7P.1, T7P.2, T7P.3, T7P.4, T7P.5, T7P.6, T7P.7, T7P.8, T7P.9, T7P.10, T7P.11, T7P.12. Behavioural tasks (T7P.2, T7P.3, T7P.5 to T7P.8) follow the cases in section 3 by red/green TDD. Structural tasks (T7P.1, T7P.4, T7P.9 to T7P.11) give section 4's "Verification (exact)" as the pass condition. T7P.12 is the gate run, by `suite-runner`.
- **Task notes the briefs must carry:**
  - **T7P.1 and T7P.4:** cases that assert a reason's shape change only the shape, in the task that changes its producer, and keep every expected value (A185, section 6.1). The report lists each changed case with the old and new shape.
  - **T7P.5:** its first case is the session-policy probe (P73). Record in `structural.md` whether `SessionPolicyNotCovered` reaches a walked Trade's pressure, range position or attention reason, and so whether the case is a regression test of a live defect or of a latent one.
  - **T7P.6:** the compile-time check (section 3) is a scratch commit that adds a dummy case to `UnavailableReason`; `npm run typecheck` must fail at the module's switch and at no catch-all. Record the error lines in `structural.md`, then drop the commit.
  - **T7P.9:** the planted violation is a scratch commit, then dropped (section 4). `full-suite.sh`'s checks stage runs `verify:wording`, so its count goes from 12 to 13.
  - **T7P.10:** confirm each fixture's kind (incoherent, or with findings only) before changing a line, and record it. Only the cases in section 6.2 change.
  - **T7P.11:** the layout spec lives in `e2e/d7p/`. `npm run test:e2e` and `test:e2e:release-history` name their folders explicitly (`package.json:33-34`), so T7P.11 adds `e2e/d7p` to both, as D6's T6.27 added `e2e/d6`; otherwise the full tier misses the spec. The incoherent Trade is written into stored records before launch (A187).
- **Code pointers.** Give each brief these pointers rather than having the subagent search. Line numbers are as of `claude-opus-5.5-pre-d7p`.
  - **Trade Analysis:** `src/domain/trade-analysis/derive.ts`: `CalculationResult` at 139; `netCost`'s `NoOpenQuantity` at 358 and its producer at 430; `IncoherentFact` at 370; `incoherence` at 384; `positionPathFindings` at 404, called at 865. `src/domain/trade-analysis/evaluate.ts`: `noRemainingPosition` at 159; the Unavailable reasons and their `detail` at 197-206.
  - **Daily Review:** `src/coordinators/daily-review/types.ts`: `AttentionReason` at 24, `PressureBasis` at 36, `RangePosition` at 56, the item's `reasons`, `basis` and `rangePosition` at 71-73, `IncompleteReason` at 161. `src/coordinators/daily-review/attention.ts`: `RiskReward` at 31, `riskRewardOf` at 35, `pressureOf` at 66, `rangePositionOf` at 81, `attentionOf` at 93. `src/coordinators/daily-review/daily-review.ts:72-73,416,430`.
  - **Trade Views:** `src/coordinators/trade-views/trade-views.ts`: `IncoherentFactFinding` at 341, and the Detail's findings at 309 and 427.
  - **UI wording today:** `src/ui/figures.ts:14-45`; `src/ui/screens/StopTargetSlider.tsx:19`; `review-attention.ts:16`; `ReviewView.tsx:60,98`; `ReviewCard.tsx:32-34`; `TradeList.tsx:238-268`; `TradeDetail.tsx:278,781-840,925-935`; `PositionChangeReceipt.tsx:59`.
  - **Fixtures:** `writeIntegrityFixture` at `e2e/d2/support.ts:271`, used by `e2e/d2/integrity.spec.ts`; `cardFixture` at `tests/support/review-fixture.ts:200`.
  - **Checks:** `package.json` scripts `typecheck`, `lint:deps` and the `verify:*` scripts (lines 13-37); `.claude/scripts/full-suite.sh`'s checks stage.
- **Mutation checks on browser cases.** The browser suites measure `dist-faults`. A mutation of UI code or CSS must rebuild that folder (`npm run build:faults`) before the run, and again after restoring; a plain `vite build` leaves the served build unchanged, so the mutation would "pass" (D5's T5.24-B1).
- **ocr on test-only commits.** `ocr` excludes test files, so a commit that only changes tests (T7P.10, T7P.11) reviews almost nothing in place. Brief the `ocr-review` agent to recreate the commit in a scratch clone (in its own scratch directory, never in the worktree), with the test files relocated under `src/itg/d07p/` as plain `.ts`, and the `support.ts` files copied alongside in the parent commit. Findings caused only by the relocation are dismissed as relocation artifacts. A commit that changes `package.json` or `full-suite.sh` is reviewed in place. Every `ocr-review` brief names the task's breakdown section as background.

## 4. What is in place

- **Domain:** `src/domain/trade-analysis/` (`derive`, `evaluate`, the current `CalculationResult`), `src/domain/session-policy/`, `src/domain/values/`. No `calculation-result/` or `instrument/` module yet.
- **Coordinators:** `src/coordinators/daily-review/` and `src/coordinators/trade-views/`, whose results are derived on every read (A182).
- **Browser suites:** `e2e/d1`, `d2`, `d4`, `d5`, `d5r` and `d6`, with the card helpers in `e2e/d4/support.ts` (decisions 65 and 68). `e2e/smoke/` is RC's engine probe, outside `test:e2e`. The 5 `@every-task` tests and the 4 `@release-history` tests (decision 76: no gate runs the latter; D7's T7.25 adds B6.6).
- **Node suites:** `src` (unit) and `tests/integration/d1` to `d6`.
- **The suite runner:** `.claude/agents/suite-runner.md` and `.claude/scripts/full-suite.sh`, with stages `unit`, `integration`, `browser`, `browser-auto <base>` and `checks`. Each stage is one foreground call; the runner never backgrounds a stage or polls for it.

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks, and never push the tags `claude-opus-5.5-plan-r30` or `-plan-r32` to `-plan-r40`.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every change under `src/`, `e2e/`, `tests/`, `tools/`, `package.json` and `.claude/scripts/` goes to a fresh `tdd-task` subagent.
- **Edit tool only.** Briefs tell subagents to use the Edit tool only, never `sed -i`, here-docs, `printf >>`, `cat >>`, or node or python edit scripts. This includes temporary mutations. `guard-shell-writes.sh` refuses most of these, but it reads command text only, so check each report and record any slip.
- **TDD.** Never code ahead of red. A genuine first-run pass needs a mutation check that fails by an assertion or a runtime exception (not a compile error), and is flagged in section 7's open questions.
- **Exit codes.** Briefs ask subagents to capture exit codes one command at a time. In zsh, a loop over a quoted command list fails with exit 127 for every command.
- **Cumulative runs.** End every task with a complete cumulative run, delegated to `suite-runner` and recorded in `evidence/D07P/structural.md`, with outputs in `evidence/D07P/suite-runs/`.
  - **Tier:** the browser stage is `browser-auto <base>`, where `<base>` is the commit the task started from, recorded in section 7 before the task's brief. It chooses from the files the task changed (domain and coordinator tasks likely get the task tier, UI and browser tasks the full tier); record the tier it chose and its printed reason. T7P.12 is always the full tier.
  - **Scope:** unit, integration and browser suites, plus the static and verify checks (12, then 13 from T7P.9), as four foreground stages.
  - **Brief:** tell the runner to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen. Subagents never run `npm run build:releases` on its own.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run (section 3 for test-only commits). **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says.
  - **Valid or Doubtful finding with a failure scenario:** it becomes `<task>-B<n>`, fixed in a fresh `tdd-task` subagent and reviewed again, one at a time.
  - **Wrong finding, or one with no failure scenario:** dismissed, with its reason in `structural.md`.
  - **Raw output:** copy each `ocr.json` to `evidence/D07P/ocr/<task>-<sha>.json`.
- **Background work.** An `ocr-review` alongside the next task is fine. Never run two browser suites at once: they share port 5175.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own.
- **After each finished task:** commit it, record its cumulative run, update section 7 of this note, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete the prefactor from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity;
3. a task would change a stored, exported or backed-up shape (A182), or `git diff claude-opus-5.5-pre-d7p -- src/persistence` is not empty;
4. a browser expectation would change that section 6.2 doesn't list, or a unit or integration case would change an expected value rather than only a shape (A185);
5. a suite failure can't be fixed by a fresh subagent without such a deviation;
6. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent, and rerun the suite. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **ocr findings:** handle them as the working rules describe.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

**When T7P.12 passes** (P75: no critic):
1. Check the rest of the gate (breakdown, section 5): `npm run verify:fixtures` passes unchanged, and `git diff claude-opus-5.5-pre-d7p -- src/persistence` is empty. Record both.
2. Update section 7, commit, and create the local tag `claude-opus-5.5-d7p` on that commit. D7 starts from it.
3. Stop with a final report:
   - tasks and commits;
   - every flagged item, and P73's finding (live or latent);
   - decisions made along the way;
   - the counts before and after: unit, integration, browser and checks.

Never push. **Do not start the spec-map rebase or D7's handoff**: the breakdown's section 5 makes them the main session's next step, at the user's direction, after this report.

## 6. Out of scope

- **D7:** none of its tasks. No Option Instrument, OCC key or `SettlementDue` case (A188: D7 adds them).
- **The spec-map rebase** and the regenerated reading lists (breakdown, section 5).
- **Index options** (the group "Raised by the D7 prefactor, for later breakdowns", for D20).
- **A browser critic** (P75).
- **Wording beyond section 1.4**, and texts that aren't a Calculation Result's reason or finding.
- **Upgrade tests** (decision 76; tech debt item 10).
- **Other tech debt items**, and the critics' earlier minor observations.
- **Plan edits:** editing `specs/`, or editing the frozen plan without an approved revision.

## 7. Prefactor progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | setup; T7P.1 (`536616d6`, cumulative run passed; its ocr review was rerun after the user signed in again, alongside T7P.2) |
| Next step | T7P.2, base `7e13d28b` (T7P.1's evidence commit; the progress commit after it is plan-only); record T7P.1's ocr review when it returns. |
| Last commit | `docs(plan): D7P handoff progress, T7P.2 base` (local; nothing pushed since `ad870c91`) |
| Decisions made | Decision 78 (revision 43, the user's choice, 2026-11-04): `verify:fixtures` compares derived views with `expected-views.json`, so those snapshots change shape only (values kept) in T7P.1, T7P.4 and T7P.5; every `dump.json` stays byte-identical. |
| Open questions | none yet |
