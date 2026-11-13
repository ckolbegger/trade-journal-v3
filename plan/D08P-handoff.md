# D08P, the Trade Detail cockpit: handoff for a planning session

Written 2026-11-12 at the user's request, after D7S and its three post-gate bug fixes (`claude-opus-5.5-d7s`, `2240fe1c`) and plan revision 83. D08P is the **D8 prefactor**: a refactor of the Trade Detail UI to match the "C. Cockpit" prototype, run before any more functionality is built (D8 and later).

**Starting a session.** The user starts a session with one prompt: *"Read plan/D08P-handoff.md and follow it."* Run the location checks in section 2, do the reading in section 3, then start the planning work in section 6 without stopping to report that the reading is done.

## 1. Your goal, and where you stop

**Plan the refactor. Don't implement it.** Your job ends with a **proposal to the user**: a drafted breakdown plus a short report. Don't change product code or tests, don't dispatch `tdd-task` subagents, and don't push.

The user wants the work **swarmed**: done by several agents at once, for the shortest wall-clock time. The heart of your proposal is the plan for maximum parallelism, and what has to change in this project's process to allow it.

The user expects the refactor to need **no backend changes**. For every step of your plan, **confirm or deny that intuition explicitly**: say whether the step changes anything outside `src/ui/` (domain, coordinators, modules, persistence, facade, capability manifest), and if so, what and why. Section 5 holds the main session's preliminary findings. They say the intuition holds for most of the cockpit but not for the panels that need earlier sessions' data. Verify them by lookup; don't take them on trust.

Deliver:
1. **`plan/D08P-trade-detail-cockpit.md`**, a draft breakdown written to `.claude/docs/drafting-breakdowns.md`, marked **"Draft, not agreed"** in its status line.
2. **A report to the user** in your final message, as section 7 lays out.
3. **One local commit** holding the draft, and any prototype additions (section 6, step 3). This is not a plan revision: don't tag it, and don't touch the freeze record or `plan/revisions.md`.

Once the user agrees the proposal, possibly after changes, record it as **plan revision 84** with **decision 110** (and more decisions if needed), following the pattern of decision 107 (revision 78, the D7S breakdown). Then:
- update the freeze record and `plan/revisions.md`;
- add a D08P row to the deliverable summary and a D08P definition section in `plan/implementation-plan.md`;
- write `plan/D08P-implementing-handoff.md` for the implementing session;
- commit, and tag `claude-opus-5.5-plan-r84`.

Push only when the user asks.

## 2. Confirm the location before anything else

| Check | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | No uncommitted changes. The branch is level with or ahead of `origin/claude-opus-5.5`. |
| `git log --oneline -1 claude-opus-5.5-plan-r83` | `527ae49e docs(plan): revision 83, tech debt item 23, …` |
| `git rev-parse --short 'claude-opus-5.5-d7s^{commit}'` | `2240fe1c` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |

If any check fails, stop and ask the user.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. Serve only on port 5175; the benchmark alone uses 4175. Commit locally; never push unless asked.

## 3. Read first

1. `CLAUDE.md`, which loads automatically, and **`.claude/docs/drafting-breakdowns.md`**. Follow the drafting guide; section 6 notes where this breakdown needs more than it asks.
2. **The prototype, `prototypes/trade-detail/index.html`, at `fdfe1482`.** Only the tab **"C. Cockpit"** matters. The other four tabs are rejected alternatives; ignore them. Use the "Trade state" switch to see its three states. The data is made up. Section 4 lists what the user decided about it.
3. **The current screen and its reads:**
   - `src/ui/screens/TradeDetail.tsx` (1,149 lines, one file), with `TradeDetail.test.tsx` (1,596 lines) and `TradeDetailOptions.test.tsx`;
   - `src/ui/app.css`;
   - the view types in `src/coordinators/trade-views/trade-views.ts` (`PlannedTradeDetail`, `OpenTradeDetail`, `ClosedTradeDetail`, `IncoherentTradeDetail`, around lines 220–390);
   - `TradeEvaluation` in `src/domain/trade-analysis/evaluate.ts`;
   - the facade in `src/app/compose.ts` (lines 66–115).
4. **`specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md`.** The UI consumes finished reads and calculates nothing. Decision 105 (revision 75) moved the last arithmetic out of `TradeDetail.tsx`; don't plan any back in.
5. **The D5R precedent: `plan/D05R-review-redesign.md`.** It is the last prototype-driven redesign. Read section 1, the task graph (section 3) and sections 6.3–6.4: how it moved the earlier browser cases onto the new layout through shared helpers (decision 65). It needed backend reads too (T5R.1–T5R.5).
6. **`plan/implementation-plan.md`:**
   - the rules and cumulative obligations;
   - decision 100 (one task at a time, in Progress order), decision 98 (the two browser stages), decision 105, and decisions 106–109;
   - the **D9 "Trade replay"** definition, which introduces `TradeAnalysis.replay` and Market Data `query` (`ReadSeries`);
   - the D8 and D19 definitions;
   - **tech debt** items 1–23. Item 23 (a Planned option Trade's missing "Expires" line) names this refactor as its trigger, and item 21 concerns the payoff sentence. Check every item's trigger against the files this refactor touches.
7. **`plan/D08-backup-and-restore.md`**, the opening only (status and the decision-107 note). D8's breakdown is drafted and agreed but not started, so a reorder (section 5.3) changes its starting point.
8. **`.claude/docs/implementing.md`**, `.claude/agents/tdd-task.md`, `.claude/agents/suite-runner.md` and `.claude/scripts/full-suite.sh`, for the process a swarm must change (section 5.4).
9. **The approved-words convention:** `plan/D07-approved-words.md` (conventions C1–C8) and the D7S breakdown's section 1.6. Every new on-screen text needs the user's approval.
10. **`specs/`.** The drafting guide says to read it in full. Do so, but give most attention to the Trade Detail, valuation, Mark and Journal sections, which you can find through `plan/spec-map.md`.

You may use read-only `Explore` or `general-purpose` subagents, in parallel, for the lookups the drafting guide requires. Pass `effort: "medium"` to `general-purpose` agents.

## 4. What the user decided

**The request** (2026-11-12): "start a fresh agent and have it work out a plan to refactor our UI to match the updated Cockpit prototype … swarm on the task to get it done as quickly as possible … think about how you would plan this out for maximum parallelism … come back to me with a proposal … I am expecting that this can be done without requiring any changes to the backend. Consider that at each step in the plan and confirm or deny my intuition on that issue." D08P runs "before implementing any more functionality".

**Answers to the main session's questions:**

| Topic | The user's answer |
|---|---|
| Data from earlier sessions (section 5.2) | **The planner decides.** The options also include splitting part of D9 off to run before D8, or moving D8 to run after all of D9. |
| Parallel browser work and ports (section 5.4) | **The planner proposes.** |
| Scope | **Trade Detail in every state first. Once that is finalized, share its components with other parts of the UI, as an additional set of tasks.** The main session agreed, with the conditions in section 5.5. |
| Entering Marks in Price History | **Read-only, with a link to the Review.** Missing Marks show as gaps; Trade Detail saves no Marks. |

**Decisions the user made on the prototype** (all in "C. Cockpit"):
- **Layout:** the cockpit is the chosen layout: a rail that always shows the state of play, and drawers for the detail.
- **Rail identity card:**
  - the symbol once in large text;
  - the strategy and lifecycle;
  - "Strike 150", then "Expires Fri 18 Dec 2026 (36 days)" (the expiration once, the symbol not repeated);
  - the account.
- **Rail P&L card:** Trade P&L, its change since the last marked session, and "n of m contracts open". **Realized P&L is not in the rail; it lives in the Position drawer.**
- **Rail Conditions card:** one block per condition:
  - row 1: the Stop or Target pill, a "nearest" badge, and the signed P&L figure on the right (− red for a Stop, + green for a Target);
  - row 2: the full condition, which must never wrap;
  - row 3: a muted line explaining the figure, such as "Change in Trade P&L from today's close if the option closes at $3.70 (−1.07R)" or "… if NVDA is at 140.00 at expiration (−1.57R)";
  - a breached condition reads "Breached" with "Today's close is $30.00 (0.04R) of Trade P&L past this Stop";
  - before any Marks, rows 1–2 only;
  - then Worst case and Max reward.
- **Rail "Needs you" list:** what needs the trader now.
- **Drawers, in this order:** Today, Position, Plan and entry, Price History, Journal, **Payoff last**.
- **Price History** (renamed from History):
  - sessions as columns, **newest on the left**, so a LEAP never needs scrolling to reach today;
  - rows for the Underlying's Mark, the option's Mark and Trade P&L;
  - missing Marks as gaps;
  - the user worries about very long histories (LEAPs).
- **Journal:** the Timeline's session cards in a horizontal carousel, newest first. Each card holds:
  - the session's price movement: Trade P&L, its change, and the Marks;
  - that session's journal entries, with an owed reflection keeping its Answer button.

  Back-to-back sessions without Marks merge into one card. A **‹** and a **›** round button page left and right by about one screen each (not to the ends).
- **Position drawer:**
  - open lots;
  - **Open P&L (including the open contract's opening fee), Realized and Fees paid**, so that Open plus Realized equals Trade P&L;
  - executions.
- **Payoff:** one chart, with the planned line dashed.
- **One figure, one place.** Each figure appears once on the page, and the user asked for this explicitly.

**Wording.** The prototype labels the Underlying's figure "NVDA close" and the option's "Call Mark". Both are **Marks**: a Mark is a session's closing price, which the trader enters. Use the app's term, "Mark", throughout.

**Settled after the prototype session:** "use that view in the daily" meant the **daily Review page**. The idea is a Price History-style grid there for entering several sessions' Marks at once. It is **not part of D08P**; the user leans toward a follow-on task after the Trade Detail refactor, possibly within the component-sharing phase (section 5.5).

**Settled: the Journal cards may repeat Marks.** The Journal session cards show each session's Marks, which Price History also shows. The user accepts this as an exception to "one figure, one place".

**A likely follow-on, not part of D08P:** the user will probably want the Journal trimmed to the sessions that matter: those whose Daily Action was something other than Hold, or where the trader wrote a reflection. Design the Journal drawer so this can be added later without rework, for example cards keyed by session with the filter applied over them. Say how merged no-Marks cards would behave under such a filter. List it with the other follow-ons in section 5.5's outline.

## 5. The main session's preliminary findings (verify each)

### 5.1 Which cockpit parts the current reads already cover

This comes from the view types and `TradeEvaluation`, not from building anything. Confirm each row by lookup, and state the result in your breakdown.

| Cockpit part | Data | Source today | Backend change? |
|---|---|---|---|
| Identity card | symbol, strategy, account, strike, expiration | `plan`, `labels`, `contractExpiration` | None (but see tech debt item 23 for Planned) |
| P&L card: Trade P&L, contracts open | marked P&L, held quantity, planned quantity | `current.evaluation.currentMarkedPnl`, `heldQuantity`, `plan.legs` | None |
| P&L card: change since the last marked session | the previous marked session's Trade P&L | **none** | **Yes** (section 5.2) |
| Conditions card | per-condition status, distance, R, overrun, value at expiration, nearest; worst case; max reward | the evaluation's conditions and headline figures (T7S.9 draws every condition today) | Probably none. Check that each figure the explanation line needs arrives finished. Signed amounts and R must not be computed in the UI. |
| Needs you | owed reflections | `journal` items with `dueStatus` | None |
| | first Marks due after the close | `current.expectedMarkDate`, `markResolution` | None |
| | a breached Stop | the evaluation | None |
| | "Today's Action is not recorded" | **not in the Trade Detail view** | Either `DailyReview.getTrade`, which is on the facade but would make the screen read the Review, or a new view field. Decide which, or drop the item. |
| Today drawer: today's Marks | current Marks | `current.mark`, `current.underlyingMark` | None |
| Today drawer: against the last marked session; the price track's previous marker | the previous session's Marks | **none** | **Yes** (section 5.2) |
| Today drawer: price tracks | Stops, Targets, entry, now | plan conditions, average entry, current Marks | None, if positions on the track need no arithmetic beyond layout. Decide whether scaling a price onto a track counts as a calculation under ADR 0001. |
| Position drawer | lots, Open P&L, Realized, fees, executions | `positions`, `lotMatches`, `realizedToDate`, `feeReconciliation`, `fees`, `positionChanges`; `remainingOpenPnl` in the evaluation | None. Check that "Open P&L" includes the open lot's opening fee, as the user expects. |
| Plan and entry drawer | plan, baseline, entry quality, at-entry figures | `plan`, `baseline`, `entryQuality`, `current.evaluation` | None |
| Payoff drawer | planned and current payoff | `payoff` | None |
| Price History | each session's Marks, gaps, Trade P&L | **none** | **Yes** (section 5.2) |
| Journal session cards | each session's Marks, Trade P&L, change, and which entries fall in the session | entries: `journal`; the rest: **none** | **Yes** (section 5.2). Assigning an entry to a session is a session-policy question, and only Market Data sees the session policy (decision 62). |

### 5.2 The data from earlier sessions

Four parts need history: the P&L card's change, the Today drawer's comparison and previous marker, Price History, and the Journal cards. One ordered series serves all four. It runs from first exposure to the latest close, and each session carries:
- its trading date and close instant;
- each Instrument's Mark, or Missing or Acknowledged;
- the Trade P&L at that close (a Value or an Unavailable with its reason);
- the change since the previous session that has a figure;
- the ids of the journal entries and Position Changes that fall in the session.

It should be **one read for the whole series**, inside `getTradeDetail`'s Open and Closed views:
- one snapshot, so the rail, the drawers and the cards agree;
- small, at a few figures per session and about 500 sessions for a two-year LEAP;
- the Marks are mostly loaded already, since the read session scans each Instrument from its earliest exposure (decision 106).

**The expensive part is the per-session P&L.** It needs the Position as it stood at each close (two contracts before a partial exit, one after). That is the core of D9's `TradeAnalysis.replay`. The plan already names D9's operations, so build those rather than anything new:
- Market Data `query` with `ReadSeries`;
- a cut-down `replay`, with marked and realized P&L per session and the gaps.

D9 then extends them, with condition status per frame, Position Change and settlement markers, its chart, a text equivalent and audit navigation, and nothing is thrown away. **This contradicts the user's intuition for these four panels:** two new read-only operations, an Installed Capability Manifest change and Trade Analysis code. No schema or stored data changes, so there is no migration or fixture work.

**Options to weigh and recommend from** (the user left this to you):
- **A. A slice of D9 inside D08P:** `ReadSeries` plus a cut-down `replay`.
- **B. Marks only:** `ReadSeries` alone. The panels show Marks and gaps, "since yesterday" becomes the Marks' change, and the P&L rows wait for D9.
- **C. UI only:** no new reads. The four panels are left out, or show only today, until D9.
- **D. Split D9:** its read model runs as its own step before D8, then D08P. The user named this one.
- **E. All of D9 before D8:** move D8 after D9, with D08P before or after D9. The user named this one too.

For D and E, D9 has no breakdown yet: drafting it means reading `specs/` in full under the drafting guide. D8's breakdown is agreed and carries a schema-7 note (decision 107), so check what a reorder changes in it. Give the cost and risk of each option, including the latency harness: tech debt item 22 records the D7S prefactor's slowdowns, and `getTradeDetail` gets heavier under A, B and D.

### 5.3 What makes this hard to swarm

- **Hot spots:**
  - `TradeDetail.tsx` is one 1,149-line file, and its two test files are 1,596 and 342 lines;
  - `app.css` is shared by every screen.

  Parallel agents editing these would conflict constantly. Something has to split them first.
- **Browser tests:**
  - **26 spec files** under `e2e/` reach Trade Detail;
  - the helpers in `e2e/d4/support.ts` and `e2e/d7p/support.ts` read it;
  - moving content into drawers means those cases must open a drawer first.

  D5R solved the same problem with shared card helpers (its section 6.4, decision 65). Get the exact list by lookup, as the drafting guide's "Texts" rule requires.
- **One port:** every browser test serves the app on this worktree's one port, 5175 (`HARNESS_PORT` in `tools/release-server.ts`, `BASE_URL` in `e2e/d1/support.ts` and two `e2e/d6` specs). Parallel browser runs collide unless the user assigns more ports and the port becomes configurable.

  Two more things collide besides the port:
  - **Shared build folders:** both browser stages rebuild `dist-faults` and the release builds.
  - **The results folder:** Playwright empties `test-results/` at start. Per-run `--output` folders fix this.
- **Process:** today's rules serialise everything:
  - decision 100 runs tasks one at a time, in Progress order;
  - the user's standing rule ends every task with a complete cumulative run, about 10 minutes with the browser stages, recorded to evidence;
  - each task gets an ocr review.

  A swarm needs these amended for parallel lanes. Propose exactly what changes, and keep the protections that matter: red/green per case, ocr per commit, and a full run before every critic.
- **Words:** any on-screen text no approved row covers stops an implementing session. Collect every new text in the draft for one approval up front, so the swarm never stops on words.
- **Worktrees:** parallel `tdd-task` agents would each need their own git worktree (the Agent tool's `isolation: "worktree"`).
  - **Cost:** each needs `npm ci`, or another way to get `node_modules`.
  - **Hooks:** the pre-commit hook (`.githooks`, typecheck and lint) runs in each one.
  - **Merging:** the main session merges the lanes.
  - **Isolation rule:** these lane worktrees belong to this implementation. Keep them clearly named and apart from the other implementations' worktrees, which stay off limits.

### 5.4 A starting shape for parallelism (a suggestion, not a plan)

- **Wave 0, serial and structural.** Split `TradeDetail.tsx` into one component file per section, with its own test file and its own stylesheet section, with no visible change and the existing tests unchanged. Add the drawer-opening helpers for the browser suites. This removes the hot spots. Possibly also land the cockpit shell (rail plus drawer tabs) here.
- **Wave 1, parallel lanes, each owning its own files:**
  - the rail cards: identity, P&L, Conditions, Needs you;
  - each drawer: Today, Position, Plan and entry, Payoff, Price History, Journal;
  - a backend lane, if section 5.2's choice needs one. Its files (domain, modules, coordinators) don't overlap the UI lanes'.
- **Wave 2:**
  - wire the history data into the Today drawer, Price History and Journal;
  - move the remaining browser cases onto the cockpit, in the single browser lane or across assigned ports;
  - the full cumulative run;
  - the fresh browser critic at 1280, 375 and 320 px.

Estimate the wall-clock gain against running the same tasks one at a time, and say where it comes from.

### 5.5 Sharing the components with other screens afterwards

The user wants this as a further set of tasks once Trade Detail is finalized. The main session agreed: building on one screen first and extracting what proved useful is the lower-risk order. It set two conditions:
1. **During Trade Detail, keep the new components presentational.** They take plain props and know nothing of `TradeDetailView`, so later sharing is a move, not a rewrite.
2. **Plan the sharing phase only after Trade Detail's gate, with the user's visual sign-off for each screen it touches.** The Review was redesigned in D5R to its own prototype. Re-styling it is a design decision, not a refactor, and its tests are the largest in the UI (`ReviewCard.test.tsx` has 1,662 lines).

In this draft, outline the sharing phase only: candidate components, candidate screens, and its own gate. Don't break it into tasks yet.

One candidate follow-on is already known: **the Price History grid on the daily Review page, for entering several sessions' Marks at once** (section 4). Unlike Trade Detail's read-only Price History, it saves Marks, so it goes through the Review's existing Mark saving (`DailyReview.save`, `SaveReviewMarks`) with its validation, corrections and acknowledgments. List it in the outline, and say whether it needs any backend change.

## 6. How to plan

1. **Verify section 5 by lookup** and correct anything that's wrong. Record the lookups' output in the draft, as the drafting guide requires.
2. **Settle the states.** The prototype shows only an open option Trade, in three states. The cockpit must also cover:
   - a Planned Trade, including tech debt item 23's missing "Expires" line;
   - a Closed Trade (by exit and by expiration);
   - an Incoherent Trade;
   - a stock Trade;
   - Settlement Due;
   - several open lots;
   - widths of 1280, 375 and 320 px.
3. **Extend the prototype where a state is new.** Add the states the cockpit doesn't yet show to `prototypes/trade-detail/index.html`, in the C. Cockpit tab only, so the user can approve them visually. Use the project's `prototype` skill. Don't let it become a new design.
4. **Choose and recommend** among section 5.2's options, including D8 and D9 ordering, and a port and process model for the swarm (sections 5.3 and 5.4).
5. **Draft the breakdown**, following the drafting guide and the D7S breakdown's form:
   - decisions and assumptions;
   - the task graph **with lanes and waves**;
   - each task's `it should` cases;
   - the structural tasks;
   - the browser suite and the moved earlier cases;
   - the acceptance rows;
   - the approved words to be;
   - a Progress section with a lane column.

   **Every task row says "Backend change: none" or names it.** Run the size check, and propose a split if it trips.
6. **Draft the process changes** a swarm needs, as amendment text for decision 100, `implementing.md`, `tdd-task.md` and `suite-runner.md`, and the user's full-run rule. These are proposals in the draft, not edits to those files yet.

## 7. Report to the user

Keep it short and lead with the answers:
1. **The backend verdict:** for each wave, and each task where it differs, whether it changes the backend, so the user's intuition is confirmed or denied step by step.
2. **Your recommendation** on the history data and the D8/D9 order, with the other options' costs in one line each.
3. **The swarm plan:** waves and lanes, how many agents at once, how lanes merge, how ports and browser runs work, and the estimated wall-clock time against serial.
4. **The process changes** it needs, and what protection each keeps.
5. **Words to approve**, as a list.
6. **Open questions** (section 4 leaves none; list any new ones), and the size check's result.
7. **The commit hash** of the draft.

Then wait for the user.
