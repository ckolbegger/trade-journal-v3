#!/bin/bash
# Test of status.sh. Fixtures sit in a scratch repository root (STATUS_ROOT) holding plan/ and evidence/.
# Usage: status.test.sh [case-number]  (no argument runs every case).
# Cases: 1 D08 on the real files reports nothing open; 2 a fixture with one open row and one unanswered
# question prints both; 3 F and B tasks in the Commits cell are counted; 4 a "**Qn answer" line answers Qn
# even when it sits under another question's heading; 5 a missing breakdown is named and exits non-zero;
# 6 handoff files are skipped when picking the breakdown; 7 tables under a later heading are not read;
# 8 IDs written with the task prefix (T9.2-F1) count the same as bare ones; 9 a bare "**Answer" counts only
# inside its own question's section (any other heading ends it), a "**Qn answer" still answers by label.
here=$(cd "$(dirname "$0")" && pwd)
st="$here/status.sh"
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
only=${1:-all}
want() { [[ $only == all || $only == "$1" ]]; }

# mkfix <name> <table rows...>: a breakdown with a Progress table and an empty decisions file.
mkfix() {
  local d="$t/$1"; shift
  mkdir -p "$d/plan" "$d/evidence/D99"
  { printf '# D99\n\n## 3. Other\n\n| A | B |\n|---|---|\n| x | y |\n\n## 11. Progress\n\nText.\n\n| Task | Wave | Lane | Status | Commits |\n|---|---|---|---|---|\n'
    printf '%s\n' "$@"; } >"$d/plan/D99-fixture.md"
  : >"$d/evidence/D99/DECISIONS-PENDING.md"
}

if want 1; then
  out=$("$st" D08 2>&1); code=$?
  [[ $code == 0 && "$out" == *"nothing open"* ]] || bad "D08 did not report nothing open (exit $code): $out"
  [[ "$out" != *"T8."* && "$out" != *"Q8"* ]] || bad "D08 listed an open row or question: $out"
fi

if want 2; then
  mkfix one '| T9.1 | 2 | WR | Done | `abc` |' '| T9.2 | 3 | UB | In progress from `def` | `ghi` |' '| T9.3 | — | — | Withdrawn (decision 1) | |' '| T9.4 | 1 | FM | Done (includes T9.2-B1) | `jkl` |'
  printf '## Q1. First question — open\n\nText.\n\n## Q2. Second — answered\n\n**Answer:** (a)\n\n## Q3. Third — open\n\nText.\n' >"$t/one/evidence/D99/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$t/one" "$st" D99 2>&1); code=$?
  [[ $code == 0 ]] || bad "fixture exited $code: $out"
  [[ "$out" == *"T9.2"* && "$out" == *"wave 3"* && "$out" == *"lane UB"* && "$out" == *"In progress from"* ]] || bad "open row missing its wave, lane or status: $out"
  [[ "$out" != *"T9.1"* && "$out" != *"T9.3"* && "$out" != *"T9.4"* ]] || bad "a finished row was listed: $out"
  [[ "$out" == *"Q1."* && "$out" == *"Q3."* && "$out" != *"Q2."* ]] || bad "open questions wrong: $out"
  [[ "$out" == *"1 open task"* && "$out" == *"2 open question"* ]] || bad "final counts wrong: $out"
  [[ "$out" != *"nothing open"* ]] || bad "said nothing open: $out"
fi

if want 3; then
  mkfix cnt '| T9.5 | 1 | A | Paused | `b1b1b1b1`; B1 `aaaa`, B2 and F1 `bbbb`, F1-B1 `cccc`; F2 `dddd`, B1 `eeee` |'
  out=$(STATUS_ROOT="$t/cnt" "$st" D99 2>&1)
  [[ "$out" == *"F 2"* && "$out" == *"B 3"* ]] || bad "F/B counts wrong (want F 2, B 3): $out"
fi

if want 4; then
  mkfix ans '| T9.6 | 1 | A | Done | `x` |'
  printf '## Q8. Eight — open\n\nText.\n\n## Q9. Nine — open\n\n**Q8 answer (d): (a).** yes\n\n**Q9 answer (d): (b).**\n\n## Q10. Ten — open\n\nText.\n' >"$t/ans/evidence/D99/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$t/ans" "$st" D99 2>&1)
  [[ "$out" == *"Q10."* && "$out" != *"Q8."* && "$out" != *"Q9."* ]] || bad "Qn answer not attributed by label: $out"
fi

if want 5; then
  out=$(STATUS_ROOT="$t/none" "$st" D99 2>&1); code=$?
  [[ $code != 0 && "$out" == *"D99"* ]] || bad "missing breakdown not reported: $code $out"
fi

if want 6; then
  mkfix many '| T9.7 | 2 | A | Paused | `x` |'
  mv "$t/many/plan/D99-fixture.md" "$t/many/plan/D99-zeta-breakdown.md"
  printf '# Handoff\n\nNotes without a table.\n' >"$t/many/plan/D99-implementing-handoff.md"
  printf '# Handoff\n' >"$t/many/plan/D99-handoff.md"
  out=$(STATUS_ROOT="$t/many" "$st" D99 2>&1); code=$?
  [[ $code == 0 && "$out" == *"T9.7"* ]] || bad "breakdown holding the Progress table not picked among handoff files (exit $code): $out"
fi

if want 7; then
  mkfix late '| T9.8 | 2 | A | Paused | `x` |'
  printf '\n## 12. Later\n\n| Task | Wave | Lane | Status | Commits |\n|---|---|---|---|---|\n| T9.90 | 1 | B | Paused | `y` |\n\n### 12.1 Sub\n\n| Task | Wave | Lane | Status | Commits |\n|---|---|---|---|---|\n| T9.91 | 1 | B | Paused | `z` |\n' >>"$t/late/plan/D99-fixture.md"
  out=$(STATUS_ROOT="$t/late" "$st" D99 2>&1)
  [[ "$out" == *"T9.8 "* && "$out" != *"T9.90"* && "$out" != *"T9.91"* && "$out" == *"1 open task"* ]] || bad "rows under a later heading were listed as open tasks: $out"
fi

if want 8; then
  mkfix pre '| T9.2 | 1 | A | Paused | `abc`; T9.2-F1, T9.2-B1, T9.2-F1-B1 |'
  out=$(STATUS_ROOT="$t/pre" "$st" D99 2>&1)
  [[ "$out" == *"F 1, B 2"* ]] || bad "task-prefixed IDs not counted (want F 1, B 2): $out"
  mkfix mix '| T9.3 | 1 | A | Paused | T9.3-F1 `def`, F1, B1, T9.3-B1, F1-B1, T9.3-F1-B1 |'
  out=$(STATUS_ROOT="$t/mix" "$st" D99 2>&1)
  [[ "$out" == *"F 1, B 2"* ]] || bad "prefixed and bare IDs not merged (want F 1, B 2): $out"
fi

if want 9; then
  mkfix sec '| T9.6 | 1 | A | Done | `x` |'
  printf '## Q1. One — open\n\nText.\n\n## Summary\n\n**Answer:** zzz\n' >"$t/sec/evidence/D99/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$t/sec" "$st" D99 2>&1)
  [[ "$out" == *"Q1."* && "$out" == *"1 open question"* ]] || bad "a bare Answer under a non-question heading answered Q1: $out"
  mkfix lab '| T9.6 | 1 | A | Done | `x` |'
  printf '## Q1. One — open\n\nText.\n\n## Summary\n\n**Q1 answer (d): (a).**\n' >"$t/lab/evidence/D99/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$t/lab" "$st" D99 2>&1)
  [[ "$out" != *"Q1."* ]] || bad "a Qn answer under a non-question heading did not answer Qn: $out"
fi

[[ $fail == 0 ]] && echo "status.test.sh: all requested cases passed"
exit $fail
