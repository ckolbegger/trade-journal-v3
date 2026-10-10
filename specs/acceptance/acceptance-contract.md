# Trade Journal V3 acceptance contract

## Purpose

This is the implementation-stack-neutral acceptance boundary for an implementation of the frozen product and interface specifications. Standards-based PWA delivery is fixed; framework, persistence engine, internal types, storage layouts, processes, routes, cache tooling, and test tools are not prescribed. A capability conforms only when its installed behavior satisfies every applicable scenario and exposes the required audit/coverage evidence.

“Given” fixtures use authoritative domain commands or a validated restored Workspace. Test-only mutation of private projections may be used solely in scenarios that explicitly exercise reconstruction. Exact Money, Quantity, Price, Economic Time, Trading Date, and identity values must be retained in evidence even when UI screenshots round them.

## Evidence requirements

For each scenario, retain:

- installed release and Installed Capability Manifest identity;
- Web App Manifest, Offline Release Inventory, Runtime Readiness, and exact browser/operating-system evidence where delivery behavior is relevant;
- explicit clock, Workspace time zone, market-session assumptions, and input facts;
- observable request/user action and result;
- relevant pre/post authoritative revisions and stable identities;
- visible history, calculation basis, coverage, and typed failures where required;
- restart/read-back evidence when durability or nonmutation is material.

A workflow scenario needs evidence at its public boundary and durable after-state; a passing isolated formula test alone is insufficient. A no-write expectation must compare the relevant before/after authoritative state. Generated benchmark data must be deterministic and disclosed.

## Request/response mutation results

### AC-RESP-001 — accepted mutations return directly usable post-commit state

- **Given:** each installed mutating operation, including at least one creation, one update, and one bounded multi-subject workflow, with valid expected revisions and complete inputs.
- **When:** a caller invokes the operation once and it succeeds.
- **Then:** the response is bound to the committed revisions and contains generated identities, the command-specific post-commit representation of every directly changed subject, and its related outcomes and required derivations. The caller can render the successful command and continue within its owning workflow without reading back the directly changed state. The result need not embed indirectly affected lists or reports, which perform normal reads only when independently requested; no subscription or domain event is required.
- **Evidence:** one-call request/response traces for every installed mutation family, response-to-durable-state equivalence at the returned revisions, and absence of an operation-required follow-up read.

## Plan and lifecycle

### AC-PLAN-001 — confirmation freezes one complete Plan

- **Given:** a selectable Account and Strategy; complete Planned Legs using exact contracts or complete objective criteria; original Stop/Target management; one completed Plan Reflection with required Thesis/Invalidation; and a calculable positive numeric Plan Baseline.
- **When:** the trader confirms the Plan once.
- **Then:** one Trade, frozen Plan, frozen Planned Legs, frozen original management, stored `Planned` Lifecycle State, positive 1R equal to the Plan Baseline, and one completed immutable Plan Reflection are committed atomically. The Entry snapshots the exact definition shown and shares its semantic Thesis/Invalidation values with the Plan without a second entry.
- **Evidence:** mutation receipt, Trade/Entry identities, Plan and definition snapshots, lifecycle binding, and post-restart query.

### AC-PLAN-002 — incomplete confirmation writes nothing

- **Given:** the same request with no numeric baseline, incoherent Strategy shape, missing exact/objective leg evidence, or missing required reflection answer.
- **When:** confirmation is attempted.
- **Then:** all issues are returned as typed rejections and no Trade, candidate identity, Entry, Debt, or index membership exists.
- **Evidence:** result plus unchanged Trade Record, Journal, and Catalog revisions.

### AC-LIFE-001 — complete lifecycle and agreement

- **Given:** a confirmed unentered Plan, then grouped opening facts, scaling changes, and final disposing facts.
- **When:** each semantic command succeeds and the Trade is independently derived after each step.
- **Then:** stored lifecycle is respectively Planned, Open, Open, and Closed; expected lifecycle agrees at each revision; current lifecycle index membership changes in the same commit; Terminal Disposition appears only from effective disposing facts and remains separate from Close Reason.
- **Evidence:** ordered receipts, lifecycle bindings/index queries, derivations, and Trade history.

### AC-LIFE-002 — Abandonment eligibility is factual

- **Given:** one confirmed Plan with no effective Position Change and one with an effective Execution.
- **When:** each is abandoned with an active reason.
- **Then:** the first becomes Abandoned and retires applicable Plan Debt without Close Reason/Terminal Disposition; the second is rejected. If its Execution is visibly Voided first, eligibility is rederived rather than inferred from prior existence.
- **Evidence:** effective fact history, result, Debt effects, and lifecycle agreement.

### AC-LIFE-003 — disagreement cannot pass as Ready

- **Given:** stored Lifecycle State or active Lot Match/Deviation agreement intentionally differs from effective facts in a controlled integrity fixture.
- **When:** the Trade is read normally and when a mutation/Restore is prepared.
- **Then:** normal reads surface or block on the structured disagreement, no read repairs it, and the authorized preparation either derives a disclosed repair for coherent facts or rejects incoherent facts.
- **Evidence:** before disagreement, read result, preparation result, and absence of read-time write.

## Position Changes, settlement, and Rolls

### AC-POS-001 — stock scaling and FIFO fee allocation

- **Given:** a Stock Trade with two opening Executions at different prices/fees followed by partial and final closing Executions.
- **When:** each decision-level Position Change is recorded.
- **Then:** each fill belongs to one Trade; Position and open Lots are correct; FIFO Lot Matches link exact quantities; opening/disposal fees are allocated exactly once; partial realization leaves the Trade Open; final flat exposure closes it; no price or P&L is duplicated onto a Lot Match.
- **Evidence:** facts, lots/links, fee reconciliation, exact P&L, lifecycle transitions, and histories.

### AC-POS-002 — multi-leg option decision remains one Position Change

- **Given:** an option Strategy with several Planned Legs and several fills made as one decision.
- **When:** the Position Change is recorded with one reflection disposition.
- **Then:** all submitted members share one decision identity and stable order, each Execution retains its own identity/Trade ownership, conformance is assessed against Planned Legs, and exactly one Position Change Reflection outcome is recorded.
- **Evidence:** Position Change membership, Execution identities, derivation, and Journal obligation key.

### AC-POS-003 — partial Roll preserves ownership and lineage

- **Given:** an Open predecessor with more quantity than will be rolled and a complete successor Plan.
- **When:** one Roll Position Change closes only selected predecessor quantity and opens the successor.
- **Then:** untouched predecessor holdings remain in the predecessor; new Executions belong only to the successor; typed predecessor/successor lineage, successor frozen baseline, required Plan Reflection, and one originating-Trade Position Change Reflection commit atomically.
- **Evidence:** both Trade histories, ownership, remaining Positions, lineage, Journal outcomes, and one receipt.

### AC-SET-001 — Assignment/Exercise allocation and basis

- **Given:** physical option settlement that produces Stock exposure, one compatible existing Stock Trade, and quantity exceeding or differing from the chosen allocation.
- **When:** the trader explicitly records Assignment or Exercise, Settlement Price, and allocation.
- **Then:** specified quantity updates the existing Stock Trade; only residual exposure creates a successor; all linked Trades update atomically; Settlement Price remains separate from adjusted basis/proceeds; option premium is reflected exactly once; settlement is not a zero-price Execution.
- **Evidence:** settlement/allocation facts, linked Trade identities, basis/proceeds calculation, P&L reconciliation, and atomic receipt.

### AC-SET-002 — allocation is never guessed

- **Given:** a settlement could apply to several eligible Stock Trades and no destination allocation is supplied.
- **When:** recording is attempted.
- **Then:** bounded eligible stable identities are returned as Needs Resolution and no Trade, settlement, Entry, Debt, lifecycle, or lineage write occurs.
- **Evidence:** result and unchanged affected-module revisions.

### AC-SET-003 — Expiration is explicit

- **Given:** an option contract whose expiration date has passed but no settlement outcome exists.
- **When:** Trade Detail and Daily Review are opened.
- **Then:** no Expiration fact or Closed lifecycle is inferred; Settlement Due is shown and Review remains incomplete. Only an explicit Expiration/Assignment/Exercise/cash-settlement Position Change changes the facts.
- **Evidence:** before/after facts, Review blocker, and explicit settlement receipt.

### AC-POS-004 — terminal agency requires one Close Reason

- **Given:** one terminal trader-directed exit and one terminal non-agency settlement.
- **When:** each Position Change is recorded.
- **Then:** exactly one active Close Reason is required for the trader-directed exit; none is manufactured for non-agency settlement; both derive Terminal Disposition from actual mechanisms; Close Review completion/decline/deferral never blocks closure.
- **Evidence:** command validation, facts, Journal effects, lifecycle, and disposition.

### AC-POS-005 — Planned-Leg fulfillment is evidence-bound

- **Given:** partial fills serving one Planned Leg, a mismatched exact contract, an explicitly Unplanned hedge, an untouched leg when the entered Trade closes, and one objective selector whose required observation evidence is absent.
- **When:** fulfillment and Deviations are derived.
- **Then:** results distinguish Partially Filled, Filled With Deviation, Unplanned Exposure, Not Entered, and Not Verifiable; all mismatched terms for one served leg form one Planned-Leg Terms occurrence; mismatched terms alone never infer Unplanned intent; missing evidence creates neither assumed conformance nor Deviation.
- **Evidence:** frozen selectors/provenance, intent associations, per-leg results, and occurrence fingerprints.

### AC-SET-004 — settlement planning and later management are distinct

- **Given:** a physically settled short-option Plan, a long-option Plan with and without explicit Exercise Intent, and settlement-created unmanaged Stock exposure.
- **When:** Assignment or Exercise is recorded.
- **Then:** short-option underlying obligation is planned settlement; only explicit Exercise Intent is advance authorization for voluntary exercise; unplanned automatic exercise is still recorded truthfully with Exercise lineage; new Stock exposure atomically creates Management Debt until managed or removed; cash settlement creates no Stock successor.
- **Evidence:** Plan intent, settlement/lineage/allocation facts, successor Plan context, Debt route, and atomic receipt.

## Corrections and audit

### AC-CORR-001 — Replace preserves fact identity

- **Given:** an effective Execution with anchored Journal evidence.
- **When:** its price/quantity/time is replaced through preview and commit.
- **Then:** the same Execution identity gains an immutable version; corrected economics apply at corrected Economic Time; prior value/reason/save time remain in View history; Anchor remains attached; lifecycle, Lot Matches, fees, P&L, Deviations, and reports reconcile atomically.
- **Evidence:** preview footprint, version chain, anchor resolution, before/after calculations, and commit receipt.

### AC-CORR-002 — Void is visible and economically effective

- **Given:** an effective fact whose removal changes exposure or lifecycle.
- **When:** it is Voided with a reason.
- **Then:** identity/history remain visible while its economic effect disappears; every linked derived/Journal/Debt consequence is reconciled in one commit; no record is physically hidden or deleted.
- **Evidence:** audit/history, corrected replay, lifecycle/index, Journal narrative, and correction footprint.

### AC-CORR-003 — Rebuild keeps Trade identity and historical Anchors

- **Given:** a Trade requiring reconstruction with Journal Entries anchored to old Executions.
- **When:** Rebuild is committed.
- **Then:** Trade identity is unchanged; reconstructed facts receive new identities; superseded facts remain addressable; old Execution Anchors resolve as historical and are never silently redirected; the UI presents one corrected economic history plus visible audit.
- **Evidence:** identity comparison, old/new fact sets, anchor resolution, narrative, and replay.

### AC-CORR-004 — linked correction is all-or-nothing

- **Given:** an Assignment/Exercise/Roll correction affecting multiple Trades and capable of reopening one.
- **When:** commit encounters either a stale linked revision or a Journal participant rejection.
- **Then:** every effect rolls back. With valid bindings, all linked facts, lifecycle/index changes, lot/deviation reconciliation, and Journal consequences commit together.
- **Evidence:** failing and successful executions with all participant revisions.

### AC-CORR-005 — preview is nonmutating and evidence-bound

- **Given:** a material fact or Mark correction.
- **When:** preview is requested and underlying evidence changes before commit.
- **Then:** preview identifies affected identities/intervals/calculations/coverage and writes nothing; stale commit is rejected with no writes; a new preview is required.
- **Evidence:** preview digest/footprint, unchanged state, changed evidence, and conflict.

## Journal and behavioral evidence

### AC-JOUR-001 — only Save captures evidence

- **Given:** a Journal or Review form.
- **When:** the trader opens it, types/selects values, resizes/navigates, and leaves without Save.
- **Then:** entered view state may be preserved during the active workflow, but no Entry, version, Action, Debt, decline, draft, or keystroke evidence is stored.
- **Evidence:** UI behavior and unchanged Journal query before/after restart.

### AC-JOUR-002 — Edit, Addendum, and Void retain distinct meanings

- **Given:** one saved Entry.
- **When:** it is Edited, receives an Addendum, and is later Voided.
- **Then:** Edit appends a version under the same identity using the original definition snapshot; Addendum is a new identity with preserved Anchor and parent link but its actual Source/time/current form; Void preserves all history and reason. View history exposes each transition.
- **Evidence:** identities, version chains, snapshots, parent/Anchor, Sources, and timeline.

### AC-JOUR-003 — Debt is not an incomplete Entry

- **Given:** a Position Change Reflection eligible for Defer.
- **When:** the trader defers.
- **Then:** the factual Position Change succeeds with one Outstanding Debt containing its trigger-time form snapshot; no blank Entry exists; due Debt blocks Review when due but never blocks later factual recording.
- **Evidence:** Trade receipt, Journal query, form snapshot, due behavior, and absence of placeholder Entry.

### AC-JOUR-004 — definition changes are prospective

- **Given:** an outstanding Debt and historical Entry under definition D1.
- **When:** prompts/options are added, reordered, revised, or retired in D2 and the Debt is later answered.
- **Then:** new forms use D2; existing Entry and Debt retain D1 labels/order/options; Debt answer is validated/stored against D1; fixed Entry Type identity does not change.
- **Evidence:** both definitions and resulting Entry/Debt snapshots.

### AC-JOUR-005 — one obligation has one explicit outcome

- **Given:** retry/concurrency around the same required reflection key.
- **When:** completion, decline, or deferral is submitted more than once.
- **Then:** exactly one current completed Entry, explicit decline, Outstanding Debt, or valid retirement exists; retries cannot duplicate outcomes. Voiding the sole Debt-settlement Entry atomically reopens the original Debt.
- **Evidence:** obligation-key query, conflicts, version history, and reopen result.

### AC-JOUR-006 — workflow-routed Debt cannot be settled with prose

- **Given:** management-coverage Debt whose resolution requires a Management Revision.
- **When:** direct Journal or Daily Review resolution is attempted.
- **Then:** it returns the exact required Trade Workflow and writes nothing. Completing that workflow commits management facts, completed Entry, and Debt settlement/retirement atomically.
- **Evidence:** no-write result and successful workflow receipt.

### AC-JOUR-007 — fixed types, runtime forms, and defaults

- **Given:** a fresh Workspace and then trader-revised forms.
- **When:** seeding is repeated.
- **Then:** the seven fixed Entry Types—Plan Reflection, Position Change Reflection, Management Revision, Close Review, Daily Trade Review, Review Note, Trader Reflection—and seven Sources exist under stable product identities; every initial Prompt, option, order, requiredness/conditional rule, scale bound, and workflow semantic role matches the Journal contract; repeat seeding is idempotent and does not overwrite revisions.
- **Evidence:** complete normalized identity/definition manifests before and after repeat seed.

## Daily Review

### AC-REV-001 — exact-date corrected eligibility

- **Given:** Trades Open at an earlier completed-session cutoff, including one later closed and one whose correction changes its earlier state.
- **When:** exact-date Review is opened before and after the correction.
- **Then:** eligibility uses Open-at-cutoff corrected facts, not current Open membership or a saved Review list; correction may restate membership and progress.
- **Evidence:** cutoff queries, Review lists/bindings, and correction history.

### AC-REV-002 — task ordering and bounded resumption

- **Given:** a missed Review with shared current Missing Marks, global due Debt, Settlement Due, and several eligible Trades.
- **When:** it opens, some tasks are resolved, the application stops, and the same exact date reopens.
- **Then:** task families appear in Mark, Debt, settlement, Trade order; shared Mark resolves once for all affected Trades; saved outcomes resume from facts; no Review Session/finish flag/placeholders exist.
- **Evidence:** ordered view, saved identities, restart result, and storage/audit inspection.

### AC-REV-003 — one-click Hold still requires Save

- **Given:** a new eligible Trade/date Action form.
- **When:** it opens and the trader either leaves or presses Save without changing preselected Hold.
- **Then:** leaving records no Action and Review remains incomplete; one Save creates exactly one Hold Daily Trade Review Entry. Exit/Roll/Adjust without Intent reject; with Intent they save intent only and create no Trade fact.
- **Evidence:** before/after Action query, validation, Entry snapshot, and unchanged Trade facts.

### AC-REV-004 — Action and Stop Deviation reconcile atomically

- **Given:** bound Review evidence that establishes one new Stop-Discipline episode.
- **When:** the Action is saved.
- **Then:** the dated Action and complete create/retain/supersede/Void Deviation reconciliation commit together; only one continuous episode is recorded; no separate explanation Debt or Entry Type appears.
- **Evidence:** evidence binding, occurrence fingerprint/history, Entry, and atomic receipt.

### AC-REV-005 — changed evidence prevents stale Save

- **Given:** an open Action form bound to a Trade revision and Market snapshot.
- **When:** a relevant Mark, Bar, acknowledgment, correction, or existing Action changes before Save.
- **Then:** Save returns changed/conflict with refreshed evidence and no Action/Deviation write.
- **Evidence:** old/new bindings and unchanged post-failure histories.

### AC-REV-006 — completion states are honest and reversible

- **Given:** every required Action/Debt/settlement/deviation task resolved, first with exact Marks and then with one explicit unavailable acknowledgment.
- **When:** completion is derived.
- **Then:** it is Complete in the first case and Complete With Unavailable Marks in the second, naming affected Instruments/Trades/calculations. A Missing current Mark stays Incomplete. Voiding an Action or correcting facts can make a past date Incomplete again without erasing history.
- **Evidence:** completion/blocker structures and histories across changes.

## Market evidence

### AC-MARK-001 — prior completed session is normal evidence

- **Given:** noon Tuesday after a normal Monday session and a Monday exact Mark.
- **When:** current valuation evidence is resolved.
- **Then:** Expected Mark Date is Monday and status is Available, not Stale. A Friday Mark would be Stale context only if Monday evidence were absent.
- **Evidence:** session resolution, Mark frame, and displayed date/status.

### AC-MARK-002 — Manual Mark is sticky

- **Given:** a provider Mark later overridden manually for the same key.
- **When:** recovery returns a different provider close and a valid Daily Bar.
- **Then:** Manual remains the effective Mark and no hidden provider Mark revision replaces it; the independent Bar may refresh; history identifies the override/correction meaning.
- **Evidence:** Mark/Bar revision chains and effective resolution.

### AC-MARK-003 — acknowledgment never becomes a price

- **Given:** a key with no exact Mark and optional older evidence.
- **When:** the trader explicitly acknowledges unavailability and later an exact Mark arrives.
- **Then:** status changes from Acknowledged Unavailable with optional Stale context to Available; calculations remain unavailable before the Mark; acknowledgment history remains; provider error alone never creates acknowledgment.
- **Evidence:** frames, calculations, history, and recovery diagnostics.

### AC-MARK-004 — series preserve gaps

- **Given:** a completed-session range with an interior missing date, close-only Mark date, and Daily Bar date.
- **When:** series/replay is requested.
- **Then:** the range includes an explicit gap, a point, and a candle respectively; no interpolation/carry-forward/fabricated candle occurs; historical gaps do not block today's Review.
- **Evidence:** returned series/coverage and rendered accessible chart/data.

### AC-MARK-005 — provider recovery is partial and nonbehavioral

- **Given:** bounded relevance requirements with Manual keys, acknowledgments, unsupported contracts, and partial provider response.
- **When:** recovery runs.
- **Then:** only valid eligible provider observations are appended; Manual keys are skipped; acknowledgments remain recoverable gaps; current Missing keys become Manual tasks; failures are transient diagnostics and create no Journal/provider-performance facts.
- **Evidence:** request bounds, response, revisions, diagnostics, and Journal invariance.

### AC-MARK-006 — Daily Bar range evidence is honest

- **Given:** a long single-Instrument condition, a short single-Instrument condition, and a multi-Instrument structure with Bars whose intraday extrema occur at different times.
- **When:** trailing Stop/Target history is evaluated.
- **Then:** the long uses each available same-date high, the short uses each available same-date low, and the multi-Instrument structure uses synchronized same-date exact Marks rather than combining independent extrema; exact Mark is the close-only fallback and a gap proves no breach, recovery, or new extreme.
- **Evidence:** input frames, per-date evidence chosen, condition episodes, and coverage.

## Risk, valuation, and payoff

### AC-CALC-001 — frozen baseline and Entry Quality

- **Given:** a confirmed Plan with baseline $500, then scaled actual entry and later Management Revisions.
- **When:** Plan/entry/current analysis is repeated.
- **Then:** 1R remains $500; Entry Quality resolves once at its Entry Resolution Point against frozen intended entry and is not rewritten by later adds/management; current risk uses remaining Position and effective management.
- **Evidence:** Plan snapshot, resolution point, Entry Quality, and before/after management results.

### AC-CALC-002 — independent calculation availability

- **Given:** an Open multi-Instrument Trade with one Missing expected Mark and known realized-to-date P&L.
- **When:** it is evaluated.
- **Then:** realized-to-date remains a Value; affected marked/risk/reward results are Unavailable with exact Instrument/date; unaffected results remain visible; no fill cost/zero/Stale substitution occurs.
- **Evidence:** result tree, coverage, and source facts.

### AC-CALC-003 — Stops, Targets, risk, reward, and Overrun

- **Given:** effective underlying-price and structure-value Stops/Targets with one crossed Stop and one reached Target.
- **When:** exact bound evidence is evaluated.
- **Then:** each condition retains independent OR status/detail; headline Ongoing Risk, Worst-Case Ongoing Risk, Incremental Reward, and valid Plan-R conversion follow the remaining Position; crossing produces disclosed Overrun; Target/revision is not classified as a Deviation.
- **Evidence:** per-condition and headline results, contributors, and Deviation set.

### AC-CALC-004 — Expiration Payoff is not valuation

- **Given:** a planned option Trade and then remaining current option exposure with realized-to-date offset.
- **When:** payoff and current Mark-to-Market are requested.
- **Then:** Planned and Current payoff curves are independent and contain all zero crossings/touches/ranges, signed extrema, and attainment sets; current includes realized offset while open. No theoretical option price is produced. Flat current exposure is Not Applicable; multiple expirations are Unavailable; stock-only without option anchor is Not Applicable.
- **Evidence:** curves/results and separately sourced current valuation.

## Deterministic reports

### AC-RPT-001 — Report Period resolution

- **Given:** a Workspace View Moment on Wednesday in a known time zone.
- **When:** each dated report uses All Time, Year to Date, Quarter to Date, Month to Date, This Week, and Last Week.
- **Then:** This Week is Monday–Wednesday and Last Week is preceding Monday–Sunday, inclusive calendar dates; holidays/weekends are not clipped; the exact dates are displayed; no user-defined range is offered. Current Exposure rejects/omits Report Period.
- **Evidence:** normalized report requests and scope echoes.

### AC-RPT-002 — Outcomes populations and arithmetic

- **Given:** Closed wins/losses/breakevens, an Open Trade with partial realization, planned/unplanned Trades, fees, and corrections.
- **When:** Outcomes runs.
- **Then:** Closed headlines use terminal date and exclude Open zero-observations; cumulative dollars include in-period Lot-Match realization from Open/Closed Trades; Closed-R includes only planned Closed Trades with valid 1R; exact sign determines classification; no-loser Profit Factor is Unavailable, while losses/no gains is zero; corrected points appear at original Economic Time.
- **Evidence:** each Metric Basis, curve points/order, contributors/exclusions, and correction disclosure.

### AC-RPT-003 — Current Exposure preserves coverage

- **Given:** Open Trades with finite, Unbounded, Missing, Acknowledged Unavailable, and Not Applicable risk/valuation components.
- **When:** Exposure runs at one coherent valuation lens.
- **Then:** finite covered subtotals remain, Unbounded contributors are named, unavailable cohorts stay separate, realized/open/combined P&L are independent, and no average of Trade ratios is used. Optional portfolio ratio appears only for exact like-covered finite cohorts.
- **Evidence:** evaluation binding, metric bases, observation coverage, and contributors.

### AC-RPT-004 — Process Scorecard uses metric-specific opportunities

- **Given:** confirmed/entered/planned/abandoned Plans; Entry Quality statuses; zero-event and event Trades; Stop/Target gaps; Journal outcomes; option disposition; and corrections.
- **When:** Scorecard runs for a bounded period.
- **Then:** each family uses its fixed natural date and denominator; zero-event overlapping opportunities count; gaps cannot prove no episode; continuous episodes count once; all four Deviation categories remain separate; reflection uses moment/origin date/current outcome; no composite grade or automated judgment appears.
- **Evidence:** per-family Metric Bases, formulas, coverage, identities, and sensitivity.

### AC-RPT-005 — categorical Journal Field uses current identity once

- **Given:** Single Select, Scale, Tag Select, Text, edited, Voided, Debt, decline, retirement, Standalone, and Trade-related Journal items.
- **When:** one field report runs.
- **Then:** supported categorical fields group by stable identity/value; one effective Entry contributes once; prior Edit versions are disclosure only; optional blank, Due, Declined, Retired, Voided Entry, and Voided origin remain distinct; Text is Not Applicable; Trade filters exclude Standalone without inventing dimensions; there is no nested breakdown or causal P&L claim.
- **Evidence:** selector, definition revisions, groups, outcome counts, and item/Trade identities.

### AC-RPT-006 — filters, grouping, labels, and completeness

- **Given:** a population spanning multiple Accounts/Institutions/Strategies/Underlyings/Tags/Idea Sources and inactive renamed references.
- **When:** filters and each permitted one-dimensional breakdown run.
- **Then:** AND-across/OR-within rules use stable identities; Institution expands through Account; Overall remains; Tag/multi-Underlying is explicitly non-additive; `Unspecified` is report-only and last; current labels organize presentation without changing membership; every page is exhausted and exact contributors navigate to records.
- **Evidence:** population binding/page proof, group membership, label lenses, and navigation.

## Reference configuration

### AC-REF-001 — exact defaults and protection

- **Given:** a fresh Workspace.
- **When:** Catalog defaults seed and the trader inspects them.
- **Then:** exactly the eleven specified Strategy seeds, five Close Reasons, five Abandonment Reasons, and one empty IdeaSource Tag Type exist with stable identities/shapes/policies; no Account, Institution, generic Custom, Other, or settlement-as-reason seed exists; Iron Condor role order is correct; Strategy seed remains retireable while protected taxonomy values/Rolled follow policy.
- **Evidence:** full seeded catalog and immutable shapes/roles/policies.

### AC-REF-002 — inactive history remains valid but new use is blocked

- **Given:** historical Trade/Journal references to a value that is later renamed and permissibly retired.
- **When:** old records render, an unchanged correction retains it, and a new selection attempts it.
- **Then:** historical/retained references remain valid with historical and current labels; new selection is rejected; no old fact or Entry is rewritten. Concurrent retirement between resolve and commit conflicts.
- **Evidence:** histories, resolution modes, display, and no-write conflict.

## Backup, Restore, and reconstruction

### AC-BACK-001 — full coherent backup, verified download, and secrets exclusion

- **Given:** a populated Workspace with corrections, Voids, definitions, Marks/Bars/acknowledgments, references, provider settings/credential, and rebuildable projections.
- **When:** a backup is exported while a concurrent later mutation occurs and the downloaded file is then selected for verification; a controlled source-read failure, a download left unverified, and verification of an unreadable, truncated, or different-artifact file are also exercised.
- **Then:** in the successful case all four authoritative sections and Workspace metadata share one snapshot; every identity/revision/history and nonsecret setting is included; the later mutation is wholly outside it; credentials/raw payloads/diagnostics/reports/cursors/private projections are absent; and Workspace Backup Manifest counts/digests/exclusions are explicit. Export alone returns Downloaded with no receipt. Only verification of a complete selected file matching the artifact digest and source binding returns Completed and a `CompletedBackupReceipt` bound to the source Workspace and full artifact digest. Every controlled failure returns Not Completed or Not Verified with no receipt or completed-backup claim.
- **Evidence:** Workspace Backup Manifest and artifact inspection, source snapshot, concurrent mutation revision, secret nonpresence check, read-back verification evidence and bound receipt, plus each Downloaded-only, Not Completed, and Not Verified result.

### AC-REST-001 — preparation validates without mutation

- **Given:** valid, malformed, digest-corrupt, unsupported-newer, and supported-older artifacts.
- **When:** Restore is prepared.
- **Then:** no live data changes; invalid candidates return aggregated safe issues; supported older data migrates in an isolated candidate; coherent derived disagreement yields disclosed repair; incoherent authoritative facts reject; no provider is contacted.
- **Evidence:** before/after Workspace binding, preview/issues, migration/repair disclosure, and provider-call evidence.

### AC-REST-002 — replace-only confirmation and safety offer

- **Given:** a valid prepared candidate and a nonempty current Workspace.
- **When:** apply is attempted without replacement confirmation, without a safety choice, with an older `CompletedBackupReceipt`, with a downloaded but unverified backup, and then with valid confirmation plus either an exact-target completed receipt or explicit decline.
- **Then:** incomplete, stale, and unverified-download attempts write nothing; only the exact-target `CompletedBackupReceipt` satisfies the accepted-backup path; the UI plainly identifies replacement and exact impact; valid apply replaces the entire Workspace, never merges or duplicates; declined safety backup requires explicit warning acknowledgment.
- **Evidence:** preview, user-visible confirmation states, conflicts, completed receipt with exact target binding, artifact digest, read-back verification evidence, unverified-download result, and record counts after apply.

### AC-REST-003 — all-section atomicity

- **Given:** a valid prepared candidate and a controlled failure in one section during apply.
- **When:** full Restore executes.
- **Then:** every staged section rolls back and prior Workspace remains intact. Without failure, all sections/settings commit under one new binding; the response supplies fresh Workspace status and landing state, and every old view/form is invalidated without an automatic read.
- **Evidence:** injected-failure run, successful one-call result, all section revisions, returned status/landing state, and an independently opened surface reading only the new binding.

### AC-REST-004 — migration failure preserves recoverability

- **Given:** an installed update with a supported older Workspace and a controlled migration validation failure.
- **When:** startup initializes.
- **Then:** partial migrated state never becomes Ready; prior data remains uncorrupted/readable by the compatible recovery path or exportable; successful retry activates atomically with migration/seed receipt.
- **Evidence:** pre/failure/retry bindings and complete histories.

### AC-REBUILD-001 — reconstruction is observationally equivalent

- **Given:** a canonical target-scale Workspace and its expected lists/details/replays/reviews/reports; then either a Restore or deliberate removal of rebuildable private indexes/projections.
- **When:** private state is reconstructed solely from authoritative facts and explicit analysis/evidence inputs.
- **Then:** stable domain identities, values, ordering, classifications, history navigation, lifecycle/lot/deviation agreement, Review completion, coverage, report groups, and contributor sets are equivalent. Newly generated opaque cache/snapshot tokens may differ.
- **Evidence:** normalized before/after comparison plus integrity verification.

## Offline, responsive, accessibility, and performance

### AC-DEL-001 — stopped application reopens offline

- **Given:** one successful online load with `Writable` Runtime Readiness, a digest-valid Offline Release Inventory, and a locally stored Workspace.
- **When:** the application/browser is fully stopped, network is disabled, and it reopens.
- **Then:** it re-establishes `Writable` without a network, reaches an interactive initial screen, and every installed Manual workflow/read/report/backup/local-Restore path works; provider recovery alone reports safe operational context; stored data remains available.
- **Evidence:** exact browser/operating-system version, network isolation, service-worker/release-inventory identity, cold restart trace, readiness evidence, representative workflow receipts, and queries.

### AC-DEL-002 — update never interrupts active work

- **Given:** an active unsaved workflow and a newer release detected/downloaded in the background.
- **When:** update becomes available.
- **Then:** the new Offline Release Inventory is complete and digest-valid before notice; current version remains safe and in control; the trader is notified; activation waits for safe reload/restart; entered state is not silently lost; and code update creates no data synchronization. Failed staging/readiness leaves the prior compatible version available. Offline device retains its installed version.
- **Evidence:** active-form state, old/new service-worker and inventory identities, staged-asset/digest evidence, notice/activation sequence, controlled staging failure, and unchanged Workspace facts.

### AC-DEL-003 — PWA identity and support are browser-neutral

- **Given:** the secure hosted application in one environment that exposes PWA installation and one that provides only ordinary browser-tab use.
- **When:** its Web App Manifest and Offline Release Inventory are inspected, installation is exercised where exposed, and both environments run the readiness gate.
- **Then:** the Web App Manifest has stable application identity, name, icons, launch URL, scope, and standalone request; the service worker binds the complete current Offline Release Inventory; installed launch uses that identity; and a browser tab may become `Writable`. Readiness depends only on functional checks. Browser name, family, operating system, user-agent identity, and absence of a vendor install prompt never decide support.
- **Evidence:** production HTTPS-origin configuration, Web App Manifest, Offline Release Inventory and asset digests, installed launch capture where exposed, browser-tab launch, exact environment provenance, and readiness-decision inputs showing no identity allowlist. Local automation may additionally use a browser-recognized secure loopback origin but cannot substitute it for production HTTPS evidence.

### AC-DEL-004 — Runtime Readiness gates every write

- **Given:** a fresh environment with all readiness checks passing; the same environment with host storage protection unconfirmed; separate controlled cases for failed diagnostic transaction, insufficient plan-derived capacity/headroom, missing service-worker control, and incomplete or digest-invalid Offline Release Inventory; and a case with at least two failures at once.
- **When:** the application launches, optionally requests stronger durability through an explicit user action, and Workspace initialization or another mutation is attempted.
- **Then:** only the all-pass cases become `Writable`; with unconfirmed storage protection the application is `Writable`, accepts writes, keeps the not-protected warning visible, and offers the durability request where the host supports it. Each failed check produces `Unsupported` with all known reasons, safe retry actions where meaningful, and a recommendation to try another browser; the simultaneous-failure case reports every known failed check rather than stopping at the first. It creates no Workspace, imports no data, and returns the `RuntimeNotWritable` branch from initialization, every other authoritative domain/configuration mutation, and Restore application. The diagnostic transaction leaves no authoritative fact.
- **Evidence:** per-check pass/failure matrix including the simultaneous-failure result, the unconfirmed-protection warning and accepted write, disclosed capacity derivation using mature data plus migration/backup headroom, readiness result, unchanged authoritative revisions, absence of initialized/imported data, and `RuntimeNotWritable` receipts from UI and persistence boundaries.

### AC-DEL-005 — failed readiness preserves read-only recovery

- **Given:** an existing Workspace that remains readable while each readiness condition is made to fail independently; a separate known existing store that cannot be read; and failed-export, unverified-download, and failed-verification backup cases.
- **When:** the trader opens reads/history, requests backup, attempts fresh initialization, representative domain/configuration writes, and Restore application, and considers another browser.
- **Then:** each readable case becomes `Recovery Only`; normal reads/history, backup export, and backup verification remain available; every authoritative mutation and Restore application returns `RuntimeNotWritable` with unchanged revisions. The unreadable existing store has `Unsupported` Runtime Readiness plus Integrity Blocked Workspace status: no reads, fresh initialization, overwrite, mutation, Restore application, or completed-backup claim is permitted. A failed export, an unverified download, or a failed verification produces no `CompletedBackupReceipt`. The UI explains each failure and that another browser has independent storage requiring a successfully completed backup/Restore for transfer.
- **Evidence:** readable views/history, completed receipt and read-back verification evidence, controlled store-read and verification failures, preserved unreadable-store bytes/root evidence, absence of fresh initialization/overwrite, `RuntimeNotWritable` mutation results, unchanged readable revisions, and browser-storage isolation explanation.

### AC-DEL-006 — readiness is re-established at every safety boundary

- **Given:** a `Writable` Workspace, repeated launches, an application update, a successful Restore, and a controlled storage/release-integrity failure during a running session.
- **When:** each launch or boundary completes and the next mutation is attempted.
- **Then:** readiness is freshly established on every launch and after update activation and Restore before mutations are enabled. A later failure invalidates `Writable` immediately, prevents the next mutation at the persistence boundary, and enters `Recovery Only` when existing data remains readable. No browser identity substitutes for rerunning the checks.
- **Evidence:** readiness receipts for each boundary, post-update and post-Restore release/Workspace bindings, injected runtime failure, rejected next mutation with unchanged revisions, and recovery status.

### AC-UI-001 — viewport-driven live adaptation

- **Given:** an active form/detail route in wide layout.
- **When:** viewport narrows and widens without reload.
- **Then:** layout switches between left sidebar and single-column bottom navigation at the implementation's disclosed breakpoint; route, selected record, filters, unsaved fields, validation, and actions remain equivalent and intact.
- **Evidence:** before/during/after state capture at boundary widths.

### AC-UI-002 — state, availability, and accessibility

- **Given:** representative Loading, Ready with partial availability, Empty, Error, validation, conflict, chart-gap, and destructive-Restore views.
- **When:** operated with keyboard and an accessibility-tree consumer at supported zoom/widths.
- **Then:** states are distinguishable; focus/order/names/roles are coherent; contrast meets WCAG AA; color is not sole meaning; graphs have textual/accessibility equivalents; Missing/Stale/Unavailable/Not Applicable and covered subtotals are not conflated.
- **Evidence:** manual interaction record plus automated semantic/contrast checks and exact tested states.

### AC-PERF-001 — mature-scale latency and correctness

- **Given:** deterministic representative data with 25,000 Trades, up to 200 Open, about 200,000 Execution/settlement facts, and realistic Market/Journal/correction history in a disclosed common local environment.
- **When:** statistically sufficient cold startups and warm open-list navigations run with network disabled.
- **Then:** cold interactive-screen p95 is at most 2,500 ms and warm complete open-list p95 at most 1,500 ms; required calculations/coverage/integrity remain present; no all-history replay or one-record-query-per-Trade behavior occurs on the ordinary path.
- **Evidence:** dataset provenance/counts, environment, raw timings, percentile method, traces/query counts, and correctness assertions before/after.

### AC-CAP-001 — installed capabilities are honest

- **Given:** an incremental vertical release omitting and including selected operations/report families.
- **When:** its Installed Capability Manifest and navigation are inspected and declared capabilities exercised.
- **Then:** omitted behavior is absent, not returned as fake Unavailable; every declared compound capability is complete, dependency-closed, reachable through the production UI, and functional through its required application/domain behavior and persistence/infrastructure; later additions preserve earlier fact meaning and disclose historical coverage limits where prior evidence was not captured.
- **Evidence:** Installed Capability Manifest, production-UI flow, mock-free real-stack integration evidence, full scenario map for each declared capability, and coverage disclosure.

## Conformance decision

Acceptance requires all scenarios applicable to the advertised installed capabilities, plus all foundational data/delivery scenarios necessary to preserve future-safe facts. A waived scenario must be recorded as an explicit scope change to the canonical specification; an implementation plan cannot silently reinterpret it. Known limitations remain visible and must not be converted into passing evidence by hiding data, relaxing denominators, or changing the fixture.
