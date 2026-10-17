# Planning decision record — 2026-10-10

Branch-local planning input for the `deepseek-v41-flash` implementation. **Not part of the frozen
baseline.** `specs/` remains authoritative and is treated as read-only; this file records resolutions
of specification under-specification that a future implementation plan must consume.

Decisions recorded here are user-approved. They constrain this branch's implementation and do not
silently amend `specs/`.

---

## PD1 — Journal Anchor resolution statuses at `save`

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

### Promotion status

Considered and **declined** on 2026-10-11 (agenda item 9). Binding every implementation branch would
require a `specs/adr/` amendment to the shared baseline — a change on `main`, propagated to the seven
sibling worktrees, not a worktree edit. That reopens a frozen product decision (`specs/README.md:102`)
and makes every branch's outcome depend on this one, for a reading this branch's own code can hold:
`save` attaches `Effective`, `Superseded` and `Voided` anchors and rejects only `Unknown`. The cost is
disclosed rather than hidden: this branch's anchor behaviour is **not comparable** with the other seven
implementations on this point, and the plan must say so wherever it is compared. The option remains
open for a later baseline change if the implementations are found to diverge.

---

## PD2 — Review staleness results: `ReviewChanged` vs `Conflict`

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

### Promotion status

Considered and **declined** on 2026-10-11 (agenda item 8). The mapping is a reading of an
under-specified sentence, and promoting it would need a `specs/adr/` amendment on `main` that binds the
seven sibling worktrees and reopens a frozen product decision (`specs/README.md:102`). It is not
promoted. `AC-REV-005` is label-agnostic (`acceptance-contract.md:252-257`), so no acceptance outcome
turns on the two names; what the trader is told to do next does. The cost is disclosed: this branch's
result naming is **not comparable** with the other seven implementations on this point.

---

## PD3 — Approved implementation stack

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

## PD4 — Offline delivery: service worker mechanisms stay in the foundation

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

## PD5 — Non-canonical option structures use shape templates, not seeds

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
seed. D12 covers the three templates, asymmetric wings, the Iron Condor seed, and four-leg
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

## PD6 — Different-strike option combos are supported by strike order; true synthetics are not

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

## PD8 — `Given`-setup mutation of derived state and authoritative facts

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

Planning decisions were renumbered with a `PD` prefix on 2026-10-11 so that a planning decision can
never be mistaken for a deliverable; PD7 is unassigned. `vertical-deliverables.md` referred to
"decision D7" for the content recorded above as **PD6**; that reference is corrected, and this
decision took D8 — now **PD8** — so that no already-reviewed record would be renumbered.

---

## PD9 — Stop and target condition model across the option arc

**Status:** settled by user decision, 2026-10-11.

### The gap

`trade-analysis.md:51-57` fixes the Plan Baseline *policy* but never the shape of the inputs, and
`glossary.md:159` names two condition kinds without defining either:

> **Underlying-price and structure-value Stops or Targets are independent OR conditions.** Every
> condition remains visible. The headline distance uses the nearest monetary boundary, becomes zero
> when any condition is crossed, and never changes the Position or Lifecycle State by itself.

The requirement is incremental — stock stops and targets are underlying-price; option positions may
also carry underlying-price conditions; multi-leg structures may carry several in both directions
(the user's example: an Iron Condor with a downside and an upside underlying stop); and option
positions additionally need conditions on the option's own value (the user's example: buy back a
cash-secured put at 75% of the possible profit). The two kinds must be expressible from one model,
built incrementally, without reshaping the frozen Plan record later.

### Mapping

"Stop or target on the price of the underlying" is an **underlying-price condition**. "Stop or target
on the option's own price" is a **structure-value condition**. Both are required by `AC-CALC-003`
("effective underlying-price and structure-value Stops/Targets with one crossed Stop and one reached
Target"), and `trade-analysis.md:77,81` require per-condition status under independent OR semantics
with every condition remaining independently visible.

### The condition type

```text
ConditionId = stable identity of one condition across Management Revisions

PlanCondition =
    UnderlyingPriceCondition
  | StructureValueCondition

ConditionRole = Stop | Target

ConditionBasis {
  comment:            trader-authored free text; view-only and never parsed
                      (the trader's reason, e.g. "breaks below untouched demand
                      zone" or "75% of max profit")
  protects:           the Planned Leg(s) or structure this condition measures
  direction:          BreachWhenAtOrBelow | BreachWhenAtOrAbove
  measurementPolicy:  nearest nonnegative monetary boundary under independent
                      OR with every other condition of the same role
}

UnderlyingPriceCondition {
  conditionId:      ConditionId
  kind:             UnderlyingPrice
  role:             ConditionRole
  boundaryPrice:    Price     -- exact decimal
  monetaryBoundary: Money     -- exact decimal, frozen at confirmation
  basis:            ConditionBasis
}

StructureValueCondition {
  conditionId:   ConditionId
  kind:          StructureValue
  role:          ConditionRole
  scope:         StructureScope
  boundaryValue: Money        -- exact decimal
  basis:         ConditionBasis
  resolvedFrom:  ExplicitBoundary
               | FractionOfFrozenStructuralMaximum(fraction, frozenMaximum)
}

StructureScope =
    SingleContract(InstrumentKey)
  | CoExpiringStructure(ordered participating leg identities, one expiration anchor)

OriginalConditionSet {
  conditions: ordered PlanCondition[]   -- the frozen original management
  frozenAt:   confirmation Economic Time
}

EffectiveConditionSet =
  OriginalConditionSet prospectively adjusted by effective Management Revisions
  (add, replace, retire), per `glossary.md:60`
```

Policy carried with the type:

- Every underlying-price condition observes the Plan's single common Underlying; the shape vocabulary
  grants one common Underlying (`reference-catalog.md:80`), so no condition carries its own.
- Every condition is an independent OR alternative: any crossed Stop is breached and any reached
  Target is reached regardless of the others, and every condition stays visible.
- Headline risk uses the nearest unbreached Stop boundary; headline reward uses the nearest unreached
  Target boundary; the headline distance becomes zero when any Stop is crossed (`glossary.md:150-152`,
  `glossary.md:159`).
- A crossed condition never changes Position or Lifecycle State by itself (`glossary.md:159`).
- `trade-analysis.md:57` requires the frozen Plan Baseline to use *the same* independent-OR,
  nearest-nonnegative-monetary-boundary policy as current headlines, so the policy is computed over a
  set from the first deliverable rather than being singular at D2 and plural later.
- A `StructureValueCondition` whose scope spans more than one expiration is `Unavailable`, matching
  `trade-analysis.md:89`.
- The condition `comment` is trader-authored free text and is view-only: never parsed, never matched,
  never an input to the Plan Baseline, `evaluate`, `replay` or any report. `trade-analysis.md:113`
  fixes that "display prose is not a branching contract". It is frozen with its condition and changed
  prospectively only by a Management Revision, and the resolved boundary is always rendered as its own
  value so the comment is never the sole record of what the trader meant.

### Decisions taken

**(a) `monetaryBoundary` is required on *every* underlying-price condition, Stop and Target alike.**
The decisive reason is that the Plan Baseline must contain a *planned reward/risk ratio*
(`trade-analysis.md:57`) and the headlines are defined as *monetary* distances — Ongoing Risk to Stop
and Incremental Reward to Target are both "the current monetary distance" to a boundary
(`glossary.md:150-152`). **Without a monetary boundary on a condition, neither the ratio nor the
dollar-valued risk and reward can be computed at all**, for either role. For a Stop this is also
exactly the "frozen monetary loss boundary for measurement" that `trade-analysis.md:57` requires
without allowing it to be mislabeled as a structure-value trigger. For a Target the specification does
not state the requirement, and for an option position the monetary measure cannot be derived from a
price boundary alone: the shape carries no delta and the product performs no theoretical pricing.
Requiring it uniformly keeps one shape across stock and options and avoids a migration at D8. For
stock it is derivable (price distance times quantity) and is nonetheless frozen, for uniformity.
*Rejected alternative:* require it only for Stops, per the letter of `trade-analysis.md:57`. Cheaper at
D2, but it makes the D2 and D8 condition shapes differ.

**(b) A percentage-of-maximum target freezes the resolved boundary, not the fraction.**
The form may offer "75% of max profit" as an input convenience, but the Plan stores the resolved
`boundaryValue` and retains `resolvedFrom` as disclosure, including the structural maximum at
confirmation. *Rejected alternative:* store the fraction and re-resolve it. That would let a later
Management Revision move a target the frozen Plan Baseline is supposed to fix (`trade-analysis.md:54`,
`trade-analysis.md:109`).

**(c) Every condition carries an optional trader-authored comment, view-only and non-behavioural.**
The trader records their reason in their own words: "breaks below untouched demand zone" on a pure
underlying-price stop, or "75% of max profit" on a structure-value boundary resolved from a fraction.
The field is display-only — never parsed, never matched, never used to derive a boundary — because
`trade-analysis.md:113` fixes that display prose is not a branching contract. It is frozen with its
condition, is changeable only prospectively through a Management Revision, and appears on Stops and
Targets alike, since the percentage buy-back above is a profit Target while the demand-zone example is
a Stop. It is also the trader-facing half of the per-condition basis that `trade-analysis.md:57`
requires the Plan Baseline to contain, which is why it belongs on the condition rather than in a
Journal Entry: the Journal records reflection, and this records why the boundary sits where it does.
Because the comment may carry a fraction's intent, the resolved boundary is always shown as its own
value so the comment is never the only record of the trader's meaning.

### Incremental build

| Deliverable | Underlying-price conditions | Structure-value conditions |
|---|---|---|
| D2 | Constructible; modelled as an ordered set with an optional view-only comment, even though a stock Plan typically has one Stop and one Target | Reserved in the type, **not installed**: absent rather than a fake `Unavailable` (`overview.md:19`, `specs/README.md:98`) |
| D4 | Evaluated as an OR set with per-condition status, nearest-boundary headline, and Overrun | Not constructible |
| D8 | Constructible; the monetary boundary is now entered and frozen because options cannot derive it | Introduced for one exact contract |
| D9 | Constructible; headline risk may be `Unbounded` | Introduced for premium-based exits |
| D11/D12 | Several in both directions become the norm | On the whole co-expiring structure |
| D14/D15 | Revisions and corrections operate on the set | Same |

The durable frozen Plan record carries the `kind` discriminator from D2, so adding the
`StructureValueCondition` variant at D8 is additive rather than a reshape.

### Not changed

`specs/` remains untouched. This is a branch-local reading and shape decision consistent with
`trade-analysis.md` and `glossary.md`; it defines no new condition kind and adds no capability ahead
of its deliverable.

---

## PD10 — Fees are captured as facts and excluded from calculations

**Status:** settled by user decision, 2026-10-11.

### Context

Fees are normative throughout the frozen baseline: `glossary.md:49` puts an actual fee on every
Execution, `glossary.md:58` puts an unconsumed opening fee on every Open Lot, `glossary.md:156` makes
Entry Quality a comparison "including allocated fees", `trade-analysis.md:105` fixes the lot-aware
allocation rule, `trade-analysis.md:83` has `evaluate` return incurred fees, `trade-analysis.md:87`
has the payoff's Current view include unconsumed opening fees, `trade-analysis.md:107` has settlement
costs adjust basis and proceeds exactly once, and AC-POS-001, AC-CALC-001 and AC-RPT-002 all require
fee-inclusive evidence. The user's judgement is that a trader still gets the learnings the product
exists to provide without fee arithmetic, and that the calculations become materially simpler.

### Decision

1. **Capture.** Every Execution continues to record its actual fee as a required fact.
   `overview.md:264` and `delivery-contract.md:79` require facts needed by a later capability to be
   captured before the behaviour occurs, or the later capability must disclose historical coverage
   loss. Capturing it now keeps fee application installable later with no loss. The fee defaults to an
   explicit `0`, so "no fee" is an affirmative fact rather than an absent field, and a blank cannot be
   confused with a zero.
2. **Exclusion.** No fee enters any calculation. Not installed: lot-aware allocation; the
   consumed/unconsumed opening-fee split; fee-adjusted realized and marked P&L; `remainingOpeningFees`;
   the incurred-fee component of `evaluate`; the unconsumed-opening-fee term in the payoff's Current
   view; Entry Quality's "including allocated fees" component; settlement cost adjustments to basis and
   proceeds; and fee reconciliation. The Open Lot's unconsumed-opening-fee field is not populated.
3. **Honesty.** The Installed Capability Manifest declares fee application and allocation not
   installed, and the capability is absent rather than represented as a zero fee or a fabricated
   `Not Available`. Where a recorded fee is zero the derived P&L **is** the true net P&L and no caveat
   appears; a single conditional disclosure at the fee field and in the manifest states that fees are
   recorded but not applied. It is a no-op for a zero-fee trader and never appears as a per-number
   "before fees" caveat.
4. **Withdrawn.** Decision 2 of D3's §1, which settled cent apportionment of fees by largest-remainder
   apportionment with a recompute-never-accumulate rule, is **withdrawn rather than solved**. The
   apportionment, residual and telescoping rules it fixed are not implemented.
5. **Coverage.** AC-POS-001's "opening/disposal fees are allocated exactly once", AC-CALC-001's Entry
   Quality comparison "including allocated fees", and AC-RPT-002's fee-inclusive outcomes are not
   demonstrated by any deliverable. They are recorded as Partial with those clauses explicitly
   unclaimed, and no deliverable may claim AC-POS-001 complete.

### Correction recorded

An earlier draft of this decision required every P&L figure to be labelled as excluding fees. That was
wrong. Many platforms charge nothing for stock and simple option transactions, so a recorded zero fee
yields a genuinely net figure that needs no qualification; a blanket caveat would imply an exclusion
that does not exist. The requirement is therefore conditional on a recorded non-zero fee.

### Consequences

- D3's fee-allocation task is rescoped to fee capture and exclusion. Its derived fixtures keep
  non-zero fees precisely so that the numbers prove the fees do **not** enter them.
- Partial realization, FIFO, basis, Entry Resolution, risk/reward and payoff arithmetic are unchanged;
  only the fee components are removed. The saving is concentrated in the apportionment rule, not spread
  across the calculus.
- **Comparability.** Results are not comparable with the other seven branches on any fee-inclusive
  scenario. Recording this as an explicit scope change to `specs/`, which is the route
  `acceptance-contract.md:518` requires for a waived scenario, remains a product decision and has not
  been taken; `specs/` is untouched.

### Not changed

No operation, fact identity or lifecycle semantic changes. The Execution's fee field remains; only its
effect on derived values is removed.

---

## PD11 — Terminal Disposition's structured shape and the shared mechanism vocabulary

**Status:** settled by user decision, 2026-10-11. **Branch-local**, not promoted into `specs/`.

### The gap

`glossary.md:65` requires the derived value to name "the complete set of mechanisms and quantities by
which a Closed Trade's exposure ended", `glossary.md:80` requires `NotApplicable` for an Abandoned
Trade, and `trade-analysis.md:108` allows mixed mechanisms. Nothing fixes the member set, whether a
quantity is signed, whether a summary is carried, how members are ordered, or what the mechanism
vocabulary is. `acceptance-contract.md:5` deliberately does not prescribe internal types, so this is
a planning decision rather than a reading of existing text, and D6 §8 item 9 disclosed it as open.

### Decision

`TerminalDisposition` is the result union
`Applicable(members: TerminalDispositionMember[]) | NotApplicable(stableReason, structuredDetails)` —
the convention `trade-analysis.md:28` already uses — so that an Abandoned or still-open Trade stays
distinguishable from a zero-member disposition. A member is
`{ mechanism, sourceFactIdentity, instrument, disposedQuantity }`, and:

1. `MechanismKind` is the closed five-kind vocabulary `Execution | Expiration | Assignment |
   Exercise | CashSettlement`, taken from
   `adr/0003-authoritative-lifecycle-and-derived-disposition.md:7`, declared once by Trade Analysis
   and shared with Option Disposition Timing (`glossary.md:67`) and the D19 report field
   (`performance-analysis.md:99`).
2. `disposedQuantity` is an exact positive magnitude. Direction is carried by the mechanism and the
   instrument, and the frozen text says "quantities".
3. `instrument` is per member, because Assignment changes it.
4. `sourceFactIdentity` names the disposing fact, so a correction or Void can be pointed at it.
5. Members are ordered by `FactOrder` — economic time, then `RecordedSequence`
   (`trade-analysis.md:30`) — so the value is a deterministic function of the effective facts.
6. `Mixed` is not carried: it is the predicate `members.length > 1` over the member set.

### Consequences

- A Roll's closing leg derives mechanism `Execution` while its Close Reason is `Rolled`. Disposition
  and reason legitimately differ there, and that is a test D13 must carry.
- The shape is a derivation output, never stored, so the extension at D10 and D13 changes consumers
  and tests rather than requiring a migration.
- `NotApplicable` stays distinct from `Unavailable` and from a zero-member set.

### Not changed

No operation, fact identity, stored field or lifecycle semantic changes, and `specs/` is untouched.
D6 §1 decision 2, T4 and T16 record the shape; D6 §8 item 9 now discloses only the extension.

---

## PD12 — The `Rolled` Close Reason is selectable before any Roll workflow exists

**Status:** settled by user decision, 2026-10-11. **Branch-local**, not promoted into `specs/`.

### The gap

`reference-catalog.md:102-108` fixes exactly five Close Reasons, the fifth being `Rolled`, and
`reference-catalog.md:26` makes it "the unique workflow-semantic Close Reason role". D6 seeds all
five, but no Roll workflow exists until D13, so the question is whether `Rolled` may be selected on a
D6 close. `reference-catalog.md:39` says "Rolled additionally remains selectable while Roll is
supported", which reads either as a **temporal scope** over an asserted selectability or as a
**condition** that withholds it until Roll exists.

### Decision

It is a temporal scope, and `Rolled` is selectable at D6. The policy chain forces this reading:
`reference-catalog.md:29` makes an inactive reason a Retired one, `reference-catalog.md:39` forbids
retiring seeded taxonomy values, and AC-REF-001 files "protected taxonomy values/`Rolled`" under that
policy (`acceptance-contract.md:390`). Withholding `Rolled` would therefore retire a protected seeded
value. A restriction sentence would read "selectable only while Roll is supported"; the frozen
sentence asserts that it "remains selectable".

The consequence is that a D6 close may record `Rolled` with no Roll lineage. That is inert: the
frozen relation is one-directional — `trade-workflows.md:146` requires `Rolled` when a Roll closes the
predecessor and says nothing about a `Rolled` reason without a Roll — and no derived value reads the
Close Reason, which D6 T4 asserts with a reason-independence case.

### Rejected alternatives

- **Making `Rolled` non-selectable until Roll is installed.** Implementing it through the catalog's
  availability state retires a protected seeded value (`reference-catalog.md:29`, `:39`), and the
  existing `NewSelection` resolution would refuse it (`reference-catalog.md:47`). Implementing it as a
  separate capability gate would instead add a typed rejection no acceptance scenario requires, for
  exactly one value, and would deny a truthful `Rolled` label to a trader who rolled outside the
  application until D13.
- **Deferring the `Rolled` seed to D13.** AC-REF-001 requires exactly five Close Reasons with stable
  identities and D6 records that seed; deferring one leaves four.

### Consequences

- **Forward guard.** D13 and D19 must not infer a Roll from the presence of the `Rolled` Close
  Reason. Roll semantics come from typed lineage; the reason is a trader acknowledgment, not evidence
  that a workflow ran. This is recorded because it is the one real risk the rejected gate would have
  covered.
- D13's Roll requirement is unchanged: a Roll that closes a predecessor must record `Rolled`
  (`trade-workflows.md:146`).
- No stored state, operation or selectability behaviour changes at D6.

### Not changed

`specs/` is untouched; the taxonomy stays exactly five and every seeded reason stays selectable. D6
§1 decision 6 records the seed, T3 records the selection rule, and §8 item 6 records this reading.

---

## PD13 — A reopened Debt keeps its identity and its original due time

**Status:** settled by user decision, 2026-10-11. **Branch-local**, not promoted into `specs/`.

### The gap

`journal.md:129` says Voiding the only Entry that settled Debt "atomically reopens **that same Debt**",
which fixes identity, but no sentence states whether the reopened Debt receives a new due time.
`daily-review.md:74` makes due-ness a comparison of due time against the Review cutoff, so the answer
is observable in what the next morning's Review shows.

### Decision

The reopened Debt keeps its identity and its original due time. `journal.md:137` says `Defer` creates
Debt with its trigger-time definition snapshot, Anchor, origin, due semantics and settlement route,
and that later definition changes do not alter what is owed. Reopen is a state transition of the
obligation key, not a second `Defer`, so it restores those frozen semantics rather than assigning a
new due time.

The consequence is deliberate: a Debt reopened after its cutoff is immediately due at the next Review
cutoff (`daily-review.md:74`), and due Debt keeps Review completion Incomplete (`journal.md:141`) until
it is answered again. That is the honest state of an obligation that was never answered.

### Rejected alternatives

- **Reset the due time at reopen.** Rejected: it needs a second due-time source with no creating event,
  or a mutation of the trigger-time fact that `journal.md:137` freezes. It would also grant a fresh
  window for an obligation that was already owed.
- **Create a new Debt identity.** Rejected: `glossary.md:197` constrains the *current* outcome, so this
  is representable only by retiring the old Debt, and the retirement evidence `journal.md:137` and
  `:139` name concerns the Debt's origin or underlying facts, not its answer being Voided. It would
  also churn identity for an obligation whose content never changed.

### Consequences

- No new stored field: the due time is carried by the `Defer` fact, so reopen needs no due-time
  override and no migration.
- `T7` asserts the due time is unchanged, `T10` asserts a reopened Debt is due at the next cutoff, and
  `T12`'s existing due-Debt case covers completion. D5 §8 records the visible consequence.

### Not changed

`specs/` is untouched; the obligation-key invariant, the reopen rule and the retirement evidence are
unchanged. D5 §1 decision 2 already chose this shape and now cites this decision.

---

## PD14 — Attention ordering follows boundary proximity, not pressure descending

**Status:** settled by user decision, 2026-10-11. **Branch-local deviation** from a frozen product
sentence, disclosed rather than promoted.

### The gap

`daily-review.md:30` fixes five attention bands and their order; `daily-review.md:32` fixes the
comparison rules and the within-band sort, "comparable pressure sorts descending, then Last Activity
descending, then stable Trade identity". Nothing fixes what separates the last two bands. The product
intent is that review need rises as a Trade approaches **either** of its boundaries, symmetrically,
and is highest once a boundary is reached.

### Decision

1. **Band 4 versus band 5.** A comparable Trade is in quantified pressure when its distance to either
   selected monetary boundary is at most `nearBoundaryFraction` of the `Target − Stop` span, and in
   routine when it lies in the middle of that span. `nearBoundaryFraction` is a named, disclosed input
   with a default of `0.25`; it is never a stored per-Trade score, a severity, or a band.
2. **Within a band.** Order by distance to the nearest boundary ascending, then Last Activity
   descending, then stable Trade identity.
3. **Unchanged.** The five bands and their order, the task-family order, the comparability rule, the
   Highest and Zero clamps, and boundary-reached retention. A factual or management blocker still
   outranks a reached boundary, because the numbers cannot be trusted until the record is sound.

### Why this deviates

For a fixed boundary pair, risk to Stop plus reward to Target is constant: it equals `Target − Stop`.
Sorting by pressure descending is therefore identical to sorting by reward ascending, which is
nearest-Target-first. A Trade one step from its Stop has the smallest risk to Stop and sorts **last**
in its band — the opposite of the intent, under which either boundary raises review need and a reached
boundary is near the top.

### Consequences

- This branch's Trade ordering is **not comparable** with the other seven implementations. The
  deviation is to `daily-review.md:32` only and must be disclosed wherever the plan is compared.
- `AC-REV-002` is unaffected: it fixes only the task-family order (Mark, Debt, settlement, Trade) at
  `acceptance-contract.md:235`, not the within-family Trade order.
- `specs/` is untouched. If this ordering is wanted for every branch, it is a baseline change on
  `main`, not a worktree edit.
- The Highest clamp (positive risk with zero or nonpositive reward) coincides with a reached Target,
  which remains band 2. The Zero clamp needs an uncapped structural maximum; a confirmed Plan carries
  Stop/Target management (`acceptance-contract.md:36`), so the ordinary case has a monetary Target and
  a finite span. A Trade with no evaluable monetary Target cannot form the span, so it is Not
  Comparable with the missing boundary named; `StructureValueCondition` could produce that case, is
  reserved by decision PD9, and is not installed before D8. That edge is disclosed rather than
  resolved.

### Not changed

No operation, no stored state, no band name and no task-family order changes. D4 §1 decision 2, T13 and
§8 item 2 record the deviation.

---

## PD15 — Seed scope is need-driven, and D12 owns the IdeaSource Tag Type

**Status:** settled by user decision, 2026-10-11. **Branch-local**, not promoted into `specs/`.

### The gap

Manifest v1 is fixed as Long Stock, the Plan Reflection Entry Type and the Plan Confirmation Source
(`vertical-deliverables.md:62`), but nothing states what later manifest versions add, when the fixed
IdeaSource Tag Type (`reference-catalog.md:24`, `:118`) is seeded, or whether the single-option D2
selector is a filter over a fuller catalog. D2 §1 decision 7 proposed that manifest v2 carry the full
canonical seed state, which contradicted its own §0 and §4 and would have completed AC-REF-001's
Strategy cardinality at D2 while the plan records the scenario completing at D12.

### Decision

1. **Seeding is need-driven.** Each manifest version adds only what its own deliverable needs: v1 Long
   Stock; v6 the five Close Reasons and five Abandonment Reasons; the remaining ten Strategies at D8,
   D9, D11 and D12. No deliverable seeds an identity its own stories cannot reach.
2. **D12 owns the IdeaSource Tag Type.** AC-REF-001 requires one empty IdeaSource Tag Type and
   completes at D12, and `reference-catalog.md:133` groups the eleven Strategies, the IdeaSource type
   and the reasons as one canonical seed, so D12 seeds the type alongside the Iron Condor. Nothing
   before D12 needs it: the frozen Plan Reflection definition contains no Tag Select
   (`journal.md:45-52`) and `confirmPlan` requires no IdeaSource (`trade-workflows.md:53`).
3. **Manifest v2 adds no Catalog identity**, so the D2 selector offers exactly one Strategy because
   exactly one exists. There is no presentation scoping rule to state, and the absent Strategies are
   never presented as a domain `Unavailable` (`overview.md:19`).

### Rejected alternatives

- **Seed the full canonical set at D1 or D2.** It would make AC-REF-001 pass at D2 while the plan
  records the completion at D12, front-load capability no early story reaches, and contradict D2's own
  scope statements. D2 claims nothing of AC-REF-001, so it would gain nothing.
- **Seed the IdeaSource Tag Type at D1.** Defensible as taxonomy-only, but D1 would seed an identity no
  D1 story reaches, and its absence assertions would change for no coverage gain.
- **Leave the Tag Type to D17**, where the Journal first offers an IdeaSource Tag prompt. That would
  push AC-REF-001's completion past D12, which the plan does not intend.

### Consequences

- **Forward obligation.** D12 has no breakdown yet. When it is planned it must seed the Iron Condor and
  the empty IdeaSource Tag Type atomically, with no seeded IdeaSource Values
  (`reference-catalog.md:118`), or AC-REF-001 cannot complete as recorded.
- D1 T23 and D2 T12 now assert the absences: no Tag Type at v1, and no Strategy beyond Long Stock, no
  reason and no Tag Type at v2.
- No stored identity, operation or acceptance claim changes at D1 or D2.

### Not changed

`specs/` is untouched. AC-REF-001 still completes at D12, and no earlier deliverable claims it.

---

## Still open

Specification gaps from intake remain limited to PD1 and PD2. PD3 records the approved stack, PD4
affirms the frozen offline-delivery requirement, PD5–PD6 record interpretations that avoid reopening
frozen definitions, PD8 records the `Given`-setup mutation rules, including its three tiers and the
prohibition on using authoritative-fact mutation to establish ordinary behaviour, PD9 records the stop
and target condition model across the option arc, and PD10 records that fees are captured as facts and
excluded from every calculation. PD11 fixes the Terminal Disposition shape and the shared mechanism
vocabulary, PD12 records that the `Rolled` Close Reason is selectable by policy before any Roll
workflow exists, PD13 records that a reopened Debt keeps its identity and its original due time, and
PD14 orders the attention walk by boundary proximity instead of pressure descending, and PD15 makes the seed scope need-driven and assigns the IdeaSource Tag Type to D12. The PD3
verification items must be resolved inside the plan.

The vertical deliverable list is recorded in [vertical-deliverables.md](vertical-deliverables.md).
The task-level breakdowns for D1–D7 are drafted under
[deliverable-breakdowns/](deliverable-breakdowns/) (155 tasks), and both
`scripts/check-deliverable-breakdown.mjs` and `scripts/audit-breakdown-coverage.mjs` report zero
failures and zero warnings across them. The acceptance-to-evidence matrix (planning-protocol Phase 4)
is not yet drafted.

### Open questions raised by PD8

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
