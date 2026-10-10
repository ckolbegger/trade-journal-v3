# Trade Journal V3 ubiquitous language

This glossary is normative. Capitalized terms identify domain concepts with the meanings below. UI copy may use an approved short label only when it maps unambiguously to the canonical term.

## Workspace and reference language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Workspace** | The complete device-local journal, configuration, and durable history belonging to one trader on one device. | User account, tenant, cloud account |
| **Progressive Web Application (PWA)** | The standards-based hosted browser application defined by a Web App Manifest and versioned service worker, installable where the host supports installation and usable in a browser tab only after Runtime Readiness passes. | Native wrapper, mobile-only app, install prompt alone |
| **Offline Release Inventory** | The immutable versioned identity and complete asset/digest set that must be cached and verified for one installed application release to reopen offline. It is not domain capability or trader data. | Installed Capability Manifest, backup manifest, ad hoc cache list |
| **Runtime Readiness** | The current-session functional gate over persistent-storage confirmation, an isolated storage transaction, capacity headroom, service-worker control, and the complete Offline Release Inventory. Its outcomes are `Writable`, `Recovery Only`, or `Unsupported`. | Browser allowlist, certification, one-time installation check |
| **Runtime Not Writable** | The single cross-cutting `RuntimeNotWritable` branch in every authoritative mutation result when current Runtime Readiness is or re-evaluates to `Recovery Only` or `Unsupported`. It carries the readiness outcome, every failed check, any readable or integrity-blocked Workspace status, and safe actions. | Domain validation error, operation-specific substitute result, best-effort write warning |
| **Recovery Only** | Runtime Readiness when an existing Workspace remains readable but one or more write-safety conditions fail; reads and backup export are allowed, while authoritative mutation and Restore application are forbidden. | Ready, Best Effort write mode |
| **Integrity Blocked** | Workspace status when a known or possible existing storage root cannot be read or validated safely. It may carry `Unsupported` Runtime Readiness and forbids treating the root as empty, initializing over it, Restore application, or claiming a backup. | Empty Workspace, Initialization Required, Recovery Only |
| **Completed Backup Receipt** | Non-authoritative result evidence proving that one full digest-valid backup artifact from an exact Workspace Snapshot Binding was positively transferred to an external destination. Prepared, initiated, failed, or unconfirmable transfers produce no such receipt. | Workspace Backup Manifest, download-start notice, durability guarantee |
| **Institution** | One trader-managed brokerage or custodian identity. | Broker string, Account provider |
| **Account** | One specific trading account held at exactly one Institution. | Login, user, Workspace |
| **Strategy** | The named structural template declared by a Plan, consisting of ordered Planned Leg roles and shape constraints. | Current position type, retrospective classification |
| **Tag Type** | A stable trader-managed taxonomy defining the allowed value space for explicitly typed fields. | Tag bag, category string |
| **Tag Value** | One stable identity and label belonging to exactly one Tag Type. | Free-form tag, label-as-identity |
| **IdeaSource** | The single shared semantic Tag Type whose values may identify the source of a Plan idea or of one configured Journal response. | Idea Source string, one Tag Type per source |
| **Close Reason** | A trader-declared Trade fact explaining why a terminal Position Change with trader agency closed the Trade. | Closed via, Terminal Disposition, Close Review |
| **Abandonment Reason** | A trader-declared Trade fact explaining why a confirmed Plan with no effective real exposure was Abandoned. | Never Filled, Close Reason |

An Account's Institution relationship is immutable. A Trade references exactly one Account, and its Institution is always derived through that Account. Renaming, archiving, or retiring a reference never changes its stable identity or rewrites historical use.

## Fact and history language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Economic Time** | When the represented trading-domain occurrence took effect; it controls replay, FIFO, lifecycle, P&L, and metric natural dates. | Save time, import order |
| **Recorded Sequence** | The stable tie-break assigned when two facts share an Economic Time. | Array order, lexical ID order |
| **Save Time** | When an immutable version became durable, used for audit provenance and Correction Footprint rather than economic ordering. | Economic Time |
| **Effective Fact** | The currently applicable non-Voided version of one stable fact identity. | Latest row by insertion time |
| **Stable Identity** | The durable identity of the same domain subject across rename, Edit, Replace, or Void history. | Display label, version identity |
| **Revision** | An immutable version identity or an opaque snapshot/optimistic binding, according to its owning interface. | Mutable record number |

Facts with equal Economic Time are ordered by Recorded Sequence. Correcting an existing fact retains its sequence even if its Economic Time changes; a newly reconstructed fact receives a new sequence in explicit reconstruction order.

## Planning and trading facts

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Trade** | The positions and lifecycle governed by one confirmed Plan. | Position, order, campaign |
| **Plan** | The forward-looking decision artifact confirmed before deliberate entry and frozen at confirmation. | Draft after confirmation, position |
| **Planned Leg** | One intended instrument role, signed quantity, and exact contract or complete objective selection criteria within a Plan. | Actual Leg, TBD leg |
| **Position Change** | One deliberate decision or one settlement occurrence grouping one or more position-changing facts, possibly across Trades. | Fill, transaction batch, workflow session |
| **Execution** | One actual fill fact with exact Instrument, buy/sell action, quantity, price, economic time, and actual fee. | Position, holding, Actual Leg |
| **Settlement Fact** | An explicit Assignment, Exercise, Expiration, or cash-settlement fact that disposes of option quantity. | Zero-price Execution, inferred expiration |
| **Assignment** | Settlement of a short option that disposes of option quantity and may create or change underlying exposure or cash. | Unplanned Execution, option fill |
| **Exercise** | Settlement of a long option that disposes of option quantity and may create or change underlying exposure or cash. | Automatic planned ownership, zero-price fill |
| **Exercise Intent** | A Plan fact explicitly authorizing voluntary long-option exercise in advance; merely buying a long option does not imply it. | Inferred intent |
| **Expiration** | An explicitly recorded settlement outcome in which option quantity expires without exercise or assignment. | Calendar inference |
| **Roll** | One Position Change that closes or reduces predecessor exposure, confirms a successor Plan, records successor Executions, and creates typed lineage. | Transfer, Plan edit |
| **Position** | Current exposure derived by replaying effective position-changing facts. | Trade, Plan, stored status |
| **Instrument Position** | The derived signed net quantity and open Lots for one exact Instrument within a Trade. | Actual Leg, Execution |
| **Open Lot** | The unmatched portion of one position-increasing fact together with its basis and unconsumed opening fee. | Position row, fill balance |
| **Lot Match** | A stable link joining opening and disposing facts for a matched quantity under a named matching policy. | Stored P&L, copied basis |
| **Management Revision** | An immutable fact that prospectively changes effective Stops, Targets, structure, thesis, or related management from an economic time. | Plan overwrite, journal edit |
| **Deviation** | A recorded deterministic occurrence showing departure from an explicit trader commitment. | Judgment, target hit, any revision |
| **Entry Resolution Point** | The one derived endpoint at which a Trade's initial entry window becomes complete or is cut off by the first exposure reduction. | Entry event series, Accepted Position view |
| **Planned Leg Fulfillment** | The derived per-leg result `Unfilled`, `Partially Filled`, `Filled as Planned`, `Filled with Deviation`, `Not Entered`, or `Not Verifiable` under the frozen Plan evidence. | Position state, guessed conformance |
| **Lifecycle State** | The authoritative stored and indexed state `Planned`, `Open`, `Closed`, or `Abandoned`, guarded by its effective facts. | User status, derived-only status |
| **Terminal Disposition** | The derived complete set of mechanisms and quantities by which a Closed Trade's exposure ended. | Close Reason, editable outcome |
| **Correction Footprint** | Structured disclosure of a corrected fact, its economic effect date, correction save time, affected calculation domains, and affected replay interval. | Alternate as-known history |
| **Option Disposition Timing** | A Closed option Trade's derived quantity-aware classification `Fully Disposed Pre-Expiration`, `Fully Held to Expiration Settlement`, or `Mixed`, based only on explicit facts. | Calendar inference, Close Reason |
| **Entry/Exit Scaling** | A Closed Trade's classification as Single Entry / Single Exit or Scaled by counting decision-level Position Changes, not fills or Legs. | Fill count |
| **Settlement Due** | Review attention that an option requires an explicit Expiration, Assignment, Exercise, or cash-settlement outcome; it is not itself a settlement fact. | Inferred Expiration |

### Lifecycle meanings

- **Planned**: the Plan is confirmed and no effective fact has established exposure.
- **Open**: effective facts leave nonzero exposure.
- **Closed**: effective facts show that real exposure existed and no Position remains.
- **Abandoned**: an explicitly abandoned confirmed Plan never had an effective real position-changing fact.

An effective real Execution permanently removes Abandonment eligibility even if another real Execution later offsets it. Voiding a data-entry-only false Execution may restore eligibility when no other real position-changing fact remains.

Terminal Disposition is applicable only to Closed Trades and preserves mixed mechanisms. An Abandoned Trade has no Terminal Disposition because no exposure existed to dispose of.

### Deviation taxonomy

The fixed Deviation types are:

- **Planned-Leg Terms**: one intended Planned Leg was served, but one or more exact terms differed.
- **Entry Size**: exposure exceeded planned quantity when entered, or resolved below planned quantity.
- **Unplanned Exposure**: the trader explicitly identified an Execution as serving no Planned Leg.
- **Stop Discipline**: effective exposure remained open while an active Stop was breached, deduplicated by continuous breach episode.

Target Reached, Target Overrun, and Management Revision are descriptive analytical facts and are not Deviations.

## Journal language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Journal** | The chronological collection of saved Entries, Addenda, explicit declines, and visible obligation history. | Reflection store, notes table |
| **Journal Entry** | One stable identity with an immutable saved version chain whose current head is effective content or a visible Void. | Reflection entity, mutable note, draft |
| **Entry Type** | One of seven fixed semantic identities that determines the kind of journal moment. | User-created form type, Anchor |
| **Entry Definition** | One immutable revision of the ordered Prompts, options, rules, and semantic roles used for future Entries of an Entry Type. | Entry Type, mutable schema |
| **Prompt** | One stable question identity within an Entry Type's Entry Definition. | Field label as identity |
| **Option** | One stable selectable-answer identity within a Prompt. | Display label as identity |
| **Anchor** | Exactly one scope identifying what an Entry is about: Standalone, Trade, or one specific Execution. | Source, origin, multi-attachment |
| **Source** | Automatic metadata identifying the logical surface from which the trader initiated the writing. | Anchor, Journal Debt, user answer |
| **Originating-Fact Association** | Automatic metadata linking workflow-created writing or Debt to the exact Plan, Position Change, Management Revision, Deviation, or Daily Review moment that caused it. | Second Anchor |
| **Edit** | A saved correction that appends an immutable version under the same Journal Entry identity. | In-place overwrite, Addendum |
| **Addendum** | A distinct later Journal Entry that keeps its parent's Anchor and records a parent relationship. | Edit, second Anchor |
| **Void** | A visible version asserting that a recorded fact or Entry never occurred, with a required reason. | Delete, hide |
| **Journal Debt** | A durable outstanding obligation to answer, explicitly decline, or validly retire a specific snapshotted journal moment. | Placeholder Entry, draft |
| **Management Debt** | Journal Debt whose owning Trade Workflow must establish required management for open exposure or remove that exposure. | Journal-only question, missing note |
| **Decline** | A durable statement that an allowed Journal obligation was explicitly not answered. | Blank answer, Void |
| **Action** | The selected Daily Trade Review intent `Hold`, `Exit`, `Roll`, `Adjust`, or a later configured stable option. | Executed order, inferred Hold |

The seven fixed Entry Types are **Plan Reflection**, **Position Change Reflection**, **Management Revision**, **Close Review**, **Daily Trade Review**, **Review Note**, and **Trader Reflection**. Prompt sets and answer options may change at runtime, but these identities cannot be created, removed, or repurposed in the MVP.

The initial Source identities are **Plan Confirmation**, **Position Change**, **Management Revision**, **Trade Close**, **Daily Review**, **Trade Detail**, and **Journal**.

Journal Entries capture saved versions only. Drafts, keystrokes, field focus, and abandoned edits are not Journal data. Every Entry and Debt snapshots the exact Prompt wording and option labels applicable to it.

## Market observations and valuation

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Mark** | One saved price observation for an exact Instrument on one U.S. Trading Date, with revision and source history. | Fill fallback, theoretical price |
| **Manual Mark** | A trader-supplied Mark that is authoritative and sticky for its Instrument and Trading Date. | Provider estimate |
| **Daily Bar** | A provider-supplied open, high, low, and close observation for one Instrument and Trading Date. | Mark history, synthetic candle |
| **Expected Mark Date** | The U.S. Trading Date whose exact Mark is required for a valuation context, normally the latest completed regular session. | Calendar today, arbitrary as-of label |
| **Expected-Mark Status** | The evidence state `Available`, `Missing`, or `Acknowledged Unavailable` for an Instrument's Expected Mark Date. | Calculation Result, Stale status |
| **Unavailable Mark Acknowledgment** | A trader record that no honest exact-date observation can be obtained, containing a reason and time but no price. | Zero Mark, provider error, Mark |
| **Stale** | A label for the nearest older Mark shown only as context when it predates an unfilled Expected Mark Date. | Any prior close, usable fallback |
| **Calculation Result** | An independently returned `Value`, `Unbounded`, `Unavailable(reason)`, or `Not Applicable(reason)` for one calculation. | Nullable number, zero fallback |
| **Mark-to-Market Valuation** | Valuation of effective exposure on an actual current or historical U.S. Trading Date using exact effective Marks. | Expiration payoff, price projection |
| **Expiration Payoff** | A mark-free piecewise-linear settlement analysis over underlying price for a structure with one option-expiration anchor. | Current option value, forecast |
| **Payoff Zero Set** | The normalized set of Crossing points, Touch points, and Zero Ranges at which an available payoff curve equals zero. | Breakeven list only |
| **Payoff Maximum** | The signed greatest payoff over nonnegative underlying prices, with its complete Attainment Set or `Unbounded Above`. | Positive-only max profit |
| **Payoff Minimum** | The signed least payoff over nonnegative underlying prices, with its complete Attainment Set or `Unbounded Below`. | Negative-only max loss |

An exact Mark, Daily Bar, and Unavailable Mark Acknowledgment are separate facts. Exact Mark precedence makes the Expected-Mark Status Available even when acknowledgment history also exists. An acknowledgment may allow Daily Review to complete with unavailable calculations, but it never supplies a value.

During an active Tuesday session, Monday's completed-session Mark is normally the Expected Mark and is Available. It is not Stale merely because its date is earlier than the calendar date.

## Risk, reward, and outcome language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Plan Baseline** | The frozen risk/reward analysis derived at Plan confirmation from intended entry, Planned Legs, original Stops, and original Targets. | Actual-entry baseline, live risk |
| **1R** | The positive Original Planned Risk from the frozen Plan Baseline and the stable denominator for Plan-R comparisons. | Current risk, accepted risk |
| **Original Planned Risk** | The frozen monetary distance from intended entry to the original effective Stop boundary. | Actual fill risk |
| **Original Planned Reward** | The frozen monetary distance from intended entry to the original effective Target boundary. | Current reward |
| **Ongoing Risk to Stop** | The current monetary distance from the remaining Position's marked P&L to the nearest unbreached effective Stop boundary. | Original risk, future option projection |
| **Worst-Case Ongoing Risk** | The current monetary distance from the remaining Position to its structural worst case. | Risk to stop |
| **Incremental Reward to Target** | The current monetary distance from the remaining Position's marked P&L to the nearest unreached effective Target boundary. | Original reward |
| **Maximum Incremental Reward** | The current monetary distance from the remaining Position to its structural maximum. | Reward to target |
| **Stop Overrun** | The nonnegative distance beyond an already breached Stop boundary, in dollars and Plan R where available. | Negative risk to stop |
| **Target Overrun** | The nonnegative distance beyond an already reached Target boundary, in dollars and Plan R where available. | Negative reward to target |
| **Entry Quality** | The one derived comparison of actual initial-entry risk/reward, including allocated fees, against the Plan Baseline at the Entry Resolution Point. | Standing Accepted-Position Risk/Reward |
| **Realized R** | A planned Closed Trade's final net realized P&L divided by its frozen 1R. | Current R:R |

Underlying-price and structure-value Stops or Targets are independent OR conditions. Every condition remains visible. The headline distance uses the nearest monetary boundary, becomes zero when any condition is crossed, and never changes the Position or Lifecycle State by itself.

Permitted compact UI labels map exactly as follows; the full term remains available in help and accessibility text:

| Compact label | Canonical term |
|---|---|
| Original risk | Original Planned Risk |
| Risk to stop | Ongoing Risk to Stop |
| Worst case | Worst-Case Ongoing Risk |
| Reward to target | Incremental Reward to Target |
| Max reward | Maximum Incremental Reward |
| Original reward | Original Planned Reward |

## Review and reporting language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Daily Review** | The fact-derived guided ritual for one completed U.S. trading session. | Saved Review Session, dashboard only |
| **Review Date** | The exact completed regular U.S. session being reviewed. | Arbitrary report date |
| **Review Cutoff** | The exact close instant for the Review Date used to derive historical eligibility. | Current time |
| **Report Period** | One named calendar interval applied by each metric to its fixed natural date. | Custom date range, trading-session range |
| **Break Down By** | The optional single grouping dimension applied while retaining the ungrouped Overall result. | Nested group builder |
| **Coverage** | Explicit disclosure of applicable, evaluable, included, missing, unavailable, and excluded evidence or records. | Implied completeness |
| **Future Insights** | A deferred optional capability for data-dependent coaching or interpretation that may consume deterministic evidence but cannot alter it. | MVP reporting, deterministic scorecard |

The Report Period presets are **All Time**, **Year to Date**, **Quarter to Date**, **Month to Date**, **This Week**, and **Last Week**. This Week runs Monday through the current Workspace-local date. Last Week is the preceding Monday through Sunday. Current Exposure has no Report Period.

The permitted Break Down By dimensions are **Strategy**, **Underlying**, **Tag**, **Account**, **Institution**, **Idea Source**, **Option Disposition Timing**, and **Entry/Exit Scaling**. Only one may be active. Multi-valued groups are non-additive, while Overall counts each Trade once.

## Key relationships and invariants

- One **Trade** references exactly one **Account**, and one **Account** belongs to exactly one **Institution**.
- One confirmed **Plan** owns one or more **Planned Legs** and exactly one frozen **Plan Baseline**.
- One **Position Change** contains one or more position-changing facts and creates exactly one Position Change Reflection outcome.
- Every **Execution** belongs to exactly one **Trade** and one **Position Change**, and either names its intended **Planned Leg** or is explicitly Unplanned.
- **Planned Legs** plus effective **Position Changes** produce derived **Instrument Positions** and **Open Lots**.
- Each closing or settlement quantity consumes opening Lots through FIFO **Lot Matches** in the MVP.
- One **Journal Entry** has exactly one **Anchor**, exactly one automatic **Source**, and at most one originating-fact association.
- One Journal obligation has exactly one current outcome: completed Entry, explicit Decline, outstanding **Journal Debt**, or valid retirement.
- One Instrument and Trading Date have at most one effective **Mark**, shared by every Trade.
- A **Daily Review** is complete only when all eligible Trade Actions, current Mark resolutions, due Debt, settlement, management, and deterministic reconciliation obligations are resolved.

## Example dialogue

> **Developer:** “The trader saved four fills from one order. Is that four Position Changes?”
>
> **Domain expert:** “No. It is four Executions inside one Position Change because they came from one decision. Each Execution still belongs to its own Trade and intended Planned Leg.”
>
> **Developer:** “If one option expired, can we mark the Trade Closed from the calendar and ask for a Close Reason?”
>
> **Domain expert:** “No. Record Expiration explicitly. If that no-agency settlement alone makes the Trade flat, Terminal Disposition explains how it closed and there is no Close Reason.”
>
> **Developer:** “And if the trader is not ready to reflect?”
>
> **Domain expert:** “Persist the settlement and one Position Change Reflection outcome atomically. Defer creates Journal Debt, while the factual Expiration remains true.”

## Flagged ambiguities and canonical resolutions

- “Position” means derived exposure, not the Trade, Plan, Planned Leg, or Execution.
- “Fill” may appear in explanatory prose, but **Execution** is the canonical entity term.
- “Actual Leg” is only an informal presentation row and never a persisted or interface entity.
- “Closed via” is permitted UI wording for derived **Terminal Disposition** and never means **Close Reason**.
- “Idea Source” in prose refers to the semantic **IdeaSource** Tag Type. A Plan reference and a configured Journal response have separate meanings and never overwrite one another.
- “Unavailable” on a calculation is distinct from **Missing** or **Acknowledged Unavailable** Expected-Mark Status.
- “Review complete” is derived from current corrected facts and is not a saved completion flag.
- “Insight” is reserved for future interpretive behavior. Deterministic Trade views and reports belong to the MVP without an Insights module.
