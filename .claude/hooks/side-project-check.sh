#!/bin/bash
# UserPromptSubmit hook: while a session holds .claude/session.lock (it is implementing a
# deliverable), add a reminder to every user prompt so Claude checks whether the prompt asks
# for a side project, and if so asks the user where to run it before starting.
# A side project is research, design, a prototype, an audit or a page that is not a task of
# the current deliverable (D8 retro, finding 4). Prints nothing when no lock exists.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -f "$root/.claude/session.lock" ] || exit 0
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Side-project check (a deliverable session holds .claude/session.lock). Before acting on this prompt, decide whether it asks for a side project: research, design, a prototype, an audit, or a page or report that is not a task of the current deliverable. Answers to pending questions, status questions, and instructions about the deliverable, its tasks, evidence or tooling are not side projects. If it is a side project, start nothing yet. Ask the user, in one short message, whether to (a) start it in a new session, giving a ready-to-paste prompt for that session, or (b) do it in this session, in a background agent that writes its result to a file and returns only the file path and a summary of at most 10 lines. Then act on the answer."}}
JSON
