# Incremental delivery plan

Status: roadmap under per-deliverable review; not an approved implementation baseline.

Phase 1 specification comprehension and Phase 2 technology selection are complete.
The approved stack is React, strict TypeScript, Vite, Dexie/IndexedDB, decimal.js,
Temporal with explicit clocks/session calendars, and static Cloudflare Pages HTTPS
delivery, as recorded in [technology-stack.md](technology-stack.md). This plan is
for the existing `codex-gpt-6.1-sol` branch and worktree.

This document agrees delivery boundaries and user stories first. Task breakdowns,
dependency/version pinning, evidence procedures, and the detailed acceptance matrix
come after this review under the [planning protocol](../specs/evaluation/planning-protocol.md).
It contains no implementation authorization, scaffolding, or task-level test plan.
The [specification](../specs/README.md) remains the product authority.

## Accepted planning approach — 2026-10-17

The trader approved per-deliverable planning and approval in place of the requirement
to detail all 28 deliverables before implementation. This explicitly supersedes the
whole-product planning prerequisite in the planning protocol's Phases 3–6 and the
previous D1–D6 completion boundary. Frozen product semantics, public module contracts,
and acceptance requirements remain authoritative; `specs/` is unchanged.

D1 is the next implementation candidate. Review its scope, interfaces, durable-data
compatibility and acceptance evidence, then record explicit approval and its exact
baseline revision in a D1-only kickoff. Approval of this planning approach does not
itself authorize application implementation or deployment.

D2–D6 breakdowns are provisional working plans; D7–D28 remain the capability roadmap.
Review and detail each deliverable near implementation, using evidence from completed
work. Check current durable facts against known future correction, replay, multi-leg,
backup and Restore requirements without prebuilding future operations. Material
changes to an approved current baseline require review; provisional future task
choices may evolve without reopening settled product semantics.

Retain per-case TDD, structural verification, cumulative real-stack integration,
applicable browser/offline/accessibility/performance evidence and the fresh independent
browser-critic gate for every deliverable. After D1, reassess the design and prepare D2.

## Decisions recorded

| Decision | State |
|---|---|
| Approved React/Vite/IndexedDB stack, with decimal.js instead of Fraction.js | Accepted by the trader; recorded in the committed stack selection |
| Long Stock only for the initial Plan, opening, risk/reward, and Daily Review slices | Accepted: “I agree with your Long Stock only recommendation” |
| Manual Marks for initial stock risk/reward and Daily Review; automated retrieval with the first single-leg options in D7 | Accepted ordering: provider retrieval arrives at the same boundary as single-leg options |
| Close positions and abandon plans before ordinary Stop/Target/thesis revision | Accepted ordering: closing D5, abandonment D9, ordinary management revision D16 |
| Single-leg options before any correction, Void, or Abandonment | Accepted ordering: ordinary single-leg trading D7 precedes abandonment D9 and correction D18; physical settlement follows separately in D15 |
| Separate plan confirmation (D1) from opening execution (D2) | Accepted: “Yes, that boundary is fine” |
| Separate ordinary single-leg trading/automated Marks (D7) from physical settlement (D15), without restricting D7 to cash-settled instruments | Accepted with the trader's condition: no substantial cash-settlement eligibility enforcement; bring D15 forward if an actual assignment/exercise requires it |
| Ordinary multi-leg trading, including PMCC, before revisions/corrections and before Process Scorecard/Journal Field Analysis | Accepted trader priority: D8 precedes management D16, correction D18, Scorecard D24 and Journal Field D25; deferred physical capture follows in D15 |
| Leg selection in later revision/correction workflows | Accepted requirement: D16 identifies condition/leg/structure context; D18 selects the exact leg and economic fact with whole-Trade impact |
| Current Exposure and Outcomes before Journal form customization | Accepted: Current Exposure D21 and Outcomes D22 use existing forms/facts; customization follows in D23 |
| Backup after full stock closure; Restore later | Accepted trader change: full stock closure D5 precedes backup/verification D6, after Plan, Execution, Journal and Mark capture in D1–D4; Restore remains D17 before corrections D18 |
| Scaling and legging as separate trader deliverables | Accepted: scaling in D10, scaling out D11, legging in D12 and legging out D13; earlier entry/exit slices cover complete decisions, and all four precede correction D18 |
| Replay and Abandon before Assignment/Exercise | Accepted: Abandon D9 and Replay D14 precede physical settlement D15 |
| Voluntary Journal entries with initial Daily Review | Accepted: D4 adds Review Note and Trader Reflection creation; Edit/Addendum/Void remain in D19 |
| Remaining boundaries and ordering below | Proposed |

No layer-only exceptions are requested or approved.

### Accepted temporary delivery exception: backup/Restore timing

The trader explicitly moved backup after actual Plan, Execution, Journal and Mark
population, and separately deferred Restore until core trading functionality is
usable. D5 delivers full stock closure; D6 delivers export/verification after D1–D5,
including Close Review history. D4 already includes workflow and voluntary Journal creation. D17 delivers Restore after management and before
corrections. Before D6, readable Recovery Only offers reads/safe retry but no export;
from D6, export and verification are available there. Restore preparation/application
and UI remain uninstalled until D17. Existing facts remain durable, audited,
migratable and privately reconstructable; preserve prior compatible/readable data
on migration failure throughout. A pre-D17 verified file is a complete saved copy,
not a claim that the currently installed application can already restore it.

These explicitly accepted timing changes temporarily override the [planning protocol](../specs/evaluation/planning-protocol.md#phase-4--map-acceptance-scenarios-to-evidence)
instruction that “Foundational atomicity, audit, backup/Restore, offline, and
reconstruction scenarios cannot be omitted merely because a later UI/report
capability is deferred,” and the [delivery contract](../specs/design/delivery-contract.md#pwa-identity-installation-and-runtime-readiness)
requirement that readable Recovery Only keeps backup export available. It changes
incremental delivery timing, not the final backup/Restore semantics. The affected
acceptance subsets are declared below; no first-save full recovery claim is made.
The trader's explicit instruction authorizes this exception; no layer-only slice
or final-product omission is approved. Frozen specifications are not edited.

## Rules applying inside every deliverable

Each numbered item is an independently usable production-UI capability, complete
through its required domain behavior and persistence. Prerequisites identify
capabilities it consumes; delivery order is the numbered order. Domain and UI work
can proceed in parallel only after that item's request/result interface and shared
durable changes are fixed. Interface design and necessary enabling work belong to
that item, not to a separate foundation release.

Every item carries these obligations when it touches them:

- Only complete installed operation variants appear in navigation, selectors, and
  the Installed Capability Manifest. An uninstalled calculation is absent. An
  installed calculation can honestly return Value, Unbounded, Unavailable, or Not
  Applicable according to its inputs. Saved Review intents are capabilities in
  their own right; they do not claim to execute an exit, adjustment, or Roll.
- Financial inputs and durable values use decimal strings. Domain arithmetic,
  proportional fees, sign classification, and aggregates use decimal.js under the
  reviewed precision/conservation policy, never display-rounded native numbers.
  Economic Time and stable Recorded Sequence govern economics; save time is audit.
- A semantic command rechecks its bindings and atomically commits all participating
  facts, lifecycle/lot/deviation agreement, Journal effects, and indexes. Its
  revision-bound response contains directly changed state sufficient to continue
  the workflow. React neither duplicates calculations nor coordinates fact writes.
- Introduced facts retain identities, provenance, revisions, and required audit
  history immediately. There is no later conversion of an overwrite into history.
  Ordinary reads never repair authoritative agreement or replay every Trade's full
  history. Bounded indexed reads and rebuildable projections arrive with their use.
- Every durable change includes lossless candidate migration, private reconstruction
  and compatibility with previously supported data. Failure preserves the prior
  readable compatible data. From D6, each change extends complete backup/export
  verification; from D17 it also extends full Restore validation/atomic replacement.
  Retain complete facts and supported artifact provenance without prebuilding
  deferred import/application machinery before D17. Migration
  is an obligation of the changing slice, never a deliverable.
- The current release supports its installed manual paths after stopped-browser
  offline restart. Updates stage a complete digest-verified inventory, wait for a
  safe trader-controlled reload, and re-establish readiness. Every new authoritative
  mutator inherits the persistence-level `RuntimeNotWritable` gate.
- Each touched screen preserves state across wide-sidebar/narrow-bottom-navigation
  transitions and supplies accessible names, focus, keyboard operation, result
  states, and textual equivalents for charts. Applicable correctness, conflicts,
  recovery behavior, and performance are obligations now, not later hardening.
- Definitions and seeds are stable-keyed and idempotent. Only defaults needed by an
  installed workflow are added. Existing customization is never reset. Historical
  labels/forms remain snapshots; later additions do not invent prior evidence.

### Reading the acceptance labels

All labels below are **planned obligations**, not assertions of completed evidence.
**Full** means the complete canonical scenario is assigned at that point.
**Partial** identifies an earlier useful subset of a broader scenario; it never
permits an incomplete advertised capability. Every partial assignment has a
Declared scope line naming the later completion point. Full assignments continue
to apply as later slices add relevant fact types or UI surfaces.

The inherited scenarios are repeated obligations, rather than separate releases:

| Scenario | Assignment and declared scope |
|---|---|
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full from D1 for each installed release; repeat with every added capability. Deferred backup/Restore paths follow the explicit exception above |
| AC-DEL-005–006 | Partial D1–D16: read-only recovery, unreadable-store block, rejected writes and launch/update readiness apply immediately. D6 adds Recovery Only export/verification; D17 adds gated Restore and post-Restore readiness. Full D17 |
| AC-RESP-001 | Partial D1–D14: every installed mutation returns a usable receipt. D15 supplies bounded multi-Trade settlement; full D15, extended for Restore D17, correction D18 and Roll D27 |
| AC-BACK-001 | Not installed D1–D5. Partial D6–D22: complete coherent export/read-back of every installed fact from D6. D7 adds provider/credential exclusion; D17 adds restored setup, D18–D19 correction/Journal histories, and D23 customized definitions; full D23, extended with later facts |
| AC-REST-001–003 | Not installed D1–D16 by explicit trader instruction. Full D17: nonmutating preparation, whole-Workspace replacement, exact-target safety receipt or deliberate decline, all-section atomicity, invalidated old views and returned landing state |
| AC-REST-004 | Partial D2–D16: validated migration candidates preserve prior compatible/readable data; D6 adds recovery export/verification. D17 completes artifact/Restore migration and recovery paths; full D17, extended for every durable change |
| AC-UI-002 | Partial D1–D16: all installed screens meet accessibility obligations. D14 completes actual Bar/candle/gap replay; D17 adds destructive-Restore views for full D17, extended with later screens |
| AC-REBUILD-001, AC-PERF-001 | Partial D1–D27: equivalent reconstruction/latency for installed facts, with bounded startup/open-list paths from first use. D28 completes mature mixed-fact fixtures across reports/reviews/provider evidence; no later correctness/performance hardening release |

Thus, for every item below, “inherited obligations” includes its own compatible
representation transition, complete offline inventory, readiness, receipt,
backup/verification from D6, Restore from D17, reconstruction, accessibility and
relevant scale behavior. The
later full fixture is not permission to lose data or miss latency targets earlier.

## Bug stories for installed capabilities

### BUG-001 — Restore mockup fidelity and make saved versus draft state clear

Added 2026-10-24 following trader testing of D2. **Status: implemented and verified
locally, 2026-10-25; approved live-tab update applied.** Independent visual and
functional acceptance and final scale qualification passed; see the
[BUG-001 evidence](evidence/bug-001/README.md). The installed D1/D2 experience was
repaired before D3; the numbered capability roadmap remains unchanged.

**Story:** As a trader, I want the installed app to closely match the mockups and
clearly distinguish unsaved input from recorded Executions, so that I can recognize
the intended workflows and know whether my Trade is Planned or Open.

**Observed bug:** The installed app diverges from the references in navigation,
density, typography, Trade rows, detail hierarchy and contextual forms. An execution
draft retains entered values and offers “Remove Execution” even after a failed
Save, while Trade Detail still says Planned. A second blank draft row produces
generic errors without identifying that row, making retained input appear saved.
Functional and accessibility checks did not establish visual fidelity or sufficient
save-state clarity.

**Trader decisions, 2026-10-24:** Cover **all installed D1/D2 screens**. Closely match
the references' composition, typography, spacing, compact cards, desktop drawers
and narrow-screen sheets. Retain Trade Journal branding, required D2 fields and
all existing data/readiness/atomicity safeguards. Future capabilities visible in
the prototype remain out of scope.

**Outcome:** Reference-aligned navigation, Planned/Open lists, Trade Detail, Plan
creation, opening execution entry, Journal/Debt and Workspace/onboarding; clear
Draft / Saving / Nothing saved / Saved states; row-specific blank-field errors;
accessible contextual forms and equivalent narrow/wide behavior. The completed
repair still operates through the existing production commands and durable store.
It is not a standalone theme or component-library release.

**Acceptance:** Compare the running app with each applicable reference at matched
viewport sizes; independently exercise complete D1/D2 flows, including the blank
second-execution regression, original Debt forms, conflict/recovery, offline and
safe update behavior. Visual acceptance is an explicit gate in addition to
functional/accessibility tests. Preserve data and expose no D3+ controls.

See [BUG-001 detailed task breakdown](plan/bug-001-ui-mockup-fidelity.md) for the
screen/reference map, concrete changes, dependency graph, TDD cases, real-stack
tests, visual comparison procedure and fresh independent critic gate. Planning
authorization does not authorize implementing the repair or deployment.

## Ordered vertical deliverables

### 1. Confirm and retain a Long Stock plan

**Capability:** From first-run onboarding, create a real Institution and Account,
confirm a Long Stock plan, find it in the trade list/detail, and reopen it after
restarting the application.

**User stories**

- As a trader, I would like to confirm a Long Stock plan with my intended entry,
  Stop, Target, thesis, and invalidation, so that I can preserve my decision and 1R
  before entering the position.

**Introduces:** `Workspace.initialize/getStatus/requestDurability`, first-run time
zone selection, real Institution/Account `ReferenceCatalog.save/query/resolve`,
`TradeWorkflows.confirmPlan`, and `TradeAnalysis.assessPlan`. The workflow uses
`TradeRecord.prepareChange/applyPreparedChange/getRecord/queryRecords` and
`Journal.getDefinitions/prepareEffects/applyPreparedEffects`; Workspace owns both
modules' required `seedDefaults` calls. `browseTrades/getTradeDetail`
expose only the saved Plan. The initial management selector supports fixed
underlying-price Stop/Target conditions. Confirmation requires a positive numeric
baseline and one completed Plan Reflection; thesis/invalidation are entered once.
No execution, valuation, general Journal editor, or report is advertised.

The first mutating slice also supplies the production HTTPS PWA, immutable release
inventory and capability declaration, safe update behavior, responsive shell,
four-check Runtime Readiness on all specified boundaries, mature-workspace capacity
and headroom derivation, advisory protection warning, and persistence write gate.
Unsupported fresh stores are not initialized; readable existing stores permit
Recovery Only reads; unreadable possible roots are never replaced as empty.
Backup export/verification are absent until D6 and Restore until D17 under the
explicit accepted delivery exception. Explain that temporary absence in recovery/protection
UI; do not claim a saved backup or offer a transfer that is not installed. Preserve
readable prior versions and safe retry through intervening migrations. Do not build
artifact serialization, file verification or replace-Workspace UI in this slice.

**Defaults and durability:** Add only Long Stock, the exact Plan Reflection
definition, and Source Plan Confirmation. Seed no fictional Institution/Account.
Persist metadata, Catalog identities/revisions, frozen Plan/Planned Leg/baseline,
Planned lifecycle binding, Entry snapshot, stable economic/audit ordering, and list
indexes. Market Data remains empty until D3. These facts already retain everything later stock execution
and review need; there is no generic future schema/framework release.

**Acceptance:** Partial AC-PLAN-001–002, AC-LIFE-003, AC-JOUR-007, AC-REF-001;
inherited obligations. **Declared scope:** Exact Long Stock/fixed management only.
D16 adds management variants; D7–D8, D15, D26 and D28 add option/criteria/shape
variants and complete AC-PLAN-001–002; D2 supplies lot/deviation agreement for full AC-LIFE-003. D19
adds Journal Edit/Addendum/Void; D15 completes fixed Journal defaults and D27
completes Catalog defaults. D6 adds complete backup/verification for populated
Trade, Journal, Market and Catalog sections; D17 adds Restore.

**Prerequisites / parallelism:** None. Once Plan confirmation, receipt, and the
initial schema/seed contract are fixed, the Plan domain/persistence path and
onboarding/Plan/list UI can proceed in parallel. One owner controls Workspace,
transaction/readiness, schema, seeds, shell, and release manifests.

### 2. Record opening fills and the entry decision

**Capability:** Open a saved Long Stock plan, record one complete initial decision's
fills with the intended opening quantity, and inspect actual holdings, opening fees,
fulfillment, Entry Quality and deviations without re-entering the Plan.

**User stories**

- As a trader, I would like to record my opening fills against the planned leg, so
  that I can see the actual position and how my entry compares with the plan.
- As a trader, I would like to complete, defer, or decline the entry reflection
  explicitly, so that I can capture the facts even when reflection must wait.

**Introduces:** Opening variants of `recordPositionChange`, `derive/assessChange`,
decision membership, per-fill ownership, open lots, lifecycle agreement, and
Planned-Leg intent/fulfillment. Resolve Entry Quality when the complete initial
planned quantity is entered.
Multiple broker fills may belong to this one decision; they are not scaling.
Retain each fill's fees, stable identity and Planned-Leg intent now. Later decisions
that add exposure and incomplete initial quantities arrive in D10; first-reduction
resolution arrives with the relevant disposal path. Deterministic terms/size
deviations retain their meanings; the explicit unplanned-leg path arrives in D12.
CompleteNow/Defer/Decline and a reachable Journal Debt queue using `Journal.save/query` provide one unique reflection
outcome; factual capture never waits for Debt. There is no valuation or disposal
selector yet, and no scale-in or legging action is offered.

**Defaults and durability:** Add exact Position Change Reflection definition and
Source Position Change, including Decision Mode, Emotion, Confidence, and optional
Note. Add Position Change/Execution facts, intent links, fulfillment/resolution evidence,
lots/agreement records, Deviation provenance, and obligation/Entry/decline/Debt
history with trigger-time form snapshots. Include the first actual D1→D2 migration.

**Acceptance:** Full AC-LIFE-003; partial AC-LIFE-001, AC-POS-001, AC-POS-005,
AC-CALC-001, AC-JOUR-003, AC-JOUR-005, AC-JOUR-007; inherited obligations.
**Declared scope:** One complete initial Stock entry decision. D10 adds staged
quantities/later adds; D11 completes stock scaling/FIFO and full lifecycle fixtures;
D12–D13 add selective-leg fulfillment and Entry Resolution endpoints. D5 adds
full closing; D16 completes the management/baseline fixture; D26 completes
objective fulfillment after D8 adds grouped multi-leg fulfillment. D4 supplies due-Debt
Review blocking for AC-JOUR-003; D19 supplies sole-answer Void/reopen for
AC-JOUR-005; D15 completes fixed Journal defaults after D4 adds voluntary forms.

**Prerequisites / parallelism:** D1. Opening/Journal transaction work and the fill,
reflection, and Debt UI can proceed in parallel after the command/result is fixed.
Trade schema/agreement projections and Journal obligations each have one owner.

### 3. Value the open position and see ongoing risk/reward

**Capability:** Enter initial exact completed-session Manual Marks or explicitly
acknowledge missing evidence, then see current value, remaining risk/reward, Plan-R
measures, Stop/Target status, and Overrun on the open-stock list and detail.

**User stories**

- As a trader, I would like to enter a dated price and see ongoing risk and reward,
  so that I can judge my remaining exposure against the frozen plan.
- As a trader, I would like to acknowledge a price I cannot obtain, so that I can
  distinguish missing evidence from an actual value without fabricating a number.

**Introduces:** Initial Manual Mark and missing-evidence acknowledgment variants
of `MarketData.save/query`, explicit session/Expected Mark Date resolution,
`TradeAnalysis.evaluate`, and coherent bounded open-list analysis. A later initial
exact Mark can resolve an acknowledged gap while retaining acknowledgment history.
Existing saved Marks cannot yet be corrected, overridden or Voided. Mark correction,
its bound impact preview, and acknowledgment withdrawal arrive in D18, after options.
Current-date exact evidence is required; old prices are Stale context only. All
installed calculations retain independent result states. Stop observation history
and stable episode identity are retained; ordinary reads create no Deviation facts.
Until D7 supplies a provider, recovery reports Not Configured and leaves manual tasks.

**Defaults and durability:** No new defaults. Add exact Instrument/date Mark and
acknowledgment facts, saved-intention/source metadata, session evidence bindings
including absence, and the bounded market indexes needed by current views. Capture
stable identities/history from the first fact even though correction UI comes later.
No provider configuration or Bar storage is introduced here.

**Acceptance:** Full AC-MARK-001, AC-MARK-003; partial AC-CALC-001–003,
AC-MARK-002; inherited obligations. **Declared scope:** Fixed-condition,
one-Instrument stock analysis and initial evidence capture only. D5 adds full-close
realization; D11 adds realized plus remaining-position examples; D16 completes the management/baseline fixture;
D8 adds independent multi-Instrument availability and completes fixed OR-condition
fixtures; D11 completes availability with actual partial realization.
D7 supplies automated retrieval and Manual-versus-provider precedence. D18 adds
Mark correction/withdrawal and evidence-bound preview; D27 completes linked previews.

**Prerequisites / parallelism:** D2. Market storage/evidence and pure evaluation
can proceed alongside Mark/list/detail UI once the evidence/result contract is
fixed. Shared `evaluate`, observation bindings, and market schema have single owners.

### 4. Conduct the manual Daily Review and add voluntary Journal entries

**Capability:** Open the latest or a selected completed session, resolve Mark tasks
and globally due Debt, walk eligible Trades in stable attention order, and explicitly
save each dated Action, and capture voluntary notes/reflections. Resume without a
stored Review session or Finish command.

**User stories**

- As a trader, I would like to review my positions in a consistent daily sequence,
  so that I can address missing evidence and overdue reflection before decisions.
- As a trader, I would like to save Hold, Exit, Roll, or Adjust intent for each
  eligible trade, so that I can record my decision without automatically executing it.

- As a trader, I would like to save voluntary trade notes and standalone reflections,
  so that I can capture observations beyond the required daily decision.

**Introduces:** All four `DailyReview` operations, stock cutoff eligibility,
Marks→due Debt→attention walk, preselected-but-unsaved Hold, required intent for
other Actions, and receipt-based bounded progress. All four Action values are
fully saveable intents; an intent never invokes an uninstalled trading workflow.
Save binds Trade/market/definition/obligation evidence, including missing evidence,
and atomically reconciles Stop Discipline with the Action. Completion is derived:
Missing blocks it, acknowledgment permits Complete With Unavailable Marks.

Add direct Create Entry variants of `Journal.save`, definition-bound forms and
`Journal.query` reading for Review Note and Trader Reflection. Offer creation from
Daily Review, a Trade Detail note action and a simple Journal composer/timeline.
Use exactly one committed Standalone, Trade or Execution Anchor according to
context, an automatic actual Source/time and an immutable displayed-form snapshot.
Persist only explicit Save; typing/navigation remain view state. Voluntary entries
create no Debt and neither replace the required Daily Action nor settle workflow
obligations. Follow-up prose creates no task. No Edit, Addendum or Void is installed
here; those variants arrive in D19, and later corrections retain these Anchors.

**Defaults and durability:** Add exact Daily Trade Review definition, Source Daily
Review, and its conditional intent rule. Add exact Review Note and Trader Reflection
definitions, plus Sources Trade Detail and Journal for their installed writing paths.
Persist voluntary Entry identity/Anchor/Source/time/definition snapshots alongside
dated Actions/Entry snapshots and
evidence-bound Stop episode reconciliation history, plus cutoff/review read projections. Opening,
preselection, typing, and navigation store no Action, Entry, Debt, or session.

**Acceptance:** Full AC-JOUR-001, AC-JOUR-003, AC-REV-003–004; partial
AC-REV-001–002, AC-REV-005–006, AC-JOUR-007; inherited obligations.
**Declared scope:** Stock Review with no settlement task. D18 adds corrected
historical eligibility and fact/Mark-correction conflicts; D19 supplies Action
Void/reopened completion; D15 completes settlement ordering; D7 adds provider/Bar
evidence bindings. D18 completes AC-REV-005 and D19 completes AC-REV-006.
Voluntary creation is complete here; D19 adds Edit/Addendum/Void. D15 completes
the seven fixed type/Source defaults; D23 completes customized-form/reseeding coverage.

**Prerequisites / parallelism:** D3. Review coordinator/atomic reconciliation and
the task-walk/voluntary-composer UI can proceed in parallel after their bound save/progress contract
is fixed. Review shared analysis, cutoff indexes, Journal definitions/schema and
save/effect validation have one owner.

### 5. Close a Long Stock trade

**Capability:** Record a complete exit, see FIFO realized P&L,
and retain terminal reason and Close Review without blocking factual capture.

**User stories**

- As a trader, I would like to close my entire Long Stock position, so that I can
  see the realized result and the factual Closed lifecycle.
- As a trader, I would like to complete or explicitly defer or decline my Close
  Review, so that I can close the position without losing the reflection obligation.

**Introduces:** Full-disposal variants of `recordPositionChange`, FIFO Lot Matches,
exact once-only allocation of opening/disposal fees and realized results. The full
exit consumes all remaining quantity; no partial-reduction control is installed.
Multiple fills may belong to this one complete exit decision without being scaling. Terminal agency requires
exactly one active reason; it is distinct from derived Terminal Disposition.
Close Review is a separate obligation, not the Position Change Reflection.
Historical Review eligibility uses exposure at the cutoff, not today's lifecycle.

**Defaults and durability:** Add four usable Close Reasons: Target Reached, Stop
Triggered, Thesis Invalidated, Time-Based Exit. Add exact Close Review definition
and Source Trade Close. Persist disposal facts, quantity-only lot links, realized
economic times, Closed lifecycle binding, terminal reason, and separate Close Review outcomes.
No projected closing fees or copied P&L basis are stored on lot links.

**Acceptance:** Partial AC-LIFE-001, AC-POS-001, AC-CALC-001,
AC-POS-004, AC-JOUR-007, AC-REF-001; inherited obligations. **Declared scope:** Trader-directed
full stock exits under original management only. D10–D11 add scaling and complete
AC-LIFE-001/AC-POS-001; D16 completes the management/baseline fixture; D7 completes the non-agency terminal fixture; Rolled is added
with Roll in D27. D15 completes Journal defaults; D27 completes Catalog defaults.

**Prerequisites / parallelism:** D4. FIFO/workflow/Journal effects and exit/Close
Review/detail UI can proceed in parallel after the command/result is fixed. Trade
agreement, fee arithmetic, and seed additions require one owner at a time.

### 6. Back up and verify the populated trading workspace

**Capability:** Download and verify a complete Workspace containing actual Plans,
Executions, full stock-closing facts, workflow/voluntary Journal entries including
Close Review, and Manual Marks. Keep a portable copy before Restore is installed later.

**User stories**

- As a trader, I would like to download and verify my complete trading workspace,
  so that I can keep a usable copy of my plans, executions, reflections and prices.

**Introduces:** `Workspace.exportBackup/confirmBackup`, ordinary file download,
selected-file read-back verification and an exact-source `CompletedBackupReceipt`.
All four authoritative sections plus metadata/settings come from one bound snapshot;
concurrent later changes are wholly outside it. Every current identity, fact/audit
revision, form snapshot, seed state and nonsecret setting is included. Verify the
complete selected artifact, manifest/digests and expected source binding; Downloaded
alone is not completed. Export and verification work in readable Recovery Only.
Use each fact module's owned `exportSnapshot` seam and return bound results without
read-back of directly changed state. Do not build Restore preparation, analytical
import validation or replace-Workspace UI; those belong to D17. Until then the UI
identifies a verified saved copy without claiming that local Restore is installed.

**Defaults and durability:** No new trading defaults or backup-status facts.
Introduce the versioned portable artifact/manifest, counts/digests, source binding
and verified result receipt. Private caches/projections, transient diagnostics and
secrets are excluded. Preserve complete facts and artifact version provenance now,
so D17 can restore earlier supported versions without inventing history. Every
later durable change extends complete export/verification immediately.

**Acceptance:** Partial AC-BACK-001, AC-DEL-005–006; inherited obligations.
**Declared scope:** Complete populated D1–D5 export/read-back verification, including
full stock closure and voluntary/Close Review Journal entries. D7 adds provider/credential-exclusion fixtures; D17 adds
Restore and restored provider setup; D18–D19 add correction/Journal histories;
D23 completes customized-definition fixtures for full AC-BACK-001. D17 completes
Restore-related AC-DEL-005–006 boundaries. The pre-D6 export exception ends here;
the explicitly deferred Restore boundary continues until D17.

**Prerequisites / parallelism:** D5, with Plan/Execution/Journal/Mark capture
from D1–D4 and full stock closure/Close Review from D5. Snapshot/artifact/verification work and backup/file-selection/result UI
can proceed in parallel once bindings/results are fixed. Artifact/schema versions,
module exports, snapshot bindings and release manifests have one owner at a time.

### 7. Trade exact Long Calls and Long Puts with automated Marks

**Capability:** Plan, enter, value, review and fully exit exact single-leg
Long Calls and Long Puts through complete initial entries and full exits, including
physical contracts. Record supported explicit
Expiration/cash-settlement outcomes. Configure optional automated closing-price
retrieval for stock and option positions at this same delivery boundary.

**User stories**

- As a trader, I would like to trade an exact Long Call or Long Put,
  so that I can apply the same planning, risk, review and reflection discipline to options.
- As a trader, I would like to retrieve dated stock and option prices automatically,
  so that I can reduce manual entry while retaining an offline Manual Mark path.
- As a trader, I would like to see Planned and Current expiration payoff separately
  from observed value, so that I can distinguish settlement economics from valuation.
- As a trader, I would like to record expiration or cash settlement explicitly,
  so that I can preserve the actual outcome rather than infer it from a calendar date.

**Introduces:** Exact option contract/multiplier/expiration and cash-settlement
variants of installed Plan, complete opening, valuation/risk, Review and full-closing
workflows. Scaling arrives in D10–D11 rather than inside this option slice.
Use original fixed conditions; ordinary management revisions, corrections,
Abandonment, replay and reports remain absent until their own later slices.
Add `expirationPayoff`: complete piecewise-linear zeros/touches/ranges, signed
extrema/attainment, independent Planned/Current curves and current realized offset.
Underlying-price option Stops retain a separately frozen monetary loss boundary.
Due settlement blocks Review until explicit facts exist; non-agency outcomes have
no manufactured Close Reason. Discretionary option exits use existing reason rules.
Contract settlement style is not an eligibility gate for planning, ordinary fills,
valuation or exits. Do not build a cash-settled instrument allowlist, extra provider
lookup, or temporary enforcement framework. Retain ordinary contract/quantity/shape
validation and known contract terms needed for truthful economics. Capture explicit
advance Exercise Intent for physical long-option Plans now, because it is frozen
Plan evidence and cannot be invented when settlement support is added later.
Assignment/Exercise capture and Cash-Secured Puts follow in D15. If a physical
outcome occurs sooner, the trader has accepted bringing that work forward; the app
retains Settlement Due and incomplete Review rather than fabricating Expiration,
cash settlement or successor Stock. Those physical-settlement operations are absent
from D7's capability declaration, not represented as a delivered but Unavailable
calculation. This is an accepted temporary workflow boundary, not an instrument ban.

Add `getProviderConfiguration/configureProvider/recover` and one selected
`PricingProvider.fetchClosingObservations` adapter, reachable from price tasks,
Trade Detail and Daily Review. Support configured retrieval for exact stock and
installed option instruments; bound requests by relevant sessions/gaps. Partial or
unsupported responses leave explicit manual tasks, while failures stay transient
operational context rather than Journal facts or acknowledgments. Manual override
of provider valuation is supported and remains sticky; it is not error correction.
Independent valid provider Bars may seed eligible provider closes but never replace
an effective Manual Mark. Capture Bar facts now because provider recovery requires
them; trailing controls arrive in D16 and range charts in D14 when first needed.
Every manual path remains usable offline, including when provider setup is absent.

**Defaults and durability:** Add Long Call and Long Put shapes with no parameter
defaults. Add exact option identity/known settlement terms, frozen long-option
Exercise Intent, premium/multiplier economics and explicit Expiration/cash-settlement
facts with disposition provenance. Add
nonsecret zero-or-one provider configuration, redacted/write-only credential
handling, provider Mark revisions and independent Daily Bar history. Exclude
secrets/raw payloads/diagnostics from backups. D17 Restore will explicitly require
credential setup even if an old local credential matches; preserve nonsecret
configuration provenance now without building Restore early. Extend owned export,
verification, candidate migration and indexes for these facts, not future reports.

**Acceptance:** Full AC-POS-004, AC-MARK-002, AC-MARK-005; partial
AC-SET-003, AC-CALC-004, AC-PLAN-001–002, AC-POS-005, AC-REF-001,
AC-REV-005, AC-MARK-004, AC-MARK-006; inherited obligations.
**Declared scope:** Ordinary exact Long Call/Long Put trading and operational provider
recovery arrive together without a cash-settlement instrument restriction. D15
completes physical settlement/Review ordering and adds
Cash-Secured Puts. D16 adds single-Instrument trailing Bar use; D18 completes
fact/Mark-correction conflicts; D14 completes point/candle/gap replay. D8 completes
fixed multi-Instrument condition analysis and mixed-expiry payoff applicability;
D10–D11 add staged quantities/scaling and complete realized-plus-open payoff inputs;
D16 completes trailing evidence, D26 objective selection, D27 Catalog defaults and
D28 trader-defined Plan shapes. D23 completes customized-form full
backup fixtures; secret exclusion applies here, and D17 delivers provider Restore
setup behavior. No Restore operation is advertised before D17.

**Prerequisites / parallelism:** D6. Option economics/provider recovery and
contract/settlement/payoff/provider UI can proceed in parallel after interfaces and
credential boundaries are fixed. Instrument/Market schemas, Strategy seeds,
shared analysis, Review evidence, backup exclusions and manifests serialize.
Provider selection/feasibility must be resolved before this slice is frozen; no
vendor is assumed and no adapter is advertised without working stock/option retrieval.

### 8. Trade multi-leg strategies through the ordinary trading workflow

**Capability:** Plan, enter, price, review and fully exit exact Vertical
spreads, Iron Condors, Covered Calls and PMCCs through grouped complete entries and
full exits. Record grouped decisions with
per-leg ownership, independent price availability, structure risk and honest payoff.

**User stories**

- As a trader, I would like to plan and record spread, Iron Condor and Covered Call
  decisions as grouped fills, so that I can retain each leg's ownership and one
  reflection outcome for the decision.
- As a trader, I would like to see independent leg availability and structure
  risk/reward, so that I can retain known results when a component price is missing.
- As a trader, I would like to close the whole structure in one grouped decision,
  so that I can record all leg disposals and the completed trade together.
- As a trader, I would like to operate a PMCC with its actual expiration order,
  so that I can review observed value without a fabricated single payoff curve.

**Introduces:** Exact typed multi-leg ratio/underlying/expiry/strike/share-coverage
validation, grouped complete fills serving stable planned roles, per-leg opening
and disposal economics, complete-decision Position Change Reflection, multi-Instrument
valuation and fixed original underlying-price/structure-value OR conditions.
Add co-expiry Planned/Current payoff and PMCC mixed-expiry applicability: mixed
expirations return Unavailable for payoff while exact-date Mark valuation remains
independent. There is no theoretical option pricing. Each leg row identifies role,
long/short direction, quantity, Underlying, strike and expiration; submitted fills
retain Instrument/fact identity instead of relying on row position or label.
Extend provider/manual price tasks, risk, Daily Review and ordinary exits now.
Mismatched terms remain distinguishable from explicitly Unplanned intent.
This slice opens the intended roles/quantities together and closes all remaining
roles together; multiple fills within one decision are not staged decisions.
D10–D11 add quantity scaling, and D12–D13 add selective-leg entry/exit, untouched
roles and explicitly Unplanned members. Introduce only those action variants here
that are complete; do not build temporary instrument-policy enforcement.
Capture planned short-option settlement obligations and long Exercise Intent when
confirming the Plan, even though physical settlement capture follows in D15.

This is the ordinary trading happy path, not a waiver of correctness: its validation,
conflicts, atomicity, history, availability, offline and receipt obligations are
complete within the declared operation variants. Do not build ordinary management
revision, correction, Journal editing, replay or reporting workflows here.
Physical contracts remain selectable under the accepted D7 approach; an actual
Assignment/Exercise remains Settlement Due until D15 is installed or expedited,
never a fabricated cash outcome. Covered Call allocation is added with D15, not
through a shortcut in this slice.

**Defaults and durability:** Add Covered Call, the four canonical Vertical shapes,
Iron Condor and PMCC with exact role order/constraints and no parameter defaults.
Persist role/member/ratio and mixed-expiry provenance, exact Instrument ownership,
grouped full opening/disposal facts, quantity-only FIFO links and necessary indexes.
Per-leg prices/fees, economic ordering, original management and settlement intent
are preserved now for later corrections and revisions; no later history invention.
Keep one decision identity and one reflection outcome rather than per-leg duplicates.

**Acceptance:** Full AC-POS-002, AC-CALC-003; partial AC-CALC-002, AC-CALC-004, AC-POS-005,
AC-PLAN-001–002, AC-REF-001; inherited obligations.
**Declared scope:** Ordinary trading of all seven seeded multi-leg shapes, including
PMCC, with grouped complete entry/full exit, exact contracts and fixed original
management. D10–D11 add scaling and complete the realized-plus-open calculation
fixtures; D12–D13 add legging and per-leg fulfillment. D15 adds physical settlement,
D16 adds leg-aware management revision and full trailing-evidence AC-MARK-006,
D18 adds leg/fact selection for correction, D26 adds objective selection, and D28
adds trader-defined shapes and completes Plan variants. D27 completes Catalog
defaults when Rolled arrives. Process Scorecard and Journal Field Analysis follow
this slice rather than block daily strategy use.

**Prerequisites / parallelism:** D7. Shape/group/evaluation work and multi-leg
Plan/fill/exit/condition/payoff UI can proceed in parallel once contracts are fixed.
Strategy seeds, Trade schema, shared analysis, provider relevance and Review bindings
have one owner at a time. No future revision, correction or report interface is
built merely to make this slice appear dependency-closed.

### 9. Abandon a plan that was never entered

**Capability:** Abandon an eligible saved stock, single-leg or multi-leg option
Plan and retain its reason/history after the ordinary option trading slices.

**User stories**

- As a trader, I would like to abandon a plan I did not enter, so that I can keep
  the decision history while removing it from active planning.

**Introduces:** `abandonPlan`, factual eligibility from effective Position Changes,
Abandoned list/detail state, and retirement of applicable obligations. An entered
Trade is rejected; Abandonment has no Close Reason or Terminal Disposition.

**Defaults and durability:** Add the five exact protected Abandonment Reasons.
Add Abandonment fact, reason reference, lifecycle agreement/index effects and
applicable obligation retirement. No synthetic “Never Filled” outcome is seeded.

**Acceptance:** Partial AC-LIFE-002, AC-REF-001; inherited obligations.
**Declared scope:** Never-entered facts are supported now; D18 completes the
previously-entered-but-Voided eligibility fixture. D27 completes Catalog defaults.

**Prerequisites / parallelism:** D8. Eligibility/commit work and abandonment UI
can proceed in parallel after the contract is fixed; lifecycle schema and reason
seed manifest have single owners.

### 10. Scale into an existing trade

**Capability:** Enter the planned quantity over several decisions or add quantity
later to installed stock/single-leg trades and complete multi-leg structures.
Inspect open lots, fees, fulfillment, Entry Quality and recalculated current risk.

**User stories**

- As a trader, I would like to build my position over several entry decisions,
  so that I can record each actual addition and its reflection separately.
- As a trader, I would like to see planned fulfillment and risk after each addition,
  so that I can distinguish the initial entry window from later exposure changes.

**Introduces:** Quantity-staging/addition variants of `recordPositionChange` in the
real entry UI. For multi-leg structures, add matching ratio units across the planned
roles together; selective-role entry waits for D12. Several broker fills within one
decision still create one reflection outcome, while separate additions retain
separate decision identities. Assess actual size, Planned-Leg associations and
terms with frozen Plan evidence. Keep Entry Quality unresolved during staged entry,
resolve once at its canonical endpoint, and preserve it through later adds.
Extend current value/risk, provider/manual price relevance and Daily Review now.
An add cannot silently move a fill to another Trade or rewrite planned quantity.

**Defaults and durability:** No new defaults. Add only staging/addition operation
variants, per-decision membership and fulfillment/resolution provenance as required;
retain distinct lots, fees and economic/audit order using existing fact identities.
Extend compatible agreement/index/migration/backup behavior for these variants.
Do not prebuild selective-leg controls or correction UI.

**Acceptance:** Partial AC-LIFE-001, AC-POS-001, AC-POS-005, AC-CALC-001;
inherited obligations. **Declared scope:** Quantity scaling in for installed
stock/single-leg and complete multi-leg structures. D11 completes stock scaling/FIFO
and lifecycle fixtures; D12–D13 add legging and selective-leg entry-window cases;
D16 completes the management/baseline fixture, and D26 completes objective fulfillment.

**Prerequisites / parallelism:** D9, using D2 and D7–D8 entry behavior. Addition/
fulfillment/lot work and scaled-entry/decision-history UI can proceed in parallel
after the request/result contract is fixed. Trade schema/agreement, fee/Entry Quality
analysis, Review/provider relevance and capability/navigation manifests serialize.

### 11. Scale out while retaining the remaining position

**Capability:** Reduce quantity without closing the whole Trade, then make further
reductions or a final exit. See realized results alongside remaining value/risk for
stock, single-leg options and ratio-preserving multi-leg structures.

**User stories**

- As a trader, I would like to take a partial exit and later close the remainder,
  so that I can retain actual realized results and the exposure I still own.
- As a trader, I would like to see remaining fees, risk and payoff after a reduction,
  so that I can manage the remaining position without counting costs twice.

**Introduces:** Partial-reduction variants of `recordPositionChange`; select quantity
for a single Instrument or matching ratio units across all open structure roles.
Selective-leg disposal waits for D13. Quantity-only FIFO links allocate opening and
disposal fees exactly once; unconsumed opening fees remain with open lots. Display
realized/open/combined results independently and include realized offset in Current
payoff. Partial realization leaves lifecycle Open; only flat exposure closes it.
The first reduction resolves any still-open initial entry window immediately before
that reduction. Final agency/Close Review rules already installed in D5 and D7–D8 apply
at the actual terminal event. Update risk, Review eligibility and decision-level
Entry/Exit Scaling classification without counting broker fills as extra decisions.

**Defaults and durability:** No new defaults. Extend disposal/member variants,
quantity-only lot links, realized economic-time indexes and entry-resolution
provenance; maintain durable lifecycle/lot/Deviation agreement atomically. These
facts and remaining fee portions are included in backup/verification immediately;
D17 later restores those same complete facts.
No copied P&L basis, hypothetical fees or stored ratio result is introduced.

**Acceptance:** Full AC-LIFE-001, AC-POS-001, AC-CALC-002, AC-CALC-004; partial
AC-CALC-001, AC-POS-005; inherited obligations. **Declared scope:** Quantity scaling
out across installed stock/single-leg and complete ratio structures. D12–D13 add
selective-leg/untouched-role fulfillment; D16 completes the later-management
AC-CALC-001 fixture and D26 completes objective fulfillment. Later legging extends
these same independent calculation/payoff guarantees to changed role membership.

**Prerequisites / parallelism:** D10. FIFO/reduction/evaluation and quantity-exit/
remaining-position UI can proceed in parallel after contracts are fixed. Lot/fee
analysis, lifecycle/Entry Quality projections, Review bindings, schema and manifests
have one owner at a time.

### 12. Leg into a planned structure over separate decisions

**Capability:** Enter selected planned roles at different times, complete outstanding
legs later, and explicitly identify an unplanned member without rewriting the Plan.
See the position that actually exists during the incomplete structure.

**User stories**

- As a trader, I would like to select which planned legs I am entering now,
  so that I can record a spread or other structure built over separate decisions.
- As a trader, I would like to distinguish planned legs from an explicit unplanned
  addition, so that I can preserve my intent and the actual interim exposure.

**Introduces:** Selective-role opening variants and exact Instrument/role/decision
selection in the fill UI. Unentered roles remain Unfilled; partial quantities remain
Partially Filled. Assess each served leg from frozen selectors, never from row order.
Explicitly Unplanned intent is its own choice, not an inference from mismatched
terms. Group members that form one decision under one reflection outcome. Evaluate
actual interim ownership, missing exact prices, uncovered/unbounded risk and payoff
honestly; do not pretend the final planned shape already exists or impose its
complete-entry coverage rules on a legitimate intermediate position. Frozen planned
coverage/ratio/expiry constraints still apply to Plan confirmation. Resolve initial
Entry Quality only at its canonical endpoint, then preserve it through later adds.
Update provider relevance, Manual tasks and Review as each actual Instrument enters.

**Defaults and durability:** No new Strategies/defaults or informal Actual Leg entity.
Add the selective-entry variants and explicit unplanned-intent associations needed
now, retaining stable Planned-Leg/Instrument/fact identities, decision membership,
fulfillment/Deviation provenance and original Plan quantities. Extend existing
schema validation, backup/verification, agreement and indexes for this behavior;
D17 adds Restore without inventing missing intent/history.

**Acceptance:** Full AC-POS-002 remains applicable; partial AC-POS-005, AC-CALC-001;
inherited obligations. **Declared scope:** Selective-leg entry and honest interim
analysis for installed seeded shapes. D13 adds selective-leg reductions and the
untouched-leg terminal/first-reduction cases; D16 completes the management/baseline
fixture and D26 completes objective-selection fulfillment. Physical settlement
continues to wait for D15 under the accepted early-option boundary.

**Prerequisites / parallelism:** D11. Intent/fulfillment/interim analysis and leg/
Instrument/quantity selection UI can proceed in parallel after contracts are fixed.
Trade schema, shared assessChange/evaluate/payoff, provider relevance, Review and
capability/navigation manifests require single owners.

### 13. Leg out while retaining other structure members

**Capability:** Close selected Instruments/quantities and leave other legs open,
then dispose of the remainder with clear ownership, realized results and changed risk.

**User stories**

- As a trader, I would like to select which legs and quantities I am closing,
  so that I can record the actual disposal while retaining the remaining holdings.
- As a trader, I would like to see the risk and payoff of the remaining structure,
  so that I can manage exposure after the original structure changes.

**Introduces:** Selective-leg disposal variants with explicit role/Instrument/lot
context, available quantities and one decision reflection outcome. Apply existing
FIFO/fee treatment per disposed Instrument; preserve untouched quantities and
original Plan/1R. Re-evaluate actual remaining membership, independent exact-price
availability, unbounded risk, and Current payoff with realized offset. A leg exit
alone does not close a Trade that still owns exposure. First reduction freezes the
initial entry comparison; if a partly entered Trade eventually closes, untouched
planned roles become Not Entered with factual size/terms evidence, not invented fills.
Full terminal reason and Close Review rules apply only when the Trade truly closes.
Update price tasks, Daily Review, detail/list and decision history immediately.

**Defaults and durability:** No new defaults. Extend selective-disposal variants and
quantity-only FIFO links with stable Instrument/fact/decision identity, realized
ordering, fulfillment/resolution evidence and atomic agreement/index updates.
Capture everything a later correction needs to distinguish multiple decisions and
fills for the same leg; do not introduce correction controls here.

**Acceptance:** Full AC-POS-002 and AC-CALC-002–004 remain applicable; partial
AC-POS-005, AC-CALC-001; inherited obligations. **Declared scope:** Selective-leg
exits and untouched-leg/Entry Resolution cases for installed seeded shapes.
D16 completes the management/baseline fixture and D26 completes objective fulfillment;
D18 adds corrections selecting these exact leg/fact/decision identities.

**Prerequisites / parallelism:** D12. Disposal/remaining-membership analysis and
leg-selection/exit/result UI can proceed in parallel after contracts are fixed.
Trade/lot schema, fee/payoff analysis, Review/provider relevance and manifests have
one owner at a time.

### 14. Replay the trade's observed lifetime

**Capability:** Walk recorded positions, realized/marked results, original management,
conditions, deviations and saved Journal evidence over the relevant trading dates,
including scaled and legged trades, before Assignment/Exercise capture.

**User stories**

- As a trader, I would like to replay a trade with explicit price gaps, so that I
  can understand what was observable as the trade developed.

**Introduces:** `TradeAnalysis.replay`, `replayTrade`, date-bounded Market range
queries and accessible history charts/tables. Open Trades run to expected completed
session; terminal Trades end at their relevant lifetime. Provider Bars captured
since D7 now appear as real candles; close-only Marks
remain points and missing dates remain explicit gaps. There is no custom date
range, interpolation, carry-forward, fabricated crossing, or synthetic candle.
Historical gaps do not prevent today's Review. Read existing workflow and voluntary Entries
without requiring the later Journal editing variants. Assignment/Exercise, management
revision and correction extend this same replay in D15–D16 and D18 when those
facts arrive.

**Defaults and durability:** No new authoritative facts/defaults. Add only necessary
rebuildable range/replay indexes and bindings; existing identities/economic times
supply the history. No durable chart points or duplicated arithmetic.

**Acceptance:** Full AC-MARK-004; partial AC-UI-002; inherited obligations.
**Declared scope:** All installed replay/price-gap accessibility is complete;
D17 supplies destructive-Restore views for full AC-UI-002. Replay covers
installed stock/single-leg/multi-leg ordinary trading, scaling and legging with
actual candles, points and gaps. D15 adds physical-settlement lineage, D16 adds
management revisions, D18 updates corrected replay, and D27 adds Roll history
as obligations inside those later capabilities.

**Prerequisites / parallelism:** D13. Replay assembly/analysis and chart/navigation
UI can proceed in parallel after the frame/coverage contract is fixed. Shared
`replay` and market range indexes have one owner.

### 15. Record physical option settlement and manage resulting stock

**Capability:** Record Assignment/Exercise for the Long Calls/Long Puts already
supported in D7 and the multi-leg structures in D8, add Cash-Secured Put
trading, and allocate/manage or remove delivered Stock.

**User stories**

- As a trader, I would like to allocate physical settlement to selected existing
  Stock Trades and any residual successor, so that I can preserve actual ownership
  and basis without counting option premium twice.
- As a trader, I would like to record Exercise Intent and manage delivered exposure,
  so that I can distinguish planned settlement from new unmanaged exposure.
- As a trader, I would like to resolve settlement tasks during Daily Review, so
  that I can complete review with all required factual outcomes recorded.

**Introduces:** Physical settlement capture and Cash-Secured Put; explicit settlement
price, bounded eligible destinations, allocation/residual successor, typed lineage,
all-or-nothing multi-Trade receipts. Linked correction follows in D18. Cash-secured names intent,
not verified cash collateral. Use the explicit long Exercise Intent retained in D7;
short obligations
are planned settlement; unplanned automatic exercise is still recorded truthfully.
Resulting short Stock is supported as settlement-derived exposure, including honest
Unbounded analysis where applicable, not a new discretionary Short Stock seed.
No guessed allocation or fake discretionary successor Plan Reflection.
Management Debt has a precise workflow route: establish initial management or
factually remove exposure; prose cannot settle it. Include only the narrow
`reviseManagement` variant that establishes first fixed Stop/Target management for
unmanaged settlement-created Stock, with its completed Management Revision form.
This prevents an unusable Debt queue without introducing ordinary revisions to
existing Stops, Targets or thesis. D16 later adds those variants.
Multi-leg settlement retains the affected leg/Instrument identities and one
decision outcome; Covered Call assignment uses the actual Stock allocation.
Review order becomes
Marks→global due Debt→settlement due→attention walk for all installed instruments.

**Defaults and durability:** Add Cash-Secured Put shape and the exact Management
Revision definition/Source needed to establish delivered-stock management, including
its AllOrNone optional thesis/invalidation rule. Persist Assignment/Exercise members,
explicit allocations, basis/proceeds distinct from
settlement price, lineage, successor context and workflow-routed Management Debt.
Extend atomic agreement/lot/Journal reconciliation, initial management facts,
provider relevance, backup/verification and installed read views. Extend the existing
replay with these facts; do not prebuild report or correction workflows.

**Acceptance:** Full AC-SET-001–004, AC-JOUR-006, AC-REV-002; partial
AC-REV-006, AC-REF-001, AC-JOUR-007; inherited obligations.
**Declared scope:** Physical settlement for installed single/multi-leg trades and
initial management are
complete after Replay and Abandonment are already usable. Extend the existing
replay with linked settlement history now. D16 adds ordinary management revision; D18 adds all
installed fact/linked-settlement corrections; D19 completes Action Void/reopened
Review completion. D27 completes Catalog defaults. This slice completes the fixed
Journal types/Sources now that D4 already supplies voluntary forms; D23 completes
customized-form/reseeding coverage. D17 adds full Restore of these linked facts.

**Prerequisites / parallelism:** D14, using the contract/ownership capabilities of
D7–D8 and D10–D13. Settlement candidate/atomic allocation and destination/intent/
management-debt UI can proceed in parallel after the multi-Trade
contract is fixed. Schema, lineage, Journal debt routing and shared analysis
and coordinator commit boundaries require one owner at a time.

### 16. Revise management while preserving the original plan

**Capability:** Revise management of installed stock, single-leg and multi-leg
Trades, select the affected condition and its Instrument/Underlying/structure
context, and inspect effective management, history and recalculated risk.

**User stories**

- As a trader, I would like to select the affected leg or structure context and
  revise management with an explicit rationale, so that I can adapt the trade while
  retaining my original baseline and decision.
- As a trader, I would like to use independent underlying-price and structure-value
  conditions, including trailing conditions, so that I can express my actual management.

**Introduces:** Ordinary `reviseManagement` variants, reusing the exact Management
Revision form and AllOrNone rule from D15, independent OR conditions and nearest
monetary-boundary analysis. The UI identifies the exact condition and its leg/
Instrument, Underlying or whole-structure scope wherever the canonical condition
permits it. Selecting a leg never silently changes a frozen Planned Leg or creates
a new kind of Stop. Trailing single-Instrument stock/option conditions use the provider Bars already
captured in D7: same-date high for long exposure and low for short exposure, with
exact Mark fallback and explicit gaps. Multi-Instrument structures use synchronized
exact Marks rather than combining independent leg extrema. No intraday range is
inferred from a Mark. Condition replacement
closes the appropriate episode rather than manufacturing recovery. Revisions and
Target achievement are not Deviations. Both Plan creation and revision selectors
gain only these now-supported management variants.

**Defaults and durability:** Reuse the exact Management Revision definition and
Source introduced for initial settlement management in D15. Add ordinary management
revision variants, condition identities/activation times, and historical evaluation
provenance/projections. Original management/1R stay frozen; seed no future defaults.

**Acceptance:** Full AC-CALC-001, AC-MARK-006; partial AC-JOUR-007;
inherited obligations. **Declared scope:** Leg-aware ordinary revisions for installed
stock/single-leg/multi-leg positions, including synchronized structure evidence.
D8 already supplies fixed original OR-condition analysis; revise those same
canonical conditions rather than invent a separate multi-leg management model.
All fixed Journal types/Sources are already present from D15; D23 completes
customized-form/reseeding coverage.
D15 already supplies the narrower initial-management Debt route for delivered Stock.

**Prerequisites / parallelism:** D15. Management transaction/evaluation and the
revision/history UI can proceed in parallel after the condition/result interface
is fixed. Condition schema and shared `evaluate` remain single-owner resources.

### 17. Restore a saved workspace before correcting trading history

**Capability:** Preview and explicitly restore a complete saved Workspace after the
ordinary trading, scaling, legging, voluntary Journal, Review, Replay, settlement
and management workflows are usable, before correction workflows are introduced.

**User stories**

- As a trader, I would like to preview and restore a saved workspace, so that I can
  recover or move my trading history with its identities and relationships intact.
- As a trader, I would like to see exactly what will be replaced and protect the
  current workspace first, so that I can make an informed recovery decision.

**Introduces:** `Workspace.prepareRestore/applyPreparedRestore` and each fact
module's owned `prepareRestore/applyPreparedRestore` seams. Nonmutating preparation
validates an untrusted artifact, installed capability/schema/seed compatibility,
all histories and cross-section references, and required analytical agreement.
Show versions, counts, migration/repair/rebuild effects, provider Needs Setup and
exact target replacement impact. A stale/incompatible/corrupt candidate writes
nothing. Apply requires Writable readiness, capacity/headroom, explicit whole-
Workspace replacement, and an exact-target completed safety-backup receipt from
D6 or deliberate decline after warning. A download alone or older receipt is
insufficient. Atomically replace all sections/settings, rebuild private state,
invalidate old views, re-establish readiness and return the new landing state.
No merge, selective import or stable-identity reminting.

Restore supports the earlier D6 artifacts and every schema added through D16,
using the lossless candidate migrations already required by their originating
slices. Reproduce Positions, lots/fees, lifecycle, Journal/Debt, exact Mark/Bar
history, Daily Review and Replay; disclose repairs rather than changing data during
ordinary reads. Provider credentials are absent and restored configuration needs
explicit setup. Later corrections, Journal versions, definitions, reports and
Rolls extend this same Restore capability within the slice introducing their facts.

**Defaults and durability:** No new trading defaults or authoritative Restore-status
facts. Introduce artifact-to-target preparation/bindings and full replacement
validation/application for the already captured authoritative sections. Preparation
tokens and receipts remain result/view evidence; stable identities/history survive.
Schema changes here are limited to what atomic replacement actually requires.

**Acceptance:** Full AC-REST-001–004, AC-DEL-005–006, AC-UI-002; partial
AC-BACK-001; inherited obligations. **Declared scope:** Complete Restore/recovery
for all D1–D16 facts and supported older backup versions, including provider setup
and voluntary entries. D18–D19 add correction/Journal histories, D23 completes
customized-definition AC-BACK-001 fixtures, and D28 completes the mature mixed-fact
reconstruction/performance fixture. No current fact type is selectively omitted.
The accepted temporary Restore deferral ends here.

**Prerequisites / parallelism:** D16, consuming D6 backup/verification and every
intervening fact schema. Candidate/migration/replacement work and Restore preview/
safety-choice/landing UI can proceed in parallel once contracts are fixed. Workspace
schema/transaction activation, owned validators, manifests, shared analysis and
view invalidation require a single owner at a time.

### 18. Correct trade facts and Marks without erasing audit history

**Capability:** Preview and commit Replace, Void, or Rebuild for installed stock,
single-leg/multi-leg option and linked settlement facts, including scaled/legged
entries and exits; select the exact leg
and Execution/settlement fact, correct Marks or withdraw an
acknowledgment with its proper meaning. Inspect corrected economics and prior history.

**User stories**

- As a trader, I would like to select the exact leg and fact before previewing
  a correction, so that I can repair the intended economics without changing another
  leg or hiding what was originally recorded.
- As a trader, I would like to retain old execution-linked notes after rebuilding
  a trade, so that I can still understand the original decision context.

**Introduces:** `previewCorrection/commitCorrection`, `history/resolveAnchors`,
material Review Impact acknowledgment, same-identity Replace versions, visible
Void, and same-Trade/new-fact Rebuild. Bound previews disclose affected calculations,
intervals, lifecycle, lot/fee/deviation and Journal consequences without writes.
The selector distinguishes leg role, Instrument, direction, strike/expiration,
quantity, decision membership and stable fact identity, including multiple fills
serving one leg. The picker preserves the distinct decisions introduced by
D10–D13, rather than identifying a correction target by role label alone.
Preview shows whole-Trade and linked effects even when one leg is
selected; grouped members are never mistaken for independent reflection outcomes.
Include linked Assignment/Exercise candidates and stale-participant rollback now.
Commit rechecks all participants and reconciles them atomically. Historical Debt
origins may retire or reopen as required; retained recorded Deviation evidence is
not deleted merely because an observation cannot be recovered.
`previewMarkChange` and correction/withdrawal variants of `MarketData.save` arrive
here, with correction reasons, saved-intention distinctions and evidence-bound
no-write conflict. A deliberate Manual override remains distinct from correction.
Provider refresh and explicit initial management in earlier slices are not correction
workflows and expose no Replace/Void/Rebuild or Journal Edit/Void controls.

**Defaults and durability:** No defaults. Add correction versions/reasons,
supersession sets, historical Anchor reachability, Mark correction/withdrawal history,
corrected economic ordering and invalidation/reconstruction of installed agreement,
list and Review projections. Each existing fact keeps its original stable identity
and audit history; correction is added without converting prior overwrites.

**Acceptance:** Full AC-LIFE-002, AC-REV-001, AC-REV-005; partial
AC-CORR-001–005, AC-REV-006; inherited obligations. **Declared scope:** Stock,
single-leg/multi-leg option, scaled/legged execution, Mark and linked
physical-settlement correction now. Extend the replay already installed in D14
with corrected economics/audit immediately; do not defer that integration.
D22 and D24–D25 add report consequences, and D27 completes the remaining
Roll/all-or-nothing correction fixtures. D19 supplies Action Void/reopened completion
for full AC-REV-006. Later reports read corrected facts at economic time.

**Prerequisites / parallelism:** D17. Candidate/reconciliation work and fact/Mark
preview/audit UI can proceed in parallel after footprint/results are fixed.
Correction ownership spans Trade, Journal, Market evidence, analysis and
invalidation; it cannot have concurrent writers.

### 19. Edit, append to and Void Journal entries

**Capability:** Edit an Entry, add a distinct Addendum or Void with a reason, and
inspect the version history in the Journal already usable since D4. Retain original
evidence and reversible obligation/completion effects.

**User stories**

- As a trader, I would like to edit, add to, or Void saved reflections explicitly,
  so that I can improve my record while preserving its history and meaning.

**Introduces:** `Journal.save` Edit/Addendum/Void variants, extending the existing
composer/timeline/query and Standalone/Trade/Execution Anchors from D4 with full
version-history and current versus historical Source/time display. Edit uses the original form;
Addendum gets its own identity/current definition and actual source/time without
inheriting origin. Voiding a sole obligation answer reopens the original Debt;
Voiding a Daily Action changes derived completion. Unsaved prose remains view state.

**Defaults and durability:** No new defaults. Reuse Review Note, Trader Reflection
and Sources from D4; all seven fixed type/Source defaults are present since D15.
Persist Entry version chains, Addendum parent links, Void reasons and unique
outcome/reopen history. No market-event or user-created Entry Type is introduced.

**Acceptance:** Full AC-JOUR-002, AC-JOUR-005, AC-REV-006; partial AC-JOUR-007;
inherited obligations. **Declared scope:** Full Journal editing/history and
reversible completion semantics are installed; D23 completes the customized
runtime-form/repeated-seed fixture for
AC-JOUR-007. The prior fact correction and settlement slices already supply
the other reversible-completion cases.

**Prerequisites / parallelism:** D18. Journal version/outcome logic and timeline/form
UI can proceed in parallel after save/results are fixed. Entry/debt schema and
Journal save validation have one owner.

### 20. Organize trades with maintained references and tags

**Capability:** Maintain real accounts/references, tag Trades and Idea Sources,
rename or permissibly retire values, and filter/browse without rewriting history.

**User stories**

- As a trader, I would like to organize trades with tags and Idea Sources, so that
  I can find related decisions and compare them later.
- As a trader, I would like to rename or retire references while retaining their
  identity, so that I can keep selectors relevant without breaking historical records.

**Introduces:** Catalog save/query/resolve maintenance variants, Tag Type/Value
creation, plan/tag associations, active/new versus retained/historical resolution,
distinguishable selector labels and supported identity-based browse filters.
Account parent and Strategy shape remain immutable; changed shapes need new identity.
Protected reason seeds remain selectable; supported Strategies remain retireable.

**Defaults and durability:** Add the one empty IdeaSource Tag Type, with no seed
Values. Add trader-defined tags, reference label/availability revision history,
semantic role/parent bindings and trade-tag/Plan IdeaSource associations/indexes.
Creating new instrument-role Strategy shapes waits for D28.

**Acceptance:** Full AC-REF-002; partial AC-REF-001; inherited obligations.
**Declared scope:** Maintain installed stock/single-leg/multi-leg/reference shapes.
D27 completes Catalog defaults when Rolled arrives; D28 adds typed Strategy creation
without changing the eleven already-delivered default Strategies.

**Prerequisites / parallelism:** D19. Catalog resolution/index work and settings/
picker/list UI can proceed in parallel once contracts are fixed. Catalog schema,
seed manifest and browse-filter inputs have single owners.

### 21. See portfolio current exposure with honest coverage

**Capability:** Run the complete Current Exposure metric family for installed
stock/single-leg/multi-leg positions and navigate the actual contributors/exclusions.

**User stories**

- As a trader, I would like to see portfolio exposure and its coverage, so that I
  can distinguish known totals from missing prices or unbounded risk.

**Introduces:** `PerformanceAnalysis.exposure`, `runReport`, coherent exhausted
population reads, one derivation per Trade, full metric bases, covered finite
subtotals, named Unbounded/unavailable cohorts, independent realized/open/combined
P&L and a ratio only for exact like-covered finite contributors. No Report Period
is offered. Add the already meaningful account/institution/strategy/underlying/tag/
IdeaSource/scaling filters and permitted single breakdowns; never average ratios.
Use existing trade facts and Journal definitions; form customization is not a prerequisite.

**Defaults and durability:** None. Snapshot-bound report results/cursors are private
view state, not facts. Add only required rebuildable population indexes. Full
Exposures are not accumulated by ignoring pages or dropping unavailable Trades.

**Acceptance:** Full AC-RPT-003, AC-RPT-006; inherited obligations. Entire
Exposure family and canonical filter/breakdown dimensions cover installed stock,
single-leg and multi-leg positions, including PMCC and settlement-created short/
unplanned exposure. D28 later adds selectable trader-defined shapes through the
same stable-identity grouping; no future strategy values or phantom groups appear.

**Prerequisites / parallelism:** D20. Pure exposure/population assembly and report/
contributor UI can proceed in parallel after the result contract is fixed. Shared
`runReport`, population bindings, and report navigation have one owner.

### 22. Compare realized outcomes over fixed reporting periods

**Capability:** Run the complete Outcomes family, including Closed results and
economic-time dollar realization from both Open and Closed Trades.

**User stories**

- As a trader, I would like to compare outcomes over the fixed reporting periods,
  so that I can understand realized performance without mixing populations.
- As a trader, I would like to inspect each metric's contributors and exclusions,
  so that I can understand fees, Plan-R eligibility, and correction sensitivity.

**Introduces:** `PerformanceAnalysis.outcomes`; all specified headline/distribution/
mean/median/R/Profit Factor metrics; cumulative dollars and terminal Closed-R
curves. All Time/YTD/QTD/MTD/This Week/Last Week use inclusive Workspace calendar
dates and echo exact bounds. Add `Workspace.saveSettings` for deliberate timezone
changes, with revision-bound period recalculation. Exact signs define win/loss/
breakeven; no-loss Profit Factor is Unavailable and loss/no-gain is zero. Corrections
appear at economic times; partially realized Open Trades do not become Closed counts.
Use existing trade facts and Journal definitions; form customization follows in D23.

**Defaults and durability:** No new report facts/defaults. Version settings revisions
and add only required realization/terminal-date private indexes. Existing facts
already contain fees, 1R, realization links, and audit time.

**Acceptance:** Full AC-RPT-001–002, AC-RPT-006; inherited obligations. Complete
Outcomes covers installed stock/single-leg/multi-leg and planned/unplanned settlement
populations. Later Roll and trader-defined shapes extend the same family and identity
breakdowns rather than add alternate report arithmetic.

**Prerequisites / parallelism:** D21. Outcomes/period/population work and result/
curve UI can proceed in parallel after contracts are fixed. `runReport`, period
resolution and realization indexes require serialized ownership.

### 23. Customize future Journal forms

**Capability:** Revise prompts/options/order/requiredness for the fixed Entry Types
and use the result in subsequent real capture while historical Entries/Debt keep
their original definitions.

**User stories**

- As a trader, I would like to customize future reflection forms, so that I can
  ask useful questions without changing the questions I previously answered.
- As a trader, I would like to add bounded categorical, numeric, date, and tag
  prompts, so that I can capture structured observations in the same workflows.

**Introduces:** `getDefinitions/reviseDefinition`, the configuration UI and runtime
support for Text, Single Select, Scale, Number, Date, zero-or-one bound Tag Select,
RequireWhenOption and AllOrNone. Enforce protected workflow semantic roles and at
most one IdeaSource prompt per type. No arbitrary rule engine or new Entry Types.
Tag-backed form answers use real Catalog identities; due answers use trigger forms.

**Defaults and durability:** No defaults changed or reset. Add immutable definition
revisions, stable prompt/option identities, conditional rules and Tag bindings;
later answers snapshot the displayed definition. Retired options remain historical.

**Acceptance:** Full AC-JOUR-004, AC-JOUR-007; inherited obligations, including
non-overwriting/idempotent seeding after customization.

**Prerequisites / parallelism:** D22. Definition validation/save and editor/runtime
form UI can proceed in parallel after contracts are fixed. Definition schema,
semantic-role rules, and Journal save validation have one owner.

### 24. Review trading process without a composite grade

**Capability:** Run every Process Scorecard family for installed stock/single-leg/
multi-leg Trades after ordinary trading, management and correction are usable,
with natural dates, opportunities, zero-event populations, and evidence coverage.

**User stories**

- As a trader, I would like to inspect my planning, entry, management, deviations,
  and reflection patterns, so that I can review process without an automated grade.

**Introduces:** `PerformanceAnalysis.scorecard`; Plan partitions, Entry Quality,
four separate Deviation categories, management distribution including zeros,
Stop/Target episodes/maximum Overrun, reflection outcomes, option-timing applicability,
and correction sensitivity. Every section is present with its specified natural
date/denominator. Option timing uses installed settlement/disposal facts and
remains Not Applicable to non-option Trades.
Gaps cannot establish a zero episode count and continuous episodes count once.

**Defaults and durability:** No new facts/defaults. Add only necessary rebuildable
opportunity indexes; no stored grade, inferred behavior, or synthesized reflection.

**Acceptance:** Full AC-RPT-006; partial AC-RPT-004; inherited obligations.
**Declared scope:** Complete scorecard family for installed stock/single-leg/multi-leg
positions, including PMCC and settlement. D26 adds objective-selection verification
inputs; D27 completes the linked Roll/reflection/correction fixture for AC-RPT-004.
Missing historical evidence stays disclosed rather than reconstructed as behavior.

**Prerequisites / parallelism:** D23. Pure scorecard/population work and section/
metric-basis UI can proceed in parallel after contracts are fixed. `runReport`,
shared opportunity derivation and population queries have one owner.

### 25. Report a categorical Journal field

**Capability:** Select a fixed Entry Type and field, compare stable categorical
responses and obligation outcomes, and navigate the exact Entries/Trades.

**User stories**

- As a trader, I would like to compare categorical reflection answers, so that I
  can examine patterns while retaining definition and outcome context.

**Introduces:** `PerformanceAnalysis.journalField`; Single Select/Scale/Tag Select
grouping by stable identity, one effective Entry per identity, distinct optional
blank/Due/Declined/Retired/Voided Entry/Voided origin outcomes, and definition-version
disclosure. Text/Number/Date are explicitly inapplicable to categorical grouping.
Trade filters exclude standalone Entries; no invented Trade dimensions, nested
breakdowns, or causal P&L claims.

**Defaults and durability:** None. Existing definition/Entry/outcome/Anchor histories
supply the report; add only required private query indexes, never report facts.

**Acceptance:** Full AC-RPT-005–006; inherited obligations. The categorical
family uses all installed stock/single-leg/multi-leg Trade filter dimensions; later
trader-defined shapes use the same stable-identity selectors and grouping semantics.

**Prerequisites / parallelism:** D24. Journal population/pure field analysis and
selector/report UI can proceed in parallel after contracts are fixed. Shared
`runReport`, Journal queries and report selectors have one owner.

### 26. Plan with objective selection criteria before choosing contracts

**Capability:** Confirm complete objective Planned-Leg selectors with a numeric
baseline, then associate actual contracts and inspect fulfillment provenance.

**User stories**

- As a trader, I would like to plan a leg using complete objective criteria before
  selecting its exact contract, so that I can preserve what I intended to select.
- As a trader, I would like to see Not Verifiable when required selection evidence
  is missing, so that I can distinguish uncertainty from a real deviation.

**Introduces:** Objective-selector variants in `assessPlan/confirmPlan` and
fulfillment/`assessChange`, complete criterion validation, numeric intended-entry
basis and immutable actual-selection provenance. Manual evidence is sufficient
where the contract allows it; no option scanner or automatic picker is introduced.
All mismatched terms for one served leg form one occurrence; missing evidence
creates neither assumed conformance nor a fabricated Deviation.

**Defaults and durability:** No new defaults. Add criterion/baseline snapshots,
exact selected-contract associations and required observation provenance to facts,
with Restore validation and preserved historical verification coverage.

**Acceptance:** Full AC-POS-005; partial AC-PLAN-001–002;
inherited obligations. **Declared scope:** Objective selectors for installed shapes;
D28 completes Plan validation with trader-defined typed shapes; PMCC and the other
seeded multi-leg shapes are already supported.

**Prerequisites / parallelism:** D25. Criteria/provenance/assessment and selector/
fulfillment UI can proceed in parallel after contracts are fixed. Plan fact schema
and shared `assessPlan/assessChange` each have one owner.

### 27. Roll selected exposure into a successor plan

**Capability:** Roll part or all of a position with a complete successor Plan,
retaining ownership, predecessor remainder, typed lineage and both decisions.

**User stories**

- As a trader, I would like to roll selected quantity into a successor plan, so
  that I can retain the predecessor's remaining holdings and the new trade's baseline.
- As a trader, I would like to correct a linked Roll atomically, so that I can
  repair both trades without leaving ownership or reflection history inconsistent.

**Introduces:** Roll member variant of `recordPositionChange`, predecessor reduction,
successor confirmation/opening, required successor Plan Reflection and one originating
Position Change Reflection. Partial predecessor stays Open; terminal Roll explicitly
requires Rolled. No separate Roll API or generic close-then-create orchestration in
React. Linked preview/correction binds every Trade and Journal participant and can
reopen a Trade only through coherent corrected facts. Extend Review/replay/reports.

**Defaults and durability:** Add protected Rolled Close Reason when Roll is installed.
Persist successor ownership/Plan, typed Roll lineage and atomic linked correction
history with required reflection outcomes; no fills move silently between Trades.

**Acceptance:** Full AC-POS-003, AC-CORR-001–005, AC-REF-001, AC-RPT-004;
inherited obligations. Rolls cover all installed seeded shapes, including PMCC.
Adding Rolled completes the Catalog default manifest; the linked histories also
complete the planned Process Scorecard fixture. D28 adds trader-defined shapes
without changing seeded Roll semantics.

**Prerequisites / parallelism:** D26. Multi-Trade candidate/commit and Roll/footprint/
lineage UI can proceed in parallel after contracts are fixed. Linked Trade/Journal
transactions, lineage schema, correction analysis and reason seeds serialize.

### 28. Maintain trader-defined typed Strategy shapes

**Capability:** Create, rename and permissibly retire trader-defined shapes using
the supported Stock/Call/Put role and constraint vocabulary, then use those shapes
through the existing planning, trading, review and analysis workflows.

**User stories**

- As a trader, I would like to create typed Strategy shapes with new identities,
  so that I can name supported structures without changing historical shapes.

**Introduces:** Full typed Strategy creation and selection, immutable shape identity,
relative quantities and supported underlying/expiry/strike/share constraints. Changed
shapes receive new identities; renaming never rewrites historical membership.
Use existing pure analysis/workflows for these shapes and preserve all prior
single-leg, co-expiry and mixed-expiry semantics. No generic Custom seed, strategy
framework, new pricing model or late PMCC trading implementation is needed.

**Defaults and durability:** No default additions. All eleven canonical Strategies
already arrived with D1, D7–D8 and D15; all exact reason/default policies are complete
at D27. Persist new trader-defined identities/shapes and their label/availability
history with compatible migration, backup/Restore and analytical validation.

**Acceptance:** Full AC-PLAN-001–002, AC-REF-002, AC-REBUILD-001, AC-PERF-001;
inherited obligations. Complete the remaining Plan/typed-shape variants and mature
mixed-fact reconstruction/latency fixtures across all installed workflows, reports
and provider evidence. PMCC trading and mixed-expiry payoff semantics were delivered
in D8, not deferred to this configuration feature.

**Prerequisites / parallelism:** D27. Shape validation/persistence and Strategy
editor/selection UI can proceed in parallel once contracts are fixed. Catalog shape
schema, new-selection resolution and shared analytical input semantics each have a
single owner; this slice adds no final seeded Strategy.

## Parallel work and shared ownership

Within each item, its listed domain/persistence and UI tracks may overlap after the
public request/result contract and durable representation are fixed. An integrated
owner joins them into the actual production workflow; neither track is a release.

No entire pair of numbered deliverables is currently declared safe to execute
concurrently. Each adds or extends shared release metadata, and many also change
schemas or shared analysis/coordinator operations. Merely using different screens
does not establish independence. A later task breakdown may identify genuinely
disjoint work after shared changes are serialized; this draft grants no blanket
parallel scheduling across deliverables.

| Shared resource | Single-owner responsibility |
|---|---|
| IndexedDB durable schema/version and Workspace candidate migration/Restore | Coordinate representation changes, artifact compatibility and atomic activation |
| Seed/default manifest and stable product keys | Add the current slice's supported defaults without resets or collisions |
| Installed Capability Manifest | Publish exactly the complete current variants and their dependency closure |
| Navigation shell, responsive route state and shared selectors | Integrate current capabilities without exposing future values |
| Web App Manifest, service worker and Offline Release Inventory | Preserve identity, complete assets, safe activation and functional readiness |
| Persistence/Transaction and readiness gate | Maintain all-or-nothing semantics and rejection of every authoritative write outside Writable |
| Trade Analysis operations and financial allocation policy | Prevent divergent calculations and coordinate new instrument/evidence semantics |
| Trade Workflows correction/linked commit and Daily Review save | Preserve participant bindings, agreement reconciliation and directly usable receipts |
| `runReport`, population queries and each shared Performance Analysis operation | Preserve complete cohorts, metric bases, paging and common filtering semantics |

## Items to resolve before the detailed plan is frozen

The D1 versus D2 boundary, approved stack, signature-feature priority and D7/D15
split without cash-settlement eligibility enforcement remain accepted. D4 adds
voluntary Journal creation with the first Daily Review; D19 adds Edit/Addendum/Void.
D5 delivers full stock closure; D6 then provides complete export/verification of
all populated data categories, including closing facts and Close Review history;
Restore is its own D17 after core trading/management and before correction D18.
Separate scaling-in/out D10–D11 and legging-in/out D12–D13 precede corrections.
Abandon D9 and Replay D14 precede Assignment/Exercise D15, which may still be
expedited if an actual event requires it. Later settlement, management, Restore
and corrections preserve/extend existing replay when introduced. Current Exposure
D21 and Outcomes D22 precede Journal customization D23; multi-leg trading D8
precedes Process Scorecard D24 and Journal Field D25. Continue review one
consequential decision at a time. Provider selection is required before D7 is frozen.
Accepted choices are recorded and edited into this document.

The detailed plan must also settle dependency versions, decimal precision and exact
fee conservation, calendar provenance/coverage, capacity/headroom estimates,
browser evidence environments, and candidate activation mechanics. These are
implementation decisions within the approved semantics, not new foundation slices.
If any requires a product scope change or irrecoverable historical coverage limit,
surface it explicitly before approval. No such exception is approved here.
