# Delivery contract

## Product boundary

Trade Journal V3 is a standards-based, installable, local-first Progressive Web Application (PWA) for phone and laptop. It is delivered from a secure hosted origin and may also run in an ordinary browser tab when the same Runtime Readiness requirements pass. It serves one trader in one device-local Workspace. It has no application login/account, server-hosted journal-data backend, automatic cross-device synchronization, or brokerage integration requirement.

This contract fixes PWA delivery and states observable guarantees. Framework, persistence engine, cache implementation/tooling, worker code structure, hosting provider, and deployment pipeline remain future planning choices.

## PWA identity, installation, and Runtime Readiness

The application has one Web App Manifest with a stable application identity, name, icons, launch URL, navigation scope, and standalone display request. A versioned service worker owns an immutable Offline Release Inventory containing every application asset and digest required for that release to start and support its installed capabilities without a network. These delivery and data artifacts are distinct:

| Artifact | Owner and purpose | Version/integrity role | Trader data |
|---|---|---|---|
| Web App Manifest | Hosted application identity and launch presentation | Stable identity; deployed with the release | None |
| Offline Release Inventory | Service worker's complete offline application assets | Immutable release identity plus an asset digest for every entry | None |
| Installed Capability Manifest | Installed release's dependency-closed public capabilities | Immutable capability identity bound to the installed release | None |
| Workspace Backup Manifest | One exported Workspace artifact's contents, exclusions, and compatibility | Schema/capability versions, counts, section digests, and full artifact digest | Workspace-derived metadata; no secrets |
| Completed Backup Receipt | Workspace proof that the trader's saved backup file was read back and verified | Exact Workspace binding, artifact/manifest digests, and read-back verification evidence | Workspace-derived metadata; no artifact contents or secrets |

Where the host exposes application installation, the product offers or explains that installation flow. Absence of a vendor-specific install prompt does not by itself make the environment unsupported, and successful installation does not by itself make it safe for journal data. An ordinary browser tab may provide the complete product when Runtime Readiness passes.

Support is determined by functional checks, never browser name, browser family, operating system, or user-agent identity. Before enabling Workspace initialization, Restore application, or any authoritative domain/configuration mutation, every application launch establishes Runtime Readiness by confirming all of the following:

1. the authoritative storage mechanism opens and completes an isolated diagnostic transaction that leaves no authoritative fact;
2. available capacity meets an implementation-plan-derived minimum for the mature Workspace plus temporary migration and backup headroom;
3. the intended versioned service worker controls the application; and
4. the current release's complete Offline Release Inventory is present and digest-valid.

Every launch also asks the host whether origin storage is persistent and reports protection as Protected, Best Effort, or Unavailable. Protection is advisory and does not decide Runtime Readiness. When it is not Protected, the UI keeps a visible warning that the browser may clear the data, recommends a backup, and, where the host can request it, offers one explicit user action through `Workspace.requestDurability`; the warning never disables writes. Passing every check produces `Writable`. The gate runs on every launch and again after application update activation and Restore. A later storage or release-integrity failure invalidates `Writable` immediately and prevents the next mutation.

When readiness fails before a readable Workspace exists, the environment is `Unsupported`. The application identifies every failed check, offers safe retry where meaningful, recommends trying another browser, and creates or imports no Workspace data. When an existing Workspace remains readable, readiness is `Recovery Only`: ordinary reads and backup export remain available, but every authoritative mutation and Restore application returns the cross-cutting `RuntimeNotWritable` result at both the application and persistence/transaction boundaries. Only a downloaded backup whose saved file is read back and verified produces a `CompletedBackupReceipt`; if stored data cannot be read or the saved file has not been verified, the application must not claim that a completed backup exists.

If a known or possible existing storage root cannot be read, Runtime Readiness is `Unsupported` and Workspace status is Integrity Blocked. This is not an empty first run: the product offers only safe retry/recovery guidance and must not initialize, import, overwrite, Restore, or report a completed backup over that root.

A different browser has independent origin storage. Trying another browser does not transfer the current Workspace; a verified backup (`CompletedBackupReceipt`) followed by Restore on a `Writable` installation provides that deliberate transfer.

## Offline guarantee

After one successful online load and `Writable` Runtime Readiness on a device, the same release must later re-establish readiness and support every installed manual workflow with no network, including after the browser/application has been fully stopped. This includes Trade/Journal/Mark/reference entry, Daily Review, deterministic local reporting, View history, backup creation, and Restore from a locally supplied artifact. The offline readiness check itself must not require a network.

Features that genuinely require a configured Pricing Provider may report a current operational diagnostic while all Manual alternatives remain usable. Network loss must not prevent access to already stored authoritative data or turn it into false Empty/Unavailable domain state.

Phone and laptop installations are independent. A backup can copy a Workspace between them, but later changes do not synchronize.

## Update safety

The hosted application remains the update source. While online, a device may detect/download a newer release without interrupting the running installed release. A new service worker may advertise an update only after the new Offline Release Inventory is complete and digest-valid; it must not force control away from the active release. Observable behavior must satisfy:

1. the current version continues safely while an active workflow is underway;
2. the trader receives a clear update-available notice;
3. activation occurs only at a safe reload/restart, never by mid-command or mid-form service-worker takeover;
4. entered-but-unsaved values are not silently discarded by background activation;
5. offline devices retain the last successfully installed compatible version;
6. devices update independently and update behavior never implies data synchronization.

If safe activation cannot preserve an active form, the application must defer activation and say why.

After activation, Runtime Readiness and any required Workspace migration complete before mutations are enabled. Failed asset staging, readiness, or migration leaves the prior compatible installed release and Workspace uncorrupted and does not report the new release Ready.

## Data migration and recovery

Every durable representation change has an explicit version and a supported forward migration path. Migration is staged and validated before atomic activation. It is lossless for every authoritative identity, fact, audit revision, definition snapshot, and provenance field supported by the source version.

A failed migration leaves the prior Workspace uncorrupted and either readable by the prior compatible installed version or recoverable using an offered backup/recovery route. The product never reports Ready over a partially migrated journal. Unknown newer data, missing migration links, or required lossy conversion are rejected with current data unchanged.

Update delivery must retain a safe compatibility/recovery posture until migration succeeds. Exact rollback machinery is not prescribed.

## Installed capability declaration

Each installed release publishes an immutable dependency-closed Installed Capability Manifest covering supported operations/variants, complete report and scorecard families, provider adapters, and backup/schema ranges.

- A declared capability includes its validation, result states, audit behavior, necessary facts, and acceptance evidence.
- A partially implemented operation/report family is not declared.
- An absent capability is absent from navigation and ordinary calls; it is not disguised as domain-level `Unavailable`.
- Each ordinary release boundary is a complete vertical slice: its declared capabilities are reachable and usable through the production UI and operate through their required application/domain behavior and persistence/infrastructure.
- Layer-specific enabling work is contained inside the vertical slice that first uses it. A specifically approved layer-only planning checkpoint advertises no completed capability and is not an installed release boundary.
- Incremental delivery adds capabilities without changing the meaning of earlier facts or interfaces.
- Facts needed by a later capability must already be captured before the relevant behavior occurs, or the later feature must disclose historical coverage loss rather than inventing it.

## Workspace portability

One self-contained versioned backup is the portability unit. It leaves the application as an ordinary file download, so every browser that passes Runtime Readiness can create one; it counts as completed only after the application reads back and verifies the trader-selected saved file. Its semantic content, exclusions, validation, migration, safety-offer, and replace-only atomic application are defined in [Workspace](workspace.md). The file representation is intentionally unspecified.

Secrets never enter the backup. Private projections/indexes/caches may be omitted only when reconstruction produces observationally equivalent results. Restore never merges, selectively imports, or remints stable identities.

## Rebuild equivalence

After Restore, migration, or deliberate deletion/reconstruction of private derived state, the product must reproduce the same observable results from the same authoritative facts and explicit clock/evidence inputs:

- effective Trade and Journal histories;
- stored Lifecycle State and independently verified agreement;
- active FIFO Lot Matches and fee/P&L results;
- deterministic Deviation occurrences and evidence links;
- Trade lists/detail/replay;
- Daily Review eligibility, progress, and completion;
- all installed deterministic reports, groups, coverage, and contributor identities.

Opaque revision/snapshot tokens may differ when newly generated, but stable domain identities, values, ordering, classifications, and audit navigation must not. A mismatch is an integrity failure, not an acceptable cache variation.

## Responsive delivery

The same installed application provides the [UI contract](ui-contract.md) at supported viewport widths. Live viewport changes switch between narrow bottom navigation and wide left-sidebar layout without reload or lost state. Capability, workflow, and accessibility parity are required; desktop and mobile are not separate products with divergent semantics.

## Scale and latency

The mature evaluation workload is:

- 25,000 Trades over roughly five years;
- about 20–30 Trades per active day;
- 20–200 simultaneously Open Trades, benchmarked at 200;
- about 200,000 Execution/settlement facts;
- representative Marks, Daily Bars, Journal Entries, definition revisions, and correction history.

In one disclosed common local evaluation environment with no network dependency:

- cold startup p95 is at or below 2,500 ms to a complete interactive initial screen;
- warm open-list navigation p95 is at or below 1,500 ms to a complete interactive result.

Evaluation must disclose hardware/software conditions, dataset generator/provenance, run count, warm/cold definition, percentile method, and raw timing evidence. Correctness checks run before and after the benchmark. Meeting latency by omitting required rows, calculations, coverage, or integrity checks is a failure.

Normal startup and Open selection must not replay every historical Trade or issue one storage query per Trade. Private acceleration is allowed when invalidation, correction, migration, Restore, and rebuild equivalence remain correct. Apart from stored authoritative Lifecycle State, private acceleration never becomes a competing source of truth.

## Durability and failure behavior

Every semantic mutation is all-or-nothing and survives a clean restart after acknowledged success. Acknowledged success includes the revision-bound post-commit state needed to present the command's result and does not depend on reading back directly changed state. Expected validation/conflict results write nothing. An interrupted transaction recovers to its committed before or after state, never a cross-module mixture.

The application reports the host platform's actual local-data protection honestly as Protected, Best Effort, or Unavailable. Protection is advisory: it neither satisfies nor fails Runtime Readiness. Best Effort and Unavailable are shown as a visible warning, never hidden. A request for stronger durability is an explicit gesture and cannot promise protection from device loss. Backup remains necessary.

## Delivery acceptance evidence

The future approved implementation plan must map this contract to repeatable evidence for Web App Manifest identity and launch, complete Offline Release Inventory, browser-neutral Runtime Readiness decisions, storage-protection reporting and warning, every readiness failure and write prohibition, `Recovery Only` viewing/backup, offline cold restart, update deferral/activation, failed and successful migration, interrupted semantic writes, verified, unverified, and failed-verification full-backup downloads, Restore, secrets exclusion, live responsive resize, accessibility, target-scale correctness, rebuild equivalence, and latency percentiles. Evidence names the exact browser and operating-system versions used without turning them into an allowlist or certification boundary. Production deployment evidence demonstrates the secure HTTPS origin. Local automated browser evidence may use a loopback origin only when the tested browser recognizes it as a secure context for the required service-worker and storage behavior; that accommodation does not replace production HTTPS evidence. The plan may select appropriate tools only after the remaining technology choices are reviewed.

This document defines no implementation sequence. See the [evaluation planning protocol](../evaluation/planning-protocol.md).
