# D8R, the Trade Detail refactor: handoff for a planning session

Written 2026-11-15 at the user's request, after D8 (`claude-opus-5.5-d8`, `be736f8b`), T8.19-F1 and the D8 retrospective. D8R ("D8 refactor") carries out the Trade Detail audit's findings: it removes the leftovers from the pre-cockpit page, moves misplaced parts to their views, and names every contract in the broker style. It runs after D8 and before D9; D9 doesn't start until D8R is done.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D08R-drafting-handoff.md and follow it."* Run the location checks in section 2, do the reading in section 3, then start drafting (section 5) without stopping to report that the reading is done.

## 1. Your goal, and where you stop

**Plan the refactor; don't implement it.** Your work ends with a **proposal to the user**: a draft breakdown and a short report. Don't change product code or tests, don't dispatch `tdd-task` subagents, and don't push.

Deliver:
1. **`plan/D08R-trade-detail-refactor.md`**, a draft breakdown written to `.claude/docs/drafting-breakdowns.md`, marked **"Draft, not agreed"** in its status line.
2. **A report to the user** in your final message (section 6).
3. **One local commit** holding the draft. It is not a plan revision: don't tag it, and don't touch the freeze record or `plan/revisions.md`.

Once the user agrees the proposal, possibly after changes, record it as **plan revision 104** with **decision 115** (more decisions if needed), as decision 110 (revision 84) recorded D08P. Then:
- update the freeze record and `plan/revisions.md`;
- add a D8R row to the deliverable summary and a D8R definition section in `plan/implementation-plan.md`, after D8 and before D9;
- **amend decision 113 (3) in the same revision:** pending questions are asked one at a time, and any others are queued, as `.claude/docs/implementing.md` "Pending decisions" now says (D8 retro finding 3; the user's choice on 2026-11-15);
- write `plan/D08R-handoff.md` for the implementing session, from `.claude/docs/implementing.md` "Writing the next deliverable's handoff";
- commit, and tag `claude-opus-5.5-plan-r104`.

Push only when the user asks.

## 2. Confirm the location before anything else

| Check | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | No uncommitted changes. The branch is level with or ahead of `origin/claude-opus-5.5`. |
| `git log --oneline -1 claude-opus-5.5-plan-r103` | `4183364f plan: revision 103: …` |
| `git rev-parse --short 'claude-opus-5.5-d8^{commit}'` | `be736f8b` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |

If any check fails, stop and ask the user.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. Serve only on port 5175; the benchmark alone uses 4175. Commit locally; never push unless asked.

## 3. Read first

1. `CLAUDE.md`, which loads automatically, and **`.claude/docs/drafting-breakdowns.md`**. Follow it in full: all of `specs/`, the spec-map retag for D8R, the lookups put into the breakdown, the Progress section, and the size check.
2. **The audit, `research/trade-detail-audit.html`.** It is the scope. Read every section; the most important are 16 "Plan revision notes", 18 "Recommended changes, in order" and 19 "Approved after the report". It was written from the code at `ca839e70`. D8 has changed the code since, so verify every file and line it cites by lookup, never on trust. Its screenshots were in a temporary folder and may be gone.
3. **The D08P breakdown, `plan/D08P-trade-detail-cockpit.md`.** D8R reverses or amends parts of it: A206, A207, A217 and A223, the approved words W3–W6, W8, W10, W16, W18 and W19, C8P.2's accepted repeats, and tasks T8P.5, T8P.6, T8P.13–T8P.18, T8P.29 and T8P.31. Its section 1.5 lookups and section 4.2 lanes are the format to follow.
4. **`plan/D07-approved-words.md`**, conventions C1 and C3 (contract names).
5. **`plan/implementation-plan.md`:**
   - the rules and cumulative obligations;
   - decisions 100, 105, 110, 111, 113 and 114;
   - the D08P and D9 definitions;
   - tech debt items 21, 23 and 24. Item 24's trigger is "the next change to the Journal drawer's paging or session cards", so check whether D8R's Journal change fires it.
6. **`specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md`.** The UI calculates nothing. The audit's three backend additions (a trigger distance in Trade Analysis; the Underlying's two Marks on a Settlement Due Trade, and the open lots' average on an option Trade, in Trade Views) exist for that reason.
7. **`.claude/docs/implementing.md`**, so the breakdown fits how it will be run: swarm waves and lanes, ocr bug tasks, complete runs, and "Pending decisions".

## 4. Already decided by the user

Don't ask these again.

- **D8R is a swarm** (decision 111, as D08P and D8 ran): several agents at once, for the shortest wall-clock time. The heart of the proposal is the plan for maximum parallelism: waves, lanes with file ownership drawn so lanes don't collide, and the blocking between tasks. Give the Progress table Wave and Lane columns, and propose an agent cap (D08P's was six). Where a shared file (for example `Cockpit.tsx` or the contract-name function's callers) would serialize the lanes, say so, and propose how to split or sequence it.
- **The whole audit is in scope:** the 14 items of section 18, in its order unless the task graph needs another, under one deliverable named D8R.
- **Words:** everything under "Approved during this audit" in section 15, and all five items under "Still needing approval", which section 19 approves as written.
- **A Closed Trade sold before expiration:** the Underlying's row shows its Mark on the session of the final sale (section 19).
- **Out of scope**, from section 17: the Trade Summary line's two-leg form (multi-leg work after D8); the Daily Review card's "At entry" block (the Review page work); two contracts sharing a short name (when such contracts are supported).
- **Revision 98 stands.** On a Settlement Due Trade the Today column will usually be dashes; that is accepted (section 8).
- **List each task ID; never write a range** ("B5, B6, B7", not "B5 to B7").

## 5. Drafting

1. Draft the breakdown in D08P's shape, scaled down: decisions and clarifications, amendments to other plan sections, working assumptions, the size check, lookups (the drafting guide's Texts, Shapes, Checks and Names), approved words, the task graph with its blocking, behavioral and structural tasks with their `it should` cases, integration and browser tests, browser-critic flows, tech debt triggers, open questions, the acceptance matrix rows, evidence recording, and Progress.
2. **For each task, say whether it changes anything outside `src/ui/`** (domain, coordinators, persistence, facade), and what.
3. **The contract-name task is wide** (the audit counts 47 test and e2e files with long-form dates). Build its file list with the drafting guide's "Names" lookup, and separate the contract names from the "Expires" lines.
4. **Questions for the user**, for example the gate's shape or a split from the size check: ask them **one at a time**, each with plain words first, the context, the options with their tradeoffs and a recommendation. Queue the others, and ask the next only after the answer. Record each one and its answer in the breakdown's open-questions section.

## 6. Your report

Lead with what D8R does, in the trader's words. Then give:
- the number of tasks, waves and lanes, and the estimated wall-clock time against running them one at a time;
- which tasks change code outside `src/ui/`;
- what D8R reverses in D08P;
- the questions still open, if any;
- the commit hash.

Keep it short; the breakdown holds the detail.
