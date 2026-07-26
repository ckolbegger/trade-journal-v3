# Plans are versioned; quantitative-level changes are dated Plan Revisions

## Context
A Plan's quantitative levels (entry, stop, target) are not static — traders
trail stops and lift targets during a Trade. Two features depend on the full
revision history: the R:R evolution chart (which steps at each revision) and
the plan-revision-rate performance metric (a discipline signal — frequently
moving a stop to avoid a loss, or a target to avoid taking profit, is exactly
the behavior a learning journal should surface).

## Decision
A Plan is versioned. The original levels are committed before the first fill,
and any later change to the quantitative levels is recorded as a dated,
reason-stamped Plan Revision. Levels are never overwritten in place; the
complete revision history is retained as a first-class record.

## Rationale
Overwriting levels would destroy the inputs to both the R:R evolution chart
and the plan-revision-rate metric — the very features that justify tracking
revisions at all.

## Consequences
- Plan storage is append-only for levels; the "current" levels are the latest
  revision (or the original if none).
- Plan-revision-rate is computed by counting revisions over a Trade's duration.
