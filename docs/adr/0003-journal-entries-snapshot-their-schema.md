# Journal Entries snapshot their Entry Schema at creation time

## Context
Entry Schemas (the field sets for each Journal Entry type) are
trader-customizable. When a trader changes a schema — adds a field, removes
one, renames one — existing entries must not be affected; they should keep
exactly the fields they were created with. A trader refining their review
template over months should not see historical entries mutate or break.

## Decision
A Journal Entry carries a snapshot of its Entry Schema at creation time.
Schema changes apply forward-only to entries created after the change.
Existing entries are immutable with respect to their schema.

## Rationale
A live reference from an entry to a mutable schema would silently mutate
historical records whenever the schema changes — an entry written in January
would appear to have (or be missing) fields the trader only added in March.
Snapshotting per record makes each entry a faithful record of what was
captured at the time.

## Consequences
- Entry storage embeds or references an immutable schema version, not a live
  template.
- Reporting across entries must tolerate different schemas across time
  (entries created under different schema versions coexist in the dataset).
- Schema history is implicitly captured by the union of entry snapshots.
