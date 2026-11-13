#!/usr/bin/env bash
# Lists every `it` title under src/, sorted, one per line (no file names). Run before and after a test-file
# split and diff the two outputs: an empty diff means the same multiset of titles. Usage: it-titles.sh [dir]
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
dir="${1:-$root/src}"
find "$dir" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print0 |
  xargs -0 perl -ne 'print "$2\n" if /^\s*it(?:\.\w+)?\(\s*(["\x27`])(.*)\1\s*,/' |
  LC_ALL=C sort
