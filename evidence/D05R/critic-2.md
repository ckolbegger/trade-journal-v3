# D5R browser critic 2 (T5R.16)

Fresh `general-purpose` critic, brief v2 (`.claude/docs/critic-brief.md`, setup helpers from `e2e/d5/support.ts` and `e2e/d5r/support.ts`), at commit `e3ee0921`, after critic 1's bug tasks B1 and B2. The report below is the critic's final message, unedited apart from this heading.

---

D5R browser critic 2 report: overall PASS. All nine flows pass and the 375 px and 320 px checks pass. I found two defects, both low severity and neither breaks a pass condition, plus one older Open-list layout defect that is also present in the D4 release.

## 1. Header
- **When:** 2026-11-01, about 02:15–03:08 EST.
- **Commit:** built and tested at `e3ee0921`. HEAD moved during the run to `3e5d6c2f` ("docs(handoff): D5R critic 1 worked, critic 2 in progress"), a docs commit from the main session.
- **Versions:** Node v26.12.0; Playwright 1.63.0; Chromium 153.0.8010.12 (`channel: 'chromium'`, headless).
- **Builds:** `npm run build:faults` and `npm run build:releases` (d5 rebuilt from current source; d2 and d4 reused from their tags).
- **Servers:** all through `startReleaseServer` from `tools/release-server.ts` on 127.0.0.1:5175, one at a time, all stopped at the end.
  - `dist-releases/d5` for every flow.
  - `dist-faults` only for Recovery Only (`/?faults=control`).
  - `dist-releases/d4` briefly, to check whether the Open-list overlap already existed.
- **Ports:** 5175 was free before and after; 9341 and 9342 were never used.
- **Setup:** profiles built with `createCardFixture`, and fixture plus `createRoutineTrades(15)` for 20 positions. No helper failed. Every flow action was done by role and label in Chromium. Scratch files are in `test-results/critic-d5r-2/`.
- **`git status --short` at the end:** `?? .claude/settings.json` only. No tracked file was edited.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C5R.1 Cards in place | PASS | 20 cards. Opened card 2 (index 1), card 11 (index 10) and the last card (index 19), each after scrolling it into view with the wheel. Each body rendered inside its own list item (region "ZZH (Long 100 shares @ $20.00) review"). Each header scrolled to y≈17 px (≈12 px for the last). Focus moved to the pressed header. The first price input sat at y≈663–707 of 900, so no scrolling was needed. Exactly one card header had `aria-expanded=true` each time, and the previous card collapsed. Pressing the open card's own header collapsed it with nothing else open. |
| C5R.2 Work in order | PASS | T-A opened on load on Marks: "Marks 0 of 1 for Mon Oct 12 · 1 earlier optional / 1 needed"; "Reflections 2 owed, 1 due now / 1 due"; "Action Hold, Exit, Roll or Adjust / Needed". Save Marks moved to Reflections (status "Saved", focus on the Reflections header). Answering D-1 moved to Action with Hold checked. The Action save gave T-A "Done · Action saved" and opened the next card not Done (ABC). A card with no reflections reads "None owed / None" and is skipped. After all five, the status read "Complete with Unavailable Marks / Instruments: DEF / Trades: DEF (Long 100 shares @ $40.00)". After relaunch every card read "Done · Action saved". The probe showed 5 Action Entries, the settled Entry, and one record per key (XYZ ×2 dates, ABC, JKL, DEF acknowledgment). |
| C5R.3 Save Marks | PASS | Typed values marked "Unsaved"; button "Save Marks (2)". Enter on the Monday price moved to the Friday price; Enter there moved to Save Marks. With Friday "abc": "Enter a price as a number, with at most 6 decimal places." beside that row, `aria-invalid`, focus on it, both drafts kept, 0 observations. After fixing to 51.00 both saved. Figures updated from the result at once: "+$180.00 · +0.72R", "$450.00 · 1.80R", "$5,200.00 · 20.80R", "$400.00 · 1.60R", Reward : risk now "0.89", planned "2.4". Discard cleared the ABC draft and left "Save Marks (0)" disabled. "Can't get a price" with a reason became a draft that Cancel removed. A two-tab Conflict showed "This Mark changed after you opened it. Nothing was saved…", kept the 22.00 draft, and the store kept only 21. |
| C5R.4 Shared Mark (with decision 68) | PASS | Headers read apart: "XYZ Long 100 shares @ $50.18" and "XYZ Long 50 shares @ $50.00". Saving XYZ 52.00 in T-F's card moved T-A's collapsed slider at once, from "Mark missing: XYZ, Mon Oct 12" to "53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L +$180.00, Reward : risk 0.89." T-A's card then showed "$52.00 · Manual", "also held by Long 50 shares @ $50.00" linked to T-F, and still listed the optional Friday gap. One observation. The blockers, hold messages and region labels name the Trade, e.g. "Reflection due for XYZ (Long 100 shares @ $50.18)"; "Mark missing for XYZ" names the Instrument. |
| C5R.5 Slider | PASS | Legend "Stop ◂ ▸ Target" above the list. Placed: T-A dot right of its entry tick. Pinned: ABC at 27.50 shows a square marker at the Stop end, "Past the Stop, entry at 25%. Risk to stop $0.00, P&L −$251.00, Reward : risk Not applicable." Missing: grey dashed track with no dot, "Mark missing: DEF, Mon Oct 12". JKL reads "18% … entry at 9% …" and T-F "57% … entry at 29% …", matching the plan's 2/11, 1/11, 4/7 and 2/7. No numbers in the visible text. |
| C5R.6 Figures | PASS | Risk to stop, Worst case, Reward to target and Reward : risk now and planned are present. Unavailable figures read "Mark missing: XYZ, Mon Oct 12" or "Acknowledged unavailable: DEF, Mon Oct 12", never 0. T-B shows "Not applicable". Planned values: 2.4, 3, 2.5, 10. The "At entry" group shows only while the Mark is missing (D4 P12/P13). |
| C5R.7 Hold | PASS | The Action form opens with radio "Hold" checked and one Save button. One press stored one Daily Trade Review Entry (`["DailyTradeReview","2026-10-12",<T-A id>]`). Afterwards the panel reads "Action Hold / Saved". |
| C5R.8 Leaving and links (with decision 68) | PASS | With a DEF draft, pressing JKL's header kept DEF open with "Save or discard what you entered for DEF (Long 100 shares @ $40.00) to leave it." After Discard, JKL opened. A typed Intent also held the card. Switching panels kept the draft. Open list links carry `/review?trade=<id>&instrument=XYZ`. From T-F's row the link opened T-F's card on Marks, with focus on its XYZ Mon Oct 12 price, and T-A stayed collapsed. Trade Detail links behaved the same for T-F and T-A. The DEF link, bare `?instrument=XYZ` (opens T-A, the first holder), `?trade=<T-E>`, and the blocker links (T-A to Reflections, T-F to Action) were all correct. |
| C5R.9 Narrow, keyboard, Recovery Only (with decision 68) | PASS | **Slider placement:** beside the header at 1280 (header 894 px), 960 (674), 760 (694) and 706 (640); below it at 700 (634), 640, 390, 375 and 320. It moves under only when the header drops below 640 px. At 760 T-A's text takes two lines. **Resize:** 1280 → 320 → 1280 kept the open card, the Action panel and the Intent "Resize test". **Keyboard only at 375:** T-A completed from Marks through the reflection to Hold Save, with a 3 px solid focus ring visible on every stop, and Enter on a header opened that card. **Recovery Only at 375:** read-only notice shown; every card opens with figures, Marks, reflections and "Saved Action: Hold"; 0 inputs; no Save Marks, Discard, Answer, Decline, Save or Change; probe unchanged. axe (WCAG 2.1 AA) found no violations on Marks, a rejected issue, a reflection form, and the Action panel at 1280, 375 and 320. |
| 375 px check | PASS | Review: page width 375, nothing wider. The header wraps over 4 lines with the slider below. Figures, forms and buttons stack in one column. The Open list's Mark missing link (130–264 px) and Trade Detail's (37–302 px) fit with no page scroll. |
| 320 px check | PASS | Review: page width 320, nothing wider; the header takes up to 5 lines. Open list and Trade Detail are 320 wide; Detail's link wraps to two lines (37–281 px). Following it at 320 opened T-F's card with the focused input in view (y 378–422 of 800). |

## 3. Overall: PASS
Every pass condition held. The two defects below contradict the spec but are low severity.

**Defects**

1. **The slider says "Mark missing" after the Mark was acknowledged unavailable.**
   - Steps: in DEF's card, "Can't get a price", reason "Halted all day", Save Marks; then reload the Review.
   - Expected: the slider's text follows the Expected-Mark Status. UI contract: "Acknowledged Unavailable is visibly a trader acknowledgment, not a price"; glossary: Missing and Acknowledged Unavailable are distinct statuses; I5R.1 says "(acknowledged unavailable)".
   - Actual: the card body says "Mark acknowledged unavailable for DEF on Mon Oct 12" and its figures say "Acknowledged unavailable: DEF, Mon Oct 12". The slider's accessible name stays "Mark missing: DEF, Mon Oct 12", before and after reload.
   - Severity: low (wrong text on one cue; the work and completion are correct).

2. **The Reflections panel summary counts a reflection just answered.**
   - Steps: in T-A's card, answer D-1 ("Reflect on 2026-10-09 10:00").
   - Expected: the panel header shows its summary and status as text (A152), rendered from the save result (AC-RESP-001), and agrees with a fresh load.
   - Actual: straight after Answer it reads "Reflections 2 owed, 0 due now / Resolved"; after reload, the same state reads "Reflections 1 owed, 0 due now / Not due".
   - Severity: low.

**Older defect, also in the D4 release, outside D5R's changed lines:** on the Open list at 375 and 320 px, the sticky Underlying cells paint over the fixed bottom navigation. The "Trades" and "Review" items are covered: `elementFromPoint` over the Review link returns a TD ("ABC" or "DEF"), and Playwright's click on the Review nav link timed out because a TD intercepted it. `dist-releases/d4` behaves the same, so this is not a D5R regression, but it blocks the phone path into the Review (UI contract, responsive behavior). Severity medium. Screenshots: `test-results/critic-d5r-2/shots/c9-openlist-320.png` and `d4-openlist-320.png`.

## 4. Minor observations
- The next card after an Action save follows the Missing-Mark Instrument order, not list position. After T-A, ABC opened (third in the list) ahead of JKL (first); after ABC, DEF opened. This fits P36 ("prefers a card with a Missing current Mark"), but the jump down the list may surprise.
- Within one Trade the blockers list "Action missing for XYZ (Long 100…)" before "Reflection due for XYZ (Long 100…)", the opposite of the in-card work order (Marks, Reflections, Action).
- Heading levels inside the open card are out of order: card h3, panel h4, then "Today's Marks" and "Earlier sessions…" as h3, Instruments as h4, reflection day groups as h5. axe's WCAG tags did not flag it.
- Leaving through the sidebar while a Mark draft is held goes to `/` without a prompt, and the draft is lost (nothing written). The hold covers only other cards (A156); route changes are not blocked.
- After Save Marks re-sorts the cards (decision 64), the open card can move to the top or bottom of the list. The view keeps its newly opened panel in sight but not the card header (ABC's Action panel was in view, its header above).
- A saved row shows "$52.00 · Manual" with "Correct" only; Withdraw appears only for acknowledgments. I took this to be D4's existing behavior.

Screenshots and scripts are in `test-results/critic-d5r-2/` (git-ignored).
