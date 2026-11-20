#!/bin/bash
# Test of status.sh. Fixtures sit in a scratch repository root (STATUS_ROOT) holding plan/ and evidence/.
# Usage: status.test.sh [case-number]  (no argument runs every case).
# Cases: 1 D08 on the real files reports nothing open; 2 a fixture with one open row and one unanswered
# question prints both; 3 F and B tasks in the Commits cell are counted; 4 a "**Qn answer" line answers Qn
# even when it sits under another question's heading; 5 a missing breakdown is named and exits non-zero;
# 6 handoff files are skipped when picking the breakdown; 7 tables under a later heading are not read;
# 8 IDs written with the task prefix (T9.2-F1) count the same as bare ones; 9 a bare "**Answer" counts only
# inside its own question's section (any other heading ends it), a "**Qn answer" still answers by label;
# 10 a decisions file that exists but cannot be read exits non-zero naming it (skipped as root), a missing one
# still prints "no decisions file"; 11 the breakdown is the file whose Progress section holds a table, not
# one with a Progress heading and only prose (and with no such file the script exits 1 naming a file);
# 12 IDs after any task-ID prefix count; 13 each ID counts once when text precedes a chained ID;
# 14 a deliverable named with a hyphen (D98-R) reads the evidence folder named without it (D98R);
# 15 --all lists every row, Done and Withdrawn included, under "All tasks"; 16 a Progress table without
# Wave and Lane columns prints "—" for them.
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
  printf '# Notes\n\nNo Progress heading here.\n' >"$t/many/plan/D99-alpha-notes.md"
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

if want 10; then
  if [[ $(id -u) == 0 ]]; then
    echo "SKIP case 10: running as root, file permissions are ignored"
  else
    mkfix unr '| T9.6 | 1 | A | Done | `x` |'
    printf '## Q1. One — open\n\nText.\n' >"$t/unr/evidence/D99/DECISIONS-PENDING.md"
    chmod 000 "$t/unr/evidence/D99/DECISIONS-PENDING.md"
    out=$(STATUS_ROOT="$t/unr" "$st" D99 2>&1); code=$?
    chmod 644 "$t/unr/evidence/D99/DECISIONS-PENDING.md"
    [[ $code != 0 && "$out" == *"DECISIONS-PENDING.md"* && "$out" != *"nothing open"* ]] || bad "unreadable decisions file not reported (exit $code): $out"
    mkfix nodec '| T9.6 | 1 | A | Done | `x` |'
    rm "$t/nodec/evidence/D99/DECISIONS-PENDING.md"
    out=$(STATUS_ROOT="$t/nodec" "$st" D99 2>&1); code=$?
    [[ $code == 0 && "$out" == *"no decisions file"* ]] || bad "missing decisions file changed behavior (exit $code): $out"
  fi
fi

if want 11; then
  mkfix prose '| T9.7 | 2 | A | Paused | `x` |'
  mv "$t/prose/plan/D99-fixture.md" "$t/prose/plan/D99-zeta-breakdown.md"
  printf '# Notes\n\n## 4. Progress\n\nProse only, no table.\n\n## 5. Other\n' >"$t/prose/plan/D99-alpha-notes.md"
  out=$(STATUS_ROOT="$t/prose" "$st" D99 2>&1); code=$?
  [[ $code == 0 && "$out" == *"T9.7"* ]] || bad "file with a Progress heading but no table was picked over the one with a table (exit $code): $out"
  mkfix only '| T9.7 | 2 | A | Paused | `x` |'
  printf '# Notes\n\n## 4. Progress\n\nProse only.\n' >"$t/only/plan/D99-fixture.md"
  out=$(STATUS_ROOT="$t/only" "$st" D99 2>&1); code=$?
  [[ $code == 1 && "$out" == *"D99-fixture.md"* ]] || bad "no file with a Progress table should exit 1 naming a file (exit $code): $out"
fi

if want 12; then
  mkfix pfx '| T9.8 | 1 | A | Paused | T8P.23-B1, T7S.4-F1, D7-Retro-F3, T9.2-B2, T8P.23-B1, F3 |'
  out=$(STATUS_ROOT="$t/pfx" "$st" D99 2>&1)
  [[ "$out" == *"F 2, B 2"* ]] || bad "IDs after any task-ID prefix not counted (want F 2, B 2): $out"
fi

if want 13; then
  mkfix txt '| T9.2 | 1 | A | Paused | abc T9.2-F1-B1 |'
  out=$(STATUS_ROOT="$t/txt" "$st" D99 2>&1)
  [[ "$out" == *"F 0, B 1"* ]] || bad "chained ID after text counted wrongly (want F 0, B 1): $out"
  mkfix txt2 '| T9.3 | 1 | A | Paused | `a1b2c3d` fixed in abc T9.2-F1-B1, then see D7-Retro-F3 and xy T8P.23-B1; also F2, plus B4 and zz F2-B1, T9.9-F4-B2 again T9.2-F1-B1 |'
  out=$(STATUS_ROOT="$t/txt2" "$st" D99 2>&1)
  [[ "$out" == *"F 2, B 5"* ]] || bad "mixed cell with text before IDs wrongly counted (want F 2, B 5): $out"
  mkfix real '| T8.9 | 1 | WR | Paused | `c8815d65`; F1 `8de26d7d`, F1-B1 and F1-B2 `a656ccc5`; B2 `d85e5c57`, B3 `c1b3b8c7`, B6 `c2e505f5`, B7 `b1ca23af`, B8 `58f845f9`, B9 and B11 `53a54f99`, B10 `8dd43e59`, B12 and B13 `114bcda1`, B14 `4935b752` (B1 moved to T8.11; B4 and B5 closed by Q11) |'
  out=$(STATUS_ROOT="$t/real" "$st" D99 2>&1)
  [[ "$out" == *"F 1, B 16"* ]] || bad "real D08 T8.9 cell wrongly counted (want F 1, B 16): $out"
fi

if want 14; then
  d="$t/hy"; mkdir -p "$d/plan" "$d/evidence/D98R"
  printf '# D98-R\n\n## 11. Progress\n\n| Task | Wave | Lane | Status | Commits |\n|---|---|---|---|---|\n| T98R.1 | 1 | A | Paused | `x` |\n' >"$d/plan/D98-R-fixture.md"
  printf '## Q1. One — open\n\nText.\n' >"$d/evidence/D98R/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$d" "$st" D98-R 2>&1); code=$?
  [[ $code == 0 && "$out" == *"Q1."* && "$out" == *"1 open question"* && "$out" != *"no decisions file"* ]] || bad "hyphenated deliverable did not read the evidence folder named without the hyphen (exit $code): $out"
  rm -r "$d/evidence/D98R"
  out=$(STATUS_ROOT="$d" "$st" D98-R 2>&1); code=$?
  [[ $code == 0 && "$out" == *"no decisions file"* ]] || bad "neither folder present changed behavior (exit $code): $out"
fi

if want 15; then
  mkfix all '| T9.1 | 1 | A | Done | `abc` |' '| T9.2 | 1 | A | Withdrawn (decision 1) | |' '| T9.3 | 2 | B | Not started | |'
  out=$(STATUS_ROOT="$t/all" "$st" D99 --all 2>&1); code=$?
  [[ $code == 0 && "$out" == *"All tasks (D99):"* && "$out" == *"T9.1 | wave 1 | lane A | Done"* && "$out" == *"T9.2 |"* && "$out" == *"T9.3 |"* && "$out" == *"3 task(s)"* ]] || bad "--all did not list every row (exit $code): $out"
  out=$(STATUS_ROOT="$t/all" "$st" D99 2>&1)
  [[ "$out" == *"Open tasks (D99):"* && "$out" != *"T9.1 |"* && "$out" == *"1 open task(s)"* ]] || bad "without --all, Done rows were listed: $out"
fi

if want 16; then
  d="$t/nolane"; mkdir -p "$d/plan" "$d/evidence/D99"
  printf '# D99\n\n## 14. Progress\n\n| Task | Level | Status | Commits |\n|---|---|---|---|\n| T99.1 | Full | Not started | |\n' >"$d/plan/D99-fixture.md"
  : >"$d/evidence/D99/DECISIONS-PENDING.md"
  out=$(STATUS_ROOT="$d" "$st" D99 2>&1); code=$?
  [[ $code == 0 && "$out" == *"T99.1 | wave — | lane — | Not started | F 0, B 0"* ]] || bad "a table without Wave and Lane did not print — for them (exit $code): $out"
fi

[[ $fail == 0 ]] && echo "status.test.sh: all requested cases passed"
exit $fail
