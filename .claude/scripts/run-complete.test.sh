#!/bin/bash
# Test of run-complete.sh, on scratch evidence directories with hand-made stage files in the format
# full-suite.sh writes (an "EXIT n" line after each command, "$ <command>" lines in the checks file).
# Main case: it should report run INCOMPLETE for a run with unit, integration and checks files but no
# browser file and no lane marker (the browser stage never ran, so it is not a lane tier).
# Also checks: a lane-tier run (the <label>-lane.txt marker full-suite.sh writes) still reports run
# complete, and what must keep working: the full tier (5 files) and the task tier (4 files) report run
# complete when finished and run INCOMPLETE when a file is missing or a command is unfinished.
here=$(cd "$(dirname "$0")" && pwd)
rc="$here/run-complete.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }

# mk <case> <label> <stage>...: a finished stage file for each stage named (checks has two commands).
mk() {
  local d="$t/$1/suite-runs" label=$2; shift 2
  mkdir -p "$d"
  for s in "$@"; do
    if [[ $s == checks ]]; then printf '$ npm run typecheck\nok\nEXIT 0\n$ npm run lint\nok\nEXIT 0\n' >"$d/$label-$s.txt"
    else printf 'Test Files  1 passed (1)\nEXIT 0\n' >"$d/$label-$s.txt"; fi
  done
}
# verdict <case> <label>: runs the script, sets out and code.
verdict() { out=$("$rc" "$t/$1" "$2" 2>&1); code=$?; }

# Main case: no browser file and no lane marker.
mk nobrowser x unit integration checks
verdict nobrowser x
[[ $code != 0 && "$out" == *"run INCOMPLETE"* ]] || bad "a run with no browser file and no lane marker was not reported INCOMPLETE: $out"
[[ "$out" == *"browser: missing"* ]] || bad "the missing browser file was not named: $out"

# A lane-tier run, marked as full-suite.sh marks it, is complete with three files.
mk lane x unit integration checks
echo "TIER lane" >"$t/lane/suite-runs/x-lane.txt"
verdict lane x
[[ $code == 0 && "$out" == *"run complete"* ]] || bad "a marked lane-tier run was not reported complete: $out"
# A lane marker does not excuse an unfinished stage.
printf '$ npm run lint\n' >"$t/lane/suite-runs/x-checks.txt"
verdict lane x
[[ $code != 0 && "$out" == *"run INCOMPLETE"* ]] || bad "a marked lane-tier run with a cut-off stage was not reported INCOMPLETE: $out"

# The full tier (5 files) and the task tier (4 files) still work.
mk full x unit integration browser-1 browser-2 checks
verdict full x
[[ $code == 0 && "$out" == *"run complete"* ]] || bad "a finished full-tier run was not reported complete: $out"
rm "$t/full/suite-runs/x-browser-2.txt"
verdict full x
[[ $code != 0 && "$out" == *"browser-2: missing"* ]] || bad "a full-tier run missing browser-2 was not reported INCOMPLETE: $out"
mk task x unit integration browser checks
verdict task x
[[ $code == 0 && "$out" == *"run complete"* ]] || bad "a finished task-tier run was not reported complete: $out"
rm "$t/task/suite-runs/x-integration.txt"
verdict task x
[[ $code != 0 && "$out" == *"integration: missing"* ]] || bad "a task-tier run missing integration was not reported INCOMPLETE: $out"
mk task2 x unit integration browser checks
printf '$ npx playwright test\n' >"$t/task2/suite-runs/x-browser.txt"
verdict task2 x
[[ $code != 0 && "$out" == *"run INCOMPLETE"* ]] || bad "a task-tier run with an unfinished browser file was not reported INCOMPLETE: $out"

(( fail == 0 )) && echo "PASS: run-complete.sh reads the lane tier only from its marker"
exit $fail
