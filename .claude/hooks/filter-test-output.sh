#!/bin/bash
# PreToolUse hook (Bash): rewrites vitest / playwright / npm test commands so their
# full output goes to a log file and Claude sees only failures and the summary.
# Left alone: commands that already redirect or tee their output (evidence capture),
# and commands containing CLAUDE_FULL_OUTPUT=1.
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")

[[ -z "$cmd" ]] && exit 0
[[ "$cmd" == *CLAUDE_FULL_OUTPUT=1* || "$cmd" == *summarize-test-log.sh* ]] && exit 0
grep -qE '(^|[;&|( ])(npx +)?(vitest|playwright +test)( |$)|npm +(run +)?test(:[a-z0-9-]+)?( |$)' <<<"$cmd" || exit 0
grep -qE '(^|[^0-9&<])>|\| *tee( |$)' <<<"$cmd" && exit 0

summarize="$CLAUDE_PROJECT_DIR/.claude/hooks/summarize-test-log.sh"
wrapped='log_dir="${TMPDIR:-/tmp}/claude-test-logs"; mkdir -p "$log_dir"; log=$(mktemp "$log_dir/run-XXXXXX"); mv "$log" "$log.log"; log="$log.log"
( '"$cmd"'
) >"$log" 2>&1; ec=$?; bash '"'$summarize'"' "$log" "$ec"; (exit "$ec")'

jq -n --argjson ti "$(jq '.tool_input' <<<"$input")" --arg c "$wrapped" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", updatedInput: ($ti + {command: $c})}}'
