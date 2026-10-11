# Planning decision record — 2026-10-10

Branch-local planning input for the `deepseek-v41-flash` implementation. **Not part of the frozen
baseline.** `specs/` remains authoritative and is treated as read-only; this file records resolutions
of specification under-specification that a future implementation plan must consume.

Decisions recorded here are user-approved. They constrain this branch's implementation and do not
silently amend `specs/`.

---

## D1 — Journal Anchor resolution statuses at `save`

**Status:** settled by user decision, 2026-10-10.

### The gap

`specs/design/journal.md:173-179` shows `save` receiving a four-valued anchor status and then
appending unconditionally, with no branch:

```mermaid
J->>TR: resolveAnchors(committed Trade or Execution)
TR-->>J: Effective, Superseded, Voided, or Unknown
J->>J: Validate definition and append immutable Entry
```

The prose (`journal.md:163`) requires "one committed Anchor" but never states which statuses are
acceptable. `Unknown` cannot be intended to permit the append, so the contract as drawn is
incomplete.

### Decision

Anchors are bound by **stable fact identity, not revision** (`JournalAnchor = Standalone |
TradeAnchor(TradeId) | ExecutionAnchor(ExecutionId)`, `journal.md:111`). Replace preserves fact
identity and Void preserves addressability, so only a non-resolving anchor is invalid.

| `resolveAnchors` result | `save` behavior |
|---|---|
| `Effective` | Attach; render current label |
| `Superseded` | **Attach**; render current label alongside the historical/corrected status |
| `Voided` | **Attach**; render current label alongside a Voided/historical status |
| `Unknown` | **Typed no-write rejection** naming the unresolved anchor; nothing is written |

Additionally:

- The accepted `save` result **carries each anchor's resolution status** in its post-commit
  projection, so the UI can label corrected/Voided anchors without a follow-up read (consistent with
  the no-read-back rule in `overview.md` and the UI contract's historical/current label promise).
- `Edit` and `Addendum` are **never blocked** because an anchor has since become Superseded or
  Voided. An `Addendum` inherits the parent's preserved Anchor (`journal.md:129`) and carries the
  status.
- Existing immutability rules are unchanged: a workflow-created Anchor cannot be reassigned, while
  `Edit` of a directly authored Entry may still correct an erroneous Anchor or moment time
  (`journal.md:131`).

### Rationale

- `journal.md:127`: a Trade narrative "includes Entries anchored to that Trade and to all of its
  current, **superseded, or Voided** fills, each once."
- `AC-CORR-003`: superseded facts remain addressable; "old Execution Anchors **resolve as
  historical** and are never silently redirected." Resolution succeeds rather than failing.
- `trade-record.md:124`: "A formerly valid Execution Anchor survives Replace, Void, and Rebuild."
- Precedent for `Unknown` being invalid: Restore preparation validates "exactly one Anchor" and
  Workspace batch-validates external Trade/Execution/Tag references (`journal.md:221`).
- Rejecting Voided anchors would make a reflection on a voided false entry **unrecordable against
  its subject** — there is no effective anchor to re-target to — which defeats the product's purpose
  of capturing behavioral evidence around mistakes.

### Not changed

No new operation, no new field on `JournalAnchor`, and no change to the four-status union. This is a
behavioral reading of an existing contract, not a schema change.

### Open follow-up

If this reading is to bind **all** implementation branches rather than this one, it should become a
`specs/adr/` amendment to the shared baseline. That changes what every branch reads and has not been
done.

---

## D2 — Review staleness results: `ReviewChanged` vs `Conflict`

**Status:** settled by user decision, 2026-10-10.

### The gap

`specs/design/daily-review.md:110`: "If a Mark, acknowledgment, Daily Bar, Trade fact, or existing
Action changed, Save returns `ReviewChanged` or `Conflict` and writes nothing." Five trigger kinds and
two result names, with no mapping between them.

The pressure comes from `daily-review.md:82`, which binds five independently-versioned things into one
command — the exact Review view, Trade/Fact revision, evidence snapshot, obligation key, and rendered
form revision — while only two failure names exist. Diagram 3 (`daily-review.md:112-121`) shows a
third, unnamed outcome for the Market-evidence path ("No write and refreshed evidence").

Scoping note: the acceptance contract is deliberately label-agnostic here. AC-REV-005 requires Save to
return "changed/conflict **with refreshed evidence**", so it mandates the payload, not the name. This
decision therefore does not change what passes acceptance; it removes cross-implementation divergence
and fixes what the trader is told to do next.

### Decision

Two names, two scopes. `ReviewChanged` is **review-scope**: the assembled Review view itself lost
coherence. `Conflict` is **subject-scope**: a binding supplied with this one command no longer matches.

| Binding | Scope | Result | Payload the trader needs |
|---|---|---|---|
| Review view (eligibility, order, progress) | review | `ReviewChanged` | refreshed Review binding and which items changed |
| Trade/Fact revision | subject | `Conflict` | current Trade revision and changed domains |
| Evidence snapshot | subject | `Conflict` | refreshed frames and the new `MarketDataSnapshotId` |
| Obligation key | subject | `Conflict` | the existing outcome and its identity, for "already saved" and navigation |
| Rendered form revision | subject | `Conflict` | the current `EntryDefinition` revision, to re-render |

Supplementary rules:

- **Report every stale binding**, not the first, mirroring AC-DEL-004's "reports every known failed
  check rather than stopping at the first." The payload enumerates all stale bindings, so
  implementations cannot diverge on evaluation order.
- **Review-scope dominates the result name:** `ReviewChanged` is returned when the Review-view binding
  is stale, otherwise `Conflict`. A review-level restatement makes per-form advice moot.
- **No third result name.** The Market-evidence path returns `Conflict` carrying the refreshed frames
  and new snapshot id, which is what AC-REV-005's "with refreshed evidence" requires.
- **`ResolveReviewDebt` follows the same mapping.** The concurrency discipline is not specific to
  Action saves, even though `daily-review.md:82` phrases its requirements around saving an Action.
- **Validation is a separate category.** `ui-contract.md:45` distinguishes "validation, and conflict
  outcomes", and AC-REV-003 has "Exit/Roll/Adjust without Intent reject". That member is named
  `Rejected`, matching existing use in `ReadViewResult` and `saveSettings`'s "typed Rejected".
  `NeedsTradeWorkflow` remains an orthogonal routing rejection.

### Rationale

- `daily-review.md:68` already uses `ReviewChanged` for exactly one thing: `getTrade` returning it when
  "the overview binding is no longer coherent." Review-scope is the term's established meaning inside
  this module; reusing it for a per-Trade revision mismatch would make the two indistinguishable and
  leave `Conflict` vestigial.
- `Conflict` consistently means "a supplied binding no longer matches" elsewhere: `workspace.md:35`
  `saveSettings` returns "Conflict with current settings"; `workspace.md:110` `exportBackup` returns
  "Conflict with the current binding"; Trade Workflows uses "no-write conflict."
- Trade Views' `ChangedDuringAssembly` is the read-side sibling of `ReviewChanged`, keeping the result
  family internally consistent.

### Not changed

No new operations (`DailyReview` remains 4), no new stored state, no change to the five bindings or to
the one-outcome-per-obligation-key rule, and no acceptance scenario change.

---

## D3 — Approved implementation stack

**Status:** settled by user decision, 2026-10-10 (planning-protocol Phase 2). Exact versions are pinned
later, in the plan (Phase 6 requires the selected stack/version profile).

### Decision

| Layer | Choice |
|---|---|
| Language | TypeScript, strict |
| Build | Vite |
| Presentation | React |
| Authoritative store | **IndexedDB**, behind the Persistence/Transaction seam |
| Schema layer | Object store per fact module + lifecycle-index store + rebuildable projections |
| Atomic boundary | One IndexedDB multi-store transaction (`oncomplete` / `onabort`) |
| Restore and migration | Isolated candidate stores, then an atomic pointer flip |
| Money / Price / Quantity | `decimal.js` behind a Money/Price/Quantity value layer; never JS `number` |
| Time | Injected `Clock` port; Economic Time, U.S. Trading Date, and Save Time kept distinct |
| Session calendar | Versioned U.S. market-session data (the spec's session-policy revision) |
| PWA | `vite-plugin-pwa` / Workbox for manifest and precache, plus our own Offline Release Inventory and Runtime Readiness module |
| Tests | Vitest + `fake-indexeddb` (Node), Playwright (browser integration, critic gate, axe-core) |
| Hosting | Static HTTPS; no backend |

### Rationale

IndexedDB carries the decision. It is the only baseline browser storage with real multi-store ACID
transactions and rollback, which maps onto the spec's "one atomic commit/rollback boundary spanning
every fact-module effect." It provides real indexes for the stored Lifecycle State and bounded paged
reads (satisfying "no all-history replay, no one-query-per-Trade"), is baseline across desktop and
mobile including workers so support can be decided by functional checks rather than an allowlist, and
its aborts roll back, giving testable crash semantics. The protocol also names `fakeIndexedDB` as an
acceptable behaviorally-compatible substitute, which indicates this is the intended store.

React is a low-consequence pick: all ten domain modules are pure TypeScript behind interfaces, so the
UI framework touches presentation only. React is chosen for accessibility and browser-verification
ecosystem maturity, which this spec demands heavily.

### Rejected alternatives

- **Svelte + IndexedDB** — viable and leaner, with a smaller runtime. Rejected on ecosystem maturity
  for accessibility tooling and browser verification, not on architecture. The swap stays cheap
  because the domain layer is framework-free.
- **SQLite-WASM over OPFS** — strongest query, migration, and backup story. Held as a **fallback**
  only: OPFS persistence needs a Worker with sync access handles, and reported platform defects on
  iOS Safari make a flaky store likely, which under a no-allowlist rule surfaces as `Unsupported`
  sessions rather than fixable errors. Revisit only if benchmarking shows IndexedDB index/scan work
  is the bottleneck.

### Required verification before the plan is frozen

1. Restore/migration replacement at target scale via candidate + pointer swap, with injected failure
   proving rollback and prior data remaining usable (AC-REST-003).
2. Both latency targets at 25,000 Trades / ~200,000 facts with correctness assertions before and
   after, network disabled.
3. Offline Release Inventory completeness and digest validation achievable at runtime, and the gate
   genuinely failing on a missing/corrupt asset and on missing service-worker control (AC-DEL-004).
4. The write gate rejecting at the **transaction seam**, not merely in the UI.
5. Multi-store rollback proving a Journal-participant failure rolls back staged Trade effects
   (AC-CORR-004).
6. Real-engine readiness on at least two engines; versions recorded as evidence provenance only,
   never as an allowlist.
7. Download plus read-back verification yielding a `CompletedBackupReceipt`, with secrets exclusion
   proven.
8. Keyboard-only completion of core workflows plus axe-core checks.
9. Disclosed `fakeIndexedDB` fidelity gaps, with durability-critical proofs against a real engine.

### Unverified claims (not asserted)

- Current cross-browser availability of the **Temporal** API. Until verified, use an explicit date
  library plus our own calendar rather than depending on it.
- Whether Workbox's precache manifest can serve as the runtime **digest-valid** inventory check
  without custom instrumentation. Assumed to need custom work; covered by item 3.

### Not changed

No specification change; `specs/` remains untouched. This records a technology choice only, and
asserts nothing about atomicity, durability, or migration safety that items 1–5 must not demonstrate.

---

## D4 — Offline delivery: service worker mechanisms stay in the foundation

**Status:** settled by user decision, 2026-10-10. Affirms [ADR 0008](../specs/adr/0008-pwa-delivery-and-runtime-readiness.md) unamended.

### Context

To avoid loading the foundation deliverable with browser-specific installation work, the user proposed
deferring PWA delivery and shipping an online-only web app, on the reasoning that traders prefer to
visit a URL than install an app, and that a plain web app is easier to test across desktop, tablet, and
phone. The user also asked how a trader learns that a new release is available while the app is open.

### Decision

The four load-bearing mechanisms stay in the first deliverable that can mutate authoritative data:

1. Web App Manifest with stable identity, icons, launch URL, scope, and standalone request;
2. a versioned service worker owning a complete, digest-valid Offline Release Inventory;
3. the four-check browser-neutral Runtime Readiness gate; and
4. the persistence-level `RuntimeNotWritable` write gate.

Deferred to the final deliverables:

- the **installation experience** (in-app install affordance, per-host guidance, standalone polish);
- the **update notice, deferral, and activation UX**.

### Rationale

Deferring the service worker is not a scope reduction, because two of the four readiness checks *are*
service-worker control and inventory integrity. Without it, readiness can never be `Writable`, so the
gate refuses every write and the application cannot even initialize a Workspace. "No service worker"
therefore does not mean "no offline support"; it means "no writes at all."

The usability goal is already met without deferring anything: an ordinary browser tab is a first-class
delivery mode (`delivery-contract.md:21`), installation is offered only where the host exposes it, and
cross-device testing over a deployed HTTPS URL is unaffected by the service worker. The genuinely fiddly,
browser-specific work is the installation *experience*, which is what this decision defers.

The frozen baseline also forbids the alternative both as a rule and as an ordering: `specs/README.md`
and `planning-protocol.md:83` place PWA identity, the complete inventory, Runtime Readiness, and the
write gate inside the first mutating deliverable and prohibit deferring them as later hardening.

### Update behavior while open (recorded for the update deliverable)

- The running release is never disturbed; the new worker installs and **waits**.
- No notice appears until the new inventory is complete and digest-valid, so the trader cannot reload
  into a partial release.
- The app never calls `skipWaiting()` on its own. Activation happens only in response to the trader,
  at a safe reload, after which Runtime Readiness re-runs and any Workspace migration completes before
  mutations re-enable.
- Ignoring the notice indefinitely is safe; the device stays on the last complete compatible release,
  and one coherent release is served per origin at a time.

### Rejected alternative: online-only web app

Rejected, although acknowledged as a legitimate engineering trade in general. It would require amending
ADR 0008 and the delivery contract, reducing readiness from four checks to two, removing the offline
guarantee, and waiving or rewriting AC-DEL-001, AC-DEL-002, AC-DEL-003, and AC-DEL-006 — a product
change to the shared baseline that would make this branch's specification diverge from the other seven.
It also gives no additional data protection, since browser storage can be evicted whether or not the
device is online, so backup and Restore remain equally necessary. Finally it removes the atomic release
boundary: without a verified inventory, a deploy can leave new-version code writing to a local database
an older schema version expects, which is a migration-corruption hazard for the trader's only copy.

### Declared scope

Early deliverables ship the mechanisms but **do not advertise installation support**. The application
remains installable at the browser's discretion through native behavior, and the Installed Capability
Manifest records that install support is not yet claimed. AC-DEL-003 is therefore partially covered from
the foundation (manifest identity, inventory binding, browser-tab `Writable`) and fully covered only at
the installation deliverable (installed-launch evidence).

### Not changed

`specs/` remains untouched and ADR 0008 stands unamended. This is an approval to implement the frozen
requirement, not a revision of it.

---

## D5 — Non-canonical option structures use shape templates, not seeds

**Status:** settled by user decision, 2026-10-10.

### Context

The user requires Butterfly, Broken-Wing Butterfly, and Condor support, and objected that the
deliverable list appeared to "complete at Iron Condor." The frozen specification contains no butterfly
or condor other than Iron Condor, and AC-REF-001 requires "**exactly** the eleven specified Strategy
seeds … no Account, Institution, generic Custom, Other, or settlement-as-reason seed exists"
(`acceptance-contract.md:390`). Traceability records the exact eleven as a settled decision
("Exact eleven seeds settled; no generic Custom", `traceability.md:76`).

### Decision

Butterfly, Broken-Wing Butterfly, and Condor are supported as **shape templates** offered in the
shape-creation flow. A template produces the trader's own typed Strategy through
`ReferenceCatalog.save`. The canonical seed set remains exactly eleven, with Iron Condor as the last
seed. D13 covers the three templates, asymmetric wings, the Iron Condor seed, and four-leg
risk/reward.

### Rationale

- The capability is already granted by the spec: "There is no generic Custom seed; traders may create a
  typed shape when needed" (`reference-catalog.md:98`). The missing piece was usability, not permission.
- Templates remove the hand-building friction without changing the seeded count, so AC-REF-001 is
  satisfied by its own terms: at first run exactly eleven seeds exist, and nothing is seeded on demand.
- Asymmetric wings need no special mechanism. The shape vocabulary embeds no wing-width defaults
  (`reference-catalog.md:80`), and Iron Condor already establishes that wing widths may differ.
- Keeping the seeded eleven avoids reopening a settled product decision and diverging the shared
  baseline, which would affect comparability with the other seven implementation branches.

### Rejected alternative

Adding the three as canonical seeds. Rejected because it requires amending AC-REF-001 (exact
cardinality), reopening the settled eleven-seed decision in traceability, and changing the shared
baseline. Acknowledged benefit: byte-identical structures across implementations, which would matter if
cross-implementation conformance comparison of these structures were a goal. It is not a stated goal,
so the cost is not justified.

### Not changed

`specs/` remains untouched, AC-REF-001 stands unamended, and the seeded strategy count remains eleven.

---

## D6 — Different-strike option combos are supported by strike order; true synthetics are not

**Status:** recorded future intent, 2026-10-10. Not scheduled in the current 22-deliverable sequence.

### Context

The user asked whether synthetic long and short positions could be handled as shape templates. A true
synthetic is *defined* by equal strikes (long call plus short put, or the mirror, at the same strike and
expiration), but the enumerated shape vocabulary grants "expiration **order/equality**" and only
"**strike order**" (`reference-catalog.md:80`). Every one of the eleven seeds uses strict strike
ordering or no strike relation, so the omission of equality appears deliberate.

The user clarified that in practice they often use **different strikes** for the put and the call
rather than a true synthetic.

### Decision

Support the different-strike structure through shape templates using the **existing strike-order
constraint**. No vocabulary extension is made. True equal-strike synthetics are **not** supported as
validated shapes, because the vocabulary cannot express strike equality.

Terminology: with different strikes the structure is a **combo / risk reversal**, not a synthetic.
The plan must name it accurately; labelling it "Synthetic Long" would be a misleading name under the
specification's alias discipline.

Status: future intent, recorded but not scheduled. When added, these are templates producing
trader-owned typed shapes, so the seeded eleven are unaffected and AC-REF-001 is untouched.

### Rationale

- Different strikes require only a **relative strike ordering**, which the vocabulary already provides.
  No change to a frozen domain definition is needed — which is why the user's reading is adopted.
- The analysis side already supports the structures. `expirationPayoff` handles "co-expiring option
  structures of **any** Strategy" and rejects only *multiple* expirations. Both strike relations yield
  piecewise-linear payoffs: call strike above put strike gives a flat plateau between the strikes, and
  call strike below gives a slope-2 middle region.
- Risk boundedness depends on the relation. A short-put side is unbounded below, so the risk and
  coverage machinery must report `Unbounded` honestly rather than substituting a number.

### Open detail, to settle when the deliverable is planned

Whether a combo shape requires **strict** strike ordering or non-strict. If the trader sometimes uses
equal strikes, a strict shape would flag that as a Planned-Leg Terms deviation, whereas a non-strict
relation would accept both. This is a per-shape decision and does not need resolving now.

### Not changed

`specs/` remains untouched. The vocabulary is read as already sufficient for strike *ordering*; no
equality constraint is added, so a true synthetic cannot be validated as a shape.

---

## D8 — `Given`-setup mutation of derived state and authoritative facts

**Status:** settled by user decision, 2026-10-11.

### The gap

`acceptance-contract.md:7` restricts how a `Given` may be established:

> “Given” fixtures use authoritative domain commands or a validated restored Workspace. Test-only
> mutation of private projections may be used solely in scenarios that explicitly exercise
> reconstruction.

Three cases cannot be tested under a literal reading of that rule, and one of them is required by the
same contract:

1. `AC-LIFE-003` says the disagreement is introduced "in a controlled integrity fixture" and names
   "**stored Lifecycle State**" as one of the things that may differ from effective facts. Stored
   Lifecycle State is authoritative derived state — `overview.md:18` carves it out as the one thing
   that is not rebuildable, and `overview.md:31` calls it "the one stored/indexed derived-state
   exception" — so the scenario requires a `Given` that sentence 1 of line 7 forbids.
2. Recorded Lot-Match links and recorded Deviation occurrences are derived state that is persisted,
   checked and backed up, but `trade-record.md:143` contrasts "Lot-Match/Deviation history" with the
   "Private indexes/projections" that are excluded from the backup. The "private projections"
   carve-out therefore does not clearly reach them.
3. **Incoherent authoritative facts** are contemplated by the specification and must be rejected, not
   repaired (`trade-record.md:145`, `workspace.md:165`, `trade-analysis.md:134`, `AC-REST-001`). No
   domain command produces them, and the Restore path validates incoherence away, so the class is
   unreachable from either sanctioned fixture source. A release that wrote a fact incorrectly — for
   example an Execution closing more shares than were held — is exactly this class.

### Decision

`Given` setup may use test-only mutation at three tiers:

| Tier | What may be mutated | Permitted for |
|---|---|---|
| 1 | Non-authoritative derived state, private or not: recorded Lot-Match links, recorded Deviation occurrences, lifecycle/agreement mirrors, indexes, projections | Validation and error-handling scenarios |
| 2 | Authoritative derived state: stored Lifecycle State | Validation and error-handling scenarios |
| 3 | Authoritative facts: Executions, settlements, Plan and Planned Legs, Management Revisions, Journal Entries and versions, Marks, Bars, acknowledgments, catalog records | Simulating error conditions only |

Authoritative facts remain off-limits as a way to *establish* ordinary behaviour. A tier-3 mutation
may only reach a state that no correct command can produce, and the scenario under test must be the
product's response to that state. It must never create a happy-path fixture, and it must never
evidence a scenario whose Then is about the product producing correct facts.

### Conditions on every use

1. It names the invariant under test.
2. It states why no authoritative domain command can produce the state.
3. The mutation is disclosed in the retained evidence, naming exactly what was altered, and is
   accompanied by the correct derivation, so a reviewer can see the product detected the condition
   rather than tolerated it.
4. It writes through the **real persistence seam**, not by stubbing or replacing a module, so the real
   pipeline is what handles the state (`planning-protocol.md:115-122`).
5. It never manufactures evidence of a capability. The capability must be installed and real; only the
   state is synthetic.
6. For stored Lifecycle State, the test must also show the disagreement is detected and not silently
   accepted as Ready (`trade-record.md:156`, `overview.md:139`).

### Consequences

- `AC-LIFE-003` becomes claimable: Partial in D2 (the stored-lifecycle half) and D3 (the
  lot/deviation half), **completed at D21**, which owns "the authorized preparation either derives a
  disclosed repair for coherent facts or rejects incoherent facts" (`workspace.md:163-167`,
  `trade-record.md:145`).
- `AC-REBUILD-001`'s "deliberate removal of rebuildable private indexes/projections" now reaches
  recorded Lot-Match links and the lifecycle mirror, so rebuild equivalence is testable by deletion
  as well as by Restore.
- Two consequences of the tier-3 case are recorded as open in **Still open** rather than resolved
  here.

### Not changed

`specs/` remains untouched. This is a branch-local interpretation that deliberately diverges from a
literal reading of `acceptance-contract.md:7`. Promoting it to `specs/adr/` would bind every branch
and change cross-branch comparability; that has not been done.

### Numbering note

D7 is unassigned. `vertical-deliverables.md:532` referred to "decision D7" for the content recorded
above as **D6**; that reference is corrected, and this decision takes D8 so that no already-reviewed
record is renumbered.

---

## Still open

Specification gaps from intake remain limited to D1 and D2. D3 records the approved stack, D4 affirms
the frozen offline-delivery requirement, D5–D6 record interpretations that avoid reopening frozen
definitions, and D8 records the `Given`-setup mutation rules, including its three tiers and the
prohibition on using authoritative-fact mutation to establish ordinary behaviour. The D3 verification
items must be resolved inside the plan.

The vertical deliverable list is recorded in [vertical-deliverables.md](vertical-deliverables.md).
The task-level breakdowns for D1–D7 are drafted under
[deliverable-breakdowns/](deliverable-breakdowns/) (155 tasks), and both
`scripts/check-deliverable-breakdown.mjs` and `scripts/audit-breakdown-coverage.mjs` report zero
failures and zero warnings across them. The acceptance-to-evidence matrix (planning-protocol Phase 4)
is not yet drafted.

### Open questions raised by D8

- **Can a correction be committed against a Trade whose base state is already incoherent?**
  `trade-record.md:62` says `prepareChange` "validates structural coherence" without stating whether
  it validates the base state or the candidate. If it validates the base, a fact written wrongly by a
  buggy release cannot be repaired through the corrections workflow and the trader has no route out;
  if it validates the candidate as a whole (`trade-analysis.md:99`), the recovery path is open. This
  decides whether the tier-3 class above has any recovery route at all, and it must be settled when
  D15 (corrections) is planned.
- **Can a Workspace holding an incoherent authoritative fact produce a usable backup?** Its export
  fails Restore validation on the way back in (`trade-record.md:145`), so the product must disclose
  that the copy will not restore rather than presenting it as a completed backup. This affects D7's
  presentation and D20's verification wording.

---

## Related

- `specs/README.md` — authority order and conformance rules
- `specs/evaluation/planning-protocol.md` — Phase 5 records accepted choices; Phase 6 freezes
