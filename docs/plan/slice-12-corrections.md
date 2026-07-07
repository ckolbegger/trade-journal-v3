# Slice 12 — Corrections

Typos stop being permanent: `correctExecution` patches price/qty/date/fees with the prior values kept as an audit trail, `voidExecution` removes a fill the same way, detection re-runs against the corrected facts, and derived status ripples honestly — a correction can flatten a Trade or reopen a closed one, and the outcome says which (ADR 0005; [tradebook.md](../design/tradebook.md) correction sequence). Plans are never correctable — their immutability is the product.

**Out of scope (JIT):** corrections inside rolled/transferred structures (Slice 16 extends the tests where Transfers exist).

Design references: [tradebook.md](../design/tradebook.md) (corrections are edits with history; the ripple), ADR 0005, 0012.

**Worked examples used throughout:**
(a) The design's typo: buy recorded 1.84, actually 1.48 → P&L, R/R, basis all re-derive; nothing stored was stale.
(b) Sizing repair: plan 100, fill recorded 150 (sizing Deviation, Slice 9) → corrected to 100 → the Deviation is no longer supported → **annotated**, never deleted.
(c) Status ripple: closed stock Trade; void the flattening sell → Trade reopens, Close Reason cleared into the audit trail; later correcting a buy's qty from 100 to 80 (with an 80-share sell existing) → flattens → Close Reason prompt.

---

## ☐ Story S12.1 — Correcting an Execution

> As a trader, I want to fix a fat-fingered fill and see every number heal, so that data-entry errors don't poison my P&L — while the audit trail keeps me honest about what changed.

**Deep interfaces**: `TradeBook.correctExecution(executionId, patch, note?)` → `CorrectionOutcome` (`record`, `newDeviations`, `annotatedDeviations`, `statusChange?`); one transaction: patch + audit + re-detection + annotation ([tradebook.md](../design/tradebook.md): corrections re-run detection and annotate, never delete).

### Tasks

- [ ] **S12.1.T1 — correctExecution.**

  ```
  describe "TradeBook.correctExecution"
  - it patches price and keeps the prior value, timestamp, and note in the audit trail
  - it patches qty, date, and fees the same way
  - it stacks a second correction's trail on the first
  - it rejects an unknown executionId and an empty patch
  - it commits patch, re-detection, and annotations in one transaction
  describe "derivation after correction (worked example a)"
  - it re-derives valuation from 1.48 with nothing stale (P&L, basis, R/R)
  - it re-derives FIFO realized P&L when a corrected qty changes lot consumption
  describe "re-detection (worked example b)"
  - it annotates the sizing Deviation the corrected facts no longer support
  - it keeps the annotated Deviation on the record, marked, never deleted
  - it records a NEW Deviation when a correction creates one (qty corrected upward past plan)
  - it does not duplicate a still-supported Deviation (dedup applies)
  describe "journal anchors"
  - it keeps entries anchored to a corrected Execution (the writing happened)
  ```

- [ ] **S12.1.T2 — UI.** Execution history rows gain **correct** (fields + note); corrected rows show current values with a visible audit trail ("was 1.84 — corrected Jul 12: fat finger"); every dependent number on the page re-renders. No UI exists to edit a Plan, ever.

  ```
  describe "CorrectExecutionUI"
  - it patches via the form and re-renders valuation and R/R
  - it renders the audit trail on the corrected row
  - it shows an annotated Deviation as no-longer-supported with its history
  ```

- [ ] **S12.1.T3 — Integration tests**: worked examples (a) and (b) over Dexie with reopen — trail persists, numbers heal, annotation state survives.
- [ ] **S12.1.T4 — Playwright e2e** (`e2e/s12-1-correct.spec.ts`): 1.84→1.48 fix → dashboard numbers change to hand-computed values; trail visible.
- [ ] **S12.1.T5 — Browser verification.** Real browser: both worked examples; verify P&L/R/R/basis against hand-computed numbers, the trail's wording, and the annotated flag's rendering. All suites green.

---

## ☐ Story S12.2 — Voiding & the status ripple

> As a trader, I want to remove a fill that never happened and have the Trade's status follow the corrected truth, so that a phantom Execution can't hold a Trade closed — or open — contrary to fact.

**Deep interfaces**: `TradeBook.voidExecution(executionId, note)` (note required — removal demands a reason), `CorrectionOutcome.statusChange` driving the UI: reopen clears the Close Reason into the audit trail (it described a close that no longer exists); flattening prompts Close Reason like any flattening fill.

### Tasks

- [ ] **S12.2.T1 — voidExecution + ripple.**

  ```
  describe "TradeBook.voidExecution"
  - it excludes the voided Execution from all derivation
  - it keeps the voided record visible in the audit trail with its note
  - it rejects a void without a note
  - it keeps journal entries anchored to the voided Execution
  describe "status ripple (worked example c)"
  - it reports statusChange closed→open when voiding the flattening sell
  - it clears the Close Reason into the audit trail on reopen
  - it reports statusChange open→closed when a correction flattens the Trade
  - it reports no statusChange when derivation lands where it was
  describe "reopened Trade"
  - it reappears in the review walk and marksNeeded
  ```

- [ ] **S12.2.T2 — UI.** **Void** on execution rows (note required, confirm names the consequence); on reopen the detail shows open with the cleared reason in the trail; on flatten the standard Close Reason + close entry flow fires (`statusChange` tells the UI which case it's in).

  ```
  describe "VoidExecutionUI"
  - it requires the note and a confirmation naming the status consequence
  - it renders the voided row struck-through with its note
  - it prompts Close Reason when the void flattens the Trade
  - it shows the reopened Trade without a Close Reason
  ```

- [ ] **S12.2.T3 — Integration tests**: worked example (c) both directions over Dexie with reopen — reopened Trade walks in review; flattened one carries its new Close Reason; trails intact.
- [ ] **S12.2.T4 — Playwright e2e** (`e2e/s12-2-void.spec.ts`): void the flattening sell → Trade reads open, reason in trail; next review includes it.
- [ ] **S12.2.T5 — Browser verification.** Real browser: reopen a closed Trade by voiding its exit, confirm it rejoins the walk and its Close Reason moved to the trail; then flatten via a qty correction and complete the prompted close flow. All suites green.
