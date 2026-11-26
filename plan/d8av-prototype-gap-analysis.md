# D8aV — prototype gap analysis (read-only review)

Decision context: the trader observed that Trade Detail, Review and replay do not look like the prototypes. Review performed 2026-11-26 against the three **current** prototype files, with `plan/vertical-deliverable-plan.md` decision log and `specs/reference/ui-screenshots/index.md` as authority rules. No code was changed by this review.

## Variants treated as current
- `prototypes/trade-detail/index.html` — **C. Cockpit** (the developed variant; carries the D08P additions and the seven extra states). A/A2/A3/B are references only.
- `prototypes/replay/round-2.html` — **1. Corridor**, last session. The other five variants are not in scope.
- `prototypes/review-coach-mockup/index.html` — single screen; scenario bar, Phone toggle, "Coach numbers", "15 suggestions" are mockup chrome.

## Cross-screen finding
The implementation faithfully transcribes the prototypes' **information and domain semantics**, including P1–P5, but omits nearly all **composition mechanisms**: columns/rails, tabs/drawers, SVG tracks and meters, comparison/session tables, chips/popovers, badges/steppers and overlays. This is structural, not CSS polish.

## Trade Detail — gaps
Current: one flat `section.card` with 13 stacked `<h4>/<p>/<ul>` sections (`src/ui/complete-detail-view.tsx:24–135`); no rail, tablist, table, SVG or badges.

| Gap | Prototype | Current | Severity |
|---|---|---|---|
| Sticky 320px State of play rail + two-column cockpit, phone collapse | `trade-detail/index.html:1026–1036`, CSS `241–243,272–276` | single card; `styles.css:9` caps shell at 960px | High |
| Large P&L figure, since-last-Mark, open-contract line, closed result kv | `:1030–1033,805–808,943,972` | one Entry/previous/current line at `complete-detail-view.tsx:32–33` | High |
| Six drawer tabs with counts and one tabpanel | `:743–745,1022–1023,1037–1041` | no `role="tablist"` in `src/ui` | High |
| Price tracks with Stop/Target zones, entry/prev/now markers | `:494–504,522–524,802,865` | text line at `complete-detail-view.tsx:35–36` | High |
| Comparison table previous/Today/Change with signed delta | `:482–488,802,902` | same text line | High |
| Payoff SVG with legend, break-even and max loss | `:571–583` | text + extrema list at `complete-detail-view.tsx:41–52` | High |
| Lots table, fee reconciliation, execution journal | `:533–537,866–867,948–950` | counts only at `:38–39`; data exists in `domain/complete-detail.ts:76–81` | Medium |
| Two Plan/Risk kv groups including slippage and actual R | `:545–556,868–869` | collapsed into one line | Medium |
| Price History sessions-as-columns with `—` gaps and Review link | `:763–769,816` | two-column `<ul>` at `:69–77` | Medium-High |
| Horizontal session rail with scroll controls and gap cards | `:771–781`, CSS `217–238` | flat `<ul>` at `:94–103` | Medium-High |
| Journal as dated cards with badges, Due now and Answer | `:598–604,771–780` | `key · kind · source` lines at `:79–84` | Medium |
| Needs you as alert/due/info chips | `:75–79,760` | plain `<li>` at `:86–89` | Medium |
| Full-width integrity banner with findings table | `:991`, CSS `260–263` | one `<p>` at `:91–92` | Medium-High |
| Identity badges and action links | `:756–757,805` | four-field text at `:28–30` | Medium |
| Footer copy, clock line, `data-gap` styling | `:609,1069`, CSS `223` | absent; `data-gap` set but unstyled | Low |

Intentional: no composite adherence score/grade (P4, `plan/vertical-deliverable-plan.md:26`; `specs/reference/ui-screenshots/index.md:16–18`). The six canonical descriptive figures are the correct substitution. Read-only D8a scope can justify omitting `Record entry`/`Record exit`, but this is not logged.

## Replay — gaps
Current: no replay screen — a bare slider plus one line in the complete-detail card (`complete-detail-view.tsx:94–113`) and plain advisory text (`:115–134`).

| Gap | Prototype | Severity |
|---|---|---|
| Sticky control bar, step buttons, `n of N`, six tabs | `replay/round-2.html:229–241`, CSS `59–65`, `649–658` | High |
| Corridor chart: two rails, banked/open fill, cross-hatch, at-stake beam, execution diamonds, missing bands, cursor, click-to-seek | `:1003–1120,850`, CSS `205–209` | High |
| Result-coloured status strip with figure, R and stake sentence | `:247–248,1224–1250` | High |
| Sticky 320px readout with six kv groups and badges | `:255,1360–1414` | High |
| IV/share-equivalent chips with popover charts, days/position chips | `:1291–1308`; also P3 wording | High |
| Split bar with named underlying/time/volatility and `estimate` | `:1252–1288` | High |
| Every-session table with Plan row and all advisory columns | `:257–260,1416–1445` | Medium-High |
| Key-moment selector and Next moment | `:1153,1183–1184` | Medium |
| Legend key and plan line | `:252,254,1449–1456,1564–1565` | Medium |
| About/story/generator folds, hover tooltip | `:262–269,1497–1515,1604–1613` | Low |

Intentional: mark-only replay with explicit gaps, no interpolation or OHLC input (`plan:20,303,313`); advisory IV stays advisory-only (P3); no provider candles. The prototype's generator-input table is non-authoritative demonstration scaffolding. **P3 explicitly names chips**, so the missing chip UI is an unexplained presentation miss.

## Daily Review — gaps
Current: heading + four family chips + gate line + inline per-trade Mark fields and four action pills (`App.tsx:1334–1446`); Close Review is a plain form on Closed detail (`:1258–1317`).

| Gap | Prototype | Severity |
|---|---|---|
| Consolidated Marks card/table, Save Marks/Discard, no-price flow | `review-coach-mockup/index.html:1095–1106,1024–1040,1090` | High |
| Day card with stepper, primary Next, "Day so far", trade list | `:965–984`, CSS `62–80` | Medium |
| P2 `Complete, settlement to record` chip and summary `<dl>` | `:985–1019,1009` | Medium |
| Trade-card header grid with P&L, change, small SVG meter, todo | `:724–728,900–919` | High |
| Two-column planNow panel with big SVG Stop/Target meter | `:777–826` | High |
| Replay strip with Replay button on each trade | `:829,911,948` | High |
| Action area with conviction/decided-against/Discard and decisions trail | `:836–875` | Medium-High |
| P1 gate as locked box with "Enter it" link | `:912`, CSS `178` | Medium |
| Closed group with Plan vs What happened table and Write/Decline | `:924–961,1213` | High |
| Full-page replay / Close Review overlay | `:1152–1195`, CSS `193–220` | High |
| Most-pressing-first card ordering | `:1212`, `rankTrades` at `530` | Medium |
| Settlement block / expiration routing UI | `:878–898` | Low (staged) |

Intentional: nav labels and coach chrome are non-authoritative; P1/P5 semantics are correct; settlement UI is staged for later deliverables; there is no reliable Daily Review screenshot reference (`specs/reference/ui-screenshots/index.md:29`), so the prototype is the sole presentation source.

## Decision
Create D8aV, ordered Trade Detail → Replay → Daily Review, with full visual fidelity per prototype, one commit and one fresh prototype-based critic per task. See `plan/d8av-task-breakdown.md`.
