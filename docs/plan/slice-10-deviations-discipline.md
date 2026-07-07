# Slice 10 — Deviations: discipline

The third Deviation kind: the Marks crossed a planned stop or target and the trader did nothing. Detected from Mark history, recorded the first time the Trade's detail surfaces it (surfacing IS the recording trigger — ADR 0012, [trade-detail-sequence.md](../design/trade-detail-sequence.md) ruling 3), deduped per crossing episode. This slice also introduces the Exit Level machinery that only discipline consumes: leg-scope levels and trailing stops.

**Decided in this slice:**

- **Crossing** = a date whose Marks put the scoped value at or beyond the level (stop: at/below for long-shaped scopes, at/beyond against the position's favor generally — the sign comes from the structure; target: at/beyond in its favor). `underlyingPrice` levels compare the underlying's Mark; `structureValue` compares the scoped structure's signed value at that date's Marks; `pctOfMaxProfit` resolves to a structure value (credit × (1 − pct/100)) first.
- **Episode** ([tradebook.md](../design/tradebook.md)): consecutive crossed *marked* days are one episode; a new episode begins when the prior marked day was not crossed. Dedup key: (Exit Level, episode's first crossed date).
- Detection only considers dates the scope actually held quantity.
- `Valuations.disciplineCheck` from the overview sketch is **not built** (JIT): the walk surfaces discipline through `detail()`; nothing else needs a separate operation yet.

**Out of scope (JIT):** intraday highs for trailing (closes only until Daily Bars — Slice 17), Plan Revisions as the response (Slice 11).

Design references: ADR 0012, [trademath.md](../design/trademath.md) (trailing high-water), [tradebook.md](../design/tradebook.md) (episode dedup), CONTEXT.md (Exit Level).

**Worked examples used throughout:**

*Episodes* — long stock, underlyingPrice stop 140. Marks: Mon 141, Tue 139, Wed 138, Thu 142, Fri 139 → **two** Deviations: episode 1 crossedOn Tue (Wed continues it), episode 2 crossedOn Fri (Thu was not crossed).

*Leg-scope target* — covered call's short leg sold at 1.50, leg-scope pctOfMaxProfit target 80% → buyback level 0.30. Call marked 0.25 with no action → discipline Deviation on that Leg.

*Trailing* — long 100 shares, trailing stop offset $5.00. Closes 150, 155, 160, 158, 154 → high-water 160, trail level 155 → crossed on the 154 day. plannedRisk at mark 154 reads −$100 (the trail is above the mark: a locked-in floor, displayed as such).

---

## ☐ Story S10.1 — Stop/target crossings

> As a trader, I want the app to remember every day my plan said act and I didn't, so that my discipline record is built from the Marks, not from my memory of them.

**Deep interfaces**: `TradeMath.detectDeviations(trade, series)` — the `series` parameter arrives now (deferred from Slice 9); `Valuations.detail` records newly surfaced discipline Deviations (the deliberate write-on-read); episode dedup in `TradeBook.recordDeviations`; flags reuse S9.2's UI and acknowledge/journal paths.

### Tasks

- [ ] **S10.1.T1 — Detection.**

  ```
  describe "TradeMath.detectDeviations (discipline)"
  - it detects the two worked-example episodes with their crossedOn dates
  - it treats consecutive crossed marked days as one episode
  - it detects a target crossing (marks beyond target, no action) symmetrically
  - it resolves pctOfMaxProfit to its structure value before comparing
  - it compares structureValue levels against the scoped signed value
  - it ignores dates before the position existed and after it was flat
  - it skips gap dates (no Mark, no judgment — gaps are gaps)
  - it detects nothing without the series argument (structure/sizing behavior unchanged)
  ```

- [ ] **S10.1.T2 — Record on surfacing.**

  ```
  describe "Valuations.detail (discipline recording)"
  - it records newly detected discipline Deviations during detail()
  - it returns them in the bundle as recorded flags
  - it records an episode once across repeated detail() calls (dedup)
  - it records a re-crossing after recovery as a new Deviation (episode 2)
  describe "TradeBook.recordDeviations (episode dedup)"
  - it drops a detection whose (level, episode start) is already recorded
  ```

- [ ] **S10.1.T3 — UI.** Discipline flags render in S9.2's Deviations section with the crossing story ("stop 140 crossed Tue 139 — no action"); the walk surfaces them at the checkpoint like structural flags; acknowledging or journaling works unchanged.
- [ ] **S10.1.T4 — Integration tests**: worked-example week over Dexie — walk Wednesday records episode 1; walk Friday records episode 2 only; acknowledged episode 1 stays acknowledged.
- [ ] **S10.1.T5 — Playwright e2e** (`e2e/s10-1-discipline.spec.ts`): seeded crossed-stop scenario → open detail → flag appears with the crossing date.
- [ ] **S10.1.T6 — Browser verification.** Real browser: enter the worked-example Marks day by day via reviews, watching the flag appear the day the stop is crossed and a second flag after the recovery-and-recross; verify "what was I shown, when" — the recorded detectedAt matches the day detail surfaced it. All suites green.

---

## ☐ Story S10.2 — Leg-scope Exit Levels

> As a trader, I want to plan per-leg rules like "buy back the short call at 20% of its credit," so that management intentions on one leg have the same standing as trade-level stops.

**Deep interfaces**: `ExitLevel.scope = {level:'leg', legId}` (deferred from Slice 7), plan-form custom Exit Levels beyond the template's asks, leg-scope discipline detection; trade-scope R/R anchors explicitly ignore leg-scope levels ([CONTEXT](../CONTEXT.md): trade-scope anchors R/R; leg-scope drives alerts and discipline).

### Tasks

- [ ] **S10.2.T1 — Leg scope.**

  ```
  describe "ExitLevel (leg scope)"
  - it evaluates a leg-scope level against that Leg's signed value only
  - it detects the worked-example short-call target (0.25 vs 0.30 buyback level)
  - it contributes nothing to plannedRisk / plannedReward (trade-scope only)
  describe "PlanForm (custom levels)"
  - it adds a leg-scope level bound to a Planned Leg
  - it carries leg-scope levels through confirm onto the record
  ```

- [ ] **S10.2.T2 — Alert display.** Detail and the walk checkpoint show a leg-scope crossing as a management alert with its discipline flag ("short call at 0.25 — plan says buy back at 0.30").
- [ ] **S10.2.T3 — Integration tests**: covered call with the worked leg target over Dexie → marks cross → walk surfaces the alert + Deviation; trade-scope R/R numbers unchanged by the leg level's existence.
- [ ] **S10.2.T4 — Playwright e2e** (`e2e/s10-2-leg-levels.spec.ts`): plan with the leg target → crossing marks → alert visible at the checkpoint.
- [ ] **S10.2.T5 — Browser verification.** Real browser: plan the covered call with the leg-scope target, mark the call below the level, confirm the alert and flag; confirm the four R/R numbers ignore it. All suites green.

---

## ☐ Story S10.3 — Trailing stops

> As a trader, I want a stop that follows my Trade's high-water mark, so that "don't give back more than $5 of the best it's been" is a plan the app can hold me to.

**Deep interfaces**: `ExitLevel` kind `'trailing'` (offset absolute or %), high-water derivation from `MarkSeries` — running max of the scoped structure's *signed daily* value, shorts negative, same-day sums only, never stored (ADR 0012); `plannedRisk` resolves the trailing level from series; discipline detects trailing crossings.

### Tasks

- [ ] **S10.3.T1 — High-water + resolution.**

  ```
  describe "TradeMath trailing resolution"
  - it derives the worked-example trail: high-water 160 → level 155
  - it sums same-day Marks only (per-leg extremes from different days never combine)
  - it contributes shorts negatively to the daily signed value
  - it supports a percentage offset (high-water minus pct)
  - it derives from history alone — recomputing from the series reproduces it
  describe "TradeMath.riskReward (trailing)"
  - it resolves plannedRisk to the trailing level (−100.00 at mark 154 — a locked floor)
  describe "TradeMath.detectDeviations (trailing)"
  - it detects the crossing on the 154 day
  - it starts episodes fresh as the trail ratchets (a new high resets nothing retroactively)
  ```

- [ ] **S10.3.T2 — UI.** Plan form offers trailing (offset $ or %) for trade scope; dashboard shows the current resolved trail level and its high-water ("trail 155.00 · high 160.00"); the locked-floor case renders as protected gain, not negative risk jargon.
- [ ] **S10.3.T3 — Integration tests**: worked example over Dexie entered across five review days → trail level displayed each day matches hand-computed; crossing day records the Deviation; export/reimport (Slice 6) reproduces identical trail (derived, never stored).
- [ ] **S10.3.T4 — Playwright e2e** (`e2e/s10-3-trailing.spec.ts`): five-day scenario → trail level and crossing flag assert.
- [ ] **S10.3.T5 — Browser verification.** Real browser: watch the trail ratchet up across daily marks and hold on the down days; verify the crossing flag on the 154 day and the protected-gain display. All suites green.
