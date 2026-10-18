# D4 — Daily Review and voluntary Journal: detailed task breakdown

Status: planning draft, not implementation authorization or completed evidence. Provisional under the [trader-approved per-deliverable planning approach, 2026-10-17](../delivery-plan.md#accepted-planning-approach--2026-10-17); review before this deliverable is implemented.
Authority: [D4 in the delivery plan](../delivery-plan.md#4-conduct-the-manual-daily-review-and-add-voluntary-journal-entries), [Daily Review](../../specs/design/daily-review.md), [Journal](../../specs/design/journal.md), and [D1 shared policy](d01-long-stock-plan.md). Requires completed D3. All proposed test seams/cases await plan review before execution.

## Outcome, stories and installed boundaries

- As a trader, I would like to review my positions in a consistent daily sequence, so that I can address missing evidence and overdue reflection before decisions.
- As a trader, I would like to save Hold, Exit, Roll, or Adjust intent for each eligible trade, so that I can record my decision without automatically executing it.
- As a trader, I would like to save voluntary trade notes and standalone reflections, so that I can capture observations beyond the required daily decision.

Production navigation: Daily Review → LatestCompleted or ExactCompleted session → shared Missing Mark tasks → globally due Debt → stable attention-ranked Trade walk → Save Action → returned progress/next step. Voluntary Review Note/Trader Reflection creation is reachable in Review, Trade Detail and a simple Journal composer/timeline. Standalone, Trade or Execution Anchor is exactly one committed scope. Sources reflect the actual path: Daily Review, Trade Detail or Journal. A context may preselect its Anchor; manual choice must be validated, never infer multiple attachments.

Every installed Action is a saved intent. Hold needs explicit Save despite preselection; Exit/Roll/Adjust need Intent but do not invoke trading workflows. Do not offer uninstalled exit/roll/management execution navigation (D5/D27/D16 respectively). No settlement task is applicable to this Stock-only scope; D7/D15 introduce option settlement. No general Journal Edit/Addendum/Void (D19), custom forms (D23), Replay UI (D14), stored Review Session/finish flag, inferred Hold, or task creation from voluntary follow-up prose. A revision of the same dated Action through DailyReview.save is required within this installed workflow and is distinct from the later general Journal Edit capability. Voluntary prose cannot settle Debt or replace an Action. Backup waits until D6; Restore until D17.

## State, revisions and atomic effects

Add exact Daily Trade Review, Review Note and Trader Reflection definitions; Sources Daily Review, Trade Detail and Journal. Daily definition has Action options Hold/Exit/Roll/Adjust and RequireWhenOption Intent for the three change intents, exact optional Conviction/considered-against/Note fields; do not add Emotion. Definitions/Prompt/Option identities are stable and trigger/render snapshots immutable.

Version D4 adds unique `(Entry Type, Trade, Review Date)` Action obligation association, authored vs moment time, voluntary Entry kinds/context, and immutable Stop occurrence reconciliation history/fingerprints. Action moment = Review cutoff; authored time = actual Save. Preserve complete causal fact/Mark references, condition activation and first-observed gap disclosure. Cutoff membership and due queries use bounded indexed projections, rederived under exact Trade revisions. The private exposure-lifetime index begins at the first real opening fact and ends at a terminal disposal instant (open interval until D5 adds closure); filter candidate lifetimes at the exact cutoff and verify those candidates from one complete AnalysisInput batch. Current lifecycle membership cannot substitute for this index. D5 updates it with terminal facts; D18 later invalidates/rebuilds corrected affected intervals. Rebuilding never changes authoritative lifecycle or economic facts. No saved completion/order or progress entity.

Review reads batch all eligible corrected Trade records and global due Debt, then shared Market requirements and labels. Attention bands: factual/management blocker → boundary reached → evidence limited → quantified pressure → routine. Within bands compare monetary risk-to-stop else worst-case and reward-to-target else maximum; positive/unbounded risk with nonpositive reward is Highest; finite risk with unbounded reward Zero; missing operands Not Comparable. Tie-break pressure descending, Last Activity descending, stable Trade ID. Order remains stable within the view; new open may reorder. Pure ranking is internal to the coordinator, not a new public module.

SaveTradeAction binds Review Date/cutoff/session-policy revision, overview view binding, exact Trade FactRevision, normalized Market evidence snapshot including material absences, definition/obligation/Entry revision, catalog references, active generation/readiness/Workspace binding. Re-read/rederive/replay and recheck before transaction. Participants: narrow Trade deviation reconciliation (cannot change economics or lifecycle), Journal Action version/outcome/history, relevant private invalidation and Workspace revision. Return saved Action, reconciled occurrence projections, derived progress/completion and bounded next step under the committed binding. No unconditional open/getTrade read follows success. An explicit later refresh is a separate read.

ResolveReviewDebt uses original due snapshot and routes Journal-only answer/decline to one atomic Journal outcome/settlement. Workflow-routed Debt returns NeedsTradeWorkflow, writes nothing and identifies required route; Management capture remains future. Direct voluntary Journal.save validates one Anchor, rendered definition, automatic Source/context and expected revision, then writes immutable Entry/Workspace revision only; no workflow effects. Definition changes in a future release must not silently swap an active form.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D4-T01 | D3-T07 |
| D4-T02 | D4-T01 |
| D4-T03 | D4-T02 |
| D4-T04 | D4-T02, D4-T03 |
| D4-T05 | D4-T01, D2-T05, D3-T05 |
| D4-T06 | D4-T02, D4-T03, D4-T04, D4-T05 |
| D4-T07 | D4-T01, D4-T02, D4-T03, D4-T04, D4-T05, D4-T06 |

## Ordered tasks and concrete TDD cases

Each behavior case uses D1's recorded one-case Red → minimal Green → next-case procedure, followed by separate green refactor review. Structural tasks have reproducible checks; all remain inside this vertical release.

### D4-T01 — Fix Review/Journal contracts and migrate defaults (structural)

Blocked by D3-T07. Single schema/seed owner specifies all four Review request/results, direct CreateEntry variants, exact obligation/Anchor/source/time semantics, cutoff indexes and reconciliation participants. Stage D3→D4 candidate with only installed defaults; preserve existing Entries/Debt and stable keys.

Verification: eventual strict typecheck/build; normalized exact-form comparison against Journal contract; D3 populated fixture migration and failure/retry in I04. No Action or session is manufactured by seeding. Extend current release inventory and capability declarations only after joined gate passes.

### D4-T02 — Derive the exact-date overview, stable walk and Debt routes

Blocked by D4-T01. Owner: Daily Review; seams `open/getTrade/getDebt`, using real installed query/recovery paths.

`describe("fact-derived Stock Daily Review")`

- it should select Trades Open at exact completed cutoff rather than assume current Open membership; in D4 ordinary commands provide the present-state fixture and D5 extends it with later closure.
- it should return task families Missing shared Mark → due global Debt → eligible Trade walk, with one Mark task per Instrument/date and no Stock settlement task.
- it should include Outstanding Debt from any Trade, even if not eligible at cutoff, with due time at/before cutoff; workflow-bound Debt sorts before Journal-only, then due time and stable identity.
- it should order a Stop-breached Trade ahead of a routine Trade even when breached risk headline is zero; apply disclosed pressure and deterministic Last Activity/identity tie-breaks within bands.
- it should return Ready, not domain Unavailable, with manual tasks and NotConfigured diagnostic when no provider exists; opening creates no Action, Debt, Deviation or Session.
- it should distinguish Empty (no eligible Trades and no other required tasks) from Ready for a completed nonempty Review, and return ReviewChanged on a stale overview instead of a hybrid getTrade result.
- it should preselect Hold only in unsaved getTrade form state and return the exact definition/cutoff/revisions needed to save.

### D4-T03 — Save Action and reconcile continuous Stop episodes atomically

Blocked by D4-T02. Owners: Daily Review/Transaction and shared Trade Analysis, with narrow Trade Record apply variant. Seam `save(SaveTradeAction)`.

`describe("bound Daily Action and Stop reconciliation")`

- it should create one Hold Entry from one visible Save, with Trade Anchor, Source Daily Review, `(Trade, date)` origin, cutoff moment and actual authored time; no Intent required.
- it should reject Exit/Roll/Adjust without nonblank Intent, then save each with Intent without any Execution, management, lineage or lifecycle change.
- it should save Hold with one newly observed Stop episode in the same transaction, and return saved outcome/progress/next step sufficient to continue without another Review read.
- it should retain a continuous episode across two breached exact dates and a gap, then allow a distinct episode after an exact unbreached date; do not emit daily duplicate Debt or an explanation Entry Type.
- it should create/retain/supersede/Void the exact complete expected occurrence set under unchanged facts/evidence, preserving reconciliation audit and causal keys; incoherent missing retained evidence blocks reconciliation rather than deleting a fact.
- it should revise the same dated Entry identity under expected Action revision on an intentional retry/change, and conflict on stale duplicate create rather than create a second Action.
- it should reject changed Mark, acknowledgment, material absence, Trade, definition or existing Action binding with ReviewChanged/Conflict and no Action/deviation write; D7 adds Bar race, D18 correction race.
- it should roll back Action and occurrence histories/bindings together on induced participant failure, or return RuntimeNotWritable when the current gate fails.

### D4-T04 — Resolve due Debt and derive honest completion

Blocked by D4-T02/D4-T03 and existing D2 Debt semantics. Owner: Daily Review; seams `save(ResolveReviewDebt)/open/getDebt`.

`describe("Review completion from current obligations")`

- it should answer due Journal-only Debt from its trigger-time form and settle it atomically, or record allowed decline, returning progress and next step.
- it should return NeedsTradeWorkflow and exact route without write for management-coverage Debt; a prose Entry cannot satisfy it.
- it should stay Incomplete for Missing current Mark, missing saved Action, due Debt, pending deterministic reconciliation or integrity disagreement, naming each blocker.
- it should derive Complete when all eligible Actions/Debt/reconciliation are resolved with exact Marks, and CompleteWithUnavailableMarks with affected Instrument/Trade/calculation identities when explicit acknowledgment resolves one missing price.
- it should reopen/resume solely from facts after restart, retaining saved actions without a Session/Finish flag and displaying historical gaps separately as nonblocking current evidence limits.
- it should recompute progress after new due Debt/evidence changes; later Action Void/correction and settlement reversibility are explicitly future D19/D18/D15 fixtures.

### D4-T05 — Create voluntary writing and read the deduplicated narrative

Blocked by D4-T01, D2 anchor resolution and D3 coherent reads. Owner: Journal and read coordinator; seams direct `Journal.save(CreateEntry)/query` and Trade Detail narrative.

`describe("voluntary saved Journal evidence")`

- it should create Review Note with required observation and optional follow-up, or Trader Reflection with required thought and optional Emotion/Energy 1–5, under the exact displayed definition.
- it should save exactly one Standalone/Trade/Execution Anchor with actual path Source, moment/first-authored time and stable Entry identity, and reject Unknown or wrong-owner contextual Anchor.
- it should show a Trade-anchored and Execution-anchored note once each in the owning Trade narrative, preserve exact prompts/options and expose history even though editing is uninstalled.
- it should reject missing required text, invalid options/scale, stale definition/catalog/Anchor binding or runtime failure without partial Entry/history writes.
- it should leave Action absence, due Debt and economic Trade facts unchanged when a voluntary Entry is saved, and create no task from follow-up text.
- it should leave every Journal/Trade revision unchanged when a form is opened, typed into, resized or cancelled without Save.

### D4-T06 — Deliver the Review walk, composer and timeline UI

Blocked by D4-T01 for interface-fixed work; joined acceptance blocked by T02–T05. Owner: UI/shell.

`describe("Review and voluntary Journal production UI")`

- it should display ordered tasks/reasons and one visible Save for unchanged Hold; navigation/selection alone stores nothing.
- it should preserve safe user input on conflict and live resize, explain evidence to review again, then render saved Action and next step from the response.
- it should expose all four saveable Action intents, label them as intent, and omit execution links for uninstalled workflows.
- it should allow voluntary creation from Review, Trade Detail and Journal with correct Anchor/Source; optional unanswered and explicit decline/Debt remain visibly distinct.
- it should support keyboard completion, semantic radio groups, error focus, readable zoom/reflow and distinguish Loading, Ready, Empty, Error and unavailable evidence states.

### D4-T07 — Cumulative proof and fresh browser release gate (structural)

Blocked by D4-T01–D4-T06. Run cumulative D1–D4 unit/integration suites; then fresh critic starts production runtime itself on strict DEV_PORT=5174, runs B01–B05 and returns structured actions/results/evidence with no edits. A defect first gets a reproducing failing unit/integration/browser case; minimal fix, cumulative rerun and another fresh critic repeat every D4 flow. Ambiguity pauses for human clarification; no browser/critic/runtime means blocked execution, never self-certification.

## Mock-free real-stack cases

All fixtures are created through real Workspace/Catalog/TradeWorkflows/MarketData/Journal commands. fake-indexeddb is the only disclosed fast storage replacement; it cannot prove host readiness. No application module, observation frame, ranking response or persistence effect is mocked. Explicit clock is input. Native browser IndexedDB/service worker/cache tests cover actual safety.

| Case | Procedure / durable and failure proof |
|---|---|
| D4-I01 | Create two eligible Trades sharing Stock/date and one due Debt; open exact Review, resolve shared Manual Mark once, answer Debt, save all four Actions across isolated runs. Restart and compare returned Entry IDs, times, one-per-key outcomes and derived progress; economic facts unchanged by Actions. |
| D4-I02 | Save breached-Stop Hold, induce abort after occurrence staging, restart and compare normalized Trade/Journal states. Success commits both; two simultaneous saves on same Action key yield one accepted outcome and conflict, not duplicate occurrences. |
| D4-I03 | Open snapshot with Missing/acknowledgment; save a relevant Mark/acknowledgment in another tab; stale Action fails with unchanged Action/deviation histories. Independent refresh gets new view. Exercise Complete, Incomplete and CompleteWithUnavailableMarks without a completion flag. |
| D4-I04 | Migrate populated D3 success/failure/crash/retry with nonoverwriting defaults; delete only private cutoff/Review/Journal indexes, rebuild, compare exact eligibility/order/progress/narrative under explicit clock. Reopen stopped browser offline. |
| D4-I05 | Save both voluntary types through each Source path and each permitted Anchor in isolated cases. Restart; narrative deduplicates by Entry ID. Unsave/cancel/invalid Anchor and attempted prose resolution leave authoritative revisions unchanged. |

## Planned browser flows

- **D4-B01:** Latest and selected completed session → Missing Mark → due Debt → stable ranked Trade walk → unchanged Hold Save → returned next step. Stop browser and resume offline from facts; no Finish button.
- **D4-B02:** Save Exit/Roll/Adjust with Intent after demonstrating missing-Intent validation; inspect unchanged Trade facts and retained intent. Leave preselected Hold unsaved and show incomplete Review.
- **D4-B03:** Exact breached Mark → Action+one Stop episode; subsequent breached date retains episode; exact recovery then new breach produces second. Race Mark/Action in another tab; show preserved input and no stale save. Verify independent Complete/Missing/acknowledged completion states.
- **D4-B04:** Create voluntary Trade Review Note from Detail, Standalone Trader Reflection from Journal, and Execution-anchored writing in composer; inspect narrative and sources. Follow-up creates no task; writing does not clear due Debt/required Action. Cancel a filled composer and confirm no evidence after restart.
- **D4-B05:** B01/B04 keyboard-only at 390/1440 px, 200% zoom, live 767/768 resize retaining state. axe/manual contrast/name/role/focus checks. Force Loading/Empty/Error/Conflict, integrity/readiness failures; no false Empty or writable recovery controls.

## Acceptance mapping

All statuses **planned**. D1 evidence commands, environment identity, normalized no-write comparison and inherited delivery/reconstruction obligations apply.

| Scenario | Honest scope / later completion | Tasks; evidence/flows |
|---|---|---|
| AC-JOUR-001 | Full: explicit Save only, all installed Journal/Review forms | T05/T06; I01/I05; B01/B02/B04 |
| AC-JOUR-003 | Full: Debt distinct, due Review block and factual capture unblocked | T02/T04; I01; B01/B04 |
| AC-REV-003 | Full: one-click Hold and required intent for other saved Actions | T03/T06; I01; B01/B02 |
| AC-REV-004 | Full for installed Stock evidence: Action and complete episode reconciliation atomic | T03; I02; B03 |
| AC-REV-001 | Partial: exact cutoff membership; D5 later-closed fixture, full corrected-history D18 | T02; I01/I04; B01 |
| AC-REV-002 | Partial: Mark/Debt/walk/resume; provider D7, settlement ordering full D15 | T02/T04; I01/I04; B01 |
| AC-REV-005 | Partial: current Mark/acknowledgment/absence/Action/fact conflicts; Bar D7, correction full D18 | T03; I02/I03; B03 |
| AC-REV-006 | Partial: three completion states and current blockers; settlement D15, corrections D18, Action Void/full D19 | T04; I03/I04; B01/B03 |
| AC-JOUR-006 | Partial guard only: NeedsTradeWorkflow/no prose resolution, not a manufactured management feature; full workflow D16 | T04/T05; I05; B04; isolated supplied contract fixture disclosed |
| AC-JOUR-005 | Partial: unique dated Action/obligation outcomes; sole settlement Void/reopen full D19 | T03/T04; I02; B03 |
| AC-JOUR-007 | Partial: exact newly needed forms/Sources; fixed set D15, customization/reseed full D23 | T01/T05; I04/I05; B04 |
| AC-RESP-001 | Partial globally; installed saves return progress/Entry projections. Multi-Trade full D15 | T03–T06; I01/I05; B01–B04 traces |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full installed release under accepted backup/Restore timing | T01/T06/T07; I01–I05; B01–B05, D1 repeated shared matrix |
| AC-DEL-005–006, AC-REST-004 | Partial recovery/migration/readiness now; D6 export, full Restore D17 | T03–T05/T07; I02/I04; B05 |
| AC-UI-002 | Partial globally, complete installed rituals/forms; replay D14, destructive Restore/full D17 | T06/T07; B05 |
| AC-REBUILD-001, AC-PERF-001 | Partial installed cutoff/episode/Journal representation and target-sized Stock Review data; mixed full D28 | T01/T02/T07; I04 and D1 benchmark/equivalence procedure |

Other scenarios stay intentionally unadvertised per D1's complete disposition ledger. The guarded Management Debt no-write case is not a declaration of management capture.

## Ownership and safe parallelism

T01 fixes all contracts first. T02 Review reads and T05 voluntary Journal may proceed independently; T03 waits for T02 and exclusive shared replay/reconciliation ownership, T04 follows T03. UI T06 starts against fixed types but cannot pass until real integration. T07 joins all. Schema/generation/index and seed owners serialize changes; Daily Review.save/Journal effects/transactions have one integration owner; shared analysis/episode fingerprints and shell/manifests each one owner. No blanket concurrency between deliverables.
