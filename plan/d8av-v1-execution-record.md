# D8aV V1 — Trade Detail cockpit execution record

Task: V1 of `plan/d8av-task-breakdown.md`. Prototype reference: `prototypes/trade-detail/index.html` C. Cockpit. Frozen `specs/` read-only; DEV-001 loopback only.

**RED first.** `tests/unit/trade-detail-cockpit.test.ts` and `e2e/d8av-detail-cockpit.spec.ts` were written before production code. Unit failed on the missing module; browser showed no `.cockpit`, no tablist and no tracks. After implementing, 4 unit and 4 browser cases passed.

**Implement.** `src/ui/detail-visual.ts` holds presentation-only helpers: `trackBounds`, `trackPercent`, `comparisonRows`, `payoffPolyline`. `complete-detail-view.tsx` now renders the cockpit: integrity banner, sticky 320px State of play rail (Identity + Integrity, P&L + six canonical figures, Conditions with Stop/Target pills and two tracks, Needs you chips), and a right column with six `role="tab"` drawers and one tabpanel (Today comparison table + tracks, Position lots/executions, Plan and Risk groups, Price History table, Journal session rail + timeline + slider, Payoff intrinsic SVG). `styles.css` gained cockpit/track/table/rail/banner rules with a one-column collapse under 860px. No domain result changed; no composite score or model price was added.

**Removal and test migration.** The flat 13-section card was deleted; no parallel simple view remains. Three existing D8a tests asserted sections as simultaneously visible and the slider immediately present; they were migrated to click the owning drawer tab before asserting — every section and the replay scenario remain asserted. No assertion was deleted.

**Verification:** 350 Vitest, 64 integration, 65 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-f8c01c7e5651ea104f8b3b484472d0541db9f098fa921704635330c406c2e34d`.

**Critic round 1:** `plan/d8av-v1-critic-brief.md`, fresh independent subagent. Flow 1 PASS; Flows 2–4 FAIL:
- **Fabricated Mark:** with zero stored Marks the read falls back to `trade.plan.entry`, and the UI presented it as an observed Mark (`Mark 3.00 / 3.00 / 0.00`, `Since last Mark: 3.00`) and as previous/now track markers.
- **Incoherent-state suppression:** with an over-size open (3) and close (4) the derived drawers and all six fulfillment figures stayed visible despite a `Facts can't be replayed` banner.
- **Journal overflow at 480px:** `.rail-x` min-content grew the grid track to ~639px and the page to 674px.
- Additional fidelity gaps: no `Entry, resolved` group, no sessions-as-columns Price History with Review link, blank Journal narrative.

**RED→GREEN repairs.** Added two unit cases (`hasObservedMark`, `visibleDrawers`) and four browser cases (no fabricated Mark; Review link + two Plan/Risk groups; findings suppression; no Journal overflow) before changing source. Fixes are presentation-only: `hasObservedMark` and `visibleDrawers` moved into `detail-visual.ts`; the Today drawer shows a waiting state and suppresses previous/now markers when no Mark is stored; derived drawers and figures are removed when integrity disagrees; Plan and Risk gained an `Entry, resolved` group; Price History is now a sessions-as-columns table with an `Enter Marks in the Review` button; an empty narrative shows `No journal entries yet.`; `.cockpit > * { min-width: 0 }` and `.rail-x { max-width: 100% }` contain the overflow. No domain result was changed. The original comparison-table test now seeds Marks first so it still asserts the real comparison mechanism.

**Verification after repairs:** 352 Vitest, 64 integration, 69 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-db949ac1228e6c09132f572960ec1752f73393f955cf5f1f79f872aae302d578`.

**Critic round 2:** `plan/d8av-v1-critic-brief-r2.md`, fresh independent subagent. All four prior FAILs re-verified PASS (no fabricated Mark; coherent suppression with a full-width banner and three tabs; no horizontal overflow at 480px on any drawer; Price History / Plan and Risk / Journal fidelity). All round-1 regression guards PASS: two-column cockpit, sticky four-card rail, six-tab tablist, tracks, payoff SVG, read-only store counts, six canonical figures at wide and narrow widths, Review link navigates without writes, no forbidden adherence text. HeadlessChrome 158.0.8127.37 on macOS 26.6.2 (25G83); 0 FAIL. V1 is complete.
