#!/bin/bash
# Test of with-browser-lock.sh. Case: it should let only one of two callers that find the same dead
# holder take the lock, while the other waits for it.
# Two callers both read the dead PID and pause (TJ_BROWSER_LOCK_PAUSE) before the takeover. The first
# is released and runs a 3 s command; the second is released while it runs and must not start until
# the first has finished, and the first's lock must still be in place meanwhile.
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
export TJ_BROWSER_LOCK_DIR="$t/lock"
mkdir "$TJ_BROWSER_LOCK_DIR"
sleep 0 & dead=$!; wait $dead
echo "$dead" >"$TJ_BROWSER_LOCK_DIR/pid"

TJ_BROWSER_LOCK_PAUSE="$t/a" "$here/with-browser-lock.sh" bash -c "echo a-start >>$t/log; sleep 3; echo a-end >>$t/log" 2>"$t/a.err" &
pa=$!
TJ_BROWSER_LOCK_PAUSE="$t/b" "$here/with-browser-lock.sh" bash -c "echo b-start >>$t/log; echo b-end >>$t/log" 2>"$t/b.err" &
pb=$!
for _ in $(seq 200); do
  ls "$t"/a.reached.* "$t"/b.reached.* >/dev/null 2>&1 && break
  sleep 0.05
done
ra=$(ls "$t"/a.reached.* 2>/dev/null | head -1); rb=$(ls "$t"/b.reached.* 2>/dev/null | head -1)
[[ -n "$ra" && -n "$rb" ]] || { echo "FAIL: callers did not both reach the takeover (setup)"; kill $pa $pb 2>/dev/null; exit 1; }
: >"$t/a.go.${ra##*.}"
for _ in $(seq 200); do grep -q a-start "$t/log" 2>/dev/null && break; sleep 0.05; done
: >"$t/b.go.${rb##*.}"
sleep 1
fail=0
grep -q b-start "$t/log" && { echo "FAIL: second caller ran while the first held the lock"; fail=1; }
[[ -d "$TJ_BROWSER_LOCK_DIR" ]] || { echo "FAIL: the first caller's lock was removed"; fail=1; }
wait $pa $pb
[[ "$(tr '\n' ' ' <"$t/log")" == "a-start a-end b-start b-end " ]] || { echo "FAIL: order was: $(tr '\n' ' ' <"$t/log")"; fail=1; }
(( fail )) || echo "PASS: one takeover, the other waited"
exit $fail
