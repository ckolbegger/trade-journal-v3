# D2 browser-critic report (critic-2)

Fresh critic agent (brief v1) spawned 2026-10-24 at commit `40581f7`, after the critic-1 fix run was fully green. Report saved in substance below; scripts, logs and screenshots were in the git-ignored `test-results/critic-d2-2/`.

## Header

- 2026-10-24, about 12:40–12:50 EDT. Commit `40581f7`. Node v26.12.0; Chromium 153.0.8010.12 (Playwright 1.63.0, headless, persistent contexts, America/New_York).
- `npm run build`, `npm run build:faults`, `npm run build:releases` exit 0; d1 reused from tag `claude-opus-5.5-d1` (402b948).
- Servers: `vite preview` 5175 (production) for C2.1–C2.7, C2.11 and the narrow checks, killed mid-C2.11 for offline (curl 000); `startReleaseServer` 5176 (d1 → `use('dist-releases/d2')` / `use('dist-faults')`) for C2.8, C2.9 and the narrow check of the Blocked view; `vite preview --outDir dist-faults` 5175 for C2.10. All its servers stopped.
- No tracked file edited, no commit.

## Results

| Flow | Status | Key observations |
|---|---|---|
| C2.1 First entry | PASS | Plan XYZ, Plan time 2026-10-20 09:00 (Planned Detail "Long Stock · Planned", 1R $250.00, reward $600.00, 2.4). 60 @ 50.10, fee 1.00, 10:00, reflection As Planned / Calm / 4. Receipt "Entry recorded", "Buy 60 XYZ @ $50.10, fee $1.00", "Reflection saved." Detail "Long Stock · Open", "60 shares of XYZ", one Open Lots row, "Entry not yet resolved: 60 of 100 entered", "Partially filled". Open row "60 of 100 $50.10 $1.00 Entering 0 Records agree"; Planned tab empty. |
| C2.2 Complete the entry | PASS | 40 @ 50.30, fee 1.00, 11:00, declined "Busy at the open". Receipt $50.18; "$270.00 (1.08R)"; $580.00; "2.15 (planned 2.4)"; $18.00; "Reflection declined: Busy at the open". Detail "Resolved at Position Change at 2026-10-20 11:00", "Filled as planned"; narrative "Reflection declined / Reason: Busy at the open". Arithmetic checked by hand. |
| C2.3 Oversize | PASS | 20 @ 51.00, fee 1.00, 14:00. Receipt: Entry Quality unchanged, "Entry Size Deviation: 20 shares above plan, caused by this Position Change." After reload "Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-20 14:00. Active", "Filled with Deviation", 120 shares, 3 Lots, fees $3.00. Stored: one occurrence, one version, fingerprint (trade, leg, 14:00 PC); 1 decline; 3 Position Change facts. |
| C2.4 Several fills, one decision | PASS | MULTI under Planned "Awaiting entry"; one Position Change of 30 @ 50.00 fee 0.50 and 30 @ 50.20 fee 0.50. Receipt lists both Executions; Detail 1 Position Change with 2 Executions, 2 Open Lots, exactly 1 Position Change Reflection; stored one PositionChange fact with 2 members. |
| C2.5 Validation | PASS | Row 1 08:00 (Plan 09:00), row 2 2027-01-05, row 3 quantity 0, Decision mode blank. Summary "This entry can't be saved yet" lists all four together, each also at its field (4 fields aria-invalid); focus on the summary; after reload the full store dump is identical and the form empty. |
| C2.6 Earlier-dated entry | PASS | 60 @ 50 at 10:00, 60 @ 51 at 11:00 (resolved at 11:00, avg $50.50, $360.00 1.44R, 20-share excess); then 40 @ 49 at 10:30. Receipt "This entry moved the Entry Resolution Point to the Position Change at 2026-10-23 10:30." and "This entry changed Entry Quality."; $49.60, $210.00 (0.84R), $640.00, 3.05 (planned 2.4), −$40.00, all correct. Detail lists 10:00, 10:30, 11:00; Deviation "60 shares above plan, caused by … 11:00". |
| C2.7 Lists | PASS | Open default (aria-selected), ordered EARLY 2026-10-23 11:00, MULTI 2026-10-21 10:00, XYZ 2026-10-20 14:00; Planned lists VALID. Filled unsaved forms left by reload and by navigation wrote nothing (store dump identical, Web Storage empty, form empty after reload). |
| C2.8 Update with migration | PASS | d1: AAA and BBB confirmed, About D1-only. d2 via Check for updates → "An update is ready" → Reload; observer saw "Updating your journal to this release". About "Schema version 2" and recordPositionChange; AAA and BBB under Planned; entry 60 @ 50.10 on AAA recorded. New `tj-ws-*`, old database gone, candidates [] and retired []. |
| C2.9 Migration Blocked | PASS | d1 at `/?faults=migration:validate` → dist-faults → Reload from the notice. "Your journal could not be converted to this release" / "Checking the converted copy found these problems, so it was discarded:" / "A Trade names an Account that does not exist." / "Your data is unchanged.", Retry only. Old stores byte-identical (version 1 → 2 per the D1 amendment); pointer unchanged; no candidate. After `__tjFaults.set([])`, Retry → Trades with AAA and BBB and a new database. No overflow at 320 or 375. (The fault applies only if the reloaded URL carries `?faults=`.) |
| C2.10 Recovery Only | PASS | Faults build, Open ROPN and Planned RPLN, relaunched with `?faults=inventory`: "Read only: this browser can't save right now" with the inventory explanation; Open list and Detail readable; Record entry absent on Open and Planned Detail; navigation Trades / Accounts / About; probe unchanged; list and Detail fit at 375. |
| C2.11 Offline, responsive, keyboard, About | PASS (flow) | Half-filled form resized 375 → 320 → 800 → 1280 → 390 kept every value and the URL. Keyboard-only entry with a visible focus indicator at all 18 stops. About lists only D1 capabilities plus `recordPositionChange (Opening, Increase, Stock, SingleTrade, Complete, Decline)`, browse/detail (Planned, Open), both Entry Types. Offline reload and entry on OFFL ("Reflection saved."); after a full restart with the server down the Open list shows OFFL and KEY. |
| Narrow layout of every D2 screen | FAIL | No page overflow at 375/320 on the Open list, Open Detail, Planned Detail, entry form, validation state, receipt, Recovery Only list and Detail, Migration Blocked. Overflow on the **Planned list** (scrollWidth 677) and **About** (scrollWidth 386). |

**Overall: FAIL. Defects: 2.**

## Defects

1. **The Planned tab scrolls the whole page horizontally at phone widths (medium).** Production build, at least one Planned Trade, viewport 375 or 320 (fresh load of `/?lifecycle=Planned` or resized from 1280). Expected: `specs/design/ui-contract.md` Responsive behavior ("Narrow view is single-column and uses bottom navigation") and accessibility ("readable zoom/reflow"); AC-UI-001/AC-UI-002 (B2.12); the Trades tabs including Planned are a D2 screen (A32), and the Open tab now holds its table in a scrolling `div.table-scroll`. Actual: `scrollWidth` 677 against 375/320; the table (about 661 px) sits in a plain `DIV` with `overflow-x: visible`, not `.table-scroll`; the bottom navigation covers only the left 375 px (`narrow-planned-list-375.png`, `narrow-planned-list-320.png`). Probably introduced by the critic-1 fix `e8735b0` (`.shell > * { min-width: 0 }`, with only the Open table given a scroll container); critic-1 had found the Planned list fine.
2. **About scrolls the page horizontally at 375 and 320 (low).** Expected: reflow without horizontal scroll (same clauses). Actual: `scrollWidth` 386; the unbreakable "TradeViewsAndReporting.getTradeDetail (Planned, Open)" overflows its card and "America/New_York" overhangs the card edge (`narrow-about-320.png`). About is from D1; D2 lengthened the capability list.

## Minor observations (not pass-condition failures)

- The receipt renders at the entry form's URL (`/trades/<id>/record-entry`); reloading it shows a blank "Record entry" form rather than the Trade or the receipt, which could invite a duplicate entry. Nothing was written.
- C2.6's receipt does not say that the 11:00 Entry Size occurrence grew from 20 to 60 shares (Detail shows it); P5 only requires the resolution point and Entry Quality.
- Entry Quality's "Size 1× planned quantity" stays 1× after the 120-share oversize (correct: measured at resolution) but can be misread next to "120 of 100".
- The faults build reads `?faults=` from the URL at reload, so an update triggered from /about ignores a fault set on another URL (test procedure only).
- Also passed: Open list average cost (XYZ $50.32, EARLY $50.13); Cancel returns to the Detail; the Blocked view shows only Retry; Recovery Only still offers "Ask the browser to keep data", which is not an authoritative mutation.
