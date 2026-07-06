# Trade detail page — interaction sequences

The page a Daily Review walk lands on for each open Trade. Displays: current Position (holdings), Execution history, current Valuation with all P&L, all four Risk/Reward anchors, Deviation flags; links to the Trade's journal timeline; can trigger a replay graph.

## Page load

One coordinator call assembles everything computed; a single `TradeRecord` + `MarkSeries` snapshot feeds every number so the page is internally consistent (holdings, P&L, and R/R can never disagree about which Executions exist).

```mermaid
sequenceDiagram
    actor T as Trader
    participant UI as Trade Detail Page
    participant V as Valuations
    participant TB as TradeBook
    participant TM as TradeMath
    participant PB as PriceBook
    participant J as Journal

    T->>UI: open Trade (Daily Review walk)
    UI->>V: detail(tradeId)
    V->>TB: get(tradeId)
    TB-->>V: TradeRecord (Plan, Revisions, Legs, Executions, recorded Deviations)
    V->>TM: instrumentsOf(record)
    TM-->>V: instrument keys (Legs + underlying)
    V->>PB: series(instruments)
    Note over V,PB: one fetch serves both — latest date is the valuation MarkSet,<br/>full series feeds trailing stops and discipline checks
    PB-->>V: MarkSeries
    V->>TM: positionOf(record)
    V->>TM: valuation(record, latest Marks)
    V->>TM: riskReward(record, series)
    V->>TM: detectDeviations(record, series)
    TM-->>V: Position, Valuation, RiskReward, detected Deviations
    opt newly detected discipline Deviations (not yet recorded)
        V->>TB: recordDeviations(tradeId, new)
        Note over V,TB: ADR 0012 — recorded when first surfaced,<br/>and this page IS the surfacing
    end
    V-->>UI: TradeDetail bundle<br/>(facts, Position, Valuation, RiskReward, Deviations)
    UI->>J: countFor(trade: tradeId)
    J-->>UI: journal entry count (badge on the journal link)
    UI-->>T: holdings · Execution history · P&L · 4 R/R anchors · Deviation flags · journal link · replay button
```

## Replay graph (on demand)

Same join, full history, no new seams.

```mermaid
sequenceDiagram
    actor T as Trader
    participant UI as Trade Detail Page
    participant V as Valuations
    participant TB as TradeBook
    participant TM as TradeMath
    participant PB as PriceBook

    T->>UI: click "Replay"
    UI->>V: replay(tradeId)
    V->>TB: get(tradeId)
    V->>TM: instrumentsOf(record)
    V->>PB: series(instruments)
    V->>TM: replay(record, series)
    Note over TM: each ReplayPoint computed with knowledge<br/>as of its date (Exit Levels, trailing high-water)
    TM-->>V: ReplayPoint[] (date, Valuation, RiskReward)
    V-->>UI: replay series
    UI-->>T: time-slider graph of P&L and R/R as the Trade played out
```

## Journal timeline (on navigation)

```mermaid
sequenceDiagram
    actor T as Trader
    participant UI as Journal Timeline
    participant J as Journal

    T->>UI: click journal link on Trade detail
    UI->>J: entriesFor(trade: tradeId)
    Note over J: returns entries anchored anywhere in the Trade's life —<br/>Plan, Revisions, individual Executions, Review notes, Close
    J-->>UI: entries + any outstanding Journal Debt
    UI-->>T: timeline (each entry shows its anchor and Entry Type prompts as answered)
```

## What this exercise surfaced (design rulings)

1. **New coordinator operation `Valuations.detail(tradeId)`** — the page-shaped bundle. Without it the UI would make 4–5 calls whose results could interleave with writes; with it, every number derives from one snapshot.
2. **The UI receives facts for display inside coordinator bundles** (Execution history, Plan fields) but never derives from them — the "UI sees finished items" rule refined, not broken.
3. **`detail()` may write** — recording newly surfaced discipline Deviations (ADR 0012 says surfacing is the recording trigger). Deliberate exception to read-only reads; the alternative (record on acknowledgment) loses the "what was I shown, when" guarantee.
4. **Journal anchors must be queryable by Trade** — `entriesFor(trade)` must return entries anchored to the Trade *or to anything inside it* (Executions, Revisions, Close). Execution-anchored entries therefore carry the tradeId in their anchor. This is a requirement on the Journal drill-down.
5. **One `PriceBook.series()` fetch serves both needs** — its latest date is the valuation MarkSet; its history feeds trailing stops, discipline checks, and replay. PriceBook needs no separate "latest" operation for this page.
