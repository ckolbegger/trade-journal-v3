# Trade Views and Reporting

## Contract

Trade Views and Reporting is the normal read boundary for coherent UI-ready views that cross module ownership. It assembles current Trade browsing, complete Trade Detail, corrected-history replay, four deterministic report families, and shared-Mark change preview. It owns no facts, calculations, reports, sessions, or repairs.

```text
interface TradeViewsAndReporting
  browseTrades(request: TradeBrowseRequest) -> ReadViewResult<TradeBrowseView>
  getTradeDetail(request: TradeDetailRequest) -> ReadViewResult<TradeDetailView>
  replayTrade(request: TradeReplayViewRequest) -> ReadViewResult<TradeReplayView>
  runReport(request: ReportViewRequest) -> ReadViewResult<DeterministicReportView>
  previewMarkChange(request: MarkChangePreviewRequest) -> ReadViewResult<MarkChangeImpactView>
```

Results are `Ready`, `NotFound`, `Rejected`, `IntegrityBlocked`, or `ChangedDuringAssembly`. An individual Missing/Unavailable calculation remains inside a Ready view. Each result binds the represented Trade, Journal, Market Data, catalog, View Moment, and normalized request revisions. There is no durable View or Report entity.

## Labels and navigation

Current lists, headers, filters, and report groups use current labels and show inactive status. Economic/audit timelines use the label effective when selected/saved with the current label alongside when different. Journal Tag Select evidence uses its exact saved snapshot label. Renaming never changes analytical membership.

Every report/calculation exposes stable contributor navigation to the represented Trade, Execution, Journal item, or observation revision. Opening a destination performs that destination's normal current read and may disclose that the represented revision has changed.

## `browseTrades`

Supports current Lifecycle, Institution, Account, Strategy, Underlying, Trade Tag, Plan IdeaSource, and exact Trade filters, with fixed factual sorts and bounded pagination. Institution expands through all relevant Accounts under one catalog snapshot. Different dimensions use AND and values within one use OR.

Trade Record selects/indexes membership. Only the page is derived/evaluated. List items have a lifecycle-specific presentation:

- Planned: Plan Baseline and entry readiness;
- Open: Position, valuation, ongoing risk/reward, condition status, coverage, and settlement/management attention;
- Closed: final P&L/R availability, Terminal Disposition, and optional Close Reason;
- Abandoned: Abandonment Reason and Plan context.

All may show correction, Deviation, Debt, and integrity indicators. Calculation values never control cursor ordering.

## `getTradeDetail`

Returns effective Plan/management; Lifecycle and terminal explanation; Position, Lots, Lot Matches, Executions and settlement; fees/P&L; valuation and risk/reward; all Stop/Target results; independent Planned/Current Expiration Payoff; Entry Quality; Deviations and agreement; corrections/View history; lineage; deduplicated Journal narrative and Debt; and observation/source coverage.

```mermaid
sequenceDiagram
    participant UI
    participant V as Trade Views and Reporting
    participant TR as Trade Record
    participant TA as Trade Analysis
    participant MD as Market Data
    participant J as Journal
    participant RC as Reference Catalog
    UI->>V: getTradeDetail(Trade and View Moment)
    V->>TR: getRecord(AnalysisInput) and history
    TR-->>V: Corrected facts, versions, and historical Execution identities
    V->>TA: derive(one Trade snapshot)
    TA-->>V: State and exact evidence requirements
    V->>MD: query(required current frames)
    MD-->>V: Evidence, gaps, and snapshot binding
    V->>TA: evaluate and expirationPayoff
    TA-->>V: Independent calculation results
    V->>J: query(Trade narrative scope and Debt)
    J-->>V: Deduplicated saved evidence
    V->>RC: resolve current and historical label lenses
    RC-->>V: Typed labels and status
    V-->>UI: One coherent detail view
```

The coordinator derives once and reuses state. Closed/Abandoned detail does not require current Marks. Reads never record a Deviation, settle Debt, or repair disagreement.

## `replayTrade`

Derives the relevant completed-session lifetime from current corrected facts. A never-exposed Planned/Abandoned Trade is Not Applicable. An Open Trade ends at current Expected Mark Date; a Closed Trade ends at its final applicable completed session. Corrections may move the automatically derived span.

Replay includes fact/management/correction markers, Bar candles, close-only Mark points, explicit gaps, calculated tracks, coverage, and audit navigation. It does not accept a user range, bridge a gap, project future values, or combine replay with Expiration Payoff.

```mermaid
sequenceDiagram
    participant UI
    participant V as Trade Views and Reporting
    participant TR as Trade Record
    participant TA as Trade Analysis
    participant MD as Market Data
    UI->>V: replayTrade(Trade and View Moment)
    V->>TR: getRecord(AnalysisInput)
    TR-->>V: Corrected effective Trade
    V->>TA: derive(record)
    TA-->>V: Exposure lifetime and Instruments
    V->>MD: query(completed sessions for automatic lifetime)
    MD-->>V: Bar, point, or explicit gap per session
    V->>TA: replay(state and complete frame sequence)
    TA-->>V: Corrected economic tracks and coverage
    V-->>UI: Replay without interpolation or projection
```

## `runReport`

The four request families are Outcomes, Current Exposure, Process Scorecard, and one categorical Journal Field. The coordinator expands filters, exhausts the complete snapshot-bound candidate population, derives one coherent datum per Trade, loads current Journal projections when required, binds current Market evidence for Exposure, and delegates all population/date/formula/grouping meaning to Performance Analysis.

### Report Periods

The exact preset vocabulary is:

```text
AllTime | YearToDate | QuarterToDate | MonthToDate | ThisWeek | LastWeek
```

All Time is the default. To-date periods begin on their local calendar boundary and end on the View Moment's local Workspace date, inclusive. This Week is Monday through that date. Last Week is the preceding Monday through Sunday. These are calendar periods, not trading-session ranges. Holidays/weekends remain in the interval because metric natural dates can be non-session dates. There is no custom range or rolling-day preset. Current Exposure accepts no Report Period.

At most one Break Down By dimension is accepted and Overall remains visible. Exact resolved dates, coverage, Correction Footprints/sensitivity, contributors, and labels accompany the analysis result.

```mermaid
sequenceDiagram
    participant UI
    participant V as Trade Views and Reporting
    participant RC as Reference Catalog
    participant TR as Trade Record
    participant TA as Trade Analysis
    participant J as Journal
    participant PA as Performance Analysis
    UI->>V: runReport(Outcomes, LastWeek, Institution filter)
    V->>V: Resolve preceding Monday through Sunday in Workspace time zone
    V->>RC: Expand Institution to all relevant Account identities
    RC-->>V: Snapshot-bound Accounts
    V->>TR: Exhaust filtered Trade population
    TR-->>V: Complete AnalysisInput pages and binding
    loop Each unique Trade
        V->>TA: derive(Trade)
        TA-->>V: Trade performance datum
    end
    V->>J: Load required current Journal projections
    J-->>V: Snapshot-bound analysis items
    V->>PA: outcomes(complete population and resolved period)
    PA-->>V: Metrics, coverage, correction disclosure, and contributors
    V->>RC: Resolve group and filter labels
    V-->>UI: Deterministic report view
```

## `previewMarkChange`

Accepts one proposed Manual Mark command and expected resolution revision. It finds a bounded candidate population by exact Instrument, derives actual exposure/condition relevance, requests paired current/hypothetical frames from Market Data, and calls Trade Analysis for per-Trade calculation/replay/Deviation consequences and projected Correction Footprint. It writes nothing.

```mermaid
sequenceDiagram
    participant UI
    participant V as Trade Views and Reporting
    participant TR as Trade Record
    participant MD as Market Data
    participant TA as Trade Analysis
    UI->>V: previewMarkChange(proposed Manual correction)
    V->>TR: queryRecords(exact Instrument)
    TR-->>V: Bounded factual candidates
    V->>TA: derive candidates through affected date
    TA-->>V: Relevant and unaffected Trades
    V->>MD: query(current and Candidate Manual Mark frames)
    MD-->>V: Paired evidence and candidate digest
    V->>TA: assessChange(unchanged facts and paired evidence)
    TA-->>V: Calculation, replay, and Deviation consequences
    V-->>UI: Impact preview and exact Save precondition
```

The UI saves through Market Data using the exact Save precondition. The successful `MarketDataSaveResult` supplies the committed observation resolution and revision without a follow-up read. An indirectly affected Trade or report view may perform its own normal read when the user actually opens it; Preview never rewrites evidence-bound Deviation history.

## Invariants

- Read assembly uses one coherent snapshot or explicitly returns changed-during-assembly.
- UI layout does not shape these interfaces.
- Audit history and corrected economic replay remain distinct.
- Gaps and partial coverage survive presentation.
- Report orchestration never duplicates Performance Analysis semantics.
- Future Insights, coaching, predictive claims, and saved reports are absent from the MVP.

See [Performance Analysis](performance-analysis.md), [UI contract](ui-contract.md), and [overview](overview.md).
