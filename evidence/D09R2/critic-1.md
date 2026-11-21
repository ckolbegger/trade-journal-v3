# D09R2 critic-1 report

**Overall: FAIL.** One high-severity defect: a keyboard-only trader can't reach the cell editor for most cells.

## 1. Header

- **When:** 2026-11-20, 21:24 to 21:35 EST.
- **Commit:** `a95d5c9cf5ce26d0d574d9f8729801d632e9a42e` (branch `claude-opus-5.5`).
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (Playwright's `chromium` channel, headless).
- **Servers:** `npm run build`, then `vite preview --port 5175 --strictPort` run through `.claude/scripts/with-browser-lock.sh`. I started it twice (the second time for one re-check) and stopped it both times. Port 4175 was never used.
- **Profiles:** a fresh profile for every script, under `test-results/critic-d09r2-1/profiles/`.
- **Files:** scripts and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d09r2-1/`. No tracked file was edited and nothing was committed. `git status` is the same as at the start (only the `evidence/D09/coach-review-2-prompt.md` that was already there).
- **Setup helpers:** `createGapFixture` (d9r2), `onboardedAt` with `createCardFixture` (d5r), `openBackup` and `chooseRestoreFile` (d8). None failed. I did every action a flow names myself, by role and label.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9R2.1 Missed week by keyboard | **PASS** (Defect 3) | Tab from the Marks header reaches "XYZ Mark, Mon Oct 12". I typed and pressed Enter six times: Mon Oct 12 → Fri Oct 9 → Thu Oct 8 → Mon Oct 5 (Enter skips the acknowledged Wed Oct 7 button) → Fri Oct 2 → Thu Oct 1 → Wed Sep 30. From the page's last cell, Thu Sep 10, Enter goes to "Save Marks (6)". The column tags "Review Date" and "Previous" show. Pager: "Sessions 1 to 20 of 27", then "Sessions 21 to 27 of 27" with "Previous page". The Review Date and Previous columns hold "51.00" and "50.90" on page 2. I typed Wed Sep 9 = 49.00 there. Paging back kept all six drafts. The header said "7 unsaved Marks Save Marks (7) Discard". One Save Marks stored all 7 keys at store revision 10, one commit, and "Mark missing for XYZ on Mon Oct 12" left the blockers. Fault: after Next page, focus went to the page body. |
| C9R2.2 Shared Instrument | **PASS** | I typed 51.25 in T-A and opened T-F with no hold message. T-F's cell is a button reading "51.25 Unsaved", with the description "Typed in XYZ (Long 100 shares @ $50.10)". Earlier sessions are "—" named "Not held". Pressing the button moved the input to T-F with focus in it (value 51.25). I edited it to 51.20, and T-A then showed "51.20 Unsaved", "Typed in XYZ (Long 50 shares @ $50.00)". Save Marks (1) from T-F stored one observation (price "51.2"). Both grids now show "$51.20". |
| C9R2.3 Can't get a price, Correct, Withdraw, conflict | **FAIL** (Defects 1, 2, 3) | With the mouse, everything works. "Can't get a price" with the reason "Feed down" is a draft: the cell reads "Can't get a price" and the editor says "Unsaved". After the save the editor shows "Acknowledged Unavailable · You said you can't get a price: Feed down" and Withdraw. The acknowledged Wed Oct 7 cell offers Price but no Withdraw. Correct on Fri Oct 9 ($50.90 → 50.95, reason "Typo") saved at once: "$50.95 · Manual · Corrected: Typo". Choosing another cell during a Correct is refused ("Save or cancel the correction to choose another cell."). Next page is disabled, with "Save or cancel the correction to change pages.". Opening T-F is refused ("Save or discard what you entered for XYZ (Long 100 shares @ $50.10) to leave it."). Withdraw brought back Missing and the blocker. Second tab: a stale Correct gets "This Mark changed after you opened it. Nothing was saved…" with 50.99 and "Tab one" kept. A stale Save Marks saves nothing and opens the refused cell's editor with the conflict and the price kept. **But:** by keyboard the editor can't be reached for these cells (Defect 1), and after the refused save focus is on the page body (Defect 2). |
| C9R2.4 Phone | **PASS** (Defect 4) | At 390 px with touch the grid turns (header row "Session \| XYZ Mark"). Input cells are 44 px high. I tapped and typed three Marks; Enter moves down the sessions. I rotated to 844×390 (wide layout), back to 390, then 1280, 375 and 320: all three drafts, the chosen Wed Oct 7 cell (`aria-pressed=true`) and its editor stayed, with "3 unsaved Marks". Saving from the status header at 320 px stored Oct 8 = 50.85, Oct 9 = 50.95, Oct 12 = 51.1. The page itself never scrolls sideways. **But** T-A's one-leg turned grid scrolls sideways (35 px at 390, 50 at 375, 105 at 320) and clips its contents (Defect 4). T-F's grid at 320 does not scroll. |
| C9R2.5 Unsaved work | **PASS** | With drafts in T-A (XYZ) and T-B (ABC), other cards open with no message, and the header counts "2 unsaved Marks". Saving a Hold Action on T-B, with only a Mark draft open elsewhere, opened the next card (T-C) with no "Save or discard" message, and "1 unsaved Mark" stayed. A reflection draft ("Felt calm") still holds T-A: opening T-C is refused with "Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it.". A Restore preview in a second tab says "Another tab has unsaved changes. They will be lost when the journal is replaced.". |
| C9R2.6 Trade Detail and heading | **PASS** | The Review card group is named "At the Fri Oct 9 Marks", and the card has no "… close" text. Price History: the Wed Oct 7 cell reads "Acknowledged Unavailable". The tab reads "Price History 27" (27 Missing sessions). The line under the table reads "27 sessions without Marks. 1 session acknowledged unavailable. Enter Marks in the Review". The gain "$39.00" is rgb(29,107,52), the same as `--target`; the loss "−$31.00" is rgb(163,38,27), the same as `--stop`. Journal: the Wed Oct 7 card shows "Acknowledged unavailable: XYZ, Wed Oct 7" and "XYZ Mark: Acknowledged Unavailable", as its own card ("Thu Oct 8 without Marks" is a separate card). At 375 and 320 px the page does not scroll sideways; the table scrolls inside its region. |

## 3. Defects

**1. High: the cell editor can't be reached by keyboard for any cell except the last one on the page.**
- **Steps:**
  1. Open `createGapFixture`, then T-A's Marks panel.
  2. Focus "XYZ Mark, Mon Oct 12".
  3. Press Tab repeatedly.
- **Actual:** Each Tab lands on the next cell and makes it the chosen cell (Fri Oct 9, Thu Oct 8, Wed Oct 7, …, Thu Sep 10). The first stop after the cells, 21 presses later, is "Next page". The editor that is open by then is "XYZ Mark, Thu Sep 10"; the Mon Oct 12 editor is gone. Shift+Tab back from Save Marks reaches the same last cell's editor. So a keyboard-only trader can't press "Can't get a price" or Withdraw on the Review Date, or Correct on Fri Oct 9, whenever later cells exist.
- **Expected:**
  - `specs/design/ui-contract.md` line 125: "keyboard-only completion of core workflows".
  - P160: one editor under the grid holds "Can't get a price", Correct and Withdraw.
  - The research page, section 6, option B: "A cell stays one tab stop."

**2. Moderate: focus is not placed after a save refused by a conflict (A294).**
- **Steps:**
  1. In tab 1, type Mon Oct 12 = 51.00 and Thu Oct 8 = 50.10.
  2. In tab 2, save Thu Oct 8 = 50.00.
  3. In tab 1, focus Save Marks and press Enter.
- **Actual:** The Thu Oct 8 editor opens with the conflict alert and Price "50.10" kept, but focus is on the page body at 300, 1000 and 2500 ms.
- **Expected:** A294: "focus goes to its input (or to the editor's first control when it has no input)".
- **Note:** a refusal for an invalid price does put focus correctly: "abc" left focus on "XYZ Mark, Thu Oct 8", with the issue in the editor.

**3. Moderate: focus falls to the page body when the pressed control disappears.**
- **Steps and actual:**
  - Pressing Enter on "Can't get a price" sends focus to the body, not to "Reason (required)".
  - "Correct", "Withdraw", and "Next page" on the page before the last do the same.
- **Expected:** `ui-contract.md` line 22, "Keyboard focus is visible and logical", and line 125, "logical focus after navigation".

**4. Moderate: the phone grid of a one-leg Trade scrolls sideways and clips its contents.**
- **Steps:** Open T-A (gap fixture, touch) at 390, 375 and 320 px wide.
- **Actual:**
  - The grid region's scrollWidth exceeds its clientWidth by 35, 50 and 105 px.
  - The column header shows "XYZ M" at 390 and "X" at 320.
  - The acknowledged cell shows "Acknowledged Unavailab" or "Acknowledged Una".
  - At 320 px the chosen acknowledged cell is 35 px high.
  - Screenshots: `c4-portrait_again.png`, `c4b-grid-320.png`.
- **Expected:**
  - P161: "A one-leg Trade needs no sideways scroll", and "Cells are at least 44 px high on touch screens".
  - B9R2.5.
  - The research page, section 7: "One or two Instruments fit at 320 px without scrolling."

**5. Moderate: the cell editor doesn't show which cell it is for.**
- **Actual:**
  - The editor is a bare run of text ("Missing", "0 means it closed with no value", "Can't get a price") with no title and no box. Its cell's name is only its accessible name.
  - After paging, the editor of an off-page cell stays open. In C9R2.1, the "XYZ Mark, Tue Sep 8" editor showed "Missing" under page 1, which doesn't contain Tue Sep 8.
- **Expected:** The signed-off mockup (research page, section 6, "The picked option, in its states") shows a bordered editor titled "Call Mark, Tue Oct 6 · Can't get a price" and similar.

**6. Low: the grid briefly shows the turned layout when the Marks panel opens on desktop.**
- **Steps:** At 1280 px, open T-A's Marks panel.
- **Actual:** Sampled every 50 ms, the header has 2 cells (turned) once, then 23 cells. Accessibility snapshots taken right after opening caught the turned table at 1280 px.

## 4. Minor observations

- After a save, the sessions just saved keep their columns until a reload. The pager says "of 27"; after a reload it says "of 25".
- After a refused conflict save, the cell shows "$52.00" but the status header still lists "Mark missing for XYZ on Mon Oct 12". This may be the held Review's behaviour from before D9R2.
- After a Correct is saved, the earlier "Save or cancel the correction to choose another cell." status stays on screen next to later messages.
- The "also held by" link reads "Long 50 shares @ $50.00" without the symbol. The mockup has "XYZ (Long 50 shares @ $50.00)".
- Price History shows a gain as "$39.00" with no "+", while the loss reads "−$31.00" and the Review card reads "+$89.00".
- The Trades navigation link leaves the Review with Mark drafts and doesn't ask; the drafts are lost. An Action draft behaves the same way, so this predates D9R2. The spec's hold covers background updates and Restore, and the Restore warning works.
- The pager text "Sessions 1 to 20 of 25" touches the "Next page" button with no gap.
- Pressing "Can't get a price" with no reason typed already counts as "1 unsaved Mark".
- The Marks panel heading says "28 earlier optional" (Missing and acknowledged sessions, including Previous), while the pager counts 27 earlier columns. These are different sets, but they read alike.