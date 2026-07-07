# Slice 11 — Plan Revisions

Deliberate changes of intent get their paperwork: a dated Revision can replace the Exit Levels going forward and add intended structure — while the original Plan stays untouched, Deviation detection keeps measuring against it, and the timestamps make adaptation vs rationalization visible forever (ADR 0003, 0012).

**Out of scope (JIT):** replay's knowledge-as-of-date handling of revisions (Slice 15 tests it where replay exists); Corrections (Slice 12).

Design references: ADR 0003, ADR 0012, [tradebook.md](../design/tradebook.md) (`PlanRevisionDraft`, revision sequence), [journal.md](../design/journal.md) (`{kind:'revision'}` anchor).

---

## ☐ Story S11.1 — Revising Exit Levels

> As a trader, I want to move my stop or target with a dated, reasoned amendment, so that re-planning is honest paperwork on top of the original — never a quiet rewrite of it.

**Deep interfaces**: `TradeBook.revisePlan(tradeId, revision)` (`date`, `reason` — the honest one-liner, `exitLevelChanges` replacing the current set going forward, `chartLink?`), current levels = original overlaid by revisions; Journal anchor `{kind:'revision', tradeId, revisionId}` (required-but-non-blocking, ADR 0006); seed: Entry Type **Revision**.

**Seed content — Entry Type "Revision"** (`designatedFor: 'revision'`): What changed in the market or the thesis? (text) · Is this adapting or rationalizing? (select: adapting / rationalizing / honestly-unsure) · Conviction now (scale 1–5).

### Tasks

- [ ] **S11.1.T1 — revisePlan + overlay.**

  ```
  describe "TradeBook.revisePlan"
  - it appends a dated Revision with reason, leaving plan byte-identical
  - it rejects a revision without a reason
  - it rejects revising a closed Trade
  - it stores multiple revisions in date order
  describe "current Exit Levels (overlay)"
  - it serves original levels before any revision
  - it serves the replaced set after a revision
  - it serves the latest set after two revisions
  describe "TradeMath.riskReward (revised)"
  - it anchors plannedRisk/plannedReward on the revised levels
  - it keeps RiskReward.original computed from the ORIGINAL plan's levels
  describe "TradeMath.detectDeviations (revised levels)"
  - it detects discipline crossings against the levels effective on each marked date
  - it does not flag a crossing of a stop that a prior revision had already replaced
  ```

- [ ] **S11.1.T2 — Revision flow UI.** "Revise plan" on an open Trade's detail: shows current levels, takes new levels + reason + optional chart link; then the Revision entry form (write or skip → placeholder — Journal Debt). Detail renders the plan as original + dated revision history; dashboard anchors read the revised levels, with `original` contrast unchanged.

  ```
  describe "ReviseFlow"
  - it submits PlanRevisionDraft and writes the revision entry (or placeholder)
  - it renders the revision history with dates and reasons under the original Plan
  - it never offers editing of the original Plan or a past revision
  describe "TradeDashboard (revised)"
  - it shows planned anchors from revised levels and original contrast side by side
  ```

- [ ] **S11.1.T3 — Integration tests**: open Trade → revise stop 140→145 over Dexie → reopen → overlay correct, R/R anchors moved, original contrast unmoved, revision entry anchored; a pre-revision crossing of 145 (when the stop was 140) records nothing.
- [ ] **S11.1.T4 — Playwright e2e** (`e2e/s11-1-revise.spec.ts`): revise the worked stock Trade's stop → dashboard shows new planned risk, history shows the dated reason.
- [ ] **S11.1.T5 — Browser verification.** Real browser: revise a stop, verify anchors move while the original pair stays for contrast, the revision entry lands on the Trade's journal, and no surface allows touching the original Plan. All suites green.

---

## ☐ Story S11.2 — Revising structure (the deviation-driven case)

> As a trader, I want to document that my campaign legitimately changed shape — this is a covered call now — so that the departure stays on my adherence record while my go-forward intent is honest paperwork.

**Deep interfaces**: `PlanRevisionDraft.addedPlannedLegs`, the [tradebook.md](../design/tradebook.md) revision sequence: Execution → structural flag → revise → `acknowledgeDeviation("revised into covered call")`; baseline stays the ORIGINAL Plan (ADR 0012) with the (Leg, type) dedup doing the not-nagging.

### Tasks

- [ ] **S11.2.T1 — Structure revisions.**

  ```
  describe "revisePlan (addedPlannedLegs)"
  - it appends intended legs without touching original plannedLegs
  describe "detection baseline after structure revision"
  - it keeps the recorded structural Deviation (never deleted by revision)
  - it does not re-flag further fills on the same revised-in Leg (dedup, not baseline change)
  - it flags a NEW unplanned Leg after the revision (baseline is still the original Plan)
  - it keeps sizing comparisons against original planned quantities
  describe "timestamps (adaptation vs rationalization)"
  - it orders revision-then-execution as documented-before (adaptation reads from timestamps)
  - it orders execution-then-revision as documented-after (rationalization visible)
  ```

- [ ] **S11.2.T2 — Flag-to-revision UI.** A structural Deviation flag (S9.2) gains **revise the Plan**: pre-fills the flagged Leg as an added Planned Leg, takes reason + optional new levels, acknowledges the Deviation with the revision's reason on completion. The Deviation stays on the record, acknowledged, linked in history next to the dated Revision.

  ```
  describe "FlagToRevision"
  - it opens the revise flow from a structural flag with the leg pre-filled
  - it acknowledges the Deviation on completion with the linked note
  - it leaves the Deviation visible in history alongside the revision
  ```

- [ ] **S11.2.T3 — Integration tests**: the full [tradebook.md](../design/tradebook.md) sequence over Dexie — long stock plan → sell call (flag) → revise into covered call → acknowledge → later: sell another call same Leg (no flag), buy an unplanned put (new flag).
- [ ] **S11.2.T4 — Playwright e2e** (`e2e/s11-2-structure-revision.spec.ts`): the covered-call adoption path end-to-end from flag to acknowledged history.
- [ ] **S11.2.T5 — Browser verification.** Drive the sequence in a real browser; verify the Trade tells the whole story afterward — original plan, dated departure, dated revision with reason, acknowledged flag — and that the timestamps read execute-then-revise. All suites green.
