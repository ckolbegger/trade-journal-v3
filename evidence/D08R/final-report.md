# D08R final report: Trade Detail refactor

**Result: the gate passed on 2026-11-17.**
- Branch `claude-opus-5.5`. The plan was frozen at `claude-opus-5.5-plan-r105`. The tag is `claude-opus-5.5-d8r`.
- **Gate (T8R.28):**
  - full-tier run `gate-full1` on `077043af`: unit 2111, integration 269, 14 of 14 checks, browser 126 + 136, no flakes;
  - `acceptance-commands.sh` exited 0;
  - critic-4 passed all six flows, C8R.1, C8R.2, C8R.3, C8R.4, C8R.5 and C8R.6, with no defects.
- Section 13's five acceptance rows are marked covered.
- Nothing was pushed.

Details of every merge, review and run are in `structural.md`. The critic reports are `critic-1.md`, `critic-2.md`, `critic-3.md` and `critic-4.md`.

## 1. Tasks and commits

Hashes are the merged (rebased) commits on `claude-opus-5.5`.
- **"B" tasks** are bug tasks: fixes for an ocr finding or a critic defect.
- **"F" tasks** are follow-ups: fixes for a merge-run failure or a structural gap found after merging.

| Task | Wave | Lane | Commits | Fix rounds |
|---|---|---|---|---|
| T8R.1 | 0 | TY | `dddd063b`; B1 `5b333e64` | 1 ocr |
| T8R.2 | 0 | SH | `29e50716`; F1 `08437851` | 1 follow-up |
| T8R.3 | 0 | CN | `556a1e2a`; B1 `0cd52adf`; B2 `87bd7743`; F1 `b7a648d4`; B1-F1 `61451412` | 2 ocr, 2 follow-ups |
| T8R.4 | 0 | PH | `c7a9a3ca`; F1 `bed2afe0` (also met B1) | 1 follow-up |
| T8R.5 | 1 | PO | `fc58e8ca`; B1 `ff8f7f72`; F1 `3e3e6862` | 1 ocr, 1 merge-run follow-up |
| T8R.6 | 1 | TD | `c4585d5e`; F1 `665baf34` (B1 needed no code) | 1 follow-up |
| T8R.7 | 1 | TD | `a28d05f9`; B1 `4cd6991a` (decision P1); B2 `e9834187` | 2 ocr |
| T8R.8 | 1 | TD | `e43b29f0`; B1 `777d6329` | 1 ocr |
| T8R.9 | 1 | TD | `8134c1af` | none |
| T8R.10 | 1 | PR | `ff4b2d79`; B1 `a80d5663`; B2 `992e5792`; F1 `e69bf95e`; F1-B1 `db0ecf20`; F2 `2d901dfe` | 3 ocr, 2 follow-ups |
| T8R.11 | 1 | PR, FX | `d8682e62`; F1 `9d873233` | 1 merge-run follow-up |
| T8R.12 | 1 | PR | `27f3a0bf`; F1 `01f728ff` | 1 follow-up |
| T8R.13 | 1 | RA | `5237ada5` | none |
| T8R.14 | 1 | RA | `9a116056`; B1 `8a44e36c`; F1 `703452dd` | 1 ocr, 1 follow-up |
| T8R.15 | 1 | JR, JF | `727fd53a`; F1 `17b8abc6`; F2 `5b653d2d` | 2 follow-ups |
| T8R.16 | 1 | JR | `9170efb5` | none |
| T8R.17 | 1 | JR | `f62cb546`; B1 `708d67ea` | 1 ocr |
| T8R.18 | 1 | BA | `69582aaa` | none |
| T8R.19 | 1 | BA | `ce6d4c88`; F1 `e1ae8adc` | 1 follow-up |
| T8R.20 | 1 | BA | `1474e144` | none |
| T8R.21 | 1 | BV | `c9155d02` | none |
| T8R.22 | 1 | BV | `a414c8c4`; F1 `ef9f6ba7` | 1 follow-up |
| T8R.23 | 1 | BV | `7d5d1543` | none |
| T8R.24 | 2 | WD | `80d37dd1` | none |
| T8R.25 | 2 | CB, C2 | critic-1 fixes: B1 `a3256de7`, B2 `aef3d956`, B3 `0adedd00`. critic-2 fixes: B4 `e0704377`, B5 `bffabe3c`, B6 `7b3990fa`, B7 `580bace8`. ocr on B5: B8 `e5624d06`. | 3 critics, 8 bug tasks |
| T8R.26 | 2 | NS | `77ee17e1` | none |
| T8R.27 | 2 | BR | `d26eef1b`; B1 `f7c2682f`; B2 `4a2b68d6` | 2 ocr (decision P2 ended the chain) |
| T8R.28 | 2 | — | evidence only | none |

### Process slips

The rule is to write each test before its code. These are the times it was broken:
- **T8R.8:** cases 2 and 3 were coded ahead of red. The reds were then obtained by disabling the ticks temporarily.
- **T8R.25-B1:** its `option-views.test.ts` case was written after the code.
- **T8R.25-B5:** "should read a crossed Underlying condition from the Underlying Mark alone" passed on its first run, and no mutation check was made.
- **T8R.25-B6:** the coordinator case was written after its one-line field. A mutation check then failed it.
- **T8R.17:** its fix moved more than the brief allowed (`DRAWERS` and the `Drawer` type).

## 2. Flaky tests

| Test | Run | What happened |
|---|---|---|
| `PositionChangeForm.test.tsx > focus after navigation > should move focus to the Record entry heading when the form finishes loading` | T8R.25-B7's lane tier | Failed 1 of 2111. Passed when its file was rerun twice (52 of 52), and passed in `wave2-full3` and `gate-full1`. This is a new suspected flake, not tech debt item 11. |
| Tech debt item 11 (`TradeList.test.tsx`, Ready state) | none | It did not fail in any run this deliverable. |

Earlier in the run, a load-related flake was noted in the merge runs; `structural.md` has the detail.

## 3. Decisions

**P1 (answered 2026-11-17, option 1).** A Closed Trade's Exit column in Today is dated by the session that holds the final exit. The Underlying cell reads "—" until that session's Marks exist. This amends A235 and became T8R.7-B1.

**P2 (answered 2026-11-17, option 1).** Lane BR merged as it stood. The two findings from ocr's third round on `e2e/d8r/names.spec.ts` are recorded as tech debt below.

No decisions are pending.

## 4. Critics

| Critic | Where | Result | Tokens | Tool calls | Duration |
|---|---|---|---|---|---|
| critic-1 | checkpoint (T8R.25), flows C8R.1 to C8R.4 | PASS, 3 moderate defects, all fixed (B1, B2, B3) | 217,339 | 94 | 14 min 17 s |
| critic-2 | checkpoint | PASS, 4 moderate defects, all fixed (B4, B5, B6, B7) | 197,247 | 71 | 12 min 27 s |
| critic-3 | checkpoint | PASS, 1 moderate and 2 low defects, moved to tech debt (decision 116 (3)) | 215,828 | 86 | 17 min 44 s |
| critic-4 | gate (T8R.28), flows C8R.1 to C8R.6 | PASS, no defects | 246,425 | 99 | 22 min 44 s |

`.claude/docs/critic-brief.md` says a third critic's moderate defect stops the run. The handoff's rule, decision 116 (3), approved by the user in advance, closes the checkpoint instead when nothing is high and no flow failed. The handoff's rule was followed.

## 5. Defects moved to tech debt

Items 25, 26 and 27 are in `plan/implementation-plan.md`. They come from critic-3:
- **Item 25 (moderate).** At 960 to 1100 px the Today table opens scrolled to its right end, so the Today heading is covered. `ScrollsToEnd` in `today.tsx` predates W29's column order.
- **Item 26 (low).** An owed reflection keeps the old Journal layout: "Position Change at 2026-10-14 11:00", then "Due" / "Due".
- **Item 27 (low).** W24's line has no final full stop: "1 active Deviation. See Plan and Risk".

Decision P2 also moved ocr's two findings on T8R.27-B2 to tech debt. They are not yet in the plan's numbered list:
- **`e2e/d8r/names.spec.ts`, content-named elements.** The check takes a button's or link's name from its raw content, not the name the browser computes. So a child's `aria-label` that overrides the content isn't caught.
- **`e2e/d8r/names.spec.ts`, other roles.** An element with another role and an explicit label keeps no text, so its name is never compared with the contract it shows.
- **Suggested fix.** Read the browser's own computed names from Chromium's accessibility tree.

## 6. New words awaiting your approval

`new-words.md` lists 21 screen texts that no approved row covers. Each uses the wording the session judged best (decision 116 (2)). Listed by task:
- **T8R.4 and T8R.4-F1 (Price History):**
  - a Mark cell's accessible name with its provenance;
  - the corrected-Mark text;
  - the "Corrected" badge.
- **T8R.6 (Today):**
  - the "Marks" heading;
  - undated "Today" and "Yesterday" headings outside the session policy's coverage.
- **T8R.7 (Today):**
  - a Closed Trade's Today heading over empty cells;
  - the "Closed" stamp as a bordered tag.
- **T8R.8:** a lot tick's name, "$3.30 · Fri Oct 16".
- **T8R.10 (Plan and Risk):**
  - "Breached · $0.50 past" and "Reached · 2.10 past" in the Distance cell;
  - the dated Conditions table;
  - an empty Value at expiration cell;
  - the reason shown in both cells;
  - the Settlement Due note under the table;
  - the "Conditions table" region name.
- **T8R.12 (Plan and Risk):**
  - the Since the last Marks wording ("1 contract", "$110.00 · 0.55R");
  - the place of the Since the last Marks group.
- **T8R.13:** the dated line's colour and its own line.
- **T8R.14 and T8R.14-B1 (rail):**
  - "Stop · Breached · $0.10 past";
  - the note before the first Marks without "and the worst case";
  - "Conditions notes" as a list name.

Choices made in the bug tasks, which reuse existing words:
- **T8R.25-B5.** On a row where only the contract's Mark is missing, the dollar cell carries its own date ("Reward to target $180.00 · 0.90R · Thu Oct 15 Marks"), and the distance beside it is undated.
- **T8R.25-B7.** The Payoff table box is named "Planned Expiration Payoff table" and "Current Expiration Payoff table".

## 7. Wall-clock time against the estimate

- **Start:** the first evidence commit, `0c6f9828`, at 00:53 EST on 2026-11-17.
- **End:** the gate at about 17:30 EST. That is about **16.6 hours**.
- **Estimate** (breakdown section 3): about 8 to 9 hours for the swarm and about 25 hours serial.

The estimate leaves out critic defects and their bug tasks, and these took most of the overrun:
- **The checkpoint needed all three critics.** It ran 8 bug tasks, each with its own ocr review, plus two full runs.
- **The names spec took three ocr rounds.**
- **Wave 1 had 10 follow-up tasks.** Two of them fixed merge-run failures.

## 8. Readings and limits for your review

- **Missing-Mark checks are read at 18:00.** I8R.1 and B8R.3's "Fri 12:00 with a missing Mark" is read at Fri 18:00.
- **K1's Underlying cell** shows "—" for a sale before the close (decision P1).
- **B8R.4** checks the groups' literal order.
- **The Review's attention sentence** drops `due` (`attention.ts`, lines 102 and 103). That branch is likely unreachable.
- **A weekend exit** is dated Monday.
- **The Position drawer** fits exactly at 1280 px.
- **"Risk from that price"** is now covered by B8R.4.
- **W24's line** has no final full stop (now item 27).
- **`noLotsAfterMarks`** has an edge case: a Settlement Due Trade with a lot bought after its last Mark.
- **`columns.test.ts`** has a redundant `toBeDefined`.
- **Orphaned code:**
  - `ConditionReading.underlying` (breakdown section 10);
  - leftover rules in `legacy-detail.css`.
- **The Underlying crossing a Stop while the contract's Mark is missing (T8R.25-B5 review note).** The rail reads "Breached · X past", but there is no Needs you alert, no Trade List badge, no attention band, and the Review card says "Mark missing". This follows A109, because an Alert needs the contract's Mark for dollars, but the screens disagree. No critic raised it.
- **On a stock Trade, the Value at expiration column** is kept, with every cell empty (T8R.25-B3).
- **The Today table between 960 and 1280 px.** This was unmeasured after B4, until critic-3 measured it (now item 25).
- **browser-2 takes 8.9 minutes**, close to its limit. The suite runner suggests a browser-3 stage. That would be a `.claude/` tooling change, which D8R does not plan.

## 9. Critics' minor observations (no defect raised)

**critic-1:** 10 observations; see `critic-1.md`.

**critic-2:**
- The audit's Plan and Risk group order differs from the build.
- "Max reward: Unbounded above" carries a session date.
- The rail's leading "·".
- The Settlement Due P&L card on a weekend differs from a weekday.
- The track's "now" dot is a session behind the table at midday.
- The track's accessible name leaves out the entry.
- The Stale context line says "close".

**critic-3:**
- Payoff's "including +$98.70 realized to date" repeats Position's figure.
- When only the XYZ Mark is missing, the Target shows "Mark missing", not a dated distance (A231).
- The Stale line doesn't name its Mark.
- Narrow headings run together at 320 px.
- A region named "Marks" sits inside another region named "Marks".
- Journal headings are h3 inside h3 cards.
- Price History shows "No Mark" for an acknowledgment.
- There is no UI path to an expired or closed Trade's Underlying Mark (revision 98).

**critic-4:**
- The date's column in a dated Conditions row moves with the case.
- An empty "Option price:" track name appears on a Trade with no option-price condition.
- The Conditions table scrolls inside its box at 320 px.
- An earlier year's "Expired Fri Dec 19" has no year.
- "Mark missing" names the call when XYZ's Mark is missing too.
- Tab after Journal paging goes to the primary navigation.

## 10. After the gate (2026-11-17)

- **New words:** the user approved all 21 rows in `new-words.md`, plus the two choices made in the bug tasks (section 6).
- **The Underlying "Breached" mismatch** (section 8): recorded as tech debt item 28 in `plan/implementation-plan.md`, at the user's direction.
