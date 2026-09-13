# Authoritative Lifecycle State and derived Terminal Disposition

Status: accepted

Trade Lifecycle State is stored and indexed as `Planned`, `Open`, `Closed`, or `Abandoned` so normal lists do not replay an ever-growing history. It is not trader-entered and has no public setter: only the command that records the lifecycle-causing facts may change it, atomically with those facts. Trade Analysis independently derives the expected state for agreement checks, migration, correction, and Restore.

Terminal Disposition answers a different question: how a Closed Trade's exposure ended. It is derived from every effective disposing fact and preserves mixed Executions, Expiration, Assignment, Exercise, and cash settlement. It is never an authoritative captured field.

This hybrid was chosen over both derived-on-every-read lifecycle and an independently editable terminal label. It preserves scalable access without duplicating the factual explanation.
