# Handoff: `claude-opus-5.5`, implement D2

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D2 specifics, what D1 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-19, after D1 completed. [D01-handoff.md](D01-handoff.md) is the record of D1's session; this note is the starting point for D2.

This session **implements D2, "Open a Long Stock position"**, under the frozen plan at revision 5. D1 is complete:
- Its gate passed (critic-2).
- Every D1 acceptance row is marked covered.
- It is tagged `claude-opus-5.5-d1` and pushed.

D2's task breakdown is approved and part of the frozen plan. T2.1 was the first task; section 7 names the next one.

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local` |
| Frozen plan | tag `claude-opus-5.5-plan-r5` (revision 5) |
| D1 release | tag `claude-opus-5.5-d1` |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, either in sync or ahead only by the commits in the next row. The only untracked file is `handoff-claude-opus-5.5-2026-10-11.md`. |
| `git log --oneline claude-opus-5.5-d1..HEAD` | the commit that added this note (`docs(plan): add the D2 handoff`), the revision 5 commit (tagged `claude-opus-5.5-plan-r5`), its follow-up that updated this note, and then only D2 task commits and their evidence and handoff updates (plus the tooling commit that added `.claude/scripts/tdd.sh`, after T2.1), ending with the commit section 7 names as the last commit |
| `git tag --list 'claude-opus-5.5-*'` | includes `claude-opus-5.5-plan-r5` and `claude-opus-5.5-d1` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run` | every test file and test passes; after T2.1, `Test Files 31 passed (31)`, `Tests 237 passed (237)` (218 unit and 19 integration) |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D02/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading below, delegating each task to the `tdd-task` subagent, writing briefs, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D2 uses, as decision 45 and the kickoff's plan-specific conditions direct.

**The `specs/` baseline (scoped):** read [plan/spec-reading/D02.md](spec-reading/D02.md), then read exactly the files and line ranges it lists, each range in full. It covers every core section of the [spec map](spec-map.md) plus every section tagged for D2. Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, then read that section in the spec before building on it. If the missing section should have been tagged for D2, correct the map, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`, and note the correction in `evidence/D02/structural.md`.

**The frozen plan (scoped):**
- `plan/implementation-plan.md`: everything except the `## D3` through `## D28` definition sections. That leaves the recorded decisions 1–45, the rules and cumulative obligations, the freeze record, the D1 and D2 definitions (D2's is the work), and the closing sections: parallelism, coverage index, and review queue. Section 3 of this note lists the amendments later breakdowns made to D2.
- `plan/technology-stack.md` in full, including "Pinned versions".
- `plan/acceptance-matrix.md`: only the opening sections, through "Evidence methods common to every row". D2's rows are in full in section 8 of the D2 breakdown. Look up any other row by its scenario ID only when you need it, for example to update a status.
- `plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`: only sections 1 (decisions, assumptions, and the storage layout A10), 2 (implementation boundaries), 3 (task graph and task identities), 5 (structural tasks), and 6 (test substitutes and harnesses). Skip its behavioral tasks, critic flows, acceptance rows, clause check, and evidence sections. D1 is built, so the code, together with section 4 of this handoff, shows what it left in place.
- **`plan/D02-open-a-long-stock-position.md` in full**, which is the work.

You may read D4–D8's breakdowns for context, since several of them amend D2 (see section 3). Read only the parts that touch D2.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`; the next one is r6. Updating an acceptance row's status from `planned` to `covered` once evidence exists is not a revision, but ask the user before doing it, as was done for D1.

## 3. D2 specifics

- **Order.** Follow D2's task graph (section 3 of its breakdown). Fix `PositionChangeCommand`/`Result` and the Open read model in T2.11's type module early. That's what lets the three tracks the breakdown names proceed in parallel: Trade Analysis, persistence and migration, and UI.
- **This is the first schema change** (schema 1 → 2). It brings the first migration engine (A30): a candidate database, the pointer flip, cleanup, the `tj-lifecycle` Web Lock (an in-process lock port in Node, disclosed), and Migration Blocked. D1 already built the `versionchange` handling D2 relies on (T1.7, T1.20).
- **Amendments later breakdowns made to D2.** These are part of the frozen D2 and must be built now:
  - **D8 (P31, A139):** migration's per-record transforms read only authoritative fields. Every private field and store comes only from the private rebuild after the whole chain, because backup artifacts omit private fields and Restore reuses the same transforms.
  - **D8 (A140):** T2.9's `validateSection(snapshot)` takes a batched record source and keeps only identity sets between batches, so validation runs in bounded memory. Its cases are unchanged.
  - **D5 (section 1.2):** T2.5's "reject Defer with DispositionNotAllowed" case is still built in D2. D5's T5.2 changes it later; nothing changes now.
- **Do not build D4+ behavior early:** no Marks, valuation or current risk, exits or closing, Defer or Journal Debt, Daily Review, options, or backup. The same list is what D2's critic must not treat as defects.
- **The previous release (A34, T2.17)** is exported from the tag `claude-opus-5.5-d1` with `git archive` into a scratch directory and built there. Never create a worktree for it.
- **Benchmarks start here (AC-PERF-001, T2.20, T2.21).** They need a deterministic generator, a bench build, 30 cold starts and 30 warm tab switches, and nearest-rank p95 thresholds of 2,500 ms cold and 1,500 ms warm. Results go in `evidence/D02/bench.md`.
- **TDD discipline.** Run every `it should` case red, then green, one at a time. Record the commands and outcomes in `evidence/D02/tdd-log.md`. A test that passes on its first run, or code written before its red, must be fixed and rerun to a genuine red, never logged and skipped. If no genuine red exists, flag it for the user rather than fabricate one (D1's T1.17 case 2 is the precedent). Structural tasks record their exact verification in `evidence/D02/structural.md`. Engine and OS versions go in `evidence/D02/provenance.md`.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. Evidence from all three engines belongs in RC.
- **The browser-critic gate (T2.24).**
  1. Run the complete cumulative unit, integration and browser suites with the `suite-runner` subagent until they pass, and record the run.
  2. Spawn a **fresh** critic agent. The frozen plan authorizes this spawn.
  3. Give it D2's section 7 inputs and the future-capability list.
  4. It starts the app itself, drives the production UI in a browser, runs C2.1 onward, and never edits code.
  5. Reproduce every defect it finds with a failing test first, then fix it, rerun the suites, and spawn another fresh critic.
  6. Save each report as `evidence/D02/critic-<n>.md`.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes,** commit and create the local tag `claude-opus-5.5-d2` on that commit. D4's harness builds the previous release from it (D4 A50). Don't push the tag unless the user asks.

## 4. What D1 left in place

Build on these rather than re-creating them. Read the code before extending it.

| Piece | Where | Notes for D2 |
|---|---|---|
| Application facade | `src/app/compose.ts` (`createApplication`), `src/app/types.ts` | The UI imports facade types only through `src/app/types.ts`. `lint:deps` forbids UI → modules, and coordinators → app. Tests count as UI code here. |
| Persistence | `src/persistence/` (`schema.ts`, `persistence.ts`, `rebuild.ts`) | `SCHEMA_VERSION` and `WORKSPACE_VERSION` are 1. `upgradeWorkspace` with `createWorkspaceIndexes` is the migration path. `rebuildPrivateState` recreates indexes. `Persistence.close()` exists for restarts. Reads strip the persistence write stamp `revision` (the Catalog had to be fixed for that). |
| Readiness and host port | `src/delivery/` | `HostPort` is the single fault boundary. `CAPACITY_REQUIREMENT` comes from `capacity-basis.json`. |
| Faults build | `src/delivery/faults.ts`, imported only when `import.meta.env.MODE === 'faults'` | `?faults=` and `window.__tjFaults.set` cover the four readiness checks. T2.16 adds the migration stages and `__tjFaults.release()`. `verify:no-fault-hooks` checks the marker and `__tjFaults`. |
| Release harness | `tools/build-releases.ts`, `tools/release-server.ts` (`startReleaseServer({ root, release })`, `use(folder)`) | It serves any built folder under a root. The browser fixture serves `dist-faults` with the project as root, and switches to `dist-releases/<name>`. T2.17 adds `d1` (from the tag) and `d2`. |
| Capacity | `tools/capacity/profile.ts` (`ALLOWANCES`, `project`), `tools/measure-capacity.ts`, `tools/verify-capacity.ts` | T2.18 replaces the Position Change, Execution and Position Change Reflection allowances with measured bytes and bumps the basis to schema 2. `verify:capacity` fails while the basis names schema 1. |
| Fixtures | `tools/fixtures/workspace-fixture.ts`, `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts`, `tests/fixtures/workspace-v1/` | The v1 dump records its own structure, so a later release rebuilds a true v1 database. **Never regenerate v1.** `verify:fixtures` currently requires Ready; T2.19 extends it so the v1 dump migrates. |
| Node integration | `tests/integration/d1/` with `support.ts`; `tests/support/` (`NodeTestHost`, `stack.ts`, `dumpAll`) | Vitest has `unit` and `integration` projects. `npm run test:integration -- d2/<name>` selects files; `npx vitest run` runs both. |
| Browser suite | `e2e/d1/` with `support.ts` (server and profile fixtures, read-only `probe`, UI steps); `npm run test:e2e` | `test:e2e` runs `e2e/d1` only: extend it to `e2e/d1 e2e/d2`, since D2's gate needs both. |

Browser-test lessons from D1, all already handled in `e2e/d1/support.ts` and worth knowing:
- Profiles launch with `channel: 'chromium'`.
- A browser spawned with default features (B1.3's kill test) uses a different IndexedDB backend (SQLite) from Playwright-launched ones (LevelDB). Relaunch a killed profile with the same spawn.
- Playwright's offline emulation doesn't cover service-worker fetches. Offline cases also stop the server.
- A form control's focus ring needs `:focus-within` for date-time inputs.

TDD logging helper: `.claude/scripts/tdd.sh`, committed. The `tdd-task` agent (`.claude/agents/tdd-task.md`) says how to use it. `evidence/D02/tdd-log.md` already exists.

## 5. Working rules

- Commit each finished task locally, with the co-author line. **Never push** unless the user asks.
- End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent (it writes the full outputs to `evidence/D02/suite-runs/` and returns the table), and recorded in `evidence/D02/structural.md`. The run covers unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*`. The TDD log's single-case rows do not prove the suites pass.
- Refer to document sections in words, never with the "§" sign.
- Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose.
- Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- Don't plan far ahead of working code (decision 40).
- The user ends sessions when the context grows large. After each finished task, commit it, then update section 7 of this note with where D2 stands.

## 6. Out of scope

- Any deliverable other than D2, unless the user says otherwise.
- D1's optional polish from critic-2, unless the user asks:
  - only the first blank onboarding error shows at first;
  - a stale first-run tab ignores "Start my journal";
  - read-only `/plans/new` and unknown routes render an empty page;
  - focus lands on the page body after navigation;
  - About's "Offline assets" alignment;
  - the issue-summary order.
- D4's P14, the boundary between the "quantified pressure" and "routine" attention bands (decision 41). It must be settled before D4's first task, but not now.
- Breakdowns for D9–D28 and RC. D9's numbering will start at P36, A150 and decision 46.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D2 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | T2.1 (`335e62d`), cumulative run green. T2.2 (`c8c798b`), cumulative run green apart from one flaky D1 browser case, B1.14, which passed on rerun; a full cumulative rerun on `ecc2294` was fully green (`evidence/D02/structural.md`). |
| Next task | T2.3, Trade Analysis: Entry Size excess, agreement findings, reconciliation. T2.2 added to `DerivedTradeState`: `entryResolution` (`Unresolved` or `Resolved` with `positionChangeId`), `entryQuality` (`CalculationResult<EntryQualityFigures, 'EntryNotResolved'>`; each figure is its own `CalculationResult<Rational>`, the actual ratio carries `EntryFlag` reasons, plus `flags`), and `legFulfillment`. `CalculationResult` has only `Value` and `NotApplicable` (no details yet). `FilledWithDeviation` is currently "entered above planned quantity"; T2.3 should base it on an active Entry Size occurrence (A25). Entry Quality reads the Plan's single Stop and Target (`stops[0]`, `targets[0]`, D1 A1). `derive` still returns `DerivationResult`; the D1 call sites narrow it with an `incoherent` throw that T2.6 and T2.7 replace. Test fixture: `src/domain/trade-analysis/reference-trade.ts`; T2.2 cases in `entry.test.ts`. |
| Last commit | `docs(evidence): record the T2.2 cumulative run and update the D2 handoff` |
| Open questions | Settled 2026-10-20: T2.2's first-run pass ("include every Execution of the resolving Position Change in the window…") stays as a regression guard (`tdd-log.md`); B1.14's flaky substring check was fixed in `98e730b` (`evidence/D01/structural.md`). Settled 2026-10-19: T2.1's two first-run passes ("keep exact values for fractional inputs" and "report agreement Agrees when the supplied stored lifecycle equals the expected one") stay as regression guards (`tdd-log.md`). Carried from D1: `npm audit` reports 3 high findings in `sharp` via the pinned `wrangler@4.147.0` (deploy-only), and fixing them needs a pin change, so a plan revision. `engine-strict`'s refusal was never exercised. `sw.js` is outside the inventory by design (T1.3), so a worker-only change keeps the release identity. |
