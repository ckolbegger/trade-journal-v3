# Prototype screenshots — "TradeCoach"

Visual reference captured from a Claude Design prototype of this app. These are a **design target, not a spec**: where a screenshot and a design doc or ADR disagree, the design doc wins until we deliberately decide otherwise.

- **Source**: https://claude.ai/code/artifact/bf11e40e-3822-4548-a14b-beb25b24336d
- **Captured**: 2026-08-23, via chrome-devtools MCP.

The prototype is responsive, and the two layouts differ structurally, so both are captured:

- **Mobile** (`proto-*.png`) — 814px wide: single-column stack with a **bottom tab bar** (Home / Journal / New / Stats). Sheets slide up from the bottom.
- **Desktop** (`proto-*-desktop.png`) — 1440px wide: content column with a **left sidebar** (Control Center / Dashboard / Journal / New plan). Sheets are right-hand drawers over a dimmed page.

The sidebar destinations map 1:1 to the mobile tabs — Control Center = Home, Dashboard = Stats. No screen exists in one layout only.

Our app today (Tailwind, centered `max-w-3xl`, no media queries) is a single-column document layout closer to the mobile capture; adopting the sidebar would be an architecture change, not a restyle.

## Files

Each screen has a mobile and a `-desktop` variant.

| File (add `-desktop` for the wide variant) | Screen |
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

## Known prototype rendering bug

At narrow widths the equity curve overflows its card and runs off the right edge (visible in `proto-stats.png`). It renders correctly at desktop width. Don't reproduce it.

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
