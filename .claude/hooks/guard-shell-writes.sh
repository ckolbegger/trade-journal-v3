#!/bin/bash
# PreToolUse hook (Bash): refuses shell commands that write project files, so every
# change to code, tests, plans and tooling goes through the Edit and Write tools.
# Refused:
#   - in-place edits: sed -i, perl -i (and -pi), sed --in-place;
#   - output redirects (> or >>, so also here-docs and cat/printf/echo appends) and
#     tee into a project path outside evidence/; a project path is one whose first
#     segment is a tracked top-level entry, such as src/, tests/, plan/ or package.json;
#   - inline node, tsx or python code that writes files (writeFile, appendFile,
#     createWriteStream, write_text, open(..., "w"/"a");
#   - git commands that move HEAD or switch branch in the project's own repository:
#     git switch, git checkout without a -- path list, git reset --hard|--soft|--mixed|
#     --merge|--keep, and git reset <rev> with no -- path list.
# Allowed: writes under evidence/, untracked folders such as test-results/ and dist*/,
# /dev/null, and paths outside the project (temporary and scratch directories); git
# path restores (git checkout [<rev>] -- <path>), unstaging (git reset, git reset HEAD
# <path>), every other git command, and the HEAD-moving commands above when they run in
# another repository (a cd or git -C to a path outside the project, or a cwd outside it).
# It reads the command text only, so it is a guard against habit, not a sandbox.
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
[[ -z "$cmd" ]] && exit 0
root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}
[[ -z "$root" ]] && exit 0

deny() { # reason, then an optional replacement for the Edit and Write advice
  jq -n --arg r "Blocked by .claude/hooks/guard-shell-writes.sh: $1 ${2-Use the Edit or Write tool to change project files. Shell writes are allowed only under evidence/, untracked folders and temporary directories.}" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

outside() { # path as written: 0 when it is another repository; a relative path keeps $inside
  local p=${1//[\"\']/}
  case "$p" in
    \$CLAUDE_PROJECT_DIR*|\$\{CLAUDE_PROJECT_DIR\}*) return 1 ;;
    \$*|\~*) return 0 ;;
    /*) [[ "$p" != "$root" && "$p" != "$root"/* ]] ;;
    *) ((! inside)) ;;
  esac
}

inside=1 # 1 while the command runs in the project's repository
cwd=$(jq -r '.cwd // empty' <<<"$input")
[[ -n "$cwd" ]] && outside "$cwd" && inside=0
while read -r seg; do # one simple command per line
  seg=${seg#\(}
  if [[ "$seg" =~ ^[[:space:]]*cd[[:space:]]+([^[:space:]]+) ]]; then
    outside "${BASH_REMATCH[1]}" && inside=0 || inside=1
  elif [[ "$seg" =~ ^[[:space:]]*git[[:space:]]+(-C[[:space:]]+([^[:space:]]+)[[:space:]]+)?(switch|checkout|reset)([[:space:]]+(.*))?$ ]]; then
    here=$inside
    [[ -n "${BASH_REMATCH[2]}" ]] && { outside "${BASH_REMATCH[2]}" && here=0 || here=1; }
    ((here)) || continue
    sub=${BASH_REMATCH[3]} args=" ${BASH_REMATCH[5]} "
    read -ra words <<<"$args"
    pos=()
    for w in "${words[@]}"; do [[ "$w" == -* ]] || pos+=("$w"); done
    moves=0
    case "$sub" in
      switch) moves=1 ;;
      checkout) [[ "$args" == *" -- "* ]] || moves=1 ;;
      reset) if [[ "$args" =~ \ --(hard|soft|mixed|merge|keep)\  ]]; then moves=1
        elif [[ "$args" != *" -- "* && ${#pos[@]} -eq 1 && "${pos[0]}" != HEAD ]]; then moves=1; fi ;;
    esac
    ((moves)) && deny "moving HEAD in the worktree is not allowed; check commits out in a scratch clone (git clone <root> \$(mktemp -d)/repo)." ""
  fi
done < <(tr ';&|' '\n' <<<"$cmd")

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
