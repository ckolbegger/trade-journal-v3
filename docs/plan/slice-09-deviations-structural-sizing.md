# Slice 9 — Deviations: structural & sizing

The app starts noticing when trading departs from the Plan: a Leg no Planned Leg covers (structural), or quantity beyond plan (sizing) — detected the moment the triggering Execution is saved, recorded immutably, surfaced as flags, acknowledgeable and journal-linkable (ADR 0012). A Deviation is a fact, not a scolding — it may be a good decision.

**Decided in this slice — planned-leg matching:** an actual Leg is covered by a Planned Leg when instrument kind, side, and (for options) underlying match, and strike/expiration match exactly or the planned value is TBD. Each Planned Leg covers one Leg (first match by fill order); sizing compares the covered Leg's cumulative opened quantity against the Planned Leg's.

**Out of scope (JIT):** discipline Deviations (Slice 10 — `detectDeviations`' `series` parameter stays unused and unadded), Plan Revisions as the response to a flag (Slice 11 — here the trader acknowledges or journals), correction-driven re-detection (Slice 12).

Design references: ADR 0012, [tradebook.md](../design/tradebook.md) (inline detection, dedup, ExecutionOutcome), [trademath.md](../design/trademath.md) (`DetectedDeviation`).

**Worked examples used throughout:**
Plan: Long Stock, buy 100 AAPL. (a) Fill buy **150** → sizing Deviation (planned 100, actual 150). (b) Later fill sell 1 unplanned call → structural Deviation on the call Leg. (c) A second call fill on the same Leg → **no** new Deviation (dedup: once per Leg × type).

---

## ☐ Story S9.1 — Detection at the moment of saving

> As a trader, I want a fill that departs from my Plan to be flagged the instant I record it, so that the departure is a fact captured at its moment — whether it was a mistake or a judgment call.

**Deep interfaces**: `TradeMath.detectDeviations(trade)` (pure — structure + sizing), `TradeBook.recordExecution` runs detection inline in the same transaction and records new Deviations (TradeBook → TradeMath is a sanctioned call, [overview.md](../design/overview.md)), `TradeBook.recordDeviations` (dedup, silently drops re-detections), `ExecutionOutcome.newDeviations` populated at last.

### Tasks

- [ ] **S9.1.T1 — TradeMath.detectDeviations.**

  ```
  describe "TradeMath.detectDeviations (structure)"
  - it detects a Leg no Planned Leg covers (the unplanned call)
  - it detects nothing when every Leg is covered
  - it treats a TBD-strike Planned Leg as covering the eventual fill (Slice 7 covered call)
  - it does not double-cover: two actual call Legs against one planned call flags the second
  describe "TradeMath.detectDeviations (sizing)"
  - it detects opened quantity beyond plan (150 vs 100) with both quantities
  - it does not flag under-sized entries (50 vs 100 is legging in, not a Deviation)
  - it does not flag closing quantity (scaling out is exit, not size beyond plan)
  - it is pure: identical inputs, identical detections, no clock
  ```

- [ ] **S9.1.T2 — Inline recording + dedup.**

  ```
  describe "TradeBook.recordExecution (detection)"
  - it persists the Execution and its detections in one transaction
  - it returns new Deviations in ExecutionOutcome
  - it records at most one Deviation per (Leg, type) — the second oversized fill adds none
  - it stores detectedAt and the triggering executionId on the record
  describe "TradeBook.recordDeviations"
  - it silently drops already-recorded (Leg, type) detections
  ```

- [ ] **S9.1.T3 — Integration tests**: worked example (a)+(b)+(c) over Dexie → reopen → exactly two recorded Deviations with correct types, legs, quantities; recorded Deviations immutable (no operation alters detection facts).
- [ ] **S9.1.T4 — Playwright e2e** (`e2e/s9-1-detection.spec.ts`): record the oversized fill → the outcome surfaces a sizing flag naming 150 vs 100.
- [ ] **S9.1.T5 — Browser verification.** Record fills (a), (b), (c) in a real browser: flags appear at save for (a) and (b), nothing for (c); reload — the Deviations persist as facts. All suites green.

---

## ☐ Story S9.2 — Living with the flags

> As a trader, I want my Trade to show its departures until I've consciously acknowledged or written about them, so that my adherence record is built from decisions, not from what I happened to remember.

**Deep interfaces**: `Valuations.detail` bundle gains recorded Deviations (read-only here — the write-on-surface behavior belongs to discipline detection, Slice 10), `TradeBook.acknowledgeDeviation(id, note?)`, Journal anchor `{kind: 'deviation', tradeId, deviationId}` (ADR 0012's "journal-linkable"), flags at the review-walk checkpoint ([review.md](../design/review.md)).

### Tasks

- [ ] **S9.2.T1 — Acknowledge + anchor.**

  ```
  describe "TradeBook.acknowledgeDeviation"
  - it marks a Deviation acknowledged with optional note and timestamp
  - it never removes the Deviation (adherence history is immutable)
  - it rejects acknowledging twice
  describe "Journal (deviation anchor)"
  - it writes an entry anchored {kind:'deviation'} carrying tradeId
  - it returns deviation-anchored entries in entriesFor({trade}) and the timeline
  ```

- [ ] **S9.2.T2 — Flags UI.** Trade detail shows a Deviations section: type, what departed ("sold 1 Sep'26 55C — not in plan"; "sized 150 vs planned 100"), when, acknowledged state; actions **acknowledge** (with note) and **write about it** (deviation-anchored entry). The review-walk checkpoint surfaces unacknowledged flags before the Action prompt. Unacknowledged flags persist — visible, never modal.

  ```
  describe "DeviationFlags"
  - it lists Deviations with plain-language description and state
  - it acknowledges with a note and shows the note
  - it opens a deviation-anchored journal entry from the flag
  - it keeps the flag visible (acknowledged style) after acknowledgment
  describe "Walk checkpoint (deviations)"
  - it surfaces unacknowledged Deviations before the Action prompt
  - it never blocks recording the Action
  ```

- [ ] **S9.2.T3 — Integration tests**: detect → acknowledge one, journal the other over Dexie → reopen → states and the entry persist; walk shows only unacknowledged.
- [ ] **S9.2.T4 — Playwright e2e** (`e2e/s9-2-flags.spec.ts`): oversized-fill Trade → walk surfaces the flag → acknowledge with note → flag styled acknowledged, Action recorded.
- [ ] **S9.2.T5 — Browser verification.** In a real browser: both flags from S9.1 visible on detail; acknowledge one, write an entry against the other; verify the entry appears on the trade's journal and the timeline; next walk surfaces neither as pending. All suites green.
