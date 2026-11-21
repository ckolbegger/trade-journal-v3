# D09R2 critic-2 report

**Overall: FAIL.** Two of the six flows fail. Paging the Marks grid can't be done by keyboard. And once another tab has saved a Mark, a card that wasn't already open can't be opened until the page is reloaded.

## 1. Header

- **Date and time:** Sat 2026-11-21, 01:44 to 02:05 EST.
- **Commit:** `f59bdfae` (branch `claude-opus-5.5`).
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (the `channel: 'chromium'` full build, headless).
- **Server:** the production build (`npm run build` to `dist/`), served by `tools/release-server.ts` on port 5175 only, started and stopped inside each script. Every script ran under `.claude/scripts/with-browser-lock.sh`. Nothing was listening on 5175 at the end, and port 4175 was never used.
- **Profiles:** each scenario used a new profile folder under `test-results/critic-d09r2-2/profiles/`, deleted at the end. C9R2.4 relaunched its own profile with touch on the same build.
- **Files:** no tracked file was edited and nothing was committed. `git status` shows only the `evidence/D09/coach-review-2-prompt.md` that was already untracked. Scratch scripts, logs and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d09r2-2/`.
- **Helpers:** every setup helper worked. Two early runs of mine hung because my own script didn't close its browser context; that was not a helper fault.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9R2.1 | **FAIL** | **Enter order is right.** Tab from the "Marks 0 of 1 for Mon Oct 12 · 28 earlier optional" header reaches the region "Marks by session", then "XYZ Mark, Mon Oct 12". Typing 51.00, 50.90, 50.80, 50.60 with Enter went Mon Oct 12 → Fri Oct 9 → Thu Oct 8 → Mon Oct 5 (skipping the acknowledged Wed Oct 7) → Fri Oct 2. The status header showed "4 unsaved Marks · Save Marks (4) · Discard".&lt;br&gt;**Paging fails by keyboard.** "Next page" is never focused in 130 Tab presses or 130 Shift+Tab presses (defect 1), so I paged with the mouse. Page 2 showed "Sessions 21 to 27 of 27" with the Review Date (51.00) and Previous (50.90) drafts kept.&lt;br&gt;**The rest passed.** I typed 49.50 and 49.40 (Wed Sep 9, Tue Sep 8). Enter from the last input (Mon Aug 31) landed on "Save Marks (6)" and the header read "6 unsaved Marks". One Enter saved 6 records, all with store revision 10. Afterwards the panel read "Marks 1 of 1 for Mon Oct 12 · 23 earlier optional Saved" and the pager "Sessions 1 to 20 of 23". The blocker "Mark missing for XYZ on Mon Oct 12" went away. |
| C9R2.2 | PASS | I typed 51.10 in T-F (Long 50 @ $50.00). T-F's editor showed "Missing / also held by Long 100 shares @ $50.10 / Unsaved". Opening T-A gave no hold message.&lt;br&gt;T-A's Review Date cell was a button reading "51.10 Unsaved", described as "Typed in XYZ (Long 50 shares @ $50.00)". Pressing it put focus in the input `XYZ Mark, Mon Oct 12` with value 51.10. T-F then showed the chip "51.15 Unsaved", described as "Typed in XYZ (Long 100 shares @ $50.10)". The header read "1 unsaved Mark".&lt;br&gt;Save from T-A stored one record, price "51.15". Both grids then show "$51.15", and T-F's Previous column shows "—" named "Not held". |
| C9R2.3 | **FAIL** | **Passed with the card open:**&lt;br&gt;• "Can't get a price" opened "Reason (required)" and Cancel, focus went to the reason, and the cell read "Can't get a price". Saving it gave "Complete with Unavailable Marks" (with Hold Actions saved). The store has the acknowledgment with reason "Broker had no closing quote".&lt;br&gt;• Correct on Fri Oct 9 ($50.90 · Manual) showed "Current price $50.90", Price and Reason. While the correction was open:&lt;br&gt;  – "Next page" was disabled, with the reason "Save or cancel the correction to change pages."&lt;br&gt;  – Choosing another cell said "Save or cancel the correction to choose another cell."&lt;br&gt;  – Opening T-F said "Save or discard what you entered for XYZ (Long 100 shares @ $50.10) to leave it."&lt;br&gt;  "Save correction" gave "$50.95 · Manual · Corrected: Typo in statement" and the cell "$50.95 Corrected" (resolution revision 2).&lt;br&gt;• Withdraw is offered on the Review Date and not on Wed Oct 7, whose editor offers only Price. Withdraw returned the cell to Missing and the Review to "Incomplete".&lt;br&gt;• A second-tab conflict on Correct showed the alert "This Mark changed after you opened it. Nothing was saved. The current Mark is shown above, and your values are kept below." Focus went to the alert and 51.05 / "Tab one fix" were kept.&lt;br&gt;• A refused Save Marks with the refused cell's card open opened that cell's editor with the conflict and focus in Price (value 50.80), including when the cell was on another page.&lt;br&gt;**Failed:** when the refused key's card is closed, its card shows "We couldn't load this Trade. Nothing was changed." (defect 2). |
| C9R2.4 | PASS | **Turning.** At 375 px with touch, the grid is turned ("Session \| XYZ Mark") and fits: grid 309/309 px, page 375/375. The smallest cell is 44 px high. At 320 px: grid 254/254, page 320/320, and T-F (one leg) has no sideways scroll.&lt;br&gt;**Entering.** Tap entry and Enter both work (Enter moves to Fri Oct 9).&lt;br&gt;**Rotating and resizing.** I went 375×812 → 812×375 (widens: grid 746 px wide, 2,575 px of content) → 1280 → 320 (turns again). All three drafts were kept at every size: 51.00, 50.90, and "Can't get a price" with "No statement yet". The chosen cell's editor ("XYZ Mark, Thu Oct 8") and the focus in its reason were kept too.&lt;br&gt;**Saving at 320** stored all three. |
| C9R2.5 | PASS, with defect 3 | **Mark drafts don't hold anything.** With drafts 51.00 and 50.40 typed in T-A, saving a Hold Action opened the next card (ABC) with no message, and "2 unsaved Marks" remained. Opening T-C and T-F gave no message, and T-F's Review Date cell shows "51.00 Unsaved". T-A's inputs still held 51.00 and 50.40.&lt;br&gt;**A reflection draft still holds its card.** Opening T-B while one was open said "Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it."&lt;br&gt;**Restore asks.** A Restore in another tab said "Another tab has unsaved changes. They will be lost when the journal is replaced."&lt;br&gt;**Discard** emptied every draft, in both Trades.&lt;br&gt;**Nothing is stored.** A reload stored nothing (no typed price in IndexedDB or web storage).&lt;br&gt;**But** the "Trades" link and a reload left the page without asking (defect 3). |
| C9R2.6 | PASS | **Review card heading.** "At the Tue Oct 6 Marks" (before), then "At the Fri Oct 9 Marks", with a group of the same name. No "close" word anywhere on the card.&lt;br&gt;**Price History.** The tab reads "Price History 26" (Missing only). Wed Oct 7's cell reads "Acknowledged Unavailable". The line reads "26 sessions without Marks. 1 session acknowledged unavailable. Enter Marks in the Review". Colours: gain $89.00 is rgb(29,107,52) and losses −$21.00 and −$31.00 are rgb(163,38,27), matching `--target` and `--stop`. At 375 and 320 px the page doesn't scroll sideways (343 and 288 px); the table scrolls inside its own region.&lt;br&gt;**Journal.** Wed Oct 7 has its own card: "Acknowledged unavailable: XYZ, Wed Oct 7", with XYZ Mark "Acknowledged Unavailable". Thu Oct 8 is "Thu Oct 8 without Marks". |

**Narrow layouts (375 and 320 px).** The grid, cell editor, status header (343 px wide, wrapping, Save Marks and Discard stacked at 320), mirrored chip and Price History all fit with no page-level sideways scroll. axe found only "heading-order" (moderate) on the cards' h3 in every state, which predates D9R2.

## 3. Defects

**1. The grid's "Next page" and "Previous page" can't be reached by keyboard. Severity: High.**
- **Steps:**
  1. Gap fixture, T-A's Marks panel. Tab from the panel header into the grid.
  2. Keep pressing Tab (130 presses), or press Shift+Tab from the Review Date cell or from "Save Marks (1)" (130 presses).
- **Expected:**
  - C9R2.1: "fill … by keyboard, page once, save once".
  - A296 / P158: earlier sessions page 20 at a time with "Previous page" and "Next page".
  - A295: Enter crosses pages "only by the paging buttons".
  - AC-UI-002: the whole flow by keyboard.
- **Actual:**
  - Tab goes cell → its editor's controls → next cell. After Thu Sep 10 it goes to "Save Marks (1)", "Discard", then "Reflections".
  - Shift+Tab from Save Marks goes to the editor, then the cell, then back through the cells.
  - "Next page" is never focused, in either direction.
  - **Why:** `throughEditor` in `src/ui/screens/CardMarks.tsx` (lines 325 to 342) moves focus from the editor's last control to the next cell, and from the editor's first control back to the cell. So the pager, which sits between the grid and the editor in page order, is skipped both ways.
  - The browser suite pages only by click (`e2e/d9r2/*.spec.ts`), so it doesn't catch this.

**2. After another tab saves a Mark, cards that weren't open fail to load. Severity: High.**
This also breaks A294's "focus after a refused save".
- **Steps (shortest):**
  1. Gap fixture with T-F's card open in tab 1.
  2. In tab 2, save Thu Oct 8 = 50.85 for T-A.
  3. In tab 1, open T-A's card.
- **Steps (inside C9R2.3):**
  1. Tab 1: type T-A drafts Mon Oct 12 = 51.00 and Thu Oct 8 = 50.80, then open T-F's card.
  2. Tab 2: save Thu Oct 8 = 50.85.
  3. Tab 1: press the status header's "Save Marks (2)".
- **Expected:**
  - A294: the first refused key's card opens on the Marks panel, its page shows, its editor opens with the issue, and focus goes to its input.
  - Section 7.2, B9R2.4: "a refused save opens the first refused cell with focus in it".
- **Actual:**
  - T-A's card opens with the alert "We couldn't load this Trade. Nothing was changed." Focus is on the card's header button, and there is no Marks panel or editor.
  - Collapsing and reopening T-A, pressing Save Marks again, and Discard all leave the same alert.
  - T-F then shows the same alert too.
  - Only a reload recovers, and a reload drops the drafts.
  - The same refused save works when T-A's card is already open (cases v1, v2 and v4 in `c3c.log`).
  - The root cause looks wider than D9R2: opening any card after another tab's save fails, even with no drafts (`c3f.log`). But D9R2's new header Save Marks and A294 depend on that path.

**3. Leaving the page with unsaved Mark and reflection drafts doesn't ask. Severity: Moderate.**
- **Steps:**
  1. Card fixture, T-A drafts 51.00 and 50.40, plus an open reflection draft.
  2. Click "Trades" in the primary navigation. Separately, reload the page.
- **Expected:** P156's table, row "Leaving the page (route, reload, update)": still held while any Mark draft exists. Summary: "leaving the page still asks first". Flow C9R2.5: "leaving the page asks".
- **Actual:**
  - The route changes to `/` at once, with no dialog of any kind (no browser dialog event fired), and every draft is discarded. A reload also discards them without asking.
  - Only the update and Restore path asks ("Another tab has unsaved changes…").
  - Rated Moderate, not High: the only spec rule (delivery contract item 4, "not silently discarded by background activation") is met. And `src/main.tsx` wires `onDirtyChange` only to update deferral, so this is probably app-wide and earlier than D9R2. It still contradicts the breakdown's row as written.

**4. A Review Date cell looks the same as an optional earlier cell. Severity: Low.**
- **Expected:** `research/review-page-style.html`, section 4, "Cell states": a Missing Review Date cell is "an input with a warning-tone border: needed", in a tinted column. Acknowledged Unavailable sits "on a neutral chip".
- **Actual:**
  - "XYZ Mark, Mon Oct 12" and "XYZ Mark, Thu Oct 8" have the same computed style: dashed border rgb(85,82,75), background rgb(243,239,230), and no column tint.
  - Acknowledged Unavailable is plain text, not a chip.
  - The "Review Date" column tag and the "1 needed" badge still carry the meaning.

## 4. Minor observations

1. The two counts don't match. The panel header says "28 earlier optional" (it counts the Previous column and the acknowledged Wed Oct 7) while the pager says "Sessions 1 to 20 of 27". After saving: 23 and 23.
2. At 1280 px, "Sessions 1 to 20 of 27" runs into the "Next page" button with no gap.
3. The "also held by" link reads "Long 100 shares @ $50.10" without the symbol. The mockup has "XYZ (Long 50 shares @ $50.00)".
4. On a phone, the cell editor sits under all 20 session rows, about 1,100 px below the Review Date cell. Choosing a cell near the top leaves "Can't get a price" off screen until the trader scrolls.
5. Opening another card during a Correct shows two status messages at once ("Save or discard what you entered…" and "Save or cancel the correction to choose another cell.").
6. Each grid row's accessible name repeats the label ("XYZ Mark XYZ Mark, Wed Oct 7").
7. A collapsed Marks panel (width 0) holds its grid in the turned layout. One accessibility snapshot taken right after opening the panel at 1280 px caught the turned layout before it re-measured. Later checks were always wide, and I saw no visible flash.
8. Withdraw acts at once, with no confirmation.
9. From earlier work, not D9R2: Trade Detail's Journal at Mon Oct 12 17:00 lists a "Tue Oct 13 · Session not ended yet" card.