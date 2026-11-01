#!/bin/bash
# PreToolUse hook (Bash): refuses shell commands that write project files, so every
# change to code, tests, plans and tooling goes through the Edit and Write tools.
# Refused:
#   - in-place edits: sed -i, perl -i (and -pi), sed --in-place;
#   - output redirects (> or >>, so also here-docs and cat/printf/echo appends) and
#     tee into a project path outside evidence/; a project path is one whose first
#     segment is a tracked top-level entry, such as src/, tests/, plan/ or package.json;
#   - inline node, tsx or python code that writes files (writeFile, appendFile,
#     createWriteStream, write_text, open(..., "w"/"a")).
# Allowed: writes under evidence/, untracked folders such as test-results/ and dist*/,
# /dev/null, and paths outside the project (temporary and scratch directories).
# It reads the command text only, so it is a guard against habit, not a sandbox.
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
[[ -z "$cmd" ]] && exit 0
root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}
[[ -z "$root" ]] && exit 0

deny() {
  jq -n --arg r "Blocked by .claude/hooks/guard-shell-writes.sh: $1 Use the Edit or Write tool to change project files. Shell writes are allowed only under evidence/, untracked folders and temporary directories." \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

if grep -qE '(^|[;&|(` ])(g?sed|perl)( +-[^ ]*)* +(-[a-zA-Z]*i|--in-place)' <<<"$cmd"; then
  deny "in-place sed or perl edits are not allowed."
fi

if grep -qE '(^|[;&|(` ])(node|python3?|tsx|npx +tsx)( |$)' <<<"$cmd" &&
  grep -qE "writeFile|appendFile|createWriteStream|write_text|open\([^)]*['\"][wa]\+?['\"]" <<<"$cmd"; then
  deny "inline node or python code that writes files is not allowed."
fi

tops=$(git -C "$root" ls-files 2>/dev/null | cut -d/ -f1 | sort -u | grep -vx evidence)

protected() { # target path as written in the command
  local t=${1#\"} r
  t=${t%\"}
  t=${t#\'}
  t=${t%\'}
  case "$t" in
    \&*|/dev/*) return 1 ;;
  esac
  t=${t#\$CLAUDE_PROJECT_DIR/}
  t=${t#\$\{CLAUDE_PROJECT_DIR\}/}
  t=${t#\$CLAUDE_PROJECT_DIR\"/}
  t=${t#"$root"/}
  [[ "$t" == /* ]] && return 1
  t=${t#./}
  r=${t%%/*}
  grep -qxF -- "$r" <<<"$tops"
}

while read -r target; do
  [[ -z "$target" ]] && continue
  protected "$target" && deny "a redirect into $target is not allowed."
done < <(grep -oE '(^|[^0-9&>=<])>>? *[^ ;&|)<>]+' <<<"$cmd" | sed -E 's/^[^>]*>>? *//')

while read -r target; do
  [[ -z "$target" ]] && continue
  protected "$target" && deny "tee into $target is not allowed."
done < <(grep -oE '(^|[;&|( ])tee( +-[a-z]+)* +[^ ;&|)<>-][^ ;&|)<>]*' <<<"$cmd" | sed -E 's/.*tee( +-[a-z]+)* +//')

exit 0
