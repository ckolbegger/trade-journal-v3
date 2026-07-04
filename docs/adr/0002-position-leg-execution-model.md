# Three-level domain model: Position → Leg → Execution

A Position (strategic campaign with one thesis) contains Legs (one instrument line each), built from Executions (actual fills). Position identity survives legging in/out and scaling. Which Position an Execution attaches to is the trader's explicit choice at entry — campaign boundaries are curated intent, not derived from broker mechanics (the same short call could live inside a LEAP position or in its own linked Position, depending on how the trader structures the campaign).

Rejected: two-level (Position + fills, legs derived) — makes "what do I hold now?" a computation everywhere; flat trades grouped by tags — makes position-level R/R and status fragile aggregations.
