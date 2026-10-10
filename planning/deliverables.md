# Vertical deliverable partition

Status: the user accepted the revised partition on 2026-10-10 and chose manual evidence in deliverable 2, with provider recovery introduced in deliverable 3. Detailed scope, tasks, evidence, and the complete implementation plan still require review.

Baseline: canonical `specs/` at Git revision `968bc2b`. Selected stack: profile A, recorded in [stack-selection.md](stack-selection.md).

Detailed tasks, unit cases, acceptance flows, shared evidence procedures, and canonical traceability for D1–D3 are drafted in [task-breakdown-d1-d3.md](task-breakdown-d1-d3.md).

## Recorded partitioning direction

The user requested a progression through trading journeys: stock-only Plan + Journal + opening Trade first; stock closing + Daily Review next; single-option positions next; then multi-leg positions. This replaces the previous partition around separate Workspace, Journal, planning, execution, valuation, and review feature packages.

Enabling work belongs inside the first trading journey that needs it. The first release therefore opens a real Stock Trade and includes its required Workspace, PWA, persistence, and backup safety tasks. There is no separate foundation-only or Journal-only release before that journey.

The scope below is cumulative. The first multi-leg increment is deliberately a two-leg vertical spread; four-leg, stock-plus-option, and mixed-expiration structures follow separately. Scaling, Rolls, and Trade corrections also expand by instrument scope instead of arriving as one package for every instrument.

The list contains 20 deliverables. Provider work is included in deliverable 3; the former separate final provider deliverable has been removed. Deliverables 1–20 retain their numbering.

## 1. Confirm a stock-only Plan and open the Trade

**User journey:** set up the Workspace and brokerage Account, confirm a single-Instrument Stock Plan, record its first opening decision, and inspect the saved Trade and Journal evidence.

- Stock-only typed Strategy; the seeded Long Stock Strategy provides the initial reference flow. No option planning or execution is advertised.
- Intended entry, quantity, original Stops/Targets, Thesis/Invalidation, tags, Plan Idea Source, and a positive frozen Plan Baseline/1R.
- Atomic Plan confirmation with its completed Plan Reflection; browse the Planned Trade and abandon an unentered Plan with a reason.
- One opening Position Change, including any broker partial fills belonging to that same decision, exact fees, Planned-Leg intent, fulfillment/entry evidence, open Lots, and atomic `Planned` → `Open` lifecycle/index changes.
- One Position Change Reflection outcome: complete, explicit decline, or deferred Debt with the trigger-time form. Show saved writing/history and support permitted Journal-only Debt resolution.
- Opening scope is explicit: subsequent independent entries, partial exits, and final exits arrive in their consuming deliverables. Original decision grouping and evidence are already retained.

**Enabling tasks inside this deliverable:** responsive/accessibility shell; time zone and real Institution/Account onboarding; canonical Catalog/Journal defaults; PWA identity and HTTPS delivery; complete verified offline inventory; stopped-app offline restart; all four Runtime Readiness checks and persistence write gating; advisory storage-protection warning; safe updates; coherent backup download and selected-file verification; validated atomic replace-only Restore for the installed scope. Capacity/headroom is derived here, including the planned mature data and temporary backup/migration requirements.

**Production flow:** first launch → New Stock Plan → Confirm → Record Opening → Trade Detail / Journal.

## 2. Review and close that Stock Trade

**User journey:** manually supply the stock's closing evidence, save the dated Daily Review Action, record a full closing decision, and inspect the completed Trade.

- Stock Manual Marks, exact completed-session dates, unavailable acknowledgments, observation history, and evidence corrections/impact preview.
- Provider retrieval is not installed in this deliverable. Recovery returns Manual-resolution tasks with safe NotConfigured context; the stock workflow has no provider dependency.
- Stock valuation, current risk/reward, Stop/Target status, Overrun, and honest independent calculation coverage.
- Stock Management Revisions with completed rationale/reflection, effective-time history, and preservation of the original Plan Baseline.
- Stock-only Daily Review: exact-date corrected eligibility, Missing Mark and global due-Debt tasks, transparent attention order, explicit Action Save, and atomic Stop-Discipline reconciliation.
- Hold is unsaved until Save; Exit/Roll/Adjust are intent only. Resume from facts after restart; completion remains honest and reversible.
- A full closing Position Change with FIFO matching, exact opening/disposal fees, final P&L/R availability, `Closed` lifecycle, Terminal Disposition, active Close Reason, and distinct Position Change Reflection/Close Review outcomes.
- A closed Stock Trade still appears in an earlier Review when it was Open at that session cutoff. Stock-only payoff is correctly Not Applicable.

**Production flow:** Open Stock Trade → Manual closing Marks → Daily Review → Record Full Exit → Closed Trade Detail / Close Review.

## 3. Plan, open, review, and dispose of a single option

**User journey:** perform the same complete loop for one exact Call or Put Instrument, configure provider recovery with Manual fallback, and record factual settlement when it expires or is exercised/assigned.

- Single-option Strategy/Plan, contract identity and multiplier, exact or objective selection evidence, Exercise Intent where applicable, and frozen risk/1R.
- One opening decision and full ordinary exit; exact premium/fees/P&L, contract conformance, relevant option conditions, and independent Planned/Current Expiration Payoff.
- Exact option/Underlying observation requirements, Manual evidence, management, Journal outcomes, and Daily Review extend to this instrument scope.
- Introduce one selected pricing-provider adapter for Stock/Underlying and exact option-contract closing observations, plus available Daily Bars. Verify instrument coverage, completed-session/date semantics, CORS, credential handling, and cost before declaring its supported scope.
- Disabled/Enabled/Needs Setup configuration, protected write-only credentials, bounded relevance-based recovery, valid partial-response ingestion, sticky Manual precedence, and safe transient diagnostics. Failed or unsupported observations remain Manual-resolution work and create no acknowledgment or Journal/provider-performance fact.
- Provider use remains optional for the trader; all Manual workflows remain usable offline. Credentials are excluded from backups, diagnostics, logs, and returned views; backups also exclude raw provider payloads and transient diagnostics. Restored configuration requires setup when its adapter or credentials are absent.
- Explicit Expiration, cash settlement, Exercise, or Assignment; no calendar-created settlement or zero-price Execution.
- Physical settlement explicitly allocates to compatible Stock Trades and creates only residual successors, with correct premium/basis/proceeds once, typed lineage, and complete management or routed Management Debt.
- Settlement routes are included here because an expired option must have a factual outcome before its Daily Review can complete.
- Additional independent entries and deliberate partial exits remain the later single-option scaling increment.

**Production flow:** provider settings → New Single-Option Plan → Opening → Provider recovery or Manual Marks / Review → Full Exit or Settlement → resulting option/Stock detail. Existing Stock Reviews can use the newly installed provider too; configuration is optional.

## 4. Trade and review a two-leg vertical spread

**User journey:** confirm, open, review, and dispose of one co-expiring two-leg Call or Put vertical.

- The four seeded debit/credit vertical shapes, ordered strikes, directions/ratios, and coherent planned baseline.
- One grouped opening decision with separately owned leg Executions and exactly one Position Change Reflection.
- Per-leg fulfillment/fees and exact observation coverage; whole-structure valuation, conditions, risk/reward, and payoff.
- Extend the provider recovery requirements to every required leg and Underlying in bounded batches, retaining Manual precedence and partial-coverage disclosures.
- Full ordinary exit or explicit leg settlement, including resulting Stock allocation, management, Journal consequences, and coherent remaining exposure.
- Daily Review operates on the spread as one Trade; a missing leg Mark does not hide known realized results or unaffected calculations.

**Production flow:** New Vertical Plan → Grouped Opening → Spread Detail / Review → Grouped Exit or Leg Settlement.

## 5. Trade and review a four-leg Iron Condor

**User journey:** repeat the established option loop with the four ordered Iron Condor roles.

Add grouped four-leg entry/exit and settlement, asymmetric wing-width support, exact ratio/conformance checks, per-leg coverage, piecewise payoff, and the same Journal/Review/Stock-allocation guarantees. This does not invent a separate four-leg journal or arithmetic system.

## 6. Trade and review a Covered Call

**User journey:** manage one planned Stock-plus-Call Trade.

Add share-coverage validation, mixed Stock/option valuation and payoff, grouped decisions, partial leg disposition/settlement, and ownership/basis/management consequences. The Trade stays distinct from its independently derived Instrument Positions.

## 7. Trade and review a PMCC and other supported typed shapes

**User journey:** use the mixed-expiration PMCC shape and configure other valid typed Strategies within the installed instrument scope.

Add expiration ordering, separate contract/session requirements, and disposition of the nearer-expiration leg while remaining exposure stays coherent. Multiple expirations produce the specified honest payoff Unavailable state rather than a fabricated one-date curve. Custom shapes are validated by structural meaning, not their label; no generic Custom seed is added. The detailed plan will split any additional shape variant needing a distinct economic workflow into its own deliverable.

## 8. Scale a Stock Trade in and out

**User journey:** make additional stock entry decisions, close only some shares, then dispose of the remainder.

Add multiple opening Lots, FIFO across different prices/fees, exact partial fee realization, remaining basis, partial/final exits, Entry Resolution/Quality, decision-level scaling classification, and one reflection outcome per decision. Stock Review and history remain coherent throughout.

## 9. Scale a single-option Trade in and out

**User journey:** add contracts or close only part of a single-option position.

Extend the established scaling workflow to option quantities, contract terms, retained entry evidence, premium/fee allocation, remaining payoff, and partial settlement/disposition. Keep baseline, lifecycle, Journal outcomes, and Review coherent.

## 10. Scale a multi-leg Trade in and out

**User journey:** adjust selected quantities of an installed multi-leg structure.

Add grouped partial changes, temporarily unequal leg fulfillment/exposure, exact per-leg FIFO/fees and conformance, changed valuation/payoff, and remaining settlement requirements. Preserve decision identity and one originating reflection instead of counting each fill as a separate decision.

## 11. Roll a single-option Trade

**User journey:** close selected predecessor contracts and open a successor under its own confirmed Plan.

Include partial and complete Rolls, successor Plan Reflection/baseline, exclusive Execution ownership, untouched predecessor exposure, typed lineage, one originating Position Change Reflection, and predecessor Close Review/`Rolled` reason where applicable. Commit every linked effect together.

## 12. Roll a multi-leg Trade

**User journey:** roll selected installed structure exposure into a successor.

Extend Roll input, assessment, grouped ownership, remaining-leg analysis, settlement relationships, and Journal/Review consequences to multiple legs. The existing single-option Roll remains protected by cumulative tests.

## 13. Correct and replay Stock history

**User journey:** preview a Stock fact correction, commit it, and inspect its corrected economics alongside saved audit history.

Provide Replace, reasoned Void, and Rebuild; stable Trade/fact/Journal Anchor rules; exact lifecycle/FIFO/fee/P&L/Deviation/Debt reconciliation; impact acknowledgment and stale-binding rejection. Replay the automatic Stock lifetime with markers, exact evidence, explicit gaps, and audit navigation. A correction may restate an earlier Review.

## 14. Correct and replay single-option history

**User journey:** correct an option fact or its linked physical-settlement allocation.

Extend previews, atomic corrections, basis/premium reconciliation, historical anchors, payoff/replay, and corrected Review eligibility to the option and every affected Stock Trade. Stock-only correction behavior remains covered.

## 15. Correct and replay multi-leg and Roll history

**User journey:** repair a grouped option decision, settlement, or predecessor/successor Roll.

Validate and reconcile all linked ownership, quantities, baseline associations, allocations, lifecycle, lots, Deviations, Journal obligations, and historical Anchors in one atomic correction. Keep one corrected economic history and visible prior versions.

## 16. Customize forms and amend journal writing

**User journey:** revise a future form, answer an older Debt using its retained form, and amend saved writing without rewriting Trade facts.

Expose supported prompt kinds, stable prompt/option identities, bounded conditional rules, workflow-role protections, and prospective definition revisions. Add direct voluntary Review Notes/Trader Reflections, Journal filtering, Edit under the original definition, Addendum, visible Void/history, and reopening of Debt when its sole settlement Entry is Voided. Earlier slices already preserve the identities, snapshots, obligations, and immutable writing required here.

## 17. Inspect an Outcomes report

**User journey:** choose a named period and inspect realized results with their supporting records.

Deliver the complete Outcomes report family: metric-specific populations/dates, exact win/loss classification and fees/R, profit factor, realized curves including Open-Trade partial realization, fixed filters, one breakdown, contributor navigation, and correction/coverage disclosure.

## 18. Inspect a Current Exposure report

**User journey:** inspect remaining exposure under one coherent valuation lens.

Deliver the complete Current Exposure family: independent P&L components, risk/reward and Overrun, covered finite totals, named unbounded/unavailable contributors, like-covered ratio rules, fixed filters/breakdown, and supporting-record navigation. No Report Period applies.

## 19. Inspect a Process Scorecard

**User journey:** examine recorded Plan, entry, conformance, management, reflection, and option-disposition behavior.

Deliver the complete descriptive family with each metric's natural date, opportunity population/denominator, zero-event opportunities, continuous episodes, coverage, and contributors. Keep the four Deviation categories separate and produce no composite grade or judgment.

## 20. Explore one categorical Journal field

**User journey:** select a Single Select, Scale, or Tag Select Prompt and inspect its answer/outcome groups.

Count one current Entry identity once; retain exact definitions and stable category values; distinguish unanswered, due, declined, retired, Voided Entry/origin, and edited history. Apply the permitted period/filter rules and navigate to contributors without causal P&L claims.

## Rules applying to every deliverable

- A release advertises only its complete instrument/operation variants and report families. Canonical defaults may already exist without their corresponding trading workflows being advertised.
- Each slice includes applicable validation, typed no-write failures, semantic atomicity, revision-bound post-commit results, immutable audit, accessibility/responsiveness, durable restart, offline operation, backup/Restore round trips, and compatible updates.
- Journal writing is integrated into every trading workflow from its first appearance. Prompt snapshots, economic timing, decision grouping, conformance evidence, observation/management history, and stable identities are retained when the facts occur, not added by later reporting work.
- Reads never repair lifecycle/lot/Deviation disagreement. Authorized Trade Workflows and Daily Review reconcile within the specified transaction boundaries. Missing observations remain visible; later reports cannot invent past evidence.
- Each new fact/variant extends migration, Restore validation, reconstruction, capacity, indexes, and performance evidence in the same slice.
- Every behavior-bearing task will specify per-case TDD red/green evidence; every deliverable will have cumulative real-stack integration/failure/restart checks and a passing fresh independent browser critic.
- Scale and latency checks accompany relevant trading increments, not a final hardening package.

## Next planning work

Review the detailed D1–D3 task/test draft, then apply the same treatment to D4–D20, producing the complete task graph and stack/version mappings. The D1–D3 acceptance map has all 67 scenario rows and explicitly reserves later variants; later planning must add their concrete task/evidence specifications. Later slices must preserve earlier facts and disclose any historical evidence that was absent.

Provider sequencing is accepted: deliverable 2 is Manual-only; deliverable 3 introduces recovery for the installed Stock and single-option scope; later multi-leg slices extend observation requirements. The specific provider remains an open choice to resolve while detailing deliverable 3 and before freezing the full plan. Keep one flat numbered list and update it consistently when an ordering change is accepted.

The complete plan requires separate review and approval before implementation.
