#!/bin/bash
# status.sh <Dnn> [--all]: read-only status of a deliverable. Prints the breakdown's Progress rows that are
# not Done or Withdrawn, or every row with --all (task, wave, lane, status, and how many follow-up F and bug
# B tasks the Commits cell names; "—" for a Wave or Lane column the table lacks), then every question in evidence/<Dnn>/DECISIONS-PENDING.md without an answer, then the counts.
# For a name with a hyphen (D09A-R) the folder without it (evidence/D09AR) is read when the named one is absent.
# For a name with a dot (D09.5) the folder of its digits without the leading zero and the dot (evidence/D95) is read
# when the named one is absent.
# A "**Answer" line answers the question whose section it sits in; a "**Qn answer" line answers Qn.
# STATUS_ROOT overrides the repository root (used by the tests). Writes no file.
# A missing breakdown or Progress table exits 1 naming the file; a missing decisions file prints
# "no decisions file" and carries on (exit 0).
d=${1:?usage: status.sh <Dnn> [--all]}
all=0; [[ ${2:-} == --all ]] && all=1
root=${STATUS_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}

shopt -s nullglob
plan=
for f in "$root"/plan/"$d"-*.md; do
  [[ $f == *handoff.md ]] && continue
  [[ -z $plan ]] && plan=$f
  awk '/^## .*Progress/ { p = 1; next } /^#/ { p = 0 } p && /^\|/ { found = 1; exit } END { exit !found }' "$f" && { plan=$f; break; }
done
if [[ -z $plan ]]; then echo "status.sh: no breakdown plan/$d-*.md in $root" >&2; exit 1; fi

rows=$(awk -F'|' -v all="$all" '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function cell(name) { return (name in col) ? trim($(col[name])) : "—" }
  /^## .*Progress/ { n++; inprog = 1; intable = 0; hdr = 0; delete col; next }
  /^#/ { inprog = 0; next }
  inprog && /^\|/ {
    if (!hdr) { for (i = 2; i < NF; i++) col[trim($i)] = i; hdr = 1; next }
    if ($0 ~ /^\|[ \t]*-/) next
    task = cell("Task"); wave = cell("Wave"); lane = cell("Lane")
    status = cell("Status"); commits = cell("Commits")
    if (!all && status ~ /^(Done|Withdrawn)/) next
    gsub(/`[^`]*`/, " ", commits)
    f = 0; b = 0; delete seen
    s = commits
    while (match(s, /(^|[^A-Za-z0-9-])([A-Za-z0-9.]+-)*[FB][0-9]+(-[FB][0-9]+)*/)) {
      pos = RSTART; len = RLENGTH
      tok = substr(s, pos, len); sub(/^[^A-Za-z0-9]/, "", tok)
      s = substr(s, pos + len)
      match(tok, /(^|-)[FB][0-9]+(-[FB][0-9]+)*$/); tok = substr(tok, RSTART, RLENGTH); sub(/^-/, "", tok)
      if (tok in seen) continue
      seen[tok] = 1
      last = tok; sub(/^.*-/, "", last)
      if (substr(last, 1, 1) == "F") f++; else b++
    }
    printf "%s | wave %s | lane %s | %s | F %d, B %d\n", task, wave, lane, status, f, b
    next
  }
  inprog && hdr && !/^\|/ && NF { hdr = 0 }
  END { if (!n || !length(col)) exit 3 }
' "$plan"); rc=$?
if [[ $rc == 3 ]]; then echo "status.sh: no Progress table in $plan" >&2; exit 1; fi

nrows=0
if [[ $all == 1 ]]; then echo "All tasks ($d):"; else echo "Open tasks ($d):"; fi
if [[ -n $rows ]]; then
  nrows=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
  printf '%s\n' "$rows" | sed 's/^/  /'
else echo "  none"; fi

dec="$root/evidence/$d/DECISIONS-PENDING.md"
# A deliverable named with a hyphen (D09A-R) keeps its evidence in the folder without it (D09AR).
[[ -f $dec || $d != *-* ]] || { alt="$root/evidence/${d//-/}/DECISIONS-PENDING.md"; [[ -f $alt ]] && dec=$alt; }
# A deliverable named with a dot (D09.5) keeps its evidence in the folder of its digits, no leading zero (D95).
if [[ ! -f $dec && $d == *.* ]]; then alt=${d//./}; alt="$root/evidence/${alt/#D0/D}/DECISIONS-PENDING.md"; [[ -f $alt ]] && dec=$alt; fi
nq=0
echo "Open questions:"
if [[ ! -f $dec ]]; then
  echo "  no decisions file ($dec)"
else
  qs=$(awk '
    /^## Q[0-9]+\./ { cur = $2; sub(/\.$/, "", cur); title = $0; sub(/^## /, "", title); order[++n] = cur; text[cur] = title; next }
    /^#/ { cur = ""; next }
    /^\*\*Answer/ { if (cur != "") ans[cur] = 1; next }
    /^\*\*Q[0-9]+ answer/ { lab = $1; sub(/^\*\*/, "", lab); ans[lab] = 1; next }
    END { for (i = 1; i <= n; i++) if (!(order[i] in ans)) print text[order[i]] }
  ' "$dec") || { echo "status.sh: cannot read $dec" >&2; exit 1; }
  if [[ -n $qs ]]; then
    nq=$(printf '%s\n' "$qs" | wc -l | tr -d ' ')
    printf '%s\n' "$qs" | sed 's/^/  /'
  else echo "  none"; fi
fi

if [[ $all == 1 ]]; then echo "$nrows task(s), $nq open question(s)"; else echo "$nrows open task(s), $nq open question(s)"; fi
if [[ $all == 0 && $nrows == 0 && $nq == 0 ]]; then echo "nothing open"; fi
exit 0
