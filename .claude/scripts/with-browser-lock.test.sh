#!/bin/bash
# Test of with-browser-lock.sh. Main case: it should let only one of two callers that contend for the
# lock run at a time, including after a holder was killed with SIGKILL; the other waits, then runs.
# The lock is a kernel lock, so there is no takeover to stage; the test checks the property itself.
# Also checks what must keep working: the exit code, release on SIGTERM (143), reentrancy, and that
# SIGTERM ends every descendant (also one in its own process group), KILLs a TERM-ignoring command (137),
# handles a TERM before the command has started, and fails fast on a lock it cannot take.
# Every wait on a caller is bounded, so a regression fails the test instead of hanging it.
here=$(cd "$(dirname "$0")" && pwd)
lockw="$here/with-browser-lock.sh"
t=$(mktemp -d)
# Leave no process of any case running: kill every PID the cases recorded, and their groups.
cleanup() {
  for f in "$t"/*.child "$t"/*.pid; do
    [[ -s "$f" ]] || continue
    p=$(cat "$f"); [[ "$p" =~ ^[0-9]+$ ]] || continue
    kill -9 -- "-$p" "$p" 2>/dev/null; pkill -9 -P "$p" 2>/dev/null
  done
  rm -rf "$t"
}
trap cleanup EXIT
export TJ_BROWSER_LOCK_DIR="$t/lock"
fail=0
bad() { echo "FAIL: $*"; fail=1; }
# waitfor <condition> [seconds, default 10]: true once the condition holds, false when the time is up.
waitfor() { for _ in $(seq $(( ${2:-10} * 20 ))); do eval "$1" && return 0; sleep 0.05; done; return 1; }
# bwait <pid> <seconds>: succeeds when the background caller ends in time; otherwise kills it and fails.
bwait() { waitfor "! kill -0 $1 2>/dev/null" "$2" && return 0; kill -9 "$1" 2>/dev/null; return 1; }

# A holder is killed with SIGKILL; the next caller runs while the holder's command is still running,
# so a lock leaked to the command would be caught.
"$lockw" bash -c "echo \$\$ >$t/h.child; sleep 30" 2>/dev/null &
holder=$!
waitfor "[[ -s $t/h.child ]]" || { echo "FAIL: holder did not start (setup)"; exit 1; }
kill -9 "$holder"; wait "$holder" 2>/dev/null
hc=$(cat "$t/h.child")
"$lockw" bash -c "echo ran >$t/h.next" 2>/dev/null &
pn0=$!
bwait "$pn0" 5 || bad "the next caller did not run while the killed holder's command was still running"
[[ -s "$t/h.next" ]] || bad "the next caller's command did not run after the holder was killed"
kill -0 "$hc" 2>/dev/null || bad "the killed holder's command ended before the next caller finished (setup)"
kill "$hc" 2>/dev/null; pkill -P "$hc" 2>/dev/null

# Two callers contend at once: one runs its 2 s command while the other waits, then runs.
for x in a b; do
  "$lockw" bash -c "echo $x-start >>$t/log; sleep 2; echo $x-end >>$t/log" 2>"$t/$x.err" &
  eval "p$x=\$!"
done
bwait "$pa" 20 || bad "caller a never finished"
bwait "$pb" 20 || bad "caller b never finished"
log=$(tr '\n' ' ' <"$t/log")
[[ "$log" == "a-start a-end b-start b-end " || "$log" == "b-start b-end a-start a-end " ]] \
  || bad "the callers overlapped or one never ran: $log"
grep -q "waiting for the lock held by process" "$t/a.err" "$t/b.err" || bad "the waiting caller printed no waiting message"

# The command's exit code is passed through.
"$lockw" bash -c 'exit 7' 2>/dev/null &
p7=$!
bwait "$p7" 10 || bad "the exit-code caller never finished"
wait "$p7"; [[ $? == 7 ]] || bad "exit code 7 was not passed through"

# SIGTERM to the wrapper ends its command, exits 143 and releases the lock.
"$lockw" bash -c "echo \$\$ >$t/s.child; exec sleep 30" 2>/dev/null &
ps_=$!
waitfor "[[ -s $t/s.child ]]" || bad "SIGTERM case did not start (setup)"
kill -TERM "$ps_"
bwait "$ps_" 10 || bad "wrapper did not exit after SIGTERM (exit code case)"
wait "$ps_"; code=$?
[[ $code == 143 ]] || bad "SIGTERM exit was $code, not 143"
"$lockw" true 2>/dev/null &
pq=$!
bwait "$pq" 5 || bad "the lock was not released after SIGTERM"

# SIGTERM to the wrapper ends every descendant of the command, not only the command, before the lock is released.
"$lockw" sh -c "sleep 60 & echo \$! >$t/g.pid; wait" 2>/dev/null &
pg=$!
waitfor "[[ -s $t/g.pid ]]" || bad "grandchild case did not start (setup)"
gc=$(cat "$t/g.pid" 2>/dev/null)
kill -TERM "$pg"
bwait "$pg" 10 || bad "wrapper did not exit after SIGTERM (grandchild case)"
"$lockw" sh -c "kill -0 $gc 2>/dev/null && echo alive >$t/g.alive" 2>/dev/null &
pq2=$!
bwait "$pq2" 5 || bad "second caller never got the lock (grandchild case)"
[[ -e "$t/g.alive" ]] && bad "a grandchild of the command outlived the wrapper's SIGTERM and the lock was released"
kill -9 "$gc" 2>/dev/null

# SIGTERM to the wrapper ends a descendant that moved to its own process group and session, before the lock is released.
cat >"$t/detach.pl" <<'EOF'
use POSIX (); POSIX::setsid(); open(my $f, ">", $ARGV[0]) or die; print $f $$; close $f; exec "sleep", "60";
EOF
"$lockw" sh -c "/usr/bin/perl $t/detach.pl $t/d.pid & wait" 2>/dev/null &
pd=$!
waitfor "[[ -s $t/d.pid ]]" || bad "detached-descendant case did not start (setup)"
dp=$(cat "$t/d.pid" 2>/dev/null)
kill -TERM "$pd"
bwait "$pd" 10 || bad "wrapper did not exit after SIGTERM (detached-descendant case)"
kill -0 "$dp" 2>/dev/null && bad "a descendant in its own process group outlived the wrapper's SIGTERM and the lock was released"

# A command that ignores TERM is KILLed once the grace period has passed: no process of it is left, the
# wrapper exits 137 (128 plus KILL), and the lock is released.
TJ_BROWSER_LOCK_GRACE=1 "$lockw" sh -c "trap '' TERM; echo \$\$ >$t/i.pid; while :; do sleep 1; done" 2>/dev/null &
pi=$!
waitfor "[[ -s $t/i.pid ]]" || bad "TERM-ignoring case did not start (setup)"
ip=$(cat "$t/i.pid" 2>/dev/null)
kill -TERM "$pi"
bwait "$pi" 10 || bad "wrapper did not exit after SIGTERM to a command that ignores it"
wait "$pi"; code=$?
[[ $code == 137 ]] || bad "exit after SIGTERM to a command that ignores it was $code, not 137"
left=$(ps -axo pid=,pgid= | awk -v g="$ip" '$1==g || $2==g {n++} END{print n+0}')
[[ $left == 0 ]] || bad "$left process(es) of the TERM-ignoring command were still running after the wrapper exited"
"$lockw" true 2>/dev/null &
pq3=$!
bwait "$pq3" 5 || bad "the lock was not released after SIGTERM to a command that ignores it"

# A TERM that reaches the wrapper before the command has started (the child is held between fork and exec
# by the test-only pause) exits 143, never runs the command, and releases the lock.
TJ_BROWSER_LOCK_TEST_CHILD_PAUSE=1.5 "$lockw" bash -c "echo \$\$ >$t/e.pid; sleep 30" 2>/dev/null &
pe=$!
waitfor "[[ \$(cat $t/lock 2>/dev/null) == $pe ]]" 5 || bad "early-TERM case did not start (setup)"
sleep 0.3
kill -TERM "$pe"
if bwait "$pe" 4; then
  wait "$pe"; code=$?
  [[ $code == 143 ]] || bad "exit after a TERM before the command started was $code, not 143"
else
  bad "wrapper did not exit after a TERM before the command started"
  sleep 1.5   # let the held command start, so the cleanup finds its PID
fi
[[ -e "$t/e.pid" ]] && bad "the command ran although it was TERMed before it started"
"$lockw" true 2>/dev/null &
pq4=$!
bwait "$pq4" 5 || bad "the lock was not released after a TERM before the command started"

# A TERM that reaches the wrapper and the command together (the signal to a whole process group) while the
# wrapper is between the fork and its setpgrp, and the command is still held before its exec, exits 143 and
# never runs the command. The wrapper holds both signals pending (blocked): without that the command would
# take the signal through the wrapper's handler, which it inherits at the fork, and run on regardless.
TJ_BROWSER_LOCK_TEST_CHILD_PAUSE=1 TJ_BROWSER_LOCK_TEST_PARENT_PAUSE=2 \
  /usr/bin/perl -e 'use POSIX (); POSIX::setsid(); exec @ARGV' "$lockw" bash -c "echo \$\$ >$t/m.pid; sleep 30" 2>/dev/null &
pm=$!
waitfor "[[ \$(cat $t/lock 2>/dev/null) == $pm ]]" 5 || bad "masked-window case did not start (setup)"
sleep 0.3
kill -TERM -- "-$pm"
if bwait "$pm" 6; then
  wait "$pm"; code=$?
  [[ $code == 143 ]] || bad "exit after a TERM between the fork and the wrapper's setpgrp was $code, not 143"
else
  bad "wrapper did not exit after a TERM between the fork and its setpgrp"
  sleep 2   # let the held command start, so the cleanup finds its PID
fi
[[ -e "$t/m.pid" ]] && bad "the command ran although a TERM arrived between the fork and the wrapper's setpgrp"
"$lockw" true 2>/dev/null &
pq5=$!
bwait "$pq5" 5 || bad "the lock was not released after a TERM between the fork and the wrapper's setpgrp"

# A descendant that detached and lost its parent before the signal (it is a child of PID 1 and outside the
# command's group) is ended before the lock is released. Two ways it can have got there: its parent lived
# for a while (found by the periodic scan), or died at once and the descendant is a node process that
# carries the wrapper's environment token.
cat >"$t/orphan.pl" <<'EOF'
use POSIX (); POSIX::setsid();
my $k = fork(); die unless defined $k;
if (!$k) { open(my $f, ">", $ARGV[0]) or die; print $f $$; close $f; exec "sleep", "60"; }
select(undef, undef, undef, 1.6); exit 0;
EOF
cat >"$t/orphan.js" <<'EOF'
const c = require("child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { detached: true, stdio: "ignore" });
c.unref(); require("fs").writeFileSync(process.argv[2], String(c.pid));
EOF
for kind in perl node; do
  rm -f "$t/o-$kind.pid"
  if [[ $kind == perl ]]; then spawn="/usr/bin/perl $t/orphan.pl $t/o-$kind.pid"; else spawn="node $t/orphan.js $t/o-$kind.pid"; fi
  "$lockw" sh -c "$spawn; sleep 60 & wait" 2>/dev/null &
  po=$!
  waitfor "[[ -s $t/o-$kind.pid ]]" || bad "orphaned-descendant case ($kind) did not start (setup)"
  op=$(cat "$t/o-$kind.pid" 2>/dev/null)
  waitfor "[[ \$(ps -o ppid= -p $op 2>/dev/null | tr -d ' ') == 1 ]]" 5 || bad "the descendant ($kind) was not orphaned (setup)"
  kill -TERM "$po"
  bwait "$po" 10 || bad "wrapper did not exit after SIGTERM (orphaned-descendant case, $kind)"
  kill -0 "$op" 2>/dev/null && bad "a descendant ($kind) that had lost its parent before the signal outlived the wrapper's SIGTERM and the lock was released"
done

# Only processes that are still the command's descendants are signalled: a process the test starts that the
# wrapper wrongly remembers (as if it had a reused PID; the test-only hook plants it with a start time
# that is not its own) survives the TERM and the KILL after the grace period.
/usr/bin/perl -e 'use POSIX (); POSIX::setsid(); open(my $f, ">", $ARGV[0]) or die; print $f $$; close $f; exec "sleep", "60"' "$t/u.pid" 2>/dev/null &
disown $!
waitfor "[[ -s $t/u.pid ]]" || bad "reused-PID case did not start (setup)"
up=$(cat "$t/u.pid" 2>/dev/null)
TJ_BROWSER_LOCK_TEST_STALE_PID=$up TJ_BROWSER_LOCK_GRACE=1 "$lockw" sh -c "trap '' TERM; echo \$\$ >$t/r.pid; while :; do sleep 1; done" 2>/dev/null &
pr=$!
waitfor "[[ -s $t/r.pid ]]" || bad "reused-PID case did not start (setup)"
kill -TERM "$pr"
bwait "$pr" 10 || bad "wrapper did not exit after SIGTERM (reused-PID case)"
kill -0 "$up" 2>/dev/null || bad "a process that was not a descendant of the command was signalled after its PID was remembered"

# A lock that cannot be taken for a reason other than another holder fails with a message and does not wait
# (a FIFO opens but cannot be flocked).
mkfifo "$t/fifo"
TJ_BROWSER_LOCK_DIR="$t/fifo" "$lockw" true 2>"$t/f.err" &
pf=$!
if bwait "$pf" 3; then
  wait "$pf"; code=$?
  [[ $code == 2 ]] || bad "unlockable lock file exited $code, not 2"
else
  bad "the wrapper waited for a lock that no holder has"
fi
grep -q "cannot lock" "$t/f.err" || bad "no failure message for an unlockable lock file"
grep -q "waiting for the lock" "$t/f.err" && bad "the wrapper announced a holder for an unlockable lock file"

# A command run inside the lock that wraps another command again does not deadlock.
"$lockw" "$lockw" bash -c "echo nested >$t/nested" 2>/dev/null &
pn=$!
bwait "$pn" 5 || bad "nested wrapper deadlocked"
[[ -s "$t/nested" ]] || bad "nested command did not run"

(( fail )) || echo "PASS: one caller at a time, also after a killed holder"
exit $fail
