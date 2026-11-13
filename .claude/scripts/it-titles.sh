#!/usr/bin/env bash
# Lists every `it` title under src/, sorted, one per line (no file names). Run before and after a test-file
# split and diff the two outputs: an empty diff means the same multiset of titles. Usage: it-titles.sh [dir]
# Covers it(...), it.skip/only/todo(...) and it.each(table)(...), with single, double or backtick quotes and
# a title or table spanning lines. A plain it( title is printed bare; any other form is prefixed with its name
# ("it.each: ", "it.skip: ", ...), so a diff also shows a case changing form. An it.each title is its template.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
dir="${1:-$root/src}"
read -r -d '' prog <<'PERL' || true
my $str = qr/"(?:\\.|[^"\\])*+"|'(?:\\.|[^'\\])*+'|`(?:\\.|[^`\\])*+`/s;
my $tbl = qr/(?<t>\((?:[^()"'`]++|$str|(?&t))*+\))/;
while (/^[ \t]*it(?:\.(\w+))?(?=\s*\()/mg) {
  my $form = $1;
  my $at = pos;
  if (defined $form && $form eq 'each') { /\G\s*$tbl/gc or next; }
  /\G\s*\(\s*(["'`])((?:\\.|(?!\1).)*+)\1\s*[,)]/gcs or do { pos = $at; next };
  my $title = $2;
  $title =~ s/\s*\n\s*/ /g;
  print((defined $form ? "it.$form: " : "") . "$title\n");
}
PERL
find "$dir" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print0 |
  xargs -0 perl -0777 -ne "$prog" |
  LC_ALL=C sort
