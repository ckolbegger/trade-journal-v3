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

## Still open

**D2 — `ReviewChanged` vs `Conflict`.** `specs/design/daily-review.md:110` allows either result when
Mark, acknowledgment, Daily Bar, Trade fact, or existing Action evidence changed before Save. Both
write nothing; the spec gives no rule for which applies. Not yet decided.

---

## Related

- `specs/README.md` — authority order and conformance rules
- `specs/evaluation/planning-protocol.md` — Phase 5 records accepted choices; Phase 6 freezes
