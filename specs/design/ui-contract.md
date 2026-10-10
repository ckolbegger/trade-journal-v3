# UI contract

## Status and authority

This document defines observable presentation behavior without prescribing components, routes, libraries, or rendering technology. The copied screenshots are visual references only. Domain documents and the [glossary](../glossary.md) override their labels, numbers, inferred state, navigation details, and incomplete flows.

The full screenshot catalogue is in the [UI screenshot index](../reference/ui-screenshots/index.md).

## Visual language

The canonical visual direction is a clean, quiet, data-dense light interface:

- warm cream page ground;
- white rounded content cards with restrained borders;
- near-black pill-shaped primary actions and outlined secondary actions;
- small-caps section labels;
- compact semantic badges whose color reinforces text meaning;
- pill-like option/filter chips with their correct interactive semantics;
- right-aligned, tabular numerals for Money, Price, Quantity, ratios, and counts;
- green/red reserved for signed results and Stop/Target meaning rather than decoration.

The interface must maintain WCAG AA contrast: at least 4.5:1 for normal text and 3:1 for large text, essential non-text controls, focus indicators, and meaningful graphics. Color never carries meaning alone. Links remain visibly identifiable. Keyboard focus is visible and logical.

The target feel is illustrated by [narrow Home](../reference/ui-screenshots/proto-home.png) and [wide Home](../reference/ui-screenshots/proto-home-desktop.png). The displayed adherence/P&L arithmetic and prototype labels are non-authoritative.

## Responsive behavior

Responsive layout follows live viewport width, not device identity.

- Narrow view is single-column and uses bottom navigation.
- Wide view uses a left sidebar with centered main content.
- Exact breakpoint and sizing are implementation choices.
- A narrow desktop window uses the same narrow arrangement as a phone.
- Resizing while the application is open changes layout live without reload and without losing route, selected record, filter state, or entered-but-unsaved form values.
- Every supported width exposes equivalent information, fields, actions, validation, and Save/Cancel outcomes.

The paired [narrow Plan form](../reference/ui-screenshots/proto-new-plan-step2.png) and [wide Plan form](../reference/ui-screenshots/proto-new-plan-step2-desktop.png) illustrate equivalent workflow content across layouts. Their exact fields and calculations lose to the Plan and Journal contracts.

## Navigation and context

Primary navigation must make the installed capabilities reachable in both narrow and wide arrangements. Labels use canonical domain language. Presentation may organize Trade browsing, planning, Journal, Daily Review, deterministic reporting, settings, backup, and Restore in any coherent navigation hierarchy; it must not expose module names as technical architecture or imply that a Position is the Trade campaign.

Opening a contextual form preserves the surrounding task and entered state. Bottom sheets on narrow screens and right drawers on wide screens are useful references—see [Add Execution](../reference/ui-screenshots/proto-add-fill.png) and its [wide variant](../reference/ui-screenshots/proto-add-fill-desktop.png)—but the container is not normative. Inline expansion, a dedicated route, modal, sheet, drawer, or another accessible container may satisfy the contract.

Save, Cancel, validation, and conflict outcomes must be unambiguous. Cancel or navigation without Save records no behavioral evidence. A conflict or changed-evidence result preserves safe user input and explains what must be reviewed again.

## View states

Every data-bearing view distinguishes:

- **Loading:** the request has not produced an authoritative result; never show a false Empty state or stale values as current.
- **Ready:** a coherent result is present, including partial calculation availability and data-quality disclosures.
- **Empty:** the request succeeded with no matching records/tasks; explain why and offer an appropriate next action where one exists.
- **Error:** the requested view cannot be assembled; retain safe recoverable context and offer retry/correction rather than displaying false emptiness.

These are presentation states, not domain status values. Journal Debt, Deviations, settlement due, partial Plan fulfillment, Missing Marks, and Unavailable calculations appear under their own semantics and may coexist in one Ready view.

## Installation and Runtime Readiness

The first load and every later application launch enable data entry and the complete normal navigation only after Runtime Readiness is `Writable`. The check also runs after application update activation and Restore. While it is pending, the UI identifies startup verification without presenting an empty Workspace or enabled mutating action. `Recovery Only` instead presents the restricted read, history, and backup navigation defined below; it does not wait behind or masquerade as the writable application shell.

Where the host exposes installation, the UI offers an install affordance or clear platform-appropriate instructions. It does not infer support from browser/operating-system identity or require installation when a browser tab is `Writable`. Installation success never substitutes for the readiness result.

If persistent storage has not been confirmed but may be requested, one explicit action may invoke `Workspace.requestDurability`. Until the resulting protection is `Protected` and every other check passes, Plan, Trade, Journal, Mark, reference/configuration, Workspace initialization, and Restore-apply controls remain unavailable.

An `Unsupported` view names each failed readiness check, explains that the application will not risk new journal data in the current environment, offers safe retry where meaningful, and recommends another browser. A `Recovery Only` view preserves ordinary reading, history navigation, and backup export when the existing Workspace is readable while disabling every authoritative mutation and Restore application with one clear reason. It states that another browser has separate storage and requires a completed backup/Restore to transfer data. The UI presents Backup Complete only for a Completed export carrying `CompletedBackupReceipt`; failed, initiated-only, or unconfirmable transfers are Not Completed and are never presented as a usable backup.

When a known or possible existing root cannot be read, the UI pairs `Unsupported` Runtime Readiness with Integrity Blocked Workspace status. It warns that journal data may already exist, offers only safe retry/recovery actions, and never presents empty-workspace initialization, import, Restore application, overwrite, or a completed-backup claim.

## Forms and evidence capture

- Every control has an accessible name and understandable validation.
- Single-choice Prompt chips behave as a radio group under a labelled fieldset; filter chips expose toggle/filter semantics rather than pretending to be form answers.
- Touch targets and spacing support phone use.
- The UI renders the exact Entry Definition revision loaded for a form and submits stable Prompt/Option identities.
- A forward-only configuration revision does not silently replace an already rendered form.
- Opening, focusing, typing, selecting, or abandoning a form is not saved evidence.
- A successful explicit Save is the persistence boundary and returns clear confirmation plus the revision-bound post-commit state needed to render the saved outcome and continue that workflow without another read.

Daily Review returns Hold preselected only as unsaved form state. Pressing the one visible Save completes the fast Hold path. Exit, Roll, and Adjust require Intent. Missing Action is visibly incomplete and never rendered as Hold.

## Trade and Journal presentation

Trade presentation must distinguish Plan, Planned Leg, Position Change, Execution, Position, and Lot Match. “Fill” may be used as plain-language explanatory copy only where it cannot confuse an Execution with a Position Change; canonical headings and audit labels use Execution.

Trade Detail shows stored Lifecycle State, derived Terminal Disposition, optional Close/Abandonment Reason, and any integrity disagreement as separate concepts. It includes independent calculation availability, exact observation dates/source, Stale context, correction indicators, and View history.

Journal timelines display Entry Type, exactly one Anchor, Source, moment/authored time where relevant, Edit/Void indicators, Addendum relationships, and Debt/decline status without inventing incomplete Entries. Historical Prompt/option labels remain visible. See the layout references for [Journal timeline narrow](../reference/ui-screenshots/proto-journal-timeline.png), [wide](../reference/ui-screenshots/proto-journal-timeline-desktop.png), [Trade Journal narrow](../reference/ui-screenshots/proto-position-journal.png), and [wide](../reference/ui-screenshots/proto-position-journal-desktop.png).

## Numbers, availability, and graphs

Exact values in read models remain unrounded; presentation rounding must not change classification or calculation. Always show units and sign where ambiguity is possible.

`Value`, `Unbounded`, `Unavailable`, and `Not Applicable` are rendered distinctly. A covered subtotal is labelled as such. Missing expected evidence shows the exact Instrument/date and optional older Stale context; it never displays fill cost or zero as current valuation. Acknowledged Unavailable is visibly a trader acknowledgment, not a price.

Replay renders an exact Daily Bar as a candle, a close-only Mark as a point, and absence as a gap. Lines never bridge a dependent missing value. Every graphed number has a readable textual equivalent or accessible description. Mark-to-Market replay and Expiration Payoff remain separate views.

The [spread detail](../reference/ui-screenshots/proto-position-detail-spread.png) and [statistics reference](../reference/ui-screenshots/proto-stats.png) inform density and hierarchy only. Their arithmetic, “adherence,” equity curve, filters, and terminology are not product semantics.

## Corrections and destructive actions

Ordinary correction uses Edit → Save and keeps View history available. Replace, Void, and Rebuild consequences are previewed when material, with affected Trades/calculations/history stated in plain language. Old identities remain navigable and visible audit is never hidden behind a technical log.

Restore clearly says it replaces the entire current Workspace, shows validation/migration/repair findings and exact counts, requires explicit confirmation, and offers a safety backup when data exists. Only a `CompletedBackupReceipt` bound to the exact live target satisfies that safety choice; declining the backup requires separate acknowledgment. Restore preparation is visibly nonmutating; failure confirms that current data is unchanged.

## Screenshot limitations

Do not copy these prototype behaviors into the product:

- position-risk arithmetic shown 100 times too large for stock;
- cost basis presented as a full loss at an unchanged Mark;
- a close control that does not record a Position Change;
- adherence shown before actual entry or as a composite score;
- screenshot ranges/custom date controls beyond approved Report Periods;
- “Position” used for the Trade campaign or Journal Anchor;
- lifecycle/settlement inferred from UI state;
- any coach/Insights surface in the MVP.

Screenshots also omit complete settlement, correction, Daily Review, backup/Restore, and error-state behavior. Absence from the references does not relax the normative contracts.

## Accessibility and responsive acceptance

An evaluated product must demonstrate keyboard-only completion of core workflows, programmatic names/roles/states, logical focus after navigation or validation, readable zoom/reflow, non-color error/status cues, equivalent narrow/wide actions, and state-preserving live resize. Automated checks support but do not replace manual behavior verification.

See [Delivery contract](delivery-contract.md) and [Acceptance contract](../acceptance/acceptance-contract.md).
