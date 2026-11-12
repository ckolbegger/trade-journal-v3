<!-- Recorded by the main session from the critic's final message, verbatim below this note. The critic could not write test-results/critic-d07s-1/report.md: the harness refused it ("Subagents should return findings as text, not write report files"), so there was no file to cp. Scripts, logs and screenshots are in test-results/critic-d07s-1/ (git-ignored). -->

# D7S checkpoint browser critic (T7S.12): C7S.1 to C7S.4

**Overall: FAIL.** C7S.1, C7S.2 and C7S.3 pass. C7S.4 fails on one high-severity defect: a wrong-side option-price Stop gets no error while a Target is missing.

**The report file was not written.** The harness refused to let me write `test-results/critic-d07s-1/report.md` ("Subagents should return findings as text, not write report files"). This message is the full report. The scripts, logs and screenshots are in that folder.

## 1. Header
- **Date and time:** 2026-11-12 03:13 EST.
- **Commit:** `41d8d68ffaaae849242c3986151bbce1cf221aab` (branch `claude-opus-5.5`).
- **Node:** v26.12.0. **Chromium:** 153.0.8010.12 (Playwright `channel: 'chromium'`, through `profileAt`).
- **Server:** `npm run build && npm run preview` on `http://localhost:5175` only (`.env.local` DEV_PORT=5175, `strictPort`).
  - I started it and stopped it. Nothing is listening on 5175 now.
- **Repository:** no tracked file edited and no commits. `git status --short` is empty, and `test-results/` is ignored by `.gitignore:49`.
- **Clock:** pinned with the suite's `launchAt`/`pinClock`, America/New_York.
  - Plans Mon 10-12 09:00.
  - Entry Mon 11:05.
  - Marks and Review Tue, Wed and Thu at 17:00.
- **Helpers, used for setup and evidence only:** `profileAt`, `launchAt`, `onboardedPage`, `currentTradeId`, `recordOptionEntry`, `openReview`, `reachPanel`, `probe`/`workspaceOf`/`tradesOf` and `expectAccessible`.
  - `recordOptionEntry` recorded S1′: Sell 2 @ 1.25, fee 1.30, Mon 10:00.
  - `reachPanel` only opened the card's Marks panel.
  - `expectAccessible` ran axe.
  - No helper failed.
- **Done by hand, by role and label:** every Plan form field (all four price fields), Confirm Plan, every Mark price, Save Marks, and every read of Detail, the Open list and the Review card.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C7S.1 Plan the buy-back | **PASS** | Cash-Secured Put on MNO 18 Dec 2026 45 Put, 2 contracts @ 1.20. Only "Stop (option price at or above)" 3.60 and "Target (MNO at or above)" 44.50 filled; the Underlying Stop was left empty and no error appeared. Detail shows "1R $480.00", "Reward : risk 0.29", "Stop: Option at or above $3.60" and "Target: MNO at or above 44.50". Plan baseline: "1R (original risk) $480.00", "Original reward $140.00". The probe shows Stop `{kind:'StructureValue',price:'3.6'}` and Target `{kind:'UnderlyingPrice',price:'44.5'}`. The W1 labels and the W2 note are exact. |
| C7S.2 Both kinds | **PASS** | O-S2 entered in all four fields (41.00 / 3.60 / 44.50 / 0.30). "1R $480.00" comes from S-o, the nearer Stop ($480 vs $560). "Original reward $140.00" comes from T-u, the nearer Target ($140 vs $180). Ratio "0.29". The summary and Plan cards list the four conditions in Plan order with their kinds (W6). The probe holds 4 conditions in order. Tuesday's table matches section 4: Stop on MNO $440.00 ($4.00, 3.00); Stop on the option price $360.00 ("—", "—"); Target on MNO $260.00 ($0.50, 0.50); Target on the option price $300.00. Headlines: "Risk to stop $360.00 · 0.75R", "Reward to target $260.00 · 0.54R". |
| C7S.3 Crossing | **PASS** | Wednesday, MNO 43.20 and put 3.70 typed in the card's Marks panel, then Save Marks. Detail row: "Stop on the option price \| $3.60 \| Breached \| $0.00 · 0.00R \| $20.00 · 0.04R \| — \| —". "Stop on MNO \| Active \| $60.00 · 0.13R \| None \| $4.00 \| 2.20". "Risk to stop $0.00 · 0.00R", "Worst case $8,260.00 · 17.21R", "Reward to target $640.00 · 1.33R". Header reads "Cash-Secured Put · Open"; "No Deviations recorded."; one "Stop breached" badge on the Open row. Thursday (44.60 / 3.65), AC-CALC-003: S-o Breached with Overrun $10.00; T-u Reached with Overrun $0.00; S-u Active $70.00; T-o Active $670.00. Headlines $0.00 / $0.00; "Worst case $8,270.00 · 17.23R"; "Max reward $730.00". The row shows exactly one "Stop breached" and one "Target reached" badge; still Open, still no Deviations. The Review card's Conditions list matches W8, including "Stop on the option price at or above $3.60: Breached, $20.00 beyond" on Wednesday. The card shows "Boundary reached" and its slider reads "Past the Stop". |
| C7S.4 Validation | **FAIL** | Long Call XYZ 55, 2 @ 2.00. "Stop (option price at or below)" 2.50 (wrong side), both Target fields empty, then Confirm Plan. Only "Enter a Target on XYZ, an option price, or both." appears: in the summary and beside "Target (XYZ at or above)", which gets `aria-invalid`. The wrong-side Stop gets no error, no `aria-invalid` and no description. W4 appears only after a Target is filled and the trader saves again. Focus moves to the summary, values are kept, and the probe shows 0 Trades after reload. All other errors are correct and sit beside their own field: W5 (Long Call and CSP wording), W10 for −1 and for 1.1234567, W4 in CSP wording, and W3 for a missing CSP Target. When no role is missing, two condition errors show together. |
| Narrow layout (375 and 320 px) | PASS with notes | No page-level horizontal scroll on any changed screen: the option Plan form, Trade Detail, the Open list and the Review card. On the form, each role's two price fields sit side by side and error text wraps readably under its own field. On the Open list, the badges stack under the trade name. The Review card's Conditions list wraps cleanly. The Detail conditions table scrolls inside its own box (see minor observation 1). Axe found no violations on Thursday's Detail, Review card and Open list, or on the form with errors. |

## 3. Overall: **FAIL**

### Defect 1: a wrong-side option-price Stop gets no error while a Target is missing. Severity: **high**
- **Steps:**
  1. New Plan, Long Call, XYZ, Expiration 2026-12-18, Strike 55, Contracts 2, Intended entry 2.00.
  2. Enter "Stop (option price at or below)" 2.50.
  3. Leave both Target fields empty.
  4. Fill the reflection and press Confirm Plan.
- **Expected:** C7S.4's pass condition is "Errors beside the right fields". B7S.2 (D7S breakdown section 6.2) scripts this same flow and expects, from the same save, "W4 beside 'Stop (option price at or below)' and W3 beside 'Target (XYZ at or above)'".
- **Actual:**
  - Only W3 appears.
  - The Stop field keeps 2.50 with no error and no `aria-invalid`.
  - W4 ("The option-price Stop must be below the intended entry price to calculate Risk properly.") appears only on the second save, after a Target is entered.
  - Nothing is saved.
- **Likely cause (code read only to confirm):**
  - `src/ui/screens/PlanForm.tsx:179-189` returns early with only the MissingStop/MissingTarget issues and never submits.
  - `assessPlan` (`src/domain/trade-analysis/plan.ts:269`) would also stop before the per-condition checks when MissingTarget is present.
- **Why high:** the flow fails its pass condition and the plan's B7S.2 expectation. If you read "errors beside the right fields" as satisfied one error at a time, it would be moderate: the trader can still finish after a second save.

## 4. Minor observations
1. **Detail conditions table at phone width (low).** At 375 and 320 px only the "Condition" column is visible. Boundary, Status, Distance and Overrun need a horizontal scroll inside the table's own container: an 834 px table in a 301 or 246 px box. The page itself doesn't scroll sideways and axe passes. D7S's longer labels ("Stop on the option price" wraps to 3 lines at 320 px) widen the first column. D7 already had this 7-column layout, and the same statuses are readable on the Review card.
2. **Provisional words.** "Breached, $20.00 beyond" and "Breached, $10.00 beyond" read clearly. A Target reached with $0 Overrun shows plain "Reached", which is consistent. "Target on the option price at or below $0.30: Active" reads well. The `h4` "Conditions" heading raised no axe issue. I didn't see the stock card's "Target at or above $X", because no stock Trade was in these flows. None of these misled.
3. **Labels before a symbol is typed.** The Underlying labels read "Stop (Underlying at or below)" until a symbol is typed, then "Stop (MNO at or below)". This matches W2's fallback.
4. **Card pressure matches the headline conditions (A197).** Tuesday reads "23% of the way from entry to the Stop", and the slider reads "58% of the way from the Stop to the Target, entry at 76%". These are measured on the option price between S-o's $3.60 and T-u's value at expiration of $0.50, and they check out arithmetically. Wednesday and Thursday read "Past the Stop" with the marker pinned at the Stop end. On Thursday the Stop wins the slider while both badges show.
5. **No MNO figure for the 0.10.** Thursday's "Target on MNO" row shows "Distance on MNO 0.00" and Overrun $0.00. Section 4's "MNO 0.10 beyond" doesn't appear anywhere as an MNO figure. This is consistent with W7, not a defect.
6. **Not exercised:** A201's case of two Stops both Breached showing one badge, and C7S.5 and C7S.6 (they belong to the later gate).

## Files
All in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d07s-1/`:
- Scripts: `c1.ts`, `c23.ts`, `c4.ts`, `c4narrow.ts`, `narrow.ts`, `slider.ts`
- Logs: `c23.log`, `c4.log`
- Screenshots at 1280, 375 and 320 px: `c1-*`, `c2-*`, `Wed-*`, `Thu-*`, `narrow-*`, `c4*`
- `report.md` is missing: the harness blocked writing it.
