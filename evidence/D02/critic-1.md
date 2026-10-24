# D2 browser-critic report (critic-1)

Fresh critic agent spawned 2026-10-24 at commit `2440e0f`, after the T2.23 cumulative run was fully green. Report saved in substance below; scripts, screenshots and accessibility-tree dumps were in the git-ignored `test-results/critic-d2-1/`.

## Header

- Date 2026-10-24 (about 12:15–12:31 EDT). Commit `2440e0f`. Node v26.12.0; Chromium 153.0.8010.12 (Playwright, headless); browser time zone America/New_York.
- `npm run build`, `npm run build:faults`, `npm run build:releases` all exit 0; d1 reused from tag `claude-opus-5.5-d1` (402b948).
- Servers: `npm run preview` (5175, production) for C2.1–C2.7, C2.11 and extra probes; `npm run preview:faults` (5175) for C2.10; `startReleaseServer` from `tools/release-server.ts` on port 5176 with `use()` switching d1 → d2 / dist-faults for C2.8 and C2.9; the 5175 server killed mid-flow for C2.11. All stopped.
- No tracked file edited, no commit.

## Results

| Flow | Status | Key observations |
|---|---|---|
| C2.1 First entry | PASS | Plan XYZ 100 @ 50, Stop 47.50, Target 56, Plan time 2026-10-12 09:00 (Detail "Long Stock · Planned", 1R $250.00, reward $600.00, 2.4). Entry 60 @ 50.10, fee 1.00, 10:00, reflection As Planned / Calm / 4. Receipt "Entry recorded", "Buy 60 XYZ @ $50.10, fee $1.00", "Reflection saved." Detail "Long Stock · Open", Position "60 shares of XYZ", one Open Lots row (2026-10-12 10:00, 60, $50.10, $1.00), "Entry not yet resolved: 60 of 100 entered", Fulfillment "Partially filled". Open list row "60 of 100 $50.10 $1.00 Entering 0 Records agree 2026-10-12 10:00"; Planned tab empty. |
| C2.2 Complete the entry | PASS | 40 @ 50.30, fee 1.00, 11:00, declined with reason "Busy at the open". Receipt: Average entry $50.18; Actual initial risk "$270.00 (1.08R)"; reward $580.00; Reward : risk "2.15 (planned 2.4)"; Slippage $18.00; "Reflection declined: Busy at the open". Detail "Resolved at: Position Change at 2026-10-12 11:00", "Size: 1× planned quantity", "Filled as planned"; narrative "Reflection declined", "Reason: Busy at the open". One `journalDeclines` record. |
| C2.3 Oversize | PASS | 20 @ 51.00, fee 1.00, 14:00. Receipt "Entry Size Deviation: 20 shares above plan, caused by this Position Change." Entry Quality unchanged (50.18 / $270.00 / $580.00 / 2.15 / $18.00). Detail "Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00. Active", Fulfillment "Filled with Deviation", 120 shares, 3 Lots, fees $3.00. Same after reload. |
| C2.4 Several fills, one decision | PASS | One Position Change with 30 @ 50.00 fee 0.50 and 30 @ 50.20 fee 0.50 on a new Plan. Receipt lists both Executions under "Position Change at 2026-10-13 10:00"; Detail one Position Change region, 2 Execution rows, 2 Open Lots, 1 Position Change Reflection. Stored: 2 entries, 2 obligations (Plan Reflection plus one). |
| C2.5 Validation | PASS | Row 1 08:00 (Plan 09:00), row 2 2027-01-05 (future), row 3 quantity 0, Decision mode blank. Summary "This entry can't be saved yet" lists all four together ("Execution 1: the Economic Time cannot be before the Plan time." / "Execution 2: the Economic Time cannot be in the future." / "Execution 3: enter a quantity greater than zero, with at most 6 decimal places." / "Answer "Decision mode"."), each also at its field, marked invalid; focus on the summary (tabindex -1). After reload: fact counts and revision unchanged, no new entries or obligations, Trade still "Awaiting entry" under Planned. |
| C2.6 Earlier-dated entry | PASS | Fills 60 @ 50 at 10:00 and 60 @ 51 at 11:00 (resolved at 11:00, 20-share excess); then 40 @ 49 at 10:30. Receipt "This entry moved the Entry Resolution Point to the Position Change at 2026-10-15 10:30." and "This entry changed Entry Quality."; new figures avg $49.60, risk $212.00 (0.85R), reward $638.00, 3.01 (planned 2.4), slippage −$40.00, all arithmetically correct. Detail lists Position Changes 10:00, 10:30, 11:00; the Deviation becomes "60 shares above plan, caused by … 11:00". |
| C2.7 Lists | PASS | Open is the default tab; rows ordered by Last Activity descending (EARLY 2026-10-15 11:00 above MULTI 2026-10-13 10:00); Planned tab lists VALID. A filled unsaved entry form left by reload and by in-app navigation wrote nothing (stores identical before and after). |
| C2.8 Update with migration | PASS | On d1 created Plans AAA and BBB (About: no schema row, D1-only capabilities). Switched to d2; "An update is ready", Reload; a DOM observer caught "Updating your journal to this release". Both Plans under Planned; recording 60 @ 50.10 on AAA worked; About "Schema version 2" and adds `TradeWorkflows.recordPositionChange (…)` and the Open variants. New `tj-ws-*` database, the old one gone, `candidates` and `retired` empty. |
| C2.9 Migration Blocked | PASS | d1 page at `/?faults=migration:validate` → dist-faults → Reload from the notice. "Your journal could not be converted to this release", "Checking the converted copy found these problems, so it was discarded:" ("A Trade names an Account that does not exist."), "Your data is unchanged.", Retry only. Old database's stores byte-identical (only its IndexedDB version 1 → 2, per the D1 amendment); pointer unchanged; no candidate; blocked across reload. After `__tjFaults.set([])`, Retry → Trades with both Plans. |
| C2.10 Recovery Only | PASS | Faults build: Open Trade ROPN, relaunched with `?faults=inventory`. "Read only: this browser can't save right now" with the inventory explanation; Open list and full Open Detail (Lots, Executions, narrative) readable; Record entry absent on Open and Planned Detail; New Plan absent from the navigation. |
| C2.11 Offline, responsive, keyboard, About | PASS | About lists only D1 capabilities, recordPositionChange, browse/detail for Planned and Open. A half-filled form (2 rows, Decision mode Reactive, Note) resized 375 → 800 → 1280 → 375 kept every value and the route, no horizontal scroll on the form. Keyboard-only entry (list, Record entry, quantity/price/fee, three radio groups by Space and arrows, Save entry by Enter, receipt) with a visible outline on every focus. Server killed (curl confirmed): offline reload and an entry on OFFL ("Reflection saved."), surviving a page reload and a full browser restart with the server still down (Open, 60 shares). |

**Overall: FAIL. Defects: 1.**

## Defects

1. **Phone widths: the Open list and the Open Trade Detail scroll the whole page horizontally (medium).**
   - Steps: one Open Trade; viewport 375 px (also 320), by resizing or a fresh load; open Trades, then the Trade's Detail.
   - Expected: `specs/design/ui-contract.md` line 29 "Narrow view is single-column and uses bottom navigation"; line 125 "readable zoom/reflow"; AC-UI-001 (the narrow layout is equivalent and intact). D1's Planned list already does this: at 375 its table scrolls inside its own container and the page stays 375 wide.
   - Actual: Open list `document.documentElement.scrollWidth` 890 against a 375 viewport; the tabs, caption and table overflow and the bottom navigation covers only the left 375 px (`x-02-openlist-375.png`); the `div.table-scroll` wrapper does not contain the table. Open Detail `scrollWidth` 596; the article and cards widen, apparently from the Open Lots and Executions tables (`x-03-detail-375.png`). The entry form and the Planned list are fine at the same widths.
   - C2.11's written pass condition covers only the entry form, so this is a contradiction of the specs rather than of the flow.

## Minor observations (not pass-condition failures)

- Opening `/trades/<id>/record-entry?faults=inventory` directly shows the read-only banner and an empty main area with no explanation or link back; safe (no form) but bare.
- C2.6's receipt does not mention that the 11:00 Entry Size occurrence grew from 20 to 60 shares (Detail shows it); P5 only requires the resolution point and Entry Quality.
- With every Plan entered, the Planned tab reads "No planned trades yet. Start by planning one before you enter it."; "yet" reads oddly.
- Check for updates exists only on About; on the Trades page the critic called `registration.update()`, which is what that button does.
- Two Trades with Last Activity in the same minute are ordered by Trade identity, the documented tie-break.
- Also passed: a Conflict between two tabs ("This Trade changed after you opened this form … Nothing was saved … Your values are kept below." with values kept); Add Execution disabled at 20 rows; a missing fee, a 7-decimal price and a decline reason over 500 characters reported together; axe (WCAG 2.1 A/AA) clean on the entry form, receipt, Open Detail and Open list; number cells right-aligned with tabular numerals.
