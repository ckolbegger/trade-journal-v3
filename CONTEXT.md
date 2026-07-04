# Trade Journal

A personal trading journal for a single trader: plan, manage, and review stock and option Trades, with journaling to track growth as a trader.

## Language

**Trade**:
The strategic unit a trader manages — one campaign driven by one thesis, from entry to final exit, held in exactly one Account. Its identity survives changes in composition (legging in/out, scaling). Never used for a single fill — that is an Execution.
_Avoid_: position (for the campaign), campaign, strategy (for the instance)

**Position**:
The current holdings of a Trade — the net open quantity across its Legs at a point in time. Always derived from Executions, never stored. Matches what a brokerage displays as "positions."
_Avoid_: holdings, exposure

**Institution**:
A brokerage firm at which the trader holds one or more Accounts (e.g., Schwab, Fidelity). A grouping dimension in analytics.
_Avoid_: broker, brokerage (as entity names)

**Account**:
One specific account held at an Institution. Every Trade belongs to exactly one Account. A grouping dimension in analytics.
_Avoid_: portfolio

**Account Snapshot**:
A dated observation of an Account's total value (the brokerage's liquidation value), entered opportunistically. Powers the equity curve and %-of-account risk framing; optional forever.
_Avoid_: balance, statement

**Plan**:
The trader's statement of intent for a Trade, captured before entering: thesis, intended structure, maximum risk, profit target, and exit conditions. Immutable once confirmed.
_Avoid_: setup, idea, trade plan (as an editable document)

**Plan Revision**:
A dated amendment recording a deliberate change of intent on a Trade (e.g., after legging in). Revisions never overwrite the original Plan.
_Avoid_: plan edit, plan update

**Leg**:
A single instrument line within a Trade — one option contract (type/strike/expiration) or one stock line — whose held quantity changes as Executions occur.
_Avoid_: contract, instrument, line

**Journal Entry**:
A timestamped piece of trader writing — optionally anchored to a Trade or to a moment in its life (plan, revision, execution, review, close), or standalone trader-level reflection. The growth story is the timeline of all entries.
_Avoid_: note, comment, log

**Daily Review**:
The out-of-hours ritual of collecting the day's Marks, walking open Trades in attention-ranked order (decisions first), and settling Journal Debt.
_Avoid_: end-of-day update, check-in

**Entry Type**:
A trader-configurable template that names a kind of Journal Entry and defines the Prompts it asks. Ships with rich defaults; the trader may add types and change a type's Prompts over time.
_Avoid_: category, template, form

**Prompt**:
A single question or piece of information an Entry Type asks the trader to provide. A Journal Entry permanently keeps the Prompts (and answers) it was written against, even after its Entry Type evolves.
_Avoid_: field (in trader-facing language), question

**Journal Debt**:
A required Journal Entry (at Plan, Plan Revision, or Close) that was skipped or left as a timestamped "TBD" placeholder. Journal Debt never blocks trading actions; it is surfaced for settlement during Daily Review.
_Avoid_: missing entry, incomplete journal

**Close Reason**:
The trader's stated reason a Trade ended, captured at close for later analysis — e.g., Hit Target, Hit Stop, Thesis Invalidated, Timed Out, Rolled. Applies to closing an open Trade and to abandoning a planned one.
_Avoid_: exit reason, expired (reserved for contract Expiration)

**Ongoing Risk**:
The loss a Trade risks by staying open, measured from today's Marks — including giving back unrealized gains. Shown against two anchors: Planned Risk (down to the Plan's stop) and Worst-Case Risk (down to the structural extreme — stock at zero, spread at full width; may be unlimited).
_Avoid_: current risk, remaining risk (ambiguous with plan-anchored framing)

**Incremental Reward**:
The gain still available by staying open, measured from today's Marks. Shown against two anchors: Planned Reward (up to the Plan's target) and Max Reward (up to the structural extreme; may be unlimited, e.g., long stock or long calls).
_Avoid_: remaining reward, potential profit

**Mark**:
A dated price observation for an instrument (underlying or option contract), fetched from a market-data source or manually entered. Exactly one Mark exists per instrument per date, shared by every Trade holding that instrument. Marks power valuations, P&L, and visualizations.
_Avoid_: quote, price update, close (as a noun for the observation)

**Expiration**:
An option contract reaching its expiration date, closing the affected Leg quantity as a market event. Never used for a thesis running out of time (that Close Reason is "Timed Out").
_Avoid_: expiry (for theses)

**Strategy**:
The trading approach a Trade declares at Plan time (e.g., PMCC, bull put spread, covered call), chosen from a trader-configurable list and stable for the Trade's life. A Strategy is a template: it pre-fills the Plan's Planned Legs and defines the semantics of its stop and target (underlying price, Trade value, or % of max profit). A unit of cross-underlying performance analysis. P&L and structural risk math never read Strategy — they read Legs, Executions, and Marks.
_Avoid_: setup type, deriving strategy from current legs

**Planned Leg**:
A leg the Plan intends to hold — side, instrument kind, and quantity, with strike/expiration exact or TBD for legging plans. The baseline actual Legs are compared against for Deviation detection.
_Avoid_: intended leg, leg plan

**Deviation**:
A recorded departure of actual trading from the original Plan: structural (a Leg no Planned Leg covers), sizing (quantity beyond plan), or discipline (Marks crossed the planned stop or target with no action). Always measured against the original Plan, even when a Plan Revision documents the change — the Revision is the paperwork of new intent; the Deviation is the fact of departure.
_Avoid_: violation, mistake (a Deviation may be a good decision)

**Tag**:
A free-form label the trader attaches to a Trade for arbitrary queryable groupings (e.g., "earnings play", "FOMC week").
_Avoid_: category, label

**Transfer**:
Movement of Leg quantity from one Trade to another in the same Account, with no market transaction — the trader restructuring campaign boundaries (e.g., moving a LEAP into the Trade holding the call rolled against it). Transfers create the lineage links between Trades.
_Avoid_: move, reassignment

**Roll**:
Closing a Leg in whole or in part and opening a successor at a different expiration and/or strike. The closed quantity realizes P&L in its Trade; the successor typically opens in a new linked Trade, with covering quantity Transferred alongside.
_Avoid_: adjustment (broader concept)

**Execution**:
An actual market transaction: buying or selling a quantity of one Leg's instrument at a specific price and time, carrying its total fees and commissions.
_Avoid_: fill, trade (for a fill), transaction, order
