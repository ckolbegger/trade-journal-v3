# Deliverable 6 — task breakdown

Scope: Close a Long Stock position. Builds on D5. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Declared scope: one terminal Long Stock Position Change with FIFO Lot Matches, lot-aware opening/disposal fees, realized P&L, exactly one Close Reason for trader agency, derived Terminal Disposition, and the stored `Closed` Lifecycle State with same-commit index update. Close Review is D7; no options, settlement or management revision. `TradeAnalysis.derive` is D3-owned and is extended only additively: Buy-only inputs keep byte-identical results.

## Structural tasks

### D6-S1 — Capability manifest and navigation honesty
Add `TradeWorkflows.recordPositionChange(Closed)`, `TradeAnalysis.derive(FIFO)`, `TradeRecord.lotMatches`, `ReferenceCatalog.resolve(CloseReason)` and `TradeViewsAndReporting.getTradeDetail(Closed)`. Navigation stays `Accounts, Status, New Plan, Trades, Review` — Close is an action on an Open detail, never a nav item, and neither provider recovery nor report/backup/restore appears.
**Verification:** `npx vitest run tests/structural/d6-capability-manifest.test.ts`.

### D6-S2 — Durable representation
A Closed Trade stores its closing Executions (Economic Time + Recorded Sequence), recorded FIFO Lot Matches as links carrying only `executionId`, `lotId`, `quantity`, `matchingMethod`, `allocatedOpeningFee` and `allocatedDisposalFee` (no copied price, basis or P&L), one resolved Close Reason fact (stable catalog id + label), the derived realized-to-date string, and a `Closed` lifecycle binding. The lifecycle index row moves the Trade from `Open` to `Closed` in the same commit as the Trade row and the Position Change Reflection outcome. No Close Review Entry/Debt/Decline is written (D7).
**Verification:** `npx vitest run tests/structural/d6-durable-representation.test.ts` uses real `trade`/`journal` stores and reopens the DB.

### D6-S3 — Terminal vocabulary and reference resolution
Terminal Disposition is derived from effective disposing mechanisms and is never a captured field; it is `NotApplicable` when not structurally Closed. Terminal Reason Requirement is `RequiresCloseReason` for a trader-directed closing Execution and `RequiresNoCloseReason` for no-agency settlement. Close Reason resolves to exactly one active seeded value; unknown, renamed-away, multi-valued and settlement-mechanism labels are rejected.
**Verification:** `npx vitest run tests/structural/d6-terminal-vocabulary.test.ts`.

### D6-S4 — Public contract and receipt
`recordClose` exposes no lifecycle setter and no generic `closeTrade`; one call returns a receipt bound to committed revisions plus a post-commit Closed projection and reflection outcome without a read-back.
**Verification:** `npx vitest run tests/structural/d6-contracts.test.ts`.

## Behaviour-bearing tasks

### D6-T1 — FIFO matching, lot-aware fees and realized P&L
**Seam:** `derive(input: TradeDerivationInput)` extended additively in `src/domain/derive.ts`.
- `describe("derive — FIFO Lot Matches")`
  - `it should match each disposing Execution FIFO to exact open Lots ordered by Economic Time then Recorded Sequence`
  - `it should allocate opening and disposal fees proportionally across matches exactly once and keep the unconsumed opening fee on a remaining Lot`
  - `it should keep the Trade Open after a partial close and derive Closed only when net exposure is flat`
  - `it should derive realized P&L from matched facts and never duplicate price or P&L onto a Lot Match`
  - `it should derive Terminal Disposition only from effective disposing facts and report integrity findings without repairing on read`
- **Red/green:** `npx vitest run tests/unit/derive.test.ts -t "<case>"`.
- **Integration:** `tests/integration/record-close.test.ts` replays persisted facts.
- **Critic flow:** close with two opening fills and two closing fills; verify exact matches, fees and realized P&L; `B(fifo)`.

### D6-T2 — Close Reason resolution and terminal requirements
**Seam:** `resolveCloseReason(label, catalog)`, `deriveTerminalDisposition(facts, closed)`, `deriveCloseReasonRequirement(facts, closed)` in `src/domain/close.ts`.
- `describe("terminal Close Reason")`
  - `it should resolve exactly one active seeded Close Reason to its stable identity`
  - `it should reject an unknown, non-active or non-seeded Close Reason without a write`
  - `it should require exactly one Close Reason for trader agency and none for no-agency settlement`
  - `it should derive Terminal Disposition from disposing mechanisms only and keep it separate from the Close Reason`
- **Red/green:** `npx vitest run tests/unit/close.test.ts -t "<case>"`.
- **Critic flow:** blank/unknown reason is rejected with prose; selecting a seeded reason closes; `B(close-reason)`.

### D6-T3 — Terminal command contract
**Seam:** `recordClose(command: CloseCommand)` in `src/domain/record-close.ts`.
- `describe("recordClose — terminal Long Stock")`
  - `it should reject a stale revision, a non-Open Trade, no disposal, oversell and an unresolved Close Reason with typed issues`
  - `it should return a receipt and a post-commit Closed projection bound to the committed revision without a read-back`
  - `it should prepare the Position Change Reflection for the closing Position Change under its own obligation key`
  - `it should return RuntimeNotWritable and change nothing when readiness is not Writable`
- **Red/green:** `npx vitest run tests/unit/record-close.test.ts -t "<case>"`.
- **Critic flow:** stale/non-writable attempts write nothing; a valid close renders the receipt figures; `B(close-command)`.

### D6-T4 — Atomic persistence and Trade Record reads
**Seam:** `recordClosePositionChange(request, db)` in `src/ui/close-controller.ts`; `queryClosedTrades`, `getClosedTradeDetail`, `toClosedDetail` in `src/domain/open-views.ts`.
- `describe("recordClosePositionChange integration (mock-free)")`
  - `it should commit the Closed Trade, FIFO matches, Close Reason and Reflection outcome atomically with the Open→Closed index move`
  - `it should survive a DB reopen with the same revisions, matches and realized P&L`
  - `it should write nothing when the stored revision changed between open and Save`
  - `it should exclude the Trade from Open queries and include it in Closed queries`
- **Red/green:** `npx vitest run tests/integration/record-close.test.ts -t "<case>"`.
- **Critic flow:** reload after close; Trade Detail shows Closed, realized P&L, matches and Close Reason; `B(close-durable)`.

### D6-T5 — Production UI: Close form and Closed detail
**Seam:** production React UI driven with `playwright-cli` and `@playwright/test`.
- `describe("Close Long Stock UI")`
  - `it should offer Close position only on an Open detail and expose seeded Close Reasons with no provider/report/backup controls`
  - `it should validate an incomplete close with visible, non-colour-only prose and write nothing`
  - `it should close with exact FIFO matches, realized P&L and Terminal Disposition, then show the Trade under Closed`
  - `it should keep the reflection outcome independent of closure and survive a reload`
- **Red/green:** `npx playwright test e2e/d6-close.spec.ts -g "<case>"`.
- **Critic flow:** all four cases at `http://localhost:5182`; `B(close-ui-*)`.

## Evidence to capture for D6
- Per-case RED/GREEN, structural outputs, cumulative suites, fresh-critic report per `B(...)`.
- Exact Trade/Fact revision, catalog Close Reason id, Position Change id, obligation key, match ids, allocated opening/disposal fees, realized P&L, disposal mechanisms and index membership before/after in every close trace.
- No-write/rollback comparisons, DB reopen read-back, explicit clock and browser/OS provenance; local loopback only per DEV-001.
- Acceptance map: AC-LIFE-001 full, AC-POS-001 full, AC-POS-004 partial (Close Reason complete; option disposition not applicable), AC-JOUR-003 full, AC-RESP-001 full.

## Parallelism and ownership
S1–S4 fixed before UI. T1/T2 parallel once contracts are fixed; T3 depends on T1/T2; T4 depends on T3; T5 depends on T4. Single-owner resources: the additive FIFO extension of `TradeAnalysis.derive` (D6 owns; D8/D8a reuse unchanged), the Close Reason resolver, and the terminal `recordClose` command.
