#!/bin/bash
# Test of with-browser-lock.sh. Main case: it should let only one of two callers that contend for the
# lock run at a time, including after a holder was killed with SIGKILL; the other waits, then runs.
# The lock is a kernel lock, so there is no takeover to stage; the test checks the property itself.
# Also checks what must keep working: the exit code, release on SIGTERM (143), reentrancy.
here=$(cd "$(dirname "$0")" && pwd)
lockw="$here/with-browser-lock.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
export TJ_BROWSER_LOCK_DIR="$t/lock"
fail=0
bad() { echo "FAIL: $*"; fail=1; }
waitfor() { for _ in $(seq 200); do eval "$1" && return 0; sleep 0.05; done; return 1; }

# A holder is killed with SIGKILL (its command is left to end by itself, and does not hold the lock).
"$lockw" bash -c "echo \$\$ >$t/h.child; sleep 30" 2>/dev/null &
holder=$!
waitfor "[[ -s $t/h.child ]]" || { echo "FAIL: holder did not start (setup)"; exit 1; }
kill -9 "$holder"; wait "$holder" 2>/dev/null
pkill -P "$(cat "$t/h.child")" 2>/dev/null; kill "$(cat "$t/h.child")" 2>/dev/null

# Two callers contend at once: one runs its 2 s command while the other waits, then runs.
for x in a b; do
  "$lockw" bash -c "echo $x-start >>$t/log; sleep 2; echo $x-end >>$t/log" 2>"$t/$x.err" &
  eval "p$x=\$!"
done
wait "$pa" "$pb"
log=$(tr '\n' ' ' <"$t/log")
[[ "$log" == "a-start a-end b-start b-end " || "$log" == "b-start b-end a-start a-end " ]] \
  || bad "the callers overlapped or one never ran: $log"
grep -q "waiting for the lock held by process" "$t/a.err" "$t/b.err" || bad "the waiting caller printed no waiting message"

# The command's exit code is passed through.
"$lockw" bash -c 'exit 7' 2>/dev/null; [[ $? == 7 ]] || bad "exit code 7 was not passed through"

# SIGTERM to the wrapper ends its command, exits 143 and releases the lock.
"$lockw" bash -c "echo \$\$ >$t/s.child; exec sleep 30" 2>/dev/null &
ps_=$!
waitfor "[[ -s $t/s.child ]]" || bad "SIGTERM case did not start (setup)"
kill -TERM "$ps_"; wait "$ps_"; code=$?
[[ $code == 143 ]] || bad "SIGTERM exit was $code, not 143"
"$lockw" true 2>/dev/null &
pq=$!
waitfor "! kill -0 $pq 2>/dev/null" || { bad "the lock was not released after SIGTERM"; kill "$pq"; }

# A command run inside the lock that wraps another command again does not deadlock.
"$lockw" "$lockw" bash -c "echo nested >$t/nested" 2>/dev/null &
pn=$!
waitfor "! kill -0 $pn 2>/dev/null" || { bad "nested wrapper deadlocked"; kill -9 "$pn"; }
[[ -s "$t/nested" ]] || bad "nested command did not run"

(( fail )) || echo "PASS: one caller at a time, also after a killed holder"
exit $fail
