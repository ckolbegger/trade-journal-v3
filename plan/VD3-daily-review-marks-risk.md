# VD3 — Daily Review, Manual Marks, and live risk display for stock

**Status:** Not started
**Depends on:** VD2
**Frozen scope:** `implementation-plan.md` §4 VD3

This is a living working document: progress, red/green evidence, and critic results are recorded here. Scope changes require plan-deviation approval per `KICKOFF.md`.

## Progress

| Task | Description | Status | Evidence |
|---|---|---|---|
| T3.1 | Observation model, Manual precedence, acknowledgments | ☐ pending | — |
| T3.2 | Frames and `ExpectedSnapshot` | ☐ pending | — |
| T3.3 | `evaluate` — stock scope | ☐ pending | — |
| T3.4 | Stop-Discipline episodes — single instrument over exact Marks | ☐ pending | — |
| T3.5 | Daily Review coordinator — stock scope | ☐ pending | — |
| T3.6 | UI: review walk, Mark entry, risk panels | ☐ pending | — |
| T3.7 | Integration cases | ☐ pending | — |
| Gate | Cumulative suites + browser critic | ☐ pending | — |

---

## T3.1 Observation model, Manual precedence, acknowledgments
Seam: `src/modules/marketData.save` + resolution logic over fake-indexeddb.

```text
describe("mark resolution precedence")
  it should resolve Available whenever an exact-date Mark exists, even when
      acknowledgment history also exists for that key
  it should resolve AcknowledgedUnavailable only when no exact Mark exists, and keep
      the acknowledgment visible in history after a later Mark supersedes its status
  it should resolve Missing with at most a Stale context older than the Expected
      Mark Date, and never fill an exact-date slot with a Bar close, fill cost, or
      carried value
  it should set the Expected Mark Date to the latest completed regular session,
      so Monday evidence is Available (not Stale) during Tuesday's session

describe("manual saves")
  it should make a Manual Mark effective and sticky, recording initial-entry, deliberate
      override, and believed-wrong correction as distinct saved intentions with audit
      classification
  it should refuse an acknowledgment when an exact Mark already exists for the key
  it should allow visibly withdrawing a mistaken acknowledgment
  it should return the complete effective resolution and new revision for every directly
      changed key in the save result without a follow-up query
```

## T3.2 Frames and `ExpectedSnapshot`
Seam: `src/modules/marketData.query` (`ResolveFrames`).

```text
describe("resolve frames")
  it should bind each frame to its normalized request, selected evidence revisions,
      stale-context revisions, and material absences via an opaque snapshot id
      and evidence digest
  it should return SnapshotChanged with current frames — never blessing stale
      reconciliation — when any Mark, Bar, acknowledgment, or material absence changed
  it should return SnapshotUnchanged for an identical recheck, enabling the
      transaction-time check Daily Review uses at Save
  it should expose Candidate Manual Mark frames as visibly hypothetical evidence
      that never counts as committed
```

## T3.3 `evaluate` — stock scope
Seam: `src/domain/tradeAnalysis.evaluate` (pure).

```text
describe("stock evaluation")
  it should compute marked remaining-open P&L, Current Marked Trade P&L components,
      Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental Reward to Target,
      and Maximum Incremental Reward from remaining exposure, effective management,
      and exact-date eligible Marks only
  it should keep realized-to-date P&L a Value while returning affected marked/risk/
      reward results as Unavailable carrying the exact Instrument and date
  it should retain every Stop and Target condition's independent OR status and detail
      beside the nearest-monetary-boundary headline
  it should produce a zero headline with a disclosed nonnegative Overrun (dollars and
      Plan-R where available) when a boundary is crossed, without changing Position
      or Lifecycle State
  it should convert to Plan-R only where the frozen 1R supports it, keeping dollar
      results visible independently
  it should treat a stale observation as displayed context only, never as valuation
      evidence
```

## T3.4 Stop-Discipline episodes — single instrument over exact Marks
Seam: `src/domain/tradeAnalysis.replay` episode derivation (pure).

```text
describe("stop discipline episodes")
  it should begin an episode at the first exact observation demonstrating breach after
      condition activation or an observed unbreached state
  it should end an episode only at an exact unbreached observation or condition
      replacement/retirement
  it should interpret a preceding gap as "first observed," never fabricating a crossing
      date
  it should emit stable episode fingerprints that enable create/retain/supersede/Void
      reconciliation without one duplicate fact per observed date
  it should return one occurrence per continuous breach regardless of how many
      observations fall inside it
```

## T3.5 Daily Review coordinator — stock scope
Seam: `src/modules/dailyReview` (`open`, `getTrade`, `getDebt`, `save`) over the real module graph.

```text
describe("open")
  it should resolve the Review Date and cutoff from the request and session calendar
  it should select Trades whose corrected facts place them Open at the exact cutoff
      via StateAtEconomicCutoff — not current-Open membership
  it should order task families unresolved current Missing Marks, due Debt, then the
      attention-ranked trade walk
  it should rank attention bands with returned reasons and selected bases, stable
      within a view: pressure from Ongoing Risk to Stop else evaluable Worst-Case,
      reward from Incremental Reward else evaluable Maximum; boundary-reached stays
      in its higher band even at zero distance
  it should write nothing but provider observation recovery — no Review, Action,
      placeholder, Debt, or Deviation
  it should return Manual Mark tasks with honest NotConfigured context when no
      provider is enabled

describe("getTrade")
  it should return one bound eligible Trade with factual summary, exact Mark frame and
      Stale context, valuation/risk results, due routes, and Action form state
  it should preselect Hold only in returned unsaved view state with one visible Save
  it should return ReviewChanged — never a hybrid — when the overview binding is no
      longer coherent

describe("getDebt")
  it should page global due Debt (Outstanding with due time at or before the cutoff)
      ordered workflow-bound before Journal-only, then oldest due, then stable identity
  it should return the exact stored form for one Debt with its original snapshot

describe("save")
  it should re-read the exact Trade revision, re-resolve normalized evidence with
      ExpectedSnapshot, and rerun derivation/replay before staging
  it should atomically commit the dated Action and any narrow Stop-Discipline
      reconciliation (create/retain/supersede/Void by fingerprint)
  it should return ReviewChanged or Conflict with refreshed evidence and no writes
      when a Mark, acknowledgment, Bar, Trade fact, or existing Action changed
  it should key the Action uniquely by Entry Type, Trade, and Review Date, editing
      the same Entry identity under expected revision on retry rather than duplicating
  it should set the Action's moment time to the Review cutoff and authored time to
      the actual Save time, with Source Daily Review, a Trade Anchor, and Daily Review
      origin
  it should require nonblank Intent for Exit, Roll, and Adjust, reject those Actions
      without it, and record intent only — never a trading fact
  it should resolve Journal-only Debt by Entry-plus-settlement or recorded decline,
      and return NeedsTradeWorkflow with no write for workflow-routed Debt

describe("completion derivation")
  it should derive Incomplete while any eligible Trade lacks a saved Action, a required
      current Mark is Missing, due Debt remains, or a Deviation awaits reconciliation
  it should derive Complete only with every obligation resolved and exact current Marks
  it should derive CompleteWithUnavailableMarks when all obligations are resolved but
      a required Instrument has only an explicit acknowledgment, naming affected
      Instruments, Trades, and calculation families
  it should rederive a past date Incomplete after a Voided Action or correction without
      erasing history
```

## T3.6 UI: review walk, Mark entry, risk panels
Seam: React components via Testing Library.

```text
describe("review UI")
  it should present the task families in their normative order with per-task state
      and the completion banner reflecting the derived state
  it should render the Mark task with Manual entry, acknowledgment, and Stale-context
      display, distinguishing Missing from Acknowledged Unavailable
  it should keep the one-click Hold path to a single visible Save and record nothing
      on navigation away
  it should keep the entire review walk completable with keyboard only, with logical
      focus order after navigation and validation

describe("trade risk panels")
  it should render planned risk (1R/Original Planned Risk), Worst-Case Ongoing Risk,
      unrealized marked P&L, and Incremental Reward to Target with observation date
      and source
  it should render Value, Unavailable, Not Applicable, and covered subtotals distinctly,
      never showing fill cost or zero as current valuation
  it should show Stale context only as context beside an unfilled Expected Mark Date
  it should pair every charted or dense numeric display with a readable textual
      equivalent or accessible description
```

## T3.7 Integration cases (mock-free; fake-indexeddb full stack + Playwright browser)
1. Open latest completed review for an open stock trade → Missing Mark task → enter Manual Mark → save Hold → completion derives Complete; restart → review state resumed identically from facts with no session entity.
2. Breached stop: Mark beyond the effective Stop → save Hold → one new Stop-Discipline occurrence committed atomically with the Action; reopen shows the episode once.
3. Stale evidence: open Action form → change the session's Mark → Save → ReviewChanged with refreshed frames and no Action/Deviation write.
4. Acknowledgment: no obtainable Mark → acknowledge → CompleteWithUnavailableMarks naming the Instrument/Trade/families; later exact Mark arrives → status Available, acknowledgment history visible, completion rederives Complete.
5. Missed review: skip sessions → open the older exact completed date → eligibility from Open-at-cutoff facts; task order and resumption after mid-review restart.
6. Risk display: trade page shows 1R, worst case, unrealized P&L, incremental reward; on a Missing-Mark day the affected panels show Unavailable distinctly while realized-to-date stays visible.
7. Exit without Intent rejected; with Intent saves intent only and Trade facts unchanged.
8. Playwright: full review walk keyboard-only; axe scan of review and trade-detail views; live resize mid-review preserves selected Trade and unsaved Intent text.

## Deliverable gate
- [ ] Cumulative unit suite green
- [ ] Integration cases T3.7 all green (recorded per case)
- [ ] Installed Capability Manifest updated to exactly VD3's added scope
- [ ] Fresh browser-critic pass (critic starts the dev server itself):
  - [ ] Flow: open latest completed review for an open stock trade
  - [ ] Flow: enter the Manual Mark; observe completion banner change
  - [ ] Flow: one-click Hold save; Exit without Intent rejected
  - [ ] Flow: write a Review Note in review
  - [ ] Flow: open trade page and read planned risk / worst case / unrealized P&L / incremental reward panels
  - [ ] Flow: live resize mid-review
- [ ] Results log (date, critic run, flows, verdicts):
