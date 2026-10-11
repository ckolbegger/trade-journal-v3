# D2 — Open a Long Stock position: task breakdown

Definition: [implementation plan, D2](implementation-plan.md#d2--open-a-long-stock-position). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. D2 builds on D1's task identities, storage layout (A10), test tiers (decision 19), and harnesses ([D1 breakdown](D01-start-a-workspace-and-confirm-a-long-stock-plan.md)).

Status: **draft, under review.** Decisions P4–P7 and the D1 amendment were agreed on 2026-10-11 (first section); P5–P7 are recorded as plan decisions 21–23. Everything else is written against them and the working assumptions listed below. References to D3 were changed to D4 on 2026-10-11, after D3 was merged into D4 (plan decision 24). Amended on 2026-10-11 during the D5 breakdown: T2.5's "reject Defer" case is replaced from D5 onward ([D5, section 1.2](D05-deferred-reflection-and-journal-debt.md#12-amendment-to-d2-agreed-2026-10-11-and-applied-to-d2s-t25)).

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D1's P1–P3 so decisions stay unique across breakdown files.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P4 | **When is Entry Size excess recorded?** The spec says excess is recorded "as it occurs" (Trade Analysis, normative analytical rules). | **Agreed 2026-10-11. One occurrence per causing Position Change.** Every Position Change that raises the Planned Leg's open quantity above its planned quantity records one Entry Size (Excess) occurrence carrying the quantity it added above plan. Fingerprint: (Trade, Planned Leg, causing Position Change). This applies after the Entry Resolution Point too, so later oversizing is never missed. | (a) Count excess only inside the entry window: simpler, but adding to a full position later goes unrecorded, which the glossary's "exposure exceeded planned quantity when entered" does not limit to the window. (b) One occurrence per Trade, superseded as excess grows: fewer records, but loses which decision caused each excess and makes the Scorecard's occurrence counts less informative. |
| P5 | **May a Position Change be recorded with an Economic Time earlier than the Trade's latest one?** | **Agreed 2026-10-11. Yes.** Any Economic Time from the Plan's Economic Time (decision 20) up to now. Every commit rederives the Trade and reconciles recorded Deviation occurrences by fingerprint (create, retain, new version, supersede) in the same transaction. The receipt discloses when an earlier-dated entry moved the Entry Resolution Point or changed Entry Quality. This is the general mechanism AC-LIFE-003 agreement needs anyway; D6, D10, D12, and D15 extend it. | Reject any opening Execution earlier than the Trade's latest fact until corrections arrive (D15). Simpler now, but a trader who forgets one fill of a scaled entry cannot record it truthfully for 13 deliverables, and D15 must then add the same reconciliation. |
| P6 | **What does a failed or not-yet-possible migration leave readable?** Relevant clauses: delivery contract, "Data migration and recovery" ("readable by the prior compatible installed version or recoverable using an offered backup/recovery route") and "Update safety"; Workspace, "Initialization and update migration"; AC-REST-004 ("readable by the compatible recovery path or exportable"). | **Agreed 2026-10-11, including the narrowing of D1's AC-DEL-002 reading. (a) Data intact, not readable until migration succeeds.** A validation failure returns **Migration Blocked**: the old database's stores stay exactly as they were, the candidate is discarded, nothing is Ready, and Retry reruns the migration. The same applies when readiness fails at the first launch of a schema-changing release: migration needs `Writable`, so the release reports the Workspace as not yet readable by it (Integrity Blocked status with reason `AwaitingMigration`, never treated as empty), rather than Recovery Only with reads. D8 adds export of a blocked older database, which completes "exportable". The D2 claim for AC-REST-004 becomes "prior data intact, never Ready, retry activates atomically". **This narrows D1's confirmed reading of AC-DEL-002** (a failed post-activation readiness shows Recovery Only with reads) for the one launch where the update also changes the schema. | (b) Each release keeps a read adapter for the previous schema version, so Recovery Only and Migration Blocked both show reads. Most literal reading of "readable", but almost every deliverable changes the schema, so every read path must be kept working against two layouts. (c) The new service worker dry-runs the migration during install and refuses to activate if it fails. Keeps the old release in control, but it cannot cover a readiness failure after activation, and running domain validation inside the service worker duplicates the application stack there. |
| P7 | **AC-LIFE-003, the "mutation is prepared" branch.** The scenario's authorized preparation "either derives a disclosed repair for coherent facts or rejects incoherent facts". | **Agreed 2026-10-11. (b) Repair and disclose when the facts are coherent; reject only incoherent facts.** When the Trade's stored lifecycle or recorded Deviations disagree with facts that replay coherently, `recordPositionChange` proceeds, writes the expected records, and its receipt lists each repair (stored versus expected). When the facts themselves cannot be replayed (for example an Execution naming an unknown Planned Leg), it rejects with a no-write `IntegrityDisagreement` listing the findings. Migration (D2) and Restore (D8) use the same repair rule, as Workspace requires for Restore. | (a) Reject every mutation on a Trade with any disagreement until D8's Restore can repair it. Simpler to explain, but leaves the trader unable to record real fills on that Trade, and does not match the scenario's wording. |

**Amendment to D1 (agreed 2026-10-11 and applied to the D1 breakdown's T1.7 and T1.20).** A tab still running the D1 release could commit a write to the old database in the few milliseconds between its pre-mutation readiness recheck (D1 A4) and the D2 tab's migration snapshot. To close that window deterministically, D1's Persistence must close its Workspace connection on IndexedDB `versionchange` and treat the session as superseded: the next mutation reruns readiness (whose control check now fails, because the new release controls the page) and returns `RuntimeNotWritable`, and the shell shows D1's existing "Updated in another tab: reload when ready" message with on-screen form values kept. The D2 migrator then opens the old database at a higher IndexedDB version, with no store changes, before taking its snapshot, which forces every old connection closed. This added two cases to D1's T1.7 and one to T1.20. The old database's contents are unchanged; only its IndexedDB version number rises (the schema version lives in `meta` and is unchanged).

### 1.2 Working assumptions

Numbering continues from D1's A1–A17. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A18 | **Executions in D2:** Buy only, on the Plan's Stock Instrument only, serving its single Planned Leg (`ServesPlannedLeg`), with every member in one Trade. The UI fixes action, Instrument, and leg. The command shape keeps the full spec form (Trade list, per-member intent), and anything outside D2's variant returns a typed `VariantNotInstalled` rejection: a Sell (D6), another Instrument (Planned-Leg Terms, D10), `ExplicitlyUnplanned` (D10), or more than one Trade (D20, D21). Each Execution has quantity and price (positive, A9), a required fee (0 or more, at most 6 fractional digits), and its own Economic Time. At most 20 Executions per Position Change. |
| A19 | **Position Change Economic Time** is its earliest member's. That is also the reflection's moment time. Every Execution's Economic Time must be at or after the Plan's (decision 20) and not in the future. |
| A20 | **Recorded Sequence** is a per-Trade counter stored in the Trade document and assigned at apply, in submitted member order, after the Position Change fact itself. |
| A21 | **Position Changes are facts too.** Each Position Change is a stable fact identity with a single-version list (decision 11), holding its Economic Time, member fact identities, origin Trade, and participating Trades. D15 can then correct or Void members without a fact-shape migration. |
| A22 | **Lots in D2:** each opening Execution creates exactly one Open Lot holding its whole fee as unconsumed opening fee. Lots are derived by Trade Analysis and never stored. |
| A23 | **Entry window and Entry Resolution Point (D2 form):** the window opens with the first Position Change that establishes exposure and resolves at the Position Change after which the Planned Leg's entered quantity is at or above its planned quantity. (Cutoff by the first reduction arrives in D6; Not Entered in D6.) |
| A24 | **Entry Quality for Long Stock**, over the window's opening Executions, using the Stop and Target effective at the Entry Resolution Point (before D17 these are always the original ones): average entry `avg = Σqp / Σq`; actual initial risk `= max(0, Σq × (avg − Stop)) + window fees`; actual initial reward `= max(0, Σq × (Target − avg)) − window fees`. Also returned, each as its own Calculation Result: risk in Plan R (`÷ 1R`), slippage `(avg − intended entry) × Σq`, size ratio `Σq ÷ planned quantity`, planned reward/risk, and actual reward/risk. An entry at or below the Stop flags `EntryAtOrBeyondStop` and makes the actual ratio `NotApplicable(EntryAtOrBeyondStop)`; at or above the Target, likewise `EntryAtOrBeyondTarget`. Before resolution, Entry Quality is `NotApplicable(EntryNotResolved)`, which D25's Scorecard reads as Pending. The Below Plan / Met or Exceeded classification is left to D25: it is derived, needs no captured fact, and the spec defines it only in the Scorecard. |
| A25 | **Planned-Leg Fulfillment in D2:** `Unfilled` (no Executions), `PartiallyFilled` (below planned quantity), `FilledAsPlanned` (at planned quantity, no Deviation on the leg), `FilledWithDeviation` (any active Entry Size occurrence on the leg). |
| A26 | **Recorded Deviation occurrence:** a stable occurrence identity with a version list. A version holds the fingerprint, type `EntrySize`, form `Excess`, quantity above plan, causing Position Change, Economic Time, and status `Active`; supersession appends a `Superseded` version with the reason. Reconciliation compares expected and recorded occurrences by fingerprint: create, retain, append a new version when the quantity changes, or supersede. |
| A27 | **Last Activity** is the latest Economic Time among the Trade's Plan and effective Position Changes. It is stored in the Trade document and maintained by every commit. |
| A28 | **Storage (schema version 2), extending A10:** Position Changes, Executions, and recorded Deviation occurrences live inside the Trade document. A new `trades` index `byLifecycleActivity` on `[lifecycle, activityDesc, tradeId]`, where `activityDesc` is a descending sort key, serves the Open list with a single `index.getAll(range, 200)` request per page. New store `journalDeclines`. New store `journalObligations`, keyed by obligation key and holding the current outcome's kind and identity; writes use `add`, so a duplicate outcome fails the transaction. It is a private index, rebuildable from `journalEntries` and `journalDeclines`. |
| A29 | **Journal decline record:** obligation key `(PositionChangeReflection, Position Change)`, Trade Anchor to the originating Trade, Source Position Change, Position Change origin, optional reason (at most 500 characters), the definition revision shown, moment time, and authored time. |
| A30 | **Migration engine (first one):** under an exclusive Web Lock `tj-lifecycle` (an in-process lock port in Node, disclosed), the migrator re-inspects the root. It then bumps the old database's IndexedDB version (no store changes; see the D1 amendment) and copies every store in one read-only snapshot through pure per-record transforms into a candidate database `tj-ws-<uuid>`. The candidate is named in a root `candidates` record before copying. The migrator adds seed-manifest additions, builds private indexes, and validates the candidate with the per-module section validators (T2.9) and Trade Analysis `derive` on every Trade, repairing coherent disagreement and disclosing it (P7). One root transaction then writes the new pointer, removes the candidate entry, and lists the old database under `retired`. Retired and abandoned candidate databases are deleted after the flip and on every later root inspection. Migration runs only when readiness is `Writable`. |
| A31 | **Migration UI:** while migrating, the startup view says "Updating your journal to this release", with no data or controls. Migration Blocked says the journal could not be converted, that the data is unchanged, and offers Retry (and, from D8, backup export). |
| A32 | **Trades view:** two lifecycle tabs, Open (default) and Planned, as a tablist. The Open list shows up to 200 Trades per page (the benchmarked maximum, so the whole open book is one page); Planned keeps pages of 50. Only lifecycles the release can produce appear. |
| A33 | **Entry form:** "Record entry" on Planned and Open Trade Detail opens one Position Change form with Execution rows (quantity, price, fee, Economic Time defaulting to now in the Workspace zone; action, symbol, and leg shown read-only) and a reflection section. The reflection section shows the Position Change Reflection form, with "Decline to reflect" (optional reason) as the explicit alternative. No disposition is submitted implicitly. |
| A34 | **Release-tag naming:** git tags are shared by every worktree in this repository, so D2's harness builds the previous release from the implementation-specific tag `claude-opus-5.5-d1`, created when D1's gate passes. It is exported with `git archive` into a scratch directory and built there; no worktree is created. |

### 1.3 Benchmark dataset at D2 (AC-PERF-001 starts here)

The generator uses the mature profile in [D1 section 1.3](D01-start-a-workspace-and-confirm-a-long-stock-plan.md#13-mature-dataset-profile-agreed-with-p1) at the scale D2 can produce: no closing (D6), Marks or Daily Review (D4) yet.

| Record kind | Count at D2 | Mature profile |
|---|---|---|
| Trades | 25,000: 200 Open, 24,800 Planned | 25,000 (24,700 Closed, 200 Open, 50 Planned, 50 Abandoned) |
| Position Changes | 400 (each Open Trade has 1–3) | 100,000 |
| Executions | about 800 (1–3 per Position Change) | 200,000 |
| Plan Reflection Entries | 25,000 | 25,000 |
| Position Change Reflection outcomes | 400 (80% Entries, 20% declines) | 100,000 |
| Catalog | 3 Institutions, 6 Accounts, Long Stock | about 60 |

Generation is deterministic (seeded identities, fixed clock starting 2021-10-11, Economic Times spread over five years of sessions) and runs once per generator version and schema version. Each later deliverable extends the generator toward the full profile as its record kinds arrive; D8 loads the dataset through a real Restore.

---

## 2. Implementation boundaries added or extended in D2

| Canonical boundary | Code location | D2 operations |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `derive` extended: fact replay, Instrument Positions, Open Lots, opening fees, expected lifecycle, Entry Resolution Point, Entry Quality, Planned-Leg Fulfillment, Entry Size excess, agreement findings, and the `DerivedTradeReconciliation` for a candidate |
| Trade Record | `src/modules/trade-record/` | `prepareChange`/`applyPreparedChange` (PositionChange); recorded Deviation occurrences; `queryRecords` (`CurrentState` Open by Last Activity); section validator |
| Journal | `src/modules/journal/` | seed manifest v2; `prepareEffects`/`applyPreparedEffects` (Position Change Reflection: Complete, Decline); `query` (Trade narrative with declines); obligation index; section validator |
| Reference Catalog | `src/modules/reference-catalog/` | section validator |
| Trade Workflows | `src/coordinators/trade-workflows/` | `recordPositionChange` (opening and increase) |
| Trade Views and Reporting | `src/coordinators/trade-views/` | `browseTrades` (Open), `getTradeDetail` (Open), integrity findings surfaced |
| Workspace | `src/coordinators/workspace/` | `initialize` with migration, Migration Blocked, Retry; manifest v2 capabilities |
| Persistence/Transaction (internal) | `src/persistence/` | schema v2 layout, candidate database, pointer flip, retired and abandoned-candidate cleanup, version bump, `versionchange` handling, lifecycle lock port |
| Migrations | `src/persistence/migrations/` | `v1→v2` per-record transforms |
| UI | `src/ui/` | entry form, Trades tabs, Open list, Open Trade Detail, migration views |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T2.1 | Trade Analysis: replay, Positions, Open Lots, opening fees, expected lifecycle | domain | B | D1 | `TradeAnalysis.derive` |
| T2.2 | Trade Analysis: entry window, Entry Resolution Point, Entry Quality, Planned-Leg Fulfillment | domain | B | T2.1 | `TradeAnalysis.derive` |
| T2.3 | Trade Analysis: Entry Size excess, agreement findings, reconciliation | domain | B | T2.2 | `TradeAnalysis.derive` |
| T2.4 | Trade Record: Position Change variant, recorded Deviations, Last Activity, Open query | domain/persistence | B | T2.3, T2.8 | `TradeRecord` |
| T2.5 | Journal: Position Change Reflection seed, Complete and Decline, obligation index | domain/persistence | B | T2.8 | `Journal` |
| T2.6 | Trade Workflows: `recordPositionChange` | application | B | T2.3–T2.5 | `TradeWorkflows.recordPositionChange` |
| T2.7 | Trade Views: Open list and Open Trade Detail | application | B | T2.3–T2.5 | `TradeViewsAndReporting` |
| T2.8 | Persistence: schema v2, candidate database, pointer flip, cleanup, version bump, `versionchange` | persistence | B | D1 (with the D1 amendment) | internal `Persistence` interface |
| T2.9 | Section validators: Catalog, Journal, Trade Record | domain | B | T2.4, T2.5 | `validateSection` per module |
| T2.10 | Workspace: migration in `initialize`, Migration Blocked, Retry | application | B | T2.8, T2.9 | `Workspace.initialize` |
| T2.11 | Installed Capability Manifest and composition root for D2 | application | S | T2.6, T2.7, T2.10 | `verify:capabilities` |
| T2.12 | UI: entry form and reflection | UI | B | T2.11 | `PositionChangeForm` |
| T2.13 | UI: Trades tabs and Open list | UI | B | T2.11 | `TradeList` |
| T2.14 | UI: Open Trade Detail | UI | B | T2.11 | `TradeDetail` |
| T2.15 | UI: migration progress and Migration Blocked views | UI | B | T2.11 | `AppShell` startup states |
| T2.16 | Fault build: migration stages | test | S | T2.10 | `build:faults`, `verify:no-fault-hooks` |
| T2.17 | Release harness: previous release from the `claude-opus-5.5-d1` tag | test | S | D1 T1.26 | `build:releases`, `verify:releases` |
| T2.18 | Capacity basis recomputed for schema 2 | test/infrastructure | S | T2.11 | `measure:capacity`, `verify:capacity` |
| T2.19 | Freeze the schema-v2 Workspace fixture; migrate the v1 fixture | test | S | T2.10, T2.11 | `fixtures:freeze`, `verify:fixtures` |
| T2.20 | Deterministic benchmark generator and bench build | test | S | T2.11 | `build:bench`, `bench:generate` |
| T2.21 | Latency harness and query-count proof | test | S | T2.20 | `bench:run`, `test:integration -- d2/query-count` |
| T2.22 | Node mock-free integration suite | test | S | T2.11 | `test:integration` |
| T2.23 | Browser integration suite (Chromium) | test | S | T2.12–T2.19 | `test:e2e` |
| T2.24 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks** (from the plan's parallelism note): once `PositionChangeCommand`/`Result` and the Open read model are fixed in T2.11's type module, three tracks proceed in parallel: Trade Analysis (T2.1–T2.3); persistence and migration (T2.8–T2.10, T2.16, T2.17); and UI (T2.12–T2.15, against the facade test double). T2.4–T2.7 join the first two.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped.

**Reference Trade** used by many cases: Long Stock Plan for 100 shares, intended entry 50.00, Stop 47.50, Target 56.00 (1R $250, Original Planned Reward $600, planned ratio 12/5), Plan Economic Time 2026-10-12 09:00 America/New_York. Position Changes: **PC1** at 10:00, one Execution 60 @ 50.10, fee 1.00; **PC2** at 11:00, one Execution 40 @ 50.30, fee 1.00; **PC3** at 14:00, one Execution 20 @ 51.00, fee 1.00.

### T2.1 Trade Analysis: replay, Positions, Open Lots, opening fees, expected lifecycle

Seam: `TradeAnalysis.derive` (pure).

```text
describe("fact replay order")
  it should order effective facts by Economic Time then Recorded Sequence, regardless of the order they are supplied in
  it should order two Executions with equal Economic Time by Recorded Sequence

describe("Instrument Position and Open Lots")
  it should derive Position 60 and one Open Lot (60 @ 50.10, unconsumed opening fee 1.00, opening Execution identity) after PC1
  it should derive Position 100 and two Open Lots in Fact Order after PC1 and PC2
  it should create one Lot per Execution when one Position Change has two Executions (30 @ 50.00 fee 0.50 and 30 @ 50.20 fee 0.50)
  it should report incurred opening fees as the exact sum of Execution fees, counting each fee once
  it should keep exact values for fractional inputs (2.5 @ 10.123456, fee 0.333333)

describe("expected lifecycle")
  it should expect Planned with no Position Change and Open after any opening Execution
  it should report agreement Agrees when the supplied stored lifecycle equals the expected one

describe("incoherent facts")
  it should return a typed IncoherentFacts result naming the fact when an Execution names an unknown Planned Leg, has a nonpositive quantity, or duplicates a fact identity
  it should return deep-equal results for identical inputs
```

### T2.2 Trade Analysis: entry window, Entry Resolution Point, Entry Quality, Planned-Leg Fulfillment

Seam: `TradeAnalysis.derive` (pure).

```text
describe("Entry Resolution Point")
  it should leave the entry unresolved after PC1 and report Entry Quality NotApplicable(EntryNotResolved)
  it should resolve at PC2, when entered quantity first reaches the planned 100
  it should resolve at PC1 when PC1 alone buys 120 shares

describe("Entry Quality (reference Trade, resolved at PC2)")
  it should report average entry 50.18, window quantity 100, and window fees 2.00
  it should report actual initial risk $270.00 and actual initial reward $580.00
  it should report risk in Plan R 27/25, slippage $18.00, size ratio 1, planned ratio 12/5, and actual ratio 58/27, each as its own Calculation Result
  it should keep Entry Quality unchanged after PC3 adds 20 shares outside the window (AC-CALC-001)
  it should include every Execution of the resolving Position Change in the window, so a first entry of 120 @ 50.00 fee 1.00 gives risk $301.00, reward $719.00, and size ratio 6/5

describe("entries beyond a boundary")
  it should report risk equal to window fees, flag EntryAtOrBeyondStop, and return the actual ratio as NotApplicable(EntryAtOrBeyondStop) for 100 @ 47.00 fee 1.00
  it should flag EntryAtOrBeyondTarget and return the actual ratio as NotApplicable(EntryAtOrBeyondTarget) for 100 @ 56.50 fee 1.00

describe("Planned-Leg Fulfillment")
  it should report Unfilled before PC1, PartiallyFilled after PC1, and FilledAsPlanned after PC2
  it should report FilledWithDeviation after PC3
```

### T2.3 Trade Analysis: Entry Size excess, agreement findings, reconciliation

Seam: `TradeAnalysis.derive` (pure), given a record with its recorded Deviation occurrences.

```text
describe("Entry Size excess (P4)")
  it should expect no occurrence after PC1 and PC2
  it should expect one Excess occurrence of 20 shares fingerprinted (Trade, leg, PC3) after PC3
  it should expect a second occurrence of 10 shares fingerprinted (Trade, leg, PC4) after a further PC4 of 10
  it should expect one occurrence of 20 fingerprinted (Trade, leg, PC1) when PC1 buys 120

describe("earlier-dated Position Change (P5)")
  it should move the Entry Resolution Point to a Position Change recorded later but dated earlier, and recompute Entry Quality from the new window
  it should change the expected occurrence for an existing fingerprint when an earlier-dated entry changes the quantity above plan (PC1 60 at 10:00, PC2 60 at 11:00, then PC-early 40 at 10:30: PC2's excess goes from 20 to 60)

describe("agreement findings")
  it should report LifecycleDisagreement when stored lifecycle is Planned and an opening Execution exists
  it should report DeviationMissing and DeviationUnexpected, each with its fingerprint, when recorded and expected occurrences differ
  it should never return a corrected record or alter its input

describe("reconciliation for a candidate")
  it should bind the candidate digest, expected lifecycle, and the create, retain, new-version, and supersede actions for every fingerprint
  it should list repairs separately from the change's own effects when the before-state disagreed with coherent facts (P7)
```

### T2.4 Trade Record: Position Change variant, recorded Deviations, Last Activity, Open query

Seam: `TradeRecord`, against `fake-indexeddb`.

```text
describe("prepareChange: PositionChange")
  it should build a candidate with one Position Change fact and its Execution facts, each a candidate fact identity holding a single-version list, plus Planned-Leg intent per Execution
  it should assign Recorded Sequences from the Trade's counter, the Position Change first and then members in submitted order, and set Last Activity to the latest Economic Time
  it should return before and candidate AnalysisInput with a canonical digest, write nothing, and reserve no identity
  it should return Conflict naming the Trade when the expected FactRevision is stale
  it should return NotFound for an unknown Trade

describe("applyPreparedChange: PositionChange")
  it should reject a reconciliation whose digest, expected lifecycle, or Deviation actions do not match the prepared change
  it should assign durable identities, stage the Trade document, move lifecycle-index membership from Planned to Open, and apply every Deviation action, returning the identity mapping and staged projection
  it should stage a repair listed in the reconciliation exactly as listed (P7)
  it should refuse to run outside a semantic transaction

describe("queryRecords: CurrentState Open")
  it should select Open Trades ordered by Last Activity descending then Trade identity
  it should read each page with exactly one index getAll request, returning Summary or AnalysisInput for the whole page from one read snapshot
  it should return pages of up to 200 with a cursor that fails with CursorExpired after any Trade commit

describe("getRecord")
  it should return Position Changes, Executions, and recorded Deviation occurrences with their version lists in AnalysisInput
```

### T2.5 Journal: Position Change Reflection seed, Complete and Decline, obligation index

Seam: `Journal`.

```text
describe("seedDefaults: manifest v2")
  it should add the Position Change Reflection Entry Type, its definition revision 1, and the Position Change Source, and nothing else, to a v1-seeded Journal
  it should match the contract exactly: "Decision mode" required Single Select (As Planned, Deliberate Adjustment, Reactive, Externally Imposed); "Primary emotion" required Single Select (Calm, Eager, Anxious, FOMO, Revenge, Relieved, Frustrated, Other); "Decision confidence" required Scale 1–5; "Note" optional Text, in that order
  it should add nothing when run again with manifest v2

describe("prepareEffects: Position Change Reflection, Complete")
  it should prepare an Entry with the definition snapshot, a Trade Anchor to the originating Trade, Source Position Change, the Position Change origin, and moment time equal to the Position Change's Economic Time
  it should return RequiredAnswerMissing for each blank required prompt at once, and store a blank Note as Unanswered

describe("prepareEffects: Position Change Reflection, Decline")
  it should prepare a decline with the obligation key, Anchor, Source, origin, the definition revision shown, an optional reason, and moment and authored times
  it should reject a reason longer than 500 characters with ReasonTooLong
  it should reject Defer with DispositionNotAllowed (replaced from D5 by D5 T5.2, which installs Defer; the test is changed to the new expectation then, not deleted)

describe("applyPreparedEffects and the obligation index")
  it should stage the Entry or decline and its obligation record in the shared transaction, mapped to Trade Record's durable Position Change identity
  it should fail the transaction when the obligation key already has an outcome, whether Entry or decline
  it should rebuild the obligation index from Entries and declines with the same contents

describe("query: Trade narrative")
  it should return Plan Reflection, Position Change Reflections, and declines for the Trade ordered by moment time then identity, each with its snapshot labels or decline reason
```

### T2.6 Trade Workflows: `recordPositionChange`

Seam: `TradeWorkflows.recordPositionChange`.

```text
describe("accepted opening Position Change")
  it should commit the Position Change, its Executions, the Open lifecycle-index move, Deviation actions, and the reflection Entry in one semantic commit
  it should return TradeMutationSuccess: new FactRevision, created fact identities, the lifecycle transition Planned to Open, the Entry or decline identity, the post-commit Trade projection, its derivation (Position, Lots, Entry status, Entry Quality, Fulfillment, Deviations), the Journal outcome projection, and the affected Open and Planned list scopes
  it should record a decline instead of an Entry when the disposition is Decline
  it should keep the Trade Open and add PC3's Entry Size occurrence to the receipt's Deviation reconciliation

describe("earlier-dated entry (P5)")
  it should accept an Execution dated between the Plan and the Trade's latest fact, and disclose in the receipt that the Entry Resolution Point and Entry Quality changed

describe("integrity before the change (P7)")
  it should commit and list each repair in the receipt when the Trade's stored lifecycle or recorded Deviations disagree with coherent facts
  it should return IntegrityDisagreement with the findings and write nothing when the Trade's facts are incoherent

describe("rejected")
  it should reject an Execution before the Plan's Economic Time with EconomicTimeBeforePlan, and one in the future with EconomicTimeInFuture
  it should reject a Sell, another Instrument, ExplicitlyUnplanned intent, or a second Trade with VariantNotInstalled
  it should reject zero or negative quantity or price, a negative fee, a missing fee, or more than 20 Executions with typed issues, all at once together with Journal issues
  it should return Conflict and write nothing when the same command is submitted twice (the second carries a stale FactRevision)
  it should leave Trade Record, Journal, and Workspace content revisions unchanged on every rejection
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

### T2.7 Trade Views: Open list and Open Trade Detail

Seam: `TradeViewsAndReporting.browseTrades` and `getTradeDetail`.

```text
describe("browseTrades: Open")
  it should return a Ready page with, per Trade, underlying, Strategy, Account and Institution labels, open quantity of planned quantity, average open cost, incurred fees, entry status (Entering or Resolved), Deviation count, integrity indicator, and Last Activity, ordered by Last Activity descending
  it should return an empty Ready page when no Trade is Open
  it should derive each Trade once and bind the Trade, Journal, and Catalog revisions from one snapshot

describe("getTradeDetail: Open")
  it should return the Plan, stored lifecycle Open with agreement, Position, Open Lots, Position Changes with their Executions in Fact Order, Entry status, Entry Quality, Planned-Leg Fulfillment, recorded Deviations, and the Journal narrative including declines
  it should return the Planned form of Detail unchanged for a Planned Trade

describe("integrity is surfaced, never repaired (AC-LIFE-003)")
  it should return Ready with each agreement finding, and the list item's integrity indicator, when stored and expected records disagree
  it should leave every content revision unchanged after reading a Trade with a disagreement
```

### T2.8 Persistence: schema v2, candidate database, pointer flip, cleanup

Seam: the internal `Persistence` interface (`inspectRoot`, `createCandidate`, `copySnapshot`, `activateCandidate`, `discardCandidate`, `commit`), against `fake-indexeddb`, with the lifecycle lock port.

```text
describe("schema v2 layout")
  it should create a fresh Workspace at schema version 2 with the byLifecycleActivity index, journalDeclines, and journalObligations

describe("candidate and activation")
  it should name the candidate in the root candidates record before creating it
  it should bump the old database's IndexedDB version without changing any store, closing every other connection to it first
  it should copy every store through the supplied per-record transforms in one read-only snapshot
  it should switch the pointer, remove the candidate entry, and list the old database as retired in one root transaction
  it should delete a retired database after activation and on the next inspection if deletion was interrupted
  it should delete a listed candidate that the pointer does not name on the next inspection, leaving the pointer unchanged

describe("discarding")
  it should delete the candidate and leave the old database's stores and the pointer exactly as they were

describe("versionchange")
  it should close its Workspace connection and mark the session superseded when another connection requests a version change

describe("lifecycle lock")
  it should run at most one migration at a time; a second caller waits and then sees the already-activated Workspace
```

### T2.9 Section validators: Catalog, Journal, Trade Record

Seam: `validateSection(snapshot)` exported by each fact module, returning `{ issues, repairs }`. D8's `prepareRestore` reuses them.

```text
describe("Catalog section")
  it should accept the seeded Catalog with Institutions and Accounts
  it should report DuplicateIdentity, MissingParent (Account whose Institution is absent), and UnknownSeedKey

describe("Journal section")
  it should accept seeded definitions, Plan and Position Change Reflection Entries, and declines
  it should report an Entry whose definition revision is absent, an obligation with two outcomes, and an Entry or decline with no Anchor

describe("Trade Record section")
  it should accept Planned and Open Trades with single-version fact lists
  it should report a Trade referencing an unknown Account, a fact identity used twice, and an Anchor naming an unknown Trade
  it should return a repair, not an issue, when stored lifecycle or recorded Deviations disagree with facts that derive coherently
  it should return an issue when a Trade's facts are incoherent
```

### T2.10 Workspace: migration in `initialize`, Migration Blocked, Retry

Seam: `Workspace.initialize` and `getStatus`.

```text
describe("migration from schema 1")
  it should migrate a v1 Workspace to v2 and return Opened with a receipt naming from and to versions, per-store record counts, seed additions (Position Change Reflection, Position Change Source), repairs, and private rebuilds
  it should leave the Planned list and every Trade Detail equal, apart from opaque revision tokens, to the v1 views
  it should return Opened(existing) with no migration on the next launch

describe("migration failure (AC-REST-004)")
  it should return MigrationBlocked with the failed stage, issues, and unchanged-data evidence (database name, content revision, per-store counts) when validation fails, leaving the old stores equal and no candidate
  it should never report Ready while blocked, and getStatus should report MigrationBlocked
  it should migrate and return Opened when Retry runs after the cause is removed

describe("not Writable before migration (P6)")
  it should return RuntimeNotWritable with Workspace status IntegrityBlocked(AwaitingMigration), not migrate, and leave the old database unchanged when readiness fails and the stored schema is older

describe("unsupported versions")
  it should return IntegrityBlocked(UnsupportedNewerSchema) and write nothing when the stored schema is newer than the release
```

### T2.12 UI: entry form and reflection

Seam: `PositionChangeForm` with a facade test double.

```text
describe("rendering")
  it should show the Plan's symbol, Buy, and the Planned Leg read-only, one Execution row with Economic Time defaulting to now, and Add and Remove row controls up to 20 rows
  it should render the Position Change Reflection from the loaded definition revision, with Decision mode and Primary emotion as radio groups in labelled fieldsets and Decision confidence as a 1–5 radio group
  it should offer "Decline to reflect" with an optional reason as the explicit alternative to completing the form

describe("submission")
  it should submit one Position Change with every row, the expected FactRevision, the rendered definition revision, stable Prompt and Option identities, and the chosen disposition
  it should show every issue beside its field or row, list them in a summary, and move focus to the summary
  it should render the saved Position Change, Entry Quality when resolved, any new Entry Size Deviation, and any repairs from the returned state alone, without a read call
  it should show Conflict with the entered values kept and an explanation that the Trade changed
  it should make no call when cancelled or left, and register as unsaved while any value differs from its initial value
```

### T2.13 UI: Trades tabs and Open list

Seam: `TradeList` with a facade test double.

```text
describe("lifecycle tabs")
  it should show Open and Planned tabs as a tablist with Open selected by default, and no other lifecycle
  it should request a fresh page on every tab switch

describe("Open list")
  it should render distinct Loading, Ready, Empty (explaining that recording an entry on a Planned Trade opens it), and Error (with Retry) states
  it should show quantity as "60 of 100", average cost, fees, entry status, Deviation count, an integrity badge with text, and Last Activity in the Workspace zone, with numbers right-aligned in tabular numerals
```

### T2.14 UI: Open Trade Detail

Seam: `TradeDetail` with a facade test double.

```text
describe("Open Trade Detail")
  it should show lifecycle "Open" as text, Position, an Open Lots table, and Position Changes with their Executions in Fact Order
  it should show Entry Quality figures with units once resolved, and "Entry not yet resolved: 60 of 100 entered" before
  it should show Planned-Leg Fulfillment and each Entry Size Deviation with its quantity and causing Position Change
  it should show Position Change Reflections with snapshot labels and declines as "Reflection declined" with the reason
  it should show an integrity panel listing stored versus expected values when agreement fails
  it should offer Record entry only while Writable
```

### T2.15 UI: migration views

Seam: `AppShell` with a facade test double.

```text
describe("migration startup states")
  it should show "Updating your journal to this release" with no data or controls while initialize is migrating
  it should render Migration Blocked with the reason, "Your data is unchanged", and Retry, and no data navigation
  it should render IntegrityBlocked(AwaitingMigration) explaining that this release must convert the journal once the browser passes its safety checks, with Retry
  it should show the D1 "Updated in another tab" message, keeping on-screen form values, when the session is superseded by a version change
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T2.11 Capability manifest and composition | `npm run verify:capabilities` | The manifest adds `recordPositionChange` (Opening/Increase; Stock; single Trade; Complete and Decline), `browseTrades` and `getTradeDetail` for Open, the Position Change Reflection Entry Type, and schema version 2. Every new operation is reachable from a route, and nothing beyond D2 is. | AC-CAP-001. |
| T2.16 Migration faults | `npm run build:faults && npm run verify:no-fault-hooks` | `?faults=` accepts `migration:validate` (validation reports one issue), `migration:activate` (the root flip transaction aborts), and `migration:hold` (the migrator waits before activating until `window.__tjFaults.release()`). The production `dist/` contains none of these hooks. | B2.4, B2.6, C2.9. |
| T2.17 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d1` is built from tag `claude-opus-5.5-d1` (A34), alongside D1's v1, v2, and v2-corrupt and a current `d2` folder. `verify:releases` confirms `d1` reports schema 1 and its own release identity. | B2.3, B2.5, C2.8. |
| T2.18 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The measurement adds 200 Open Trades with Position Changes, Executions, Entries, and declines, and replaces the Position Change, Execution, and Position Change Reflection allowances with measured bytes. `capacity-basis.json` carries schema version 2, and `verify:capacity` passes; it fails if the basis still names schema 1. | Capacity readiness check (decision 18). |
| T2.19 Schema fixtures | `npm run fixtures:freeze -- --schema 2`, then `npm run verify:fixtures` | The v2 dump adds three Open Trades (PC1–PC3 of the reference Trade with Complete and Decline reflections, and one Entry Size occurrence) to D1's fixture content. `verify:fixtures` opens the v1 dump with the current release, checks that it migrates and that the views equal its committed snapshot, and checks the v2 dump opens Ready with its own snapshot. | Migration from every earlier version; D4 onward. |
| T2.20 Benchmark generator | `npm run build:bench && npm run bench:generate` | `dist-bench/` differs from production only by a generator entry point and by skipping the per-mutation readiness recheck (D1 A4) while the generator runs. The generator creates the dataset in section 1.3 through the production facade in Chromium, records its counts and generator version in `bench/dataset.json`, then removes the service-worker registration and Cache Storage from the profile and saves it as the cached profile. A profile whose generator or schema version differs is regenerated. | T2.21. |
| T2.21 Latency harness and query count | `npm run bench:run`; `npm run test:integration -- d2/query-count` | `bench:run` copies the cached profile and serves the **production** build. One warm-up launch installs the service worker and is excluded. Then 30 cold starts (browser process stopped and relaunched, network disabled) are each timed to the `tj:interactive` performance mark (readiness Writable and the Open list fully rendered). Next, 30 warm Planned-to-Open tab switches are each timed to `tj:open-list-ready`. The harness writes raw timings, nearest-rank p95 (the 29th of 30 sorted values), hardware, OS and engine versions, and dataset provenance to `evidence/D02/bench.md`, and fails if cold p95 exceeds 2,500 ms or warm p95 exceeds 1,500 ms. Before and after the runs it compares the Open list (200 rows) with the generator's expected rows. The Node test wraps `fake-indexeddb` in a disclosed request counter and shows that a page of the Open list issues one `getAll` on `trades`, and the same request count with 1,000 or 2,000 Planned Trades. | AC-PERF-001. |
| T2.22 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1 and D2 passes. | Cumulative regression. |
| T2.23 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1 and D2 passes. | Cumulative regression. |
| T2.24 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build, Chromium as the routine engine, read-only probe). D2 adds:

| Substitute | Used in | Replaces | Why it does not weaken the contract |
|---|---|---|---|
| In-process lifecycle lock port | Node suite | Web Locks API | Node has no Web Locks. The browser suite uses the real API (B2.5). |
| Integrity fixture writer | I2.8, B2.13 | a real stored disagreement | AC-LIFE-003's Given is "a controlled integrity fixture". Test code edits raw stored records before the application opens them, and never during a run. |
| Migration fault stages | B2.4, B2.6, C2.9 | a real migration defect | Faults act only at the stage boundaries named in T2.16. Copying, validation, activation, and every view are production code. The Node suite uses real invalid data instead (I2.2). |
| Request-counting `fake-indexeddb` wrapper | T2.21 query-count test | — | Counts requests only and changes no behavior. |
| Bench build for generation only | T2.20 | production build | Generation skips only the per-mutation readiness recheck. Measurement runs the production build. |

### 6.1 Node application-stack suite (`tests/integration/d2/`)

Conventions as in D1: the application is built with `createApplication({ indexedDB: fakeIndexedDB, host: NodeTestHost, clock, ids, locks })`, only facade operations are called, "restart" builds a new application on the same factory, and "unchanged" compares full dumps of every store.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I2.1 Migrate the v1 fixture | Load `tests/fixtures/workspace-v1/` into the factory; `initialize`; restart; `getStatus`. | Opened with the migration receipt. After restart: Ready at schema 2; Planned list and Details equal the fixture's snapshot; Position Change Reflection seeded once; the pointer names a new database, the old one is gone, and no candidate is listed. |
| I2.2 Migration failure and retry | v1 fixture with one Trade's Account reference changed to an unknown identity; `initialize`; then restore the reference and Retry. | MigrationBlocked naming the reference issue; old stores equal the loaded fixture apart from the IndexedDB version; no candidate database; never Ready. After Retry: Opened with a receipt; Ready after restart. |
| I2.3 Interrupted migration | Stop the application (a) after the candidate is listed and partly copied and (b) after the flip but before the old database is deleted; restart each. | (a) The candidate is deleted, the migration reruns, and the result equals I2.1. (b) The old database is deleted and the Workspace opens Ready without migrating again. |
| I2.4 Concurrent migration | Two applications on one v1 factory call `initialize` at once. | One migration runs; both end Opened on the same schema-2 database. |
| I2.5 Open a position | Confirm the reference Plan; record PC1 with Complete reflection; restart; `getTradeDetail`, `browseTrades` Open and Planned. | Response Trade, derivation, and Entry equal the post-restart Detail (AC-RESP-001). Store dump: Trade document with Position Change and Execution fact identities each holding one version, Open in the lifecycle index, one Entry and one obligation record. The Trade is absent from Planned. |
| I2.6 Scale-in, Entry Quality, Entry Size | Continue with PC2 (Complete), PC3 (Decline with reason); restart. | Entry Quality resolved at PC2 with the T2.2 figures, unchanged after PC3; one Entry Size occurrence of 20 fingerprinted to PC3; Fulfillment FilledWithDeviation; one decline record; three obligation records. |
| I2.7 Rejections write nothing | Execution before the Plan time; future time; quantity 0; Sell; blank required answers; the same valid command twice. | Typed rejections (all issues together for the first five in one command); `Conflict` for the repeat; store dumps unchanged except for the first accepted submission. |
| I2.8 Integrity disagreement (AC-LIFE-003) | Integrity fixture writer: (a) after I2.5, set stored lifecycle to Planned and move the index entry; (b) after I2.6, delete the recorded occurrence; (c) set an Execution's Planned Leg to an unknown identity. Read, then record another Position Change. | Reads: Ready with the findings; content revision unchanged. (a) and (b) mutations commit and list the repairs (P7). (c) returns `IntegrityDisagreement` and the dump is unchanged. |
| I2.9 Earlier-dated entry (P5) | PC1 60 at 10:00, PC2 60 at 11:00, then PC-early 40 at 10:30. | Entry Resolution Point moves to PC-early; Entry Quality recomputed over PC1 and PC-early; PC2's occurrence gains a new version with 60; the receipt discloses both changes. |
| I2.10 Write gate | Host fails the inventory check; call `recordPositionChange` through the facade and `Persistence.commit` directly. | `RuntimeNotWritable` at both; dumps unchanged; Open list and Detail still readable. |
| I2.11 Rebuild equivalence | After I2.6 plus two more Open Trades: capture Open list and Details; run `rebuildPrivateState`; capture again. | Normalized views equal; `journalObligations` and `byLifecycleActivity` rebuilt with identical contents (AC-REBUILD-001). |
| I2.12 Fresh initialization at schema 2 | Empty factory; `initialize(zone)`. | Schema 2 created directly; Journal seed manifest v2 with both reflection types; no migration in the receipt. |

### 6.2 Browser suite (`e2e/d2/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B2.3, B2.5, B2.7, and B2.8 in all three engines.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B2.1 Open a position | Confirm the reference Plan; Record entry with two rows (30 @ 50.00 fee 0.50, 30 @ 50.20 fee 0.50) and a completed reflection; relaunch. | Detail shows Open, Position 60, two Lots, one Position Change with two Executions, "60 of 100"; probe shows one Position Change, two Executions, one Entry. |
| B2.2 Scale-in and decline | Continue to 100 and then 120 shares, declining the last reflection. | Entry Quality shows; Entry Size 20 shows with its causing Position Change; narrative shows "Reflection declined". |
| B2.3 Update from D1 with data | Harness serves `d1`; onboard and confirm two Plans; switch to `d2`; Reload from the update notice. | "Updating your journal" shows, then the Plans are listed under Planned and Record entry works; About shows schema 2; probe shows a new pointer target and no old database. |
| B2.4 Migration Blocked (*faults build*) | As B2.3, but the update lands on the D2 faults build with `?faults=migration:validate`; then `__tjFaults.set([])` and Retry. | Migration Blocked with "Your data is unchanged" and Retry; probe shows the old stores unchanged and no candidate; after Retry the Plans appear. |
| B2.5 Old tab during migration | `d1` in two tabs, tab A with an unsaved Plan form; update; tab B reloads and migrates. | Tab A shows "Updated in another tab" with its values on screen; pressing Confirm returns `RuntimeNotWritable`; probe shows no write to the old database after the snapshot. (Requires the D1 amendment.) |
| B2.6 Kill during migration (*faults build*) | With `migration:hold`, SIGKILL the browser while the migrator waits; relaunch without faults. | Migration completes on relaunch; data equals the pre-update data; no candidate database remains. |
| B2.7 Kill after commit | SIGKILL right after a Position Change result renders; relaunch. | Position Change, Executions, lifecycle Open, and reflection are all present. |
| B2.8 Offline cold restart | After B2.1, close, relaunch offline, record PC2. | Writable offline; entry succeeds and survives another offline restart (AC-DEL-001). |
| B2.9 Recovery Only (*faults build*) | Existing Open Trade; relaunch with `?faults=control`. | Open list and Detail readable; no Record entry; probe unchanged. |
| B2.10 Mid-session failure (*faults build*) | Fill an entry form; `__tjFaults.set(["inventory"])`; Save. | `RuntimeNotWritable` explained; values kept; no new Position Change (AC-DEL-006). |
| B2.11 Nothing saved without Save | Fill rows and reflection, resize, navigate away, restart. | No Position Change, Entry, decline, or draft in IndexedDB; no entered values in Web Storage (AC-JOUR-001). |
| B2.12 Responsive and accessible | Fill three Execution rows at 1280 px; resize to 390 px and back; axe on the entry form, Open list (all states), Open Detail, and migration views; complete an entry with the keyboard only. | Rows and reflection answers survive; layout switches at 960 px; no WCAG 2.1 AA violations; keyboard flow completes (AC-UI-001, AC-UI-002). |
| B2.13 Integrity surfaced | Integrity fixture writer sets an Open Trade's stored lifecycle to Planned before launch. | Detail shows the integrity panel; the list badge shows; probe shows no write after viewing. |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1 and D2 breakdowns, and the list of future capabilities that must not be treated as defects (everything after D2: Marks, valuation and current risk, exits and closing, Defer and Journal Debt, Daily Review, options, backup). It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C2.8 and `npm run preview:faults` for C2.9 and C2.10. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C2.1 First entry | On a confirmed 100-share Plan (entry 50, Stop 47.50, Target 56), Record entry 60 @ 50.10, fee 1.00; complete the reflection. | Detail shows Open, Position 60, one Lot, "60 of 100", Entry not yet resolved; the Trade moved from Planned to Open. |
| C2.2 Complete the entry | Record 40 @ 50.30, fee 1.00; decline to reflect with a reason. | Entry Quality: average 50.18, risk $270.00 (1.08R), reward $580.00, ratio about 2.15 against planned 2.4, slippage $18.00; narrative shows the decline. |
| C2.3 Oversize | Record 20 @ 51.00, fee 1.00. | An Entry Size Deviation of 20 shares names this Position Change; Entry Quality is unchanged; Fulfillment reads Filled with Deviation. |
| C2.4 Several fills, one decision | Record one Position Change with two rows on a new Plan. | One Position Change, two Executions, two Lots, one reflection. |
| C2.5 Validation | Try a time before the Plan time, a future time, quantity 0, and a blank Decision mode in one submission. | All issues shown together with focus on the summary; nothing saved after reload. |
| C2.6 Earlier-dated entry (P5) | On a Trade with fills at 10:00 and 11:00, record one at 10:30. | The receipt says Entry Quality and the resolution point changed; Detail lists Position Changes in Economic Time order. |
| C2.7 Lists | Inspect Open and Planned tabs; leave an entry form unsaved and reload. | Open is the default, ordered by Last Activity; nothing from the abandoned form was saved. |
| C2.8 Update with migration | Harness serves `d1`; create two Plans; switch to `d2`; reload from the notice. | Migration message, then the Plans are present and entries can be recorded; About shows schema 2. |
| C2.9 Migration Blocked | As C2.8 onto the faults build with `?faults=migration:validate`; clear the fault; Retry. | Blocked message says data is unchanged; Retry succeeds and the Plans are present. |
| C2.10 Recovery Only | Faults build: create an Open Trade; relaunch with `?faults=inventory`. | Open list and Detail readable; no Record entry. |
| C2.11 Offline, responsive, keyboard, About | Stop the server and reload; record an entry; resize with a half-filled entry form; complete an entry by keyboard; open About. | Offline entry works; values survive resizing; visible focus; About lists only D1 and D2 capabilities. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-POS-001 (partial: opening and scale-in) | D2 | T2.1, T2.4, T2.6, T2.14 | T2.1 Lots group; T2.6 accepted group | I2.5, I2.6; B2.1 (reference Trade) | C2.1, C2.2, C2.4 | `npm run test:integration -- d2/open-position` | Each Execution owned by one Trade; Position and Lots exact; each opening fee held once by its Lot | Restart I2.5; kill after commit B2.7 | planned |
| AC-POS-005 (partial: Partially Filled, Filled With Deviation from Entry Size, fingerprints) | D2 | T2.2, T2.3, T2.4 | T2.2 Fulfillment; T2.3 excess | I2.6 | C2.3 | `npm run test:integration -- d2/scale-in` | Fulfillment states per step; occurrence fingerprint (Trade, leg, PC3) stored with one version | Restart | planned |
| AC-LIFE-001 (partial: Planned → Open → Open) | D2 | T2.1, T2.4, T2.6 | T2.1 lifecycle; T2.4 apply | I2.5, I2.6 | C2.1 | as AC-POS-001 | Stored and expected agree at each revision; index move in the same commit | Restart | planned |
| AC-CALC-001 (partial: frozen 1R and Entry Quality not rewritten by later adds) | D2 | T2.2, T2.6, T2.14 | T2.2 Entry Quality group | I2.6 with a 200-share Plan (1R $500) as well as the reference Trade | C2.2, C2.3 | `npm run test:integration -- d2/entry-quality` | 1R unchanged; Entry Quality resolved once at the resolution point and unchanged after PC3 | Restart | planned (management in D17; current risk in D4) |
| AC-LIFE-003 (partial: normal reads, mutation preparation) | D2 | T2.3, T2.6, T2.7, T2.14 | T2.3 agreement group; T2.6 integrity group; T2.7 integrity group | I2.8 (integrity fixtures a–c); B2.13 | — | `npm run test:integration -- d2/integrity` | Reads surface findings; mutation repairs and discloses (a, b) or rejects (c) per P7 | Content revision unchanged after reads; dump unchanged for (c) | planned (Restore branch in D8) |
| AC-REST-004 (partial: intact, never Ready, retry activates; per P6) | D2 | T2.8, T2.10, T2.15, T2.16 | T2.10 failure group | I2.2, I2.3; B2.4, B2.6 | C2.9 | `npm run test:integration -- d2/migration`; `npx playwright test e2e/d2/migration.spec.ts` | Old stores unchanged; no candidate; Retry gives Opened with receipt | Restart after interruption; SIGKILL during migration | planned ("exportable" in D8) |
| AC-JOUR-001 (partial: entry form) | D2 | T2.12 | "make no call when cancelled or left" | B2.11 | C2.7 | `npx playwright test e2e/d2/no-save.spec.ts` | No Position Change, Entry, decline, or draft | Restart | planned |
| AC-JOUR-007 (partial: Position Change Reflection and its Source) | D2 | T2.5, T2.10 | T2.5 seed group | I2.1, I2.12 | — | `npm run test:integration -- d2/seed` | Definition manifest equals the contract text | Second launch adds nothing | planned |
| AC-JOUR-005 (partial: Complete and Decline retries) | D2 | T2.5, T2.6 | obligation-index group; "submitted twice" | I2.7 | — | `npm run test:integration -- d2/rejections` | One outcome per obligation key | Repeat returns Conflict with no write | planned |
| AC-RESP-001 (cumulative) | D2 | T2.6, T2.10, T2.12 | "render … without a read call" | I2.5 | C2.1 | `npm run test:integration -- d2/responses` | `recordPositionChange` and migrating `initialize` responses equal durable state | — | planned |
| AC-CAP-001 (cumulative) | D2 | T2.11, T2.13 | `verify:capabilities`; tabs case | — | C2.11 | `npm run verify:capabilities` | Manifest equals reachable operations | — | planned |
| AC-DEL-001 (cumulative) | D2 | T2.12 | — | B2.8 | C2.11 | `npx playwright test e2e/d2/offline.spec.ts` | Entry recorded offline after full stop | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004, AC-DEL-006 (cumulative) | D2 | T2.6, T2.10 | T2.6 "RuntimeNotWritable"; T2.10 not-Writable case | I2.10; B2.9, B2.10 | C2.10 | `npx playwright test e2e/d2/runtime-failure.spec.ts` | `recordPositionChange` rejected at UI and persistence; readiness reruns after update activation before migration | Dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D2 | T2.17 | `verify:releases` | B2.3 | C2.8 | as B2.3 | Tab launch Writable after a schema-changing update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D2 | T2.12–T2.15 | view-state groups | B2.12 | C2.11 | `npx playwright test e2e/d2/responsive-a11y.spec.ts` | State kept across resize; axe clean; keyboard entry | — | planned |
| AC-REBUILD-001 (cumulative) | D2 | T2.4, T2.5, T2.8 | obligation rebuild case | I2.11 | — | `npm run test:integration -- d2/rebuild` | Equal normalized views; rebuilt indexes identical | — | planned |
| AC-PERF-001 (cumulative; starts here) | D2 | T2.20, T2.21 | structural | Benchmark dataset (section 1.3); query-count test | — | `npm run bench:run` | Cold p95 ≤ 2,500 ms, warm p95 ≤ 1,500 ms, raw timings and provenance recorded; one `getAll` per Open page | Open list equals expected rows before and after the runs | planned (full profile reached as later deliverables extend the generator) |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-POS-001 | two opening Executions at different prices and fees | T2.1, I2.5, I2.6 | covered |
| | each fill belongs to one Trade | A18, T2.4 | covered; cross-Trade arrives with D20/D21 |
| | Position and open Lots correct | T2.1 | covered |
| | FIFO Lot Matches; disposal fees; partial realization leaves Open; flat closes; no price or P&L on a Lot Match | — | D6 |
| | opening fees allocated exactly once | T2.1 fee case, A22 | covered for opening |
| | evidence: histories | A21 single-version chains | version history UI arrives in D15 |
| AC-POS-005 | Partially Filled | T2.2 | covered |
| | Filled With Deviation | T2.2, T2.3 | covered, from Entry Size. The scenario's own cause (a mismatched exact contract) is D10. Entry Size excess is required by the Trade Analysis rules, not by this scenario's Given. |
| | Unplanned Exposure; Not Entered; Not Verifiable; one Planned-Leg Terms occurrence per leg | — | D10, D6, D10 |
| | evidence: occurrence fingerprints | T2.3, T2.4 | covered |
| AC-LIFE-001 | Planned → Open → Open (scaling) | T2.1, I2.5, I2.6 | covered |
| | index changes in the same commit; expected agrees | T2.4, T2.6 | covered |
| | Closed; Terminal Disposition separate from Close Reason | — | D6 |
| AC-CALC-001 | 1R remains $500 | I2.6 (200-share Plan) | covered |
| | Entry Quality resolves once at the resolution point against frozen intended entry, not rewritten by later adds | T2.2, I2.6 | covered; P5 changes it only when an earlier-dated fact changes the window itself, disclosed in the receipt |
| | not rewritten by later management | — | D17 |
| | current risk uses remaining Position and effective management | — | **Finding:** this clause needs `evaluate`, which arrives in D4 (originally D3, merged into D4 by decision 24). The plan index lists AC-CALC-001 as partial under D4. |
| AC-LIFE-003 | stored lifecycle or Lot Match/Deviation agreement differs in a controlled fixture | I2.8, B2.13 | lifecycle and Deviation covered; Lot Matches arrive in D6, which must add its own fixture case |
| | normal reads surface or block, no read repairs | T2.7, I2.8 | covered |
| | mutation preparation derives a disclosed repair or rejects incoherent facts | T2.6, I2.8 | covered under P7 |
| | Restore preparation | — | D8 |
| AC-REST-004 | partial migrated state never Ready | T2.10, I2.2, B2.4 | covered |
| | prior data uncorrupted | I2.2, B2.4 | covered |
| | readable by the compatible recovery path, or exportable | — | not readable in D2 (P6, decision 22); exportable in D8 |
| | successful retry activates atomically with migration/seed receipt | T2.10, I2.2 | covered |
| AC-JOUR-001 | entry form leaves nothing without Save | T2.12, B2.11 | covered for this form |
| AC-JOUR-005 | one outcome per key under retry | T2.5, I2.7 | Complete and Decline covered; Defer in D5; Void reopening in D13. **Finding:** added to the plan index's D2 acceptance as partial. |
| AC-JOUR-007 | Position Change Reflection definition exact | T2.5 | covered. **Finding:** D2 adds a seeded definition and a new form, so AC-JOUR-007 and AC-JOUR-001 were added to the plan index's D2 acceptance as partial. |

**Handoff open items for D2, and where they are resolved:**

- *AC-LIFE-003 mutation branch owner:* D2, decision P7, T2.6, I2.8.
- *Benchmark generator and latency harness:* section 1.3, T2.20, T2.21.
- *Capacity basis recomputed for the new schema:* T2.18.
- *First migration with the isolated candidate, pointer flip, and Web Locks:* A30, T2.8, T2.10, I2.1–I2.4, B2.3–B2.6.
- *Section validators reusable by D8:* T2.9.
- *Migration fault and previous-release harness:* T2.16, T2.17.
- *Schema-v2 fixture, and migration tested from the v1 fixture:* T2.19, I2.1.

---

## 10. Evidence recording

As in D1, under `evidence/D02/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (raw timings, percentile method, dataset provenance, environment), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
