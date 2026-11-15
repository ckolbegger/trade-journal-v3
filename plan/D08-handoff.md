# Handoff: `claude-opus-5.5`, D8 follow-up T8.19-F1

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction. Treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, the task's specifics and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-15, after plan revision 103. It replaces the D8 handoff, which ran D8 to its gate and the `claude-opus-5.5-d8` tag (`3ecb7c25`).

This session **runs one task, T8.19-F1, "Capacity commands and the growth baseline"**, under the frozen plan at revision 103 (decision 114). The task is defined in [D08-backup-and-restore.md](D08-backup-and-restore.md), section 1.6, and its Progress row is in section 11.

**In plain words.** T8.19 measured how much storage the restored benchmark journal uses. That measurement only ran when a `--restored` flag was given, and forgetting the flag rewrote the app's stored capacity figures. The user chose (Q29) to:
- name the commands for what they write;
- add a guard against growth: today's 206.5 MB becomes a committed baseline, and a later run fails if its usage is more than 50% above it.

**Starting a session.** The user starts with one prompt: *"Read plan/D08-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Start the task at once. Don't stop to report that the reading is done.

Continue until the task is Done, its review is clean and its complete run has passed. Then update the evidence and stop (section 4).

## 1. Confirm the location before anything else

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Ports | `5175` from the gitignored `.env.local` (tests, and D7's capacity measurement); `4175` for the benchmark only |
| Frozen plan | tag `claude-opus-5.5-plan-r103` (decision 114) |
| D8 | tag `claude-opus-5.5-d8` (`3ecb7c25`); it stays where it is |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly with `[ahead N]`. No uncommitted changes. |
| `git rev-parse --short 'claude-opus-5.5-d8^{commit}'` | `3ecb7c25` |
| `git log --oneline claude-opus-5.5-plan-r103..HEAD` | Empty, or only this handoff's and evidence commits. |
| `git diff --stat claude-opus-5.5-d8 claude-opus-5.5-plan-r103 -- src e2e tests tools package.json package-lock.json` | Empty: no code changed after the D8 gate. |
| `ls .claude/worktrees 2>/dev/null` | Empty or absent. |
| `ls .cache/bench` | Holds `benchmark.tjbackup`, `capacity.json`, `setup.json` and `profile/`. These are git-ignored and exist only in this worktree. |
| `shasum -a 256 .cache/bench/benchmark.tjbackup` | Starts with `6d819703`, the artifact in `bench/dataset.json`. |
| `grep usageBytes .cache/bench/capacity.json` | `206540122` |
| `lsof -nP -iTCP:4175 -iTCP:5175 -sTCP:LISTEN` | Nothing listening. |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |

If any check fails, **stop and ask the user**. If `.cache/bench/` is missing or holds another artifact, it can be rebuilt with `npm run build:bench && npm run bench:generate && npm run bench:setup`, which takes about 15 minutes for generation alone. Ask first.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. Tags are shared across worktrees, which is why every tag here has the `claude-opus-5.5-` prefix.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it. Then, scoped:
- **The D8 breakdown:**
  - section 1.6, all of it (T8.19-F1 is at its end);
  - P35 and A227;
  - section 3.1's T8.19 and T8.19-F1 rows;
  - section 5's T8.19 row;
  - section 11's Progress table.
- **`plan/implementation-plan.md`:** decisions 18, 39 and 114, and the freeze record.
- **`evidence/D08/DECISIONS-PENDING.md`:** Q29 only.
- **`plan/spec-reading/D08.md`:** only the capacity ranges (decision 18). This task changes tooling, not product behaviour.
- **The code it changes:**
  - `package.json`'s capacity scripts;
  - `tools/measure-capacity.ts` and `tools/verify-capacity.ts`;
  - `tools/capacity/profile.ts`;
  - `tools/bench/restore-checks.ts` and its test, `restored-capacity.ts` and `profile.ts`;
  - `tools/bench-run.ts`.

`specs/` and the frozen plan are read-only. A deviation is a pending decision (decision 113): ask at once in an ordinary message, record it in `evidence/D08/DECISIONS-PENDING.md` as Q30, and wait, since nothing else is unblocked. The next revision is r104, the next decision 115, and the breakdown's numbering continues at P108 and A230.

## 3. The task

1. Write `.claude/session.lock`. Mark T8.19-F1's Progress row "In progress from `<head>`", where `<head>` is `git rev-parse --short HEAD`.
2. **Brief one fresh `tdd-task`** for T8.19-F1. The brief:
   - **Where it runs:** in the main worktree, at the path above. No `isolation`, no lane and no `lane-setup.sh`, because the task needs `.cache/bench/`.
   - **What to read:** the task's text in section 1.6, quoted or cited by heading, with decision 114.
   - **Order of work:** the two unit cases red then green, one at a time. Then the structural changes. Then verification steps 1 to 8, in order.
   - **Files:** only those listed in the task. A need for any other file is a stop-and-report.
   - **Running alone:** nothing else may run while it measures (A227). The measure commands use port 4175 for the benchmark and 5175 for D7's figures.
   - **The baseline:** `bench/capacity-baseline.json` must end holding T8.19's figures (206,540,122 bytes, artifact `6d819703…`). The same holds for `src/delivery/capacity-basis.json`'s committed figures: verification step 6 restores both.
   - **Words:** say "Mark", never "close", and refer to sections in words, never with the "§" sign.
   - **Evidence:** the TDD log goes in `evidence/D08/tdd-log/T8.19-F1.md`, and the verification outputs in `evidence/D08/structural.md` under "T8.19-F1".
   - **Commit:** commit locally, ending with the trailer the agent's instructions specify. Never push.
3. **`ocr-review`** on the task's commit, with the plan section `plan/D08-backup-and-restore.md`, "T8.19-F1". Copy its output to `evidence/D08/ocr/T8.19-F1-<sha>.json`. Each Valid or Doubtful finding becomes a bug task, T8.19-F1-B1 and so on: a fresh `tdd-task` in the main worktree, then its own `ocr-review`. A third round that still has findings is a pending decision.
4. **`suite-runner`** with `evidence/D08`, the label `T8.19-F1` (or that of the last bug task) and the browser stage `browser-auto <base>`, where `<base>` is the commit from step 1. It will pick the full tier, because `package.json` changes. Give it the usual brief lines: exactly one report, sent only when complete, and each stage in its own foreground call. Its checks stage must still list 14 checks.
5. **No browser critic** (decision 114: no screen or word changes).

## 4. When it's done

- Mark the Progress row Done, with the commits.
- Add a line to `evidence/D08/final-report.md`'s "Decisions" paragraph: T8.19-F1 is done, with its commit, and the run label that passed.
- Commit the evidence.
- Remove `.claude/session.lock`.
- Report to the user:
  - the three ratios from `bench:verify-capacity`;
  - the run result;
  - any first-run passes or flakes.

  Don't tag anything unless the user asks. `claude-opus-5.5-d8` stays where it is. Never push.

## 5. Working rules

- **Commits:** the main session's commits end with the attribution lines from the session's system reminder. Never push.
- **Who edits what:** the main session edits only plan, evidence and handoff documents. Code goes to a fresh `tdd-task`.
- **Subagents:** general-purpose subagents run at medium effort. Don't resume an old subagent.
- **Git stash:** never use bare `git stash`.
- **Staging:** don't `git add evidence/D08` as a whole; add the files you mean.
- **Asking:** plain language first, then the detail. One decision per message, with options and a recommendation (decision 113).
- **Stop completely and ask** only when:
  - the session lock exists;
  - a location check fails;
  - a deviation needs the user's answer;
  - a failure can't be fixed within the task's files.

## 6. Out of scope

- **The trade-detail audit's findings** (`research/trade-detail-audit.html`). The user will handle them in a separate refactor plan.
- **D9** and everything later, the D8 retrospective, and D9's handoff, unless the user asks.
- **Known tooling gaps** from D8's final report:
  - `lane-setup.sh` doesn't carry `.cache/bench/`, and removing a lane worktree deletes it;
  - the suite-runner sometimes overlapped stages or sent an early report;
  - `tdd.sh` runs vitest only.

  Mention them if they bite; don't fix them unasked.
- **Pushing.**
