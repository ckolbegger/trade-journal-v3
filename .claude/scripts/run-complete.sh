#!/usr/bin/env bash
# Checks that a cumulative run's stage files are all finished.
# Usage: run-complete.sh <evidence-dir> <label>
# A full-tier run has five files (unit, integration, browser-1, browser-2, checks); a task-tier
# run, or a run made before decision 98's revision 65, has four (unit, integration, browser, checks).
# The tier is read from the files: if either browser-1 or browser-2 exists, both are required;
# otherwise the single browser file is. Prints one line per stage and exits 0 only when every
# stage file exists, ends with an "EXIT n" line, and has an EXIT line for every command it
# started (full-suite.sh writes "$ <command>" before each command in a multi-command file).
set -u
dir="$1/suite-runs"; label="$2"; incomplete=0
if [[ -f "$dir/$label-browser-1.txt" || -f "$dir/$label-browser-2.txt" ]]; then
  stages=(unit integration browser-1 browser-2 checks)
else
  stages=(unit integration browser checks)
fi
for stage in "${stages[@]}"; do
  f="$dir/$label-$stage.txt"
  if [[ ! -f "$f" ]]; then echo "$stage: missing ($f)"; incomplete=1; continue; fi
  started=$(grep -c '^\$ ' "$f"); (( started < 1 )) && started=1
  exits=$(grep -c '^EXIT ' "$f")
  last=$(grep -v '^[[:space:]]*$' "$f" | tail -1)
  if [[ "$last" == EXIT* ]] && (( exits >= started )); then
    echo "$stage: finished ($(grep '^EXIT ' "$f" | tr '\n' ' '))"
  else
    echo "$stage: still running or cut off ($exits of $started commands finished)"; incomplete=1
  fi
done
(( incomplete == 0 )) && echo "run complete" || echo "run INCOMPLETE"
exit $incomplete
