#!/bin/zsh
# usage: tdd.sh red|green <task> <test file> <test name>
# Runs one test case and appends a row to evidence/D<nn>/tdd-log.md, where <nn> comes from the
# task ID (T2.2 -> D02, T12.4 -> D12).
phase=$1; task=$2; file=$3; name=$4
if [[ ! $task =~ '^T([0-9]+)\.' ]]; then print "task must look like T<n>.<m>, got: $task"; exit 2; fi
log=$(printf 'evidence/D%02d/tdd-log.md' $match[1])
if [[ ! -f $log ]]; then print "no log at $log: create it with its header note first"; exit 2; fi
out=$(npx vitest run "$file" -t "$name" 2>&1); code=$?
clean=$(print -r -- "$out" | sed $'s/\x1b\\[[0-9;]*m//g')
summary=$(print -r -- "$clean" | grep -E '^ +Tests ' | head -1 | sed 's/^ *//; s/ *([0-9.]*m\?s)//; s/ | /, /g')
err=$(print -r -- "$clean" | grep -E '^ *[A-Za-z]*Error:|^ *(Expected|Received)' | head -2 | tr '\n' ' ' | sed 's/|/\\|/g; s/  */ /g' | cut -c1-220)
print -r -- "$phase exit=$code | $summary | $err"
printf '| %s | %s | %s | `npx vitest run %s -t "%s"` | exit %s; %s | %s |\n' "$task" "$name" "$phase" "$file" "$name" "$code" "$summary" "$err" >> $log
if [[ $phase == red && $code == 0 ]]; then print "!!! RED PHASE PASSED: invalid red"; fi
if [[ $phase == green && $code != 0 ]]; then print -r -- "$clean" | tail -40; fi
