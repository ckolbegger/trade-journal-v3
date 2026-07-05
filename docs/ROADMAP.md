# Delivery Roadmap

The domain model (Trade → Leg → Execution, Marks, Journal) is built full-shape from slice 1; each slice widens the instruments and workflows the UI supports. Every slice is a complete lifecycle — usable end-to-end, not a demo layer.

## Slice 1 — Stock, full lifecycle, with journal
- Accounts & Institutions (every Trade binds to one Account from day one); optional Account Snapshots
- Plan (immutable, thesis required, structured Planned Legs) → confirm → buy/sell Executions with fees → close with Close Reason
- Deviation detection (structure, sizing; stop/target discipline at review)
- Manual Marks via Daily Review: attention-ranked walk, P&L, all four R/R numbers (Planned/Worst-Case Risk, Planned/Max Reward)
- Journaling: configurable Entry Types with seeded defaults, required-but-non-blocking entries (Journal Debt settled in review), standalone trader entries
- Durability: persist(), export/import backup

## Slice 2 — Single-leg option Trades, full lifecycle
- Option instruments (type/strike/expiration) as Legs; per-(instrument, date) Marks with IV display implied from Marks
- Expiration handling; assignment minimally (assignment-created stock lands as a new Leg in the same Trade — schema already allows it)

## Slice 3 — Multi-leg Trades
- Covered calls, spreads, LEAP + short-call structures; multi-expiration R/R anchors
- Shared-Mark dedup across Trades holding the same contract, with edit warnings

## Later slices (order to be decided)
- Roll gesture + Transfers + Trade lineage (ADR 0004)
- Reflective time-slider replay (ADR 0009)
- Performance analytics by underlying / Strategy / Tag
- Automated pricing sources behind the pricing interface (ADR 0008), storing Daily Bars (OHLC) with Marks defaulting to the close — enables candlestick charts and pattern detection
