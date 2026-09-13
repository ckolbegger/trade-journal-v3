# Semantic command atomicity

Status: accepted

Every domain-changing request persists all required effects or none of them. Plan confirmation, Position Change recording, Management Revision, Roll, Assignment, Exercise, correction, Daily Review Action reconciliation, and Restore must never expose a partially updated Trade, Journal obligation, Lifecycle index, Lot Match set, Deviation set, allocation, or lineage graph.

UI-orchestrated compensation and independent repository writes were rejected because interruption or conflict could leave a record that is locally valid but semantically false. Validation may occur before a transaction, but the exact candidate and all optimistic bindings are rechecked before the atomic commit.

Receipt-only success followed by a required read-back was also rejected. It moves ordinary result assembly into the caller, adds a second consistency boundary, and can observe a later state rather than the state the command committed. The accepted response therefore includes bounded post-commit state for directly changed subjects and effects, but not every indirectly affected list or report.

Consequences:

- Expected domain conflicts produce typed no-write results.
- A prepared change is inert view state and reserves no durable identity.
- Only the owning coordinator reports success after every participant is durable.
- Accepted mutations return their revision-bound post-commit result; the initiating caller does not perform a second read merely to obtain the state it just created or changed.
- Navigation, filtering, and ordinary read refreshes are not domain-changing commands.
