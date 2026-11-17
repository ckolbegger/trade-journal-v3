# D9, Trade replay: handoff for a planning session

Written 2026-11-17 at the user's request, after the replay interview and two rounds of prototypes (`research/replay-requirements.md`). D9 has a one-page definition in `plan/implementation-plan.md` and no task breakdown. This session drafts the breakdown, with the prototype work built in.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09-drafting-handoff.md and follow it."* Run the checks in section 2, do the reading in section 3, then start drafting (section 7) without stopping to report that the reading is done.

## 1. Your goal, and where you stop

**Plan D9; don't implement it.** Your work ends with a **proposal to the user**: a draft breakdown (or more than one, see section 6) and a short report. Don't change product code or tests, don't dispatch `tdd-task` subagents, and don't push.

Deliver:
1. **`plan/D09-trade-replay.md`**, a draft breakdown written to `.claude/docs/drafting-breakdowns.md`, marked **"Draft, not agreed"** in its status line. If the size check splits the work (section 6), one file per part.
2. **A report to the user** in your final message (section 8).
3. **One local commit** holding the draft. It is not a plan revision: don't tag it, and don't touch the freeze record or `plan/revisions.md`.

Once the user agrees the proposal, record it as a plan revision with its decisions, as decision 110 (revision 84) recorded D08P. Take the next free revision and decision numbers at that time: the D8R draft reserves revision 104 and decision 115.

## 2. Confirm the location before anything else

| Check | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | No uncommitted changes. |
| `git log --oneline -1 claude-opus-5.5-plan-r103` | `4183364f plan: revision 103: …` |
| `git cat-file -t 25ed7843` | `commit` (the prototypes and their check scripts) |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |

If any check fails, stop and ask the user.

**Then ask the user one thing: where D8R stands.** When this was written, `plan/D08R-trade-detail-refactor.md` was "Draft, not agreed" and not implemented. D8R changes Trade Detail, which D9 builds on, and its handoff says D9 doesn't start until D8R is done. Every lookup in D9's breakdown must be run against the tree as it stands when D9 is implemented. If D8R is not yet implemented, say in the breakdown which lookups must be rerun after it.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. Serve only on port 5175; the benchmark alone uses 4175. Commit locally; never push unless asked.

## 3. Read first

1. `CLAUDE.md`, which loads automatically, and **`.claude/docs/drafting-breakdowns.md`**. Follow it in full: all of `specs/`, the spec-map retag for D9, the lookups put into the breakdown, the Progress section, and the size check.
2. **`research/replay-requirements.md`, all of it.** It is the requirements record. The parts that bind the plan:
   - "Decisions from the interview" (15 decisions) and "Implications to carry to D9 planning";
   - "Round 2": the decisions from the round 2 questions, the decisions made while building round 2, the attempts discarded, and "Derived figures Corridor needs from D9";
   - "After round 2: the meter outside the replay".
   Where that file and this handoff disagree, this handoff is later and wins.
3. **The prototypes. Open them in a browser; no server is needed.**
   - `prototypes/replay/round-2.html`: the Corridor tab is D9's chart. The Ribbon tab is the chart to leave room for. The Gauge tab shows the meter at full size.
   - `prototypes/replay/trade-list.html`: the meter in the Open list.
   - `prototypes/replay/index.html`: round 1, kept as a record only.
   - `prototypes/replay/checks/`: scripts that walk the pages and check the model's arithmetic. `verify.js` holds the definitions of every per-session figure as executable checks; read it when writing the `it should` cases.
4. **`plan/implementation-plan.md`:** the rules and cumulative obligations; decisions 6, 100, 105, 110, 111, 113 and 114; the D08P and D9 definitions; the Parallelism section's lines on D9.
5. **`plan/D08P-trade-detail-cockpit.md`**, for the slice of `ReadSeries`, `replay` and `replayTrade` that already exists (A210, A211, A212 and A213), and as the format to follow. Then the code it left: `src/coordinators/trade-views/replay-view.ts`, `replay-trade.ts`, and the Price History drawer in `src/ui/cockpit/drawers/`.
6. **`specs/adr/0007-observed-valuation-and-expiration-payoff.md`** and `specs/design/ui-contract.md` "Numbers, availability, and graphs". Both need amending (section 5).
7. **`specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md`.** The UI calculates nothing. Every figure the chart and the meter draw comes from Trade Analysis or a coordinator as a finished value.
8. **`.claude/docs/implementing.md`**, so the breakdown fits how it will be run.

## 4. Already decided by the user

Don't ask these again. The first group is from the interview and the prototype reviews; the second is from 2026-11-17.

**The replay chart**
- **D9 builds Corridor.** One screen holds, top to bottom: the headline, a short strip of the Underlying's price, and the Trade's profit or loss as an area over time between the result at the Stop and the result at the Target.
- **Result first, stake second.** The headline is the Trade P&L in the result's colour, a sentence on how the Trade is going, then a neutral sentence on what is at stake from here.
- **Colour follows the result.** A profitable Trade feels green and a losing one feels red, whatever its reward to target is doing. Light fill is open, solid is banked, hatching is past the Stop or the Target. Risk to stop and Reward to target are drawn in neutral ink, once, at the session shown.
- **The Underlying's price and the Trade P&L are on screen together** at 1280, 375 and 320 px wide, and both follow the slider.
- **Time runs left to right.** No chart without a time axis. No chart with two unrelated vertical scales.
- **A slider reveals sessions.** The replay opens resting on the session being reviewed (the last one), so it reads without touching the slider. Nothing from a later session is on the page before it is revealed.
- **Executions show.** A scale-in or scale-out is marked on its session, the Stop and Target results step, and the banked part appears as a solid band.
- **The option's own Mark is not a charted line.** It is in the hover, the readout and the table.
- **Where it lives:** in the Review card just before the Action, and in Trade Detail, the same chart in both (interview decision 9). Leaving the Review and returning restores the Review Date, the Trade, the step and the slider's session.
- **Every decision the prototype sessions made while building is accepted** (the round 1, round 2 and list-mockup tables in the research file). Carry the ones that apply to Corridor and the meter.

**Ribbon**
- **Deferred, but planned for.** The user wants Ribbon later as a second view the trader can choose. D9 doesn't build it. D9's chart must be structured so adding it is easy: the derived figures, the time geometry, the slider, the headline, the hover and the text equivalent are shared, and only the plot differs. Say in the breakdown where that seam is.

**Implied volatility and the option figures: in D9**
- **Implied volatility goes into D9**, with the share equivalent and the price, time and volatility line that come from the same pricing function. The user's reason: without it, a wrong option Mark is close to impossible to catch (it looks like a plausible P&L move, but shows as a spike in implied volatility), and a model added later would have been exercised by none of D9's tests.
- **The textbook formula is accepted** (Black-Scholes, exercise at expiration only, no dividends). Discrepancies are dealt with later if at all.
- **It explains; it never predicts and never values.** These figures are estimates, labelled so, drawn unlike Marks, and they never feed the Trade P&L, Risk to stop or Reward to target. Each is Unavailable with a reason when it can't be worked out (a Mark missing, or the option's Mark below its exercise value).
- **How they show** (round 2): implied volatility and the share equivalent as small chips that open a small chart; the split as one line under the charts, "since the session before". The share equivalent may be text only; the thick price line of round 2's third tab was not liked.
- **Rates** (interview): 4% for short-term options and 5.25% for long-term ones. The plan decides how a rate is chosen properly.

**The meter**
- **A Stop-to-Target meter goes in three places:** the Daily Review card (replacing today's `StopTargetSlider`), the Open list, and Trade Detail. One component at three sizes.
- **It reads as in `trade-list.html`:** the track runs from the Trade's result at the Stop to its result at the Target and always includes break-even; the fill runs from break-even to the pointer, outlined when open and solid when banked; a faint mark shows the session before; past a rail is hatched with a square pointer; no Mark is a dashed empty track. No visible words on the meter: the signed P&L sits beside it, and the words are its accessible name and its hover.
- **The Open list goes into attention order,** the Daily Review's order, so that moving between managing Trades and the daily review is simpler. The user called this a lean, not a final choice: plan for it, and tell the user what it costs (section 5).
- **A Trade that has scaled out: keep both as they are.** The order follows the share of entry risk or reward used up; the meter shows where the result sits. They can disagree (LUMA in the mockup). Revisit only if the built thing proves a problem.

**General**
- **List each task ID; never write a range** ("B5, B6, B7", not "B5 to B7").
- **A price is a Mark, never a "close".**

## 5. What the plan has to work out

These are the planner's to settle by reading the code and specs. Ask the user only where a choice is theirs.

1. **The derived figures per session.** The research file lists them: Trade P&L; realized P&L to date; the Trade's result at the Stop and at the Target; Worst case and Max reward; the same for the Plan Baseline; the share of the way to the Stop or the Target; the lowest and highest result so far. `ReplaySession` carries the first two today. Decide which operation owns each of the others.
2. **Estimates are not exact arithmetic.** The domain uses exact rationals. Implied volatility needs logarithms, a normal distribution and a search, so it is floating point. Decide how an estimate is typed and kept apart from exact values, so it can't flow into a figure that claims exactness.
3. **The ADR 0007 amendment.** The ADR says the application doesn't "require volatility, rate, or dividend assumptions". Draft the amendment: implied volatility read back from observed Marks to explain a past move, never to project or to value. Add the glossary terms it needs.
4. **The UI contract.** "Mark-to-Market replay and Expiration Payoff remain separate views" needs no change for Corridor, which draws no payoff line. Interview decision 11 (a Closed Trade's replay shows how each option settled and the final result) does apply; check it against the sentence.
5. **Condition status per session, markers, the text equivalent and audit navigation**, which the D9 definition already requires. Corridor's table is the text equivalent in the prototype.
6. **A moved Stop.** The prototypes have none. The result at the Stop steps when the Position changes; say how it is drawn when a Management Revision moves the Stop.
7. **The meter on Trade Detail: where.** The user asked whether it belongs on the Conditions card. The prototype session's recommendation, **not yet accepted by the user**: yes, at the top of the Conditions card (`src/ui/cockpit/rail/conditions.tsx`). That card already holds the distance to each condition, the Worst case and the Max reward, which are exactly what the meter draws; the P&L card keeps the figure. Confirm it with the user.
8. **The Open list in attention order: the cost.** Look up and report:
   - which tests and frozen fixtures assert Last Activity order (the drafting guide's Texts and Shapes lookups; `bench/expected-open-rows.json` is one);
   - where attention is worked out today (`src/coordinators/daily-review/attention.ts`) against where the list is read (Trade Views), and how they share it without the list depending on the Review;
   - the effect on the Open-list latency budget (AC-PERF-001) at 200 rows;
   - whether Planned and Closed keep their orders (the prototype session assumed they do).
9. **What the meter needs that `RangePosition` lacks:** the banked part, the session before, and how far past a rail.
10. **Words.** Every new label, sentence and accessible description needs approved words, as D07's list did.

## 6. How the work divides

The user would like everything above in D9, and knows it may be too much for one breakdown. There is no existing task list to split, so draft the task graph first and let the drafting guide's size check (more than 25 tasks) decide. The prototype session's view of the seams, to test against the graph:

| Part | What it holds | Depends on |
|---|---|---|
| **A. The replay chart** | The per-session figures, condition status, markers, Corridor, the slider, the headline, the hover, the text equivalent, audit navigation, the chart in Trade Detail and in the Review card, and the seam for Ribbon. | D08P's replay slice. |
| **B. The option estimates** | The ADR 0007 amendment and glossary terms, the pricing function, implied volatility per session, the share equivalent, the split line, the chips and their small charts. | A's sessions and chart. |
| **C. The meter** | The component, the Review card (replacing the slider), Trade Detail, the Open list and its attention order. | Nothing in A or B: it needs only today's figures. |

- **If it splits, split between A and B, and keep B immediately after A.** After A the replay is whole for stock and readable for options; what is missing is the check on option Marks, which is why B must not drift. Name that gap in the first part, as the drafting guide asks.
- **C stands alone.** It can be its own deliverable before, after or beside A, and it is the part most likely to run in parallel. Its Open-list change touches a shared screen and the benchmark's expected rows, so check the Parallelism section before proposing it beside anything.
- **If the user keeps one breakdown,** add a checkpoint critic after A's UI tasks.

## 7. Drafting

1. Draft in D08P's shape: decisions and clarifications, amendments to other plan sections, working assumptions, the size check, lookups (Texts, Shapes, Checks and Names), approved words, the task graph with its blocking, behavioral and structural tasks with their `it should` cases, integration and browser tests, browser-critic flows, tech debt triggers, open questions, the acceptance matrix rows, evidence recording, and Progress.
2. **For each task, say whether it changes anything outside `src/ui/`**, and what.
3. **Use the prototype's trades as test material.** The six trades and their two series each cover a scale-in, three scale-outs, a gap below a Stop, a missing option Mark and a Stop set in dollars. `prototypes/replay/checks/verify.js` states what each figure must equal. The prototype's Marks come from a model; in the app Marks are observed, so tests enter them as Marks.
4. **The prototype is a picture, not code to port.** It is one HTML file that calculates in the page. In the app the figures come from Trade Analysis and the coordinators, and the chart only draws.
5. **Questions for the user:** ask them one at a time, each with plain words first, the context, the options with their tradeoffs and a recommendation. Queue the others. Record each one and its answer in the breakdown's open-questions section.

## 8. Your report

Lead with what D9 gives the trader, in the trader's words. Then give:
- whether the work is one breakdown or several, where it splits and why;
- the number of tasks, and which change code outside `src/ui/`;
- the amendments to ADR 0007, the glossary and the UI contract;
- what the Open list's attention order costs;
- the questions still open;
- the commit hash.

Keep it short; the breakdown holds the detail.
