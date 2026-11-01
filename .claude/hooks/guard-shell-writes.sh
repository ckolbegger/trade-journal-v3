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
# another repository (a cd, git -C, --git-dir and --work-tree to paths outside the
# project, or a cwd outside it).
# Each simple command is normalized before the git rule reads it: a leading ( and trailing
# ) are dropped, so are redirects (with their targets) and everything from a # word on;
# git's global options (--no-pager, -c k=v, -C path, --git-dir, ...) are skipped to reach
# the subcommand; and the directory each cd leads to is tracked (cd - returns to the
# previous one), with relative paths and .. folded lexically, so no filesystem access is
# needed. --work-tree and --git-dir are tracked separately, each resolved against the
# directory (after any -C); a command counts as in the project when either is inside it.
# Given alone, one of them stands for both.
# It reads the command text only, so it is a guard against habit, not a sandbox. Known
# limits: a quoted path with spaces is cut at the first space; a quoted string holding
# ;, & or | can split a command wrongly; a cd inside a subshell is taken to apply to the
# rest of the command; $(...), env prefixes and aliases are not looked into; a lone
# --git-dir outside the project with the cwd inside it is allowed although git would then
# use the cwd as work tree.
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

shopt -s extglob
root=${root%/}

resolve() { # directory, path as written: sets $res to the absolute path with . and .. folded lexically, or ? when unknown
  local p=${2//[\"\']/} parts out=() x IFS
  case "$p" in
    \$CLAUDE_PROJECT_DIR*) p=$root${p#\$CLAUDE_PROJECT_DIR} ;;
    \$\{CLAUDE_PROJECT_DIR\}*) p=$root${p#\$\{CLAUDE_PROJECT_DIR\}} ;;
    \$*|\~*) res=?; return ;;
    /*) ;;
    *) [[ "$1" == "?" ]] && { res=?; return; }; p=$1/$p ;;
  esac
  IFS=/
  read -ra parts <<<"$p"
  for x in "${parts[@]}"; do
    case "$x" in
      ''|.) ;;
      ..) out=("${out[@]:0:${#out[@]}-1}") ;;
      *) out+=("$x") ;;
    esac
  done
  res="/${out[*]}"
}

outside() { # absolute path or ?: 0 when it is not in the project's repository
  [[ "$1" == "?" || ("$1" != "$root" && "$1" != "$root"/*) ]]
}

cur=$root # directory the command runs in, as far as the text tells
cwd=$(jq -r '.cwd // empty' <<<"$input")
[[ -n "$cwd" ]] && { resolve / "$cwd"; cur=$res; }
prev=$cur # the directory before the last cd; at the start, the cwd (a failed cd - stays put)
while read -r -a words; do # one simple command per line
  toks=()
  skip=0
  for x in "${words[@]}"; do
    ((skip)) && { skip=0; continue; }
    ((${#toks[@]})) || x=${x##+(\()} # a subshell's opening parenthesis
    x=${x%%+(\))}                    # and the closing one
    [[ -z "$x" ]] && continue
    case "$x" in
      \#*) break ;; # a comment runs to the end of the line
      *([0-9])+([\<\>])) skip=1 ;; # a redirect operator: its target is the next word
      *([0-9])[\<\>]*) ;;          # a redirect with its target attached
      *) toks+=("$x") ;;
    esac
  done
  case "${toks[0]:-}" in
    cd)
      i=1
      while [[ "${toks[i]:-}" == -* && "${toks[i]}" != - ]]; do ((i++)); done
      old=$cur
      if [[ -z "${toks[i]:-}" ]]; then cur=? # a bare cd goes home
      elif [[ "${toks[i]}" == - ]]; then cur=$prev # cd - returns to the previous directory
      else resolve "$cur" "${toks[i]}"; cur=$res; fi
      prev=$old ;;
    git)
      here=$cur # git's directory: -C moves it
      wt= gd=   # --work-tree and --git-dir, each resolved against here; empty when not given
      i=1
      while [[ "${toks[i]:-}" == -* ]]; do # global options before the subcommand
        case "${toks[i]}" in
          -C) resolve "$here" "${toks[i+1]:-.}"; here=$res; ((i+=2)) ;;
          --git-dir) resolve "$here" "${toks[i+1]:-.}"; gd=$res; ((i+=2)) ;;
          --work-tree) resolve "$here" "${toks[i+1]:-.}"; wt=$res; ((i+=2)) ;;
          --git-dir=*) resolve "$here" "${toks[i]#*=}"; gd=$res; ((i++)) ;;
          --work-tree=*) resolve "$here" "${toks[i]#*=}"; wt=$res; ((i++)) ;;
          -c|--namespace|--super-prefix|--config-env|--exec-path) ((i+=2)) ;;
          *) ((i++)) ;;
        esac
      done
      sub=${toks[i]:-}
      [[ "$sub" == switch || "$sub" == checkout || "$sub" == reset ]] || continue
      [[ -z "$wt$gd" ]] && wt=$here # without the options both are the directory itself
      outside "$wt" && outside "$gd" && continue # inside when either one is in the project
      args=" ${toks[*]:i+1} "
      pos=()
      for x in "${toks[@]:i+1}"; do [[ "$x" == -* ]] || pos+=("$x"); done
      moves=0
      case "$sub" in
        switch) moves=1 ;;
        checkout) [[ "$args" == *" -- "* ]] || moves=1 ;;
        reset) if [[ "$args" =~ \ --(hard|soft|mixed|merge|keep)\  ]]; then moves=1
          elif [[ "$args" != *" -- "* && ${#pos[@]} -eq 1 && "${pos[0]}" != HEAD ]]; then moves=1; fi ;;
      esac
      ((moves)) && deny "moving HEAD in the worktree is not allowed; check commits out in a scratch clone (git clone <root> \$(mktemp -d)/repo)." "" ;;
  esac
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
