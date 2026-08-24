# Trade Journal

A trading journal for traders learning the craft — recording not just what happened, but what was planned, so the trader can compare intent against outcome and improve.

## Language

**Trade**:
The unit the trader journals about. Groups one or more fills across one or more instruments into a single logical unit (e.g. a covered call's share purchase and call sale are legs of one Trade). Every Trade starts with a Plan. Has a lifecycle: Planned → Open → Closed.
_Avoid_: Position, transaction, order

**Fill**:
A single executed buy or sell at a specific price and quantity. One or more fills make up a Trade.
_Avoid_: Order, execution

**Flat**:
A Trade's net position is zero (zero shares, zero contracts across all legs). The condition under which a Trade closes. **Not** the same as a single leg ending — a covered call with shares still held is not flat; a wheel cycle is flat only at cycle boundaries (e.g. shares called away).

**Wheel**:
An ongoing options strategy that cycles: sell cash-secured puts → take assignment if struck → sell covered calls against the resulting shares → have shares called away if struck → repeat. In this app, a wheel is modeled as a **sequence of Trades, one per cycle**, not one long-lived Trade. The cross-cycle "this is one ongoing thesis" view is a reporting grouping (by symbol + strategy), not a lifecycle concept.

**Plan**:
The forward-looking intent behind a Trade, defined before any fill is placed. Captures a thesis (why enter), invalidation criteria (what would prove it wrong), quantitative levels (entry zone, stop-loss, profit target), the trader's emotional state at entry, and the associated journal entry. Risk:reward is computed from the levels; it is not stored.
A Plan is **versioned**: the original is committed before the first fill, and any later change to the quantitative levels (moving a stop, lifting a target) is recorded as a dated **Plan Revision** with a reason. The original levels and every revision are retained — the Plan's history is a first-class record.
_Avoid_: Setup, idea (too vague)

**Plan Revision**:
A dated, reason-stamped change to a Plan's quantitative levels while the Trade is underway. The R:R evolution chart steps at each revision. The frequency of revisions per Trade is tracked as a **plan-revision-rate** performance metric — a discipline signal, since frequently moving a stop (to avoid a loss) or a target (to avoid taking profit) is exactly the behavior a learning trader should surface and correct.

**Thesis**:
The qualitative rationale for entering a Trade — the "why," written before the first fill.
_Avoid_: Reason, story

**Invalidation**:
The condition(s) that, if met, prove the thesis wrong and signal the Trade should be exited. May be a price level (the stop) or a qualitative event ("earnings gap the wrong way").
_Avoid_: Stop (a stop is a price level; invalidation is the broader concept)

**Stop**:
A declared exit level guarding one **risk direction** of a Trade — its **downside** or its **upside**. A directional Trade declares one side (long stock: downside; short stock: upside); a neutral structure (an Iron Condor) may declare both; a side left undeclared means no level there, not "no risk." A stop hit on a multi-directional structure exits that *side*, not the Trade — the Trade still closes only when flat. The position's **planned risk** (the R baseline) is the worst side's reading; detail views show each direction separately.
_Avoid_: Risk element, trigger

**Position price**:
The net current price of a Trade's whole position, per unit — what it costs to close. Risk and reward figures are computed over position price; stops and targets on option trades are declared in the **option position price**, the same net over the option legs only.
_Avoid_: Mark value, premium (ambiguous — whose price?)

**P&L (profit and loss)**:
The realized and unrealized gain or loss of a Trade, **computed from the fills**.
- **Open Trades**: computed live on every read (marks change daily).
- **Closed Trades**: a **figure-set snapshot** (P&L + the full `evaluate()` result: R-multiple, planned-vs-realized R:R, risk quantities as-of close, etc.) is **computed once at close and stored** as a regeneratable cache (see ADR 0007). Authoritative for display; invalidated and regenerated when underlying facts or the calc change. Read from the snapshot to avoid O(N)-growing recomputation in reporting over years of closed Trades; lazy-populate if null.
_Avoid_: Result, return

**Risk:reward**:
The ratio of planned risk to planned reward, computed from the Plan's quantitative levels (stop and target). Always presented alongside its dollar equivalent per the dual presentation rule. Visualizations: the R:R evolution chart (signature), a plan-time payoff snapshot, a planned-vs-realized comparison, and a portfolio-level R-multiple distribution.

**Risk** (three distinct quantities, each shown in both ratio and dollar form):
- **Planned risk** — the risk at the Trade's declared stops, taken as the **worst (largest-dollar) reading across its risk directions**. **Frozen at the initial Plan for the Trade's entire life**; ignores later Plan Revisions. The commitment baseline — what the trader signed up to risk. A stop revision changes current risk, never planned risk.
- **Current risk** — the additional loss from now if the current stop executes, computed over the whole position: position price at the current stop vs position price now. Moves with price and steps when the stop is revised. "What's at risk right now given where price is and where the stop currently sits."
- **Maximum risk** — worst-case loss from current price (underlying to zero / option to worthless). **Instrument-dependent**: whole position value for stock; premium paid for long options; unbounded for naked short options; defined by the spread width for defined-risk spreads. Not discipline-dependent — it's the catastrophic loss the *instrument itself* permits.

The pedagogical comparison the app drives: a stock's **current** risk (discipline-dependent — the trader must honor their stop) vs its **maximum** risk (catastrophic — the whole position if the underlying goes to zero) exposes the gap that options structurally close. The same directional trade idea, expressed as a long option instead of stock, collapses maximum risk from "the whole position" to "the premium paid," with no discipline required to enforce the cap.

**Payoff curve**:
A position's P&L as a function of underlying price at expiry — piecewise-linear, hinged at the strikes. The single construction all structure-level quantities are read from: maximum risk is its worst value, maximum reward its best, and the Breakevens its zero-crossings. The trader's declared stop and target levels are read against the curve rather than fed to a per-strategy formula — the curve's shape carries the trade's direction, so no strategy label or directional-bias input enters the calculation. Covers every structure uniformly: a stock is a straight line, a spread is hinged at its strikes, a condor is the sum of two spreads. An at-expiry (intrinsic-value) picture: it does not express live option value mid-life (time value), which is a separate mark-to-market question.
_Avoid_: Payoff diagram (that is the chart rendering of the curve)

**Breakeven**:
An underlying price at which a position's P&L is exactly zero — a zero-crossing of the Payoff curve. Shown on the plan-time payoff visualization and the trade review. A stop placed at a breakeven yields $0 planned risk.

**Journal Entry**:
A timestamped note capturing the trader's reflection and/or emotional state at a moment in the Trade's life. Entries are explicitly **decoupled from fills** — the trader is never forced to write while trading; focus stays on execution. Each Entry attaches at one of three levels:
- **Trade-level** — about the Trade as a whole (pre-entry thesis, open-ended reflection, daily-review observation, a market event affecting this position).
- **Fill-level** — reflection tied to a specific Fill ("I panicked out here").
- **Market-level** — a macro observation with no parent Trade ("25% tariff on EU goods announced"), which may be **linked** to the Trades it affects so it surfaces when those Trades are reviewed.

A Trade accumulates a stream of Journal Entries spanning its whole life, from plan-time through final close.
_Avoid_: Note, comment, log

**Session**:
NOT a first-class entity. "Market session" is only a time-based filter on entries and fills ("everything between 9:30–16:00 ET on July 30"). There is no Session record to write notes against.
_Avoid_: (do not model this as an entity)

**Daily Review**:
A core practice the app drives. Each day the trader walks through their open Trades, **enters end-of-day Price Marks for underlyings encountered**, assesses current P&L and risk:reward, and may record an observation about what they plan to do next. The review surfaces incomplete journal placeholders.

**Price Mark**:
An end-of-day price for a single instrument on a single date. Marks are **shared and deduplicated** — keyed by (instrument, date), not stored per-Trade. A Trade's chart and unrealized P&L look up the mark for their underlying on a given date. If three Trades all involve AAPL, the trader enters AAPL's price once during the Daily Review and all three pick it up.
**Sourcing is sequenced**: the MVP uses **manual entry only** (during the Daily Review) to minimize scope; a later release adds a free market-data API as the default source, with manual entry retained as a fallback/override.
**Chart rendering is sequenced to match**: the MVP renders the underlying price as a **simple line chart through end-of-day marks** (one scalar per day). OHLC bars (and candlestick rendering) are introduced **only when automated quotes arrive**, since OHLC isn't captured by manual marking.
_Avoid_: Quote (a quote is a live/timestamped price; a mark is a settled end-of-day value)

**Strategy**:
A named, reusable trading approach (covered call, iron condor, breakout, wheel) from a trader-customizable taxonomy. Used as a Trade tag for filtering and grouping in Performance Reporting.
_Avoid_: Setup (a setup is finer-grained and situational; a strategy is the reusable approach)

**Underlying**:
The instrument a Trade's risk is keyed off — AAPL for AAPL shares and for an AAPL option. Price Marks and the R:R evolution chart are keyed by underlying.
_Avoid_: Symbol, ticker (those are identifiers; underlying is the risk-bearing instrument)

**Position size**:
The quantity of an instrument held in a Trade, derivable from the Trade's fills (signed quantity). Determines the dollar scaling of R:R figures (the dollar side of the dual presentation rule). Not stored as a separate fact — it's computed from fills, like P&L.
_Avoid_: Size (ambiguous), exposure

**Performance Reporting**:
Aggregate statistics over many Trades, filterable by date range, strategy, Trade status (open/closed), and underlying. This view serves the "how am I doing over time" question; it replaces the need for a separate weekly/monthly review ritual. Outcome metrics (over closed Trades): R-multiple distribution, equity curve by R, win rate, expectancy, profit factor, total realized P&L, and mean plan-revisions per trade (the per-day revision rate remains open).
_Avoid_: Analytics (too generic)

**Account**:
A trading account at a specific broker. A single-user trader may have several Accounts (multiple brokers, or multiple accounts at one broker). Each Trade is assigned to exactly one Account. Used for per-account P&L and position tracking; not for multi-user isolation.
_Avoid_: Broker (a broker may hold several Accounts)

**Taxonomy**:
The set of allowed values for a categorical field (e.g. strategy, setup type). Taxonomies are **trader-customizable**. Changing a taxonomy affects Trades/Entries assigned values going forward; existing records keep their assigned value even if it's later removed from the taxonomy.

**Entry Schema**:
The field set for a given Journal Entry type (pre-entry, fill-time, daily-review, post-close, market-event, etc.). Schemas are **trader-customizable**. An entry carries a **snapshot** of its schema at creation time — when the schema changes later, only entries created *after* the change use the new fields; existing entries keep exactly the fields they were created with. Forward-only, append-style versioning per record.
_Avoid_: Template (a template implies you fill it in; a schema defines the fields)

**Risk:reward evolution chart** (signature visualization):
A Trade-lifetime chart that teaches "trade reaction to market moves" intuition. Shows, across the Trade's duration:
- The **underlying price** series (end-of-day marks in the MVP — a simple line chart; OHLC bars added later when automated quotes arrive).
- **Planned risk** (frozen at the initial Plan), **current risk** (current price vs current stop, stepping at stop revisions), and **maximum risk** (instrument-dependent catastrophic worst case) — each in both ratio and dollar form.
- **Incremental reward** (current price to current target) in both ratio and dollar form.
- A **time slider** that scrubs forward through the Trade's life ("show the trade up to the current date as the slider moves right"), letting the trader replay price action against their plan and feel how the risk quantities shifted.
- **Plan Revisions appear as step events** on the chart (moving the stop changes current risk; target revisions change incremental reward).

**Dual presentation rule** (applies to all risk, reward, and P&L figures, everywhere):
Every figure is shown **both as a ratio AND as total dollars**, simultaneously. The ratio is size-independent (a 3-contract trade and a 1-contract trade share the same ratio); the dollar amounts scale with position size. Showing both lets the trader see trade *quality* (ratio) and *actual money at stake* (dollars) together — a 1:3 ratio on $50 risk is a very different trade from 1:3 on $5,000.

**Trade Review display** (when viewing a single Trade):
Pulls together — realized P&L, unrealized P&L, **planned risk**, **current risk**, **maximum risk**, and **incremental reward** — all presented in **both ratio and dollar form** per the dual presentation rule. The juxtaposition of current risk vs maximum risk is where the stock-vs-option safety lesson lands.

**Plan-time R:R / payoff visualization**:
A static snapshot at Plan-commit showing the shape of the bet — entry, stop, and target as zones with dollar amounts at each — so the trader sees the risk/reward geometry before placing the trade.

**Planned-vs-realized R:R comparison**:
On a closed Trade, shows the discipline gap — e.g. "planned 1:2, achieved 1:1.4 because you exited early." Surfaces in the post-trade review and in Performance Reporting.

**R-multiple distribution** (portfolio-level, in Performance Reporting):
Aggregates closed Trades' results as multiples of planned risk (R-multiples), the classic trading-literature convention. Shows the distribution and the equity curve by R.

**In scope**:
- The Trade lifecycle: Plan → fills → Daily Review → close.
- Journal Entries (Trade-level, Fill-level, Market-level with linking).
- Performance Reporting with filtering.
- **Trade-analysis charts**, including the R:R evolution chart and the **historical price series** for underlyings needed to draw them (end-of-day marks in the MVP — a simple line chart; OHLC bars added later when automated quotes arrive).

**Out of scope** (explicit no's, to prevent scope creep):
- **Live trading feed / charting platform** — real-time quotes, option chains, intraday Level 2. The trader uses their broker for live trading. (Historical daily price series *for charting* is in scope; a live trading feed is not.)
- **Watchlist / pre-planning trade ideas** — the app sees a Trade only from the moment a Plan is committed. Pre-planning research happens elsewhere.
- **Broker integration** — fills are entered manually.
- **A separate weekly/monthly review ritual** — the Performance Reporting view with date filtering serves this need.

**Trade lifecycle**:
A Trade moves through three states, **stored authoritatively** (not derived on read — see ADR 0006):
- **Planned** — Plan committed, no fills yet. Pre-entry reflection placeholder is due.
- **Open** — at least one fill has landed. Figures (P&L, risk, R:R) computed live on every read; marks change daily.
- **Closed** — the Trade is over. Post-trade review placeholder is due. A **figure-set snapshot** is computed once at close and stored as a regeneratable cache (see ADR 0007) so reporting over years of closed Trades doesn't recompute immutable inputs.

Transitions happen when a fill is recorded: first fill moves Planned→Open; the fill that flats the position moves Open→Closed (and triggers the figure-set snapshot). `flat` (net-position-zero) is still a CalculationModule function — it's computed **once, at fill-record time, for the one Trade being modified** to detect the transition. It is NOT re-derived across all Trades on every query.

**Close rule**: a Trade closes **when its net position goes flat** (zero shares, zero contracts) — universally, regardless of strategy. This single rule correctly handles every case:
- A covered call's call expiring does **not** close the Trade (shares still held → not flat).
- Naked put assignment does **not** close the Trade (now long shares → not flat).
- Scaling in/out does **not** close the Trade until the last partial exits.
- The wheel runs as a **sequence of Trades, one per cycle** — each cycle closes flat (e.g. shares called away), and the next put starts a new Trade with its own Plan. Viewing a whole wheel as one picture is a **reporting grouping** (by symbol + strategy tag), not a lifecycle concept.

Close is **computable from fills** (no strategy-specific logic, no trader-declared close event) — but the resulting status is **stored**, not recomputed per query.

**Journal Placeholder**:
A pending Journal Entry the trader owes at a consequential moment. Two tiers:
- **Required** — auto-created at Plan commit (pre-entry reflection) and at Trade close (post-trade review). Must eventually be completed.
- **Optional** — offered (not auto-created) at each Fill and during the Daily Review, with a three-way choice: enter now, enter later, or no entry required.

The asymmetry is deliberate: the app demands reflection at the two bookends of a Trade but leaves mid-trade reflection to the trader's judgment, so focus stays on execution.
