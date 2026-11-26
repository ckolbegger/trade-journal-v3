# Deliverable 8aV — prototype visual fidelity

## Scope and authority
D8aV is a new deliverable authorized by the user after D8aR and the two post-release fixes. It sits **before D9** in the frozen sequence; no D9 research, planning or code is started until D8aV is released. Frozen `specs/` and frozen `plan/d*.md` files are read-only; D8aV records its decisions only in new `plan/d8av-*.md` files. DEV-001 still applies (loopback evidence only, never production HTTPS).

This deliverable changes **presentation only**. It does not add domain facts, writes, commands, provider data, coaching, prediction, model pricing or new capabilities. All existing D1–D8a domain results, receipts and acceptance scenarios remain byte-equivalent. The authoritative visual sources are the three current prototypes:
- `prototypes/trade-detail/index.html` — use the **C. Cockpit** variant; A/A2/A3/B are references for inherited mechanisms only.
- `prototypes/replay/round-2.html` — use the **1. Corridor** variant, last session; other five variants are references, not scope.
- `prototypes/review-coach-mockup/index.html` — single screen; scenario bar, Phone toggle, "Coach numbers" and "15 suggestions" are mockup chrome, not product content.

`plan/d8av-prototype-gap-analysis.md` records the review that motivated this deliverable. D0 gives prototypes precedence over the spec for presentation; the decision log at `plan/vertical-deliverable-plan.md:15–30` and `specs/reference/ui-screenshots/index.md` constrain what is non-authoritative.

## Decisions taken with the user
1. **ID/position:** D8aV, before D9.
2. **Scope:** full visual fidelity for each prototype, not a high-priority subset.
3. **Cadence:** one task, one commit, one fresh prototype-based critic per prototype; push after each task; no per-task tag.
4. **Advisory visuals:** implement the prototype's IV/share-equivalent chips, popovers and split bar as **presentation only** under P3 — estimate-labelled, no prediction/coaching, no feedback into valuation, P&L, risk/reward, Stop/Target, payoff, Daily Review completion or reports.
5. **Review overlay:** build the prototype replay / Close Review overlay in Daily Review, reusing existing domain commands. The old Close Review form on Closed detail is removed if the overlay leaves it with no callers; otherwise it becomes a thin link into the overlay. No new close semantics.

## Rules inherited from D8aR
- **Replace, not parallel-add.** Old markup is deleted in the same change. A component survives only if it still has callers and only translates to the new composition. No "flat + cockpit" dual rendering.
- **Tests migrate, not vanish.** A test moves to the new interface when the behaviour still holds; it is removed only when its subject genuinely no longer exists. Every removed test's scenario reappears in new tests or the critic flow.
- **Critic waits.** A task is not finished until its fresh critic reports and any defect is fixed. Do not start the next task's source work while a critic is running.
- **One commit at the end of each task**, after all suites and the critic verdict.

## ADR and decision-log boundaries
- **P4 (figures):** adopt the prototype's card hierarchy, density and figure placement. Do **not** add composite adherence, weighted grade or good/bad judgement; keep the six canonical descriptive figures.
- **P3 (advisory IV):** chips/popovers/split bar are visual only and must carry the existing "Estimate only" disclaimer.
- **P1/P2:** keep the Action Save gate; present it as the prototype's locked box with an "Enter it" link. Render P2's `Complete, settlement to record` chip.
- **P5:** deferred Close Review remains a due Debt answered from Review; the overlay changes choreography, not routing.
- **ADR 0001:** the UI still consumes finished reads and complete commands; no new store joins or domain calculations in view components.
- **Non-authoritative:** prototype nav labels, adherence numbers, `+$0`/`+0%`, "Close position", Insights, stock multiplier arithmetic, coach annotations and generator inputs are not copied.

## Ordering and ownership
1. **V1 — Trade Detail cockpit** (foundation: rails, drawers, tracks, tables, payoff chart, session rail).
2. **V2 — Replay visualization** (reuses V1's track/chip/table primitives; adds chart, readout, control bar, overlay-ready components).
3. **V3 — Daily Review** (reuses V2's replay overlay and V1's meter/track primitives; adds day card, Marks table, trade cards, closed group).

Shared UI primitives are extracted only when the second prototype actually needs the same mechanism; no speculative component library. Each task owns its seam and its tests.

---

## V1 — Trade Detail cockpit

**Files:** `src/ui/complete-detail-view.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`, new focused UI files under `src/ui/` as needed. Domain `src/domain/complete-detail.ts` is consumed unchanged.

**Target composition (C. Cockpit):** full-width integrity banner when findings exist; a sticky 320px **State of play** rail with Identity (badges + action links where a real command exists), large P&L with since-last-Mark and open-contract line, Conditions (Stop/Target pills, nearest chip, price tracks with entry/previous/now markers and end values, worst case/max reward), and Needs you chips; a right column with a six-tab `role="tablist"` (Today, Position, Plan and Risk, Price History, Journal, Payoff) and one tabpanel. Today carries a previous/Today/Change comparison table plus option and underlying price tracks; Position carries lots, fee reconciliation and execution journal; Plan and Risk carries two kv groups; Price History carries sessions-as-columns with `—` gaps and an "Enter Marks in the Review" link; Journal carries a newest-first horizontal session rail; Payoff carries the intrinsic SVG curve. Collapses to one column under 860px.

- `describe("Trade Detail cockpit")`
  - `it should render a sticky State of play rail with identity, P&L, Conditions and Needs you cards`
  - `it should render six drawer tabs with counts and one active tabpanel, with a state-specific initial drawer`
  - `it should draw Stop/Target tracks with entry, previous and now markers for option and underlying`
  - `it should render the comparison table with previous, Today and Change columns`
  - `it should draw the intrinsic payoff SVG and keep its break-even and extrema identical to the domain result`
  - `it should render sessions as columns in Price History with explicit gaps and no interpolation`
  - `it should render the newest-first session rail with scroll controls and gap styling`
  - `it should render the full-width integrity banner with findings and read-only copy`
  - `it should keep the six canonical descriptive figures and add no composite score`
  - `it should write no Trade, Journal or Market fact on any tab, scroll or link interaction`
- **Red/green:** `npx vitest run tests/unit/trade-detail-cockpit.test.ts -t "<case>"` and `npx playwright test e2e/d8av-detail-cockpit.spec.ts -g "<case>"`.
- **Removal:** delete the flat single-card section list in `complete-detail-view.tsx`; no parallel "simple view" survives. Tests of the old flat layout migrate to the new tabbed structure; scenarios not represented in the prototype are re-asserted in the new tests.
- **Critic flow:** `plan/d8av-v1-critic-brief.md` — fresh critic compares the live cockpit to `prototypes/trade-detail/index.html` C at wide and 480px: rail, tabs, tracks, comparison table, payoff SVG, session rail, integrity banner, figure labels, no adherence score, no store writes.

## V2 — Replay visualization

**Files:** `src/ui/complete-detail-view.tsx`, new `src/ui/replay-view.tsx`, `src/ui/replay-*.tsx` as needed, `src/ui/styles.css`. Domain `src/domain/session-series.ts`, `replay.ts`, `advisory-frames.ts` consumed unchanged.

**Target composition (1. Corridor):** sticky control bar (Price action segmented control, `‹/›` step buttons, slider, `date · n of N` label, six visualization tabs); two-column layout with a flexible hero card and a sticky 320px readout; hero contains result-coloured status strip with large figure and stake sentence, the mountain/result chart between Stop and Target rails with missing-Mark bands, execution diamonds and session cursor, the move split bar with named underlying/time/volatility segments and `estimate` badge, IV/share-equivalent chips with popover mini-charts plus days-to-expiry and position chips, legend, and plan line; readout contains session heading/badges and kv groups for result, at-stake, Marks, Position, why-the-call-moved and The Plan. Below: every-session table, "About this visualization", story and generator folds. Only Corridor is in scope; the other five prototype tabs are not implemented. The prototype's generator inputs are demonstration scaffolding and must not become product UI.

- `describe("replay visualization")`
  - `it should render a sticky control bar with step buttons, slider, session position label and tablist`
  - `it should draw the Corridor result chart with two rails, missing-Mark bands, execution markers and a click-to-seek cursor`
  - `it should render a result-coloured status strip with figure, R and at-stake sentence from existing reads`
  - `it should render the sticky readout kv groups without inventing facts`
  - `it should render advisory IV and share-equivalent chips with popover charts labelled Estimate`
  - `it should render the split bar with named underlying/time/volatility parts and no prediction`
  - `it should render the every-session table with a Plan row and explicit gaps`
  - `it should keep mark-only replay: one point per session, no interpolation, no OHLC input`
  - `it should write nothing on seek, tab change, popover open or navigation`
- **Red/green:** `npx vitest run tests/unit/replay-view.test.ts -t "<case>"` and `npx playwright test e2e/d8av-replay.spec.ts -g "<case>"`.
- **Removal:** delete the bare range slider and the plain advisory text lines from the complete-detail card; replay becomes its own view reached by an explicit control. Old scenario tests migrate to the new view.
- **Critic flow:** `plan/d8av-v2-critic-brief.md` — fresh critic compares the live replay to `prototypes/replay/round-2.html` Corridor: control bar, chart, status strip, readout, chips/popovers, split bar, session table, explicit gaps, estimate labels, no writes.

## V3 — Daily Review

**Files:** `src/ui/App.tsx`, new `src/ui/review-view.tsx` and overlay components under `src/ui/`, `src/ui/styles.css`. Domain `review-controller.ts`, `close-review-controller.ts`, `review-order.ts` consumed unchanged; existing commands reused.

**Target composition:** day card (date, "N Trades · X Marks, Y Actions … to go", three-step stepper with now/ok, primary Next button, "Day so far", two-column trade list, P2 completion chip and summary `<dl>`); consolidated Marks card/table with previous/optional/today columns, dashed inputs, Save Marks/Discard, "Can't get a price" and large-change confirmation; "Trades · most pressing first" group of expandable trade cards with header grid (symbol, position, chips, P&L, change, small meter, todo), last-decision/reflection lines, P1 locked gate with "Enter it" link, two-column planNow panel with larger SVG meter, replay strip with Replay button, Action area with choice/why/conviction/decided-against/Discard and a "Your last decisions" trail; "Closed · Close Review" group with status chips, Plan vs What happened table, replay strip and Write/Decline controls; full-page overlay with key-moment selector, slider, chart, readout and guided Close Review form. No coach suggestions or LLM judgement. Replay and Close Review reuse existing reads/commands.

- `describe("Daily Review prototype composition")`
  - `it should render the day card with stepper, primary Next action and P2 completion chip`
  - `it should render a consolidated Marks table with per-row feedback, no-price flow and Save Marks/Discard`
  - `it should order trade cards most pressing first and render the header grid with a metered figure`
  - `it should render the planNow two-column panel with Stop/Target meter and explicit gaps`
  - `it should keep the P1 gate until Marks are resolved and show the locked-box presentation`
  - `it should render the replay strip and open the overlay through existing read-only commands`
  - `it should render the Action area with conviction and a last-decisions trail without new facts`
  - `it should render the Closed group and the guided Close Review overlay reusing existing save commands`
  - `it should settle a deferred Close Review from the overlay and agree with Closed detail`
  - `it should write nothing on expand, tab, overlay open or seek, and only the existing command on save`
- **Red/green:** `npx vitest run tests/unit/review-view.test.ts -t "<case>"` and `npx playwright test e2e/d8av-review.spec.ts -g "<case>"`.
- **Removal:** delete the flat Review section and the old Closed-detail Close Review form if the overlay replaces it; any surviving link becomes a thin adapter. Do not keep both forms as parallel paths.
- **Critic flow:** `plan/d8av-v3-critic-brief.md` — fresh critic compares the live Review to `prototypes/review-coach-mockup/index.html`: day card/stepper, Marks table, trade cards/meters, P1 gate, planNow, replay strip, closed group, overlay, P2 chip, P5 settlement, no coach suggestions, no extra writes.

## Cumulative verification before each critic
`npm run test:all`, `npm run test:integration`, `npx playwright test`, `npm run lint`, `npm run typecheck`, `npm run typecheck:6`, `npm run build`, production offline test. Every critic defect gets a failing test first, then a fix, then all suites, then a fresh repeat critic. Do not begin the next task's source work until the current critic has reported.

## Acceptance for D8aV
- All three prototypes' documented high/medium gaps are closed at wide and narrow widths; low-priority copy gaps are closed where non-authoritative content is excluded.
- Current domain results, commands, receipts and D1–D8a acceptance scenarios are byte-equivalent; no new facts or writes.
- P1–P5 and ADR decisions are honoured; prototype non-authoritative content is not copied.
- Every task has RED→GREEN tests, full suites, a fresh prototype-based critic with 0 FAIL, and its own commit pushed to `Hy4-Flash`.
- No D9 research, planning or code starts before D8aV is released.

## Release
After V1–V3 are each committed and pushed, write `plan/d8av-execution-record.md`, create an annotated tag `hy4-flash-d8av-complete` on the final D8aV commit, push and verify with `git ls-remote`, then restart the dev server for the user.
