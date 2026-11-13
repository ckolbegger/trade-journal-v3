#!/bin/zsh
# usage: tdd.sh red|green <task> <test file> <test name>
# Runs one test case and appends a row to evidence/D<nn>/tdd-log/<task>.md, one file per task
# (decision 111), where <nn> comes from the task ID (T2.2 -> D02, T12.4 -> D12, T5R.1 -> D05R,
# T5R2.1 -> D05R2). A bug or fix ID maps to its deliverable by its prefix and gets its own file
# (T8P.6-B1, T8P.6-B1-R1, T8P.6-F1). A new file starts with a header and the column header row
# copied from evidence/D<nn>/tdd-log.md, which must exist (it holds the note).
phase=$1; task=$2; file=$3; name=$4
if [[ ! $task =~ '^T([0-9]+)([A-Z][A-Z0-9]*)?\.' ]]; then print "task must look like T<n>.<m> or T<n><suffix>.<m> (suffix: an upper-case letter, then upper-case letters or digits), got: $task"; exit 2; fi
log=$(printf 'evidence/D%02d%s/tdd-log.md' $match[1] $match[2])
if [[ ! -f $log ]]; then print "no log at $log: create it with its header note first"; exit 2; fi
tasklog="${log%.md}/$task.md"
if [[ ! $task =~ '^[A-Za-z0-9._-]+$' ]]; then print "task ID may hold only letters, digits, dot, underscore and hyphen, got: $task"; exit 2; fi
if [[ ! -f $tasklog ]]; then
  mkdir -p ${log%.md}
  { print "# ${${log:h}:t} TDD log, $task"; print
    print "One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see \`../tdd-log.md\` for the rules."; print
    grep -m1 -A1 '^| Task |' $log; } > $tasklog
fi
out=$(npx vitest run "$file" -t "$name" 2>&1); code=$?
clean=$(print -r -- "$out" | sed $'s/\x1b\\[[0-9;]*m//g')
summary=$(print -r -- "$clean" | grep -E '^ +Tests ' | head -1 | sed 's/^ *//; s/ *([0-9.]*m\?s)//; s/ | /, /g')
err=$(print -r -- "$clean" | grep -E '^ *[A-Za-z]*Error:|^ *(Expected|Received)' | head -2 | tr '\n' ' ' | sed 's/|/\\|/g; s/  */ /g' | cut -c1-220)
print -r -- "$phase exit=$code | $summary | $err"
printf '| %s | %s | %s | `npx vitest run %s -t "%s"` | exit %s; %s | %s |\n' "$task" "$name" "$phase" "$file" "$name" "$code" "$summary" "$err" >> $tasklog
if [[ $phase == red && $code == 0 ]]; then print "!!! RED PHASE PASSED: invalid red"; fi
if [[ $phase == green && $code != 0 ]]; then print -r -- "$clean" | tail -40; fi
