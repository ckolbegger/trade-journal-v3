# UI screenshot index

These 24 files are copied once from the canonical prototype capture. Each workflow has a narrow (`.png`) and wide (`-desktop.png`) reference. They illustrate density, hierarchy, cards, controls, and responsive composition only. [UI contract](../../design/ui-contract.md), domain specifications, and the [glossary](../../glossary.md) override screenshot terminology, arithmetic, state, navigation, and missing behavior.

## Capture layouts

The prototype is responsive, and its two layouts differ structurally:

- **Narrow** (`.png`), captured 814px wide: a single-column stack with a bottom tab bar (Home / Journal / New / Stats). Contextual forms slide up as bottom sheets.
- **Wide** (`-desktop.png`), captured 1440px wide: a content column with a left sidebar (Control Center / Dashboard / Journal / New plan). Contextual forms open as right-hand drawers over a dimmed page.

The sidebar destinations map 1:1 to the narrow tabs (Control Center = Home, Dashboard = Stats), and no screen exists in only one layout. The capture widths are not breakpoints, and the navigation labels are prototype labels; the [UI contract](../../design/ui-contract.md) governs layout and navigation.

| Workflow reference | Narrow | Wide | Use and caveat |
|---|---|---|---|
| Home/open Trades | [image](proto-home.png) | [image](proto-home-desktop.png) | Greeting, summary, primary action, Trade rows. “Adherence,” numbers, badges, and nav labels are not authoritative. |
| Stock Trade detail | [image](proto-position-detail-stock.png) | [image](proto-position-detail-stock-desktop.png) | Card hierarchy and dense signed figures. Treat the campaign as a Trade and holdings as Position. |
| Spread Trade detail | [image](proto-position-detail-spread.png) | [image](proto-position-detail-spread-desktop.png) | Multi-leg detail and risk hierarchy. Calculations lose to Trade Analysis. |
| Add Execution | [image](proto-add-fill.png) | [image](proto-add-fill-desktop.png) | Context-preserving form. Sheet/drawer container and “fill” wording are non-normative. |
| Trade Journal | [image](proto-position-journal.png) | [image](proto-position-journal-desktop.png) | Anchored narrative composition. Badge taxonomy and labels lose to Journal semantics. |
| Entry composer | [image](proto-entry-composer.png) | [image](proto-entry-composer-desktop.png) | Prompt/chip presentation and Save boundary. Runtime definition controls exact fields. |
| Journal timeline | [image](proto-journal-timeline.png) | [image](proto-journal-timeline-desktop.png) | Date grouping, cards, and filters. Prototype categories are not canonical Entry Types or Sources. |
| New Plan step 1 | [image](proto-new-plan-step1.png) | [image](proto-new-plan-step1-desktop.png) | Underlying/Strategy selection. Exact Strategies come from Reference Catalog. |
| New Plan step 2 blank | [image](proto-new-plan-step2.png) | [image](proto-new-plan-step2-desktop.png) | Progressive Plan form. Exact Plan completeness and Prompt semantics are normative elsewhere. |
| New Plan step 2 filled | [image](proto-new-plan-step2-filled.png) | [image](proto-new-plan-step2-filled-desktop.png) | Live result hierarchy only. The stock multiplier arithmetic is known-invalid. |
| Planned Trade detail | [image](proto-position-detail-planned.png) | [image](proto-position-detail-planned-desktop.png) | Pre-entry layout. No-fill “adherence” and labels are known-invalid. |
| Statistics/reporting | [image](proto-stats.png) | [image](proto-stats-desktop.png) | KPI/chart density. Metrics, period presets, breakdowns, and any equity curve lose to Performance Analysis. |

The prototype has no reliable close/settlement, correction, Daily Review, backup/Restore, Loading/Empty/Error, or accessibility reference. Those behaviors must be designed from the normative contracts rather than inferred from absence.
