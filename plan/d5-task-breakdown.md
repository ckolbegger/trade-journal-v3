# Deliverable 5 — task breakdown

Scope: Daily Review Phase II — journaling and Action recording. Builds on D4. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. `TradeAnalysis.replay` is owned here and reused unchanged later. Declared scope: no provider recovery (D9), no corrections (D11a), no full replay visuals or Daily Bars (D8a), no close (D6), no provider configuration. No Review Session, stage, finish flag or placeholder is ever written.

## Structural tasks

### D5-S1 — Capability manifest and navigation
Add `DailyReview.open`/`getTrade`/`getDebt`/`save`, `Journal.save(DailyTradeReview)`, `TradeAnalysis.replay` and `TradeRecord` narrow Deviation reconciliation. Navigation gains one `Review` entry alongside Accounts, Status, New Plan, Trades; no provider, report, backup, restore or close control appears.
**Verification:** `npx vitest run tests/structural/d5-capability-manifest.test.ts`.

### D5-S2 — Durable representation
Dated Daily Trade Review Action Entries keyed by (Entry Type, Trade, Review Date) with Source Daily Review, Trade Anchor, origin `(Trade, Review Date)`, moment time at Review cutoff and authored time at Save; explicit decline and settled/reopened Debt outcomes; reconciled Stop-Discipline occurrences with stable fingerprints stored on the owning Trade. No Review Session, stage, finish flag, placeholder or unsaved-form evidence.
**Verification:** `npx vitest run tests/structural/d5-durable-representation.test.ts` uses the real `journal`/`trade` stores.

### D5-S3 — Action definition and policy vocabulary
Initial Daily Trade Review definition: Action (required workflow-critical Hold/Exit/Roll/Adjust), Intent (optional for Hold, required for the other three), Conviction now, Considered-but-declined, Note. Hold is preselected only in unsaved view state. Stable completion vocabulary `Incomplete`, `Complete`, `CompleteWithUnavailableMarks` and the disclosed `Complete, settlement to record` sub-state of `Incomplete`. Stable reason codes for the P1 Save gate and P2 day-card disclosure.
**Verification:** `npx vitest run tests/structural/d5-action-definition.test.ts`.

### D5-S4 — Exact-date eligibility and task order
Review Date is the latest completed session; eligibility uses corrected facts at the cutoff (current Open state in D5, corrections in D11a). Task families appear in order: current Missing Marks, due Debt, Settlement Due, then the attention-ranked Trade walk. No saved Review list or finish flag.
**Verification:** `npx vitest run tests/structural/d5-task-order.test.ts`.

## Behaviour-bearing tasks

### D5-T1 — `TradeAnalysis.replay` and Stop-Discipline episodes
**Seam:** `replay(input: ReplayInput) -> ReplayResult`.
- `describe("replay — Stop Discipline")`
  - `it should begin an episode at the first exact observation demonstrating breach, never earlier`
  - `it should end an episode only on an exact unbreached observation or condition replacement`
  - `it should treat a gap as first-observed and never fabricate a crossing date`
  - `it should assign a stable fingerprint so one episode reconciles once`
  - `it should return explicit gaps per session without interpolation or carry-forward`
- **Red/green:** `npx vitest run tests/unit/replay.test.ts -t "<case>"`.
- **Integration:** `tests/integration/replay.test.ts` uses persisted Mark frames.
- **Critic flow:** a breached Mark produces one disclosed Stop episode, not one per date; `B(review-episode)`.

### D5-T2 — Action form and Save boundary
**Seam:** `prepareAction(form, definition, binding)` and `dailyActionKey(tradeId, reviewDate)`.
- `describe("Daily Trade Review Action")`
  - `it should return the exact initial Action definition with Hold/Exit/Roll/Adjust and Intent conditional on non-Hold`
  - `it should preselect Hold only in unsaved view state and record nothing until explicit Save`
  - `it should accept one-click unchanged Hold and require Intent for Exit, Roll and Adjust`
  - `it should keep exactly one Action outcome per Trade and Review Date under retries`
  - `it should reject a form bound to a stale definition or evidence snapshot with no write`
- **Red/green:** `npx vitest run tests/unit/daily-action.test.ts -t "<case>"`.
- **Integration:** `tests/integration/daily-action.test.ts` checks journal store before/after leaving a form and under retry.
- **Critic flow:** open a Trade, type an Intent, navigate away — no Action; Save preselected Hold — exactly one dated Entry; `B(action-save)`.

### D5-T3 — Completion, attention ranking and day card
**Seam:** `deriveCompletion(input)` and `rankTrades(input)`.
- `describe("Daily Review completion and attention")`
  - `it should be Incomplete while any Action, current Mark, Debt, settlement or reconciliation is outstanding`
  - `it should be Complete only when every obligation is resolved with exact current Marks`
  - `it should be CompleteWithUnavailableMarks when all obligations are resolved with an acknowledgment, naming Instruments and Trades`
  - `it should show "Complete, settlement to record" only as a disclosed Incomplete sub-state`
  - `it should rank blocker, boundary, evidence-limited, quantified pressure and routine bands with stable reasons`
- **Red/green:** `npx vitest run tests/unit/review-completion.test.ts -t "<case>"`.
- **Critic flow:** the day card shows ordered task families and an honest completion state; `B(day-card)`.

### D5-T4 — Snapshot conflict and stale evidence
**Seam:** `saveTradeAction(request, db)`.
- `describe("DailyReview.save conflicts")`
  - `it should return ReviewChanged with no write when a Mark, acknowledgment or Action changed before Save`
  - `it should return Conflict with no write on a stale Trade or definition revision`
  - `it should return NeedsTradeWorkflow for workflow-routed Debt with no write`
- **Red/green:** `npx vitest run tests/integration/review-save.test.ts -t "<case>"`.
- **Critic flow:** change a Mark in another surface then Save — visible conflict, nothing written; `B(review-conflict)`.

### D5-T5 — Atomic save orchestration
**Seam:** `saveTradeAction` and `resolveReviewDebt` in `src/ui/review-controller.ts`.
- `describe("DailyReview.save")`
  - `it should commit one dated Action Entry and the reconciled Stop-Discipline occurrence atomically`
  - `it should return the post-commit Action, occurrence, completion and next step without an `open` read-back`
  - `it should settle Journal-only Debt or record an explicit decline atomically`
  - `it should return RuntimeNotWritable and change nothing when readiness is not Writable`
- **Red/green:** `npx vitest run tests/integration/review-save.test.ts -t "<case>"`.
- **Critic flow:** Save Hold with a breached Mark yields exactly one Entry and one episode; reload resumes from facts; `B(review-save)`.

### D5-T6 — Production UI: day card, marks table and Trade walk
**Seam:** production React UI driven with `playwright-cli` and `@playwright/test`.
- `describe("Daily Review UI")`
  - `it should open a Review with task families in Mark, Debt, settlement, Trade order`
  - `it should gate Action Save on an exact Mark and show acknowledged evidence as resolved-but-Unavailable`
  - `it should present each eligible Trade with its evaluated figures, conditions, episode and Action chips`
  - `it should preserve entered-but-unsaved Action state across a live resize and write nothing on leave`
- **Red/green:** `npx playwright test -g "<case>"`.
- **Critic flow:** all four cases at `http://localhost:5182`; `B(review-ui-*)`.

## Evidence to capture for D5
- Per-case RED/GREEN, structural outputs, cumulative suites, fresh-critic report per `B(...)`.
- Exact Review Date/cutoff, Workspace time zone, bound Trade/Fact revision, Market snapshot id/digest, definition revision, obligation key, episode fingerprint and post-commit revisions in every Save trace.
- Restart/read-back and no-write comparisons; explicit clock and browser/OS provenance; local loopback only per DEV-001.
- Acceptance map: AC-REV-002/003/004/005/006 full with P1/P2, AC-JOUR-001 full, AC-REV-007 full, AC-REV-001 partial (corrections restate eligibility in D11a).

## Parallelism and ownership
S1–S4 fixed before UI. T1/T2/T3 parallel once contracts are fixed; T4/T5 depend on T1–T3; T6 depends on T5. Single-owner resources: capability manifest and Review navigation (S1), `TradeAnalysis.replay` and Stop-Discipline fingerprinting (D5 owns; later steps reuse unchanged), the Daily Trade Review obligation key (D5 owns).
