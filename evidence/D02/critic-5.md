# D2 UI-alignment critic report (critic-5, gate T2.55)

Fresh critic agent spawned 2026-10-25 at commit `b3392bb`, after batches B–D of `plan/D02-ui-alignment.md` and their bug tasks, with the cumulative run fully green (`suite-runs/t2.54-b4-*.txt`). It ran C2.1, C2.5, C2.7, C2.10 and C2.11 from D2 section 7, then CU.1–CU.5 from the UI-alignment breakdown, section 7. The critic stopped once at the session usage limit, during C2.10, and was resumed from where it stopped.

**Overall: FAIL.** Five defects (D1–D5).

## 1. Header

- **When:** 2026-10-25, about 10:34–21:44 EDT, with a pause for the usage-limit reset.
- **Commit:** `b3392bb`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0; Playwright 1.63.0; Chromium 153.0.8010.12 (headless, `profileAt(...).launch`, America/New_York).
- **Servers:**
  - `npm run build:faults && npm run preview:faults` (5175) for C2.10, then stopped.
  - `npm run build && npm run preview` (5175) for every other flow. For C2.11 it was killed (pid 2416) to go offline and started again (pid 81691); now stopped.
  - `lsof`/`pgrep`: nothing listens on 5175. The user's manual-testing server on 5180 (pid 80233) was not touched. A `vite preview` from a different worktree (pid 82053) exists and is not the critic's.
- **Tracked files:** none edited; `git status --short` printed nothing. Scripts, profiles and screenshots are in `test-results/critic-d02-5/` (git-ignored).

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C2.1 | PASS | Recorded 60 @ 50.10, fee 1.00 by hand on the 100-share Plan (50 / 47.50 / 56) and completed the reflection. The Detail shows "Long Stock · Open", "Position 60 shares of XYZ", one Open Lot (2026-10-12 10:00, 60, $50.10, $1.00), "Quantity 60 of 100 shares" and "Entry not yet resolved". The Planned tab dropped XYZ; the Open row reads "XYZ · Long 60 shares @ $50.10 · $3,007.00 · Entering · 60 of 100 · Fidelity — Roth IRA". |
| C2.5 | PASS | One submission had Execution 1 with quantity 0 and a time before the Plan time, Execution 2 with a future time, and a blank Decision mode. The summary "This entry can't be saved yet" listed all four issues at once, and focus moved to the summary. After a reload the store was unchanged: 0 Position Changes, lifecycle Planned, 0 reflections, 0 declines. |
| C2.7 | PASS | Trades opens on the Open tab at `/`. Entries at 10:00 (XYZ), 11:30 (ABC) and 10:30 (DEF), recorded in that order, list as ABC, DEF, XYZ (Last Activity descending). A half-filled entry form, then a reload, left the `trades` and `journalEntries` stores byte-identical. |
| C2.10 | PASS | Faults build with `?faults=inventory`: the "Read only: this browser can't save right now" panel shows, the navigation is Trades / Accounts / About only, and the Open list and Detail read correctly at 1280 and 390. The Detail has no Record entry link; `/trades/<id>/record-entry?faults=inventory` shows "Record entry isn't available". |
| C2.11 | PASS | With the server stopped, a reload works. An entry recorded offline by keyboard only (date typed into the segmented time field), with resizes 390 → 320 → 1280 on a half-filled form; values and the chosen chip survived. Focus visible on every Tab stop (`tabTo`). The receipt appeared, and the entry was still there after a second offline restart. About lists only D1/D2 operations and "Schema version 2". |
| CU.1 Shell | PASS | Trades, New Plan, Detail, Record entry, Accounts and About at 1280, 390 and 320. Exactly one `aria-current="page"` each time, Trades current on Detail and Record entry. Wide: the current item is an ink pill (rgb(28,27,25)) with white text; narrow: bold (800). "Trade Journal" wordmark in the sidebar; every link has an `aria-hidden` SVG icon. Banner tinted rgb(255,244,221), 88 / 93 / 150 px tall at 1280 / 390 / 320. Banner, `h1` and first block share x=286 at 1280 and x=16 at narrow; no page overflow; first run and onboarding keep 16 px gutters at 375 and 320. |
| CU.2 Trades | FAIL (D3, D4) | `h1` "Trades" with no header New Plan. The Planned Empty state offers "New Plan"; the Open Empty state offers "Show Planned Trades". At 320, Underlying stays pinned at x 16–96 before and after scrolling fully right, while the Trade cell moves from x 96 to x −226. Underlying plus the two-line Trade cell fully visible at 320 and 375; scroll shadows show; the focused link's outline is not clipped. Each figure appears once in the accessibility tree per width. Trade text matches section 2a ("Long 120 shares @ $50.32", "Net cost $6,041.00", "1R $250.00 · Reward : risk 2.4"); Net cost equals the Detail. Tab and URL (`/?lifecycle=Planned`) survive live resizes 390 / 1280 / 320. axe clean at 320 and 375. |
| CU.3 Forms | PASS (see D5) | New Plan has regions Trade, Risk and Plan Reflection, each with exactly its controls; Risk inputs two per row at 390 and 1280. Checked chip ink-filled with white text; the radio is 1×1, opacity 0, focusable; a focused chip shows a 3 px rgb(31,95,191) outline; fieldsets borderless. Execution panels tinted, radius 14 px, borderless: Quantity / Price / Fee in one row at 1280, two per row at 390, Economic Time on its own row. U4: Symbol, Quantity and two thesis issues cleared on typing, the summary stayed while any issue remained, focus stayed in the field. In Record entry the Quantity issue cleared; the server issues (time before Plan, future time) stayed until resubmit, as planned. Keyboard-only decline with a reason saved: "Reflection declined: In a hurry." |
| CU.4 Detail | FAIL (D1, D2) | Stop red rgb(163,38,27) and Target green rgb(29,107,52), both labelled, 18 px, weight 700, tabular. The Open summary leads with "Long 120 shares @ $50.32", a "Deviation active" badge and "Net cost $6,041.00". "Executions (4)", no table, rows collapsed by default with `aria-expanded` and `aria-controls`; mouse toggles; Enter and Space expand and keep focus. Expanded rows show Instrument, Economic Time, Fee and "Position Change 2026-10-12 10:00 · 2 Executions" with its reflection, or "Reflection declined · Reason: Busy at the open.". Grouped rows read "Same Position Change · 1 of 2" / "2 of 2". "Journal (4)" items show the Entry Type badge, Anchor "Trade XYZ", "Source Plan Confirmation" or "Position Change", Moment and Authored. The incoherent Detail leads with "Records disagree" and has no summary card or Record entry. Back to Trades returns `/` from Open and `/?lifecycle=Planned` from Planned. The Planned Detail summary card has no Trade Summary text. |
| CU.5 Reference comparison | FAIL (D2) | Most high items resolved: shell identity, Trades `h1`, compact Executions, summary card present, Execution panels, New Plan cards, banner and alignment. Part of the high "Summary card" item remains (D2). |

**README check (T2.54's reconstructed 17 screens).** The comparison report has no numbered list. Its sections are Trades list, New Plan, Planned Detail, Open Detail, Journal region, Record entry, Reflection, Receipt, and "First launch, onboarding, Accounts and About". The README splits Trades list into empty, planned and open; New Plan into blank, errors (from the report's own "Observation") and filled; Record entry into blank and filled; and the last section into four screens. That makes 17, covering every section with no extra screen, and the pairings agree with the index (Reflection mapped to the entry composer). Consistent, but only as a reconstruction.

## 3. Overall: FAIL

**D1 (medium). The Planned Detail summary card does not lead with the Trade Summary.**
- Steps: confirm the reference Plan (XYZ, 100 @ 50, Stop 47.50, Target 56); open its Detail at 1280 or 390.
- Expected: T2.49 case 1, the card leads with "Long 100 shares @ $50.00" for a Planned Trade; section 2a, `tradeSummary` is "used by every list and by the Detail summary card".
- Actual: the card reads only "Intended entry $50.00 / Stop $47.50 / Target $56.00 / 1R $250.00 / Reward : risk 2.4". No summary text anywhere on the Planned Detail, though the Planned list row shows "Long 100 shares @ $50.00". Open Details do lead with it. Captures `cu4-planned-1280.png`, `cu4-planned-390.png`.

**D2 (medium; CU.5). Label/value rows in the summary card and Plan card span the full card width at wide.**
- Steps: open an Open or Planned Detail at 1280.
- Expected: the comparison's high Planned Detail "Summary card" item, "At wide, cap the label/value rows; today the label sits at x 323 and the price at x 1177"; T2.53, "rows capped at 480 px".
- Actual: summary card rows 886 px wide (label x 307, value ends x 1193); the Plan and Position cards also 886 px. Only Plan Baseline and Entry Quality are capped (427 px). In the summary card the "Entry: Resolved / Entering" value sits mid-row (x ≈ 441) while the other values are right-aligned. Capture `cu4-deviation-1280.png`.

**D3 (low–medium; CU.2 "every column's information is reachable"). Last Activity appears nowhere after its column was removed.**
- Steps: open any Open Detail.
- Expected: section 2a, "Last activity still orders the Open list … and the Detail shows it".
- Actual: neither the Detail nor the list contains "Last activity" (0 matches). The value can only be inferred from Execution times.

**D4 (low). An incoherent Open row loses its Net cost at narrow.**
- Steps: an Open Trade whose facts cannot be replayed (fixture `UnknownPlannedLeg` on ABC), in the Open list at 320 or 390.
- Expected: ui-contract Responsive, every width exposes equivalent information; section 2a, the hidden Net cost column's value is carried by the Trade cell's second line.
- Actual: at 1280 the Net cost cell reads "Not available". At 320 the column is hidden and the Trade cell holds only "Not available" plus "Records disagree", with no "Net cost Not available" line. The accessibility tree confirms Net cost is missing at narrow. Capture `cu2-open-integrity-320.png`.

**D5 (low; probably from D1, outside this batch's tasks). The shared price issue is attached to the wrong field.**
- Steps: New Plan with everything valid except Stop left blank; Confirm.
- Expected: ui-contract Forms, understandable validation and correct programmatic states.
- Actual: "Enter prices greater than zero…" appears under Intended entry, which holds a valid 50 and gets `aria-invalid="true"` and a red border. The blank Stop is not marked; Target behaves the same. Filling the actual field does clear the issue (U4 works).

## 4. Minor observations

**Display and timing**
- At 320, 375 and 390 the pinned header "UNDERLYING" breaks mid-word as "UNDERL / YING" (`n-open-375.png`).
- Switching Trades tabs, the previous tab's table stayed on screen for about 33 ms before the Planned content appeared; whether the tab was already marked selected then was not determined.

**Detail and receipt layout**
- Execution rows put "Buy 30 XYZ @" on the left and the price far right, with the time on its own line. The receipt shows "Buy 30 XYZ @ ……… $50.00, fee $0.50", leaving the "@" dangling. In the expanded row, Fee's value sits right-aligned on its own line.
- The Record entry context card has "Not entered yet" on a separate right-aligned line inside a mostly empty card.
- The Planned Detail has no Journal region; the Plan Reflection is its own card. The Open Detail lists it under "Journal (n)".
- The Detail is about 4,020 px at 375; the length is required content (Plan, Plan Baseline, Position and Lots, Entry Quality, Fulfillment, Deviations, Journal).
- The Open Empty state's action is "Show Planned Trades", not New Plan; New Plan is in the navigation and the Planned Empty state.

**Not app defects**
- A raw fixture setting a Planned-only Trade's stored lifecycle to Open (DEF) puts it in neither tab: the edited document lacks `lastActivity`, so it is missing from `byLifecycleActivity`. A test-fixture artifact the app cannot produce.
- Helpers all worked. `page.goto` without `?faults=` turns the faults off, so a direct Record entry URL must carry the query.

**CU.5 classification of the remaining differences**
- **Specs override:** "Trade", "Execution" and "Record entry" wording instead of Position / fill / Add trade; no adherence, P&L, CURRENT price, "away" or "cushion"; no Close position, Done or Insights; pill primaries and dark input borders; About keeps its capability list; New Plan stays one page without Catalyst, Entry range or Exit in (days); Record entry is a dedicated route (U5); the Journal stays inline on the Detail; "Records disagree" only on disagreeing rows; no greeting, count line or header New Plan (U7); one scrolling table at narrow (U1); no live 1R preview (U2).
- **Future:** hero P&L and Mark figures (D4); Close position (D6); Strategy cards on step 1 (D7); the spread per-leg layout (D7/D10); Stats and KPI tiles; the Journal timeline with date groups and filter chips; the standalone Entry composer (D5+); the dashed sidebar "+ New plan" style.
- **Screenshot-only (presentation not adopted):** label/value rows instead of the reference's three-column big-figure summary grid (the uncapped wide rows are D2); the Plan card is a label/value list, not prose with an "Invalidation" sub-heading; Execution rows read "Buy 30 XYZ @ … $50.00" rather than a coloured "BUY 50 × NVDA" with a "50 planned" header count; the back link reads "Back to Trades" rather than a centred "‹ All" chevron; at narrow the primary button is not full-width.

Captures (under `test-results/critic-d02-5/`): `cu4-planned-1280.png`, `cu4-deviation-1280.png`, `cu2-open-integrity-320.png`, `n-open-375.png`, `n-detail-375.png`.
