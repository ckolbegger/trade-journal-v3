#!/usr/bin/env bash
# Checks that a cumulative run's four stage files are all finished.
# Usage: run-complete.sh <evidence-dir> <label>
# Prints one line per stage and exits 0 only when every stage file exists,
# ends with an "EXIT n" line, and has an EXIT line for every command it started
# (full-suite.sh writes "$ <command>" before each command in a multi-command file).
set -u
dir="$1/suite-runs"; label="$2"; incomplete=0
for stage in unit integration browser checks; do
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
