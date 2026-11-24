# Deliverable 2 — task breakdown

Scope: Plan only — Long Stock. Builds on D1. Frozen baseline `plan/freeze.md` revision `c5d28a8a`; DEV-001 applies. No Execution, Mark, close, reflection beyond Plan Reflection, report, backup or Restore is advertised.

## Structural tasks

### D2-S1 — Capability manifest update
Add to the D2 Installed Capability Manifest: `TradeWorkflows.confirmPlan`, `TradeAnalysis.assessPlan`, `TradeRecord` prepare/apply/get/query, `TradeViewsAndReporting.browseTrades`/`getTradeDetail` (Planned), `Journal.prepareEffects`/`applyPreparedEffects`/`getDefinitions` (Plan Reflection). Navigation gains "New Plan" and "Trades"; no other capability appears.
**Verification:** `npx vitest run tests/structural/d2-capability-manifest.test.ts` asserts the exact set and that Execution/Mark/Review/Report/Backup/Restore are absent.

### D2-S2 — Schema v2 migration (isolated candidate)
Add object stores/records for Trade facts, frozen Plan, lifecycle index and Plan Reflection Entry; version bump with a forward migration from v1 that preserves D1 data. Staged, validated, atomic activation; failure leaves prior data intact.
**Verification:** `npx vitest run tests/structural/schema-v2.test.ts` opens a v1 database with a seeded Institution/Account, migrates, asserts D1 data survives and new stores exist, and that a failed migration candidate leaves v1 readable.

### D2-S3 — Deterministic clock and U.S. trading calendar
Injected clock and an explicit calendar module (no system clock in pure analysis); session resolution for economic time.
**Verification:** `npx vitest run tests/structural/clock-calendar.test.ts` asserts deterministic results for known dates including weekends/holidays with a fixed injected instant.

## Behaviour-bearing tasks

Each implemented test-first; RED then GREEN recorded per case.

### D2-T1 — Plan Assessment (`TradeAnalysis.assessPlan`, exact decimals)
**Seam:** `assessPlan(command, definition) -> PlanAssessment`.
- `describe("assessPlan — Long Stock")`
  - `it should compute a positive numeric Plan Baseline and 1R equal to Original Planned Risk using exact decimal arithmetic`
  - `it should freeze Original Planned Risk and Reward from intended entry and original Stop/Target boundaries`
  - `it should accept one long Stock Planned Leg with a complete exact underlying and positive quantity`
  - `it should reject an incoherent Strategy shape with typed issues and write nothing`
  - `it should reject a non-numeric or non-positive baseline with typed issues`
  - `it should return planned payoff-independent conformance-evidence requirements`
- **Red/green:** `npx vitest run tests/unit/assess-plan.test.ts -t "<case>"`.
- **Integration:** `tests/integration/assess-plan.test.ts` with decimal.js verifies exact cent boundaries and rounding never changes classification.
- **Critic flow:** the Plan form's live baseline preview shows 1R before Save; `B(plan-preview)`.

### D2-T2 — Plan Reflection form (`Journal.getDefinitions`, `prepareEffects`)
**Seam:** `preparePlanReflection(form, definition)` and `getPlanReflectionDefinition()`.
- `describe("Plan Reflection preparation")`
  - `it should return the exact initial Plan Reflection definition with Thesis/Invalidation semantic roles`
  - `it should require Thesis and Invalidation and accept optional Conviction and Primary emotion`
  - `it should snapshot the exact definition revision shown for the Entry`
  - `it should reject a missing required answer with typed issues and no prepared effect`
- **Red/green:** `npx vitest run tests/unit/plan-reflection.test.ts -t "<case>"`.
- **Integration:** `tests/integration/plan-reflection.test.ts` checks the definition snapshot bound to the prepared Entry.
- **Critic flow:** submit the Plan form without thesis/invalidation and see inline errors; `B(plan-validation)`.

### D2-T3 — Confirm Plan atomic command (`TradeWorkflows.confirmPlan`)
**Seam:** `confirmPlan(command) -> ConfirmPlanResult`.
- `describe("confirmPlan")`
  - `it should atomically create the Trade, freeze the Plan/legs/management, store Planned lifecycle and save one completed Plan Reflection`
  - `it should return a revision-bound post-commit result sufficient to render success without a read-back`
  - `it should set 1R from the accepted baseline and freeze the Entry's definition snapshot`
  - `it should reject a stale Account/Strategy revision or missing reflection and write nothing`
  - `it should resolve Active references only and reject inactive new selections`
- **Red/green:** `npx vitest run tests/unit/confirm-plan.test.ts -t "<case>"`.
- **Integration:** `tests/integration/confirm-plan.test.ts` uses real persistence; verifies all stores commit together, post-restart query returns the frozen Plan, and failure leaves zero Trade/Entry/index writes.
- **Critic flow:** confirm a valid Plan through the production UI; `B(confirm-plan)`.

### D2-T4 — Trade reads (`TradeRecord.getRecord`/`queryRecords`, `TradeViewsAndReporting`)
**Seam:** `browseTrades(request)` and `getTradeDetail(request)` for Planned trades.
- `describe("Planned trade views")`
  - `it should list Planned trades with Plan Baseline and entry readiness`
  - `it should show a complete Planned detail with frozen Plan, 1R, reflection and lifecycle`
  - `it should return NotFound for an unknown Trade and a coherent snapshot binding`
  - `it should never expose an Execution, Mark or close control`
- **Red/green:** `npx vitest run tests/unit/planned-views.test.ts -t "<case>"`.
- **Integration:** `tests/integration/planned-views.test.ts` reads the confirmed Trade through the real read stack.
- **Critic flow:** open the Planned list and detail; confirm only Plan information; `B(planned-views)`.

## Evidence to capture for D2
- Red/green per case; structural verification outputs; cumulative suites; critic report for each `B(...)`; map AC-PLAN-001/002, AC-RESP-001, AC-CAP-001, partial AC-JOUR-007 and AC-DEL-001.

## Parallelism and ownership
S1–S3 in parallel after D1. T1 and T2 parallel once `assessPlan`/definition contracts are fixed; T3 depends on T1/T2; T4 depends on T3. Single-owner resources: capability manifest (S1), schema v2 (S2), Trade lifecycle index and `TradeAnalysis.assessPlan` (D2 owns; later steps reuse unchanged).
