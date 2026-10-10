# Evaluation implementation-planning protocol

## Purpose

This protocol governs the later interactive session in which an evaluated coding assistant chooses implementation technology and produces a plan. It does not select a stack, order implementation work, or contain the plan itself.

Product semantics, deep interfaces, UI/delivery guarantees, and acceptance scenarios in `specs/` are frozen inputs. Planning quality is evaluated partly by how well the assistant maps those requirements to a simple, verifiable design without reopening settled product decisions.

## Entry conditions

Planning begins only when:

- the complete `specs/` tree is present and designated as the approved product baseline;
- repository instructions have been read;
- the evaluator identifies the implementation workspace and any pre-existing code constraints the later session is authorized to inspect;
- no implementation or speculative scaffolding is performed during specification intake.

If a genuine contradiction is found, the assistant cites both normative passages and pauses for a product-level resolution. Difficulty, preferred library behavior, or an inconvenient architecture is not a contradiction.

## Phase 1 — read and freeze the specification model

The assistant reads, in order:

1. [specification index](../README.md), including precedence and scope;
2. [glossary](../glossary.md) and selective ADRs indexed under [Domain and decisions](../README.md#domain-and-decisions);
3. [design overview](../design/overview.md), every module contract, [UI contract](../design/ui-contract.md), and [delivery contract](../design/delivery-contract.md);
4. [acceptance contract](../acceptance/acceptance-contract.md);
5. [traceability](traceability.md) only for provenance or an apparent conflict.

Before discussing technology, it returns a short comprehension check covering:

- authoritative facts versus pure derivations versus coordinators;
- semantic atomicity and revision-bound post-commit mutation results under plain request/response;
- stored Lifecycle State versus derived Terminal Disposition;
- corrected economic history versus visible audit history;
- Journal Entry versus Journal Debt;
- Mark precedence, exact-date availability, and gaps;
- standards-based PWA identity, Offline Release Inventory, browser-neutral Runtime Readiness, and its persistence-level write gate;
- device-local/offline/backup/Restore boundary;
- all ten public module interfaces, the external Pricing Provider, browser-host delivery capabilities, and the internal Persistence/Transaction seam.

This check identifies misunderstandings; it does not solicit new product design.

## Phase 2 — propose technology choices and tradeoffs

The assistant presents a small number of credible stack profiles, including one recommended profile, and evaluates each against the frozen contracts. At minimum, each profile addresses:

- standards-based PWA identity, production HTTPS delivery, installation where exposed, browser-tab operation, a secure-loopback strategy for local browser automation where used, and stopped-app offline restart;
- browser-neutral Runtime Readiness on every launch and after update/Restore, including isolated storage probe, plan-derived capacity/headroom, service-worker control, complete Offline Release Inventory, the persistence-level write gate, and advisory storage-protection reporting and warning;
- transactional persistence across Trade, Journal, Market Data, Catalog, and Workspace replacement;
- exact decimal Money/Price/Quantity handling and deterministic time/calendar behavior;
- versioned migrations and complete portable backup without secrets, including ordinary file download, read-back verification of the trader-selected saved file, and `CompletedBackupReceipt` semantics;
- snapshot-consistent reads, optimistic revisions, and rebuildable indexes/projections;
- 25,000-Trade/200,000-fact scale and both latency targets;
- responsive/accessibility verification;
- deterministic unit, integration, failure-injection, offline, migration, Restore, and benchmark evidence;
- library/runtime longevity, portability, complexity, and operational cost.

Claims that a technology provides atomicity, offline durability, or migration safety by default must be demonstrated against the semantic boundary, not accepted from marketing terminology. The user chooses/approves the stack after seeing the tradeoffs.

## Phase 3 — produce a vertical-deliverable plan and task graph

Only after stack approval, the assistant drafts an implementation plan as an ordered set of incremental vertical deliverables. A **vertical deliverable** is a dependency-closed set of capabilities that a person can see and operate through the production UI and that traverses the real application/domain behavior and persistence/infrastructure required by those capabilities. It is runnable and testable end to end. A **task** is a unit of work inside a deliverable and may be specific to the UI, application/domain, persistence, infrastructure, or test layer; a layer-specific task is not itself a deliverable or release boundary.

Every planned deliverable must be narrow enough to implement and review incrementally but complete within its advertised scope. It includes all applicable validation, result states, error behavior, atomicity, audit/history, durability, accessibility, and acceptance evidence rather than deferring required correctness as later hardening. A genuinely small scope may have one vertical deliverable only when the plan explains why further division would produce an unusable or layer-only increment.

The plan's tasks must form a dependency-valid graph whose vertical-deliverable groupings are tracer bullets. The plan must:

- name the selected technology versions and architectural mappings;
- map every canonical module/operation to an implementation boundary without changing its public meaning;
- preserve the approved dependency direction and prevent UI/domain-calculation duplication;
- identify the transaction, revision, exact-decimal, clock/calendar, backup verification receipt, migration, Installed Capability Manifest, Web App Manifest, Offline Release Inventory, Runtime Readiness, and persistence-level `RuntimeNotWritable` write-gate mechanisms;
- identify each deliverable's user-visible outcome, production-UI entry point, complete capability set, and applicable acceptance scenarios;
- deliver thin but complete end-to-end behavior early while retaining facts required by later capabilities;
- declare prerequisites and blocking edges between tasks;
- keep each vertical deliverable runnable, reviewable, and reversible;
- include migration/compatibility treatment for every durable schema change;
- include target-scale indexes/projections with invalidation, correction, Restore, and reconstruction behavior;
- avoid generic frameworks, abstractions, or extension points without a concrete frozen requirement.

The plan must sequence the in-scope work as vertical deliverables. Each release boundary advertises only complete capabilities and preserves all foundational data needed by later accepted behavior or discloses irrecoverable historical coverage before approval.

PWA identity, the complete Offline Release Inventory, Runtime Readiness, and the persistence-level `RuntimeNotWritable` write gate are required tasks inside the first vertical deliverable that can mutate authoritative data. They are not optional hardening and cannot be deferred as a later layer-only deliverable.

### Layer-only exception gate

The planner must not ordinarily create a deliverable whose observable effect exists in only one layer, including a UI-only, API-only, domain-only, persistence-only, infrastructure-only, or test-only deliverable. Necessary layer-specific and structural work belongs inside the first vertical deliverable that uses it.

If the planner believes a layer-only deliverable is unavoidable, it must pause before freezing the plan and present a specific exception for manual approval. The exception must state:

- why the work cannot be included as tasks within a vertical deliverable;
- why no smaller independently usable vertical slice is available;
- that the checkpoint advertises no completed capability;
- how the isolated work will be verified;
- which later vertical deliverable consumes it and the blocking edge between them;
- any effect on future facts or historical coverage.

Approval of the overall plan does not implicitly approve an exception. Each exception requires its own recorded user approval.

### Required task and deliverable evidence

Every non-structural task is behavior-bearing and must be implemented with test-driven development (TDD). The plan contains its required unit-test cases as one or more `describe("<behavior>")` groups with concrete `it should ...` statements. Each statement identifies the confirmed public seam under test, its conditions, and its observable outcome rather than merely naming a test or asserting an implementation detail. Unit tests may replace task dependencies with mocks when isolation is useful.

For each planned test case, the implementation plan requires and the execution record preserves this sequence:

1. **Red:** before writing the production behavior, add one test through the identified seam, run it, and confirm that it fails because the planned behavior is absent or incorrect. A test that passes immediately or fails because of syntax, configuration, fixtures, or an unrelated defect is not valid red evidence.
2. **Green:** make the smallest production change that satisfies that test, rerun it, and confirm that it passes without breaking the task's already-green tests.
3. Repeat red then green for the next planned behavior. Do not write all tests first and then all implementation.
4. After the task is green, any refactoring occurs as a separate review step and the affected unit tests are rerun and kept green.

No non-structural task is complete without recorded red and green commands and outcomes for every planned `it should ...` case.

A purely structural task, such as build configuration, test-environment setup, or a mechanical migration step, does not require invented `describe`/`it should` unit tests. It instead states the exact automated or reproducible verification, expected result, and deliverable behavior that depends on it.

Every vertical deliverable also defines automated integration tests that prove its complete functionality end to end through the real application stack. These tests:

- use no mocks, stubs, or canned responses for application dependencies;
- traverse the production code paths and every application layer used by the capability;
- use real persistence/infrastructure behavior and prove durable state as well as the visible result;
- may use isolated dependency instances or behaviorally compatible test implementations, such as `fakeIndexedDB` instead of a browser-owned IndexedDB instance or a PostgreSQL test container instead of the production PostgreSQL instance;
- disclose every test-specific infrastructure replacement and must not use it to bypass an application layer or weaken the production contract;
- join a cumulative integration suite that, together with the cumulative unit suite, protects previously accepted deliverables.

### Independent browser-critic gate

The plan places this gate at the end of every vertical deliverable, after its implementation is complete and the cumulative unit and integration suites pass:

1. The main agent spawns a fresh critic agent for that verification attempt. The critic receives access to the complete frozen `specs/` baseline and implementation plan, with the current deliverable and future capability boundaries identified.
2. The critic starts the application server/runtime itself and uses a browser against the production UI to exercise every planned browser flow for the current deliverable. The automated suites, not the critic, carry full regression responsibility for earlier deliverables; intentionally future capabilities are not defects.
3. The critic does not modify the implementation. It returns a structured report for each flow with the browser actions performed, observed result, and pass/fail status. A failure includes reproducible steps, expected versus actual behavior, and relevant screenshot, console, or server evidence.
4. Every implementation defect found by the critic is also a testing failure. Before changing implementation, the main agent adds or strengthens the most appropriate unit, integration, or automated browser test, runs it, and confirms that it fails for the reported defect. The main agent then implements the fix and reruns the complete cumulative unit and integration suites.
5. After a fix, the main agent spawns another fresh critic to repeat the complete current-deliverable browser verification. The loop continues until a fresh critic reports all current-deliverable flows passing.
6. If a finding exposes a genuine ambiguity or contradiction in the specification or approved plan, the critic classifies it separately. The main agent pauses for manual clarification rather than inventing expected behavior or encoding it in a test.

A deliverable is not complete without a passing fresh-critic report. If the execution environment cannot provide a fresh agent, start the application, or provide browser control, implementation stops and reports the blocker rather than self-certifying the deliverable.

## Phase 4 — map acceptance scenarios to evidence

The plan includes a traceable matrix with one row per [acceptance scenario](../acceptance/acceptance-contract.md):

```text
Scenario ID
vertical deliverable
planned implementation task(s)
task-level TDD red/green or structural-verification specification
mock-free real-stack integration case and fixture
independent browser-critic flow where applicable
exact command or reproducible procedure once available
expected observable result and durable-state proof
failure/nonmutation or restart evidence where applicable
status: planned | covered | intentionally not advertised
```

Every advertised capability must cover all applicable scenarios. Foundational atomicity, audit, backup/Restore, offline, and reconstruction scenarios cannot be omitted merely because a later UI/report capability is deferred.

The matrix distinguishes:

- pure calculation examples;
- module contract tests;
- multi-module transaction and evidence-race tests;
- browser/responsive/accessibility behavior;
- PWA installation where exposed, ordinary browser-tab operation, production HTTPS evidence, any browser-recognized secure-loopback automation, browser-neutral readiness pass/failure cases, and exact browser/operating-system evidence provenance;
- repeated-launch, runtime-failure, `Recovery Only`, restart/offline/update/migration/Restore tests;
- verified, unverified, and failed-verification backup results plus exact-target `CompletedBackupReceipt` enforcement before Restore;
- deterministic target-scale correctness and percentile benchmarks.

It also states how secrets exclusion is verified and how no-write/rollback claims compare authoritative before/after state.

## Phase 5 — interactive review

The user and assistant review one consequential planning decision at a time. The assistant leads with a recommendation and concrete tradeoff, records accepted choices, and updates the plan/matrix in place. Review specifically checks:

- no product decision has been silently changed;
- module interfaces remain deep and dependency-valid;
- transaction boundaries match semantic commands;
- facts required by later increments are captured at the correct moment;
- every ordinary deliverable is a production-UI-reachable vertical slice;
- the first mutating deliverable includes complete PWA/offline identity and Runtime Readiness at both UI and persistence boundaries, with the exact `RuntimeNotWritable` result branch;
- support is decided by functional checks without browser or operating-system allowlists;
- layer-specific tasks are enclosed by a vertical deliverable and every layer-only exception has specific recorded approval;
- task-level TDD cases and red/green evidence procedures, structural checks, mock-free integration coverage, and browser-critic flows are concrete;
- failure/restart/rebuild paths are first-class, not cleanup tasks;
- performance work preserves complete results and coverage;
- task size and blocking edges are feasible for the intended execution harness;
- all evidence commands are appropriate to the selected stack and environment.

Open implementation unknowns are made explicit. Any unresolved choice that could materially change data semantics, public behavior, or the task graph prevents freezing.

## Phase 6 — freeze before implementation

The approved plan receives:

- a stable repository path and immutable review revision or digest;
- selected stack/version profile;
- exact browser and operating-system versions used for delivery evidence, recorded as provenance rather than a support allowlist;
- complete task graph and ordered vertical-deliverable/release/capability boundaries;
- any specifically approved layer-only exceptions and their consuming vertical deliverables;
- acceptance-to-evidence matrix;
- per-task TDD red/green or structural evidence and per-deliverable mock-free integration and fresh browser-critic gates;
- explicit assumptions and remaining non-product implementation risks;
- user approval recorded after the final review.

Only then is the [kickoff prompt](kickoff-prompt.md) instantiated with that exact plan path/revision. Implementation must treat both the plan and `specs/` as read-only baselines. A required deviation pauses work, identifies affected acceptance scenarios and durable compatibility, and obtains approval before the frozen plan is revised.

## Planning completion checklist

- [ ] Every specification document was read.
- [ ] Comprehension check agrees with the canonical partition and glossary.
- [ ] Stack alternatives and tradeoffs were presented; one was explicitly approved.
- [ ] Every module operation and internal/external seam has an implementation mapping.
- [ ] The first mutating deliverable includes standards-based PWA identity, a verified Offline Release Inventory, browser-neutral Runtime Readiness, and persistence-level `RuntimeNotWritable` rejection outside `Writable`.
- [ ] Capacity/headroom derivation and all `Unsupported`/`Recovery Only`/unreadable-store Integrity Blocked checks and evidence are explicit; no browser or operating-system allowlist decides support.
- [ ] The task graph contains explicit blocking edges and ordered vertical-deliverable boundaries.
- [ ] Every ordinary deliverable is independently usable through the production UI and complete through application/domain behavior and persistence/infrastructure.
- [ ] Layer-specific work is contained within a vertical deliverable; every unavoidable layer-only exception has its own recorded manual approval and advertises no capability.
- [ ] Every non-structural task specifies concrete `describe`/`it should` unit tests, a confirmed public test seam, and per-case red/green evidence; every structural task specifies an exact verification.
- [ ] Every deliverable specifies mock-free, real-stack integration tests using disclosed test infrastructure.
- [ ] Every deliverable ends with the fresh browser-critic gate and mandatory test-first repair loop.
- [ ] Every acceptance scenario maps to reproducible planned evidence.
- [ ] PWA installation/browser-tab, production HTTPS and local secure-context strategy, repeated readiness, offline, update, migration, verified/unverified backup download and Restore, recovery-only, reconstruction, responsive, accessibility, and scale evidence are planned with exact environment provenance.
- [ ] No unsupported capability is advertised and no product semantics were reopened silently.
- [ ] The user reviewed and approved the final plan.
- [ ] The plan path and immutable revision/digest are recorded for kickoff.
