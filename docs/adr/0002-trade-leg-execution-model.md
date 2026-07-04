# Three-level domain model: Trade → Leg → Execution

A Trade (strategic campaign with one thesis) contains Legs (one instrument line each), built from Executions (actual fills). Trade identity survives legging in/out and scaling. Which Trade an Execution attaches to is the trader's explicit choice at entry — campaign boundaries are curated intent, not derived from broker mechanics (the same short call could live inside a LEAP Trade or in its own linked Trade, depending on how the trader structures the campaign).

Rejected: two-level (Trade + fills, legs derived) — makes "what do I hold now?" a computation everywhere; flat fills grouped by tags — makes Trade-level R/R and status fragile aggregations.
