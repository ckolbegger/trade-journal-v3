# Prototype screenshots — "TradeCoach"

Visual reference captured from a Claude Design prototype of this app. These are a **design target, not a spec**: where a screenshot and a design doc or ADR disagree, the design doc wins until we deliberately decide otherwise.

- **Source**: https://claude.ai/code/artifact/bf11e40e-3822-4548-a14b-beb25b24336d
- **Captured**: 2026-08-23, via chrome-devtools MCP, full-page at a 814×2000 viewport (the prototype's mobile breakpoint).
- **Note**: the prototype is responsive — at ≥900px it switches to a desktop **sidebar** layout with a "Control Center" destination. Only the mobile layout is captured here.

## Files

| File | Screen |
|---|---|
| `proto-home.png` | Home: greeting, Day N · K open, New plan CTA, open-position rows (adherence %, P&L, REVIEW DUE badge) |
| `proto-position-detail-stock.png` | Position detail, single leg (NVDA long stock): P&L, adherence, Current/Target/Stop with "away"/"cushion", Plan/Invalidation/Catalyst, legs & fills |
| `proto-position-detail-spread.png` | Position detail, two legs (AAPL debit spread) |
| `proto-add-fill.png` | Add fill sheet: Buy/Sell, Quantity, Fill price, Instrument |
| `proto-position-journal.png` | Position Journal sheet: trade-scoped entries with type badges |
| `proto-entry-composer.png` | New entry: free-text prompt + "Feeling" option chips |
| `proto-journal-timeline.png` | Journal: date-grouped entries, filter chips (All/Plans/Positions/Market/Closes) |
| `proto-new-plan-step1.png` | New plan, step 1: ticker + strategy picker |
| `proto-stats.png` | Stats: range/strategy filters, KPI tiles, equity curve, Followed-vs-Deviated, by-strategy, closed trades |

## Not captured

| Screen | Why |
|---|---|
| New plan, step 2 (thesis + levels) | "Continue" is inert in the published artifact |
| Close position flow | not reachable without completing a plan |
| Coach / Insights panel | needs a backend the published artifact can't reach ("Could not reach the coach right now") |

## Concepts with no slice

Two prototype ideas are not covered anywhere in `docs/plan/`:

- **Coach / Insights** — an LLM reading the trader's process and reporting where discipline stands.
- **Simulated day** (Reset / Advance day control) — a time-travel harness for exercising the app.
