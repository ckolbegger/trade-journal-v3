# Optimistic bindings and shared-counter retry

Status: accepted, 2026-10-27. Refines [ADR 0002](0002-semantic-command-atomicity.md).

ADR 0002 rechecks every optimistic binding inside the atomic commit. Modules also keep shared counters in `meta`, such as the Market Data, Catalog, and Journal revisions, which every write in that module advances. A shared counter written as the value read plus one needs a binding of its own, or two concurrent commits both write the same next value and one advance is lost. But a counter is not the subject the trader acted on: when it is the only binding that moved, the command's own subject is unchanged, and reporting a conflict would be false.

Each command therefore distinguishes two kinds of binding:

- **Subject bindings** cover what the command was validated against: the Mark key's resolution revision, the Trade's fact revision, a referenced Catalog record, or the whole Catalog when label distinctness is judged against it. When a subject binding fails, the command returns its typed no-write conflict with the current state, as ADR 0002 requires.
- **Counter bindings** cover shared counters the command only advances. When the commit fails on counter bindings alone, the owning module re-reads, re-validates the command against the fresh state, and commits again, up to 3 attempts in all. If the counters keep moving, it returns its typed conflict and writes nothing.

An in-transaction increment primitive in persistence was rejected. It made `commit` resolve writes against an in-memory view, which in turn exposed write ordering, silent failure, and revision-stamp defects, and it spread a module's counter rule into the shared persistence layer. Retrying keeps persistence's write set static and its commit unchanged.

Consequences:

- Every write that advances a shared counter binds that counter. A commit with no checks that writes a counter read before the transaction is a defect.
- `commit` names the failed binding, so a module can tell a subject conflict from a counter-only conflict.
- A retry repeats the whole read, validation, and commit; it never reuses the earlier candidate. Seeding re-runs its preparation and adds nothing that another writer already added.
- Retries are bounded and local to the owning module; there is no general retry utility.
