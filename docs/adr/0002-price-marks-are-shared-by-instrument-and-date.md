# Price Marks are keyed by (instrument, date) and shared across Trades

## Context
Unrealized P&L and the R:R evolution chart both need a per-day price for a
Trade's underlying. A trader may hold several Trades on the same underlying
(e.g. three AAPL positions). Entering or storing the price separately per
Trade would mean redundant entry and the risk of the same day's price
drifting between Trades.

## Decision
A Price Mark is keyed by (instrument, date) and shared. It is never stored
per-Trade. A Trade's chart and unrealized P&L look up the mark for the
underlying on a given date. During the Daily Review the trader enters each
underlying's price once; all Trades on that underlying pick it up.

## Rationale
One underlying has one end-of-day price on a given date — there is no
Trade-specific truth to capture. Deduplicating at the source removes redundant
entry and makes drift between Trades impossible.

## Consequences
- Price Marks are a first-class, shared resource keyed by (instrument, date).
- A Trade references marks by lookup, not by ownership.
- MVP sources marks via manual entry during the Daily Review; a later release
  adds an API as the default source with manual retained as fallback.
