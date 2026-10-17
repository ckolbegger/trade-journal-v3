# Trade Journal V3 — ordered vertical deliverables

Status: aligned with the user, 2026-10-10. This is the ordered set of vertical
deliverables for the `deepseek-v41-flash` implementation. Detailed task breakdowns
(with `describe` / `it should` unit tests, integration cases, and critic flows) are
written separately, per deliverable, on request.

Frozen inputs: `specs/` (read-only baseline) and the decisions recorded in
[planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md).

## How to read this

- A **vertical deliverable** is a dependency-closed set of capabilities a person can
  see and operate through the production UI, traversing real application/domain
  behavior and persistence/infrastructure. It is runnable and testable end to end.
- Deliverables are ordered. Each one's scope is deliberately small: 1–4 user stories.
- `Covers:` names the module operations, mechanisms, and seed-manifest additions the
  deliverable introduces.
- `AC:` names the headline acceptance scenarios it must satisfy. It is not the full
  acceptance-to-evidence matrix (that is a later planning step).

## Obligations that apply to every deliverable

From `specs/evaluation/planning-protocol.md`:

1. Every deliverable is reachable and usable through the production UI and complete
   through its required application/domain behavior and persistence/infrastructure.
   Layer-only deliverables are forbidden without a separately recorded exception.
2. Every non-structural task is implemented with red→green TDD and recorded evidence
   per planned `it should ...` case.
3. Every deliverable defines mock-free integration tests through the real stack, with
   any test infrastructure replacement disclosed.
4. Every deliverable ends with a fresh browser-critic gate, and every defect it finds
   is first reproduced by an automated test.
5. Both narrow and wide viewport behavior, and accessibility, are part of the
   deliverable rather than deferred.
6. Durable schema changes carry their own migration/compatibility treatment.
7. The Installed Capability Manifest advertises only complete capabilities. Partial
   areas are *absent*, never present-but-broken.

---

## D1 — Install, trust, and set up

*The foundation, deliberately minimal: only what the next deliverable requires.*

1. As a trader, I would like to open the journal in my browser and use it with no
   network, so that I can write whenever I sit down.
2. As a trader, I would like the app to refuse to record anything and tell me exactly
   why when it cannot store data safely, so that I never build a journal somewhere
   that will lose it.
3. As a trader, I would like to set up my brokerage institution and the account I
   trade, so that my plans and trades belong to a real account.

`Covers:` Web App Manifest; versioned service worker with a complete, digest-valid
Offline Release Inventory; four-check browser-neutral Runtime Readiness; advisory
storage-protection warning and `Workspace.requestDurability`; persistence-level
`RuntimeNotWritable` write gate; IndexedDB schema, migration runner, atomic
transaction seam, optimistic revisions, lifecycle index; `Workspace.initialize`,
`getStatus`; `ReferenceCatalog.seedDefaults` (manifest v1: Long Stock),
`save`/`query` for Institution and Account; Installed Capability Manifest.
Seed manifest v1: Long Stock, Plan Reflection Entry Type, Plan Confirmation Source.

`AC:` AC-DEL-001…006, AC-CAP-001, AC-UI-001, AC-UI-002, AC-REF-002 (partial).

Declared scope: installation is **not advertised**; the app is installable only at
the browser's discretion. AC-DEL-003 is partially covered (manifest identity,
inventory binding, browser-tab `Writable`) and completes at D22.

## D2 — Confirm my first plan (long stock)

1. As a trader, I would like to write why I am taking this trade and what would
   invalidate it, so that I cannot enter without a reason.
2. As a trader, I would like to record my intended entry, stop, and target, so that I
   know my risk before I put money on.
3. As a trader, I would like my plan frozen at confirmation against one risk figure,
   so that later me cannot rewrite what I committed to.

`Covers:` `TradeWorkflows.confirmPlan`; `TradeAnalysis.assessPlan` (Long Stock shape,
Plan Baseline, positive 1R); `TradeRecord.prepareChange`/`applyPreparedChange`
(Confirm Plan); `Journal.getDefinitions`, `prepareEffects`/`applyPreparedEffects` for
the Plan Reflection. Strategy selector offers Long Stock only.

`AC:` AC-PLAN-001, AC-PLAN-002, AC-LIFE-001 (Planned), AC-RESP-001, AC-JOUR-007 (partial).

## D3 — Record my entry (long stock)

1. As a trader, I would like to record the fills that open my position, so that my
   position and cost basis are exact.
2. As a trader, I would like to see my open lots, allocated fees, and realized P&L, so
   that I know where I actually stand.
3. As a trader, I would like to reflect on this decision now or defer it, so that
   recording facts is never blocked by having to write.

`Covers:` `TradeWorkflows.recordPositionChange` (stock open variant);
`TradeAnalysis.derive` (positions, FIFO Lot Matches, fees allocated exactly once,
realized P&L); stored lifecycle `Planned`→`Open` with its index; Position Change
Reflection Entry with `Defer` creating Journal Debt. Seed growth: Position Change
Reflection Entry Type, Position Change Source.

`AC:` AC-POS-001, AC-LIFE-001 (Open), AC-JOUR-003.

## D4 — Do my daily review

*The signature ritual, and the spine the rest of the product hangs from.*

1. As a trader, I would like to open today's review and see the trades I must think
   about in priority order with reasons, so that I work through them deliberately.
2. As a trader, I would like to enter the day's missing closing prices as the first
   thing I do, so that every position I look at is valued honestly.
3. As a trader, I would like to see, for the position I am examining, what I am
   risking to my stop and my total risk against incremental reward, so that I can
   judge it on current facts.
4. As a trader, I would like to hold with one tap and one explicit save, with stop
   breaches recorded once per episode and completion only when everything real is
   resolved, so that I can trust the review is done.

`Covers:` `DailyReview.open`/`getTrade`/`save`; `MarketData.save` Manual Mark intents
and `query` `ResolveFrames`; Expected Mark Date/Status; `TradeAnalysis.derive`/
`evaluate`/`replay` for Stop-Discipline episodes; attention bands returning reasons
rather than scores; Hold preselected as unsaved view state with an explicit Save;
Intent required for Exit/Roll/Adjust and never executing a trade; atomic
Stop-Discipline reconciliation; completion states including
`CompleteWithUnavailableMarks`; `recover` honestly returning `NotConfigured` while no
provider is installed. Seed growth: Daily Trade Review Entry Type, Daily Review Source.

`AC:` AC-REV-001…006, AC-MARK-001, AC-CALC-002 (partial).

Cross-cutting: this deliverable introduces **Stop Discipline only**; the other three
Deviation categories arrive at D12/D13.

## D5 — Complete what my review owes

1. As a trader, I would like to write a journal entry about the position I am looking
   at, right there in the review, so that my thinking is captured at the moment it
   happens.
2. As a trader, I would like to answer or explicitly decline the reflections I owe, so
   that nothing quietly disappears.
3. As a trader, I would like the review to tell me plainly what is still outstanding,
   so that I know what "done" means today.

`Covers:` `DailyReview.getDebt`/`save` (`ResolveReviewDebt`); `Journal.save` from the
review; Debt answer and explicit decline; one-outcome-per-obligation-key; Journal
query for outcomes and Debt. Seed growth: Review Note and Trader Reflection Entry
Types as needed by in-review writing.

`AC:` AC-JOUR-001, AC-JOUR-003, AC-JOUR-005, AC-REV-002, AC-REV-006.

## D6 — End a long stock trade

1. As a trader, I would like to close my position and give a reason, so that my
   decisions are explained rather than just numbered.
2. As a trader, I would like to see how the trade actually ended separately from my
   reason, so that settlement and my judgment are never confused.
3. As a trader, I would like to reflect on the close or defer it, so that closing never
   waits on writing.
4. As a trader, I would like to abandon a plan that never filled, so that dead plans do
   not pollute my record.

`Covers:` `recordPositionChange` closing variant; exactly one Close Reason when trader
agency is present; derived Terminal Disposition; Close Review with its distinct
obligation key; `abandonPlan`; `Planned`→`Closed`/`Abandoned`. Seed growth: 5 Close
Reasons, 5 Abandonment Reasons, Close Review Entry Type, Trade Close Source.

`AC:` AC-POS-004, AC-LIFE-001 (Closed), AC-LIFE-002, AC-REF-001 (reason seeds).

## D7 — Back up my journal

*Deferred until plan, trade entry, mark entry, and journal entry all exist.*

1. As a trader, I would like to download my whole journal as one file, so that I hold
   a copy I control.
2. As a trader, I would like the app to be honest that a downloaded file is not yet a
   verified backup, so that I do not believe I am protected when I am not.

`Covers:` `Workspace.exportBackup`; `exportSnapshot` for all four authoritative
sections from one coherent read snapshot; Workspace Backup Manifest (versions,
capability footprint, counts, exclusions, section digests, full digest); secrets
exclusion; `Downloaded` result producing no receipt; available in `Recovery Only`.

`AC:` AC-BACK-001 (export, `Downloaded`, secrets exclusion).

Note: the artifact format must be designed for all four sections now, even where a
section is thin, because it is a durable format.

## D8 — Trade a long option, with prices fetched for me

1. As a trader, I would like to plan, open, and close a long call or long put, so that
   I can trade options and not just stock.
2. As a trader, I would like the app to fetch closing prices for my option instead of
   typing them, so that valuation keeps working when manual entry stops being
   practical.
3. As a trader, I would like to configure the price provider with credentials that
   never enter my backup, so that convenience does not cost me privacy.
4. As a trader, I would like to be told plainly when no price can be fetched, so that I
   fall back to manual entry rather than a wrong number.

`Covers:` Long Call and Long Put seeds and shapes; `recordPositionChange` single-leg
option variant, open and close; `PricingProvider.fetchClosingObservations` adapter;
`MarketData.recover`, `getProviderConfiguration`, `configureProvider`; write-only
redacted credentials; Manual precedence preserved; transient diagnostics creating no
facts.

`AC:` AC-MARK-002, AC-MARK-005, AC-REF-001 (partial).

**Provider decision point.** This is where the Pricing Provider scope is decided —
Manual-only with the `NotConfigured` path, or a real adapter. The deliverable is shaped
so either choice fits without reshaping earlier work.

## D9 — Sell options: cash-secured put and covered call

1. As a trader, I would like to sell a cash-secured put, so that I can collect premium
   at a level I am willing to own.
2. As a trader, I would like to sell a covered call against stock I already hold, so
   that I can collect premium on a position I own.
3. As a trader, I would like short positions valued and risk-assessed on the same
   honest terms as long ones, so that a different risk shape does not get a different
   standard.

`Covers:` Cash-Secured Put and Covered Call seeds and shapes (share coverage through
the multiplier); short-option positions; unbounded-risk presentation via `Unbounded`
results rather than a fabricated number.

`AC:` AC-CALC-002, AC-CALC-004 (partial), AC-REF-001 (partial).

Terminology: the canonical name is **Cash-Secured Put**. The product does not claim to
prove cash coverage.

## D10 — Settle an option position

1. As a trader, I would like to record expiration, assignment, exercise, or cash
   settlement explicitly, so that the calendar never decides my outcome.
2. As a trader, I would like to choose where delivered stock goes, so that basis and
   proceeds are right and nothing is guessed.
3. As a trader, I would like settlement-created stock to automatically owe me
   management, so that I cannot end up with an unmanaged position.

`Covers:` settlement variants of `recordPositionChange`; explicit destination
allocation with bounded `NeedsResolution` when unallocated; Settlement Price kept
separate from adjusted basis/proceeds; Exercise Intent as advance authorization only;
workflow-routed Management Debt; option premium applied exactly once.

`AC:` AC-SET-001, AC-SET-002, AC-SET-003, AC-SET-004.

## D11 — Vertical, time, and calendar spreads

1. As a trader, I would like to plan and record a vertical spread, so that defined-risk
   structures are first-class rather than two separate trades.
2. As a trader, I would like to plan and record a spread across two expirations, so
   that time and calendar structures work too.
3. As a trader, I would like to see the combined total risk and incremental reward
   across all legs, so that I judge the structure rather than each leg.
4. As a trader, I would like a combined valuation that stays honest when one leg has no
   price, so that aggregation never invents a number.

`Covers:` four Vertical seeds plus PMCC; multi-leg `recordPositionChange` with one
shared decision identity and per-Execution Trade ownership; aggregation of per-leg
facts into structure-level risk/reward; covered subtotals and retained
unavailable/unbounded cohorts. Seed growth: Vertical Call/Put Debit/Credit, PMCC.

`AC:` AC-POS-002, AC-CALC-003, AC-CALC-004, AC-RPT-003 (partial).

Cross-cutting: this and D13 also introduce the **Planned-Leg Terms, Entry Size, and
Unplanned Exposure** Deviation categories, completing the four-type taxonomy.

## D12 — Complex spreads: butterflies, condors, iron condors, broken wings

1. As a trader, I would like to start a butterfly or a condor from a ready template, so
   that I can build a four-leg structure without hand-ordering every leg myself.
2. As a trader, I would like to build a broken-wing butterfly with unequal wings, so
   that an asymmetric structure is expressible and the app never forces symmetric
   wings on me.
3. As a trader, I would like the canonical Iron Condor available with the correct leg
   order, so that I do not rebuild it by hand.
4. As a trader, I would like total risk and reward for four-leg structures, including
   which outcomes are bounded, so that I understand the payoff shape.

`Covers:` shape templates for Butterfly, Broken-Wing Butterfly, and Condor, each
producing a trader-owned typed Strategy via `ReferenceCatalog.save` rather than a seed
(there is no generic `Custom` seed); Iron Condor seed with ascending role order;
four-leg aggregation and payoff extrema with attainment sets.

`AC:` AC-REF-001 (**the canonical eleven seeds complete here** — Iron Condor is the
last of the eleven), AC-CALC-004, AC-POS-005.

Scope note: "AC-REF-001 completes here" refers to the *seeded* set. The supported
structure space is deliberately wider than the eleven seeds. Butterfly,
Broken-Wing Butterfly, and Condor are first-class in use but arrive as templates that
create the trader's own typed Strategy, so the seeded count stays exactly eleven and
AC-REF-001 is not reinterpreted. Asymmetric wings need no special mechanism: the shape
vocabulary embeds no wing-width defaults (`reference-catalog.md:80`), and Iron Condor
already establishes that wing widths may differ. See decision PD5 in
[planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md).

## D13 — Roll a position into a new plan

1. As a trader, I would like to roll part of a position into a successor plan, so that
   I can extend a thesis without pretending it is a new trade.
2. As a trader, I would like the untouched remainder to stay put with clean lineage, so
   that my history stays truthful.

`Covers:` Roll variant of `recordPositionChange`; successor Plan confirmed in the same
transaction; typed predecessor/successor lineage; `Rolled` close reason; partial roll
leaving untouched holdings in place; one originating-Trade reflection.

`AC:` AC-POS-003, AC-POS-004.

## D14 — Manage a position: move my stop or target

1. As a trader, I would like to move my stop or target with a reason, so that managing
   the trade is recorded rather than remembered.
2. As a trader, I would like to see my current risk and reward update from the revised
   management, so that I can judge whether the trade still pays.

`Covers:` `TradeWorkflows.reviseManagement`; `TradeAnalysis.evaluate` against effective
management; frozen Plan Baseline untouched; a revision is not a Deviation. Seed growth:
Management Revision Entry Type, Management Revision Source. Navigation from the review.

`AC:` AC-CALC-001, AC-CALC-003.

## D15 — Fix a mistake and see the audit

1. As a trader, I would like to correct a price, quantity, or time I got wrong, saying
   which leg of a multi-leg structure I am correcting, so that my economics are right at
   the date they happened and I fix only the one I got wrong.
2. As a trader, I would like to correct or override a price I recorded, so that the
   record shows what I decided and why.
3. As a trader, I would like to void a fact that never happened while still seeing it,
   so that my record is honest rather than tidy.
4. As a trader, I would like to see the full history of every change with its reason,
   so that the audit is visible without a technical log.

`Covers:` `previewCorrection`/`commitCorrection` (Replace and Void) targeting the
specific fact or leg named, within multi-leg structures; Market Data save intents for
deliberate override and correct-with-reason plus correction metadata;
`TradeAnalysis.assessChange`; Correction Footprint spanning every affected Trade even
when one leg is named; material-impact acknowledgment threshold; all-or-nothing linked
corrections; `TradeRecord.history`; View history; anchor survival across correction.

`AC:` AC-CORR-001, AC-CORR-002, AC-CORR-004, AC-CORR-005.

## D16 — Rebuild a trade

1. As a trader, I would like to reconstruct a trade whose facts were entered badly
   enough to need rebuilding, so that I get a coherent record without losing the
   trade's identity or my old notes.

`Covers:` Rebuild variant of `commitCorrection`; Trade identity preserved while
reconstructed facts receive new identities; superseded facts remain addressable;
historical Execution Anchors resolve as historical and are never silently redirected;
one atomic commit including Journal consequences.

`AC:` AC-CORR-003, AC-CORR-004, AC-REBUILD-001 (partial).

## D17 — Keep a journal beyond the review

1. As a trader, I would like to write a standalone note or reflection, so that I can
   capture thinking that is not about one trade.
2. As a trader, I would like to edit, add to, or void what I wrote and see the history,
   so that my journal stays honest as my understanding changes.
3. As a trader, I would like to see my journal as a timeline, so that I can read what I
   have written over time.
4. As a trader, I would like to change my own prompt wording over time, so that my
   journal evolves without rewriting what I already wrote.

`Covers:` `Journal.save` create/Edit/Addendum/Void; `Journal.query` timeline and full
history; `reviseDefinition` and `getDefinitions` with prospective effect and no silent
form substitution; Standalone, Trade, and Execution anchors; optional IdeaSource Tag
Type if a Tag Select prompt is configured.

`AC:` AC-JOUR-001, AC-JOUR-002, AC-JOUR-004, AC-JOUR-006, AC-JOUR-007 (**completes**
the seven Entry Types and seven Sources).

## D18 — Browse, inspect, and replay my trades

1. As a trader, I would like to browse and filter my trades, so that I can find what I
   am looking for.
2. As a trader, I would like one complete view of a trade, so that I do not have to
   assemble it myself.
3. As a trader, I would like to replay a trade's corrected history with real candles,
   points, and visible gaps, so that I can see how it actually unfolded.
4. As a trader, I would like to preview what changing a price would affect before I
   commit, so that I never make a change I do not understand.

`Covers:` `browseTrades`, `getTradeDetail`, `replayTrade`, `previewMarkChange`;
`TradeRecord.queryRecords`; Market Data `ReadSeries`/`InspectObservations`; Daily Bar
use rules; explicit gaps that never interpolate; read-view result states and
contributor navigation; rebuildable projections and rebuild equivalence.

`AC:` AC-MARK-004, AC-MARK-006, AC-UI-002, AC-REBUILD-001.

## D19 — Reports: see how I am actually doing

1. As a trader, I would like to see how my closed trades performed over a named period,
   so that I can judge results without a spreadsheet.
2. As a trader, I would like to see my current open exposure with honest coverage, so
   that I know what is actually on the table.
3. As a trader, I would like a descriptive process scorecard with real denominators, so
   that I can see my process without being graded by a machine.
4. As a trader, I would like one journal field reported as a categorical distribution,
   so that I can see my own patterns.

`Covers:` `outcomes`, `exposure`, `scorecard`, `journalField`; `runReport`; Report
Period presets; filters and one-dimensional breakdown; coverage, contributors,
exclusions, non-additivity; correction sensitivity; no composite grade.

`AC:` AC-RPT-001…006.

## D20 — Verify my backup

1. As a trader, I would like to point the app at the file I downloaded and have it
   verified, so that I know my backup is real.
2. As a trader, I would like the app to refuse to call a backup complete until it is
   verified, so that I am never falsely reassured.

`Covers:` `Workspace.confirmBackup`; `CompletedBackupReceipt` bound to the source
Workspace binding and full artifact digest; `Not Verified` reasons; nothing pending is
stored; available in `Recovery Only`.

`AC:` AC-BACK-001 (receipt), AC-REST-002 (safety choice).

## D21 — Restore my journal

1. As a trader, I would like to restore from a backup onto another device or browser,
   so that I can move or recover my journal deliberately.
2. As a trader, I would like to see exactly what will be replaced and repaired before
   committing, so that I cannot destroy my current journal by accident.
3. As a trader, I would like a failed restore to leave my current journal untouched, so
   that recovery is never a gamble.

`Covers:` `prepareRestore`/`applyPreparedRestore` for Workspace and all four
authoritative sections; untrusted-artifact validation; isolated candidate migration;
per-module graph validation with Trade Analysis rederivation; disclosed repairs for
coherent-but-stale agreement; safety-backup choice requiring an exact-target receipt or
an explicit decline; atomic all-section replacement with rollback; integrity recovery
for an unreadable root; readiness re-established before further mutation.

`AC:` AC-REST-001…004, AC-BACK-001 (read-back), AC-REBUILD-001 (post-Restore), AC-LIFE-003
(authorized-preparation half).

## D22 — Install and update the app

1. As a trader, I would like to install the journal on my phone and laptop from the
   browser, so that I can open it like an app.
2. As a trader, I would like to be told when a new version is ready without it
   interrupting what I am typing, so that an update never costs me a missed entry.
3. As a trader, I would like the update to apply only when I choose, so that a
   half-finished form is never lost.
4. As a trader, I would like my journal to migrate on activation, or keep working on
   the old version if it cannot, so that upgrading never risks my data.

`Covers:` install affordance where the host exposes it plus platform-appropriate
guidance and standalone behavior; update detection with the new inventory complete and
digest-valid before any notice; activation only on the trader's safe reload with no
self-initiated `skipWaiting()`; migration-on-update with no partial readiness; an
offline device retaining its last compatible release.

`AC:` AC-DEL-002, AC-DEL-003 (**completes**), AC-REST-004.

---

## Cross-cutting threads

### Seed manifest growth

The seed manifest is versioned and grows only when a deliverable's stories require it.
Un-seeded values are absent, never present-but-broken.

| Deliverable | Adds |
| --- | --- |
| D1 | Long Stock; Plan Reflection Entry Type; Plan Confirmation Source |
| D2 | Plan Reflection definition detail as required |
| D3 | Position Change Reflection Entry Type; Position Change Source |
| D4 | Daily Trade Review Entry Type; Daily Review Source |
| D5 | Review Note and Trader Reflection Entry Types |
| D6 | 5 Close Reasons; 5 Abandonment Reasons; Close Review Entry Type; Trade Close Source |
| D8 | Long Call; Long Put |
| D9 | Cash-Secured Put; Covered Call |
| D11 | Vertical Call/Put Debit/Credit; PMCC |
| D12 | Iron Condor seed — **the canonical eleven complete here**. Butterfly, Broken-Wing Butterfly, and Condor arrive as shape templates producing trader-owned typed shapes, not seeds |
| D14 | Management Revision Entry Type; Management Revision Source |
| D17 | Any remaining Sources/definitions — **AC-JOUR-007 completes** |

### Migration

Cross-cutting, never a deliverable of its own. The schema and migration runner land in
D1. Every later deliverable that changes a durable representation carries its own
migration and compatibility treatment as a task. D21 owns the update and Restore
migration paths.

### Prices

The former "observe prices honestly" scope is distributed: manual Mark entry, Expected
Mark Status, and acknowledgment in D4/D5; Mark override and correct-with-reason in D15;
Daily Bars, series, and gaps in D18; provider recovery and configuration in D8.

### Deviations

Stop Discipline arrives in D4 because Daily Review reconciles it atomically with the
Action. Planned-Leg Terms, Entry Size, and Unplanned Exposure arrive in D11/D12, where
multi-leg conformance becomes meaningful.

### Stop and target conditions

The two condition kinds are **underlying-price** and **structure-value** Stops and Targets. Both are
independent OR alternatives, every condition stays visible, the headline distance uses the nearest
nonnegative monetary boundary and becomes zero when any Stop is crossed, and crossing never changes
Position or Lifecycle State (`glossary.md:159`, `trade-analysis.md:77-81`). The model in full, including
the type, is recorded as decision **PD9** in
[planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md).

The condition set is **plural from D2**, because `trade-analysis.md:57` requires the frozen Plan Baseline
to use *the same* independent-OR, nearest-nonnegative-monetary-boundary policy as current headlines. A
singular baseline policy would diverge from D4's and put `AC-CALC-001`'s "1R remains $500" guarantee at
risk. `StructureValueCondition` is reserved in the type from D2 and **not installed** until D8, so it is
absent rather than a fabricated `Unavailable`.

Each deliverable picks up the following, and a later breakdown must not re-derive or reshape the model:

| Deliverable | Must carry |
|---|---|
| D2 | The `kind` discriminator in the durable frozen Plan record; an ordered condition set; baseline per-condition basis and nearest-boundary headline computed over the set; a confirmation form that can add conditions and record each condition's optional view-only comment |
| D4 | `evaluate` per-condition status and Overrun over the OR set with the nearest-boundary headline, rendering each condition's comment as prose beside its value; `replay` Stop-Discipline episode fingerprints keyed per condition, so a multi-Stop Plan can hold concurrent episodes |
| D8 | The `StructureValueCondition` variant; option instruments entering `derive`'s exact observation requirements; the monetary boundary entered and frozen, because options cannot derive it |
| D9 | `Unbounded` headline risk alongside structure-value conditions |
| D11/D12 | Several same-kind conditions in both directions; structure-value conditions over the whole co-expiring structure; a percentage-of-maximum target resolving to a frozen boundary at confirmation |
| D14 | `reviseManagement` adding, replacing and retiring conditions in the effective set, including their comments prospectively |
| D15 | `assessChange` recomputing per-condition basis over the set |
| D18/D19 | Per-condition status surfaced in views and reports |

### Fees

Every Execution records its actual fee as a required fact, and **no fee enters any calculation**
(decision **PD10** in [planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md)). Lot-aware
allocation, the consumed/unconsumed opening-fee split, fee-adjusted P&L, Entry Quality's allocated-fee
component, and settlement cost adjustments to basis and proceeds are all not installed. The fee field
must stay and must default to an explicit zero, so that "no fee" is an affirmative fact rather than an
absent field, and so that fee application stays installable later with no historical coverage loss
(`overview.md:264`, `delivery-contract.md:79`).

Each deliverable picks up the following:

| Deliverable | Must carry |
|---|---|
| D1 | The Money value layer without a fee-apportionment helper; exact decimals remain required for every other amount |
| D3 | Fee capture and exclusion rather than allocation: the fee is recorded, defaults to explicit zero, and provably never enters any derived value |
| D4 | `evaluate` without the incurred-fee component |
| D10–D12 | Settlement applies premium and costs exactly once for the facts themselves, but no fee-adjusted basis or proceeds |
| D15 | Corrections do not recompute fee allocations |
| D19 | Outcomes and scorecard report no fee-inclusive figures |

AC-POS-001, AC-CALC-001 and AC-RPT-002 carry Partial claims with their fee clauses explicitly
unclaimed, and no deliverable may claim AC-POS-001 complete. A recorded zero fee yields genuinely net
figures and needs no caveat; a single conditional disclosure at the fee field and in the Installed
Capability Manifest covers a recorded non-zero fee that is not applied.

### Parallelism

Shared resources force serialization and need a single owner at a time: the IndexedDB
schema and Persistence/Transaction seam; the seed manifest; the Installed Capability
Manifest; the UI shell and navigation; and `TradeAnalysis.derive`, which D3, D4, D11,
and D12 all extend.

Best available parallelism is *within* a deliverable — domain/persistence work and UI
work are independent once that deliverable's interface is fixed. Across deliverables,
only pairs that avoid the schema, seed manifest, and navigation can run concurrently;
D8–D13, which all grow the strategy set and the position-aggregation logic, are the
worst candidates for parallel work.

## Coverage

All 67 operations across the ten public interfaces are placed above, together with the
single-operation Pricing Provider port and the internal, non-UI-callable
Persistence/Transaction seam (`exportSnapshot`, `prepareRestore`, and
`applyPreparedRestore` for each fact module group into D7 and D21 because they
participate in Workspace-owned flows).

## Recorded future intent (not scheduled)

- **Different-strike option combos.** A long call plus short put — or the mirror — with the put and
  call at *different* strikes. This is a risk reversal / combo, not a true synthetic, and it is
  expressible with the existing **strike-order** constraint, so no vocabulary change is needed.
  Planned as shape templates producing trader-owned typed shapes, so the seeded eleven are unaffected
  and AC-REF-001 is untouched.
  A **true equal-strike synthetic is not supported** as a validated shape: the frozen vocabulary grants
  strike *order* but not *equality*, so the shape could not enforce the property that defines a
  synthetic. See decision PD6 in
  [planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md).
  Adding this will renumber the deliverables after its insertion point; the current 22-deliverable
  sequence stands until then.

---

## Open items

- Detailed task breakdowns per deliverable, with `describe` / `it should` unit tests, are written
  separately on request. **All seven of D1–D7 are drafted, awaiting review:** D1 in
  [deliverable-breakdowns/D1-install-trust-and-set-up.md](deliverable-breakdowns/D1-install-trust-and-set-up.md)
  (34 tasks), D2 in
  [deliverable-breakdowns/D2-confirm-first-plan.md](deliverable-breakdowns/D2-confirm-first-plan.md)
  (20 tasks), D3 in
  [deliverable-breakdowns/D3-record-entry.md](deliverable-breakdowns/D3-record-entry.md) (23 tasks),
  D4 in
  [deliverable-breakdowns/D4-daily-review.md](deliverable-breakdowns/D4-daily-review.md) (26 tasks),
  D5 in
  [deliverable-breakdowns/D5-complete-review-debt.md](deliverable-breakdowns/D5-complete-review-debt.md)
  (18 tasks), D6 in
  [deliverable-breakdowns/D6-end-long-stock-trade.md](deliverable-breakdowns/D6-end-long-stock-trade.md)
  (20 tasks), and D7 in
  [deliverable-breakdowns/D7-back-up-journal.md](deliverable-breakdowns/D7-back-up-journal.md)
  (14 tasks) — 155 tasks in total. Their declared task graphs are validated by
  `scripts/check-deliverable-breakdown.mjs`, which checks blocking edges, cycles, diagram
  agreement by transitive reduction, and structural-task verifications, and their cross-document
  claims by `scripts/audit-breakdown-coverage.mjs`; both report zero failures and zero warnings
  over the seven files. Each carries open questions of its own in an "Open items and risks"
  section, and D1–D7 record scenarios owned by later deliverables as Partial rather than counting
  them as passing.
- The acceptance-to-evidence matrix (planning-protocol Phase 4) is not yet drafted.
- The nine verification items recorded under D3 in
  [planning-decisions-2026-10-10.md](planning-decisions-2026-10-10.md) must be resolved
  inside the plan before it is frozen. D1 owns items 3, 4, 6 and 9; D2 owns item 5; item 8 is
  owned and re-verified by each of D1–D7; items 1 and 7 are explicitly deferred to the Restore
  and backup-verification deliverables respectively; and item 2 is deferred because no scheduled
  deliverable owns mature-scale measurement. Each breakdown's mapping table records which rows are
  owned and which are deferrals.
