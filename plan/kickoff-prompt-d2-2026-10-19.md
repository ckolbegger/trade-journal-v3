# Kickoff instance — wave 2 (D2)

Instantiation of [specs/evaluation/kickoff-prompt.md](../../specs/evaluation/kickoff-prompt.md) for
deliverable **D2 — Confirm my first plan (long stock)**. The prompt text below is reproduced from the
frozen protocol; the goal line, the substituted plan path and the branch-local notes are the only
additions.

**What was substituted.**

```
/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash/plan/freeze-2026-10-17.md
at revision /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash/plan/freeze-manifest-2026-10-17.sha256
(11 plan files; verify from the repo root with `shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256`)
```

**Base state.** D1 is complete, pushed, and tagged `deepseek-v41-flash-D1` → commit `ea4fd85`. Its
evidence is [artifacts/evidence/D1-red-green.md](../artifacts/evidence/D1-red-green.md) and its critic
gate is [artifacts/critic/D1-report.json](../artifacts/critic/D1-report.json) (26/26 flows). The
**branch is `deepseek-v41-flash`** — a per-model branch, not a per-deliverable one; the tag marks the
D1 milestone on it. The repository root is a separate `main` checkout.

## Branch-local instantiation notes — not part of the frozen prompt

Read these with the freeze record; where they conflict with the protocol prompt, the prompt governs.
They exist because D2 is the first deliverable written against D1's *delivered* seams rather than the
seams as planned.

1. **Scope is wave 2, which is D2 only — all 20 tasks, T1 through T20.** D2 is frozen
   *provisionally* (freeze record §6) and its breakdown is
   [D2-confirm-first-plan.md](deliverable-breakdowns/D2-confirm-first-plan.md) (20 tasks, 11 dependency
   levels, 7 phases, §4's 12 critic flows, §5's 8 scenario rows). Implement every D2 task in dependency
   order and nothing else: do not start D3–D7, do not implement any capability from §0's "explicitly
   out of scope" list, and do not reopen D1's settled semantics. D8–D22 are not frozen and must not be
   attempted.

2. **Before T1, perform and record the wave-2 confirmation.** D2–D7 are provisional precisely because
   they were written against D1's planned seams. The confirmation has three parts:
   - Verify the **fifteen D1 seams in freeze record §7** exist with the shapes D2–D7 assume: T1
     scripts and toolchain, T3 harness and disclosed substitutions, T5 calendar, T6 values, T7 host
     port, T9 schema/store/index names, T10 migration runner, T11 transaction seam, T12
     persistence-level `RuntimeNotWritable`, T14 snapshot read, T15 lifecycle index, T22 Journal seed,
     T25 Workspace initialize, T26 status vocabulary, T28 Installed Capability Manifest. Check the
     actual exports, not the task titles.
   - Apply the open erratum **E-001**: add `D1:T12` beside the existing `D1:T9`/`D1:T11` citations
     where `D2`, `D3`, `D6` and `D7` describe the persistence-boundary rejection. Those are manifested
     files, so re-stamp `plan/freeze-manifest-2026-10-17.sha256` and rerun both plan validators and
     `shasum -a 256 -c`.
   - Record the confirmation (commands and results) at the top of
     `artifacts/evidence/D2-red-green.md`.
   If a seam's shape differs from §7 in a way that changes meaning, **stop and ask**: that is an
   adjustment or a deviation under freeze record §8, not something to paper over. Do not declare the
   confirmation by assumption.

3. **Runtime is pinned, not discovered.** Homebrew **Node `^26.12.0`** (proven 26.12.0 today) and the
   **npm 11.20.0** that ships with it; **do not use pnpm** (PD19, erratum E-008) and do not install a
   package manager. The lockfile is the version record and the dependency set is already pinned; read
   `package.json` and `package-lock.json` rather than assuming numbers. A new dependency is an erratum
   and needs the user's yes. Exact versions at D1's completion were TypeScript 7.0.2 via
   `@typescript/native` with the side-by-side `typescript` → `@typescript/typescript6` 6.0.2, ESLint
   10.13.0, Vite 8.3.4, React 19.3.1, Vitest 5.0.5, Playwright 1.64.1, `fake-indexeddb` 6.2.6,
   `decimal.js` 10.6.0 and `date-fns` 4.4.0; confirm from the files.

4. **Work on the `deepseek-v41-flash` branch, continuing from the D1 tag.** The repository uses one
   branch per model, not one per deliverable: D1–D7 are waves on `deepseek-v41-flash`, and
   `deepseek-v41-flash-D1` (`ea4fd85`) is the milestone tag, not a separate branch. Work in the
   `worktrees/deepseek-v41-flash` worktree on that branch, whose tip is the tag's commit. Do **not**
   create a per-deliverable branch (no `deepseek-v41-flash-d2`); do not work in the repository root
   (`main`) or in another model's worktree. If your orchestrator places you in a different worktree,
   confirm which model branch it is before writing anything. Commit locally as you go; **do not push**
   unless the user asks.

5. **Use D1's delivered harness, not D2's illustrative paths and commands.** Several D2 spellings were
   written before D1 pinned the harness. Read them as the delivered layout, and record the reading:
   - **Test locations.** D2:T19 and V20.4 cite `src/integration/…` and `e2e/d2-*.spec.ts`. The delivered
     harness is `tests/integration/**` and `tests/browser/**` (D1:T3). Vitest projects are `unit` and
     `integration`; Playwright projects are `chromium`, `webkit`, `narrow` (375×812) and `wide`
     (1440×900). Use `npx vitest run --project integration tests/integration/<case>.test.ts -t "…"` and
     `npx playwright test tests/browser/<case>.spec.ts -g "…"`.
   - **Serving the production UI.** D2 §4 and V20.1 say `npm run dev`. D1's frozen readiness gate
     requires the built, versioned service worker (`/sw.js` exists only after `vite build`), so a dev
     server shows `Unsupported` and cannot exercise the flows. D1:T34's critic therefore used
     `npm run build && npx vite preview --port $DEV_PORT` (`DEV_PORT=5177`). Use that for the critic and
     for any browser proof that depends on readiness; never bypass or weaken the gate to make dev mode
     pass. If a reviewer requires the literal `npm run dev`, treat it as a plan-text inconsistency to
     resolve with the user rather than something to fake.
   - **Module layout.** D1 implements `src/<module>/index.ts` (for example `src/persistence/indexeddb`,
     `src/workspace`, `src/catalog`, `src/journal`, `src/readiness`, `src/capability`) with module layers
     and allowed edges declared in `scripts/layers.config.mjs`; `npm run lint:layers` is part of
     `npm run build`. D2's `TradeWorkflows`, `TradeRecord` and `TradeAnalysis` have no D1 equivalents
     yet: add them as new modules with an explicit layer and edge list, and extend the existing
     persistence/journal/catalog/workspace modules rather than forking them. Declare every new module
     in the layer config before you rely on it.

6. **The Installed Capability Manifest grows with D2.** D1:T28 ships eight operations
   (`runtime.readiness`, `release.inventoryValidation`, `workspace.getStatus`,
   `workspace.initialize`, `workspace.requestDurability`, `referenceCatalog.query`,
   `referenceCatalog.save`, `journal.getDefinitions`) and navigation `["startup", "onboarding"]`.
   D2:T16/T17 add a planning entry point and a Trade view, so D2 must add its confirmation operation
   and its reachable destinations to the manifest, keep it installed-only, dependency-closed,
   production-entry-point-reachable and release-bound, and keep its runtime self-check green. D2 §5
   and §8.8 require the manifest to advertise **confirmation only** — not Plan lifecycle, not the
   response contract, not Journal defaults and not full UI-state coverage. The manifest is not trader
   data and must stay out of every backup section.

7. **Evidence and artifacts.**
   - `artifacts/evidence/D2-red-green.md`: new, append-only, one row per `it should` case with the task
     id, exact command, the red observation and why it failed for the named behaviour, the green
     observation, and the commit or working-tree digest. A case whose red was unreachable says so
     honestly. D1's evidence file stays untouched.
   - `artifacts/browser/`: browser provenance for D2's browser proofs.
   - `artifacts/critic/D2-report.json`: the D2 critic report, 12 flows × 2 viewports = **24 entries**,
     with `criticId`, `spawnedAfterFix`, the served URL/port and per-flow actions/observation/status,
     plus an acceptance id on every flow.
   - `artifacts/sw-test/` and `dist/` stay gitignored.
   - **Every commit that changes source or tests gets a full-suite run.** After the commit, run
     `npx vitest run` and `npx playwright test` and append the commit, the commands and the totals to
     `artifacts/evidence/D2-red-green.md`. A docs-only commit may cite the most recent full run for
     the same code state. A commit without a recorded full run is not a finished step.

8. **The completion bar.** D2 is done only when all of these hold:
   - T1–T20 implemented in dependency order, every non-structural case with recorded red and green
     evidence, and every source-changing commit carrying its own recorded full-suite run;
   - `npm run typecheck`, `npm run lint`, `npm run lint:layers`, `npm run test:unit`,
     `npm run test:integration` and `npm run test:browser` all exit 0, with D1's accepted behaviour
     still green in the same runs;
   - the mock-free integration suite (T19) proves the durable after-state, every typed rejection with
     byte-identical participant revisions, the post-commit projection field by field after a reopen,
     the injected Journal-participant rollback, the real-engine durability leg, and D2's boundedness
     properties without any latency figure;
   - a **fresh** critic that did not write the implementation starts the runtime itself, runs all 12
     flows at both viewports against the production UI, reports 24/24 passing, and the V20.2–V20.8
     commands are re-verified after any fix;
   - nothing under `specs/` is modified, and any manifested-file change (including E-001) went through
     the register, the re-stamp and both validators.

9. **Stop and ask rather than choose** when: a D1 seam in freeze §7 must change shape; a specification
   or plan sentence contradicts another (including the `npm run dev` and test-path spellings above if a
   strict reading matters); the work needs a durable-format, public-behaviour, capability-scope or
   task-order change; a new dependency is needed; a critic finding exposes an ambiguity rather than a
   defect; or a fresh critic/server/browser cannot be provided. Everything else is ordinary
   implementation work — proceed without asking.

## The prompt

```text
Work in the Trade Journal V3 repository and obey its AGENTS.md.

Your goal for this session is to implement all 20 tasks of deliverable D2, "Confirm my first plan
(long stock)", in dependency order, and nothing beyond D2. Do not start D3–D7 or any unfrozen
deliverable.

Read the frozen product baseline at specs/README.md, all documents it indexes, and the complete implementation-stack-neutral acceptance contract at specs/acceptance/acceptance-contract.md.

Read the separately approved frozen implementation plan at:
/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash/plan/freeze-2026-10-17.md
at revision /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash/plan/freeze-manifest-2026-10-17.sha256
(11 plan files; verify from the repo root with `shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256`)

Then read deliverable D2's task-level breakdown at
plan/deliverable-breakdowns/D2-confirm-first-plan.md, and this kickoff's branch-local notes. Before
T1, perform the wave-2 confirmation those notes describe: verify the fifteen D1 seams in the freeze
record's §7, apply erratum E-001 and re-stamp the manifest, and record the result. If a seam's shape
differs in a way that changes meaning, stop and request direction.

Implement the approved vertical deliverables in dependency order. Treat specs/ and the approved plan as read-only baselines. Standards-based PWA delivery and browser-neutral Runtime Readiness are frozen product requirements, not stack choices. Do not reopen settled product semantics, broaden scope, advertise incomplete capabilities, or promote a layer-specific task into a release boundary. Perform a layer-only checkpoint only when the frozen plan records its specific manual approval.

Before the first vertical deliverable can mutate authoritative data, implement its Web App Manifest, complete versioned Offline Release Inventory, every-launch and post-update/Restore Runtime Readiness gate, and persistence-level RuntimeNotWritable rejection outside Writable. Decide support only from the specified functional checks; do not use browser, browser-family, operating-system, or user-agent allowlists. Exercise all passing and failing readiness states, including simultaneous failures, an unreadable existing store, and Recovery Only, and record exact browser/operating-system versions only as evidence provenance. Preserve separate production HTTPS evidence; local browser automation may use only the plan-approved loopback origin that the tested browser recognizes as a secure context.

Implement every non-structural task with TDD, one planned behavior at a time. Before writing production behavior, add the next planned `it should ...` test through its identified public seam, run it, and confirm that it fails because the behavior is absent or incorrect. A test that passes immediately or fails for a syntax, configuration, fixture, or unrelated reason is not valid red evidence. Make only the smallest production change needed for that test, rerun it to green, and confirm the task's earlier tests remain green. Record the red and green commands and outcomes, then repeat for the next behavior; do not write all tests first and then all implementation. Unit tests may use mocks as permitted by the plan. After the task is green, perform any refactoring as a separate review step and rerun the affected tests. No non-structural task is complete without this evidence.

For each structural task, run its planned verification. Before presenting a deliverable for independent review, run the complete cumulative unit suite and every planned integration test. Integration tests must use no mocks and must traverse the real application stack and persistence/infrastructure. They may use only the disclosed isolated instances or behaviorally compatible test infrastructure recorded in the plan.

After those suites pass, spawn a fresh critic agent with access to the complete frozen specs and implementation plan. Have that critic start the application server/runtime and use a browser against the production UI to verify every planned flow for the current deliverable. A browser-recognized secure loopback origin may be used for local critic execution only as approved in the plan; it does not replace the delivery's production HTTPS evidence. The critic must not edit implementation and must return the structured actions, observations, status, and failure evidence required by the plan. It need not repeat full regression of prior deliverables; the cumulative automated suites own that responsibility. It must not treat planned future capabilities as defects.

For every implementation defect the critic finds, first add or strengthen an automated test that reproduces the defect and confirm that the test fails. Then implement the fix, rerun the complete cumulative unit and integration suites, and spawn another fresh critic to repeat the current-deliverable verification. Do not mark the deliverable complete until a fresh critic passes it. If a critic finding exposes a specification or plan ambiguity, or if a fresh critic/server/browser cannot be provided, stop and request direction rather than self-certifying.

For every deliverable, preserve atomic/audit/offline/Restore guarantees, run all mapped evidence, and report exact verification results. If implementation requires a material deviation, stop before making it, identify affected specification passages and acceptance scenarios, and request approval to revise the plan.
```
