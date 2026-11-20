# D09R2 — The Review's Marks grid: task breakdown

Definition: not yet in the implementation plan; section 1.2 holds the decisions to record when this breakdown is agreed. Source: the research page `research/review-page-style.html` (its sections 4 to 12), the D08P breakdown's follow-on in its section 10.2, and the user's decisions in `plan/D09R2-drafting-handoff.md` (2026-11-20). Drafted on `claude-opus-5.5` at `5bce5a85`, after D9 closed (tag `claude-opus-5.5-d9`, `10a4689e`).

Status: **Draft, not agreed.** Numbering continues from D9A-R: P154, A288 and W71. When agreed it is plan revision 112 with decision 123. Runs after D9, before the coach review of the Review page (`evidence/D09/coach-review-2-prompt.md`).

**Checked against all of `specs/`, 2026-11-20.** The design specs for the Daily Review, Market Data and the UI contract were read in full, and the rest of `specs/` was swept for constraints on the Review's Marks; what bears on D9R2 is cited where it applies (the delivery contract on unsaved work, AC-JOUR-001 on stored drafts, ADR 0011 on bound keys, AC-PERF-001 on reads). The spec map is retagged: D9 now also reads S039, S042, S043, S046, S091, S094, S096 and S123 (D9R2 has no tag of its own, as D8R and D9A-R had none, so it reads D9's list).

**In the trader's words.**
- **Several days' Marks at once.** Each Trade's Marks panel becomes a grid like Price History: a row per Instrument, a column per session, newest on the left. The Review Date and the session before it always show, then each earlier session that still lacks a Mark.
- **Type once, filled everywhere.** A price typed for NVDA on Thu Oct 8 shows in every other Trade that holds NVDA, marked "Unsaved".
- **One Save Marks saves everything typed**, in every Trade and every session, at once. Moving to another Trade or another page of sessions keeps what was typed; leaving the page still asks first.
- **Everything about a cell in one place.** Under the grid, the chosen cell's editor holds "Can't get a price" with its reason, Correct, and Withdraw (Review Date only).
- **On a phone the grid turns**: sessions become rows, so a one-leg Trade needs no sideways scroll.
- **Three small fixes.** The card's "Fri Oct 9 close" heading reads "At the Fri Oct 9 Marks". Price History shows an acknowledged session as "Acknowledged Unavailable", not a bare dash, and counts only real gaps. Its gains and losses take the colours used everywhere else.

---

## 1. Decisions and clarifications

### 1.1 The user's decisions

| # | Decision | Where it lands |
|---|---|---|
| U1 | **One save carries several sessions' Marks** (2026-11-20). One Save Marks saves everything entered, across sessions, Instruments and Trades, in one commit. | P157; T9R2.13; I9R2.2; B9R2.3. |
| U2 | **The grid first, then the coach review, then the rest** (2026-11-20). The rail, drawers, tabs, Replay's new place on the card and other restyling wait for the coach review. | Section 2; section 3 (the cost of moving the grid into a Marks drawer later). |
| U3 | **The research page's settled answers**: one grid per Trade, styled like Price History; the Review Date and the previous session always, then each earlier session missing a Mark; 20 earlier sessions a page with the Review Date and previous session fixed; a typed price fills the same cell in every Trade holding the Instrument (drafts belong to the Review); all three small fixes are wanted. | P155, P156, P157, P158, P159, P160, P161. |
| U4 | **The mockups are enough** (2026-11-20, open question 1). The research page's static mockups sign off the grid's look; no clickable prototype comes first. This answers D08P's section 10.1 prototype rule for this grid. | Section 11, question 1. |
| U5 | **Tech debt item 11** (the Open list's "Thu Nov 12 close") stays tech debt (2026-11-20). | Section 2; section 10. |

### 1.2 Decisions for this breakdown

To record as decision 123 when agreed.

**P154 — The three small fixes are D9R2's first four tasks** (T9R2.1, T9R2.2, T9R2.3, T9R2.4), not a deliverable of their own. Why: they are small (two Light, two Standard), they need no gate of their own, and T9R2.8 extracts Price History's frame into the shared grid while proving Price History looks the same: doing the fixes first means the extraction's before-and-after compare is taken once, on the fixed Price History, instead of moving twice. Running them alone first would cost a second gate, critic and benchmark for four tasks. The Review card's heading fix (T9R2.1) is the same family as tech debt item 11 but touches only the Review card; item 11 stays tech debt (U5).

**P155 — The grid's data comes from the Review open's existing read** (research section 8). The Daily Review open result's Marks family gains two additive fields, `previousSession` and `earlierMarks` (A288). They are read through the open's existing read session (`series` reuses the scan `historicalGaps` already made, A289), so: no new operation, no new store read, no schema change, and `SaveReviewMarks` unchanged. Market Data's series point gains `resolutionRevision` for an Available Mark, additively, so Correct can bind an earlier session's Mark (A290). A query-count case (I9R2.4) proves the open's reads are unchanged; AC-PERF-001's Review-open row and the benchmark re-measure it after the gate (decision 114).

**P156 — Mark drafts belong to the Review, not to a card** (amends A153 and A156; research section 5). Exactly these hold rules change:

| Rule | Today (A153, A156, T5R.12, A57 paging) | After D9R2 |
|---|---|---|
| A Mark draft (a typed price, or "Can't get a price" with its reason) | Holds the open card: opening another card or panel is refused with "Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it." | **Holds nothing on the page.** Opening another card, panel or page of sessions keeps it. |
| A Correct in progress in the cell editor | Holds the card. | Still holds the card (it saves on its own, with its reason). |
| An Action, Debt or reflection form with entered values | Holds the card. | Unchanged: still holds the card. |
| Leaving the page (route, reload, update) | Held while anything is unsaved (`onDirtyChange`; the delivery contract defers an update during unsaved work). | Unchanged: any Mark draft anywhere still holds leaving the page. |
| Saving an Action that moves to the next card | With Mark drafts on the card: "The Action is saved. Save or discard what you entered for XYZ (…) to go on." | Mark drafts no longer stop it: the next card opens and the drafts stay. The message still fires for the forms that hold the card. |
| Paging earlier sessions | Refused while a draft or a Correct exists ("Save or clear the value you entered on this page to change pages."). | Paging keeps drafts. Only a Correct in progress holds it, with W80. |
| Discard | Empties the open card's drafts. | Empties every Mark draft on the page. |
| A draft whose key leaves the Review on a refresh | The card's "not kept" notice. | The same notice, naming the Trade the draft was typed in; a draft whose key is still in the Review (another Trade holds the Instrument) is kept. |

**P157 — One Save Marks sends every draft** (U1). One `SaveReviewMarks` command carries every draft on the page, across Trades, sessions and Instruments, each bound at its standing's revision (A172). Its `tradeId` is the open card's Trade, or, with no card open, the Trade the newest draft was typed in; it only chooses the card `postMarksReview` refreshes (lookup in section 1.5). The button shows under the open card's grid and, while any draft exists, in the Review's status header beside the count (W75) and Discard. With more than 100 drafts (A154's limit, `MAX_ENTRIES`), Save Marks sends nothing and says so (W76). A refused save opens the first refused cell's editor with its issue and puts focus there (A294).

**P158 — The grid** (research section 4). One grid per Trade, in its card's Marks panel. Rows: one per Instrument the Trade holds, in today's Mark-row order, headed "<symbol> Mark", "Call Mark" or "Put Mark" as Price History does (W9). Columns: "Session", then the Review Date (tag "Review Date"), the previous session (tag "Previous"), then each earlier session where any of the Trade's Instruments lacks a Mark, newest first. No Trade P&L row. Earlier sessions page 20 at a time; the Review Date and Previous columns stay on every page. Enter moves down a session's column, then to the next session's first input; from the last input it moves to Save Marks.

**P159 — One shared session grid** (research section 10). Price History's table frame moves into a presentational component under `src/ui/cockpit/` (A216: plain props, adapters in `*.props.ts`). Price History renders through it read-only and must look the same afterwards; the Review renders through it with editable cells, its adapter in `src/ui/screens/`.

**P160 — The cell editor sits under the grid** (research section 6, option B). Choosing a cell opens one editor below the grid, a region named after the cell ("NVDA Mark, Thu Oct 8"). It holds what today's Mark row holds: the status (Missing, Acknowledged Unavailable with its reason, the Mark with Corrected), Correct (saves at once with its reason), Withdraw (Review Date only, A57), "Can't get a price" with "Reason (required)" and Cancel, the "0 means it closed with no value" hint, "Needed only while settlement is due", "also held by …", and the conflict and storage messages. A typed price is entered in the cell itself.

**P161 — The phone layout** (research section 7). Under 40rem of card width (a container query, as the card's slider rule does), the grid turns: sessions become rows and Instruments columns. Cells are at least 44 px high on touch screens. A one-leg Trade needs no sideways scroll. Drafts live above the layout, so resizing keeps them (AC-UI-001).

**P162 — Run plan.** One task at a time, in the Progress order (no lanes): T9R2.7, T9R2.9, T9R2.11, T9R2.12 and T9R2.13 all change `CardMarks.tsx` or `held-review.ts`, so lanes would mostly wait or conflict. Task levels and their suite tiers per decision 122. One browser critic at the gate (T9R2.18); the benchmark runs once after it (decision 114). P137 (shortening approved words, recorded before and after) and P138 (the critic limit and known flaky cases) apply.

### 1.3 Amendments to other plan sections

Each is written into its decision's breakdown when D9R2 is agreed, in the decided style ("Amended by decision 123 (D9R2): …").

- **A153 (the Marks panel, D5R).** Amended: the panel is the Trade's Marks grid (P158), not a list of rows; today's rows and the "Earlier sessions without Marks — optional" list become columns of one grid. Drafts belong to the Review (P156).
- **A156 (unsaved work holds the card, D5R).** Amended per P156's table: Mark drafts no longer hold the card; a Correct in progress, and Action, Debt and reflection forms, still do; leaving the page is still held.
- **T5R.12's after-Action message (D5R).** Amended: it no longer fires for Mark drafts.
- **A57 (Withdraw on the Review Date only; earlier sessions' paging).** Withdraw unchanged. Paging amended: paging keeps drafts and is held only by a Correct in progress (W80).
- **A161 (Missing-Mark links, D5R).** Amended: a link (`?trade=&instrument=`) opens the Trade's card on its Marks panel with focus on the Instrument's Review Date cell, not on a row.
- **A171, A172 (the held Review, D5R2).** Amended: an earlier session's cell takes its standing through the same fold; `listedStanding` also reads `earlierMarks` (A291). Learned revisions still never move backward.
- **D5R section 6.4 (browser helpers) and decision 65.** Amended: `markRow(page, card, date)` selects the Instrument's cell and returns the cell editor's region (same name as today's row); a new `markCell` returns the cell's input. The migration rule (mechanical only) applies (T9R2.10).
- **A210 (ReadSeries, D08P).** Amended: an Available series point also carries `resolutionRevision` (A290).
- **A214 (Journal cards' session lines, D08P), W9 and W1.** Amended: an acknowledged session shows "Acknowledged Unavailable", not "—" named "No Mark"; Price History's count line and tab count count Missing sessions only.
- **A216 (cockpit components take plain props).** Clarified: the shared session grid is a cockpit component; the Review's adapter lives in `src/ui/screens/` and imports only its props type and component.
- **W19 (D08P).** Extended to the Review card: "At the Fri Oct 9 Marks" replaces the heading "Fri Oct 9 close".
- **The Daily Review design spec** (`specs/design/daily-review.md`, the open result). One sentence added by T9R2.6: the Marks family carries the previous session and each listed Instrument's Marks on the sessions the grid shows, read in the open's read session.

### 1.4 Working assumptions

**A288 — The open result's new fields.** On the Marks family, beside `today` and `earlier`:
- `previousSession?: string`: the session before the Review Date (`read.previousSessionDate`), absent when there is none;
- `earlierMarks`: one entry per Instrument with exposure before the Review Date, each with `instrumentKey`; `trades: { tradeId, from }[]` (each holding Trade's first relevant session, computed as gap groups compute it with `firstRelevantGapDate`); and `marks`: by date, `{ resolution, resolutionRevision }` for every Available Mark on the previous session and on every date any of the Instrument's Trades' gap groups list. Missing and acknowledged dates already travel in `earlier` (gap groups), so `marks` holds only Available ones.

**A289 — The read stays in one scan.** For each Instrument in `earlierMarks`, `assemble` calls the open's read session's `series(instrumentKey, from, previousSession)` with `from` the earliest of its Trades' `from`. `series` reuses `historicalGaps`' cached scan when `from`'s first relevant session is not before the cached exposure and `to` is before the Review Date (lookup, section 1.5), so no store request is added. Instruments whose Trades all opened on the Review Date get no call (they have no scan, and a call would start one). I9R2.4 counts requests before and after.

**A290 — Series points carry the resolution revision.** `SeriesPoint`'s Available kind gains `resolutionRevision: number`, the stored record's (not `revisionNumber`). Additive, as revision 93 added provenance. Consumers that build or compare points (lookup): `trade-views.ts`, `assemble-replay.ts`, `market-data.test.ts` (strict `toEqual` at lines 648 and 700), `daily-review.test.ts`, `replay-trade.test.ts`. A strict expectation that fails only because the field appears gets exactly that field added, and is listed in `structural.md` (revision 88's rule).

**A291 — How each cell is decided.** For Trade T, Instrument I, session d:
1. d before T's `from` for I: **Not held** ("—" named "Not held", W77).
2. d is the Review Date: the Mark row (`today`).
3. d listed in I's gap group for T: **Missing** (an input) or **Acknowledged Unavailable**.
4. Otherwise: the Available Mark from `earlierMarks`.

Every cell's standing goes through `held-review.ts`'s `standing()`, so a revision learned from a save or a conflict is never undone by an older Review (A172). A session column shows when any of T's Instruments is Missing or acknowledged there; that column's other cells show their Mark (research: "Mon Oct 5 is shown because the Call has no Mark there, though NVDA does").

**A292 — Drafts live in a pure module.** `src/ui/screens/review-drafts.ts` holds drafts by observation key (Instrument and date): a price or "Can't get a price" with a reason, and the Trade it was typed in. It offers set, clear, discard all, the save entries (each bound at its standing's revision), and keep-only (the keys still in a refreshed Review, returning those dropped for the "not kept" notice). `ReviewView` owns the state; each card's grid reads it. No draft is stored (AC-JOUR-001).

**A293 — The mirrored cell.** In another Trade's grid, a key with a draft typed elsewhere shows the price and the tag "Unsaved" as text, not an input (W73), described as "Typed in XYZ (Long 100 shares @ $50.10)" (W74). Pressing it moves the input to this Trade (the draft's Trade changes) and focuses it.

**A294 — Focus after a refused save.** The first refused key in the grid's order: its card opens on the Marks panel, its page shows, its editor opens with the issue, and focus goes to its input (or to the editor's first control when it has no input). Issues on other keys stay on their cells.

**A295 — Enter order.** Within the open card's grid: down the session's column in row order, then the next older session's first input, across pages only by the paging buttons; from the last input on the page, to Save Marks.

**A296 — Paging.** 20 earlier sessions a page, as `GAPS_PER_PAGE` today, with "Sessions 1 to 20 of 34", "Previous page" and "Next page". The Review Date and Previous columns show on every page. A Correct in progress holds paging (W80).

**A297 — Leaving the grid's cell editor.** Choosing another cell closes the editor without saving anything; a typed price stays a draft in its cell. A Correct in progress refuses the move, as it holds the card.

**A298 — What the tests reuse.** Unit fixtures from `CardMarks.test.tsx`, `ReviewView.test.tsx`, `ReviewCards.test.tsx` and `ReviewOptionMarks.test.tsx`; browser support from `e2e/d4/support.ts` (`markRow`, `enterMark`, `acknowledgeMark`), `e2e/d5r/support.ts` (`createCardFixture`: T-A to T-F, `saveMarksOf`, `remainsOf`) and `e2e/d7/support.ts` (`optionMarkRow`, `saveMarkPrice`, `createSettlementFixture`). The d9r2 support adds only a gap fixture (an Instrument shared by two Trades, a missing earlier session, an acknowledged one and more than 20 gaps).

**A299 — Old unit cases retire with a pairing table**, as T8P.27 did: each retired `CardMarks.test.tsx` case (17 today) names the new case that covers its behavior, in `structural.md`.

### 1.5 Size check

The graph has **17 tasks** and **three open questions** raised; two are answered (the prototype and the words), so one is left. There is no schema change: the open result gains two additive fields and a series point one (P155). None of the guide's three limits is met, so **no split is proposed** and no checkpoint critic is added.

Worth knowing before agreeing: the natural pause for a look is after T9R2.11 (the grid shows in the card, with Save Marks still per card). Drafts across Trades (T9R2.13) are the riskiest step, as the handoff says; if the user would rather see the grid before drafts move, that is the pause. It is a look, not a gate.

### 1.6 Lookups (drafting guide)

Run on `5bce5a85`, excluding `node_modules`, suite-run logs and the lane worktrees under `.claude/worktrees/`. The commands and their full output are in the appendix; this section says what each hit means.

**Texts.** Each changing text, the test files that assert it (lines), and the task that changes those lines. "Stays" marks a hit that is another screen's or a correct use.

| Text that changes | Test files that assert it (lines) | Task |
|---|---|---|
| Heading "Fri Oct 9 close" on the Review card's dated figures | `src/ui/screens/CardFigures.test.tsx` (74, 115, 150); `src/ui/screens/ReviewCard.test.tsx` (205); `e2e/d7sp/review-dated-line.spec.ts` (31; its title at 11 says "Monday Mark" and stays) | T9R2.1 |
| — the same search's other hits | "Awaiting the … close" (the session's end, correct): `e2e/d7p/layout.spec.ts` (20), `e2e/d4/breach-overrun.spec.ts` (11, 41, 42), `e2e/d4/responsive-a11y.spec.ts` (222, 231), `src/ui/calculation-words.test.ts` (243, 246, 247), `e2e/d8r/states.spec.ts` (91, a comment). `tests/integration/d7/missing-mark.test.ts` (71, 81, 82) builds its own string from the view. "Stale context: … from Fri Oct 9 close" (Trade Detail's note): `e2e/d4/expected-mark.spec.ts` (25), `e2e/d4/responsive-a11y.spec.ts` (181), `src/ui/cockpit/drawers/today.test.tsx` (22, 30), `src/ui/screens/trade-detail/Placed.test.tsx` (28), `src/ui/cockpit/drawers/today.props.test.ts` (278). The Open list: `src/ui/screens/TradeList.test.tsx` (687, 711), tech debt item 11. | Stay (section 10 names the stale-context wording) |
| Price History: an acknowledged session's "—" named "No Mark" | `src/ui/cockpit/drawers/price-history.props.test.tsx` (137, 161, 205): their fixtures hold Missing sessions only, so they stay; T9R2.2 adds the acknowledged case. `e2e/d8p/history.spec.ts` (22, 40, 41): Missing sessions, stay. Every other "No Mark" hit is the replay's (`src/ui/cockpit/replay/*`, `e2e/d9*/`): stays. | T9R2.2 |
| Journal cards: an acknowledged Mark's "—" and the "without Marks" merge | `src/ui/cockpit/journal-cards.props.test.tsx` (138, 277): Missing sessions, stay. Code: `src/ui/cockpit/drawers/journal.props.ts` (70, 156, 161, 180). | T9R2.3 |
| Price History's count: "2 sessions without Marks." now counts Missing only | `src/ui/cockpit/drawers/price-history.props.test.tsx` (73, 81, 141, 142, 158, 165); `e2e/d8p/history.spec.ts` (43, 49). Their fixtures have no acknowledged session, so the counts stand; T9R2.2 adds one. | T9R2.2 |
| Heading "Today's Marks" (goes: the Review Date is a column) | `e2e/d5r/marks.spec.ts` (22); `src/ui/screens/ReviewView.test.tsx` (298, 313, 351); `src/ui/screens/CardMarks.test.tsx` (635, 645) | T9R2.11 |
| Heading "Earlier sessions without Marks — optional" (goes) | `e2e/d4/gaps.spec.ts` (6); `src/ui/screens/ReviewView.test.tsx` (324, 351, 352); `src/ui/screens/CardMarks.test.tsx` (645, 655) | T9R2.11 (`e2e/d4/gaps.spec.ts` by T9R2.10's helper move) |
| "These sessions do not block the Review." becomes W72 | `e2e/d4/gaps.spec.ts` (23) | T9R2.11 |
| "Save Marks (n)": the count is every draft on the page, not the card's | `e2e/d4/support.ts` (291, 297), `e2e/d7/support.ts` (120, 129), `e2e/d9/support.ts` (187, 189), `e2e/d9ar/support.ts` (67, 68): helpers, reached through `markRow`; the counts stand where one card holds the drafts. `e2e/d4/responsive-a11y.spec.ts` (272), `e2e/d5r/marks.spec.ts` (52, 62, 68, 118), `e2e/d9ar/states.spec.ts` (112). Units: `CardMarks.test.tsx` (187, 196, 201, 213, 260, 275, 298, 308, 317, 329, 335, 340, 357, 366, 370, 384, 394, 400, 408, 428, 433, 452, 536, 560, 567, 574, 582, 590, 596, 617), `ReviewCard.test.tsx` (1437, 1492, 1551, 1557, 1783), `ReviewView.test.tsx` (318, 369, 440, 477), `ReviewCardMeter.test.tsx` (161), `src/coordinators/daily-review/meter.test.ts` (68, a comment). Each is checked by the task that moves its file; a count changes only where drafts sit on two cards. | T9R2.11, T9R2.13 |
| Hold message "Save or discard what you entered for … to leave it." no longer fires for Mark drafts | `e2e/d4/card-helpers.spec.ts` (56, 87: Mark-draft refusals, change); `e2e/d4/support.ts` (242: the helpers' refusal check, stays); `e2e/d5r/marks.spec.ts` (85, 93: B5R.5 holds the card with a Mark draft, changes to a reflection draft); `ReviewCard.test.tsx` (526, 581, 1524); `ReviewCards.test.tsx` (569, 740, 902, 922, 1006, 1027); `CardMarks.test.tsx` (625). Code: `ReviewCard.tsx` (128), `ReviewOwedCard.tsx` (103, the owed card's reflections: stays). Each case that holds with a Mark draft either switches to a form that still holds or becomes "keeps the draft". | T9R2.13 |
| After-Action message "The Action is saved. Save or discard … to go on." no longer fires for Mark drafts | `ReviewCards.test.tsx` (1027); code `ReviewView.tsx` (400) | T9R2.13 |
| Paging hold "Save or clear the value you entered on this page to change pages." becomes W80 | No test asserts it (code only, `CardMarks.tsx` 227). Paging cases: `ReviewView.test.tsx` (376, 377, 384, 410), `CardMarks.test.tsx` (541). | T9R2.11, T9R2.13 |
| "also held by" moves into the cell editor | `e2e/d5r/marks.spec.ts` (24); `CardMarks.test.tsx` (630, 640, 653) | T9R2.12 |
| "Needed only while settlement is due" moves into the cell editor | `src/ui/screens/ReviewOptionMarks.test.tsx` (116, 138, 139, 140) | T9R2.12 |
| Specs that read a Mark row's own Price input or Cancel (not through Correct) | `e2e/d4/no-save.spec.ts` (51, 62: Correct's Price inside the editor, keep working), `e2e/d4/responsive-a11y.spec.ts` (133, 144), `e2e/d5r/marks.spec.ts` (82), `e2e/d5r/responsive-a11y.spec.ts` (68). The wider reading list from drafting (card-helpers, runtime-failure, sliders, review, d9ar states) reaches the row's Price through `markRow(…).getByLabel('Price')` on several lines; T9R2.10 moves every one to `markCell`. | T9R2.10 |

**Shapes.**
- **`SeriesPoint`** gains `resolutionRevision` (A290). Consumers: `src/coordinators/trade-views/trade-views.ts` (31, 336, 506), `src/coordinators/replay/assemble-replay.ts` (6, 25, 34, 56, 62, 154), `src/modules/market-data/index.ts` (31, re-export), and tests `market-data.test.ts` (651, 700, 702, 710, 726, 753, 754, 762; strict at 648 and 700), `daily-review.test.ts` (1316), `replay-trade.test.ts` (480). The replay copies only the fields it names, so its views do not change.
- **The open result's Marks family** gains `previousSession` and `earlierMarks` (A288). `tests/fixtures/*/expected-views.json` hold `review.families` (10 files), but `tools/fixtures/snapshot-compare.ts` (`compareSnapshot`) compares only keys the snapshot holds, so the additive fields change no fixture. `tools/fixture-views.ts` and `tools/verify-fixtures.ts` read only the Trades and Settlement families. The `resolutionRevision` hits in the fixtures are today's Mark rows' and observation records' own fields: no change.

**Checks.** No new check is planned. The shared grid lives under `src/ui/cockpit/`, where `eslint.cockpit.config.js`'s A216 rule already applies; its adapter in `src/ui/screens/` is outside the rule's files, as the Review's meter adapter is.

**Names.** Names a task renames, repurposes or removes:
- `PriceHistoryTable` (T9R2.8 keeps the export as a thin wrapper over the shared grid, so its hits stay): `src/ui/cockpit/drawers/price-history.tsx` (13, 74); `src/ui/cockpit/drawers/price-history.props.test.tsx` (9, 42, 62, 66, 89, 116, 126, 135, 144, 154, 165, 172, 182, 191, 201).
- `markRow` (browser helper, repurposed by T9R2.10; same signature, returns the cell editor's region): 17 files, `e2e/d4/support.ts` (the definition) and `e2e/d4/acknowledge.spec.ts`, `card-helpers.spec.ts`, `correct-mark.spec.ts`, `gaps.spec.ts`, `no-save.spec.ts`, `offline.spec.ts`, `responsive-a11y.spec.ts`, `review.spec.ts`, `runtime-failure.spec.ts`, `update.spec.ts`; `e2e/d5/detail-debt.spec.ts`; `e2e/d5r/durability.spec.ts`, `marks.spec.ts`, `responsive-a11y.spec.ts`; `e2e/d7/marks-zero.spec.ts`; `e2e/d8p/support.ts`. The unit files' local `markRow` builders (`ReviewCards.test.tsx`, `ReviewCard.test.tsx`, `ReviewOptionMarks.test.tsx`, `ReviewView.test.tsx`) are other names: stay.
- `markCell` (the new browser helper's name): today only `src/ui/cockpit/drawers/price-history.props.ts` (29, 66), a module-private function, and `today.props.ts`'s `markCellOf` (71, 87, 131). No clash in `e2e/`: stays.
- `GapList`, `GAPS_PER_PAGE`, `withNewest` (removed by T9R2.11; the page size moves to the grid's adapter): `src/ui/screens/CardMarks.tsx` only (174, 187, 211, 212, 224, 233, 246, 286, 412).
- `lacksMarks` (meaning narrowed by T9R2.2), `priceHistoryTabCount` (unchanged name): `price-history.props.ts` (51, 54, 55, 68), `price-history.props.test.tsx` (8, 129, 140, 147, 155, 164), `src/ui/screens/trade-detail/Cockpit.tsx` (13, 165).

### 1.7 Words

**Approved as proposed by the user, 2026-11-20** (open question 2). Words a task adds beyond these are used provisionally and recorded in `evidence/D09R2/new-words.md`.

| # | Where | Proposed | Nearest approved row |
|---|---|---|---|
| W71 | Column tags in the grid's header | "Review Date" under the Review Date's column, "Previous" under the previous session's. | W9: "Thu" over "Oct 15". "Review Date" is the Review header's own label. |
| W72 | Under the grid, when earlier columns show | "Earlier sessions don't block the Review." (replaces the heading "Earlier sessions without Marks — optional" and "These sessions do not block the Review.") | D4/D5R's "These sessions do not block the Review." |
| W73 | A cell holding a draft typed in another Trade | The price, then the tag "Unsaved" ("151.10 Unsaved"). | The Corrected tag on a Price History cell (W9, T8R.4). |
| W74 | That cell's accessible description | "Typed in XYZ (Long 100 shares @ $50.10)" | A156's Trade name in messages. |
| W75 | The Review's status header while drafts exist | "2 unsaved Marks" ("1 unsaved Mark"), then Save Marks (n) and Discard. | "Save Marks (2)" and "Discard" (D5R). |
| W76 | Save Marks with more than 100 drafts | "Save Marks takes up to 100 at once; 112 are entered. Clear 12, then save." | A154's limit has no screen words today. |
| W77 | A cell for a session before the Trade held the Instrument | "—" with the accessible name "Not held". | W9: "—" named "No Mark". |
| W78 | Price History's and the Journal cards' acknowledged session | "Acknowledged Unavailable" in the cell (Price History) and as the Mark's value (Journal card). The count line and tab count count Missing sessions only; their words do not change. | The Mark status "Acknowledged Unavailable" (D4). |
| W79 | The Review card's dated figures heading | "At the Fri Oct 9 Marks" (replaces "Fri Oct 9 close"). | W19, Trade Detail's Today drawer. |
| W80 | Paging while a Correct is in progress | "Save or cancel the correction to change pages." | D5R's "Save or clear the value you entered on this page to change pages." |

Words that stay as approved: cell and editor names ("NVDA Mark, Thu Oct 8"), "Session", "<symbol> Mark", "Call Mark", "Put Mark", "Sessions 1 to 20 of 34", "Previous page", "Next page", "Save Marks (n)", "Discard", the Mark statuses, "Correct", "Withdraw", "Can't get a price", "Reason (required)", "Cancel", the "0 means it closed with no value" hint, "Needed only while settlement is due", "also held by", the conflict and storage messages, and the "not kept" notice. No legend: the column tags and each cell's name carry the states (concise screen text).

---

## 2. Boundaries

In: the Marks grid on today's Review card (its Marks panel), the cell editor, drafts across Trades, one Save Marks, the phone layout, the shared session grid, and the three small fixes.

Out (U2, U5):
- The cockpit-like Review (rail, drawers, tabs), Replay's new place on the card, and every other restyling: after the coach review.
- Tech debt item 11 (the Open list's "Thu Nov 12 close"): stays tech debt.
- Trade Detail's Price History gains no editing; it stays read-only.
- No change to `SaveReviewMarks`, Market Data's save, the schema, or the Settlement family's own Mark rows beyond moving their words into the editor.

---

## 3. Moving the grid into a Marks drawer later

The restyle (research section 3) puts the grid in a Marks drawer beside the rail. What D9R2 builds that carries over unchanged: the shared session grid (cockpit, plain props), the Review's adapter, the cell editor, the drafts module and its place in `ReviewView`, the open result's fields, and every browser case written through `markRow` and `markCell`. What a move would cost: mounting the grid and editor in the drawer instead of the card's Marks panel (one component's parent changes), the drawer's tab count in place of the panel header's summary, A161's links opening the drawer instead of the panel, and the helpers' `reachPanel` step reaching the drawer. About two Standard tasks; no data or save change. Drafts already belong to the Review, which is what the drawer design needs.

---

## 4. Task graph

Level per decision 122. "Outside `src/ui/`" names what a task changes there.

| Task | What | Level | Outside `src/ui/` | Blocked by |
|---|---|---|---|---|
| T9R2.1 | The Review card's dated heading "At the Fri Oct 9 Marks" (fix 1) | Light | No | — |
| T9R2.2 | Price History: an acknowledged session's cell, and counts of Missing sessions only (fix 2) | Standard | No | — |
| T9R2.3 | Journal cards: an acknowledged Mark, and no "without Marks" merge for it (fix 2) | Standard | No | — |
| T9R2.4 | Price History's gain and loss colours (fix 3) | Light | No | — |
| T9R2.5 | Market Data: an Available series point carries its resolution revision | Full | Yes: `src/modules/market-data/market-data.ts` and its test | — |
| T9R2.6 | Daily Review open: `previousSession` and `earlierMarks`, with no added read | Full | Yes: `src/coordinators/daily-review/` (`types.ts`, `daily-review.ts`, tests); one sentence in `specs/design/daily-review.md` | T9R2.5 |
| T9R2.7 | The held Review reads earlier Marks; the drafts module | Full | No | T9R2.6 |
| T9R2.8 | Structural: the shared session grid from Price History's table; Price History unchanged | Standard | No | T9R2.2, T9R2.4 |
| T9R2.9 | The shared grid's editable cells and its turned layout | Standard | No | T9R2.8 |
| T9R2.10 | Structural: the browser helpers move first (`markRow`, `markCell`) | Light | No (tests only, `e2e/`) | — |
| T9R2.11 | The Review's grid in the Marks panel: columns, paging, Enter order | Standard | No | T9R2.7, T9R2.9, T9R2.10 |
| T9R2.12 | The cell editor | Standard | No | T9R2.11 |
| T9R2.13 | Drafts belong to the Review: mirrored cells, one Save Marks, the hold rules | Standard | No | T9R2.12 |
| T9R2.14 | Links, focus after a refused save, the "not kept" notice, resizing | Standard | No | T9R2.13 |
| T9R2.15 | Structural: Node integration suite `tests/integration/d9r2/` | Light | No (tests only) | T9R2.6 |
| T9R2.16 | Structural: browser suite `e2e/d9r2/` | Light | No (tests only) | T9R2.1, T9R2.3, T9R2.14 |
| T9R2.17 | Gate: browser critic, then the benchmark | — (full tier) | No | T9R2.15, T9R2.16 |

Run order (P162): T9R2.1, T9R2.2, T9R2.3, T9R2.4, T9R2.5, T9R2.6, T9R2.7, T9R2.8, T9R2.9, T9R2.10, T9R2.11, T9R2.12, T9R2.13, T9R2.14, T9R2.15, T9R2.16, T9R2.17.

---

## 5. Behavioral tasks

Each task's cases are listed in an order where each needs behavior the earlier ones do not. Every task also runs the cases its lookups name (section 1.6) and changes only the expectations listed there.

### T9R2.1 — The Review card's dated heading (Light)

Files: `src/ui/screens/CardFigures.tsx` (153), its test, `ReviewCard.test.tsx` (205), `e2e/d7sp/review-dated-line.spec.ts` (31).
- it should head the card's dated figures "At the Fri Oct 9 Marks" and name their group the same (W79)

### T9R2.2 — Price History: acknowledged sessions (Standard)

Files: `src/ui/cockpit/drawers/price-history.props.ts` (`markCell`, `lacksMarks`), `price-history.types.ts`, `price-history.tsx`, their test.
1. it should show an acknowledged session's cell as "Acknowledged Unavailable", not "—" named "No Mark" (W78)
2. it should count only Missing sessions in the line under the table when another session is acknowledged
3. it should count only Missing sessions on the Price History tab

### T9R2.3 — Journal cards: acknowledged sessions (Standard)

Files: `src/ui/cockpit/drawers/journal.props.ts` (70, 156, 161, 180), `src/ui/cockpit/journal-cards.props.test.tsx`.
1. it should show "Acknowledged Unavailable" as an acknowledged Instrument's Mark on a session card, not "—" named "No Mark"
2. it should keep a session whose Marks are all acknowledged as its own session card, not merged into a "without Marks" card

### T9R2.4 — Price History's gain and loss colours (Light)

Files: `src/ui/cockpit/styles/history.css`. Rules for the cells' `gain` and `loss` classes with `--target` and `--stop`, as `rail-a.css` (23, 27) does for its data-tone. Styles only: no case; B9R2.1 checks the computed colours.

### T9R2.5 — Series points carry the resolution revision (Full)

Files: `src/modules/market-data/market-data.ts` (`SeriesPoint`, `seriesPoint`, `historicalGaps`), `market-data.test.ts`.
1. it should give an Available series point the stored record's resolution revision
2. it should give a Mark saved over an acknowledgment its resolution revision (2), not its revision number (1)

The strict expectations at `market-data.test.ts` 648 and 700 get exactly the new field (A290), listed in `structural.md`.

### T9R2.6 — The Review open's earlier Marks (Full)

Files: `src/coordinators/daily-review/types.ts`, `daily-review.ts` (`assemble`), `daily-review.test.ts`, `specs/design/daily-review.md` (one sentence).
1. it should give the Marks family the previous session's date
2. it should leave the previous session out when the Review Date has none
3. it should list an Instrument's Mark on the previous session with its resolution revision
4. it should list an Instrument's Mark on an earlier session its Trade's other Instrument lacks
5. it should list no Missing or acknowledged session among an Instrument's earlier Marks
6. it should name each Trade holding the Instrument with its first relevant session
7. it should leave out an Instrument whose Trades all opened on the Review Date
8. it should add no store request to the open (A289; counted as `daily-review.test.ts` 1316 counts series reads)

### T9R2.7 — The held Review's earlier Marks, and the drafts module (Full)

Files: `src/ui/screens/held-review.ts` and its test; new `src/ui/screens/review-drafts.ts` and its test.
1. it should give an earlier session's Mark its standing from the Review's earlier Marks
2. it should keep a revision learned from a save when a later Review lists that earlier Mark at an older revision (A172)
3. it should hold a typed price by Instrument and session with the Trade it was typed in
4. it should replace a typed price with "Can't get a price" and its reason at the same key
5. it should move a draft to another Trade without changing what was entered
6. it should build one save entry per draft, bound at its key's standing
7. it should build no entries for more than 100 drafts and say how many are entered (W76)
8. it should keep only drafts whose keys are still in a refreshed Review, returning the dropped ones with their Trades
9. it should empty every draft on Discard

### T9R2.9 — The shared grid's editable cells and turned layout (Standard)

Files: the shared grid under `src/ui/cockpit/` (from T9R2.8), its types and test, its stylesheet.
1. it should render an editable cell as an input named after the cell ("NVDA Mark, Thu Oct 8")
2. it should tag the Review Date and previous columns (W71)
3. it should render a session before the Trade held the Instrument as "—" named "Not held" (W77)
4. it should render a cell holding a draft from another Trade as its price and "Unsaved", described by that Trade (W73, W74)
5. it should report a pressed cell and mark it as the chosen one
6. it should render sessions as rows and Instruments as columns when turned, keeping every cell's name
7. it should turn when its container is narrower than 40rem (measured, since a container query cannot transpose a table)
8. it should give cells at least 44 px of height on a touch screen

### T9R2.11 — The Review's grid in the Marks panel (Standard)

Files: `src/ui/screens/CardMarks.tsx` (`GapList`, `GAPS_PER_PAGE`, `withNewest` go), a new adapter beside it, `CardMarks.test.tsx`, `ReviewView.test.tsx` (298, 313, 318, 324, 351, 352, 369, 376, 377, 384, 410), `e2e/d4/gaps.spec.ts` (6, 23), `e2e/d5r/marks.spec.ts` (22). Old cases retire with a pairing table (A299).
1. it should show the Trade's Instruments as rows and the Review Date and previous session as columns, newest on the left
2. it should add a column for each earlier session where any of the Trade's Instruments lacks a Mark, showing the others' Marks in it
3. it should show a session before the Trade held an Instrument as Not held
4. it should page earlier sessions 20 at a time, with the Review Date and previous columns on every page
5. it should keep a typed price when the page changes
6. it should move Enter down a session's column, then to the next session's first input, then to Save Marks
7. it should say "Earlier sessions don't block the Review." only while earlier columns show (W72)
8. it should save a Review Date price and an earlier session's price with one Save Marks

### T9R2.12 — The cell editor (Standard)

Files: `CardMarks.tsx` (`KeyRow`, `DraftFields` move into the editor), `MarkEntry.tsx` if its props need the earlier revision, their tests, `ReviewOptionMarks.test.tsx` (116, 138, 139, 140), `e2e/d5r/marks.spec.ts` (24).
1. it should open one editor under the grid when a cell is chosen, named after the cell, with the cell's status
2. it should offer "Can't get a price" with "Reason (required)" and Cancel for a Missing cell, keeping the reason as a draft
3. it should correct an earlier session's Mark at once with its reason, bound at the revision the open listed
4. it should offer Withdraw on an acknowledged Review Date cell and not on an earlier session's
5. it should say which other Trades hold the Instrument ("also held by")
6. it should show the zero hint and "Needed only while settlement is due" where today's row shows them
7. it should show a Correct's conflict in the editor and keep what was entered
8. it should close the editor without saving when another cell is chosen, keeping a typed price as a draft
9. it should refuse another cell while a Correct is in progress

### T9R2.13 — Drafts belong to the Review (Standard)

Files: `ReviewView.tsx` (the drafts' state, the status header, Save Marks at 506, the hold at 396-400 and 441-455), `ReviewCard.tsx` (128), `CardMarks.tsx`, their tests (`ReviewCards.test.tsx` 569, 740, 902, 922, 1006, 1027; `ReviewCard.test.tsx` 526, 581, 1524; `CardMarks.test.tsx` 625), `e2e/d4/card-helpers.spec.ts` (56, 87), `e2e/d5r/marks.spec.ts` (85, 93).
1. it should show a price typed in one Trade in another Trade's grid as its price and "Unsaved"
2. it should move the input to this Trade when that cell is pressed, with focus in it
3. it should open another card with no hold message while only Mark drafts exist
4. it should still hold the card while a Correct, an Action, a Debt or a reflection form has entered values
5. it should open the next card after an Action save with no "Save or discard" message when only Mark drafts exist
6. it should show "2 unsaved Marks" with Save Marks and Discard in the status header while drafts exist (W75)
7. it should save every draft, across Trades and sessions, in one Save Marks command
8. it should empty every draft on the page with Discard
9. it should send nothing and say W76 with more than 100 drafts
10. it should still hold leaving the page while any Mark draft exists
11. it should hold paging only while a Correct is in progress, saying W80

### T9R2.14 — Links, focus after a refused save, kept drafts, resizing (Standard)

Files: `ReviewView.tsx` (links at 206-224, the refresh's notices at 363 and 370), `CardMarks.tsx`, their tests.
1. it should open the card on its Marks panel with focus on the Instrument's Review Date cell from a Missing-Mark link (A161)
2. it should open the first refused key's card, page and editor after a refused save, with focus on its input (A294)
3. it should keep a draft whose key is still in the refreshed Review through another Trade, moving it to that Trade
4. it should name the Trade a dropped draft was typed in, in the "not kept" notice
5. it should keep every draft and the chosen cell when the grid turns

---

## 6. Structural tasks

### T9R2.8 — The shared session grid (Standard)

Move `PriceHistoryTable`'s frame (the region, the table, header row, row labels, cells with tone, provenance and Corrected) into a presentational component under `src/ui/cockpit/` with plain props (A216). `PriceHistoryTable` stays as a thin wrapper so its callers and tests do not change. Verification: `price-history.props.test.tsx`'s case titles and expectations unchanged (before-and-after titles in `structural.md`); `e2e/d8p/history.spec.ts` passes unchanged; a screenshot of the Price History drawer at 1280 and 390 px before and after, compared pixel for pixel; `npm run lint` (the A216 rule).

### T9R2.10 — The browser helpers move first (Light)

Decision 65's rule: helpers first, then specs, mechanical edits only. In `e2e/d4/support.ts`, `markRow(page, card, date)` chooses the Instrument's cell (when the grid is present) and returns the cell editor's region, which keeps today's name; a new `markCell(page, card, date)` returns the cell's input. Both work on today's rows as well (on the old layout `markRow` returns the row and `markCell` the row's Price), so this task lands before T9R2.11 and every spec stays green. The specs that read a row's Price directly (section 1.6) move to `markCell`. Verification: the d4, d5r, d7, d8p and d9ar browser projects pass with no expectation changed; the before-and-after diff of each spec is helper calls only, listed in `structural.md`.

### T9R2.15 — Node integration suite (Light)

`tests/integration/d9r2/`, files as section 7.1 names them. Verification: `npm run test:integration -- d9r2`; `.claude/scripts/acceptance-commands.sh plan/D09R2-review-marks-grid.md` exits 0 for the rows this task covers.

### T9R2.16 — Browser suite (Light)

`e2e/d9r2/` with a `support.ts` that adds only the gap fixture (A298), files as section 7.2 names them. `full-suite.sh` maps `evidence/D09R2` to `e2e/d9r2`, and `test:e2e:4` (`playwright test e2e/d9`) already includes it: no tooling change. Verification: `npx playwright test e2e/d9r2`; `acceptance-commands.sh` exits 0 for every row.

### T9R2.17 — Gate

The full cumulative run, then the browser critic over section 8's flows (P138's limit applies). After the critic passes, the benchmark (decision 114) re-measures AC-PERF-001's Review-open row against D9's figure; tech debt item 3's flaky case is watched as P138 says.

---

## 7. Integration and browser tests

### 7.1 Node integration (`tests/integration/d9r2/`)

| ID | File | What it proves |
|---|---|---|
| I9R2.1 | `open.test.ts` | On a seeded Workspace (an Instrument held by two Trades, a mixed earlier session, a Trade opened on the Review Date), the open's `previousSession` and `earlierMarks` are as A288 says. |
| I9R2.2 | `save-many.test.ts` | One `SaveReviewMarks` with entries across two Trades, three sessions and two Instruments commits once and returns the refreshed Review with every key saved (AC-RESP-001); one stale binding among them saves nothing (ADR 0011); 101 entries are refused with `TooManyEntries` and nothing is written. |
| I9R2.3 | `correct-earlier.test.ts` | Correcting an earlier session's Mark at the revision the open listed succeeds; at an older revision it conflicts. |
| I9R2.4 | `query-count.test.ts` | The Review open's store requests equal D9's count (A289). |

### 7.2 Browser (`e2e/d9r2/`)

| ID | File | What it proves |
|---|---|---|
| B9R2.1 | `history.spec.ts` | Price History shows an acknowledged session as "Acknowledged Unavailable" and counts only Missing sessions on the line and the tab; its gain and loss figures take the Target and Stop colours (computed); a Journal card shows the acknowledged Mark; the Review card's heading reads "At the … Marks". |
| B9R2.2 | `grid.spec.ts` | The grid's rows, columns and tags; Not held; a mixed column; 20 sessions a page with the fixed columns; Enter's order; W72; a Missing-Mark link focuses the Review Date cell. |
| B9R2.3 | `drafts.spec.ts` | A price typed in T-A shows "Unsaved" in T-F (both hold XYZ); moving between cards and pages keeps drafts; the header's count; one Save Marks saves every draft (one `savedAt` in `observationsOf`); Discard empties all; leaving the page asks; a reload stores nothing (AC-JOUR-001). |
| B9R2.4 | `editor.spec.ts` | "Can't get a price" with a reason; Correct an earlier Mark; Withdraw on the Review Date only; a conflict's message; a refused save opens the first refused cell with focus in it; completion is Complete With Unavailable Marks after a Review Date acknowledgment and unchanged by earlier sessions. |
| B9R2.5 | `responsive-a11y.spec.ts` | At 390 px the grid turns and a one-leg Trade has no sideways scroll; 44 px cells on a touch screen; a live resize across 40rem keeps drafts and the chosen cell; the whole flow by keyboard; axe clean in each state. |

---

## 8. Critic flows

| ID | Flow |
|---|---|
| C9R2.1 | A Trade missed for a week: fill five earlier sessions and the Review Date by keyboard, page once, save once. |
| C9R2.2 | An Instrument shared by two Trades: type in one, see it in the other, move the input there, save. |
| C9R2.3 | "Can't get a price" on the Review Date, Correct an earlier Mark, Withdraw an acknowledgment; a conflict from a second tab. |
| C9R2.4 | On a phone: the turned grid, entering Marks, rotating and resizing with drafts held. |
| C9R2.5 | Unsaved work: Mark drafts while saving an Action and opening other cards; a reflection draft still holds its card; leaving the page asks. |
| C9R2.6 | Trade Detail: Price History and the Journal with an acknowledged session, the gain and loss colours; the Review card's "At the … Marks" heading. |

---

## 9. Process

- One task at a time in the Progress order (P162). Each task's suite tier follows its level (decision 122): Full and Standard tasks run their browser tier; Light tasks run none.
- T9R2.10 lands before T9R2.11 so the old browser cases stay green through the move (decision 65).
- Each critic defect is first reproduced by a failing test.
- Pending decisions are recorded in `evidence/D09R2/DECISIONS-PENDING.md` (decision 113, as amended by 115) and park only their own task.

---

## 10. Follow-ons and tech debt

- **Tech debt item 3** (the flaky Restore case): the gate's full run watches it, as P138 says.
- **Tech debt item 11** (the Open list's "Thu Nov 12 close"): stays tech debt (U5).
- **Found while drafting:** Trade Detail's stale-context note says "Stale context: $51.20 from Fri Oct 9 close" (lookup, section 1.6): a price called a "close", the same family as item 11. Not in D9R2; offered to the user as tech debt item 12.
- **Triggers:** a style-only ocr finding or a low critic defect goes to `evidence/D09R2/tech-debt.md`, reviewed with the user after the gate.

---

## 11. Open questions

| # | Question | Answer |
|---|---|---|
| 1 | Are the research page's static mockups enough to sign off the grid's look, or does a clickable prototype come first (D08P's section 10.1)? Recommended: the mockups. | **The mockups are enough** (the user, 2026-11-20). |
| 2 | Approve the new words W71, W72, W73, W74, W75, W76, W77, W78, W79 and W80 (section 1.7)? | **Approved as proposed** (the user, 2026-11-20). |
| 3 | Should Price History also say how many sessions are acknowledged ("1 session acknowledged unavailable"), now that the count line counts Missing only? Recommended: no; the cells show it and the line stays about what is still owed. | Open. |

Proposals that stand unless the user objects: no Trade P&L row in the Review's grid; the "Review Date" and "Previous" tags; a mixed column shows the other Instruments' Marks; Save Marks also in the status header; Discard empties every draft on the page; no legend.

---

## 12. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`.

| Scenario | Deliverable | Tasks | Integration / browser | Critic | Command or procedure | Expected | Status |
|---|---|---|---|---|---|---|---|
| AC-MARK-004 (cumulative: an earlier session with no Mark is an empty cell or an acknowledged one; nothing carried; earlier sessions do not block the Review) | D9R2 | T9R2.6, T9R2.9, T9R2.11 | I9R2.1; B9R2.2 | C9R2.1 | `npx playwright test e2e/d9r2/grid.spec.ts` | Gaps show as gaps; the Review Date alone blocks | planned |
| AC-REV-002 (cumulative: a shared Mark resolves once for every Trade holding it, typed in any of them) | D9R2 | T9R2.7, T9R2.13 | I9R2.1; B9R2.3 | C9R2.2 | `npx playwright test e2e/d9r2/drafts.spec.ts` | One draft per key, shown in every Trade; one save | planned |
| AC-RESP-001 (cumulative: one Save Marks across Trades and sessions returns the refreshed Review, rendered without a readback) | D9R2 | T9R2.13 | I9R2.2; B9R2.3 | C9R2.1 | `npm run test:integration -- d9r2/save-many` | One commit; every saved key in the response | planned |
| AC-REV-005, ADR 0011 (cumulative: a stale binding on any key saves nothing) | D9R2 | T9R2.12, T9R2.13 | I9R2.2, I9R2.3; B9R2.4 | C9R2.3 | `npm run test:integration -- d9r2/correct-earlier` | Conflict; no write; entered values kept | planned |
| AC-MARK-003 (cumulative: an acknowledgment is never shown as a price or a gap in Price History and the Journal) | D9R2 | T9R2.2, T9R2.3 | B9R2.1 | C9R2.6 | `npx playwright test e2e/d9r2/history.spec.ts` | "Acknowledged Unavailable"; counts of Missing only | planned |
| AC-REV-006 (cumulative: completion from the Review Date's keys only) | D9R2 | T9R2.12 | B9R2.4 | C9R2.3 | `npx playwright test e2e/d9r2/editor.spec.ts` | Complete With Unavailable Marks after an acknowledgment; earlier sessions change nothing | planned |
| AC-JOUR-001 (cumulative: drafts are view state only) | D9R2 | T9R2.7, T9R2.13 | B9R2.3 | C9R2.5 | `npx playwright test e2e/d9r2/drafts.spec.ts` | A reload stores nothing; leaving asks first | planned |
| AC-UI-001, AC-UI-002 (cumulative: the grid turns live; keyboard, names and axe in every cell state) | D9R2 | T9R2.9, T9R2.14 | B9R2.5 | C9R2.4 | `npx playwright test e2e/d9r2/responsive-a11y.spec.ts` | Drafts and the chosen cell survive the turn; axe clean | planned |
| AC-PERF-001 (cumulative: the Review open's reads counted) | D9R2 | T9R2.6 | I9R2.4 | — | `npm run test:integration -- d9r2/query-count` | No store request added; the benchmark re-measures after the gate | planned |

---

## 13. Evidence recording

Under `evidence/D09R2/` (`tdd.sh` maps T9R2 there; `full-suite.sh` maps it to `e2e/d9r2`):
- `tdd-log.md` (with the single-case note `tdd.sh` requires) and `tdd-log/<task>.md`;
- `structural.md` (T9R2.5's strict expectations given the new field, T9R2.8's before-and-after titles and screenshots, T9R2.10's helper-only diffs, the retired-case pairing table, the ocr tables, the suite runs, the critic-cost table), `provenance.md`;
- `critic-<n>.md`, `suite-runs/`, `ocr/`;
- `DECISIONS-PENDING.md`, `new-words.md`, `words-changed.md` (P137), `tech-debt.md`.

---

## 14. Progress

Status, not plan: editing this section is not a plan revision (decision 100, amended by decision 111). The main session alone edits it. The rows are in run order.

| Task | Level | Status | Commits |
|---|---|---|---|
| T9R2.1 | Light | Not started | |
| T9R2.2 | Standard | Not started | |
| T9R2.3 | Standard | Not started | |
| T9R2.4 | Light | Not started | |
| T9R2.5 | Full | Not started | |
| T9R2.6 | Full | Not started | |
| T9R2.7 | Full | Not started | |
| T9R2.8 | Standard | Not started | |
| T9R2.9 | Standard | Not started | |
| T9R2.10 | Light | Not started | |
| T9R2.11 | Standard | Not started | |
| T9R2.12 | Standard | Not started | |
| T9R2.13 | Standard | Not started | |
| T9R2.14 | Standard | Not started | |
| T9R2.15 | Light | Not started | |
| T9R2.16 | Light | Not started | |
| T9R2.17 | — | Not started | |

---

## Appendix: lookup commands and output

Run on `5bce5a85` from the worktree root.

**Texts: Earlier sessions without Marks**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "Earlier sessions without Marks" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d4/gaps.spec.ts:6:const EARLIER = 'Earlier sessions without Marks — optional';
src/ui/screens/CardMarks.test.tsx:645:    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
src/ui/screens/CardMarks.test.tsx:655:    expect(within(other).queryByText('Earlier sessions without Marks — optional')).toBeNull();
src/ui/screens/ReviewView.test.tsx:324:  it('should list a card Earlier sessions without Marks as optional per Instrument from the date the Trade is relevant, newest first, 20 per page, and say they do not block the Review', async () => {
src/ui/screens/ReviewView.test.tsx:351:    expect(headings).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
src/ui/screens/ReviewView.test.tsx:352:    const group = within(marks).getByRole('group', { name: 'Earlier sessions without Marks — optional' });
```

**Texts: These sessions do not block the Review**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "These sessions do not block the Review" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d4/gaps.spec.ts:23:    await expect(earlier).toContainText('These sessions do not block the Review.');
```

**Texts: Today's Marks**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "Today's Marks" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d5r/marks.spec.ts:22:    const today = marks.getByRole('list', { name: "Today's Marks" }).getByRole('listitem').first();
src/ui/screens/ReviewView.test.tsx:298:    const rows = within(within(marks).getByRole('list', { name: "Today's Marks" })).getAllByRole('listitem');
src/ui/screens/ReviewView.test.tsx:313:    const otherRows = within(within(other).getByRole('list', { name: "Today's Marks" })).getAllByRole('listitem');
src/ui/screens/ReviewView.test.tsx:351:    expect(headings).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
src/ui/screens/CardMarks.test.tsx:635:    const today = within(panel).getByRole('list', { name: "Today's Marks" });
src/ui/screens/CardMarks.test.tsx:645:    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
```

**Texts: Save Marks (**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "Save Marks (" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d9ar/support.ts:67:  await panel.getByRole('button', { name: `Save Marks (${count})`, exact: true }).click();
e2e/d9ar/support.ts:68:  await expect(tradeCard(page, trade).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
e2e/d7/support.ts:120:// Fills one Mark price in the open card's Marks panel and presses Save Marks (D5R, A153).
e2e/d7/support.ts:129:  await expect(tradeCard(page, card).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
e2e/d4/responsive-a11y.spec.ts:272:    // Enter in the last price moves on to Save Marks (A153).
e2e/d4/support.ts:291:  await expect(tradeCard(page, card).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
e2e/d4/support.ts:297:// On cards the price is a draft in the open card's Marks panel, saved with Save Marks (D5R, A153); a previous release's
e2e/d9/support.ts:187:  await panel.getByRole('button', { name: `Save Marks (${count})`, exact: true }).click();
e2e/d9/support.ts:189:  await expect(tradeCard(page, trade).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
e2e/d5r/marks.spec.ts:52:    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (3)');
e2e/d5r/marks.spec.ts:62:    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (3)');
e2e/d5r/marks.spec.ts:68:    await expect(tradeCard(page, 'XYZ').locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)');
e2e/d5r/marks.spec.ts:118:    await expect(saveMarksOf(page, tA)).toHaveText('Save Marks (1)');
e2e/d9ar/states.spec.ts:112:    await expect(tradeCard(page, trade).locator('section[aria-label="Marks"] button', { hasText: /^Save Marks/ })).toHaveText('Save Marks (0)', READY);
src/ui/screens/ReviewCardMeter.test.tsx:161:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewView.test.tsx:318:    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewView.test.tsx:369:    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewView.test.tsx:440:    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewView.test.tsx:477:    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:187:    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
src/ui/screens/CardMarks.test.tsx:196:    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: 'Save Marks (0)' }).disabled).toBe(true);
src/ui/screens/CardMarks.test.tsx:201:describe('Save Marks (P37, A155)', () => {
src/ui/screens/CardMarks.test.tsx:213:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:260:describe('Save Marks (P37, A155) rendering', () => {
src/ui/screens/CardMarks.test.tsx:275:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:298:describe('Save Marks (P37, A155) pending', () => {
src/ui/screens/CardMarks.test.tsx:308:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:317:    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
src/ui/screens/CardMarks.test.tsx:329:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:335:    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
src/ui/screens/CardMarks.test.tsx:340:describe('Save Marks (P37, A155) refused', () => {
src/ui/screens/CardMarks.test.tsx:357:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:366:    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
src/ui/screens/CardMarks.test.tsx:370:describe('Save Marks (P37, A155) conflicted', () => {
src/ui/screens/CardMarks.test.tsx:384:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:394:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:400:describe('Save Marks (P37, A155) with the Review changed during assembly', () => {
src/ui/screens/CardMarks.test.tsx:408:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:428:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:433:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:452:    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
src/ui/screens/CardMarks.test.tsx:536:    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:560:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:567:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:574:describe('Save Marks (P37, A155) not written', () => {
src/ui/screens/CardMarks.test.tsx:582:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:590:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/CardMarks.test.tsx:596:describe('Save Marks (P37, A155) when the runtime turns read only', () => {
src/ui/screens/CardMarks.test.tsx:617:    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewCard.test.tsx:1437:    await user.click(within(card).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewCard.test.tsx:1492:    await user.click(within(card).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewCard.test.tsx:1551:    await user.click(within(card).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewCard.test.tsx:1557:    await user.click(within(card).getByRole('button', { name: 'Save Marks (1)' }));
src/ui/screens/ReviewCard.test.tsx:1783:    await user.click(within(card).getByRole('button', { name: 'Save Marks (1)' }));
src/coordinators/daily-review/meter.test.ts:68:describe('save: the meter reading after Save Marks (A260)', () => {
```

**Texts: Paging hold: "to change pages"**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "to change pages" e2e tests src | grep -E "e2e/|tests/|\.test\."
(no output)
```

**Texts: Hold message: "Save or discard what you entered"**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "Save or discard what you entered" e2e tests src
e2e/d4/card-helpers.spec.ts:56:    await expect(page.getByText(/^Save or discard what you entered for/)).toHaveCount(0);
e2e/d4/card-helpers.spec.ts:87:    await expect(page.getByRole('status').filter({ hasText: /^Save or discard what you entered for / })).toBeVisible();
e2e/d4/support.ts:242:    const hold = page.getByRole('status').filter({ hasText: /^Save or discard what you entered for / });
e2e/d5r/marks.spec.ts:85:    await expect(page.getByRole('status').filter({ hasText: 'Save or discard what you entered for XYZ (Long 100 shares @ $50.18) to leave it.' })).toBeVisible();
e2e/d5r/marks.spec.ts:93:    await expect(page.getByText('Save or discard what you entered for')).toHaveCount(0);
src/ui/screens/ReviewCard.test.tsx:526:    expect(screen.getByText(/Save or discard what you entered for XYZ to leave it/)).toBeTruthy();
src/ui/screens/ReviewCard.test.tsx:581:    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
src/ui/screens/ReviewCard.test.tsx:1524:    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
src/ui/screens/ReviewOwedCard.tsx:103:      {expanded && holdMessage && <p role="status">Save or discard what you entered for {trade.underlying} to leave it.</p>}
src/ui/screens/ReviewView.tsx:400:      setAfterSave(`The Action is saved. Save or discard what you entered for ${name(openId)} to go on.`);
src/ui/screens/ReviewCard.tsx:128:      {expanded && holdMessage && <p role="status">Save or discard what you entered for {tradeName(trade)} to leave it.</p>}
src/ui/screens/ReviewCards.test.tsx:569:  const MESSAGE = 'Save or discard what you entered for ABC to leave it';
src/ui/screens/ReviewCards.test.tsx:740:    expect(await screen.findByText('Save or discard what you entered for ABC to leave it.')).toBeTruthy();
src/ui/screens/ReviewCards.test.tsx:902:    expect((await screen.findByRole('status')).textContent).toContain('Save or discard what you entered for DEF');
src/ui/screens/ReviewCards.test.tsx:922:    expect((await screen.findByRole('status')).textContent).toContain('Save or discard what you entered for DEF');
src/ui/screens/ReviewCards.test.tsx:1006:    expect((await screen.findByRole('status')).textContent).toBe(`Save or discard what you entered for ${NAME_F} to leave it.`);
src/ui/screens/ReviewCards.test.tsx:1027:    expect((await screen.findByRole('status')).textContent).toBe(`The Action is saved. Save or discard what you entered for ${NAME_F} to go on.`);
src/ui/screens/CardMarks.test.tsx:625:    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
```

**Texts: After-Action message: "The Action is saved. Save or discard"**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "The Action is saved. Save or discard" e2e tests src
src/ui/screens/ReviewCards.test.tsx:1027:    expect((await screen.findByRole('status')).textContent).toBe(`The Action is saved. Save or discard what you entered for ${NAME_F} to go on.`);
src/ui/screens/ReviewView.tsx:400:      setAfterSave(`The Action is saved. Save or discard what you entered for ${name(openId)} to go on.`);
```

**Texts: also held by**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "also held by" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d5r/marks.spec.ts:24:    await expect(today).toContainText('also held by Long 50 shares @ $50.00');
src/ui/screens/CardMarks.test.tsx:630:  it('should list the card Review-date rows first, with also held by on XYZ, then its earlier sessions without Marks under the optional heading, and show T-F no Friday row', async () => {
src/ui/screens/CardMarks.test.tsx:640:    expect(within(xyz).getByText(/also held by/)).toBeTruthy();
src/ui/screens/CardMarks.test.tsx:653:    expect(within(other).getByText(/also held by/)).toBeTruthy();
```

**Texts: Price History count: "without Marks." and "Enter Marks in the Review"**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "without Marks\.|Enter Marks in the Review" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d8p/history.spec.ts:43:      await expect(page.locator('#drawer-panel-price-history .price-history-gaps')).toContainText('1 session without Marks.');
e2e/d8p/history.spec.ts:49:      const link = detail.root(page).getByRole('link', { name: 'Enter Marks in the Review' });
src/ui/cockpit/drawers/price-history.props.test.tsx:73:  it('should open the Review from Enter Marks in the Review', () => {
src/ui/cockpit/drawers/price-history.props.test.tsx:81:    const link = screen.getByRole('link', { name: 'Enter Marks in the Review' });
src/ui/cockpit/drawers/price-history.props.test.tsx:141:    expect(container.textContent).toContain('2 sessions without Marks.');
src/ui/cockpit/drawers/price-history.props.test.tsx:142:    fireEvent.click(within(container).getByRole('link', { name: 'Enter Marks in the Review' }));
src/ui/cockpit/drawers/price-history.props.test.tsx:158:    expect(within(container).queryByRole('link', { name: 'Enter Marks in the Review', hidden: true })).toBeNull();
src/ui/cockpit/drawers/price-history.props.test.tsx:165:    expect(render(<PriceHistoryTable {...priceHistoryProps(gappy, () => undefined, ZONE)} />).container.textContent).toContain('1 session without Marks.');
```

**Texts: Price History gap: "No Mark"**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "No Mark'" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d8p/history.spec.ts:22:    await test.step('Price History (W9, P99): newest on the left, Tuesday "—" with the accessible name No Mark', async () => {
e2e/d8p/history.spec.ts:40:      await expect(table.getByRole('img', { name: 'No Mark' })).toHaveCount(3);
e2e/d8p/history.spec.ts:41:      for (const row of await table.locator('tbody tr').all()) await expect(row.locator('td').nth(2).getByRole('img', { name: 'No Mark' })).toBeVisible();
e2e/d9/support.ts:228:export const noMarkDash = (cell: Locator): Locator => cell.getByRole('img', { name: 'No Mark' });
e2e/d9ar/chart.spec.ts:28:  'No Mark': 'rect.no-mark',
e2e/d9ar/chart.spec.ts:49:    for (const absent of ['Realized', 'Execution', 'Past the Stop', 'Past the Target', 'No Mark', 'Stop breached', 'Target reached']) expect(listed, `Mon 11-02 has no ${absent}`).not.toContain(absent);
e2e/d9ar/chart.spec.ts:111:    await expect(pnlChart(scope).locator('text.no-mark-label')).toHaveText('No Mark');
e2e/d9ar/chart.spec.ts:130:      expect(await key(scope), `the key on ${await sliderValue(scope).textContent()}`).toContain('No Mark');
e2e/d9ar/readout.spec.ts:203:    await expect(readout.locator('[data-row="Trade P&L"]').getByRole('img', { name: 'No Mark' })).toHaveText('—');
e2e/d9/gaps.spec.ts:40:    await expect(readoutValue(scope, 'Trade P&L').getByRole('img', { name: 'No Mark' })).toHaveText('—');
src/ui/cockpit/replay/session-cards.test.tsx:27:    for (const label of ['Call Mark', 'Trade P&L']) expect(within(rowOf(gap, label)).getByRole('img', { name: 'No Mark', hidden: true }).textContent).toBe('—');
src/ui/cockpit/replay/session-cards.test.tsx:29:    expect(within(rowOf(gap, 'At Stop')).getAllByRole('img', { name: 'No Mark', hidden: true })).toHaveLength(2);
src/ui/cockpit/replay/readout.props.test.ts:68:    expect(rowsOfGroup(gap, 0, 'Marks')).toEqual({ 'BREN Mark': '$100.20', 'Call Mark': 'No Mark' });
src/ui/cockpit/replay/readout.props.test.ts:69:    expect(rowsOfGroup(gap, 0, 'How it is going')).toEqual({ 'Trade P&L': 'No Mark' });
src/ui/cockpit/replay/readout.props.test.ts:88:    expect(gridRow(bounded, 'At Stop')).toMatchObject({ fromHere: { text: 'No Mark' } });
src/ui/cockpit/replay/readout.props.test.ts:310:    const noMark = { kind: 'Unavailable', text: 'No Mark' };
src/ui/cockpit/replay/readout.props.test.ts:321:    expect(pnl.value).toEqual({ kind: 'Unavailable', text: 'No Mark' });
src/ui/cockpit/replay/readout.props.test.ts:329:    expect(pnl.value).not.toEqual({ kind: 'Unavailable', text: 'No Mark' });
src/ui/cockpit/replay/readout.props.test.ts:338:    expect(pnl.value).toEqual({ kind: 'Unavailable', text: 'No Mark' });
src/ui/cockpit/replay/readout.test.tsx:152:    const none = { kind: 'Unavailable', text: 'No Mark' } as const;
src/ui/cockpit/replay/readout.test.tsx:160:    expect(within(stop as HTMLElement).getAllByRole('img', { name: 'No Mark' }).map(text)).toEqual(['—', '—']);
src/ui/cockpit/replay/readout.test.tsx:162:    expect(within(readout.querySelector('[data-row="Call Mark"]') as HTMLElement).getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
src/ui/cockpit/replay/readout.test.tsx:163:    expect(text(readout)).not.toContain('No Mark');
src/ui/cockpit/replay/corridor.test.tsx:1114:    const { container } = render(<CorridorPlot {...props({ sessions: [bren(0, { keyEntries: [{ kind: 'NoMark', label: 'No Mark' }] })], sliderIndex: 0 })} />);
src/ui/cockpit/replay/corridor.test.tsx:1375:    expect([...pnl(container).querySelectorAll('text.no-mark-label')].map((t) => t.textContent)).toEqual(['No Mark']);
src/ui/cockpit/drawers/price-history.props.test.tsx:137:    const gaps = within(table).getAllByRole('img', { name: 'No Mark' });
src/ui/cockpit/drawers/price-history.props.test.tsx:161:    expect(within(container).queryAllByRole('img', { name: 'No Mark', hidden: true })).toHaveLength(0);
src/ui/cockpit/drawers/price-history.props.test.tsx:205:      expect(within(xyz as HTMLElement).getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
src/ui/cockpit/journal-cards.props.test.tsx:138:    expect(within(final).queryByRole('img', { name: 'No Mark', hidden: true })).toBeNull();
src/ui/cockpit/journal-cards.props.test.tsx:277:    expect(within(card).getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
src/ui/cockpit/replay/price-strip.test.tsx:80:    expect([...strip(container).querySelectorAll('text.no-mark-label')].map((t) => t.textContent)).toEqual(['No Mark']);
src/ui/cockpit/replay/replay.props.test.ts:157:    const noMark = { kind: 'Unavailable', text: 'No Mark' };
src/ui/cockpit/replay/replay.props.test.ts:169:      ['Thu Nov 12', 'BREN Mark: $100.20', 'Call Mark: No Mark', 'Trade P&L: No Mark'],
src/ui/cockpit/replay/replay.props.test.ts:180:    expect(rowsOfGroup(props, 0, 'At stake from here, whole Position')).toEqual({ 'Reward to risk': 'No Mark' });
src/ui/cockpit/replay/replay.props.test.ts:183:    const noMark = { kind: 'Unavailable', text: 'No Mark' };
src/ui/cockpit/replay/cards.props.test.ts:36:    expect(figureParts('No Mark')).toEqual([{ text: 'No Mark' }]);
src/ui/cockpit/replay/plot.props.test.ts:54:    expect(labels(noResult)).toContain('No Mark');
src/ui/cockpit/replay/plot.props.test.ts:55:    expect(labels(withMarks(session({ date: '2026-11-16', pnl: 10 }), [markOf(BREN_STOCK, '100.20')]))).not.toContain('No Mark');
```

**Texts: Needed only while settlement**

```
$ grep -rnF --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "Needed only while settlement" e2e tests src | grep -E "e2e/|tests/|\.test\."
src/ui/screens/ReviewOptionMarks.test.tsx:116:  it('should accept 0 for a contract with its explanatory note, and show Needed only while settlement is due on a task needed only by Settlement Due Trades', async () => {
src/ui/screens/ReviewOptionMarks.test.tsx:138:    expect(within(contract).getByText('Needed only while settlement is due')).toBeTruthy();
src/ui/screens/ReviewOptionMarks.test.tsx:139:    expect(within(markRegion(card, 'MNO')).getByText('Needed only while settlement is due')).toBeTruthy();
src/ui/screens/ReviewOptionMarks.test.tsx:140:    expect(within(markRegion(card, 'XYZ')).queryByText('Needed only while settlement is due')).toBeNull();
```

**Texts: Dated "<date> close" heading**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "(Mon|Tue|Wed|Thu|Fri) [A-Z][a-z]{2} [0-9]+ close" e2e tests src | grep -E "e2e/|tests/|\.test\."
e2e/d7p/layout.spec.ts:20:const AWAITING_TUESDAY = 'Awaiting the Tue Oct 13 close';
e2e/d8r/states.spec.ts:91:    // Sold before the Fri Nov 13 close, so no Mark was held for the Underlying at that session: a dash, never another session's price.
e2e/d7sp/review-dated-line.spec.ts:11:  test('should show O-C bought Monday, in the Tuesday 17:00 Review with the calls Monday Mark only, a Mon Oct 12 close group with its figures at 320 and 1280 px and no sideways scroll', async ({ profile }) => {
e2e/d7sp/review-dated-line.spec.ts:31:      const group = tradeCard(page, oc).getByRole('group', { name: 'Mon Oct 12 close' });
e2e/d4/breach-overrun.spec.ts:11:  test('should show Stop Breached with Risk to stop $0.00 and Stop Overrun $50.00 and no Deviation, then Awaiting the Tue Oct 13 close with no dated or At entry card on Today for the 40 shares', async ({ profile }) => {
e2e/d4/breach-overrun.spec.ts:41:    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Awaiting the Tue Oct 13 close');
e2e/d4/breach-overrun.spec.ts:42:    await expect(detail.currentMarkedPnl(page)).toHaveText('Awaiting the Tue Oct 13 close');
e2e/d4/expected-mark.spec.ts:25:    await expect(detail.marksNotes(page)).toContainText('Stale context: $51.20 from Fri Oct 9 close (stale, not used in any current figure)');
e2e/d4/responsive-a11y.spec.ts:181:    await expect(detail.marksNotes(page)).toContainText('Stale context: $20.80 from Fri Oct 9 close (stale, not used in any current figure)');
e2e/d4/responsive-a11y.spec.ts:222:    await expect(detail.positionOpenPnlFigure(page)).toHaveText('Awaiting the Tue Oct 13 close');
e2e/d4/responsive-a11y.spec.ts:231:    await expect(openList(page).getByRole('row', { name: /XYZ/ })).toContainText('Awaiting the Tue Oct 13 close');
tests/integration/d7/missing-mark.test.ts:71:  // The plan expects a dated "At Mon Oct 12 close" line valuing the Position held then with Monday's two Marks (decision 26,
tests/integration/d7/missing-mark.test.ts:81:    // "At Mon Oct 12 close"; the dated line's Mark is the call's Monday Mark.
tests/integration/d7/missing-mark.test.ts:82:    expect(`At ${shortDate(view.datedLine!.tradingDate)} close`).toBe('At Mon Oct 12 close');
src/ui/calculation-words.test.ts:243:  it('should word a figure and a sentence "Awaiting the Mon Oct 12 close"', () => {
src/ui/calculation-words.test.ts:246:    expect(words(awaiting, 'figure')).toBe('Awaiting the Mon Oct 12 close');
src/ui/calculation-words.test.ts:247:    expect(words(awaiting, 'sentence')).toBe('Awaiting the Mon Oct 12 close');
src/ui/cockpit/drawers/today.test.tsx:22:        notes={{ stale: 'Stale context: $51.80 from Tue Oct 13 close (stale, not used in any current figure)' }}
src/ui/cockpit/drawers/today.test.tsx:30:    expect(screen.getByText('Stale context: $51.80 from Tue Oct 13 close (stale, not used in any current figure)')).toBeTruthy();
src/ui/screens/CardFigures.test.tsx:74:    const group = within(root).getByRole('group', { name: 'Fri Oct 9 close' });
src/ui/screens/CardFigures.test.tsx:115:    for (const scope of [root, within(root).getByRole('group', { name: 'Fri Oct 9 close' })]) {
src/ui/screens/CardFigures.test.tsx:150:    expect(figure(within(root).getByRole('group', { name: 'Fri Oct 9 close' }), 'Trade P&L')).toBe('−$50.00 · −0.20R');
src/ui/screens/trade-detail/Placed.test.tsx:28:    expect(within(missing).getByText('Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)')).toBeTruthy();
src/ui/cockpit/drawers/today.props.test.ts:278:    underTable('Stale context: $51.80 from Wed Oct 14 close (stale, not used in any current figure)');
src/ui/screens/ReviewCard.test.tsx:205:    const dated = within(second).getByRole('group', { name: 'Fri Oct 9 close' });
src/ui/screens/TradeList.test.tsx:687:    expect(cell(withDated!).textContent).toBe('Mark missing: ABC, Tue Oct 13 Mon Oct 12 close +$120.00 · +0.48R');
src/ui/screens/TradeList.test.tsx:711:    expect(cells[3]!.textContent).toBe('Awaiting the close after Tue Oct 13 Mon Oct 12 close +$120.00 · +0.48R');
```

**Texts: Journal cards: gap cell**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "withoutMarks|gap: true" src/ui/cockpit/drawers
src/ui/cockpit/drawers/journal.props.ts:70:const withoutMarks = (session: JournalReplaySession): boolean => !heldNothing(session) && session.marks.every((mark) => mark.resolution.kind !== 'Available');
src/ui/cockpit/drawers/journal.props.ts:156:    if (previous && withoutMarks(previous) && withoutMarks(session)) runs[runs.length - 1]!.push(session);
src/ui/cockpit/drawers/journal.props.ts:161:    if (withoutMarks(first)) {
src/ui/cockpit/drawers/journal.props.ts:180:        ...(resolution.kind !== 'Available' && !heldNothing(session) && { gap: true as const }),
```

**Texts: Specs that read the old row's Price or Can't-get-a-price directly**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "markRow\(.*\)\)\.getBy(Label\(.Price.\)|Role\(.button., \{ name: .Can)" e2e
e2e/d4/no-save.spec.ts:51:    await (await markRow(page, 'XYZ', DATE)).getByLabel('Price').fill(TYPED.correctedPrice);
e2e/d4/no-save.spec.ts:62:    await expect((await markRow(page, 'XYZ', DATE)).getByLabel('Price')).toHaveValue(TYPED.correctedPrice);
e2e/d4/responsive-a11y.spec.ts:133:    await (await markRow(page, 'XYZ', DATE)).getByLabel('Price').fill('1');
e2e/d4/responsive-a11y.spec.ts:144:    await (await markRow(page, 'ABC', DATE)).getByRole('button', { name: 'Cancel' }).click();
e2e/d5r/marks.spec.ts:82:    await (await markRow(page, tA, MONDAY)).getByLabel('Price').fill('52.00');
e2e/d5r/responsive-a11y.spec.ts:68:    await expect((await markRow(page, tA, MONDAY)).getByLabel('Price')).toHaveValue('52.00');
```

**Shapes: SeriesPoint and new open fields in fixtures and verify tools**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "resolutionRevision|SeriesPoint|earlierMarks|previousSession" tests/fixtures tools/verify-fixtures.ts tools/fixture-views.ts
tests/fixtures/workspace-v3/dump.json:1458:              "resolutionRevision": 1,
tests/fixtures/workspace-v3/dump.json:1478:              "resolutionRevision": 1,
tests/fixtures/workspace-v3/dump.json:1495:              "resolutionRevision": 1,
tests/fixtures/workspace-v3/dump.json:1515:              "resolutionRevision": 2,
tests/fixtures/workspace-v3/dump.json:1563:              "resolutionRevision": 1,
tests/fixtures/workspace-v5/dump.json:2523:              "resolutionRevision": 1,
tests/fixtures/workspace-v5/dump.json:2543:              "resolutionRevision": 1,
tests/fixtures/workspace-v5/dump.json:2560:              "resolutionRevision": 1,
tests/fixtures/workspace-v5/dump.json:2580:              "resolutionRevision": 2,
tests/fixtures/workspace-v5/dump.json:2628:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3341:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3361:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3378:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3398:              "resolutionRevision": 2,
tests/fixtures/workspace-v7/dump.json:3446:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3466:              "resolutionRevision": 1,
tests/fixtures/workspace-v7/dump.json:3486:              "resolutionRevision": 1,
tests/fixtures/workspace-v3/expected-views.json:2961:            "resolutionRevision": 1,
tests/fixtures/workspace-v3/expected-views.json:2981:            "resolutionRevision": 2,
tests/fixtures/workspace-v3/expected-views.json:3000:            "resolutionRevision": 1,
tests/fixtures/workspace-v6/expected-views.json:10708:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/expected-views.json:10731:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/expected-views.json:10754:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/expected-views.json:10770:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/expected-views.json:10787:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/expected-views.json:10808:            "resolutionRevision": "None",
tests/fixtures/workspace-v5/expected-views.json:7708:            "resolutionRevision": "None",
tests/fixtures/workspace-v5/expected-views.json:7727:            "resolutionRevision": "None",
tests/fixtures/workspace-v5/expected-views.json:7746:            "resolutionRevision": "None",
tests/fixtures/workspace-v5/expected-views.json:7758:            "resolutionRevision": "None",
tests/fixtures/workspace-v5/expected-views.json:7770:            "resolutionRevision": "None",
tests/fixtures/workspace-v4/dump.json:1722:              "resolutionRevision": 1,
tests/fixtures/workspace-v4/dump.json:1742:              "resolutionRevision": 1,
tests/fixtures/workspace-v4/dump.json:1759:              "resolutionRevision": 1,
tests/fixtures/workspace-v4/dump.json:1779:              "resolutionRevision": 2,
tests/fixtures/workspace-v4/dump.json:1827:              "resolutionRevision": 1,
tests/fixtures/backup-v4-blocked/expected-views.json:3957:            "resolutionRevision": 1,
tests/fixtures/backup-v4-blocked/expected-views.json:3981:            "resolutionRevision": 2,
tests/fixtures/backup-v4-blocked/expected-views.json:4004:            "resolutionRevision": 1,
tests/fixtures/backup-v6-blocked/expected-views.json:10819:            "resolutionRevision": "None",
tests/fixtures/backup-v6-blocked/expected-views.json:10842:            "resolutionRevision": "None",
tests/fixtures/backup-v6-blocked/expected-views.json:10865:            "resolutionRevision": "None",
tests/fixtures/backup-v6-blocked/expected-views.json:10881:            "resolutionRevision": "None",
tests/fixtures/backup-v6-blocked/expected-views.json:10898:            "resolutionRevision": "None",
tests/fixtures/backup-v6-blocked/expected-views.json:10919:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11832:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11855:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11878:            "resolutionRevision": 1,
tests/fixtures/workspace-v7/expected-views.json:11906:            "resolutionRevision": 1,
tests/fixtures/workspace-v7/expected-views.json:11929:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11945:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11962:            "resolutionRevision": "None",
tests/fixtures/workspace-v7/expected-views.json:11983:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:11914:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:11937:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:11960:            "resolutionRevision": 1,
tests/fixtures/backup-v7/expected-views.json:11988:            "resolutionRevision": 1,
tests/fixtures/backup-v7/expected-views.json:12011:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:12027:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:12044:            "resolutionRevision": "None",
tests/fixtures/backup-v7/expected-views.json:12065:            "resolutionRevision": "None",
tests/fixtures/backup-v3-blocked/expected-views.json:3145:            "resolutionRevision": 1,
tests/fixtures/backup-v3-blocked/expected-views.json:3169:            "resolutionRevision": 2,
tests/fixtures/backup-v3-blocked/expected-views.json:3192:            "resolutionRevision": 1,
tests/fixtures/backup-v5-blocked/expected-views.json:7991:            "resolutionRevision": "None",
tests/fixtures/backup-v5-blocked/expected-views.json:8014:            "resolutionRevision": "None",
tests/fixtures/backup-v5-blocked/expected-views.json:8037:            "resolutionRevision": "None",
tests/fixtures/backup-v5-blocked/expected-views.json:8053:            "resolutionRevision": "None",
tests/fixtures/backup-v5-blocked/expected-views.json:8069:            "resolutionRevision": "None",
tests/fixtures/workspace-v6/dump.json:3218:              "resolutionRevision": 1,
tests/fixtures/workspace-v6/dump.json:3238:              "resolutionRevision": 1,
tests/fixtures/workspace-v6/dump.json:3255:              "resolutionRevision": 1,
tests/fixtures/workspace-v6/dump.json:3275:              "resolutionRevision": 2,
tests/fixtures/workspace-v6/dump.json:3323:              "resolutionRevision": 1,
tests/fixtures/workspace-v4/expected-views.json:3736:            "resolutionRevision": 1,
tests/fixtures/workspace-v4/expected-views.json:3756:            "resolutionRevision": 2,
tests/fixtures/workspace-v4/expected-views.json:3775:            "resolutionRevision": 1,
```

**Shapes: Marks family fields in fixtures and verify tools**

```
$ grep -rnlE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "\"earlier\"|\"today\"" tests/fixtures tools/verify-fixtures.ts tools/fixture-views.ts
tests/fixtures/workspace-v4/expected-views.json
tests/fixtures/backup-v5-blocked/expected-views.json
tests/fixtures/backup-v4-blocked/expected-views.json
tests/fixtures/workspace-v6/expected-views.json
tests/fixtures/workspace-v3/expected-views.json
tests/fixtures/backup-v7/expected-views.json
tests/fixtures/workspace-v5/expected-views.json
tests/fixtures/backup-v6-blocked/expected-views.json
tests/fixtures/workspace-v7/expected-views.json
tests/fixtures/backup-v3-blocked/expected-views.json
```

**Shapes: SeriesPoint consumers**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "SeriesPoint|\.series\(" src tests tools | grep -v "^src/modules/market-data/market-data.ts"
src/coordinators/trade-views/replay-trade.test.ts:480:        return { ...session, series: (key: string, from: string, to: string) => (read.push(key), session.series(key, from, to)) };
src/coordinators/daily-review/daily-review.test.ts:1316:        return { ...session, series: (key: string, from: string, to: string) => (read.push(key), session.series(key, from, to)) };
src/coordinators/trade-views/trade-views.ts:31:import type { MarkFrame, MarketData, MarketDataReadSession, MarkResolution, SeriesPoint } from '../../modules/market-data/index.ts';
src/coordinators/trade-views/trade-views.ts:336:  readonly settlementUnderlying?: { readonly today?: SeriesPoint; readonly yesterday?: SeriesPoint; readonly change?: ReplayChange };
src/coordinators/trade-views/trade-views.ts:506:  const points = await session.series(instrumentKey({ kind: 'Stock', symbol }), columns.yesterday, columns.today.date);
src/coordinators/replay/assemble-replay.ts:6:import type { MarketDataReadSession, SeriesPoint } from '../../modules/market-data/index.ts';
src/coordinators/replay/assemble-replay.ts:25:function frameOf(instrument: Instrument, point: SeriesPoint): ObservationFrame {
src/coordinators/replay/assemble-replay.ts:34:function resolutionOf(point: SeriesPoint | undefined): ReplayMarkResolution {
src/coordinators/replay/assemble-replay.ts:56:  readonly points: readonly (readonly (SeriesPoint | undefined)[])[];
src/coordinators/replay/assemble-replay.ts:62:export function replaySessions(instruments: readonly Instrument[], series: readonly (readonly SeriesPoint[])[], firstExposure: Instant, terminalTime: Instant | null, expiration: string | null = null): ReplaySessions {
src/coordinators/replay/assemble-replay.ts:154:  const series = await Promise.all(instruments.map((instrument) => session.series(instrumentKey(instrument), firstExposure.slice(0, 10), session.tradingDate)));
src/modules/market-data/index.ts:31:  type SeriesPoint,
src/modules/market-data/market-data.test.ts:651:    expect(await session.series('MNO', '2026-10-07', '2026-10-12')).toEqual(points);
src/modules/market-data/market-data.test.ts:700:    expect(await session.series('MNO', '2024-01-02', '2024-01-05')).toEqual([{ kind: 'Available', tradingDate: '2024-01-02', closeInstant: '2024-01-02T21:00:00Z', price: '9', revisionNumber: 1, source: 'Manual', savedAt: TUESDAY_NOON }]);
src/modules/market-data/market-data.test.ts:702:    expect(await missing.series('NONE', '2024-01-02', '2024-01-02')).toEqual([{ kind: 'Missing', tradingDate: '2024-01-02', closeInstant: '2024-01-02T21:00:00Z' }]);
src/modules/market-data/market-data.test.ts:710:    const { result, requests } = await countRequests(() => session.series('MNO', '2026-10-07', '2026-10-12'), { transactions: true });
src/modules/market-data/market-data.test.ts:726:      await expect(session.series('MNO', '2026-10-07', '2026-10-12')).rejects.toBe(failure);
src/modules/market-data/market-data.test.ts:753:      await session.series('MNO', '2026-10-07', '2026-10-12'),
src/modules/market-data/market-data.test.ts:754:      await session.series('MNO', '2026-10-08', '2026-10-12'),
src/modules/market-data/market-data.test.ts:762:    const reversed = await countRequests(async () => [await first.series('MNO', '2026-10-07', '2026-10-12'), await first.gaps([opened])]);
```

**Names: PriceHistoryTable**

```
$ grep -rn --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "PriceHistoryTable" tools src e2e tests .claude
src/ui/cockpit/drawers/price-history.props.test.tsx:9:import { PriceHistory, PriceHistoryTable } from './price-history.tsx';
src/ui/cockpit/drawers/price-history.props.test.tsx:42:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:62:    const stockTable = render(<PriceHistoryTable {...priceHistoryProps(stockTrade, () => undefined, ZONE)} />).container.querySelector('table') as HTMLElement;
src/ui/cockpit/drawers/price-history.props.test.tsx:66:    const optionTable = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED]), () => undefined, ZONE)} />).container.querySelector('table') as HTMLElement;
src/ui/cockpit/drawers/price-history.props.test.tsx:89:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:116:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay(sessions), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:126:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:135:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(gappy, () => (opened += 1), ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:144:    const whole = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:154:    const { container } = render(<PriceHistoryTable {...priceHistoryProps(closed, () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:165:    expect(render(<PriceHistoryTable {...priceHistoryProps(gappy, () => undefined, ZONE)} />).container.textContent).toContain('1 session without Marks.');
src/ui/cockpit/drawers/price-history.props.test.tsx:172:      const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([WED]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:182:      const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([corrected]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:191:      const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([corrected]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.props.test.tsx:201:      const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([TUE]), () => undefined, ZONE)} />);
src/ui/cockpit/drawers/price-history.tsx:13:export function PriceHistoryTable({ rowLabels, columns, missingCount, onOpenReview }: PriceHistoryProps) {
src/ui/cockpit/drawers/price-history.tsx:74:  return replay && timeZone ? <PriceHistoryTable {...priceHistoryProps(replay, () => void navigate(REVIEW_PATH), timeZone)} /> : null;
```

**Names: markRow (browser helper, repurposed): files**

```
$ grep -rln --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "markRow" tools e2e tests .claude
e2e/d8p/support.ts
e2e/d7/marks-zero.spec.ts
e2e/d4/update.spec.ts
e2e/d4/review.spec.ts
e2e/d4/gaps.spec.ts
e2e/d4/card-helpers.spec.ts
e2e/d4/correct-mark.spec.ts
e2e/d4/support.ts
e2e/d4/offline.spec.ts
e2e/d5r/durability.spec.ts
e2e/d4/acknowledge.spec.ts
e2e/d4/no-save.spec.ts
e2e/d4/runtime-failure.spec.ts
e2e/d4/responsive-a11y.spec.ts
e2e/d5/detail-debt.spec.ts
e2e/d5r/marks.spec.ts
e2e/d5r/responsive-a11y.spec.ts
```

**Names: markCell (new browser helper; today a Price History function)**

```
$ grep -rn --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "markCell" tools src e2e tests .claude
src/ui/cockpit/drawers/price-history.props.ts:29:function markCell(session: Session, instrument: Instrument, optionTrade: boolean, timeZone: string): Cell {
src/ui/cockpit/drawers/price-history.props.ts:66:      return { session: session.date, weekday, date: date.join(' '), cells: [...replay.instruments.map((i) => markCell(session, i, optionTrade, timeZone)), pnlCell(session)] };
src/ui/cockpit/drawers/today.props.ts:71:  const cell = markCellOf(optionTrade);
src/ui/cockpit/drawers/today.props.ts:87:const markCellOf = (optionTrade: boolean) => (instrument: Instrument, session: Session | undefined): string => {
src/ui/cockpit/drawers/today.props.ts:131:  const cell = markCellOf(optionTrade);
```

**Names: GapList, GAPS_PER_PAGE, withNewest (CardMarks internals that go)**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "GapList|GAPS_PER_PAGE|withNewest" tools src e2e tests .claude
src/ui/screens/CardMarks.tsx:174:const GAPS_PER_PAGE = 20;
src/ui/screens/CardMarks.tsx:187:function GapList({ panel: shared, group }: { readonly panel: Panel; readonly group: GapGroup }) {
src/ui/screens/CardMarks.tsx:211:  const first = page * GAPS_PER_PAGE;
src/ui/screens/CardMarks.tsx:212:  const shown = sessions.slice(first, first + GAPS_PER_PAGE);
src/ui/screens/CardMarks.tsx:224:      {sessions.length > GAPS_PER_PAGE && (
src/ui/screens/CardMarks.tsx:233:          {first + GAPS_PER_PAGE < sessions.length && (
src/ui/screens/CardMarks.tsx:246:function withNewest(opened: GapGroup, newest: GapGroup | undefined): GapGroup {
src/ui/screens/CardMarks.tsx:286:  const earlier = opened.map((group) => withNewest(group, marks.earlier.find((now) => now.instrumentKey === group.instrumentKey)));
src/ui/screens/CardMarks.tsx:412:            <GapList key={group.instrumentKey} panel={panel} group={group} />
```

**Names: lacksMarks, priceHistoryTabCount**

```
$ grep -rnE --exclude-dir=worktrees --exclude-dir=node_modules --exclude-dir=suite-runs "lacksMarks|priceHistoryTabCount" tools src e2e tests .claude
src/ui/cockpit/drawers/price-history.props.ts:51:const lacksMarks = (session: Session): boolean => !heldNothing(session) && session.marks.some((m) => m.resolution.kind !== 'Available');
src/ui/cockpit/drawers/price-history.props.ts:54:export function priceHistoryTabCount(replay: TradeReplayView): number {
src/ui/cockpit/drawers/price-history.props.ts:55:  return replay.sessions.filter(lacksMarks).length;
src/ui/cockpit/drawers/price-history.props.ts:68:    missingCount: priceHistoryTabCount(replay),
src/ui/cockpit/drawers/price-history.props.test.tsx:8:import { priceHistoryProps, priceHistoryTabCount, type ReplaySource } from './price-history.props.ts';
src/ui/cockpit/drawers/price-history.props.test.tsx:129:    expect(priceHistoryTabCount(replay([]))).toBe(0);
src/ui/cockpit/drawers/price-history.props.test.tsx:140:    expect(priceHistoryTabCount(gappy)).toBe(2);
src/ui/cockpit/drawers/price-history.props.test.tsx:147:    expect(priceHistoryTabCount(replay([MON, WED, THU]))).toBe(0);
src/ui/cockpit/drawers/price-history.props.test.tsx:155:    expect(priceHistoryTabCount(closed)).toBe(0);
src/ui/cockpit/drawers/price-history.props.test.tsx:164:    expect(priceHistoryTabCount(gappy)).toBe(1);
src/ui/screens/trade-detail/Cockpit.tsx:13:import { priceHistoryTabCount } from '../../cockpit/drawers/price-history.props.ts';
src/ui/screens/trade-detail/Cockpit.tsx:165:    const missing = name === 'Price History' && replay ? priceHistoryTabCount(replay) : 0;
```
