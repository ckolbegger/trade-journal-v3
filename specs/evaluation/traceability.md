# Source traceability and supersession matrix

## Purpose and authority

This file preserves design provenance so source disagreements can be understood without polluting the build-facing contracts. It is not normative over the rest of `specs/`.

The primary consolidation record was `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`. The extracted specification and explicit user decisions captured there are canonical. Source branches contributed evidence and alternatives, not votes. Ox Alpha descends from Claude and substantially duplicates it; duplicated content is one lineage, not two independent confirmations.

Precedence for interpretation is:

1. explicit settled user decision in the consolidation record;
2. completed Candidate C module contract and its audit finding;
3. canonical synthesis that reconciles sources consistently;
4. sharper compatible source detail;
5. prototype/reference behavior only where no stronger specification exists.

## Product and architecture lineage

| Concern | Claude contribution | GLM contribution | Ox Alpha contribution | Conflict, user decision, or canonical synthesis |
|---|---|---|---|---|
| Product scope | Broad Trade/Plan/Planned-Leg, journaling, Review, UI, offline product | Narrower but rigorous semantic core | Mostly Claude lineage plus simplified home/valuation ideas | Full intended MVP retained, with later explicit deferrals; U.S.-listed/USD/after-close scope settled by user. |
| Architecture | Domain concepts and UI-oriented coordinators, but some UI-managed cross-module writes | Explicit deep stores/coordinators, transactions, analysis contracts | Mirrors Claude for most relevant design | User approved Candidate C: authoritative fact modules, pure analysis, use-case coordinators, separate UI/delivery contracts. |
| Communication model | Some local reactive/UI assumptions | Strong request/response boundaries plus a UI re-query convention | No independent delta | User retained plain request/response and later explicitly rejected mandatory follow-up reads after writes. Subscriptions/domain events remain absent; accepted mutations return bounded, revision-bound post-commit state, while other views read on demand. |
| Atomicity | Some workflows left multi-call/UI coordinated | All-or-nothing semantic workflows and prepared effects | Duplicates Claude weakness | GLM rigor adopted and broadened: every semantic command persists all required Trade/Journal/index/lineage effects or none. |
| Lifecycle | Earlier lineage leaned toward derived presentation state | Stored lifecycle/state model with repair surface | Mostly Claude-derived | User chose authoritative stored/indexed Lifecycle State plus independent analytical agreement; Terminal Disposition remains derived-only. |
| Module partition | Strong UI/domain vocabulary, incomplete final partition | Detailed store/calculation/coordinator alternatives | Limited unique delta | Canonical ten-interface partition was synthesized and every module completed/audited. |

## Trade, correction, and calculation lineage

| Concern | Claude contribution | GLM contribution | Ox Alpha contribution | Conflict, user decision, or canonical synthesis |
|---|---|---|---|---|
| Trade campaign | Trade/Plan/Planned Legs and Execution ownership | More record-centric models, no full Planned Legs | Claude-derived | Claude campaign/Plan model retained; Trade is not Position and Plan may be complete before entry. |
| Position Change | Behavioral reflection around material changes | Strong factual transaction semantics | Claude-derived | Canonical grouping is one decision/settlement occurrence, possibly cross-Trade, with one origin-Trade reflection. |
| Roll | Execution ownership and predecessor/successor lineage | Atomic multi-record mutation discipline | No independent decision | Partial Roll preserves untouched predecessor holdings; successor has a newly confirmed Plan; all writes atomic. |
| Assignment/Exercise/Expiration | Needed explicit settlement treatment | Useful settlement/accounting rigor | No material independent delta | User settled explicit outcome, no calendar inference or zero-price Execution, typed allocation, separate Settlement Price and adjusted basis/proceeds. |
| Corrections | Visible history and user-facing correction needs | Strong Replace/Void/Rebuild, revision binding, Restore fidelity | Mostly duplicate | Canonical one corrected economic history plus visible audit and Correction Footprint; Rebuild preserves Trade identity and historical Anchors. |
| Lots/fees/P&L | Trading-domain examples | FIFO, fee allocation, calculation interfaces | Added current valuation-total ideas | Pure Trade Analysis owns derivation; Lot Match carries linkage, not duplicate price/P&L; fees count exactly once. |
| Plan risk | Plan risk/reward and sizing concepts | Dollar/R calculation rigor and payoff curves | Repeated/varied display concepts | User froze Plan Baseline as 1R and removed standing Accepted-Position risk/reward; current risk/reward is separate. |
| Entry Quality | Planned-vs-actual entry concepts | Coverage/result-state rigor | No independent delta | One comparison at Entry Resolution Point; later scaling/management does not rewrite it. |
| Stops/Targets | Detailed plan/management and behavioral use | Formula/evaluation discipline | Visual simplifications | Independent OR conditions, Ongoing/Worst-Case risk, Incremental Reward, and Overrun retained; Target and Management Revision are not Deviations. |
| Payoff versus valuation | Some UI risk panels | Strategy-independent payoff curves/breakevens | Marked-current totals | Canonical split: observed Mark-to-Market versus expiration payoff without theoretical pricing; Planned and Current payoff views independent. |
| Missing Mark | Stale/manual handling foundations | Explicit availability/coverage results | Proposed substituting fill cost in some valuation paths | Fill-cost substitution rejected explicitly. Exact Mark, Missing, Acknowledged Unavailable, and Stale context remain distinct. |

## Journal and Daily Review lineage

| Concern | Claude contribution | GLM contribution | Ox Alpha contribution | Conflict, user decision, or canonical synthesis |
|---|---|---|---|---|
| Journal model | Rich runtime prompts, Entry Types, Anchors, immutable writing | Strong histories/transaction validation | Duplicate lineage | Fixed Entry Type identity plus runtime versioned prompts/options; saved Entries snapshot definitions and labels. |
| Edit/Addendum/Void | User-friendly editing direction | Immutable revision/audit rigor | No independent delta | Ordinary Edit → Save, distinct Addendum, visible Void; saved history only, no draft/keystroke capture. |
| Anchor/Source/origin | Several source-specific concepts | Typed association rigor | Duplicate lineage | Exactly one Standalone/Trade/Execution Anchor, automatic Source, separate originating-fact association. |
| Journal Debt | Deferred reflection concept | Strong state/invariant treatment | No independent delta | Debt is a separate obligation, not incomplete Entry; answer/decline/retirement are explicit; due Debt blocks Review, not factual capture. |
| Daily Review shape | Agenda/walk interaction, Action as evidence | Wide read coordinator, less behavioral/optional observation | Mostly Claude duplicate | Canonical four-operation fact-derived ritual; no saved Review Session; Action plus Deviation reconciliation atomic. |
| Hold behavior | Convenient default Action | No decisive independent rule | No independent delta | User retained Hold preselected as view state but required explicit Save; no action means incomplete, never inferred Hold. |
| Settlement due | Partial handling | Factual rigor | No independent delta | Review routes to Trade Workflows and stays incomplete; it cannot manufacture Expiration or settlement. |
| Attention | UI prioritization | Some risk-oriented aggregate ideas | Simplified home concepts | Transparent bands/reasons/pressure adopted; no opaque discipline/composite score. |

## Market Data and analytics lineage

| Concern | Claude contribution | GLM contribution | Ox Alpha contribution | Conflict, user decision, or canonical synthesis |
|---|---|---|---|---|
| Marks/provider | Manual and source-aware marks | Provenance/history and coverage rigor | Some simplified current valuation | Exact Instrument/date observation book, sticky Manual precedence, optional provider port, transient errors only. |
| Expected date/Stale | Initial after-close behavior | Explicit as-of and availability semantics | No independent resolution | User rejected treating normal prior close during an active session as Stale. Expected Mark Date owns recency meaning. |
| Daily Bars | Prototype chart needs | Observation/range detail | No material delta | Bars are optional separate evidence; single-Instrument trailing may use extrema, multi-Instrument structure requires synchronized Marks. |
| Analytics surface | Early stats/adherence concepts | Rich per-Trade and deterministic analytical details | Simplified home/valuation totals | Canonical four Performance Analysis families with metric-specific populations, coverage, contributors, and no composite score. |
| Outcomes | Basic P&L views | Distributions, curves, Profit Factor rigor | No independent delta | Closed headline and realization-event populations explicitly separated; a GLM worked-example arithmetic label was corrected to approximately 2.6667. |
| Current Exposure | Some current Trade UI | Aggregate analytical rigor | Useful realized/current valuation split | Canonical current-only family with independent P&L components and exact covered/unbounded/unavailable cohorts; no Report Period. |
| Scorecard | Behavioral journal emphasis | Metric rigor | No independent delta | Descriptive families and denominators adopted; no automated grade/adherence composite. |
| Journal Field | Runtime form configurability | Analytical partition discipline | No independent delta | One categorical stable field at a time, no nested grouping or causal outcome claim. |
| Report Periods | Prototype range controls | Dated analytical scopes | Similar visual controls | User approved only All Time/YTD/QTD/MTD/This Week/Last Week; calendar boundaries in Workspace time zone; no custom range. |

## Reference, Workspace, delivery, and UI lineage

| Concern | Claude contribution | GLM contribution | Ox Alpha contribution | Conflict, user decision, or canonical synthesis |
|---|---|---|---|---|
| Reference data | Strategy/tag/account UI concepts | Typed store and revision rigor | Duplicate/minor simplification | Canonical stable typed Catalog with immutable parents/shapes, history, new-vs-retained resolution, and exact seeds. |
| Strategy seeds | Broad strategy vocabulary | Structural constraints | No independent delta | Exact eleven seeds settled; no generic Custom; Iron Condor shape and asymmetric wings clarified; zero-DTE is Plan criteria only. |
| Account/Institution | Brokerage domain records | Typed relationship rigor | No independent delta | Trade has one Account and derives Institution; Account snapshots/cash ledger/equity curve excluded. |
| IdeaSource | Source/tag concepts | Typed taxonomy validation | No independent delta | One fixed IdeaSource Tag Type, no seeded Values; Plan and configured Journal field are independent zero-or-one uses. |
| Local application identity | Offline local product baseline | Backup/transaction rigor | No independent delta | User explicitly chose one trader/device-local Workspace, no login/backend/sync; brokerage Account is not application identity. |
| PWA delivery and Runtime Readiness | Installable/offline browser direction | Explicit browser-PWA direction and local transaction rigor | No independent delta | User chose standards-based PWA delivery with no browser/OS allowlist; functional readiness on every launch and after update/Restore permits writes only with confirmed persistent storage, a working diagnostic transaction, capacity/headroom, service-worker control, and a complete Offline Release Inventory. Failure is Unsupported or read/backup-only Recovery Only; another browser requires positively confirmed backup transfer and Restore rather than risking unprotected writes. |
| Backup/Restore | Export/import direction | Strong full-snapshot validation and atomicity | No material delta | User chose full self-contained backup, secrets excluded, supported migration, atomic replace-only Restore with safety offer. |
| Incremental delivery | Slice-oriented history | Capability completeness ideas | No independent delta | Honest Installed Capability Manifest adopted; no fake Unavailable for unimplemented features and no semantic reshaping. |
| Responsive layout | Prototype narrow bottom bar and wide sidebar; later conformance doc used bottom nav at all widths | No prescriptive layout | Duplicated prototype plus all-width ambiguity | User made viewport behavior normative: narrow bottom navigation, wide left sidebar, live resize/state preservation. Form container remains flexible. |
| Visual language | Primary source: cream ground, cards, pills, badges, chips, dense numbers | Minimal UI prescription | Mostly duplicate | Visual language retained, arithmetic/state rejected as authority, WCAG AA required. |
| Contextual forms | Prototype bottom sheets/right drawers; later source used inline forms | No specific container | Duplicate | User made outcomes normative and container flexible: inline/route/modal/sheet/drawer all possible. |
| Page states | Several UI states | Result-state rigor | No independent delta | Loading/Ready/Empty/Error accepted; generic domain-condition page-state layer rejected. |
| Future Insights | Prototype coach idea | No equivalent | Duplicated concept | Explicitly deferred outside MVP; deterministic evidence/reporting remains in scope. |

## Known source supersessions

- Any source calling Lifecycle State derived-only is superseded by stored authoritative state plus analytical agreement.
- Any source treating a Trade as a Position/campaign snapshot is superseded by the canonical Trade/Position distinction.
- Account Snapshot, cash ledger, equity curve, provider-performance analytics, arbitrary/nested report grouping, and Future Insights are outside MVP.
- “Bull Put Spread” and “0-DTE Iron Condor” are not seeded Strategy identities; use Vertical Put Credit Spread and per-Plan zero-DTE criteria.
- “Watch Closely” is not a Daily Review Action and absent Action is not Hold.
- Filling a missing Mark with fill cost or older evidence is rejected.
- Prototype sheet/drawer containers are references; the narrow-bottom/wide-sidebar responsive navigation contract remains normative.

No known product decision remains open after these supersessions.
