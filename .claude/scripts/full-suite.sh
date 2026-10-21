#!/bin/bash
# Runs the complete cumulative suite and writes the full outputs as evidence.
# Usage: .claude/scripts/full-suite.sh <evidence-dir> <label>
#   e.g. .claude/scripts/full-suite.sh evidence/D02 t2.5-recordPositionChange
# A trailing /suite-runs on <evidence-dir> is ignored, so it is never doubled.
# Writes <evidence-dir>/suite-runs/<label>-{unit,integration,browser,checks}.txt
# and prints a short summary. Exits non-zero if any command failed.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
[[ $# -eq 2 ]] || { echo "usage: $0 <evidence-dir> <label>" >&2; exit 2; }
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

suite() { # name, command
  local file="$out/$label-$1.txt"
  bash -c "$2" >"$file" 2>&1
  local ec=$?
  echo "EXIT $ec" >>"$file"
  (( ec == 0 )) || failed=1
  echo "== $1: \`$2\` exit $ec -> $file"
  grep -E "$summary" "$file" | tail -4
}

suite unit 'npx vitest run src --reporter=verbose'
suite integration 'npx vitest run tests/integration --reporter=verbose'
suite browser 'npm run test:e2e'

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
