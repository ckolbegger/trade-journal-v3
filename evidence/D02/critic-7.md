# D2 UI-alignment critic report (critic-7, gate T2.55)

Saved verbatim from the critic's final message by the main session. critic-6 (on `7f2a1fd`) was stopped by the user before it reported and left no report.

## 1. Header
- **When:** 2026-10-26, about 03:15 to 03:35 EDT.
- **Commit:** `9dc8068`, branch `claude-opus-5.5`.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless, `profileAt(...).launch`, America/New_York).
- **Servers:** I started all of them myself, one at a time, on 5175:
  - `npm run build && npm run preview` (pid 65744) for the main flows. I stopped it to take the app offline for C2.11.
  - `npm run build:faults && npm run preview:faults` (pid 71106) for C2.10.
  - `npm run preview` again (pid 71643) for the Protected and shell checks.
  - All three are stopped. `lsof -iTCP:5175` shows nothing listening. I touched no other process.
- **Tracked files:** none edited. `git status --short` printed nothing. Scripts, profiles and captures are in `test-results/critic-d02-7/` (git-ignored).

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C2.1 | PASS | Starting from the reference Plan, I recorded 60 @ 50.10, fee 1.00 by hand and completed the reflection. The Detail shows "Long Stock · Open", "Position 60 shares of XYZ" and one Open Lot (2026-10-12 10:00, 60, $50.10, $1.00). Summary: "Quantity 60 of 100 shares", "Entry not yet resolved". The Planned tab reads "No planned trades yet". The Open row reads "XYZ · Long 60 shares @ $50.10 · $3,007.00 · Entering · 60 of 100 · Fidelity — Roth IRA". Stored: XYZ Open, 1 Position Change, 1 Execution, 1 reflection. |
| C2.5 | PASS | One submission held Execution 1 with quantity 0 and 09:00 (before the Plan time), Execution 2 with 2027-03-01 (future), and a blank Decision mode. Focus moved to the summary section, "This entry can't be saved yet", which lists all four issues. After a reload the store was unchanged: XYZ Planned, 0 Position Changes, 0 reflections. No overflow at 320. |
| C2.7 | PASS | `/` opens on the Open tab. I recorded DEF at 09:45 after the others and ABC again at 15:00. The list order became ABC, XYZ (14:00), GHI (10:01), DEF (09:45), which is Last Activity descending and not creation order. A half-filled DEF entry form, then a reload: the form came back empty, and the `trades` and `journalEntries` stores were identical. |
| C2.10 | PASS | On the faults build with `?faults=inventory` the navigation is Trades / Accounts / About only. The Open list (1280 and 320) and the Detail (1280, 390, 375, 320) read correctly. The Detail has no Record entry link. The direct Record entry URL shows "Record entry isn't available / This browser can't save right now…". |
| C2.11 | PASS | With the server stopped, `curl` failed and the app reloaded. Keyboard only (`tabTo` checked a visible ring at every stop), I recorded 60 @ 50.10, fee 1, with chips set by Space and arrow keys. Resizing 320 → 1280 → 390 twice mid-form kept the values and chips (As Planned, Calm, 4) and the URL. The receipt appeared. After a second offline launch the Open row was there. About lists only D1/D2 operations. |
| CU.1 Shell (judged against U8) | PASS | Trades, New Plan, Accounts and About at 1280, 390 and 320: exactly one `aria-current="page"` each time. Wide: ink pill rgb(28,27,25) with white text. Narrow: weight 800. "Trade Journal" wordmark in the sidebar; every nav icon is `aria-hidden`. One left edge (x 286 wide, 16 narrow); cards 16 px from the edges at narrow. No overflow. axe clean on all 12 combinations. The storage warning is the icon (see the storage row). |
| CU.2 Trades | PASS | `h1` "Trades" with no header New Plan. The Planned Empty state offers "New Plan" (it works); the Open Empty state offers "Show Planned Trades". At 320 Underlying stays at x 16–96 while the Trade cell moves from 96–296 to −226 to −26 when scrolled fully right. Underlying plus the two-line Trade cell fit inside 304 before scrolling. Each figure is in the accessibility tree once per width. Trade text: "Long 120 shares @ $50.32" / "Net cost $6,041.00", and "1R $250.00 · Reward : risk 2.4". Net cost matches the Detail. The `?lifecycle=Planned` tab and URL survive resizes 1280 / 320. |
| CU.3 Forms | PASS | New Plan has regions Trade, Risk and Plan Reflection. A checked chip is ink rgb(28,27,25) with white text; the radio is 1 px, opacity 0. Corrected issues clear: Symbol, then Quantity, cleared on typing, with focus left in the field and the summary gone once none remained. In Record entry the quantity issue cleared on edit. A keyboard decline with "In a hurry." saved ("Reflection declined: In a hurry."). New Plan errors show no overflow at 390 and 320. |
| CU.4 Detail | PASS | Planned, entering (ABC), resolved with an active Deviation (XYZ), and incoherent (GHI): summary card details are in the critic-5 recheck rows below. Executions: the region is "Executions (4)" with 4 buttons, collapsed (`aria-expanded=false`, `aria-controls`). Button names: "Buy 30 XYZ @ $50.00 2026-10-12 10:00 details". Grouped rows read "Same Position Change · 1 of 2 / 2 of 2". Mouse toggles open and closed. Enter and Space toggle and keep focus (3 px rgb(31,95,191) outline). Expanded rows show Instrument, Economic Time, Fee and "Position Change 2026-10-12 10:00 · 2 Executions" with the reflection answers, or "Reflection declined / Reason: Busy at the open." No overflow or clipping at 375 and 320; axe clean at 1280 and 320. "Journal (4)" items show the Entry Type badge, "Anchor Trade XYZ", "Source Plan Confirmation" or "Position Change", Moment and Authored. Back to Trades returns `/` (Open) from ABC and `/?lifecycle=Planned` (Planned) from DEF. |
| CU.5 Reference comparison | PASS | Every high item in `screenshot-comparison.md` is resolved or overridden by a recorded decision (narrow cards → U1). Remaining differences are classified in part 4. |
| Critic-5 D1 | Resolved | The Planned Detail card leads "Long 100 shares @ $50.00", right after Confirm Plan and after a reload. |
| Critic-5 D2 | Resolved | At 1280 every summary-card row is 480 px wide, and all values end at x 787. Plan, Plan Baseline, Position and Entry Quality rows are 427 px. The only wider rows are the Fulfillment row and the Journal answer rows (787 px), which are left-aligned text, not right-aligned figures. |
| Critic-5 D3 | Resolved | The Open Detail Position card shows "Last activity 2026-10-12 14:00" (XYZ) and "2026-10-12 11:30" (ABC). |
| Critic-5 D4 | Resolved | The incoherent GHI row at 320, 375 and 390 shows "Not available · Records disagree / Net cost Not available", and the accessibility tree includes it. |
| Critic-5 D5 | Resolved | New Plan with a blank Stop marks only Stop invalid; a blank Target marks only Target. Filling the field clears it. |
| Critic-5 B6 | Resolved | The incoherent JKL Planned row at narrow shows "1R Not available · Reward : risk Not available". |
| Storage warning (T2.60, B1–B4) | PASS | Details below. |

**Storage warning details.**

*Icon position:*
- The icon is on the title row, at its far right, on Trades, a Detail, New Plan, Record entry, the receipt, Accounts and About, at 1280, 390, 375 and 320.
- Its right edge equals the content column's inner right edge: 1214, 374, 359 and 304.
- Its vertical centre equals the `h1` centre (33.4 on most screens).
- It does not overlap the `h1` text: the text ends at x 393 or less at 1280.
- The `h1` top is the same with the icon shown and absent (16 / 47.2 / 39.2 px). I simulated Protected by overriding `navigator.storage.persisted`.

*Icon behaviour:*
- Accessible name: "Storage not protected: see About".
- 44×44 target, focus outline solid 3 px rgb(31,95,191), offset 2 px. Enter on it opens `/about`.
- With protection Protected, neither the icon nor a card appears on any screen.

*About's card:*
- Real headless Chromium declined at once. The notice "The browser declined to promise it will keep your data. You can keep using the journal." took focus (`role=status`), and the notice was still there after leaving and returning to About.
- **Simulated grant** (an init-script `persist()` resolving true after 1.5 s):
  - While pending, focus stays on the button (`aria-disabled="true"`).
  - The result "The browser will now keep your journal data unless you clear it." takes focus.
  - The icon disappears on About and Trades, and the Storage protection row reads "Protected", both right away and after returning.
- **Simulated rejection:** "The browser didn't answer. You can try again." appears, the button works again, and the notice persists across a return.
- A true browser grant could not be obtained headless.

*Elsewhere:*
- First run and onboarding show the compact card and no icon, at 88 / 93 / 112 / 150 px tall at 1280 / 390 / 375 / 320.
- No visible page I loaded contains the word "backup".
- I saw no new problems from the fixes in the Journal, the expanded Executions or the New Plan error states.

## 3. Overall: PASS
**Defects:** none.

## 4. Minor observations
1. **Thousands grouping is inconsistent.** `money()` never groups digits; only `netCost()` does. The same summary card therefore shows "Net cost $30,061.00" beside "Actual initial risk $1561.00". The receipt and Entry Quality show "$1561.00 (6.24R)" and "$3539.00". A price of $1,000 or more would read "@ $1234.00" in the Trade text. ui-contract does not mandate separators, so I don't count it as a defect, but it should be fixed. I found this because my keyboard step (Ctrl+A on macOS moves the cursor to the start of the field) turned 60 into a 600-share QQQ entry. That was my script's mistake, not the app's.
2. **The receipt's icon sits inside the receipt card**, at the card's inner right edge (x 283 at 320) rather than the content column's edge (x 304), because the receipt's `h1` is inside the card. It is still at the far right of its title row. After Save, the receipt `h1` shows a focus box (programmatic focus).
3. **Recovery Only, resized:** measured at 0 ms after a resize to 390, the Detail briefly still had the wide layout (scrollWidth 434). At 500 ms it was correct at every width. This is a transient of the JS layout switch.
4. **Rejected request:** focus stays on "Ask the browser to keep data" rather than the failure line. This was already noted and accepted in T2.60-B3.
5. **Carried over from critic-5:**
   - The pinned header "UNDERLYING" breaks mid-word at 320.
   - Execution rows split "Buy 30 XYZ @" from the price, and the receipt shows "Buy 600 QQQ @ / $50.10, fee $1.00".
   - The Record entry context card has "Not entered yet" alone on the right.
   - Planned-Leg Fulfillment is a plain unaligned row.
   - The Journal reflection answers are a label/value grid, not prose sections.
   - Full-page captures show the sticky sidebar and bottom bar mid-page; this is a capture artifact.

**CU.5 classification of the remaining differences**
- **Specs override:**
  - "Trade", "Execution" and "Record entry" wording.
  - No adherence, P&L, CURRENT price, or "away" / "cushion" figures.
  - No Close position, Done or Insights.
  - Pill primary buttons and dark input borders.
  - About keeps its capability list.
  - New Plan stays one page, without Catalyst, Entry range or "Exit in (days)".
  - Record entry is a dedicated route (U5).
  - One scrolling table at narrow, not cards (U1).
  - No greeting, count line or header New Plan (U7).
  - No live 1R preview (U2).
  - "Records disagree" appears only on disagreeing rows.
  - The storage warning is an icon plus the About card instead of a banner (U8), with no backup advice (decision 2).
- **Future:**
  - Hero P&L and Mark figures (D4).
  - Close position (D6).
  - Step-1 Strategy cards and the spread per-leg layout (D7/D10).
  - Stats and KPI tiles.
  - Journal timeline with date groups and filters, and the standalone Entry composer.
  - The dashed "+ New plan" sidebar style.
- **Screenshot-only (not adopted):**
  - Capped label/value rows instead of the three-column big-figure summary grid.
  - The Plan as a label/value list, not prose with an "Invalidation" heading.
  - Execution rows without a coloured "BUY 50 × NVDA" and the "50 planned" count.
  - "Back to Trades" instead of a centred "‹ All".
  - Primary buttons not full-width at narrow.

Captures in `test-results/critic-d02-7/` include `c21-planned-1280.png`, `detail-XYZ-1280.png`, `detail-XYZ-320.png`, `list-open-320.png`, `exec-expanded-1280.png`, `newplan-errors-320.png`, `record-320.png`, `receipt-320.png`, `about-grant-after-390.png`, `onb-390.png` and `c210-detail-s1280-320.png`.
