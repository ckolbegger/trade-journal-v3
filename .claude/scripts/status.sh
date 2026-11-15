#!/bin/bash
# status.sh <Dnn>: read-only status of a deliverable. Prints the breakdown's Progress rows that are not
# Done or Withdrawn (task, wave, lane, status, and how many follow-up F and bug B tasks the Commits cell
# names), then every question in evidence/<Dnn>/DECISIONS-PENDING.md without an answer, then the counts.
# A "**Answer" line answers the question whose section it sits in; a "**Qn answer" line answers Qn.
# STATUS_ROOT overrides the repository root (used by the tests). Writes no file.
# A missing breakdown or Progress table exits 1 naming the file; a missing decisions file prints
# "no decisions file" and carries on (exit 0).
d=${1:?usage: status.sh <Dnn>}
root=${STATUS_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}

shopt -s nullglob
plan=
for f in "$root"/plan/"$d"-*.md; do
  [[ $f == *handoff.md ]] && continue
  [[ -z $plan ]] && plan=$f
  grep -q '^## .*Progress' "$f" && { plan=$f; break; }
done
if [[ -z $plan ]]; then echo "status.sh: no breakdown plan/$d-*.md in $root" >&2; exit 1; fi

rows=$(awk -F'|' '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  /^## .*Progress/ { n++; inprog = 1; intable = 0; hdr = 0; delete col; next }
  /^#/ { inprog = 0; next }
  inprog && /^\|/ {
    if (!hdr) { for (i = 2; i < NF; i++) col[trim($i)] = i; hdr = 1; next }
    if ($0 ~ /^\|[ \t]*-/) next
    task = trim($(col["Task"])); wave = trim($(col["Wave"])); lane = trim($(col["Lane"]))
    status = trim($(col["Status"])); commits = trim($(col["Commits"]))
    if (status ~ /^(Done|Withdrawn)/) next
    gsub(/`[^`]*`/, " ", commits)
    f = 0; b = 0; delete seen
    s = commits
    while (match(s, /(^|[^A-Za-z0-9-])(T[0-9]+(\.[0-9]+)*-)?[FB][0-9]+(-[FB][0-9]+)*/)) {
      tok = substr(s, RSTART, RLENGTH); sub(/^[^FB]*/, "", tok)
      s = substr(s, RSTART + RLENGTH)
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
echo "Open tasks ($d):"
if [[ -n $rows ]]; then
  nrows=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
  printf '%s\n' "$rows" | sed 's/^/  /'
else echo "  none"; fi

dec="$root/evidence/$d/DECISIONS-PENDING.md"
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

echo "$nrows open task(s), $nq open question(s)"
if [[ $nrows == 0 && $nq == 0 ]]; then echo "nothing open"; fi
exit 0
