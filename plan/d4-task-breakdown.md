# Deliverable 4 — task breakdown

Scope: Daily Review Phase I — current pricing, Marks and ongoing Risk/Reward. Builds on D3. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Declared scope: no provider recovery or configuration (D9), no replay (D8a), no Review ritual (D5), no Mark correction/Rebuild (D11a), no disposal or close (D6). `TradeAnalysis.derive` from D3 is reused unchanged. A Calculation Result is never replaced by fill cost, zero, Stale context, or a fabricated value.

## Structural tasks

### D4-S1 — Capability manifest update
Add to the D4 Installed Capability Manifest: `MarketData.save`, `MarketData.query(ResolveFrames)`, `TradeAnalysis.evaluate`, `TradeViewsAndReporting.browseTrades(Evaluated)`, `TradeViewsAndReporting.getTradeDetail(Evaluated)`. Navigation stays `Accounts`, `Status`, `New Plan`, `Trades`; no Mark-as-operation nav, Review, Report, Backup, Restore or close control appears.
**Verification:** `npx vitest run tests/structural/d4-capability-manifest.test.ts` asserts the exact set, that D1–D3 capabilities remain, and that later capabilities are absent.

### D4-S2 — Durable market representation
Use schema v2's existing `market` store: one record per exact Instrument + Trading Date holding immutable Mark versions (price, source, intention/classification, observation time, save time), acknowledgment versions (reason, time, no price), effective resolution revision, and a session-policy revision seed. No schema version bump and no provider credential storage.
**Verification:** `npx vitest run tests/structural/d4-durable-representation.test.ts` opens the real store, saves a Mark and an acknowledgment, reopens, and asserts revision chains and that no price is stored for the acknowledgment.

### D4-S3 — Session policy and explicit gaps
Reuse the injected clock and U.S. calendar: Expected Mark Date is the latest completed regular session; completed-session ranges enumerate sessions and emit explicit gaps, never interpolation or carry-forward.
**Verification:** `npx vitest run tests/structural/clock-calendar.test.ts tests/structural/d4-session-gaps.test.ts` asserts a noon-Tuesday/Monday case, a weekend gap, and a stable session-policy revision.

### D4-S4 — Calculation Result vocabulary
Introduce one stable `CalculationResult<T> = Value | Unbounded | Unavailable | NotApplicable` with stable reason codes and structured details; each independently useful calculation gets its own result. No nullable number or zero fallback.
**Verification:** `npx vitest run tests/structural/d4-calculation-result.test.ts` asserts the closed union and reason-code stability.

## Behaviour-bearing tasks

Each implemented test-first; RED (behaviour absent, not a fixture error) then smallest GREEN, earlier tests kept green.

### D4-T1 — `MarketData.save` and resolution precedence
**Seam:** `saveMark(command, current) -> SaveMarkResult` and `resolveKey(record, expectedDate, now)`.
- `describe("MarketData.save and resolution")`
  - `it should record an initial Manual Mark as Available at its exact date and return a revision-bound post-commit result`
  - `it should record a deliberate Manual override and a reasoned correction as distinct saved intentions in the revision chain`
  - `it should assert an unavailable acknowledgment with a reason and no price, and withdraw a mistaken acknowledgment`
  - `it should keep an effective Manual Mark sticky against a later provider close while retaining an independent Daily Bar`
  - `it should make a later exact Mark Available while the earlier acknowledgment stays in history`
  - `it should reject a stale resolution revision with typed issues and no write`
- **Red/green:** `npx vitest run tests/unit/market-data.test.ts -t "<case>"`.
- **Integration:** `tests/integration/market-data.test.ts` uses real persistence and `fake-indexeddb` (disclosed); saves, reopens, checks revision chains and no-write comparisons.
- **Critic flow:** enter a Manual Mark, then an unavailable acknowledgment; `B(mark-entry)`.

### D4-T2 — `MarketData.query(ResolveFrames)`
**Seam:** `resolveFrames(query, records, now) -> FrameResult`.
- `describe("ResolveFrames")`
  - `it should report the latest completed session as Available, not Stale, at noon Tuesday after a normal Monday session`
  - `it should report Missing or Acknowledged Unavailable with optional older Stale context and never use it as a value`
  - `it should enumerate completed sessions with explicit gaps and no interpolation or fabricated candle`
  - `it should bind frames to a snapshot id and evidence digest that changes when evidence changes`
- **Red/green:** `npx vitest run tests/unit/market-frames.test.ts -t "<case>"`.
- **Integration:** `tests/integration/market-frames.test.ts` reads frames after a persisted save and restart.
- **Critic flow:** the Open detail shows the Expected Mark Date and its Available/Missing/Acknowledged Unavailable status; `B(expected-mark)`.

### D4-T3 — `TradeAnalysis.evaluate`
**Seam:** `evaluate(state, frame) -> TradeEvaluation`.
- `describe("evaluate — Long Stock")`
  - `it should keep realized-to-date a Value when the expected Mark is Missing and return Unavailable only for mark-dependent figures`
  - `it should compute marked P&L, ongoing risk to Stop, incremental reward, Plan-R conversions and Overrun from one exact frame with decimal arithmetic`
  - `it should keep Stop and Target conditions independent under OR semantics and never classify a Target or revision as a Deviation`
  - `it should keep 1R and the frozen Plan Baseline unchanged while current risk uses the remaining Position`
  - `it should return stable Unavailable reasons naming Instrument and date with no fill-cost, zero or Stale substitution`
- **Red/green:** `npx vitest run tests/unit/evaluate.test.ts -t "<case>"`.
- **Integration:** `tests/integration/evaluate.test.ts` composes a D3-derived Open Trade with a persisted frame.
- **Critic flow:** Open detail shows Value and Unavailable figures distinctly, with condition cards and a disclosed Overrun; `B(evaluated-detail)`.

### D4-T4 — Atomic market persistence and write gate
**Seam:** `saveManualMark(request, db)` in the UI/seam controller.
- `describe("Market persistence")`
  - `it should commit the resolution revision and history in one transaction and survive restart`
  - `it should return RuntimeNotWritable and change nothing when readiness is not Writable`
  - `it should produce a post-commit result equal to durable state without a follow-up read`
- **Red/green:** `npx vitest run tests/integration/market-data.test.ts -t "<case>"`.
- **Critic flow:** a rejected stale/stale-readiness attempt leaves the displayed figures unchanged; `B(mark-validation)`.

### D4-T5 — Production UI: Mark entry and evaluated Open views
**Seam:** production React UI driven through `playwright-cli` and `@playwright/test`.
- `describe("Marks and Risk/Reward UI")`
  - `it should let the trader enter a Manual Mark or acknowledge unavailability for the Expected Mark Date`
  - `it should show Available, Missing and Acknowledged Unavailable distinctly with exact Instrument/date and Stale as context only`
  - `it should show realized-to-date, marked P&L, ongoing risk/reward, condition cards and Overrun with tabular numerals and no close control`
  - `it should keep 1R unchanged after entering a Mark and preserve entered-but-unsaved values across a live resize`
- **Red/green:** `npx playwright test -g "<case>"`.
- **Critic flow:** all four cases against `http://localhost:5182`; `B(detail-*)`.

## Evidence to capture for D4
- Per-case RED/GREEN commands and outcomes; structural outputs; cumulative suites; fresh-critic structured report per `B(...)`.
- Exact clock/Workspace time zone/session assumptions, Instrument, dates, revisions, source/intention classifications and evidence digests retained in records.
- Acceptance map: AC-MARK-001 full, AC-MARK-002 full, AC-MARK-003 full, AC-CALC-001 full, AC-CALC-002 full, AC-CALC-003 full, AC-DEL-001 full for installed manual workflows, AC-MARK-004 partial (frames/gaps only; replay in D8a).
- Restart/read-back and no-write comparisons for every typed failure; offline cold-restart browser evidence for the installed manual workflow (loopback, DEV-001).

## Parallelism and ownership
S1–S4 fixed before UI work. T1/T2/T3 parallel once the frame and result contracts are fixed; T4 depends on T1/T2; T5 depends on T3/T4. Single-owner resources: capability manifest (S1), market store and session-policy revision (D4 owns), `TradeAnalysis.evaluate` and Calculation Result vocabulary (D4 owns; later steps reuse unchanged).
