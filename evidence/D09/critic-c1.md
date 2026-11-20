# D09 critic-c1 report

## 1. Header
- **When:** Fri 2026-11-20, 11:08 to 11:12 EST
- **Commit:** `f70d7a199e444755a9ca65f98212a8ac92076e7d` (branch `claude-opus-5.5`)
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12 (headless)
- **Servers:**
  - Ran `npm run build` once.
  - Each run started `vite preview --port 5175 --strictPort` under `.claude/scripts/with-browser-lock.sh` and stopped it afterwards. For C9.9 it was stopped in the middle of the run.
  - No server was left running: nothing is listening on 5175.
- **Profile:** one fresh profile, `test-results/critic-d09c-1/profile-a`, for the single build. The app clock was pinned to Fri Nov 13, 17:00 New York time.
- **Setup:**
  - Through the UI using the `e2e/d9/support.ts` helpers: BREN, CORV, DALE_D and AXIO_U, plus four stock Trades of my own: KOVA (between its lines, losing side), NOMK (no Mark on Fri Nov 13), and CLSA and CLSB (Closed on Nov 4 and Nov 10).
  - Two Planned Trades through the New Plan form: PLNA (Plan time Nov 9) and PLNB (Plan time Nov 11).
  - All of this succeeded, so no helper failed.
- **No tracked file was edited and nothing was committed.** `git status` shows only the two untracked evidence prompts that were there before. Scratch scripts, JSON output and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d09c-1/`.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C9.7 The meter reads the same everywhere | **PASS** | I compared four Trades on their Review card header, their Open-list row and the top of Trade Detail's Conditions card.&lt;br&gt;&lt;br&gt;**Same name in all three places, and the name equals the hover text (`title`):**&lt;br&gt;- BREN: "P&amp;L +$1,138.00, past the Target by $182.00. Realized +$478.00. Stop +$316.00, Target +$956.00. Up from +$982.00 on Thu Nov 12."&lt;br&gt;- KOVA: "P&amp;L −$80.00, 40% of the way to the Stop. Stop −$200.00, Target +$600.00. Down from −$70.00 on Thu Nov 12."&lt;br&gt;- DALE: "P&amp;L −$1,476.00, past the Stop by $213.00. Realized −$495.00. Stop −$1,263.00, Target −$273.00. Down from −$1,272.00 on Thu Nov 12." (decision 120's "Realized" for a loss)&lt;br&gt;- NOMK: "Mark missing: NOMK, Fri Nov 13 Stop −$200.00, Target +$600.00. Session before +$100.00 on Thu Nov 12."&lt;br&gt;&lt;br&gt;**Same drawing in all three places.** Every part sits at the same position, for example BREN's pointer is square at 100% and its Stop line at 27.77%. Only the width differs: 144, 176 and 278 px.&lt;br&gt;&lt;br&gt;**No visible words:** each meter's visible text is empty.&lt;br&gt;&lt;br&gt;**Screen readers:** the meter is announced as an image named by those figures. In the Conditions card it comes after the "Conditions" heading and before the list of conditions.&lt;br&gt;&lt;br&gt;**Hover:** I hovered with the mouse. Headless Chromium does not draw the browser's tooltip, but the hover text is set and equals the name. |
| C9.8 The Open list's order | **PASS** | Order: DALE (past its Stop), BREN, CORV (both past the Target), NOMK (no Mark), AXIO (58% of the way to the Target), KOVA (40% of the way to the Stop).&lt;br&gt;&lt;br&gt;This is exactly the Review's card order for the same date, which shows these bands: Boundary reached ×3, Evidence limited, Quantified pressure ×2.&lt;br&gt;&lt;br&gt;"In the Review's order" sits above the table, inside the Open tab.&lt;br&gt;&lt;br&gt;**Planned:** PLNB above PLNA (newest Plan time first). **Closed:** CLSB (2026-11-10) above CLSA (2026-11-04), newest close first. That matches the spec's fixed factual sorts, and neither tab shows a meter. |
| C9.9 The whole deliverable, narrow and offline | **PASS** | **No sideways scroll** at 375 or 320 px on the Open list, the Review or Trade Detail (BREN and NOMK): page width = window width (375/375 and 320/320).&lt;br&gt;&lt;br&gt;**Open list on a phone:** the meter sits under the figures line in the Trade column, one per row, 164×22 px. The Entry and Account columns scroll inside the table's own region, as before; hiding the meters leaves the table 623 px wide either way.&lt;br&gt;&lt;br&gt;**Review card headers** fit (309 px at 375, 254 px at 320), with the meter under "Action · Boundary reached".&lt;br&gt;&lt;br&gt;**Conditions card:** the meter is at the top (301 px at 375, 246 px at 320). NOMK's track is dashed and has no pointer.&lt;br&gt;&lt;br&gt;**Accessibility:** axe (WCAG 2.1 AA) found no violations on the list, the Review or Detail at 375 px.&lt;br&gt;&lt;br&gt;**Offline:** with the server stopped (curl confirmed it was down), the list, the Review and BREN's Detail all reloaded at 375 px with every meter (6, 6 and 1). |

## 3. Overall: **PASS**

**Defects:** none. No pass condition failed and I saw nothing that contradicts `specs/`.

## 4. Minor observations
1. **Low: the name runs on when there is no Mark.** NOMK's meter reads "Mark missing: NOMK, Fri Nov 13 Stop −$200.00, Target +$600.00. …". There is no full stop after the reason, so a screen reader runs "Fri Nov 13 Stop −$200.00" together. W51 says "the reason, then the rails".
2. **The implementers' choices, as I judged them:**
   - **(a) "In the Review's order" above the table:** it reads clearly and is inside the Open tab. I have no objection.
   - **(b) The "Stop ◂ ▸ Target" line above the Review list:**
     - It is accurate: on every meter I saw, the Stop is at the left and the Target at the right.
     - It appears only on the Review, not on the Open list or the Conditions card, so the same meter has a key in one place out of three.
     - It is a plain paragraph, so a screen reader reads the triangle symbols aloud.
     - It is worth keeping. Repeating it or hiding it from screen readers is a polish choice.
   - **(c) No meter when a Trade's facts can't be replayed:** I did not build a Trade like that, so I can't judge it on screen.
3. **Not caused by stage C: the Open list scrolls sideways inside its table at 1280 px.**
   - At 1280 the table is 1303 px wide in a 928 px region, and the P&amp;L figure is cut off at the right edge.
   - The cause is the no-Mark row's text, which does not wrap: "Mark missing: NOMK, Fri Nov 13 Thu Nov 12 close +$100.00 · +0.50R". It makes the P&amp;L column 544 px wide.
   - The meter does not cause it: hiding every meter left the width at 1303 px. Without the NOMK row it is 931 px in 928, still a 3 px scroll.
   - In that wide column the meter sits at the left, far from the right-aligned figure it belongs to.
4. **Not caused by stage C: the list and Detail word the same figure differently.** The P&amp;L cell says "Thu Nov 12 close +$100.00", while Trade Detail says "+$100.00 at the Thu Nov 12 Mark". The list's wording sits close to the "a price is a Mark" rule.
5. **Low: the faint mark for the session before is hard to see.** When it falls inside a hatched part of the track, as on DALE at 13.82% and BREN at 86.29%, it is barely visible. Its figure is still in the name.