# Forward obligations — deliverables that have no breakdown yet

Status: written 2026-10-11, after the alignment review settled items 5–13. **Not authority over
`specs/`**, and not a deliverable breakdown. This is the single record of obligations that this
session's decisions place on deliverables D8–D22, none of which has a breakdown yet.

**Why this file exists.** Several settled items create obligations on deliverables that do not exist.
Prose inside a decision record, or an entry in a breakdown's §8 open items, does not reach a later
planner: nothing forces that planner to read it. The Phase 6 freeze must check that every row below
still has an owner in the plan and that no row has been dropped silently.

Read the row for the deliverable you are planning. `D<n>` is a deliverable; `PD<n>` is a planning
decision in [planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md).

| # | Owner | Obligation | Why it binds | Source |
|---|---|---|---|---|
| 1 | **D7** presentation, **D20** verification wording | Disclose that a Workspace holding an incoherent authoritative fact exports a copy that will **not** pass Restore, rather than presenting it as a completed backup | The export fails Restore validation on the way back in (`trade-record.md:145`); calling it complete would be a false claim | agenda §4.2; PD8 |
| 2 | **D8** | Install `StructureValueCondition` as an **additive** variant of the condition model; do not reshape the durable `kind` discriminator D2 froze | PD9 reserved the variant for D8 and states the addition must be additive | PD9 |
| 3 | **D8** | When structure-value conditions exist, a Trade with no evaluable monetary boundary must be **Not Comparable** with the missing boundary named; it must not be given an invented band | PD14's span test needs a `Target − Stop` range, and PD9's variant is the only thing that could remove the monetary boundary | PD14; PD9 |
| 4 | **D8** | Supply the Pricing Provider port, or the `D4:T8` edge keeps its current rationale: the edge is declared against `D1:T7` (browser-host capabilities) and read as the typed capability-absence convention, because no provider port exists before D8 | The edge's id resolves and D4 §8 item 11 discloses the restatement; D8 is where the real port belongs | PD16 item 5; D4 §8 item 11 |
| 5 | **D10**, **D13** | Extend the Terminal Disposition member set and `MechanismKind` across option structures; never store a disposition summary | PD11 fixes the shape as a derivation output only; the ordinary case is a one-Instrument stock close | PD11; D6 §1 decision 2, §8 item 9 |
| 6 | **D12** | Seed the Iron Condor **and** the empty IdeaSource Tag Type atomically, with no seeded IdeaSource Values | AC-REF-001 requires one empty IdeaSource Tag Type and completes at D12; the canonical seed groups the eleven Strategies, the IdeaSource type and the reasons (`reference-catalog.md:133`) | PD15 |
| 7 | **D13** | Carry the Roll-leg test: a Roll's closing leg derives mechanism `Execution` while its Close Reason is `Rolled` | The two concepts legitimately differ there; ADR 0003's mechanism list has no Roll | PD11; `adr/0003:7` |
| 8 | **D13**, **D19** | Never infer a Roll from the presence of the `Rolled` Close Reason. Roll semantics come from typed lineage | The frozen relation is one-directional (`trade-workflows.md:146`), and no derived value reads the reason | PD12 |
| 9 | **D15** | Answer whether `prepareChange` validates the **base** state or the **candidate**: can a correction be committed against a Trade whose base state is already incoherent? | If it validates the base, a fact written wrongly by a buggy release can never be repaired and PD8's tier-3 class has no recovery route | agenda §4.1; PD8 |
| 10 | **D17**, **D19** | Extend `Journal.query` beyond D5's implemented subset. Unsupported dimensions are typed no-read results today | The spec lists the full vocabulary (`journal.md:213`); D17 and D19 need the remainder | PD16 item 4; D5 §8 |
| 11 | **D18** | Extend the same `getTradeDetail` operation rather than adding a second Trade read path | `overview.md:14` forbids the UI becoming a domain coordinator | PD16 item 1 |
| 12 | **D20** | Consider strengthening the exclusion proof beyond "no key present" — a cryptographic statement — and only if it does not weaken the four-stage failure vocabulary | PD17 settles the proof's fail-closed boundary but leaves its strength open | PD17 |
| 13 | **Phase 4** (this plan, not a deliverable) | Fix the stale `AC-POS-004` sentences in D6 (§8 item 1, its §5 closing note, its §4 non-defect list) that said the row was "marked Covered" while it is `Partial` — **discharged in Phase 4**; see [acceptance-evidence-matrix §7](acceptance-evidence-matrix-2026-10-11.md) | Coverage honesty; the matrix is built from those rows | item 6 disclosure |

## Check at the Phase 6 freeze

- Every row still names a deliverable that exists in [vertical-deliverables.md](vertical-deliverables.md).
- No row has been satisfied silently by a breakdown that does not say so, and no row has been dropped.
- Rows 5–8 and 12 are the ones most likely to be forgotten, because their owning deliverables are far
  from the decisions that created them.
