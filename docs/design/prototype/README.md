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
| `proto-new-plan-step2.png` | New plan, step 2: Thesis, What invalidates it? (required), Catalyst/Timeframe, How are you feeling?, and Risk Parameters (entry low/high, target, stop, size, exit in days) |
| `proto-new-plan-step2-filled.png` | Step 2 completed — a live Risk/Reward panel appears (ratio, risk/win per share, position risk) |
| `proto-position-detail-planned-desktop.png` | A saved plan before any fill: "No fills yet", `LEGS & FILLS (0)`, `25 planned`. *Desktop only* — the state is consumed by the first fill |
| `proto-stats.png` | Stats: range/strategy filters, KPI tiles, equity curve, Followed-vs-Deviated, by-strategy, closed trades |

## Known prototype bugs

The prototype is a UX sketch; its arithmetic and state handling are not trustworthy. Take the *layout and wording* from it, never the numbers.

- **Equity curve overflows** its card at narrow widths (visible in `proto-stats.png`). Renders correctly at desktop width.
- **Position risk is off by 100× for stock.** A 25-share plan risking $14.00/share shows "POSITION RISK $35,000" (`proto-new-plan-step2-filled.png`); it should be $350. Looks like an unconditional ×100 contract multiplier applied to a Long Stock plan.
- **P&L ignores position value.** Buying 25 MSFT at $404 with the mark still $404 shows −$10,100 (−100.0%) — the full cost basis booked as loss, rather than $0.
- **"Close position" doesn't close.** See the table above.
- **Adherence is 85% on a freshly saved plan** with no fills, then jumps to 100% after the first fill. Whatever it measures, it isn't stable at plan time.

## Not captured

| Screen | Why |
|---|---|
| Close position flow | **does not exist.** "Close position" is a stub — it shows a "Position closed" toast, returns to Home, and the position stays in OPEN POSITIONS. Verified both with and without fills. There is no Close Reason prompt and no close journal entry anywhere in the prototype |
| Coach / Insights panel | needs a backend the published artifact can't reach ("Could not reach the coach right now") |

## Concepts with no slice

Two prototype ideas are not covered anywhere in `docs/plan/`:

- **Coach / Insights** — an LLM reading the trader's process and reporting where discipline stands.
- **Simulated day** (Reset / Advance day control) — a time-travel harness for exercising the app.
