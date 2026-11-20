# D9R2, the Review's Marks grid: handoff for a planning session

Written 2026-11-20 at the user's request, after D9 closed (tag `claude-opus-5.5-d9`, `10a4689e`). D9R2 is the second refactor inside D9 (D9A-R was the first). It builds the **Marks entry grid on the daily Review page**: a Price History-style grid for entering several sessions' Marks at once (the D08P breakdown's follow-on, its section 10.2, never scheduled). The rest of the Review restyle waits: after D9R2 ships, a coach review of the Review page runs (its prompt is ready, `evidence/D09/coach-review-2-prompt.md`), and the user decides the rest from it.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09R2-drafting-handoff.md and follow it."* Run the location checks in section 2, do the reading in section 3, then start drafting (section 6) without stopping to report that the reading is done.

## 1. Your goal, and where you stop

**Plan D9R2; don't implement it.** Your work ends with a **proposal to the user**: a draft breakdown and a short report. Don't change product code or tests, don't dispatch `tdd-task` subagents, and don't push.

Deliver:
1. **`plan/D09R2-review-marks-grid.md`**, a draft breakdown written to `.claude/docs/drafting-breakdowns.md`, marked **"Draft, not agreed"** in its status line.
2. **A report to the user** in your final message (section 7).
3. **One local commit** holding the draft. It is not a plan revision: don't tag it, and don't touch the freeze record or `plan/revisions.md`.

Once the user agrees the proposal, possibly after changes, record it as **plan revision 112** with **decision 123** (more decisions if needed; check that both numbers are still the next free ones), as decision 118 (revision 107) recorded D9A-R. Then:
- update the freeze record and `plan/revisions.md`;
- add a D9R2 row to the deliverable summary and a D9R2 definition section in `plan/implementation-plan.md`, after D9A-R;
- write `plan/D09R2-handoff.md` for the implementing session, from `.claude/docs/implementing.md`, "Writing the next deliverable's handoff";
- commit, and tag `claude-opus-5.5-plan-r112`.

Push only when the user asks.

## 2. Confirm the location before anything else

| Check | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | No uncommitted changes, except the untracked `evidence/D09/coach-review-2-prompt.md` (the user's, ready for later; leave it alone). The branch may be ahead of `origin`. |
| `git rev-parse --short 'claude-opus-5.5-d9^{commit}'` | `10a4689e` |
| `git tag -l 'claude-opus-5.5-plan-r*' \| sort -V \| tail -1` | `claude-opus-5.5-plan-r111` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |

If any check fails, stop and ask the user.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. Serve only on port 5175; the benchmark alone uses 4175. Commit locally; never push unless asked.

## 3. Read first

1. `CLAUDE.md`, which loads automatically, and **`.claude/docs/drafting-breakdowns.md`**. Follow it in full: all of `specs/`, the spec-map retag for D9R2, the lookups put into the breakdown, the Progress section and the size check.
2. **`research/review-page-style.html`, all of it.** It is the design record for the grid, written after the D08P audit and checked against the code then. Open it in a browser too (no server needed): its mockups show every cell state. Sections 4 to 8 are the grid; section 10 lists the rules that constrain it; section 11 the earlier decisions it changes; section 12 the recommended order. **Its line numbers predate D9**: rerun every lookup against the tree as it stands now (stage C rewrote the Review card's header and the meter replaced `StopTargetSlider`).
3. **`plan/D08P-trade-detail-cockpit.md`**: section 10.2 (this follow-on) and 10.1 (the sharing phase, whose prototype-first rule section 5 below asks about); A210 (`ReadSeries`) and the Price History drawer's tasks, since the grid shares its frame; and as the format to follow.
4. **`plan/D05R-review-redesign.md`** (P37, P38, A150 to A163; A153, A155 and A156 most of all) and **`plan/D05R2-review-card-progress.md`**: how the Review's Marks are saved and held today.
5. **`plan/D09-trade-replay.md`**, sections 1.6 (approved words W51, W52), stage C's tasks T9.31, T9.33 and T9.34, and P133: the Review open's read session and the meter on the card, which D9R2 builds beside.
6. **`plan/implementation-plan.md`:** the rules and cumulative obligations; decisions 100, 111, 113 (as amended by 115), 114 (the benchmark), 117, 118, 120 and 122 (task levels).
7. **`.claude/docs/implementing.md`**, so the breakdown fits how it will be run.
8. The code: `src/coordinators/daily-review/` (`daily-review.ts`, `types.ts`: `SaveReviewMarksRequest`), `src/modules/market-data/market-data.ts` (`MarketDataPrepareEntry`, the 1 to 100 entry limit, A154; `series`), the Review screen (`src/ui/screens/ReviewView.tsx`, `CardMarks.tsx`, `held-review.ts`), and Price History (`src/ui/cockpit/drawers/`, `price-history.props.ts`).

## 4. Already decided by the user

Don't ask these again.

- **One save carries several sessions' Marks** (the user, 2026-11-20). One Save Marks saves everything entered in the grid, across sessions and Instruments, in one commit. This answers the question D08P's section 10.2 left open ("whether one save may carry several sessions' Marks for one Instrument"). `SaveReviewMarks` already takes 1 to 100 entries keyed by Instrument and date, for any of the Review's keys (P37, A155), so this probably needs no backend change: confirm it with a lookup, and plan the message for more than 100 entries (research section 5).
- **The grid first, then the coach review, then the rest** (the user, 2026-11-20). D9R2 is the grid. The full cockpit-like Review (rail, drawers, tabs: research section 3), Replay moved out of the Action panel to its own place on the card, and other fixes wait for the coach review and the user's decisions after it. Don't plan them here, but don't make them harder: where the grid's home on today's card differs from its home in the restyle (the Marks drawer), say what moving it later would cost.
- **The research page's settled answers** (its section 1), from the user: one grid per Trade, styled like Price History; sessions shown are the Review Date and the previous session always, then each earlier session missing a Mark; long histories page 20 sessions at a time with the Review Date and the previous session fixed; a price typed in one Trade fills the same cell in every other Trade that holds the Instrument (drafts belong to the Review, not to one card); all three small fixes (research section 9) are wanted.
- **Words:** a price is a Mark, never a "close" (cell names "NVDA Mark, Thu Oct 8", never the prototype's "NVDA close for …"); "the close" is the session's end. Err toward too concise on screen. New words go to one approval batch.
- **List each task ID; never write a range** ("B5, B6, B7", not "B5 to B7"). Refer to sections in words, never with the section sign.

## 5. What the plan has to work out

These are the planner's to settle by reading the code and specs. Ask the user only where a choice is theirs.

1. **The data the grid lacks** (research section 8): the previous session's Marks and an Instrument's Mark in a column shown for another Instrument. The research proposes reading each Instrument's series from the Review open's read session (no new operation, no schema change, an additive field on the open result). Check it against stage C's second read session (P133) and prove with a query-count case that no stored read is added; AC-PERF-001's Review-open row and the benchmark re-measure it (decision 114).
2. **Drafts move from the card to the Review** (research section 5): mirrored chips in other Trades, one Save Marks for every draft, paging that keeps drafts. This changes A153 and A156 (unsaved work), the riskiest step. Say exactly which hold rules change.
3. **The cell editor** (research section 6): "Can't get a price", Correct, Withdraw (Review Date only, A57), acknowledgment reasons, conflicts; focus after a refused save.
4. **The phone layout** (research section 7): sessions as rows, Instruments as columns; 44 px cells; no sideways scroll for a single-leg Trade; resizing keeps drafts.
5. **One shared session grid** for Price History (read-only) and the Review (editable), keeping A216's presentational rule; Price History must look the same afterwards.
6. **The three small fixes** (research section 9): the Review card's "<date> close" heading to "At the <date> Marks" (also the "close" rule), acknowledged-unavailable cells in Price History, and Price History's gain and loss colours. Decide whether they are D9R2 tasks or go first on their own, and say why. Related standing tech debt (`evidence/D09/tech-debt.md`): item 11 (the Open list's "Thu Nov 12 close" wording) is the same family as the first fix; the user kept it as tech debt on 2026-11-20, so don't fold it in unasked; name it in the report.
7. **Which decisions it amends** (research section 11, as they stand now), each written as an amendment note in the decided style.
8. **Words:** every new label, tag ("Previous"), chip, count and message, with the nearest approved row; collect them for one approval batch.
9. **Reuse the test material**: the Review's existing fixtures and the d4, d5r and d7 browser support; say which existing browser cases read the Marks panel and must move, as D5R's rule asks.

## 6. Drafting

1. Draft in D08P's shape: decisions and clarifications, amendments to other plan sections, working assumptions, the size check, lookups (Texts, Shapes, Checks and Names), approved words, the task graph with its blocking, behavioral and structural tasks with their `it should` cases, integration and browser tests, browser-critic flows, tech debt triggers, open questions, the acceptance matrix rows, evidence recording, and Progress.
2. **For each task, say whether it changes anything outside `src/ui/`**, and what; and give its level (decision 122).
3. **The prototype question comes first.** D08P's section 10.1 asks for a prototype and the user's visual sign-off before the Review's own breakdown. The research page already holds a static mockup of every grid state. Ask the user, as your first question, whether those mockups are enough to sign off the grid, or whether a clickable prototype (in `prototypes/`, like `prototypes/review-workflow/`) comes before the breakdown. Recommend one, with what each costs.
4. **Questions for the user:** ask them one at a time, each with plain words first, the context, the options with their tradeoffs and a recommendation. Queue the others. Record each one and its answer in the breakdown's open-questions section.

## 7. Your report

Lead with what D9R2 gives the trader, in the trader's words. Then give:
- the number of tasks, and which change code outside `src/ui/`;
- whether the backend changes (the open result's new field; anything in `SaveReviewMarks`);
- the decisions it amends;
- the new words for approval;
- the questions still open;
- the commit hash.

Keep it short; the breakdown holds the detail.
