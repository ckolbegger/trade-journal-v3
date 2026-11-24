# Handoff — implement Deliverable 3 (open a Long Stock position)

Read this file completely before doing anything else.

## Where you are

- **Worktree:** `/Users/ckolbegger/src/trade-journal-v3/worktrees/Hy4-Flash`
- **Branch:** `Hy4-Flash`, tracking `origin/Hy4-Flash`. Working tree clean.
- **Latest commit:** `8c9ba348` — D2 complete, tagged `hy4-flash-d2-complete` and pushed.
- **Repo instructions:** read and obey `AGENTS.md` (Karpathy guidelines) first.

## Frozen baseline (read-only)

- `plan/freeze.md` — revision `c5d28a8a`, with SHA-256 digests of the frozen files.
- `plan/vertical-deliverable-plan.md` — the 21-deliverable plan; **Deliverable 3** is your scope.
- `plan/acceptance-evidence-matrix.md` — 69 acceptance scenarios; one row each.
- `specs/README.md` and every document it indexes, including `specs/acceptance/acceptance-contract.md`.
- `plan/deviations.md` — **DEV-001** defers production HTTPS evidence until deployment; local `http://localhost:$DEV_PORT` is valid for browser-critic evidence and must never be relabelled production evidence.
- `plan/d1-execution-record.md` and `plan/d2-execution-record.md` — what was delivered and how it was verified.

Treat `specs/` and the frozen plan files as read-only. A required deviation pauses work and needs approval before changing them.

## Your task — Deliverable 3: Open a Long Stock position

From the frozen plan:

**User stories**
1. As a trader, I want to record the fills that opened my Long Stock Plan as one decision, so that the journal shows my real position, basis and fees.
2. As a trader, I want to answer, decline or defer the Position Change Reflection, so that recording a fact is not blocked by writing.

**Capability set.** From Planned Trade detail, record one or more opening Executions with exact instrument, quantity, price, fee and Economic Time, bound to Planned Leg intent. Derive Instrument Position, open Lots, allocated opening fees and realized-to-date, verify lifecycle agreement, and store `Open`. The Reflection is completed, declined or deferred as Journal Debt without a blank Entry.

**Operations / mechanisms.** `TradeWorkflows.recordPositionChange` (opening subset); `TradeAnalysis.derive`; `TradeRecord.prepareChange`/`applyPreparedChange`/`getRecord`/`queryRecords`/`history`; `Journal.prepareEffects`/`applyPreparedEffects`/`query`; `TradeViewsAndReporting.browseTrades`/`getTradeDetail` (Open presentation).

**Seeds / defaults.** None.

**Durable representation.** Execution facts with Economic Time and Recorded Sequence; open Lot records; lifecycle index membership `Open`; Reflection Entry, decline or Debt with trigger-time definition snapshot.

**Acceptance scenarios.** AC-JOUR-003 **full**, AC-RESP-001 **full**, AC-LIFE-001 **partial** (Planned→Open only), AC-POS-002 **partial** (one decision group), AC-JOUR-005 **partial**.

**Declared scope.** No valuation or Mark until D4; no disposal or closing Lot Matches until D6.

**Prerequisite edges.** D2 → D3 is a hard data edge: opening Executions require a confirmed Planned Trade. D3 owns `TradeAnalysis.derive` (later deliverables reuse it unchanged) and the lifecycle index update.

## Process you must follow

1. **Write the detailed D3 task breakdown first** — `plan/d3-task-breakdown.md` — with structural tasks (exact verification) and behaviour-bearing tasks (concrete `describe(...)` / `it should ...` cases, public seam, conditions, observable outcome), red/green commands, mock-free integration cases and fixtures, and browser-critic flows. Follow the shape of `plan/d2-task-breakdown.md`. Do not start production code before this exists.
2. **Implement test-first, one behaviour at a time.** For every `it should ...`: add the test through the identified seam, run it, confirm RED fails because the behaviour is absent (not due to syntax/fixture errors), make the smallest production change, rerun to GREEN, keep earlier tests green, then refactor separately if needed. Record red and green commands and outcomes.
3. **No mocks in integration tests.** Use real persisted behaviour; `fake-indexeddb` is the disclosed substitute for browser-owned IndexedDB. Disclose any test infrastructure. Unit tests may mock for isolation.
4. **Cumulative suites before critic.** `npm run test:all`, `npm run test:integration`, `npx playwright test`, `npm run lint`, `npm run typecheck` (`tsc --noEmit`, TS 7.0.2), `npm run typecheck:6`, `npm run build` must all pass.
5. **Fresh browser-critic gate.** Write `plan/d3-critic-brief.md`, spawn a fresh general subagent (NOT this session) with the brief, have it start the app itself and drive the production UI with `playwright-cli` against `http://localhost:5182`. It must not edit files. For every defect, first add/strengthen a failing automated test, fix, rerun all cumulative suites, then spawn ANOTHER fresh critic and repeat until all flows pass. Never self-certify.
6. **Record and commit.** Write `plan/d3-execution-record.md` with red/green evidence, verification outcomes, critic reports, and honest per-scenario status. Update the capability manifest/navigation to add only D3 capabilities; do not expose Execution as a separate operation or a close control. Commit with a `feat(d3):` message. Tag `hy4-flash-d3-complete`, push the branch and the tag, and verify with `git ls-remote`.

## Environment already verified

- Node 26.12.0, npm 11.20.0.
- TypeScript 7.0.2 (`npx tsc`) with `@typescript/typescript6` alias (`npx tsc6`) for typescript-eslint. Verify versions after any dependency change.
- React + Vite 7, Vitest 4, `@playwright/test` 1.x and `playwright-cli` 0.1.25 installed globally; Chromium available. A fresh subagent was verified able to launch a browser, read accessibility snapshots, click by ref and close.
- `.env.local` sets `DEV_PORT=5182`. `.gitignore` ignores `node_modules/`, `dist/`, `.playwright-cli/`, `test-results/`.
- Existing code: `src/domain/` (readiness, write-gate, seeds, initialize, catalog, browse, workspace, capability-declaration, assess-plan, calendar, confirm-plan, plan-reflection, planned-views), `src/persistence/db.ts` (IndexedDB v2, atomic `transaction()` helper, `repo`), `src/ui/` (App, controller, plan-controller, styles), `tests/` and `e2e/`. Reuse these patterns; do not rebuild them.
- Known non-defects carried forward: favicon 404 in dev; `Workspace` nav button has no dedicated handler (status shown inline); New Plan binds the first Account implicitly; Planned list row shows only the underlying. Do not spend D3 on these unless a D3 acceptance scenario requires it.

## Hard rules

- Prototype wins over spec where a logged divergence says so (see frozen plan). No new prototype is in scope for D3.
- No layer-only deliverable. Every piece of D3 must be reachable and usable through the production UI.
- Do not advertise incomplete capabilities or return a domain `Unavailable` for an undelivered capability.
- Runtime Readiness and the persistence-level `RuntimeNotWritable` gate must keep gating every new authoritative mutation.
- If you cannot provide a fresh critic, a startable server or browser control, stop and report the blocker rather than self-certifying.

## Deliverable when done

Report: commit hash, tag pushed, critic verdict, tests that pass, any remaining open items, and the next deliverable (D4 — Daily Review Phase I: current pricing, Marks and ongoing Risk/Reward).
