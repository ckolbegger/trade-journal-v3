# Handoff: `claude-opus-5.5`, implement D4

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D4 specifics, what D2 left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-27, after D2 completed. [D02-handoff.md](D02-handoff.md) is the record of D2's session; this note is the starting point for D4.

This session **implements D4, "Daily Review, with Manual Marks and ongoing risk/reward"** (D3 was merged into it, decision 24), under the frozen plan at revision 12. D2 is complete:
- Its gate passed (critic-3), and so did the gates of its follow-up and UI-alignment batches (critic-4, critic-7, critic-9, critic-10).
- Every D2 acceptance row is marked covered.
- It is tagged `claude-opus-5.5-d2` on `de3fa27`, the last D2 commit (decision 50), and pushed.

Revision 9 settled D4's P14 (decision 49): attention pressure is the share of the planned range a Trade has travelled since entry, which also changed the spec's pressure definition with the user's approval. Nothing else blocks D4's first task.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D04-handoff.md and follow it."* Run the location checks in section 1, do the reading in section 2, and then **start the next task in section 7 at once**, without stopping to report that the reading is done. Continue task by task through the browser-critic gate and the `claude-opus-5.5-d4` tag, stopping only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local` |
| Frozen plan | tag `claude-opus-5.5-plan-r12` (revision 12; r10 before T4.4-B6, r11 before T4.4-B10) |
| D2 release | tag `claude-opus-5.5-d2` (`de3fa27`) |
| D4 starting point | tag `claude-opus-5.5-pre-d4` (the commit that added this note and revision 9) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, in sync or ahead only by D4 commits; no uncommitted changes |
| `git log --oneline claude-opus-5.5-pre-d4..HEAD` | empty at the first session; afterwards only D4 task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit |
| `git tag --list 'claude-opus-5.5-*'` | includes `claude-opus-5.5-plan-r10`, `claude-opus-5.5-d2` and `claude-opus-5.5-pre-d4` |
| `git rev-parse claude-opus-5.5-d2` | `de3fa276a2632b568296040fd56efd2825708a39` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run` | every test file and test passes; at `claude-opus-5.5-pre-d4`, `Test Files 64 passed (64)`, `Tests 523 passed (523)` (474 unit and 49 integration). The browser suite (`npm run test:e2e`) had 124 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D04/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading below, delegating each task to the `tdd-task` subagent, writing briefs, the `ocr-review` run and bug tasks after each task, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D4 uses, as decision 45 and the kickoff's plan-specific conditions direct.

**The `specs/` baseline (scoped):** read [plan/spec-reading/D04.md](spec-reading/D04.md), then read exactly the files and line ranges it lists, each range in full. It covers every core section of the [spec map](spec-map.md) plus every section tagged for D4. Don't read `plan/spec-map.md` in full. Search it when the work touches a section that isn't on the list, then read that section in the spec before building on it. If the missing section should have been tagged for D4, correct the map, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`, and note the correction in `evidence/D04/structural.md`. The attention passage in `specs/design/daily-review.md` ("Date, eligibility, and ordering") was rewritten by revision 9; read the current text, not a summary.

**The frozen plan (scoped):**
- `plan/implementation-plan.md`: everything except the `## D5` through `## D28` definition sections. That leaves the recorded decisions 1–50, the rules and cumulative obligations, the freeze record, the D1, D2 and D4 definitions (D4's is the work), and the closing sections: parallelism, coverage index, and review queue.
- `plan/technology-stack.md` in full, including "Pinned versions".
- `plan/acceptance-matrix.md`: only the opening sections, through "Evidence methods common to every row". D4's rows are in full in section 8 of the D4 breakdown. Look up any other row by its scenario ID only when you need it, for example to update a status.
- `plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`: only sections 1 (decisions, assumptions, the storage layout A10, and the mature dataset profile 1.3), 2, 3, 5 and 6.
- `plan/D02-open-a-long-stock-position.md`: only sections 1 (decisions and assumptions, including the schema-2 layout A28, the migration engine A30, the release harness A34, and the benchmark dataset 1.3), 2, 3, 5 and 6. Skip its behavioral tasks, critic flows, acceptance rows, clause check, evidence and follow-up sections.
- `plan/D02-ui-alignment.md`: only section 2a, "The Trade column and Net cost", whose D4 amendment T4.23 builds on (P&L after Net cost; P&L and the Mark and condition badges on the narrow second line).
- **`plan/D04-daily-review.md` in full**, which is the work.

You may read D5–D8's breakdowns for context, since several of them amend D4 (see section 3). Read only the parts that touch D4.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`; the next one is r13. Updating an acceptance row's status from `planned` to `covered` once evidence exists is not a revision, but ask the user before doing it, as was done for D1 and D2.

## 3. D4 specifics

- **Order.** Follow D4's task graph (section 3 of its breakdown). Fix the frame, evaluation, Review, Action and Open read models in T4.19's type module early; that is what lets the four tracks the breakdown names proceed in parallel: session policy and Market Data (T4.1–T4.7), Trade Analysis (T4.8–T4.10), persistence, Trade Record and Journal (T4.3, T4.11–T4.13, T4.17), and UI (T4.20–T4.25). Daily Review (T4.14–T4.16) and Trade Views (T4.18) join them. Run tasks one at a time.
- **Session-policy coverage (decision 51, revision 10).** Coverage is 2024-01-01 through 2028-12-31. T4.1 was built for 2000–2028 and must be restated: a fresh subagent restates its cases test-first per the D4 breakdown's revised T4.1 text, shrinks the table to 2024–2028, and moves any T4.1-B1 test date outside the new coverage (1999-12-31, 2000-01-03) to its 2024 equivalent. T4.2 then transcribes NYSE's calendars for 2024–2028 only; the earlier T4.2 attempt's source notes are in `evidence/D04/t4.2-first-attempt-source-notes.md` and, for 2024–2028, used nyse.com and ICE announcements.
- **P14 and attention pressure (decision 49).** Pressure is the losing share (risk consumed since entry ÷ risk at entry) or the winning share (reward consumed since entry ÷ reward at entry), the at-entry figures evaluated with each open Lot's open cost, without fees, in place of the Mark. Pressure above 0 is quantified pressure; 0 is routine. At equal pressure the losing Trade comes first, then Last Activity descending, then identity. The reason states the side and the share ("75% of the way from entry to the Stop"). T4.14's attention cases and the five-Trade fixture (T-A 91/291, T-E 1/10) were rewritten for it. The Zero case (Unbounded reward) is not reachable in D4, because every Long Stock Plan has a Target.
- **This is the second schema change** (schema 2 → 3), through D2's migration engine (A30): the `v2→v3` transform and the `v1→v2→v3` chain, candidate database, pointer flip, cleanup, the `tj-lifecycle` lock and Migration Blocked.
- **Amendments later breakdowns made to D4.** These are part of the frozen D4 and must be built now:
  - **D8 (P31, A139):** T4.3's `v2→v3` case "add exposureStart to each Trade document from its first opening Execution" moves to the private rebuild run after copying; per-record transforms read only authoritative fields (D8 section 1.2).
  - **D7 (P27):** a Mark may be exactly 0 for every Instrument (D4 A37, T4.13, I4.8, C4.12; already applied in the D4 text).
  - **Revision 8 (decision 48):** T4.23 places P&L after Net cost on wide and puts P&L and the "Stop breached", "Target reached" and "Mark missing" badges in the Trade cell, with P&L on the narrow second line. T4.18 adds nothing for the summary.
- **Do not build D5+ behavior early:** no deferred reflection or Journal Debt, exits or closing, options or Settlement Due, backup or Restore, Pricing Provider or Daily Bars, opening an exact past Review date, Stop Discipline Deviations, corrections of Executions, or management revisions. The same list (D4 section 7) is what D4's critic must not treat as defects.
- **The NYSE calendar (T4.2).** `verify:session-policy` compares the rules with a transcription of NYSE's published holiday, early-close and historical-closing calendars, each year with its source and retrieval date. Transcribing it needs web access (WebFetch or WebSearch). If neither is available, stop and ask the user for the calendars.
- **The previous release (A50, T4.27)** is exported from the tag `claude-opus-5.5-d2` (`de3fa27`, decision 50) with `git archive` into a scratch directory and built there. Never create a worktree for it.
- **Benchmarks (AC-PERF-001, T4.30, T4.31).** The generator simulates every session from 2024-01-02 (revision 10, decision 51) with Playwright's pinned clock (A52), adding about 189,000 Marks and 126,000 Actions; generation takes on the order of an hour and is cached per generator and schema version. Thresholds stay at a nearest-rank p95 of 2,500 ms cold and 1,500 ms warm. Results go in `evidence/D04/bench.md`. Run the generator in the background and continue with other tasks.
- **TDD discipline.** Run every `it should` case red, then green, one at a time. Record the commands and outcomes in `evidence/D04/tdd-log.md` (create it before the first task, with a note that its rows are single-case runs; `tdd.sh` refuses to run without it). Code written before its red is backed out and rerun to a genuine red. A case that passes on its first run because earlier work already built the behavior gets the mutation check in the `tdd-task` agent (an assertion failure or runtime exception, never a compile or type error) and is flagged for the user; never fabricate a red. Structural tasks record their exact verification in `evidence/D04/structural.md`. Engine and OS versions go in `evidence/D04/provenance.md`.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. `test:e2e` runs `e2e/d1 e2e/d2`; extend it to `e2e/d1 e2e/d2 e2e/d4`, since D4's gate needs all three. Evidence from all three engines belongs in RC.
- **The browser-critic gate (T4.34).**
  1. Run the complete cumulative unit, integration and browser suites with the `suite-runner` subagent until they pass, and record the run.
  2. Spawn a **fresh** critic agent, briefed from `.claude/docs/critic-brief.md`. The frozen plan authorizes this spawn.
  3. Give it D4's section 7 inputs and the future-capability list.
  4. It starts the app itself, drives the production UI in a browser, runs C4.1 onward, and never edits code.
  5. Delegate each defect it finds to a fresh subagent, which reproduces it with a failing test first and then fixes it; rerun the suites, and spawn another fresh critic.
  6. Save each report as `evidence/D04/critic-<n>.md`.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes,** commit and create the local tag `claude-opus-5.5-d4` on that commit. Later harnesses build the previous release from it. Don't push the tag unless the user asks.

## 4. What D2 left in place

Build on these rather than re-creating them. Read the code before extending it. `plan/D02-handoff.md`, section 7, records every D2 task's details if you need more.

| Piece | Where | Notes for D4 |
|---|---|---|
| Application facade | `src/app/compose.ts` (`createApplication`), `src/app/types.ts` | The UI imports facade types only through `src/app/types.ts`. `lint:deps` forbids UI → modules, and coordinators → app. Tests count as UI code here. |
| Persistence and migration | `src/persistence/` (`schema.ts`, `persistence.ts`, `rebuild.ts`, `migrations/` with `migrationChain(from)` and `v1-to-v2.ts`) | `SCHEMA_VERSION` is 2. Migration runs in a candidate database under the `LifecycleLock` (`tj-lifecycle`; in-process in Node), validates with each module's `validateSection(RecordSource)` (batched, identity sets only, D8 A140), applies repairs, rebuilds private state, and flips the root pointer. `PRIVATE_STORES` are rebuilt, never copied. Every Trade apply writes `meta {key:'tradeRecord'}`. |
| Trade Analysis | `src/domain/trade-analysis/` | `derive` replays in Fact Order and returns Entry Resolution, Entry Quality, Leg Fulfillment, deviation reconciliation and `netCost` (`C + F`, D4 A41). D4 adds `derive` at a cutoff and `evaluate`. |
| Trade Summary | `src/domain/trade-summary.ts` | `TradeSummary` and `plannedLongStockSummary` (T2.66-B1); re-exported from `trade-views.ts`. |
| Trade Views | `src/coordinators/trade-views/` | `browseTrades` (Open, Planned), `getTradeDetail` (Planned, Open, Incoherent forms), with `summary` and `netCost`. An incoherent Trade surfaces as `IncoherentOpenTradeItem` / `IncoherentPlannedTradeItem` / `IncoherentTradeDetail` instead of throwing. |
| Readiness, host port, faults build | `src/delivery/` (`faults.ts`, imported only in `faults` mode) | `?faults=` and `window.__tjFaults` cover the readiness checks and the migration stages (`migration:validate`, `migration:activate`, `migration:hold`, `__tjFaults.release()`). T4.26 adds the clock pin here. `verify:no-fault-hooks` searches `dist/`. |
| Release harness | `tools/build-releases.ts` (`RELEASES`, `PREVIOUS_RELEASE_TAG`), `tools/release-server.ts` | `d1` is built from its tag via `git archive`, cached by commit; T4.27 adds `d2` from `claude-opus-5.5-d2` and a current `d4`. |
| Capacity | `tools/capacity/profile.ts`, `tools/measure-capacity.ts`, `tools/verify-capacity.ts` | Basis at schema 2; T4.28 measures Marks and Actions and bumps it to schema 3. |
| Fixtures | `tests/fixtures/workspace-v1/`, `workspace-v2/`, `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts`, `viewsOf(app, schemaVersion)` | **Never regenerate v1 or v2.** `verify:fixtures` already compares snapshots field by field (D4 A51, brought forward by T2.56), so added fields are allowed and asserted. |
| Benchmark | `npm run build:bench`, `bench:generate`, `bench:run`; `tools/bench/profile.ts` (`BENCH_PORT = 5181`); `bench/dataset.json`, `bench/expected-open-rows.json` | Cached profile in `.cache/bench/profile`. Production carries the inert `skipMutationRecheck` seam. |
| Node integration | `tests/integration/d1/`, `d2/` with `support.ts`; `tests/support/` (`NodeTestHost`, `stack.ts`, `dumpAll`, `record-source.ts`, `request-counter.ts`, `facade-double.ts`) | `npm run test:integration -- d4/<name>` selects files; `npx vitest run` runs both projects. |
| Browser suite | `e2e/d1/`, `e2e/d2/` with `support.ts` (server and profile fixtures, read-only `probe`, `writeIntegrityFixture`, UI steps), `e2e/d2/ui-alignment.spec.ts` (layout measurements) | `test:e2e` builds `dist-faults` and the releases. |
| UI | `src/ui/` (`AppShell.tsx`, `screens/TradeList.tsx`, `TradeDetail.tsx`, `PositionChangeForm.tsx`, `form-issues.tsx`, `format.ts`, `icons.tsx`, `app.css`) | The Trade column and two-line narrow cell (section 2a), cards on Detail, expandable Execution rows, prompt chip groups, the storage icon in the page title. Money groups thousands; share quantities do not (user's choice). Repo prettier style is `--single-quote --print-width 150`. |

Browser-test lessons from D1 and D2, all already handled in the `support.ts` files:
- Profiles launch with `channel: 'chromium'`; a profile killed by SIGKILL is relaunched with the same spawn.
- Playwright's offline emulation doesn't cover service-worker fetches. Offline cases also stop the server.
- A form control's focus ring needs `:focus-within` for date-time inputs.
- Layout checks wait for layout at the 960 px switch (`WIDE_LAYOUT_MIN_WIDTH`).
- `tdd.sh` runs vitest only, so Playwright reds and greens are logged by hand.

## 5. Working rules

- Commit each finished task locally, with the co-author line. **Never push** unless the user asks.
- End every task with a complete cumulative suite run, delegated to the `suite-runner` subagent (it writes the full outputs to `evidence/D04/suite-runs/` and returns the table), and recorded in `evidence/D04/structural.md`. The run covers unit, integration and browser suites, plus the static and verify checks: typecheck, `tsc6`, lint, `lint:deps`, build, and every `verify:*` (D4 adds `verify:session-policy`).
- Every implementation commit gets an `ocr-review` run. **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says (user's direction 2026-10-27, replacing the 2026-10-26 approval rule used at the end of D2): each Valid or Doubtful finding becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again; a Wrong finding is dismissed with its reason and listed in section 7's open questions.
- Refer to document sections in words, never with the "§" sign.
- Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose.
- Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- Don't plan far ahead of working code (decision 40).
- After each finished task, commit it, record its cumulative run, update section 7 of this note with where D4 stands, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D4 from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these);
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify), or T4.2 has no web access for the NYSE calendars;
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite.
- **First-run passes:** log them with their mutation check, list them under section 7's open questions, and report them at the end. They don't stop the session.
- **ocr findings and critic defects:** handle them as section 3 and the working rules describe, then spawn a fresh critic until one passes.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

When the gate passes, tag `claude-opus-5.5-d4` locally. Then stop with a final report:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the acceptance rows ready to be marked `covered`. Ask before marking them, as for D1 and D2.

Never push.

## 6. Out of scope

- Any deliverable other than D4, unless the user says otherwise.
- D1's and D2's optional polish, unless the user asks. The D2 items the user triaged as "leave" on 2026-10-27 (`evidence/D02/structural.md`, "Triage of the remaining findings") stay as they are: the WebKit sticky caption, the caption inset, the Deviations bullet list, Record entry on a lifecycle disagreement, ungrouped share quantities, the Recovery Only resize delay, the "planned Not applicable" wording, and `<del>` until D15.
- F12, the section-validator gaps, carried into D8's T8.6.
- Breakdowns for D9–D28 and RC. D9's numbering will start at P36, A150 and decision 54.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 7. D4 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | T4.1 Session policy (`fd100c5`), bug tasks T4.1-B1 (`b3e55b5`) and T4.1-B2 (`b1c7ad2`), and T4.1-R, T4.1 restated under revision 10 (`d420ebc`). T4.2 Session-policy verification (`b09ba64`): `nyse-published.json` for 2024–2028 from ICE and nyse.com, `verify:session-policy`, revision → digest map; all 12 table rows matched, only their sources changed; revision 1 digest `13ff3ef7…998b`. Cumulative runs after each passed. T4.3 Persistence schema v3 (`1ef5e75`) with T4.3-B1 transforms drop private fields (`8900f28`); ocr clean after B1; its cumulative run failed only on the schema-bump consequences recorded in `structural.md`. T4.27 Previous-release harness (`ab37cd0`), run ahead of graph order: `d2` built from the `claude-opus-5.5-d2` tag, current-source `d4` added; ocr clean; cumulative run green except the expected `verify:capacity` (T4.28). `test:e2e` stays `e2e/d1 e2e/d2` until T4.33 adds `e2e/d4` specs. T4.4 Market Data Manual Mark save (`b8f490d`) with bug tasks B1 impossible dates (`48e1420`), B2 instant comparison (`0b3dc81`), B3–B5 an in-transaction persistence increment (`28fd3e1`, `e506ec8`, `a6ec5d9`, later reverted), B6 optimistic retry (`03b323b`, reverting B3–B5), B7 Catalog seed and B8 Journal seed bind their counters and retry (`633fdc1`, `0d6ce0c`), B9 Workspace initialization reports refused or incomplete seeds (`6c2fed7`), B10 no Market Data counter (`167433d`); plan revisions 11 (ADR 0011, decision 52) and 12 (decision 53) by the user's direction; last ocr clean; cumulative run green except `verify:capacity`. T4.5 acknowledgments and precedence (`46436bb`, redone test-first after `bb63137` was reverted in `024b7bd` for code ahead of red) with B1 bounded Stale-context lookup (`0e3d0de`); ocr clean; cumulative run green except `verify:capacity`. T4.6 `ResolveFrames` and `ExpectedSnapshot` (`1bd50e1`) with B1 digest covers the completed next session (`1abdf25`), B2 malformed as-of rejected with `InvalidInstant` (`8c61109`), B3 canonical context in the digest (`3d5607b`), B4 switch refactor (`0715b2a`); ocr clean; cumulative run green except `verify:capacity`. |
| Next task | **T4.7 Market Data: `recover` without a provider** (behavioral). `verify:capacity` fails as expected until T4.28. |
| Last commit | the T4.6 evidence and handoff commit after `0715b2a` |
| Open questions | **D4 flagged first-run passes:** T4.1, 9 of 20 cases (Saturday New Year's, Good Friday, Columbus Day, DST closes, exactly 16:30, weekend latest-completed, early-close latest-completed, Thanksgiving skip, latestCompleted coverage diagnostic), each built by an earlier case and mutation-checked; T4.1-B1 case 2; T4.3, 2 cases (v1→v2→v3 chain, `byInstrumentDate` rebuild); T4.1-R, 3 restated cases (Sunday observance 2027, 2027-12-31, closure 2025-01-09). Dead code left in `rules.ts` for the user: the Saturday-New-Year flag has no observable effect (year-local lookup), and the Juneteenth from-2022 condition is unreachable inside coverage. Details in `evidence/D04/tdd-log.md`. **D4 decisions:** plan revision 10 (decision 51, the user's direction): coverage from 2024-01-01. The T4.1 ocr table-accuracy finding was folded into T4.2 rather than becoming a bug task, since T4.2 corrects the table against NYSE's published calendars. **T4.4 items for the user:** first-run passes: Friday 2026-10-09 accepted, the extra same-key concurrency case, B6's no-retry case (later deleted), B10's restated different-keys case, each mutation-checked; B10's restated commit case red came from a stricter first assertion. Decision: the T4.4 case "zero … price with InvalidPrice" predates D7 P27, so the implementation follows A37 (0 accepted, negative gives `PriceNegative`). `InvalidDate` added for malformed or impossible dates. Facade wiring of `MarketData.save` (mutation guard, `FACADE_GROUPS`, capability manifest) is left to T4.19; the write-gate case covers the persistence boundary. B9 marks a manifest `SeedConflict` as `completed: false` too (subagent's choice, accepted). One load-related browser timeout after B9 (`e2e/d2/narrow.spec.ts:69`) passed on rerun and did not recur. **T4.5 items for the user:** first-run passes 3 (past-session assert), 6 (Mark after acknowledgment), 7 (no price when acknowledged), each mutation-checked; the user confirmed keeping withdraw. Choices: re-asserting appends; an over-long withdraw reason gives `ReasonTooLong`; persistence `ReadTransaction` gained `findLastFromIndex`. **T4.6 items for the user:** first-run passes 4, 5, 11, mutation-checked; query request and result types are the subagent's shapes (spec names none), open to T4.19; decision (T4.6-B1): the digest takes the as-of instant's material effect, each frame's completed next session, not the raw instant; persistence `ReadTransaction` gained `getAllInRange`. **Dismissed ocr finding:** T4.2, `verify:session-policy` not wired into `build` (Wrong: it is the plan's exact verification and every cumulative run executes every `verify:*` script). Carried from D2 for the user, none blocking: `npm audit` reports 3 high findings in `sharp` via the pinned `wrangler@4.147.0` (deploy-only), and fixing them needs a pin change, so a plan revision. `engine-strict`'s refusal was never exercised. `sw.js` is outside the inventory by design (T1.3), so a worker-only change keeps the release identity. Local times show no UTC offset, so a DST fall-back hour is ambiguous wherever times are shown (T2.51-B1). D2's flagged first-run passes and decisions are listed in `plan/D02-handoff.md`, section 7, "Open questions". |
