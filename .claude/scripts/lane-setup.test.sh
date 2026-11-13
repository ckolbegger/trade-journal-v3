#!/bin/bash
# Test of lane-setup.sh's source-root derivation, through its --print-source-root query mode (no cloning).
# Main case: it should take the source root from the innermost .claude/worktrees/ component of the
# lane's path, so a lane under a deliverable worktree that itself sits inside a .claude/worktrees/
# directory resolves that deliverable worktree, not the outer directory.
# Also checks: the plain path gives the deliverable root, and a path outside any .claude/worktrees/ is
# refused with exit 2.
here=$(cd "$(dirname "$0")" && pwd)
ls_="$here/lane-setup.sh"
fail=0
bad() { echo "FAIL: $*"; fail=1; }

out=$("$ls_" --print-source-root /x/.claude/worktrees/outer/.claude/worktrees/lane 2>&1); code=$?
[[ $code == 0 && "$out" == /x/.claude/worktrees/outer ]] || bad "nested path: expected /x/.claude/worktrees/outer, got exit $code: $out"

out=$("$ls_" --print-source-root /x/deliverable/.claude/worktrees/lane 2>&1); code=$?
[[ $code == 0 && "$out" == /x/deliverable ]] || bad "plain path: expected /x/deliverable, got exit $code: $out"

out=$("$ls_" --print-source-root /x/deliverable/lane 2>&1); code=$?
[[ $code == 2 && "$out" == *"not under a .claude/worktrees/"* ]] || bad "path outside .claude/worktrees: expected exit 2 and a refusal, got exit $code: $out"

[[ $fail == 0 ]] && echo "lane-setup.test: all passed"
exit $fail
