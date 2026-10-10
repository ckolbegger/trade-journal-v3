# Trade Journal V3 canonical specification

This directory is the frozen, implementation-stack-neutral product specification for Trade Journal V3. It defines what a conforming application must do, the deep interfaces through which it does it, and the evidence a later implementation must provide. It requires standards-based PWA delivery but does not choose a programming language, framework, database, hosting provider, cache tooling, or implementation order.

The required product is an after-close journal for one trader recording U.S.-listed securities and options denominated in USD. Journal data belongs to one device-local Workspace. Brokerage Accounts are trading records, not application identities.

## Authority and interpretation

The words **must**, **must not**, **required**, and **forbidden** are normative. **May** identifies permitted flexibility. Examples explain a rule but do not narrow it.

When documents appear to overlap, use this order:

1. Domain definitions and invariants in [glossary.md](glossary.md).
2. Accepted decisions indexed under **Domain and decisions** below.
3. Module operation contracts indexed under **Architecture and interfaces** below.
4. Observable product scenarios in [acceptance/acceptance-contract.md](acceptance/acceptance-contract.md).
5. Visual reference material, which never overrides domain semantics or arithmetic.

Report a contradiction instead of silently choosing one interpretation. Internal implementation and UI component structure remain flexible where these documents do not make behavior observable.

## Product boundaries

Required now:

- Planning before deliberate entry, with a frozen Plan Baseline and completed Plan Reflection.
- Explicit decision-level Position Changes covering Executions, Assignment, Exercise, Expiration, cash settlement, and Rolls.
- Derived Positions, FIFO Lot Matches, lot-aware fees, P&L, Plan conformance, ongoing risk/reward, and Expiration Payoff.
- Immutable and transparently versioned Journal history, runtime-configurable prompts, and separate Journal Debt.
- Context-aware after-close Marks, optional provider recovery, Daily Bars, explicit gaps, and honest unavailable-observation handling.
- A guided, resumable Daily Review with an explicit saved Action for every eligible Trade.
- Deterministic Outcomes, Current Exposure, Process Scorecard, and categorical Journal Field reports.
- Standards-based PWA delivery with capability-gated Runtime Readiness, device-local offline use, safe updates, full backup, and validated atomic replace-only Restore.

Explicitly outside the MVP:

- Live or streaming trading, intraday valuation replay, and theoretical option pricing.
- International instruments, non-USD accounting, brokerage cash reconciliation, Account Snapshots, and an account-equity curve.
- Application login, hosted journal-data storage, automatic synchronization, and merge Restore.
- Campaign or lineage aggregation, provider-performance analytics, arbitrary Boolean queries, custom date ranges, nested grouping, and a general report builder.
- Automated coaching, LLM judgment, causal claims, or interpretive Insights. Future Insights is optional, advisory, consent-gated for external transmission, and never an MVP dependency.

## Canonical documents

### Domain and decisions

- [Canonical glossary](glossary.md)
- [Architecture: facts, pure analysis, and coordinators](adr/0001-domain-facts-pure-analysis-and-coordinators.md)
- [Semantic command atomicity](adr/0002-semantic-command-atomicity.md)
- [Authoritative Lifecycle State and derived Terminal Disposition](adr/0003-authoritative-lifecycle-and-derived-disposition.md)
- [Corrected economic history with visible audit](adr/0004-corrected-economic-history-with-visible-audit.md)
- [Journal Entry and Journal Debt are separate](adr/0005-journal-entry-and-journal-debt-are-separate.md)
- [Device-local Workspace and replace-only Restore](adr/0006-device-local-workspace-and-replace-only-restore.md)
- [Observed valuation and Expiration Payoff are separate](adr/0007-observed-valuation-and-expiration-payoff.md)
- [Standards-based PWA delivery and Runtime Readiness](adr/0008-pwa-delivery-and-runtime-readiness.md)
- [Storage protection is advisory, not a write gate](adr/0009-advisory-storage-protection.md)
- [Backup is a file download verified by read-back](adr/0010-backup-download-verified-by-read-back.md)

### Architecture and interfaces

- [Design overview](design/overview.md)
- [Trade Analysis](design/trade-analysis.md) — 6 operations
- [Trade Workflows](design/trade-workflows.md) — 6 operations
- [Trade Record](design/trade-record.md) — 9 operations
- [Journal](design/journal.md) — 10 operations
- [Market Data](design/market-data.md) — 8 operations
- [Daily Review](design/daily-review.md) — 4 operations
- [Performance Analysis](design/performance-analysis.md) — 4 operations
- [Reference Catalog](design/reference-catalog.md) — 7 operations
- [Trade Views and Reporting](design/trade-views-and-reporting.md) — 5 operations
- [Workspace](design/workspace.md) — 8 operations
- [UI contract](design/ui-contract.md)
- [Delivery contract](design/delivery-contract.md)

The external Pricing Provider port has one operation. Browser-host delivery capabilities provide PWA/readiness, storage-protection status, backup file download, and reading a trader-selected backup file without becoming domain interfaces. Persistence/Transaction is an internal seam and is never UI-callable.

### Acceptance and later evaluation

- [Implementation-stack-neutral acceptance contract](acceptance/acceptance-contract.md)
- [Evaluation planning protocol](evaluation/planning-protocol.md)
- [Source traceability and supersessions](evaluation/traceability.md)
- [Implementation-session kickoff prompt](evaluation/kickoff-prompt.md)
- [Screenshot reference index](reference/ui-screenshots/index.md)

## Conformance rules

A conforming implementation:

- is a standards-based PWA whose functional Runtime Readiness gate permits authoritative mutation only in a `Writable` session, without a browser or operating-system allowlist;
- exposes plain request/response behavior without subscriptions or domain events, and returns a revision-bound post-commit result sufficient to present the successful command without reading back directly changed state;
- preserves the operation families, inputs, outputs, invariants, and failure semantics while remaining free to choose internal code structure;
- performs every domain-changing command atomically with all required related effects;
- treats authoritative facts and saved audit history as durable, while private caches and projections remain rebuildable;
- advertises only installed capabilities that are complete within their declared scope;
- satisfies every applicable acceptance scenario and records the evidence in its separately reviewed implementation plan.

Early releases may implement honest dependency-closed subsets of the target interfaces, but each ordinary release boundary must be a complete vertical slice reachable through the production UI and operating through its required application/domain behavior and persistence/infrastructure. Layer-specific work belongs inside the vertical slice that first uses it. A specifically approved layer-only planning checkpoint advertises no completed capability and is not an installed release boundary.

An uninstalled capability is absent from the Installed Capability Manifest. It must not be represented as a domain-level `Unavailable` result, because `Unavailable` means an installed calculation applies but cannot be produced honestly from the supplied evidence.

## Handoff to implementation planning

The next session must first read this index, the glossary, overview, relevant module contracts, UI and delivery contracts, and the acceptance contract. Standards-based PWA delivery and browser-neutral Runtime Readiness are frozen inputs. The session then follows [evaluation/planning-protocol.md](evaluation/planning-protocol.md) to propose the remaining technology choices and an ordered vertical-deliverable plan with task-level tests, mock-free real-stack integration evidence, and an independent browser-critic gate for every deliverable. Product decisions in this directory are frozen unless the user explicitly reopens one. No implementation begins until the user approves that separate plan.
