# D09 critic-b1 report

## 1. Header

- **Date and time:** Fri Nov 20 2026, 01:22 to 01:34 EST
- **Commit:** 70cc2f0c (branch claude-opus-5.5)
- **Node:** v26.12.0. **Chromium:** 153.0.8010.12, Playwright's `channel: 'chromium'`, new headless.
- **Server:** one, which I started with `.claude/scripts/with-browser-lock.sh sh -c "npm run build &amp;&amp; npm run preview -- --port 5175 --strictPort"`. I stopped it at the end (exit 143 from my SIGTERM), and nothing is left listening on 5175.
- **Profiles:** a fresh Chromium profile directory for every run, under `test-results/critic-d09b-1/`.
- **Clean tree:** I edited no tracked file and made no commits; `git status` is clean. Scratch scripts and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d09b-1/`. I did not read `evidence/`.
- **Helpers:** I used `build` and `buildReview` for the starting states and `reachPanel` to open the Review's Marks panel. Every flow action I did myself: the Replay buttons, the slider keys, the chips, Escape, and Correct, Price, Reason and Save correction. No helper failed.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| **C9.5 The estimates explain** | **PASS** | **Underlying barely moves, option does** (R-CORV-D, Mon Nov 9: CORV $76.50 to $76.80, put $5.20 to $4.25). The line under the charts reads "Since Fri Nov 6: Trade P&amp;L −$285.00. The put moved −$0.95 a share: CORV's move −$0.19 · time −$0.32 · volatility −$0.44 *estimate*". The chip reads "Implied volatility 43.9%", down from 53.0% on Fri Nov 6.&lt;br&gt;**Missing Mark** (CORV Tue Nov 10): "Implied volatility Unavailable *estimate*", with "A Mark is missing." under the chip. The "Behaves like" chip is gone and there is no line under the charts. On Wed Nov 11: "The put's move is not split: a Mark is missing for Tue Nov 10. Its Mark changed +$0.87 since Mon Nov 9."&lt;br&gt;**Last sessions before expiration:** R-BREN-U to Fri Nov 20 and R-DALE-D to Thu Nov 19.&lt;br&gt;- BREN Tue Nov 17 and Wed Nov 18 say "This far from the strike, or this close to expiration, the price barely depends on volatility." Tue Nov 17's line still splits, as W48's together form: "BREN's move +$1.13 · time and volatility together −$0.04".&lt;br&gt;- BREN Thu Nov 19 says "The Mark is at or below the option's exercise value, so no volatility fits."&lt;br&gt;- BREN Fri Nov 20 shows "Expiration session" and "On the expiration session the price no longer depends on volatility."&lt;br&gt;**Estimates tagged and drawn unlike Marks:** every estimate is tagged "estimate", in the chips, the readout's "Implied volatility" and "Behaves like" rows, the session cards and the line under the charts. The volatility chart is a dashed line with hollow points; Marks are a solid line with filled dots.&lt;br&gt;**No rate beside the estimates:** the overlay's text and its title and aria-label attributes contain no "interest", "Black", "formula", "dividend", "rate", "4%" or "5.25%". The About page's "Option estimates" section has W50's three paragraphs word for word.&lt;br&gt;**Unavailable estimates change no figure:** checked against the Marks by hand. BREN Tue Nov 17: Trade P&amp;L +$1,206.00 = (5.25 − 1.61) × 200 + 478, At Stop $890.00. BREN Fri Nov 20: +$1,456.00. DALE Thu Nov 19: −$2,490.00. All correct.&lt;br&gt;**Stock** (AXIO, from the Review card's Replay button): "Behaves like 100 shares" with no tag, and "AXIO moved −$1.10 a share." |
| **C9.6 A wrong Mark shows** | **PASS** | I corrected the call's Mon Nov 16 Mark in the Review's Marks panel from $4.16 to $4.60 (reason "Typed the wrong quote."), then back to $4.16.&lt;br&gt;**At $4.60:**&lt;br&gt;- The volatility jumps from 27.7% to 45.7%, and the small chart's last point (spoken list "Mon Nov 16: 45.7%") spikes.&lt;br&gt;- "Behaves like" goes from ≈ 183 to ≈ 161 shares, and the line's volatility part from −$0.01 to +$0.43.&lt;br&gt;- The exact figures follow the Mark alone: Trade P&amp;L +$1,076.00 · 3.32R = (4.60 − 1.61) × 200 + 478; At Stop $760.00; At Worst case $920.00; "Past the Target by $120.00 (0.37R)"; "down $62.00 since Fri Nov 13".&lt;br&gt;- Every earlier session is unchanged.&lt;br&gt;**Back at $4.16:** every session's headline, chips, line and readout text is identical to before the correction, and the small chart reads 27.7% again. |
| **375 and 320 px** (inside the overlay) | **PASS** | No sideways scroll at either width: the page and dialog `scrollWidth` equal the viewport, and no element sits past an edge.&lt;br&gt;- **Chips** wrap onto separate rows.&lt;br&gt;- **Small chart** opens on focus or click (314 px wide at 375, 259 px at 320); Escape closes it and leaves the overlay open.&lt;br&gt;- **"Since …" line** wraps onto 4 to 5 lines under the charts.&lt;br&gt;- **Readout** "Implied volatility" and "Behaves like" rows each carry the tag.&lt;br&gt;- **Session cards** carry "Implied volatility 27.7% *estimate*" and "Behaves like ≈ 183 shares *estimate*", or "Unavailable" on CORV Tue Nov 10.&lt;br&gt;- **About page** "Option estimates" section is fully readable at both widths. |

## 3. Overall: PASS (two defects, neither fails a flow)

**Defects**

1. **The reason given for an unavailable implied volatility contradicts the simple exercise value.** Severity: **moderate**, because the words misstate what happened.
   - **Steps:** Replay R-BREN-U through Fri Nov 20 and slide to Thu Nov 19. Then replay R-DALE-D through Thu Nov 19 and slide to Wed Nov 18.
   - **Expected:** W49's "The Mark is at or below the option's exercise value, so no volatility fits." appears only when that is true. AC-CALC-005 asks for a stable reason for "one Mark at the contract's exercise value".
   - **Actual, BREN Thu Nov 19:** BREN Mark $106.00, call Mark $6.01, $100 strike. The exercise value is $6.00, so the Mark is above it, yet the screen says it is "at or below the option's exercise value".
   - **Actual, DALE Wed Nov 18:** DALE Mark $52.80, put Mark $4.70, $57.50 strike. The Mark equals the exercise value exactly, yet the reason shown is "This far from the strike, or this close to expiration, the price barely depends on volatility."
   - **Likely cause:** the check seems to use the exercise value discounted at the assumed rate, while the words name the plain exercise value. A trader who does the subtraction sees the opposite of what the reason claims.

2. **The not-split sentence uses words other than W48's approved ones.** Severity: **low**, because the words are clear and nothing is misread.
   - **Steps:** Replay R-CORV-D through Wed Nov 11 and read the line under the charts.
   - **Expected (W48):** "The put's move is not split: no implied volatility for Tue Nov 10. Its Mark changed +$0.87 since Mon Nov 9."
   - **Actual:** "The put's move is not split: a Mark is missing for Tue Nov 10. Its Mark changed +$0.87 since Mon Nov 9."
   - **Note:** the plan has no record of this change. P137 allows tasks to shorten approved words, not to replace them. It may be recorded in the evidence, which I did not read.

## 4. Minor observations

- **No tag or reason on Unavailable rows.** In the readout and the session cards, "Implied volatility Unavailable" and "Behaves like Unavailable" have no "estimate" tag and no reason. The chip has both. The share equivalent's own Unavailable reason shows nowhere, because its chip is removed and the volatility chip's reason has to stand in for it.
- **The small volatility chart shows no values.** It has no axis, dates or percentages on screen; the values exist only in the spoken list.
- **The small chart covers part of the main chart.** It opens above the chip: at 1280 px it hides the P&amp;L chart's lower left and the key, and at 320 px it hides the key.
- **The bar under the "Since …" line** (B9.6's three parts) is a faint hatched strip that is hard to see.
- **The two plain chips look like the estimate chips.** "4 days to expiration" and "Long 2 contracts" use the same dashed, tinted pill; only the "estimate" tag tells them apart. This matches the prototype, where all chips share one style.
- **Only the Review Date's Marks can be corrected.** The Review's Marks panel offers Correct only for the Review Date's Marks; an older saved Mark, such as Wed Nov 11 seen from Mon Nov 16, isn't listed. So for C9.6 I corrected the latest session's option Mark. This was true before stage B.
- None of the known items listed in the brief looked worse with stage B's additions.
