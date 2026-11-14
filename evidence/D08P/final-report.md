# D08P, The Trade Detail cockpit: final report

Completed 2026-11-14 and tagged `claude-opus-5.5-d08p`. The work runs from `claude-opus-5.5-pre-d08p` (`6dd6c859`, plan revision 84) and the handoff commit `4b90de47`. Every commit is local; none is pushed. D08P ran as a swarm (decision 111): wave 0 in the main worktree, wave 1 in lanes under `.claude/worktrees/`, and wave 2 back in the main worktree. Revisions 85 to 100 were made during the work. The next revision is r101 and the next decision is 112.

## Tasks and commits

Each task's commits, bug tasks and lane tiers are in the breakdown's Progress section (`plan/D08P-trade-detail-cockpit.md`, section 15). In short:

| Task | What | Main commits |
|---|---|---|
| T8P.1 | Swarm tooling: per-task TDD logs, the browser lock, the lane setup and the lane tier | `cac803c2`; bug tasks through B20 over five review rounds |
| T8P.2 | Trade Detail split into one file per section, with its tests and styles | `10d63285`; B1 to B4 |
| T8P.3, T8P.4 | The cockpit's frozen props, replay view types and import rule; drawer-reach helpers, with the earlier browser cases moved onto them | `bba8b2bc`; `4f40c2f3`, B1 to B6 |
| T8P.5 | Cockpit shell: the rail, the drawer tabs and each state's drawers | `f0c51e60`, `0577e92d`; B1 to B3 |
| T8P.6, T8P.7 | Trade Analysis: nearest condition; `replay` and Max reward's R | `3c234ab6`; `1a80e469`, B1 |
| T8P.8 | Market Data: `ReadSeries` | `5439bfb0`; B1 to B3 |
| T8P.9 | Expiration line days; a just-confirmed Plan's line (tech debt item 23) | `61bba50a`; B8P.3 `f4bde124` |
| T8P.10, T8P.11 | Trade Views: `replayTrade`; the facade and Installed Capability Manifest | `8f9f4419`, revision 93 `ba5b5e63`; `3c7005be` |
| T8P.12 to T8P.15 | Rail: identity, P&L, Conditions, Needs you | `3ca9819b`; `83d5c09b`; `2705ba83`; `e3aed041`, B1, B2 |
| T8P.16 to T8P.21 | Drawers: Today, Position, Plan and Risk with the footer, Payoff, Price History, Journal | `d8691e0e`; `057dc498`; `ca0191e7`; `4f5e40aa`; `8d2927cf`; `333af6d7` |
| T8P.28, T8P.29 | Trade Views: "no Marks yet" as `firstMarksDue`; the Today drawer, P&L card and Conditions card read it (revision 90) | `e163c073`; `511065e0` |
| T8P.30 | Every Trade Detail absence check proves absence (revision 90) | `97cde911` |
| T8P.31 | The legacy blocks' figures in one place (revision 96) | `b6e476ef` |
| T8P.22 | Trade Detail reads `replayTrade` | `0c78979f`; B1, B2 `8771f053` |
| T8P.27 | The old Detail sections removed (revision 85) | `f9ee10a2`, `4a610613`, `9557c405` |
| T8P.23 | Checkpoint critic | critics 1 to 3; bug tasks B1 to B14, B3-B1, B13-B1, B14-B1 (`d15649d1` to `c48ec4e3`) |
| T8P.24 | Node mock-free integration suite | `3037a7c3` |
| T8P.25 | Browser integration suite | `a3b684c5` |
| T8P.26 | Independent browser-critic gate | critics 4 to 6; bug tasks B1 to B5 and B2-B1 (`c9948a31` to `4905cfa8`); closed on critic-6 under revision 100 |

Every implementation commit had an ocr review (`evidence/D08P/ocr/`); test-only commits were reviewed relocated. Lane tasks ended with lane tiers, and each merge batch with a complete run (decision 111). Every run is recorded in `evidence/D08P/structural.md`, with outputs in `evidence/D08P/suite-runs/`.

**Test counts.**

| Suite | Start of D08P | End of D08P |
|---|---|---|
| Unit | 127 files, 1519 tests | 156 files, 1662 tests |
| Node integration | 103 files, 218 tests | 106 files, 229 tests |
| Browser, full tier | `browser-1` 119, `browser-2` 74 | `browser-1` 126, `browser-2` 98 |
| Checks | 14 | 14 |

The unit rise was examined at merge run 11 at the user's request: 98 titles left (74 moved files, 24 retired by T8P.27) and 153 are new (96 planned section 5 cases, 28 bug-fix tests, 13 T8P.27 moved assertions and 16 supporting tests). The user chose to keep the overlap.

**Last full tier, `T8P.26-B5`** (on `5ba87fb1`; only evidence and plan text changed after it), which stood as the full tier before critic-6:

| Suite | Result |
|---|---|
| Unit | 156 files, 1662 passed |
| Node integration | 106 files, 229 passed |
| Browser, full tier | `browser-1` 126 passed (4.8 min); `browser-2` 98 passed (6.1 min) |
| Checks | 14 of 14 exit 0 |

`acceptance-commands.sh plan/D08P-trade-detail-cockpit.md` exits 0, with 6 commands checked and none failing. Section 13's rows are marked covered.

## Critics

| Critic | Flows | Commit | Result | Tokens, tool calls, time |
|---|---|---|---|---|
| critic-1 (T8P.23 checkpoint) | C8P.1–C8P.4, 375/320 px | `05ca870f` | FAIL: 8 defects (1 high, 3 moderate, 4 low). Bug tasks B1 to B8. | 215,050; 70; 10 min 57 s |
| critic-2 (T8P.23) | C8P.1–C8P.4, 375/320 px | `b11aa7ab` | FAIL (C8P.2): 7 defects (1 high, 4 moderate, 2 low). Revisions 97 and 98; bug tasks B9 to B13. | 222,923; 59; 10 min 14 s |
| critic-3 (T8P.23) | C8P.1–C8P.4, 375/320 px | `0d251d22` | FAIL (C8P.2): 2 defects (1 high, 1 moderate). Revision 99: one accepted, B14 fixed, no fourth critic. | 190,820; 57; 11 min 28 s |
| critic-4 (T8P.26 gate) | C8P.1–C8P.6 | `d76e506b` | PASS, with 4 defects (3 moderate, 1 low). Bug tasks B1 to B4. | 220,136; 73; 9 min 55 s |
| critic-5 (T8P.26 gate) | C8P.1–C8P.6 | `582602ce` | PASS, with 1 moderate defect. Bug task B5. | 205,650; 74; 10 min 21 s |
| critic-6 (T8P.26 gate) | C8P.1–C8P.6 | `55d0cf59` | PASS, with 1 moderate defect: Journal paging drops keyboard focus at either end. The third gate critic, so the session stopped; the user accepted it as tech debt item 24 (revision 100), and the gate closes on this critic. | 213,034; 64; 11 min 25 s |

No critic could write its report file (the harness refuses report files from subagents). The main session took each final message from the session transcript as `critic-1.md` to `critic-6.md`.

The gate's critics found: critic-4, the Payoff legend and Lot Matches' Realized column hidden at 1280 px, "First Mark" on a final-session card with no Mark, and 5 px of clipped labels at 320 px (B1 to B4, with B2-B1 from ocr); critic-5, "Mark missing" beside the first-Marks note on a Trade's entry day (B5); critic-6, the focus defect.

## Decisions and the user's directions

**Revisions (each tagged `claude-opus-5.5-plan-r<n>`):**
- **85:** adds T8P.27, which removes the old Detail sections, tests and styles. **86:** tightens its test pairing.
- **87:** re-anchors two `ui-alignment` geometry checks to the rail-beside-drawers layout (the user's "Keep the intent, re-anchor").
- **88:** strict checks may gain the additive `nearest` and `days` fields.
- **89:** a bounded Max reward gets its R.
- **90:** T8P.28 and T8P.29 ("no Marks yet" stated by Trade Views, read not inferred) and T8P.30 (absence checks prove absence).
- **91:** the before-Marks words always name dates. **92:** Market Data's read session gives `nextSessionDate`.
- **93:** series points carry the Mark's provenance; lane R2 may wire Reflect now. **94:** Reflect now opens a Debt's form by its id. **95:** a Debt answered or declined on its card leaves Needs you at once.
- **96:** adds T8P.31, placing every figure of the three retired legacy blocks.
- **97:** C8P.2 names every accepted exception to "each figure appears once". **98:** a Settlement Due Trade's history ends at its contract's expiration (A212); Stale context keeps "close". **99:** the Trade Summary line's repeats join the exceptions; the checkpoint closes after B14 without a fourth critic.
- **100:** the gate closes on its third critic, critic-6; its one defect, Journal paging dropping keyboard focus, is accepted unfixed as tech debt item 24 (the user's choice; fixing it first was recommended).

**Other user directions:**
- **T8P.1's lock wrapper (2026-11-13):** review findings batched; after round 5, no more bug tasks on it. Two findings stand as accepted limits of dev tooling: AL-1, a malformed `ps` row in a zero-exit scan can drop a remembered descendant; AL-2, the successful-scan signal dedupe key omits the command line.
- **Lanes:** the main session creates them. **Agents:** a new task gets a fresh agent; a bug fix goes back to the agent that wrote the task.
- **Absence checks:** something that should be gone is asserted absent from the DOM, hidden panels included; something only hidden is asserted present and hidden.
- **T8P.19's chart:** values stay in text tables beneath the one chart.
- **Stray reviewer commits** on the branch (evidence text only) stand.
- **`build:releases`:** after the classifier refused it to a bug-task agent, the main session's suite runner builds releases; agents never run it.
- **Test count:** keep the overlap, including the two stale T8P.5 scaffolding tests (below).
- **Settlement Due's last Journal card** keeps "<date>, final session". **The empty-session edge case** stays recorded, unfixed (below).
- **W10 (2026-11-14):** "First Mark" names only a session that brought a Mark; a card whose session has no Mark shows its Trade P&L with no change line (T8P.26-B3).

**Implementation-level decisions** (recorded in `structural.md`):
- The gate's bug tasks B1 to B4 shared one full tier, which also stood as the full tier before critic-5.
- T8P.26-B3's Doubtful ocr finding was reassessed Wrong: its premise was false and the lowest seam covers the case.
- T8P.26-B5's Payoff reuses W7's before-Marks sentence, since no row gives Payoff words of its own for that state.
- T8P.25's full tier at `a3b684c5` stood as the gate's first full tier.

## Flagged items

- **Tech debt item 24 (revision 100):** in the Journal drawer, › to the last page or ‹ to the first disables the pressed button and keyboard focus falls to the page body. AC-UI-002's row is marked covered with this noted. The fix and its trigger are in `plan/implementation-plan.md`.

- **First-run passes, each with a mutation check that failed by assertion or runtime exception:**
  - T8P.1-B3 case 2; T8P.8 case 3; T8P.6 cases 3 and 4; T8P.9's two; T8P.12 case 3; T8P.18 cases 1 and 3; T8P.20 case 4; T8P.7's two (Tuesday, Long Stock); T8P.28 cases 2 and 3; T8P.10 case 3.
  - T8P.22 case 5 (the saved reflection) and its additions for T8P.31's figures (five mutations).
  - T8P.27: all 13 moved assertions, M1 to M13.
  - T8P.23-B4 (Open Lots, on `7dccdff5`) and one T8P.23-B13 case.
  - T8P.24: every I8P case, I8P.1 to I8P.7, as a Node suite over built behaviour.
  - T8P.25: all 8 browser cases, as a browser suite over built behaviour.
  - T8P.26-B3's browser case (`journal-final-session.spec.ts`).
- **Stale scaffolding tests kept at the user's choice:** `journal-cards.test.tsx`, "should render nothing until the lane that owns it replaces it", and `drawers/journal.test.tsx`'s `JournalDrawer === JournalBlock`.
- **Known edge, recorded and not fixed (the user's choice):** an expiration with no completed session drops later Journal items from the drawer.
- **Reviewer notes, not tasks:**
  - T8P.23-B9: an Underlying condition whose Mark is missing on the expiration day reads "Settlement Due".
  - T8P.23-B10: a second `exhaustive-deps` lint warning in `OwedDebtItem.tsx`, judged harmless; the `scrollIntoView` stub isn't restored.
  - T8P.23-B14-B1: `ScrollsToEnd`'s ResizeObserver snaps Today's narrow comparison back to its end on reflow.
  - T8P.26-B1: from 861 to 1199 px the Payoff chart keeps its 640 px minimum and scrolls inside its own box.
  - T8P.26-B2: the cockpit Lot Matches selector depends on the Bought and Sold column order.
  - T8P.26-B4: Today's narrow padding (0.08rem) is tuned to 320 px; the spec would catch a regression.
- **Outside the gate:** `npm run test:e2e:release-history`, run once on fresh release builds, has one failure: B6.6 (`e2e/d6/update.spec.ts:9`) expects About's schema "5" and reads "7". Decision 76 keeps upgrade tests out of the deliverables' runs (tech debt item 10), and D7 tagged B6.6 without building a `d6` release folder, so the case updates to the current build. Not caused by D08P.
- **Critics' minor observations** (all in `critic-4.md` to `critic-6.md`). Worth a decision later:
  - Journal pages of three cards run 1.6 to 2 screens with a long Daily Trade Review card ("about a screen" holds loosely).
  - "Due / Due" on an owed Journal card.
  - Six tabs wrap to two rows at 1280 px.
  - A just-answered reflection changes layout after a reload.
  - Settlement Due's full reason in four places (A222).
  - Record entry and Record exit are offered on a Settlement Due Trade (unchanged from before D08P).
  - Position shows "Expected Mark Date: Mon Nov 23" for an expired contract, though A212 says no Mark falls due (critic-6).
  - Before the first Marks, "Awaiting the close after Fri Oct 9" (P102) sits beside "once the Mon Oct 12 session ends" (critic-6).
  - Payoff's W18 sentence and Current caption repeat the latest Mark and Realized to date; with a Mark missing, the dated block's Trade P&L appears in three places (critics 5 and 6; existing words).
  - The Price History table has no accessible name of its own; only its region is named (critic-6).

## Wall-clock time against the estimate (breakdown section 3.3)

| | Time |
|---|---|
| Elapsed, handoff commit (2026-11-12 23:44) to the tag (2026-11-14, about 11:10) | about 35 h 25 min |
| Overnight pause waiting on the user's lock decision (2026-11-13, about 02:16 to 08:35) | about 6 h 20 min |
| Stop waiting on the user's gate decision (2026-11-14, 06:55 to 11:04) | about 4 h 10 min |
| Working time, roughly | about 25 h |
| Swarm estimate | about 9 to 10.5 h, plus about 1 h for revisions 85 and 90 |
| Serial estimate | about 24 h |

Working time still holds other gaps of one to two hours, some of them waits on the user's decisions; the commits can't separate those out. The overrun against the swarm estimate came mainly from:
- T8P.1's lock wrapper: five review rounds, B1 to B20, before the user accepted two limits;
- the checkpoint: three critics, 17 bug tasks and revisions 97 to 99;
- the gate: three critics and six bug tasks, with a full tier after each batch (about 2 h 40 min from T8P.25's start at about 04:15 to critic-6's report at 06:55);
- revisions 85 to 96, which added T8P.27 to T8P.31 and several stops.
