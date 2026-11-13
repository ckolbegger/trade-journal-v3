#!/bin/bash
# usage: with-browser-lock.sh <command...>
# Runs the command while holding the one lock that serializes every user of port 5175: the test
# servers, the tj-release cache in the temp directory, and the CDP ports 9341 and 9342 (decision 111).
# The lock is a directory made with mkdir (atomic), <temp dir>/tj-browser-lock-5175, holding the
# holder's PID in its `pid` file. A second caller waits until it is released. A lock whose holder
# is dead (killed with SIGKILL, say) is taken over, never waited on forever. The lock is released
# on exit, failure or signal, and the command's exit code is passed through.
# The temp directory is the user's own (`getconf DARWIN_USER_TEMP_DIR`, symlinks resolved), not the
# current $TMPDIR, so every process of this user finds the same lock whichever worktree or sandbox
# it runs from. TJ_BROWSER_LOCK_DIR overrides the path (for tests of this script only).
# A command run inside the lock sees TJ_BROWSER_LOCK_HELD=1 and runs without taking it again, so
# wrapping a command that itself wraps its browser stages does not deadlock.
set -u
(( $# >= 1 )) || { echo "usage: $0 <command...>" >&2; exit 2; }
[[ -n "${TJ_BROWSER_LOCK_HELD:-}" ]] && exec "$@"

base=$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null) || base=""
[[ -d "$base" ]] || base=${TMPDIR:-/tmp}
base=$(cd "$base" && pwd -P) || { echo "with-browser-lock: no temp directory" >&2; exit 2; }
lock=${TJ_BROWSER_LOCK_DIR:-$base/tj-browser-lock-5175}

held=0 child=""
release() {
  if (( held )); then
    held=0
    rm -rf "$lock"
  fi
}
on_signal() { # forward the signal to the command, which then ends the wait
  [[ -n "$child" ]] && kill -TERM "$child" 2>/dev/null
  signalled=1
}
signalled=0
trap release EXIT
trap on_signal INT TERM HUP

announced=0
while :; do
  if mkdir "$lock" 2>/dev/null; then
    held=1
    echo $$ >"$lock/pid"
    break
  fi
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
    # Dead holder: move the lock away (rename is atomic, so one waiter wins), then retry.
    echo "with-browser-lock: taking over the lock left by dead process $pid" >&2
    stale="$lock.stale.$$"
    mv "$lock" "$stale" 2>/dev/null && rm -rf "$stale"
    continue
  fi
  if [[ -z "$pid" && -d "$lock" ]]; then
    # The holder is between mkdir and writing its PID; a lock with no PID for 10 s was left by a crash.
    age=$(( $(date +%s) - $(stat -f %m "$lock" 2>/dev/null || date +%s) ))
    if (( age > 10 )); then mv "$lock" "$lock.stale.$$" 2>/dev/null && rm -rf "$lock.stale.$$"; continue; fi
  fi
  if (( ! announced )); then echo "with-browser-lock: waiting for the lock held by process ${pid:-?} ($lock)" >&2; announced=1; fi
  sleep 1
  (( signalled )) && exit 130
done
(( announced )) && echo "with-browser-lock: acquired" >&2

TJ_BROWSER_LOCK_HELD=1 "$@" &
child=$!
wait "$child"
code=$?
while (( signalled )) && kill -0 "$child" 2>/dev/null; do wait "$child"; code=$?; done
exit $code
