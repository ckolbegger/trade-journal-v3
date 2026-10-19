#!/bin/bash
# Prints the part of a test run's log worth reading: the summary on success,
# the failure section plus the summary on failure. Used by filter-test-output.sh.
log=$1
ec=$2
summary='Test Files |^ *Tests |^ *[0-9]+ (passed|failed|skipped|flaky|did not run)|Duration '

if [[ "$ec" -eq 0 ]]; then
  lines=$(grep -E "$summary" "$log" | tail -10)
  [[ -n "$lines" ]] && echo "$lines" || tail -5 "$log"
else
  # Vitest: "Failed Tests N" section. Playwright: numbered failures "  1) [chromium] ›".
  start=$(grep -nE 'Failed Tests [0-9]+|^ +1\) ' "$log" | head -1 | cut -d: -f1)
  if [[ -n "$start" ]]; then
    if (( $(tail -n +"$start" "$log" | wc -l) <= 300 )); then
      tail -n +"$start" "$log"
    else
      tail -n +"$start" "$log" | head -250
      echo "... (failure section truncated; see the full log)"
      grep -E "$summary" "$log" | tail -10
    fi
  else
    tail -100 "$log"
  fi
fi
echo "[test-output-filter] exit $ec; full output ($(wc -l <"$log" | tr -d ' ') lines): $log"
