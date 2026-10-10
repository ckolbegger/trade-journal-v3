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

## Still open

No specification gaps remain from intake; D1 and D2 were the only two identified. The D3 verification
items must be resolved inside the plan. The vertical-deliverable list is in final alignment pending one
structural question: whether the corrections deliverable (Replace, mark correction, Void, history,
Rebuild) splits so that no deliverable exceeds four user stories.

---

## Related

- `specs/README.md` — authority order and conformance rules
- `specs/evaluation/planning-protocol.md` — Phase 5 records accepted choices; Phase 6 freezes
