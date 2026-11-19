# D09AR critic-1 report

## 1. Header
- **When:** 2026-11-19, about 09:40 to 10:22 EST
- **Commit:** `38978773` on branch `claude-opus-5.5`
- **Tools:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (persistent profiles, America/New_York, clock pinned)
- **Server:** I ran `npm run build` once, then started `npx vite preview --port 5175 --strictPort` inside `.claude/scripts/with-browser-lock.sh` for each run. No other port was used.
- **At the end:** I stopped every server. Port 5175 is free (`lsof` shows no listener, `pgrep` finds no vite preview).
- **No tracked file edited:** `git status --short` is empty. Scripts, logs and screenshots are under `test-results/critic-d09ar-1/` (git-ignored). Screenshots are in `test-results/critic-d09ar-1/shots/`.
- **Setup:** profiles were built with `build`, `buildPlanned` and `buildReview`:
  - BREN, AXIO (R-AXIO-D), CORV and DALE_HOLD, each Marked to Mon 11-16
  - BREN_SOLD_OUT (K-sale)
  - DALE (R-DALE-U), Settlement Due
  - A Planned BREN
  - The three-Trade Review (BREN, AXIO, DALE-hold)
  - A second-lot AXIO (R-AXIO-U): built with `build`, then the second Buy entered with `recordEntry`.
  
  Every helper worked. All flow actions were done by role and label: click, keyboard and tap.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9AR.1 The overlay | **PASS** | **Opening:** BREN, DALE-hold and AXIO each open a dialog named "Replay, BREN" (and so on) that fills the viewport, x 0 / y 0 / 1280×900. The `main` and `nav` behind it are inert. Header: "BREN · Trade P&L +$988.00", "DALE · Trade P&L −$2,088.00", "AXIO · Trade P&L −$1,040.00". The URL gains `?replay=open` and focus goes to Close.<br>**Closing:** Close, Escape and Back all leave `/trades/<id>` with focus on `button.cockpit-replay-button "Replay"`. Back never left the Trade.<br>**Reload:** the overlay reopens, on the latest session (by design, A274).<br>**Links:** "Price History" at Thu Nov 12 closes the overlay, selects that tab and focuses `th "Thu Nov 12"`. "Position" focuses the matching Execution (for example "Sell 100 AXIO @ $45.60"). "Journal" focuses `h3 "Mon Nov 9"`. Position and Journal show only on sessions with an Execution or Journal items. |
| C9AR.2 Ten-second read, wide | **FAIL** | **Width:** P&L chart is 837, 997 and 1477 px at 1280, 1440 and 1920. The readout sits beside it (x 883 / 1043 / 1523, 372 px wide). Chart text is 10 to 11.5 px at every width. No sideways scroll.<br>**Labels and dates:** key present; "Mon Nov 2" at the left, "Expires Fri Nov 20" on the options, nothing at the right on AXIO. On the entry session, no level label lies on the cursor (only the current Mark's own label, for example "$97.20").<br>**Fails:** signs part from numbers in the readout (Defect 2) and on the session cards (Defect 1). Unlabelled marks on AXIO (Defect 6). |
| C9AR.3 Unfold, with cards | **FAIL** | **Reveal rule held:** on all four Trades (second-lot AXIO-U, partial-sale BREN, AXIO sold below its Stop, CORV with a gap), the card count equals the slider's index + 1 at every session.<br>**Slider and cards:** the slider's card is `aria-current` and on the shown page. "Earlier sessions" pages and hands focus on to "Newer sessions" at the end. Pressing card "Mon Nov 2" moves the slider there.<br>**Words against the Plan:** "Bought 100 at $51.40, $1.40 above the Plan's entry", "Sold 2 at $4.00, at the Target", "Sold 100 at $45.60, $1.40 below the Stop".<br>**First crossings:** "Target first reached Fri Nov 6." on CORV from Fri Nov 6 on (Mon Nov 9 and Wed Nov 11 included). "Past the Stop since Mon Nov 9." on every AXIO session from Mon Nov 9.<br>**Gap:** on CORV the P&L area stops upright at the shaded "No Mark" column.<br>**Fails:** the gap is said twice (Defect 4). The AXIO chart drops its "Stop breached" flag after Mon Nov 9 (Defect 7). |
| C9AR.4 Losing Trade not flattered | **PASS** | **DALE-hold Wed Nov 11:** "11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)". Row: "11.69 to 1 · about 8% : 92%" over "(Plan 0.29 to 1 · 78% : 22%)".<br>**AXIO Fri Nov 6:** "7.18 to 1 · about 12% : 88%".<br>**Past the Stop:** one row each — "Past the Stop by $552.00 (0.36R) · at Stop −$1,536.00" and "Past the Stop by $180.00 (0.30R) · at Stop −$740.00". No Reward to risk row, no "$0.00". "Realized −$440.00".<br>**Weights (computed):** AXIO, CORV and BREN At Worst case and At Max reward are 13.6 px rgb(85,82,75); DALE's are 16 px rgb(28,27,25).<br>**Tags:** "Worst case −$33,936 ↓" in red at weight 650; "Worst case −$5,440 ↓" in grey at weight 500.<br>**Accessibility:** axe finds nothing on AXIO at 1280. |
| C9AR.5 In the Review | **FAIL** | **Cards:** each card has a "Replay" button directly above the Action form and no chart (0 svg).<br>**Summaries:** BREN "Remaining Reward = Past the Target by $32.00 (0.10R)"; AXIO "Current Risk = Past the Stop by $300.00 (0.50R)"; DALE "Current Risk = Past the Stop by $552.00 (0.36R)". Titles are the canonical terms. At Worst case is 13.6 px grey on BREN and AXIO, 16 px on DALE.<br>**Overlay:** rests on "Mon Nov 16 · 11 of 11". Price History goes to `?drawer=price-history&session=2026-11-12&from=review`. "Back to the Review" reopens the overlay on "Thu Nov 12 · 9 of 11", with focus on Close. Close returns focus to the card's Replay button with the Action panel open.<br>**Fails:** the started Action is lost (Defect 3). |
| C9AR.6 Finished Trades | **PASS** | **K-sale:** header "BREN · Final result +$1,138.00"; "Final result: sold out Fri Nov 13."; "Nothing is at risk and nothing is left to gain." No odds; 10 cards to Fri Nov 13.<br>**DALE-U Settlement Due:** header "DALE"; "No Mark for the put on Fri Nov 20."; 15 cards.<br>**DALE-U after Expiration:** "DALE · Final result +$564.00"; "Final result: the put expired Fri Nov 20."; "Expiration, Fri Nov 20 / Expired"; never "Execution".<br>**Planned:** no Replay button (tabs: Plan and Risk, Journal, Payoff); `?replay=open` opens nothing. |
| C9AR.7 Phone, touch, keyboard, offline | **FAIL** | **Fit:** at 375 and 320 by 667 the dialog is the full viewport and covers the bottom navigation. Header to P&L-chart bottom is 619 / 665 px. P&L chart is 200 high. No sideways scroll. No chart text is cut; smallest chart text is 10.5 px.<br>**Strip:** "Worst case +$156 · Stop +$316 · Banked +$478 · Target +$956 · Risk $672 · $32 past the Target · Target reached · Sold 2". The drawing keeps "+$988".<br>**Touch and resize:** tapping a card heading moves the slider. After a resize to 1280 and back, the overlay and "Wed Nov 11" survive. axe finds nothing.<br>**Keyboard:** Tab cycles inside the dialog (Close → … → Close) and every control is named. Escape returns focus to Replay.<br>**Offline:** with the service worker in control and the server killed, a reload shows the overlay (11 cards) and the slider works.<br>**Fails:** a stale hover box on the Review overlay (Defect 5). Signs part on the cards and header at 320 (Defects 1 and 2). |

### The coach's 15 points

1. **Figures broken across lines — NOT fixed.** The readout grid is fixed: one figure per cell, right-aligned. But signs still part from numbers in the past-a-line row and the 320 header (Defect 2), and the new session cards wrap figures and signs at every width (Defect 1). At 1280 the DALE card reads "hit –" / "$33,936.00", which is exactly the coach's example.
2. **592-px replay — fixed.** The chart is 837 / 997 / 1477 px; the readout sits beside it; text size is unchanged across widths.
3. **No key or dates — fixed, with gaps.** The key is there; dates read "Mon Nov 2" and "Expires Fri Nov 20"; DALE's Max reward is labelled "Max reward +$564". The key omits the hatched past area and the stake bar (Defect 6).
4. **Ratio flatters a loser — fixed.** "11.69 to 1 · about 8% : 92%".
5. **Plan vs what happened — fixed.** The Plan block reads, for example, "Entry: 4 contracts at $1.61 / Strike $100 / Stop: call at or below $0.80 · P&L if hit −$324.00…"; fills read against the Plan; crossings are named. The one gap is AXIO's chart flag (Defect 7).
6. **Rows past a line — fixed.** One row, no ratio row, no "$0.00", in both the replay and the Review summary.
7. **Change shown three times — fixed.** "since" appears only under Trade P&L and the Marks.
8. **One name per figure — fixed.** "Realized −$440.00"; "BREN Mark $104.00"; ratios like "2.00 to 1"; "Stop: DALE at or below $54.00" next to "Target: put at or below $0.20"; Review summary names match. One leftover: the Review summary shows "+3.05R" where the replay shows "3.05R".
9. **Phone labels pile up — fixed.** Labels are in a strip; only the slider's value stays on the drawing.
10. **Cursor through entry labels — fixed.** Nothing lies on the cursor at Mon Nov 2 on any Trade.
11. **Table too wide — fixed.** The table is replaced by cards, but the cards bring back problem 1 (Defect 1).
12. **No Mark shouts and repeats — partly fixed.** There is now one normal-size top line with "Add the Mark", dashes in the grid and cards, and a shaded column. But the readout's Trade P&L row still repeats "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10" in italics (Defect 4).
13. **Worst case hidden — fixed.** "Worst case −$33,936 ↓".
14. **Quiet date and sentence; hover moves the page — fixed.** The date sits beside the headline. The "From here" sentence is rgb(28,27,25), the same as the status line. The hover box is absolutely positioned and the readout's y is unchanged (276 → 276).
15. **Extremes' weight; long title — fixed.** Weights match the computed values above; the chart title is "Trade P&L".

**The four defects carried from critic-2:**
- **1a — fixed:** the AXIO Mon Nov 9 card reads "Past the Stop by $180.00 (0.30R) · at Stop −$740.00".
- **1b — fixed:** "Strike $100" and "Strike $57.50" are in the Plan block.
- **2 — NOT fixed:** see Defects 1 and 2.
- **3 — fixed:** nothing at the right end of AXIO's axis.
- **4 — fixed:** "Expiration, Fri Nov 20 / Expired".

## 3. Overall: **FAIL**

### Defects

1. **The session cards break figures and part minus signs from their numbers. High.**
   - **Steps:** Trade Detail → Replay at 1280×800 on DALE-hold (Mon Nov 16), then scroll to "Session by session". Also BREN at 1440, Wed Nov 11 card, and AXIO at 320 (touch), Mon Nov 16 card.
   - **Expected:** C9AR.2 "No figure breaks across lines and no sign parts from its number". The carried T9AR.13 case "keep a signed amount on one line … at 1280, 375 and 320". Coach point 1.
   - **Actual at 1280, DALE cards (2 narrow columns of about 87 px):**
     - "$31,848.00 · / 20.73R · P&L if / hit – / $33,936.00"
     - Thu Nov 12: "at Stop – / $1,536.00"
     - "11.69 to 1 · / about 8% : / 92%"
   - **Actual elsewhere:** BREN at 1440, Wed Nov 11: "−$324.00" is split. AXIO at 320: "Trade P&L – / $1,040.00 / · −1.73R", "at Stop – / $740.00", "if hit – / $5,440.00".
   - Screenshots: `c2b-dale-1280-cards.png`, `c2b-dale-1280-1.png`, `c7b-axio-320-3.png`.

2. **The readout's past-a-line row, and the header at 320, part the minus sign. High.**
   - **Steps:** Replay on DALE-hold or AXIO at Mon Nov 16, at 1280, 1440 or 1920. Then DALE-hold at 320.
   - **Expected:** as Defect 1. Also A278: "each cell unbreakable".
   - **Actual:**
     - DALE: "Past the Stop by $552.00 (0.36R) · at Stop –" / "$1,536.00" at 1280, 1440 and 1920. The same on Thu Nov 12's "Past the Stop's amount …".
     - AXIO: "· at Stop –" / "$740.00" at all three widths.
     - The overlay header at 320 reads "DALE · TRADE P&L –" / "$2,088.00".
   - Screenshots: `c2-dale-1280.png`, `c2-axio-1280.png`, `c7b-dale-320-0.png`.

3. **A started Action is lost after the Price History round trip, and one press then saves the wrong Action. High.**
   - **Steps:** Review (BREN, AXIO, DALE-hold). On each card, in the Action panel:
     1. Check "Exit" and type an Intent.
     2. Press Replay and move the slider to Thu Nov 12.
     3. Press "Price History", then "Back to the Review".
     4. Close the overlay and press Save.
   - **Expected:** C9AR.5 "A started Action survives, and one press saves it"; AC-JOUR-001.
   - **Actual:** after the return, Exit is unchecked and the Intent is "" on all three cards. Save stores an Action with `option.daily-trade-review.action.hold` and the Intent "Unanswered" (read from IndexedDB). The trader's Exit decision is silently replaced. A Close without the Price History trip was not run in this sequence.

4. **A session with no Mark is still said twice. High.**
   - **Steps:** CORV, slider on Tue Nov 10. Also DALE-U while Settlement Due, at Fri Nov 20.
   - **Expected:** C9AR.3 "said once"; W61 and A281 ask for "—" named "No Mark" in each row that needs the Mark; coach point 12.
   - **Actual:** the top line reads "No Mark for the put on Tue Nov 10. Add the Mark". The readout's Trade P&L row then repeats "Mark missing: CORV Nov 20 $80 Put, Tue Nov 10" in italics. DALE-U shows the same: "Mark missing: DALE Nov 20 $57.50 Put, Fri Nov 20".
   - Screenshot: `c3b-corv-6.png`.

5. **On a phone, opening Replay from the Review card leaves a stale hover box. High.**
   - **Steps:** a touch context at 375×667 (also 320). In the Review, BREN's Action panel, tap "Replay". Then tap sessions Thu Nov 12 and Wed Nov 11 in the chart.
   - **Expected:** C9AR.7 "A tap moves the slider and leaves no hover box behind."
   - **Actual:**
     - On open, with the slider at Mon Nov 16, a box over the price chart reads "Mon Nov 9 · BREN Mark: $98.50 · Call Mark: $1.41 · Trade P&L: −$80.00 · −0.25R".
     - After the taps the slider moves to Thu Nov 12, then Wed Nov 11, but the Mon Nov 9 box stays. It goes only once Mon Nov 9 is no longer revealed (a tap on Tue Nov 3).
     - Reproduced twice. Opening from Trade Detail shows no box, but at 320 a grey hover band covers the slider's value "−$2,088" on DALE.
   - Touch is emulated.
   - Screenshot: `c7h-review-ThuNov12.png`, `c7-review-375-after-tap.png`.

6. **AXIO's P&L chart draws a stake bar and a hatched area with no label, and the key names neither. Moderate.**
   - **Steps:** AXIO (R-AXIO-D), Mon Nov 16, at 1280 and 1440.
   - **Expected:** A280 "A line is drawn with its label or not at all"; W66's key includes "Past the Stop" and "At stake"; C9AR.2.
   - **Actual:** the black "At stake" bar at the cursor and the hatched past-the-Stop area are drawn with no "Remaining Reward $1,200" or "$300 past the Stop" text. The key reads only "Mark | Open loss | Break-even | At Stop | At Target | Realized loss | Execution". At 1920 "$300 past the Stop" appears.
   - The key never names the hatch or the bar on any Trade (BREN, DALE, CORV), although those have on-drawing labels.
   - Screenshot: `c2-axio-1280.png`.

7. **AXIO's "Stop breached" flag is not kept after the session it marks. Moderate.**
   - **Steps:** AXIO, step from Mon Nov 9 to Mon Nov 16.
   - **Expected:** T9AR.19 "flag a line … and keep the flag on later sessions"; W64.
   - **Actual:** "Stop breached" is in the P&L chart only on Mon Nov 9. On Tue Nov 10 through Mon Nov 16 the flag is gone from both the chart and the key. CORV's and DALE-hold's flags persist. The readout still says "Past the Stop since Mon Nov 9."

8. **The key is not one line, and two of its swatches mislead. Low.**
   - **Expected:** T9AR.10 "one-line key".
   - **Actual:** at 1280, BREN's key wraps to a second line ("Target reached"). "No Mark" is shown with a line swatch for a shaded column. On DALE-U after expiry the key lists "Execution" where only the "Expired" marker is drawn.

9. **The Review overlay's "Price History" is a small touch target on a phone. Low.**
   - **Expected:** UI contract: "Touch targets and spacing support phone use".
   - **Actual:** it is a link 314×23 px at 375 and 259×23 px at 320. The Trade Detail overlay's is a 46-px-high button.

## 4. Minor observations
- **Carried from critic-2, still present:**
  - A final session's headline has no R ("+$1,138.00", "+$564.00").
  - "up $0.00 since Thu Nov 19" on the expired DALE-U.
  - Arriving on Trade Detail from the Review overlay's Price History puts focus on `<body>`, and the Thu Nov 12 column is not focused.
  - Each revealed session's hit button is its own tab stop (11 on BREN).
- A reload inside the overlay reopens it on the latest session, not the slider's (consistent with A274).
- **The cursor still crosses some labels:** "Stop breached" on DALE-hold at Mon Nov 16, and the vertical "No Mark" on CORV at Tue Nov 10. Neither is the entry session.
- On DALE's entry session, "Max reward +$564" sits at the far right while its line is a short segment at the left.
- On a phone, the crossing line ("Past the Stop since Fri Nov 13.") sits below the chart key, apart from the status line.
- At 320 the cursor's date ("Mon Nov 16") is dropped from the time axis.
- **Wraps that keep each figure whole:**
  - At 1280 the past-a-line row wraps "+$956.00" to a second line.
  - At 320, "2.00 to 1 · 33% : / 67%" in the Plan block and "–$2,088.00 · / –1.36R" in the readout.
- The overlay header is set in uppercase ("BREN · TRADE P&L +$988.00"). It reads correctly.
- **Provisional words** (`new-words.md`): "Current Risk" alone on the Review summary's past row, "Stake" hidden in the grid, the strip's order and "Strike" in the key. None of them misleads.
- No console or page errors on any run.
