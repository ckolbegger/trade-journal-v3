# Deliverable 7 — task breakdown

Scope: Close Review. Builds on D6. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. The Close Review is a Journal obligation with its own key `CloseReview:<tradeId>`, distinct from the Position Change Reflection key `PositionChange:<pcId>`. It may be completed, deferred or declined **after** closure without ever blocking it or writing a Trade fact. Declared scope: no Edit/Addendum/Void UI (AC-JOUR-002 remains partial), no options, no settlement, no management revision, no report.

## Structural tasks

### D7-S1 — Capability manifest and navigation honesty
Add `Journal.save(CloseReview)`, `Journal.query(CloseReview)`, `Journal.getDefinitions(CloseReview)`, `DailyReview.getDebt(CloseReview)` and `TradeViewsAndReporting.getTradeDetail(JournalNarrative)`. Navigation stays `Accounts, Status, New Plan, Trades, Review`; Close Review is an action on a Closed detail, not a nav entry. No report, backup, restore, provider or option capability appears.
**Verification:** `npx vitest run tests/structural/d7-capability-manifest.test.ts`.

### D7-S2 — Durable representation
A completed Close Review stores one immutable Entry with the exact D1 definition snapshot (prompt identities, order, options, labels), role-keyed answers, `Source: Trade Close`, one Trade Anchor, origin `{kind:'TradeClose', tradeId}`, authored time, and its obligation key. Deferral stores one Outstanding Debt with the trigger-time snapshot, `dueSemantics: DueAtNextDailyReview`, `dueAt` (the next Review Date) and settlement route — never a blank Entry. Decline stores a distinct `JournalDecline` with reason. No Trade row is written by any of these outcomes.
**Verification:** `npx vitest run tests/structural/d7-durable-representation.test.ts` uses the real `journal` store and reopens the DB.

### D7-S3 — Exact initial definition and distinct obligation key
`CLOSE_REVIEW_DEFINITION` is D1 with exactly three prompts from `specs/design/journal.md`: "Would you take this Trade again under similar conditions?" (required Single Select: Yes, as planned / Yes, with changes / No / Unsure), "What worked, and what did not?" (optional Text), "What is the key lesson?" (optional Text). The key family `CloseReview:` never collides with `PositionChange:` or `DailyReview:`.
**Verification:** `npx vitest run tests/structural/d7-definition.test.ts`.

### D7-S4 — Contract honesty
The D7 module exposes no Trade writer, no lifecycle setter and no generic reflection mutator. One call returns a revision-bound Entry/Debt/Decline projection without a read-back.
**Verification:** `npx vitest run tests/structural/d7-contracts.test.ts`.

## Behaviour-bearing tasks

### D7-T1 — Reflection preparation and definition validation
**Seam:** `prepareCloseReview(command)` in `src/domain/close-review.ts`.
- `describe("Close Review preparation")`
  - `it should snapshot the exact D1 definition and role-keyed answers for a completed review with Source Trade Close`
  - `it should require the TakeAgain answer and accept the three optional/conditional text answers`
  - `it should create one Outstanding Debt with the trigger-time snapshot and a next-Review due date, never a blank Entry`
  - `it should record a distinct JournalDecline with a reason and no Entry`
  - `it should reject a form bound to the wrong definition revision with no outcome`
- **Red/green:** `npx vitest run tests/unit/close-review.test.ts -t "<case>"`.
- **Integration:** `tests/integration/close-review.test.ts`.
- **Critic flow:** complete/defer/decline on a Closed detail; `B(cr-disposition)`.

### D7-T2 — One obligation, one outcome
**Seam:** `applyCloseReviewOutcome(current, prepared, attemptId)` and `reopenCloseReviewDebt`.
- `describe("Close Review obligations")`
  - `it should keep exactly one current outcome per obligation key under repeated Complete, Defer or Decline`
  - `it should return Conflict with no write when the existing outcome revision is stale`
  - `it should keep the Close Review key distinct from the Position Change Reflection and Daily Review keys`
  - `it should atomically reopen the same Debt when the sole Debt-settlement Entry is voided`
- **Red/green:** `npx vitest run tests/unit/close-review.test.ts -t "<case>"`.
- **Critic flow:** resubmit a completed review; no duplicate journal row; `B(cr-once)`.

### D7-T3 — Atomic persistence and no-write gates
**Seam:** `saveCloseReview(request, db)` in `src/ui/close-review-controller.ts`.
- `describe("Close Review save integration (mock-free)")`
  - `it should commit one Entry with the D1 snapshot and no Trade write`
  - `it should settle a deferred Close Review Debt and its Entry in one journal transaction`
  - `it should return RuntimeNotWritable and change nothing when readiness is not Writable`
  - `it should write no Entry, Debt, decline or draft when a form is merely opened or left`
  - `it should survive a DB reopen with the same outcome revision`
- **Red/green:** `npx vitest run tests/integration/close-review.test.ts -t "<case>"`.
- **Critic flow:** blank form + navigate away, then reopen — journal unchanged; `B(cr-save)`.

### D7-T4 — P5 deferral becomes due Debt at the next Review
**Seam:** `dueCloseReviewDebt(row, reviewDate)` and `resolveReviewDebt` in `src/ui/review-controller.ts`.
- `describe("Close Review due Debt")`
  - `it should be due only when the next Review Date is at or before the Review cutoff`
  - `it should keep older Debts without a due date due for backward compatibility`
  - `it should block Review completion while outstanding and never block a factual close`
  - `it should answer a deferred Close Review against its original D1 snapshot and settle the Debt atomically`
- **Red/green:** `npx vitest run tests/integration/close-review-debt.test.ts -t "<case>"`.
- **Critic flow:** defer in Closed detail, open Review, see due Debt, answer it, debt settles and Review completes; `B(cr-review)`.

### D7-T5 — Deduplicated Journal narrative in Trade Detail
**Seam:** `buildTradeNarrative(rows, tradeId, executionIds)` in `src/domain/journal-narrative.ts` and `getClosedTradeDetail`.
- `describe("Trade Journal narrative")`
  - `it should include one effective outcome per obligation key anchored to the Trade or its fills`
  - `it should exclude Settled Debt rows and superseded versions while preserving declines`
  - `it should not duplicate an Entry anchored to both a Trade and one of its fills`
  - `it should attach the narrative to the Closed detail without a second read of the Trade`
- **Red/green:** `npx vitest run tests/unit/journal-narrative.test.ts -t "<case>"`.
- **Critic flow:** after completing and deferring obligations, Closed detail lists each once; `B(cr-narrative)`.

### D7-T6 — Production UI
**Seam:** production React UI driven with `playwright-cli` and `@playwright/test`.
- `describe("Close Review UI")`
  - `it should offer Complete, Defer and Decline only on a Closed detail and write nothing on leave`
  - `it should save one immutable Entry against D1 with no Close Reason or Trade fact change`
  - `it should defer to a due Debt at the next Review and settle it from that Review`
  - `it should decline with a distinct JournalDecline and no Entry`
  - `it should show each Journal outcome once in the deduplicated Closed detail narrative`
- **Red/green:** `npx playwright test e2e/d7-close-review.spec.ts -g "<case>"`.
- **Critic flow:** all cases at `http://localhost:5182`; `B(cr-ui-*)`.

## Evidence to capture for D7
- Per-case RED/GREEN, structural outputs, cumulative suites, fresh-critic report per `B(...)`.
- Exact obligation keys, definition revision/snapshot, Source, Anchor, origin, due date, outcome revision, journal identities before/after and DB reopen read-back, in every trace.
- No-write/rollback comparisons and the absence of any Trade mutation; explicit clock and browser/OS provenance; local loopback only per DEV-001.
- Acceptance map: AC-JOUR-005 full, AC-JOUR-001 full, AC-JOUR-003 full, AC-POS-004 full, AC-JOUR-002 partial (Edit/Addendum/Void surface later).

## Parallelism and ownership
S1–S4 fixed before UI. T1/T2 parallel once contracts are fixed; T3 depends on T1/T2; T4 depends on T3; T5 depends on T3; T6 depends on T4/T5. Single-owner resources: the `CloseReview:` obligation key family, `CLOSE_REVIEW_DEFINITION`, and the trade narrative projection (D7 owns; later reporting reuses unchanged).
