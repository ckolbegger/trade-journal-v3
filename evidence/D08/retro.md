# D8 retrospective (2026-11-15)

Covers D8's implementation session `1229eba6` (2026-11-14 20:34 to 2026-11-15 18:53: 16 context compactions; 354 subagents: 154 `tdd-task`, 156 `ocr-review`, 35 `suite-runner`, 9 general-purpose) and the T8.19-F1 session `9846d447` up to the D8 push. Sources: the user's messages in both sessions, [final-report.md](final-report.md), [DECISIONS-PENDING.md](DECISIONS-PENDING.md) and [structural.md](structural.md). Findings are ordered by severity. None is applied yet; each waits for the user's choice.

## 1. The user has to ask for status, and the answer hides tasks

- **What happened:** in the D8 session the user asked for the task table 8 times and "are you waiting for anything from me?" 4 times. Each answer was rebuilt by hand from the breakdown's Progress section and `DECISIONS-PENDING.md`. In the T8.19-F1 session, the main session shortened the table by dropping the Commits column. That hid every follow-up task (T8.3-F1, T8.8-F1 to F4 and the rest), because they have no rows of their own and appear only inside their parent's Commits cell. The user asked "Where are the new tasks?" and then "I am confused".
- **Cost:** user attention on every status question, and a wrong picture of the work twice in one session.
- **Proposed change:**
  - A read-only script, `.claude/scripts/status.sh <Dnn>`, prints the Progress table's rows that are not Done, a count of the follow-up and bug tasks per row, and every question in `DECISIONS-PENDING.md` without an answer. One pointer in `implementing.md`: when the user asks for the task table or what the session is waiting for, show this script's output.
  - **Applied (2026-11-15), part one:** `.claude/scripts/status.sh <Dnn>` and its test (`status.test.sh`, 13 cases), as D8-Retro-1a (`16d30e61`) with bug tasks B1 to B9 over three ocr rounds (see `structural.md`). `implementing.md` points to it when the user asks for the task table or what the session is waiting for. Lesson for briefs: a parser's brief lists the real inputs it must handle (every deliverable's plan), not one example; most of B1 to B9 came from a brief that described D08 only.
  - Follow-up tasks (F) get their own Progress rows, under their parent; bug tasks (B) stay in the Commits cell. A follow-up is a deviation with its own scope (section 1.6 lists them), so it reads as a task.

## 2. Decision records drift after the answer changes

- **What happened:**
  - Q29's recorded answer says one reset command that rewrites both stored files, and `verify:capacity:restored`. The user's later choices (two reset commands, `bench:verify-capacity`) went into decision 114 and the breakdown, but not into Q29's entry or the final report's "Decisions" paragraph. The T8.19-F1 session had to reconcile them, and explain the gap when the user asked about Q29.
  - Two answers sit in the next question's section: Q8's is under Q9 (Q8's own section still says "until the user answers"), and Q10's is under Q11.
  - The tag move (`3ecb7c25` to `2bc7c795`) leaves `D08-handoff.md` and the final report's first line naming the old commit.
- **Cost:** a reader of `DECISIONS-PENDING.md` gets a superseded answer, and a script or subagent counting answers gets a false "unanswered".
- **Proposed change:**
  - Mechanical, a check script (`.claude/scripts/decisions-check.sh <Dnn>`): every `## Qn.` section contains its own `**Qn answer` line, or is listed as open. The main session runs it before each evidence commit that touches the file, and `status.sh` (finding 1) reuses it.
  - Judgement, one sentence in `implementing.md`'s "Pending decisions" step 5: when the user changes an answer later, append "**Amended (date):**" in that question's own section, and update the final report if it quotes the answer.

## 3. "One question at a time, with a recommendation" lives only in handoffs

- **What happened:** the user asked for questions "one at a time" six times in the D8 session, and asked for more detail ("I don't understand the question well enough", Q8; the "channel" and "tabs tell each other" wording in Q28) five times. The T8.19-F1 handoff carries the rule ("One decision per message, with options and a recommendation"), but `implementing.md`'s "Pending decisions" says only "ask the user at once in an ordinary message". Each new handoff has to remember to copy it.
- **Overlapping questions (from the session log, at the user's prompt):** twice the next question was asked before the user had answered or written anything, inside a progress update set off by a subagent report. Q8 at 23:54:28, Q9 at 23:57:03 (2 min 35 s later); the user answered Q8 at 00:11 and Q9 at 00:14. Q10 at 03:39:47, Q11 at 03:45:37 (5 min 50 s later); the user answered Q11 first. Each first answer was then appended to the newest section, the second question's, which is how Q8's answer sits under Q9 and Q10's under Q11 (finding 2). This finding is the cause; finding 2's check catches the symptom.
- **Proposed change:** move the rule into `implementing.md`'s "Pending decisions" step 1: one question per message, plain words first, the context needed to decide, the options with their tradeoffs, and a recommendation. Drop it from the handoff template.
- **Applied (2026-11-15, the user's request):** `implementing.md`, "Pending decisions": step 1 asks one question at a time (a new question while another waits is queued, recorded and kept out of progress updates; the next is asked after the answer), with the message holding that question alone; step 2 records asked or queued; step 5 records the answer under the question's own heading and then asks the next queued one. The handoff template guidance never held the rule, so nothing was removed there. Decision 113 (3) still says the session "asks at once"; its amendment goes into plan revision 104, with the trade-detail audit plan (the user's choice, 2026-11-15).

## 4. One main session carried D8 plus three side projects

- **What happened:** besides the swarm, the D8 session ran the Trade Detail audit and its 35-item question round, the Mark-provider research (four providers and a comparison page), and Q29's discussion. It compacted 16 times. After one compaction a user question was lost: "I think I asked this before, but I didn't see your answer" (whether ocr reports its reset time).
- **Proposed change:** in `implementing.md`, a line for side requests during a deliverable: research and design work that is not a task of the deliverable runs in its own session (or a background agent whose result is a file), so the implementing session keeps its context for orchestration. Mention it to the user when such a request arrives, rather than refusing it.

## 5. Breakdown file lists can miss old command names

- **What happened:** T8.19-F1 changed what `measure:capacity` means. Two places outside its file list still use the old meaning: the hint in `tools/capacity/profile.ts` line 190 and the comment at the top of `tools/capacity/measure-page.ts`. The task correctly left them, so they are notes in the final report.
- **Proposed change:** in `drafting-breakdowns.md`, a task that renames or repurposes a command builds its file list from `grep -rn '<old name>'` over `tools`, `src`, `e2e`, `tests` and `.claude`. The two lines themselves are a one-line fix for the next task that touches `tools/capacity/`.

## 6. The session lock step meets a hook

- **What happened:** `implementing.md` says "write" `.claude/session.lock`; the main session tried a shell redirect, which `guard-shell-writes.sh` blocks, then used the Write tool.
- **Proposed change:** say "write it with the Write tool" in `implementing.md`'s session-lock paragraph. Low; one wasted call per session.

## Not findings

- **ocr's usage limit:** already fixed during D8 (`ocr-usage-wait.sh`, retest every 10 minutes).
- **suite-runner:** in T8.19-F1's run it sent one report, after every stage, and `run-complete.sh` agreed. The earlier overlaps and early report are in the final report's tooling notes.
- **T8.19-F1 itself:** no first-run passes, no ocr findings, a clean complete run.
