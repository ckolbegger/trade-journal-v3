# D4 — Journal

## Outcome

The trader reads one Journal timeline across all saved writing, writes voluntary Review Notes and Trader Reflections anchored to nothing, a Trade, or one Execution, and corrects writing through Edit, Addendum, and Void with visible history. Owed reflections (Journal Debt) can be answered against their original prompts or explicitly declined. The trader can revise the prompts and options of each Entry Type for future writing without changing anything already saved.

**Production-UI entry points:** Journal (timeline, filters, Owed reflections); New Entry composer (from Journal and from Trade Detail); Entry view (View history, Edit, Add Addendum, Void); Debt answer/decline form; Settings → Journal forms (definition editor).

## Interpretations to confirm

- **Addendum type:** an Addendum is created as a Review Note or Trader Reflection (the trader chooses), using that type's current definition, the parent's Anchor, an explicit parent link, and its own Source and time. It does not inherit the parent's origin.
- **Void scope in D4:** Void is offered for voluntary Entries (Review Note, Trader Reflection) and for Entries that settled Debt (which reopens that Debt). The spec does not say what happens to an obligation when a workflow-completed Entry (for example a Plan Reflection completed at confirmation) is Voided, so Void is not offered for those Entries until that is settled.

## Installed capabilities after D4 (in addition to D1–D3)

| Module | Operations / variants |
|---|---|
| Journal | `save` (Create Review Note or Trader Reflection, Edit, Addendum, Void, Resolve Debt by answer or decline), `query` (all projections and filters), `reviseDefinition` |
| Trade Record | `resolveAnchors` |
| Reference Catalog | `resolve` adds `NewTagValueSelectionUnderExistingBinding` |
| Trade Views and Reporting | `getTradeDetail` narrative includes Entries anchored to the Trade's Executions |

## Tasks

### T4.1 Schema version 4 (B)

- **Depends on:** D3
- **Seam:** `src/domain/persistence/migrations.ts`

```text
describe("Migration to schema version 4")
  it should add the Journal version, Addendum, decline, and timeline indexes (moment time, Entry Type, Source, status, due time, Anchor, Prompt/Option/Tag)
  it should preserve every version 3 record unchanged
  it should abort and leave version 3 intact when the Journal validator fails
describe("Journal section validator additions")
  it should reject an Entry with zero or two Anchors
  it should reject an Addendum cycle
  it should reject two current outcomes for one obligation key
  it should reject an illegal Debt transition such as Settled to Outstanding without a Void
```

### T4.2 Trade Record: Anchor resolution (B)

- **Depends on:** T4.1
- **Seam:** `src/domain/trade-record/index.ts` (`resolveAnchors`)

```text
describe("resolveAnchors")
  it should resolve a Trade Anchor as Effective with its Trade
  it should resolve an Execution Anchor as Effective with its owning Trade
  it should resolve an unknown identity as Unknown
  it should resolve Superseded and Voided Execution identities with their owning Trade (fixtures until corrections arrive in D5)
  it should resolve a batch of Anchors from one snapshot
```

### T4.3 Reference Catalog: Tag selection under an existing binding (B)

- **Depends on:** T4.1

```text
describe("NewTagValueSelectionUnderExistingBinding")
  it should accept an active Tag Value of the bound Tag Type even when that Tag Type is archived
  it should reject a retired Tag Value
  it should reject a Tag Value of a different Tag Type
```

### T4.4 Journal save (B)

- **Depends on:** T4.2, T4.3
- **Seam:** `src/domain/journal/index.ts` (`save`)

```text
describe("Create Entry")
  it should create a Review Note or Trader Reflection with exactly one Anchor: Standalone, Trade, or Execution
  it should reject creating any other Entry Type directly
  it should resolve a Trade or Execution Anchor through Trade Record and reject Unknown
  it should set Source to Journal or Trade Detail from the initiating surface
  it should validate answers against the current definition revision and snapshot its wording and labels
  it should resolve Tag Select answers under the prompt's Tag Type binding
  it should return the complete saved Entry at its new revision
describe("Edit")
  it should append a version under the same Entry identity
  it should validate the edited answers against the Entry's original definition snapshot
  it should allow changing the Anchor or moment time of a directly authored Entry
  it should reject changing the Anchor of a workflow-created Entry
  it should keep Entry Type, Source, origin, first-authored time, Debt settlement, and parent link unchanged
  it should never change frozen Trade facts when a Plan Reflection's Thesis is edited
  it should return Conflict and write nothing for a stale expected revision
describe("Addendum")
  it should create a new Entry identity with the parent's Anchor and an explicit parent link
  it should use the current definition and its own Source and time
  it should not inherit the parent's origin
describe("Void")
  it should append a visible Void version with the required reason
  it should keep every earlier version, Addendum, Anchor, and origin
  it should reopen the same Debt with its original snapshot when the Voided Entry was its only settlement
  it should reject Void for a workflow-completed Entry that did not settle Debt (see interpretations)
describe("Resolve Debt")
  it should create an Entry from the Debt's original snapshot and mark the Debt Settled in one transaction
  it should give the Entry the Debt's Anchor, origin, and moment time and the resolving surface's Source
  it should record an explicit decline with an optional reason and mark the Debt Declined
  it should return NeedsTradeWorkflow and write nothing for workflow-routed Debt
  it should reject resolving Debt that is no longer Outstanding
describe("Write gate")
  it should return RuntimeNotWritable and write nothing when readiness is not Writable
```

### T4.5 Journal query (B)

- **Depends on:** T4.1
- **Seam:** `src/domain/journal/index.ts` (`query`)

```text
describe("Journal query projections")
  it should return the effective version with Edited and Void indicators in the Timeline projection
  it should return every version, Void, and transition in the Full History projection
  it should return stable Prompt and Option identities with outcome coverage in the Analysis projection
describe("Journal query filters")
  it should filter by item kind, Entry Type, Source, origin, status, due-through time, and moment interval
  it should filter by stable Prompt, Option, and Tag identities
  it should combine dimensions with AND and values within a dimension with OR
  it should return a Trade's narrative with Entries anchored to the Trade and to each of its Executions exactly once
  it should page with a cursor bound to the query and Journal snapshot and reject it after a change
```

### T4.6 Journal definition revision (B)

- **Depends on:** T4.1
- **Seam:** `src/domain/journal/index.ts` (`reviseDefinition`)

```text
describe("reviseDefinition")
  it should replace the complete future definition and return it at its new revision
  it should keep Prompt and Option identities stable through rewording and reordering
  it should retire omitted Prompts and Options prospectively
  it should return Unchanged for an identical normalized definition
  it should return Conflict for a stale expected revision
  it should reject removing or repurposing a workflow-critical role while its capability is installed
  it should reject removing the Hold option from Daily Trade Review
  it should reject a second IdeaSource-bound Prompt in one definition
  it should reject a Tag Select Prompt not bound to exactly one Tag Type
  it should reject conditional rules other than RequireWhenOption and AllOrNone
  it should leave existing Entries and Outstanding Debt on their original snapshots
describe("Seeding after revision")
  it should not overwrite a revised definition when defaults are seeded again
```

### T4.7 Trade Views: complete narrative (B)

- **Depends on:** T4.5

```text
describe("Trade narrative in Trade Detail")
  it should include Entries anchored to the Trade's Executions alongside Trade-anchored Entries, each once
  it should show each Execution-anchored Entry's Anchor status
```

### T4.8 Services and capability manifest update (B)

- **Depends on:** T4.4, T4.5, T4.6, T4.7

```text
describe("Installed Capability Manifest for D4")
  it should add exactly the D4 operations and variants listed in this plan
```

### T4.9 Journal timeline screen (B)

- **Depends on:** T4.8

```text
describe("Journal timeline")
  it should group items by date and show Entry Type, Anchor, Source, and moment time on each card
  it should show Edited and Void indicators and Addendum relationships
  it should show Debt and decline status without inventing incomplete Entries
  it should filter with toggle chips that have filter semantics, not answer semantics
  it should list Owed reflections with their due time
  it should explain an empty result and offer a new Entry
```

### T4.10 Entry composer, Entry view, and history (B)

- **Depends on:** T4.8

```text
describe("Entry composer")
  it should offer Review Note and Trader Reflection only
  it should set the Anchor from context and allow Standalone, Trade, or Execution where applicable
  it should render every prompt kind from the exact loaded definition, single choices as a labelled radio group
  it should save nothing until Save is pressed, including after navigation and resize
  it should show the saved Entry from the result without reloading
describe("Entry view")
  it should show View history with each version's save time and changes
  it should open Edit with the Entry's original prompts and labels
  it should create an Addendum linked to the parent
  it should require a reason to Void and show the Void visibly afterwards
  it should not offer Void for workflow-completed Entries that did not settle Debt
```

### T4.11 Debt answer and decline (B)

- **Depends on:** T4.8

```text
describe("Owed reflection form")
  it should render the Debt's original prompts and labels even after the definition changed
  it should answer the Debt and show it settled from the result
  it should decline with an optional reason
  it should show the required Trade Workflow instead of a form for workflow-routed Debt
```

### T4.12 Journal form editor (B)

- **Depends on:** T4.8

```text
describe("Journal form editor")
  it should add, reword, reorder, and retire Prompts and Options for one Entry Type
  it should lock workflow-critical Prompts against retirement or kind changes and say why
  it should bind a Tag Select Prompt to one Tag Type
  it should explain before Save that saved Entries and owed reflections keep their original forms
  it should show validation errors from the result and keep the edits
```

## Integration tests

| ID | Scenario | Durable-state proof |
|---|---|---|
| I4.1 | Create Standalone, Trade-anchored, and Execution-anchored Review Notes. | Reopen database; Trade narrative includes the Trade and Execution Entries once each. |
| I4.2 | Edit, Addendum, then Void one Entry. | Same identity with versions; Addendum has its own identity and parent link; Full History shows every transition. |
| I4.3 | Revise the Position Change Reflection definition, then answer a Debt created before it. | Entry uses the original snapshot; Debt Settled in the same commit. |
| I4.4 | Decline a Debt. | One explicit decline; the Debt is Declined. |
| I4.5 | Void the Entry that settled a Debt. | The same Debt identity is Outstanding again with its original snapshot. |
| I4.6 | Definition revisions: add, reorder, reword, retire; identical resubmission; attempt to remove Thesis. | New composer uses the revision; old Entries keep old labels; Unchanged and rejection write nothing. |
| I4.7 | Seed defaults after a revision. | No overwrite; no new records. |
| I4.8 | Tag Select Prompt bound to a Tag Type; retire one Tag Value. | Old Entry shows the retired value with historical and current labels; new selection rejected. |
| I4.9 | Two Edits with the same expected revision. | Second returns Conflict; one new version only. |
| I4.10 | Every D4 mutation result compared with an independent read. | AC-RESP-001 equality. |
| I4.11 | Version 3 database with D3 data migrates to version 4. | Every version 3 record unchanged. |

## End-to-end tests

| ID | Scenario | Acceptance |
|---|---|---|
| E4.1 | Open the composer, type, select answers, navigate away, resize, close and restart the browser: no Entry, version, draft, or Debt exists. | AC-JOUR-001 |
| E4.2 | Create, Edit, Addendum, Void, and View history in wide and narrow layouts. | AC-JOUR-002 |
| E4.3 | Answer one Debt and decline another from the Journal; Void the answer and see the Debt return. | AC-JOUR-005 |
| E4.4 | Revise a form; the composer uses it; an older Entry shows its original labels. | AC-JOUR-004 |
| E4.5 | Update from the D3 release with existing data. | AC-REST-004 (cumulative) |
| E4.6 | Keyboard-only Entry creation; axe scan; resize mid-composer. | AC-UI-001, AC-UI-002 |
| E4.7 | No correction, Marks, Review, or Backup actions are offered. | AC-CAP-001 |

## Critic flows

| ID | Flow |
|---|---|
| C4.1 | Write a Standalone Trader Reflection and a Trade-anchored Review Note. |
| C4.2 | Add a note to one Execution from Trade Detail and find it in the Trade narrative. |
| C4.3 | Edit, Addendum, Void, and View history. |
| C4.4 | Answer and decline owed reflections. |
| C4.5 | Revise a form and confirm old Entries keep their labels. |
| C4.6 | Filter the timeline. |
| C4.7 | Leave a half-written Entry and confirm nothing was saved. |
| C4.8 | Keyboard-only pass in narrow layout. |

## Acceptance mapping

| Scenario | Coverage in D4 |
|---|---|
| AC-JOUR-001 | T4.10, E4.1 |
| AC-JOUR-002 | T4.4, T4.5, I4.2, E4.2 |
| AC-JOUR-004 | T4.6, I4.3, I4.6, E4.4 |
| AC-JOUR-005 | Void reopening: T4.4, I4.5, E4.3 (retry uniqueness in D3) |
| AC-JOUR-007 | Seeding after revision: T4.6, I4.7 |
| AC-REF-002 | Journal Tag case: T4.3, I4.8 |
| AC-RESP-001 | I4.10 (Journal family) |
| AC-REST-004, AC-UI-001, AC-UI-002, AC-CAP-001 | E4.5, E4.6, E4.7 (cumulative) |
