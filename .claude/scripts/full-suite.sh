#!/bin/bash
# Runs the complete cumulative suite and writes the full outputs as evidence.
# Usage: .claude/scripts/full-suite.sh <evidence-dir> <label> [unit|integration|browser-1|browser-2|browser-task|checks]
#        .claude/scripts/full-suite.sh <evidence-dir> <label> browser-auto <base>
#   e.g. .claude/scripts/full-suite.sh evidence/D02 t2.5-recordPositionChange browser-1
# With a stage, runs only that stage, so each stage fits in one foreground Bash call
# (the whole suite takes longer than the Bash tool's 10-minute limit). Without one,
# runs all five in order (unit, integration, browser-1, browser-2, checks), the full browser tier.
# Browser tiers (decisions P55 and 98):
#   browser-1     half of the full tier: npm run test:e2e:1 (e2e/d1, d2, d4), writing <label>-browser-1.txt.
#   browser-2     the other half: npm run test:e2e:2 (e2e/d5 onward), writing <label>-browser-2.txt.
#                 The two run one after the other (both use port 5175); a plain `browser` stage no longer exists.
#   browser-task  the task tier: the @every-task tests over the test:e2e:1 and :2 folders, then the
#                 current deliverable's own e2e folder when it exists (derived from the
#                 evidence folder, e.g. evidence/D06 -> e2e/d6; TJ_E2E_CURRENT overrides it).
#                 Both playwright calls write to the one browser file, each ending in its
#                 own EXIT line, and the summary adds up their counts.
#   browser-auto  picks the full tier when `git diff --name-only <base> HEAD` touches a path
#                 on P55's list, the task tier otherwise; prints the tier and why.
#                 Task tier: runs it (one call, writing <label>-browser.txt).
#                 Full tier: runs nothing. It prints "browser tier: full (...)" and "next: run
#                 stages browser-1 and browser-2", and the caller makes those two calls.
# Unit-test files (*.test.ts, *.test.tsx) never pick the full tier.
# Read-only queries (print and exit; nothing runs and no evidence is written):
#   .claude/scripts/full-suite.sh --current-folder <evidence-dir>   the derived e2e folder
#   .claude/scripts/full-suite.sh --choose-tier <base>              "task" or "full: <path>"
# A trailing /suite-runs on <evidence-dir> is ignored, so it is never doubled.
# Writes <evidence-dir>/suite-runs/<label>-{unit,integration,browser-1,browser-2,checks}.txt
# (full tier) or <label>-{unit,integration,browser,checks}.txt (task tier)
# and prints a short summary. Exits non-zero if any command failed.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2

usage() {
  echo "usage: $0 <evidence-dir> <label> [unit|integration|browser-1|browser-2|browser-task|checks]" >&2
  echo "       $0 <evidence-dir> <label> browser-auto <base>" >&2
  echo "       $0 --current-folder <evidence-dir>" >&2
  echo "       $0 --choose-tier <base>" >&2
  exit 2
}

# evidence/D06 -> e2e/d6, evidence/D05R -> e2e/d5r, evidence/D06P -> e2e/d6p
current_folder() { # evidence-dir
  local name=${1%/}
  name=$(basename "${name%/suite-runs}")
  [[ "$name" =~ ^D0*([0-9]+)([A-Za-z0-9]*)$ ]] || { echo "cannot derive an e2e folder from: $1" >&2; return 2; }
  echo "e2e/d${BASH_REMATCH[1]}$(echo "${BASH_REMATCH[2]}" | tr '[:upper:]' '[:lower:]')"
}

# Decision P55's path rule: prints "task", or "full: <first matching path>".
choose_tier() { # base
  git rev-parse --verify --quiet "$1^{commit}" >/dev/null || { echo "unknown base commit: $1" >&2; return 2; }
  local paths p
  paths=$(git -c core.quotePath=false diff --no-renames --name-only "$1" HEAD) || return 2
  while IFS= read -r p; do
    case "$p" in
      *.test.ts|*.test.tsx) continue ;; # decision 98: a Vitest file can't change what the browser sees
    esac
    case "$p" in
      src/ui/*|src/app/*|src/sw/*|src/delivery/*|src/persistence/*|src/main.tsx|*.css|index.html|e2e/*|\
      playwright.config.ts|vite.config.ts|package.json|package-lock.json|tools/release*.ts|tools/build-releases.ts)
        echo "full: $p"; return 0 ;;
    esac
  done <<<"$paths"
  echo task
}

case "${1:-}" in
  --current-folder) [[ $# -eq 2 ]] || usage; current_folder "$2"; exit $? ;;
  --choose-tier) [[ $# -eq 2 ]] || usage; choose_tier "$2"; exit $? ;;
esac

[[ $# -eq 2 || $# -eq 3 || ( $# -eq 4 && "${3:-}" == browser-auto ) ]] || usage
stage=${3:-}
case "$stage" in
  ''|unit|integration|browser-1|browser-2|browser-task|checks) [[ $# -le 3 ]] || usage ;;
  browser-auto) [[ $# -eq 4 ]] || usage ;;
  browser) echo "the stage browser no longer exists (decision 98, revision 65): run the full browser tier as two calls, browser-1 and then browser-2" >&2; exit 2 ;;
  *) echo "unknown stage: $stage (expected unit, integration, browser-1, browser-2, browser-task, browser-auto or checks)" >&2; exit 2 ;;
esac
# Accept evidence/D02, evidence/D02/, or evidence/D02/suite-runs alike.
dir=${1%/}
dir=${dir%/suite-runs}
out="$dir/suite-runs"
label=$2
mkdir -p "$out"
summary='Test Files |^ *Tests |^ *[0-9]+ (passed|failed|skipped|flaky|did not run)'
failed=0

echo "date: $(date '+%Y-%m-%d %H:%M %Z')"
echo "commit: $(git rev-parse --short HEAD)$( [[ -n $(git status --porcelain) ]] && echo ' + uncommitted changes')"

want() { [[ -z "$stage" || "$stage" == "$1" ]]; }

suite() { # name, command
  want "$1" || return 0
  local file="$out/$label-$1.txt"
  : >"$file"
  bash -c "$2" >"$file" 2>&1
  local ec=$?
  echo "EXIT $ec" >>"$file"
  (( ec == 0 )) || failed=1
  echo "== $1: \`$2\` exit $ec -> $file"
  grep -E "$summary" "$file" | tail -4
}

browser_task() {
  local file="$out/$label-browser.txt" folders current cmd1 cmd2="" ec1 ec2=0
  read -ra folders < <(node -p 'const s = require("./package.json").scripts; [s["test:e2e:1"], s["test:e2e:2"]].join(" ").split(/\s+/).filter(t => /^e2e\//.test(t)).join(" ")')
  (( ${#folders[@]} > 0 )) || { echo "no e2e folders found in the test:e2e:1 and test:e2e:2 scripts" >&2; exit 2; }
  current=${TJ_E2E_CURRENT:-}
  if [[ -z "$current" ]]; then current=$(current_folder "$dir") || exit 2; fi
  cmd1="npm run build:faults && npm run build:releases && npx playwright test ${folders[*]} --grep @every-task"
  [[ -d "$current" ]] && cmd2="npx playwright test $(printf '%q' "$current") --grep-invert \"@every-task|@release-history\""

  echo "\$ $cmd1" >"$file"
  bash -c "$cmd1" >>"$file" 2>&1
  ec1=$?
  echo "EXIT $ec1" >>"$file"
  if [[ -n "$cmd2" ]]; then
    echo "\$ $cmd2" >>"$file"
    bash -c "$cmd2" >>"$file" 2>&1
    ec2=$?
    echo "EXIT $ec2" >>"$file"
  fi
  (( ec1 == 0 && ec2 == 0 )) || failed=1
  echo "== browser-task: \`$cmd1\` exit $ec1 -> $file"
  if [[ -n "$cmd2" ]]; then echo "== browser-task: \`$cmd2\` exit $ec2"; else echo "== browser-task: no $current folder, only the @every-task call ran"; fi
  awk '/^ *[0-9]+ (passed|failed|skipped|flaky|did not run)/ { n = $1; $1 = ""; k = $0; sub(/ *\(.*/, "", k); sub(/^ +/, "", k); t[k] += n }
       END { for (k in t) printf "  %d %s\n", t[k], k }' "$file" | sort -k2
}

case "$stage" in
  browser-task) browser_task ;;
  browser-auto)
    tier=$(choose_tier "$4") || exit 2
    if [[ "$tier" == task ]]; then
      echo "browser tier: task (no changed path since $4 is on the full-tier list)"
      browser_task
    else
      echo "browser tier: full (first matching path since $4: ${tier#full: })"
      echo "next: run stages browser-1 and browser-2, one after the other (nothing ran here)"
    fi
    ;;
esac

suite unit 'npx vitest run src --reporter=verbose'
suite integration 'npx vitest run tests/integration --reporter=verbose'
suite browser-1 'npm run test:e2e:1'
suite browser-2 'npm run test:e2e:2'

want checks || exit $failed

checks=("npm run typecheck" "npx tsc6 --noEmit" "npm run lint" "npm run lint:deps" "npm run build")
while read -r s; do checks+=("npm run $s"); done < <(node -p 'Object.keys(require("./package.json").scripts).filter(k => k.startsWith("verify:")).join("\n")')

file="$out/$label-checks.txt"
: >"$file"
passed=0
echo "== checks -> $file"
for c in "${checks[@]}"; do
  echo "\$ $c" >>"$file"
  bash -c "$c" >>"$file" 2>&1
  ec=$?
  echo "EXIT $ec" >>"$file"
  if (( ec == 0 )); then passed=$((passed + 1)); else failed=1; echo "FAILED: $c (exit $ec)"; fi
done
echo "$passed of ${#checks[@]} exit 0: $(IFS=,; echo "${checks[*]}" | sed "s/,/, /g")"

exit $failed
