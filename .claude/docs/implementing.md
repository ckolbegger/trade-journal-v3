# Implementing a deliverable (main session)

The main session orchestrates: it reads, writes briefs, dispatches subagents, and records evidence. All development happens in fresh subagents: planned tasks, suite-failure fixes, and critic-defect fixes (each reproduced by a failing test first, then fixed). Code, edits, and test output stay in the subagents; the main session edits only plan, evidence, and handoff documents.

## Start-of-deliverable reading

The reading is scoped, to keep the context small (plan decision 45).

- For `specs/`, read the ranges listed in `plan/spec-reading/D<nn>.md`. Don't read the whole `plan/spec-map.md`: search it for any other section the work touches, and read that section before building on it.
- Read the current deliverable's breakdown in full.

From the rest of the frozen plan, read only what the deliverable uses:
- `implementation-plan.md` without the definition sections of deliverables later than the current one
- the acceptance matrix's opening sections only, looking up other rows by scenario ID when needed
- only the sections of earlier breakdowns that the current one builds on (decisions, boundaries, task graph, structural tasks, harnesses), never their behavioral task text

Do this reading once per session: at the start of the deliverable, or when a new session picks it up. Before each brief, check whether that reading is already in context, and if so write the brief from it without re-reading. After a context compaction, reread only the ranges the next brief needs, not the whole list.

Before the deliverable's first task, create `evidence/D<nn>/tdd-log.md` with a note that its rows are single-case runs; `tdd.sh` refuses to run without it.

## Delegating each task to `tdd-task`

Delegate every implementation task to its own fresh `tdd-task` subagent (`.claude/agents/tdd-task.md`). This covers every behavioral and structural task. The only exceptions are the cumulative runs, which go to `suite-runner`, and the browser-critic gate, which has its own fresh-critic rules; brief each critic from `.claude/docs/critic-brief.md`.

- Use one subagent per task, never one per case. Run tasks one at a time, in task-graph order.
- Write each brief from the reading, without opening the task's code. The brief gives:
  - the task ID, its title, and its kind (behavioral or structural);
  - the breakdown section to read in full, and the exact number of cases it lists;
  - the assumptions and decisions the task relies on;
  - the files and modules it builds on, including public types added by earlier tasks;
  - any `specs/` ranges it needs;
  - its scope limits: what later tasks own, and any temporary rule the task may need until then.
- The agent definition holds the TDD procedure, the first-run mutation check, committing, and the return format, so the brief doesn't repeat them.

## After each task

1. Review the returned summary without re-reading the code.
2. Run the `ocr-review` subagent (`.claude/agents/ocr-review.md`) on the task's implementation commit, naming the task's breakdown section as background. It runs Alibaba's Open Code Reviewer on that commit's changes and returns a findings table. Copy its raw output file to `evidence/D<nn>/ocr/<task>-<sha>.json` (the agent leaves it in a temporary directory) and record the table in `evidence/D<nn>/structural.md` under the task's heading. Findings don't stop the session (user's direction, 2026-10-24):
   - Each **Valid** or **Doubtful** finding becomes a bug task, `<task>-B<n>` (numbering continues across the task's rounds). Write it in `structural.md` under the task's heading: the finding, the defect it causes, and its `it should` cases. Delegate each bug task to its own fresh `tdd-task` subagent, failing test first, one at a time. Each bug-fix commit gets its own `ocr-review` run, handled the same way.
   - A **Wrong** finding is recorded as dismissed, with the reason, and listed in the handoff's open questions for the final report. Confirm the reason against the cited lines before dismissing.
   - A defect that a subagent's summary reveals in the task's code (not a later task's planned scope) is handled the same way, as a bug task.
   - Stop and ask only if a fix needs a spec or plan deviation, or if a third round of bug tasks on the same task still leaves findings.
3. Once the task and all its bug tasks have ocr reviews with "No findings." (or only dismissed findings), send the complete cumulative run to the `suite-runner` subagent (`.claude/agents/suite-runner.md`), passing `evidence/D<nn>` and a run label. Never run the full suite in the main session, and don't rerun it to check the runner's work. A failing run comes back as named failures; reproduce each with a single targeted run in the main session, then delegate its fix to a fresh subagent.
4. Record the returned table in `evidence/D<nn>/structural.md`.
5. Update the handoff's progress section, commit everything (evidence, raw ocr outputs, handoff), and start the next task without waiting.
6. Add any flagged item, such as a first-run pass or a dismissed finding, to the handoff's open questions for the final report. A deliverable runs from one prompt to its gate: the session stops only for the conditions the handoff lists under "Running a whole deliverable".

## Writing the next deliverable's handoff

Give its reading list in the form above, naming the sections to read, and name this file in it. Carry over two parts of the current handoff:
- the "Starting a session" paragraph, with its one-line prompt (*"Read plan/D<nn>-handoff.md and follow it."*), so the session reads and then starts the first task without stopping;
- the "Running a whole deliverable" stop conditions.
