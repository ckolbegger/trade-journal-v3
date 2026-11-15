# Implementing a deliverable (main session)

The main session orchestrates: it reads, writes briefs, dispatches subagents, and records evidence. All development happens in fresh subagents: planned tasks, suite-failure fixes, and critic-defect fixes (each reproduced by a failing test first, then fixed). Code, edits, and test output stay in the subagents; the main session edits only plan, evidence, and handoff documents.

## Start-of-deliverable reading

**Session lock (decision 113).** Before the reading, check for `.claude/session.lock`. If it exists, another session may be working in this worktree: stop, show the user its contents, and start nothing until they answer. Otherwise write it with the Write tool (the shell-write hook blocks redirects into `.claude/`), holding the start time and the deliverable. Remove it when the session ends, after the final report or a full stop.

The reading is scoped, to keep the context small (plan decision 45).

- For `specs/`, read the ranges listed in `plan/spec-reading/D<nn>.md`. Don't read the whole `plan/spec-map.md`: search it for any other section the work touches, and read that section before building on it.
- Read the current deliverable's breakdown in full.

From the rest of the frozen plan, read only what the deliverable uses:
- `implementation-plan.md` without the definition sections of deliverables later than the current one
- the acceptance matrix's opening sections only, looking up other rows by scenario ID when needed
- only the sections of earlier breakdowns that the current one builds on (decisions, boundaries, task graph, structural tasks, harnesses), never their behavioral task text

Do this reading once per session: at the start of the deliverable, or when a new session picks it up. Before each brief, check whether that reading is already in context, and if so write the brief from it without re-reading. After a context compaction, reread only the ranges the next brief needs, not the whole list.

Before the deliverable's first task, create `evidence/D<nn>/tdd-log.md` with a note that its rows are single-case runs; `tdd.sh` refuses to run without it.

**Run order (decision 113).** Before the first task, print the Progress table's tasks with their wave, lane and blocking tasks, from the breakdown's task graph.

Also before the first task, run `ocr llm test`. It must print `✓ Connection test successful`. If it fails, stop and ask the user to run `ocr auth login`. `ocr auth status` is no substitute: it shows a past expiry even when the sign-in still refreshes.

## Delegating each task to `tdd-task`

Delegate every implementation task to its own fresh `tdd-task` subagent (`.claude/agents/tdd-task.md`). This covers every behavioral and structural task. The only exceptions are the cumulative runs, which go to `suite-runner`, and the browser-critic gate, which has its own fresh-critic rules; brief each critic from `.claude/docs/critic-brief.md`.

- Use one subagent per task, never one per case. Run tasks one at a time, in the order of the breakdown's Progress section (decision 100). The next task is the first row not marked "Done". In a swarm deliverable, the Progress table also has Wave and Lane columns. Tasks run wave by wave. Within a wave, every lane runs at once, up to the breakdown's agent cap, and each lane runs its own rows one at a time in order. A task starts when every task it is blocked by is merged into the deliverable branch. The next task of a lane is its first row not marked "Done". Only the main session edits the table. Before its brief, mark that row "In progress from `<commit>`", using `git rev-parse --short HEAD`; that commit is A180's base. Editing the Progress section is not a plan revision.
- When the user asks for the task table or what the session is waiting for, run `.claude/scripts/status.sh <Dnn>` and show its output (open rows with their follow-up and bug counts, and unanswered questions). Show the full Progress table only when asked, with every column.
- When listing tasks, follow-up tasks or bug tasks, in a record or a message to the user, name each one: "B5, B6, B7", never "B5 to B7". A range hides sub-tasks such as B6-B1, and `status.sh` counts only the IDs it sees. Existing records keep their ranges.
- Write each brief from the reading, without opening the task's code. The brief gives:
  - the task ID, its title, and its kind (behavioral or structural);
  - the breakdown section to read in full, and the exact number of cases it lists;
  - the assumptions and decisions the task relies on;
  - the files and modules it builds on, including public types added by earlier tasks;
  - any `specs/` ranges it needs;
  - its scope limits: what later tasks own, and any temporary rule the task may need until then;
  - every bullet in the handoff's "Notes for later tasks" list that names this task, copied in word for word (D7 retro, finding 2). In the handoff update after the task, delete each bullet once every task it names has had it, so the list holds only notes still owed.
- The agent definition holds the TDD procedure, the first-run mutation check, the working rules (Edit tool only, scratch directories, exit codes, browser runs and ports, rebuilding after a mutation, staging), committing, the clean-tree check, and the return format, so the brief doesn't repeat them. Likewise, `suite-runner.md` holds its port checks, the one-stage-per-call order, the browser lock and how it waits for a backgrounded stage, so a suite-runner brief gives only the evidence folder, the run label and the browser stage; and `ocr-review.md` holds the review rule that brings test files in.

## After each task

1. Review the returned summary without re-reading the code.
2. Run the `ocr-review` subagent (`.claude/agents/ocr-review.md`) on the task's implementation commit, naming the task's breakdown section as background. It runs Alibaba's Open Code Reviewer on that commit's changes and returns a findings table. Copy its raw output file to `evidence/D<nn>/ocr/<task>-<sha>.json` (the agent leaves it in a temporary directory) and record the table in `evidence/D<nn>/structural.md` under the task's heading. Findings don't stop the session (user's direction, 2026-10-24):
   - **Only findings ocr itself raises count (user's direction, 2026-11-08).** A brief may put questions to the reviewer, and the reviewer may note things from its own reading. Those answers and notes go in `structural.md` and the final report, never into bug tasks. Act on such a concern only when ocr reports an issue there.
   - Each **Valid** or **Doubtful** ocr finding becomes a bug task, `<task>-B<n>` (numbering continues across the task's rounds). Write it in `structural.md` under the task's heading: the finding, the defect it causes, and its `it should` cases. Delegate each bug task to its own fresh `tdd-task` subagent, failing test first, one at a time. Each bug-fix commit gets its own `ocr-review` run, handled the same way.
   - A **Wrong** finding is recorded as dismissed, with the reason, and listed in the handoff's open questions for the final report. Confirm the reason against the cited lines before dismissing.
   - A defect that a subagent reports on its own, in a task summary or a review note, is a note too. It goes in `structural.md` and the final report, never into a bug task. It becomes one only when ocr itself raises it.
   - Stop and ask only if a fix needs a spec or plan deviation, or if a third round of bug tasks on the same task still leaves findings. Ask as "Pending decisions" below says.
3. Once the task and all its bug tasks have ocr reviews with "No findings." (or only dismissed findings), send the complete cumulative run to the `suite-runner` subagent (`.claude/agents/suite-runner.md`), passing `evidence/D<nn>`, a run label, and the browser stage. Never run the full suite in the main session, and don't rerun it to check the runner's work. A failing run comes back as named failures; reproduce each with a single targeted run in the main session, then delegate its fix to a fresh subagent.
   - **Completeness check.** Before recording any run, run `.claude/scripts/run-complete.sh evidence/D<nn> <label>` (read-only; it checks that every stage file for the run's tier exists, five for the full tier and four for the task tier, and that every command in them has finished). If it prints "run INCOMPLETE", the runner reported early: SendMessage it to wait for its completion notice and report again, and don't record the run until the check prints "run complete".
   - **Browser tier (decision 71, P55).** After a task, the browser stage is `browser-auto <base>`, where `<base>` is the commit the task started from, recorded in the task's Progress row before its brief (A180, amended by decision 100). It runs the full tier when the task's commits touch P55's paths (UI, app shell, service worker, delivery, persistence, styles, `index.html`, `e2e/`, the Playwright or Vite config, the package files or the release tools), and the task tier (`@every-task` plus the current deliverable's `e2e/` folder) otherwise. Record the tier it chose and its printed reason in `structural.md`. When it picks the full tier it runs nothing itself; the runner then makes two foreground calls, `browser-1` (`e2e/d1`, `d2`, `d4`) and `browser-2` (`e2e/d5` onward), each with the 600000 ms limit (decision 98, revision 65). New deliverables' folders join `browser-2` (the `test:e2e:2` script). If a runner reports either stage above 8 minutes, add a `browser-3` stage for the newest folders.
   - **Full tier (`browser-full`, the runner's input for `browser-1` then `browser-2`)** before every critic, in the deliverable's browser-suite task (T6.27 in D6), and whenever a run needs it.
4. Record the returned table in `evidence/D<nn>/structural.md`.
5. Mark the task's Progress row "Done" with its commits: the task's own, then its bug tasks, suite-failure fixes and their rounds, by ID (`B1 <hash>; F1 <hash>; B1-R1 <hash>`). In the handoff, put each warning for a later task in its own bullet under "Notes for later tasks", beginning with the IDs of the tasks it is for ("For T7.19, T7.23: …"). Then commit everything (evidence, raw ocr outputs, the breakdown's Progress section, handoff), and start the next task without waiting.
6. Add any flagged item, such as a first-run pass or a dismissed finding, to the handoff's open questions for the final report. A deliverable runs from one prompt to its gate: the session stops only for the conditions the handoff lists under "Running a whole deliverable".

## Running a swarm deliverable

Applies only to a deliverable whose breakdown has a lane column (decision 111).

- Dispatch each lane task to a fresh `tdd-task` with `isolation: "worktree"`, on a lane worktree `.claude/worktrees/<dnn>-<lane>` and branch `<dnn>/<lane>`, set up by `.claude/scripts/lane-setup.sh`. These worktrees belong to this implementation. Never open any other worktree.
- The brief adds the lane, its owned files (the breakdown's lanes and file-ownership table), and the lane's base commit.
- Review each lane commit with `ocr-review` as today. ocr bug tasks run in the same lane.
- A lane task is mergeable when its ocr is clean and its lane tier (unit, integration and checks, run in the lane worktree) passed. Rebase the lane branch onto the deliverable branch and fast-forward it there. If the rebase changed any file the task didn't own, rerun the lane tier first.
- **Merge runs:** when no merge is pending and at least one task has merged since the last run, send the complete cumulative run to `suite-runner` on the deliverable branch with `browser-auto <last run's commit>`. A failure is pinned to a merged task by a targeted run, and fixed in that task's lane.
- Run the full tier before every critic, unchanged.
- Merges, merge runs and critics are serial on the main session. Lanes keep working meanwhile.

The tools: `.claude/scripts/lane-setup.sh` (run first inside the lane worktree: clones `node_modules`, installs the hooks, copies `.env.local`), `.claude/scripts/full-suite.sh <evidence-dir> <label> lane` (the lane tier), and `.claude/scripts/with-browser-lock.sh <command…>` (serializes every user of port 5175; `full-suite.sh` already wraps its browser stages in it). `tdd.sh` writes `evidence/<Dnn>/tdd-log/<task>.md`, one file per task.

## Pending decisions (decision 113)

Stop and ask stays in force: never decide a question the specs or the plan leave to the user, and never change a plan test to get past one. When one arises, from a subagent's report, an ocr fix, or your own reading:

1. Ask the user in an ordinary message, not a question dialog, since a dialog blocks the session. **One question at a time:** ask only when no earlier question is waiting for its answer. Otherwise the new question is queued: record it (step 2) and leave it out of progress updates. When the user answers, ask the next queued question in its own message. A question's message holds that question alone: plain words first, the context needed to decide without opening a file, the options with their tradeoffs, and your recommendation. When the user asks what you are waiting for, name the question being asked and how many are queued.
2. Record it in `evidence/D<nn>/DECISIONS-PENDING.md`: the task, the question, the options with their tradeoffs, your recommendation, and whether it is asked or queued.
3. Pause that task, every task blocked by it, and the later tasks in its lane. Mark them "Paused: decision pending" in Progress.
4. Keep working on every other unblocked task. When nothing unblocked remains, stop and wait.
5. On the user's answer, record it under that question's own heading, record the decision (with a plan revision when the plan changes), mark the entry answered with the date, and resume the paused tasks. Then ask the next queued question.

## Benchmark (decision 114, from D9)

Run it once per deliverable, after the gate closes and before the tag, as the plan's rule "Benchmark once, at the end" says. Run it alone: no lane, merge run, critic or other browser run at the same time. Record the results in `evidence/D<nn>/bench.md`.

If any step fails or misses a budget or limit:
- don't brief a fix, and don't rerun the benchmark;
- tell the user the failing command, its figures and the limits, record it in `DECISIONS-PENDING.md`, and wait;
- the user chooses a fix now (bug tasks, then one more benchmark run) or a tech debt item, and the tag waits for that choice.

Never run `measure:capacity:reset-baseline` unless the user says so.

## Final report

At the gate, or at a full stop, report: the deliverable's result; each task's fix rounds (ocr bug-task rounds and suite-failure fixes); every flaky test seen, with the run it flaked in; every decision still pending; and the handoff's open questions. Then remove `.claude/session.lock`.

## Writing the next deliverable's handoff

Give its reading list in the form above, naming the sections to read, and name this file in it. Carry over two parts of the current handoff:
- the "Starting a session" paragraph, with its one-line prompt (*"Read plan/D<nn>-handoff.md and follow it."*), so the session reads and then starts the first task without stopping;
- the "Running a whole deliverable" stop conditions.

Task status lives in the breakdown's Progress section (decision 100), so the handoff keeps no task list, next task or base commit. Its progress section holds two lists, one bullet per entry: "Notes for later tasks" and "Open questions" for the final report.

Its location checks include `ocr llm test`, expecting `✓ Connection test successful`, and `git rev-parse --git-path hooks`, expecting `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`).

## Plan revisions and evidence

- Additions that the user makes to an in-progress revision belong in that revision. Do not open a new rN unless the user says so.
- Every plan revision gets an entry in the plan-revision log (`plan/revisions.md`).
- Record each ocr review result as task evidence immediately after it runs.
- Write decisions with precise, unambiguous wording, so that subagents cannot read them as permission to change plan tests.
