#!/usr/bin/env bash
# Checks that each command in a breakdown's "Acceptance matrix rows" table names real tests.
# Usage: acceptance-commands.sh <breakdown.md>
# Only list mode runs: `vitest list` and `playwright test --list`. Tests and builds never run,
# other `npm run <script>` commands are checked only for presence in package.json, and no file
# is written. Cells with no command are "procedure, not checked"; "as <ID>" reuses that row's
# commands. Prints one line per row and command, then a summary. Exits 1 if any row failed.
set -u
file="${1:-}"
if [[ -z "$file" ]]; then echo "usage: acceptance-commands.sh <breakdown.md>" >&2; exit 2; fi
if [[ ! -f "$file" ]]; then echo "acceptance-commands.sh: no such file: $file" >&2; exit 2; fi
# Resolve against the caller's directory before changing to the repository root.
file="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"
root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$(pwd)
cd "$root" || exit 2

# One "scenario<TAB>command cell" line per data row of the table in the "## <n>. Acceptance matrix rows" section.
rows=$(awk '
  /^## [0-9]+\. Acceptance matrix rows/ { insec = 1; next }
  insec && /^## / { exit }
  insec && /^\|/ {
    n = split($0, c, "|")
    if (!col) {
      for (i = 2; i < n; i++) { h = c[i]; gsub(/^ +| +$/, "", h); if (h == "Command or procedure") col = i }
      next
    }
    if (c[2] ~ /^[ :-]+$/) next
    s = c[2]; gsub(/^ +| +$/, "", s)
    printf "%s\t%s\n", s, c[col]
  }' "$file")
if [[ -z "$rows" ]]; then echo "no acceptance table with a \"Command or procedure\" column found in $file" >&2; exit 2; fi

# Backticked commands (npm run ... or npx ...) in a cell, one per line.
commands_of() { printf '%s' "$1" | grep -oE '`(npm run|npx) [^`]*`' | tr -d '`'; }

# Splits text into the array SPLIT the way a shell would for quotes and backslashes, but evaluates
# nothing: no globbing, no $(...), no backticks. The table is data, never code.
split_args() {
  SPLIT=(); local s="$1" i ch nx cur="" q="" have=0 bs='\'
  for (( i = 0; i < ${#s}; i++ )); do
    ch="${s:i:1}"
    if [[ -n "$q" ]]; then
      nx="${s:i+1:1}"
      if [[ "$ch" == "$q" ]]; then q=""
      elif [[ "$q" == '"' && "$ch" == "$bs" && ( "$nx" == '"' || "$nx" == "$bs" || "$nx" == '$' || "$nx" == '`' ) ]]; then cur+="$nx"; i=$((i + 1))
      else cur+="$ch"; fi
    else
      case "$ch" in
        "'"|'"') q="$ch"; have=1 ;;
        "$bs") i=$((i + 1)); cur+="${s:i:1}"; have=1 ;;
        " "|$'\t') if (( have )); then SPLIT+=("$cur"); cur=""; have=0; fi ;;
        *) cur+="$ch"; have=1 ;;
      esac
    fi
  done
  if (( have )); then SPLIT+=("$cur"); fi
}

run_list() { # prints "N tests" or "FAIL: reason"
  local cmd="$1" out rc n
  case "$cmd" in
    "npm run test:integration"|"npm run test:integration -- "*|"npm run test:unit"|"npm run test:unit -- "*)
      # Bare form: the whole project. Filtered form: only the filters after "-- ".
      local proj=integration filters=""; [[ "$cmd" == "npm run test:unit"* ]] && proj=unit
      [[ "$cmd" == *" -- "* ]] && filters="${cmd#*-- }"
      split_args "$filters"
      out=$(CLAUDE_FULL_OUTPUT=1 npx vitest list --project "$proj" ${SPLIT[@]+"${SPLIT[@]}"} 2>&1); rc=$?
      if (( rc != 0 )); then echo "FAIL: vitest list exited $rc"; return; fi
      n=$(printf '%s\n' "$out" | grep -c '^\[') ;;
    "npm run test:e2e"|"npm run test:e2e:1"|"npm run test:e2e:2")
      # Bare form: the folders and --grep-invert that package.json's script names (read as text, never run).
      local scripts=("${cmd#npm run }") s sargs sn; n=0
      [[ "$cmd" == "npm run test:e2e" ]] && scripts=(test:e2e:1 test:e2e:2)
      for s in "${scripts[@]}"; do
        sargs=$(node -e 'const s = JSON.parse(require("fs").readFileSync("package.json", "utf8")).scripts[process.argv[1]] || ""; const m = s.match(/playwright test (.*)$/); process.stdout.write(m ? m[1] : "")' "$s")
        if [[ -z "$sargs" ]]; then echo "FAIL: no playwright command in script $s"; return; fi
        split_args "$sargs"
        out=$(CLAUDE_FULL_OUTPUT=1 npx playwright test --list ${SPLIT[@]+"${SPLIT[@]}"} 2>&1); rc=$?
        sn=$(printf '%s\n' "$out" | sed -n 's/^Total: \([0-9][0-9]*\) test.*/\1/p' | tail -1)
        if (( rc != 0 )); then echo "FAIL: playwright --list exited $rc ($s)"; return; fi
        n=$((n + ${sn:-0}))
      done ;;
    "npx playwright test "*|"npm run test:e2e"*" -- "*)
      local args="${cmd#npx playwright test }"; [[ "$cmd" == "npm run"* ]] && args="${cmd#*-- }"
      split_args "$args"
      out=$(CLAUDE_FULL_OUTPUT=1 npx playwright test --list ${SPLIT[@]+"${SPLIT[@]}"} 2>&1); rc=$?
      n=$(printf '%s\n' "$out" | sed -n 's/^Total: \([0-9][0-9]*\) test.*/\1/p' | tail -1)
      if (( rc != 0 )) && [[ "${n:-0}" == 0 ]]; then echo "FAIL: playwright --list exited $rc, no tests"; return; fi
      if (( rc != 0 )); then echo "FAIL: playwright --list exited $rc"; return; fi
      n=${n:-0} ;;
    "npm run "*)
      local script; script=$(printf '%s' "${cmd#npm run }" | cut -d' ' -f1)
      # Exact name, looked up only in the "scripts" object (no regex, top-level keys do not count).
      if node -e 'const s = JSON.parse(require("fs").readFileSync("package.json", "utf8")).scripts; process.exit(s && Object.hasOwn(s, process.argv[1]) ? 0 : 1)' "$script"; then echo "script present"; else echo "FAIL: no such npm script"; fi
      return ;;
    *) echo "FAIL: unrecognized command form"; return ;;
  esac
  if (( n == 0 )); then echo "FAIL: 0 tests"; else echo "$n tests"; fi
}

failed=0; total=0; unchecked=0
while IFS=$'\t' read -r scenario cell; do
  cmds=$(commands_of "$cell")
  if [[ -z "$cmds" ]]; then
    ref=$(printf '%s' "$cell" | sed -n 's/^ *as \([A-Z][A-Za-z0-9-]*\) *$/\1/p')
    if [[ -n "$ref" ]]; then
      refcell=$(printf '%s\n' "$rows" | awk -F'\t' -v id="$ref" '{ s=$1; sub(/ .*/, "", s); sub(/,$/, "", s); if (s == id) { print $2; exit } }')
      cmds=$(commands_of "$refcell")
    fi
  fi
  if [[ -z "$cmds" ]]; then
    printf '%s | - | procedure, not checked\n' "$scenario"; unchecked=$((unchecked + 1)); continue
  fi
  while IFS= read -r cmd; do
    result=$(run_list "$cmd"); total=$((total + 1))
    [[ "$result" == FAIL* ]] && failed=$((failed + 1))
    printf '%s | %s | %s\n' "$scenario" "$cmd" "$result"
  done <<< "$cmds"
done <<< "$rows"
echo "summary: $total commands checked, $failed failed, $unchecked rows are procedures, not checked"
(( failed == 0 ))
